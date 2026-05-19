#!/usr/bin/env node
/**
 * dev-seed-creator-coin.mjs
 *
 * Idempotent localnet seed:
 *   1. register admin in core::register_user (if not already)
 *   2. spawn 100 dummy follower keypairs, airdrop each 0.005 SOL, register
 *      each in core, then call core::follow_user(admin) — pushes admin's
 *      follower_count >= MIN_FOLLOWERS (100)
 *   3. call creator-coin::create_creator_coin(symbol="JUDGE", initial_price)
 *   4. init_redemption_counter + add a "Signed Poster" Consumable benefit
 *
 * Re-runnable: each instruction checks "already exists" by reading the PDA
 * first; existing accounts skip without erroring.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORE_PROGRAM_ID = new PublicKey(
  '4VTNh4tcTuF5wDYhP8qbvf5hdUV4xUm7KJVJd9oSweEE',
);
const CREATOR_COIN_PROGRAM_ID = new PublicKey(
  'DW4BZcwY5c3nQHMGKysmTdXKpFous778RKcbSvw2xNMZ',
);
const RPC = process.env.SOLANA_RPC || 'http://127.0.0.1:8899';
const FOLLOWERS_STATE_PATH = path.join(
  __dirname,
  '../target/dev-seed-followers.json',
);

// ──────────────────────────────────────────────────────────────
// Anchor helpers
// ──────────────────────────────────────────────────────────────
function ixDisc(name) {
  return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
}
function u64LE(v) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(v), 0);
  return b;
}
function u32LE(v) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(Number(v), 0);
  return b;
}
function strBorsh(s) {
  const enc = Buffer.from(s, 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32LE(enc.length, 0);
  return Buffer.concat([len, enc]);
}
function pubkeyArg(p) {
  return p.toBuffer();
}

function pda(seeds, programId) {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

function loadKp(p) {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(p, 'utf8'))),
  );
}

async function airdrop(connection, who, sol) {
  const sig = await connection.requestAirdrop(who, sol * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, 'confirmed');
}

async function sendIx(connection, signers, ixs, opts = {}) {
  const tx = new Transaction().add(...ixs);
  return sendAndConfirmTransaction(connection, tx, signers, {
    commitment: 'confirmed',
    skipPreflight: opts.skipPreflight || false,
  });
}

// ──────────────────────────────────────────────────────────────
// core::register_user
// ──────────────────────────────────────────────────────────────
async function registerUser(connection, payer, username) {
  const userPda = pda(
    [Buffer.from('user'), payer.publicKey.toBuffer()],
    CORE_PROGRAM_ID,
  );
  const exists = await connection.getAccountInfo(userPda);
  if (exists) return { userPda, created: false };

  // register_user(username: String, profile_uri: String)
  const data = Buffer.concat([
    ixDisc('register_user'),
    strBorsh(username),
    strBorsh('https://dev.aura/' + username),
  ]);
  const ix = new TransactionInstruction({
    programId: CORE_PROGRAM_ID,
    keys: [
      { pubkey: userPda, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
  await sendIx(connection, [payer], [ix]);
  return { userPda, created: true };
}

// ──────────────────────────────────────────────────────────────
// core::follow_user
// ──────────────────────────────────────────────────────────────
async function followAdmin(connection, follower, adminUserPda, adminAuthority) {
  const followerUserPda = pda(
    [Buffer.from('user'), follower.publicKey.toBuffer()],
    CORE_PROGRAM_ID,
  );
  const followRecord = pda(
    [Buffer.from('follow'), followerUserPda.toBuffer(), adminUserPda.toBuffer()],
    CORE_PROGRAM_ID,
  );
  const existing = await connection.getAccountInfo(followRecord);
  if (existing) return false; // already followed

  const data = ixDisc('follow_user');
  const ix = new TransactionInstruction({
    programId: CORE_PROGRAM_ID,
    keys: [
      { pubkey: followerUserPda, isSigner: false, isWritable: true },
      { pubkey: adminUserPda, isSigner: false, isWritable: true },
      { pubkey: followRecord, isSigner: false, isWritable: true },
      { pubkey: follower.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
  await sendIx(connection, [follower], [ix]);
  return true;
}

// ──────────────────────────────────────────────────────────────
// creator-coin helpers
// ──────────────────────────────────────────────────────────────
function getCreatorCoinPda(creator) {
  return pda(
    [Buffer.from('creator_coin'), creator.toBuffer()],
    CREATOR_COIN_PROGRAM_ID,
  );
}
function getCreatorCoinMintPda(creator) {
  return pda(
    [Buffer.from('creator_coin_mint'), creator.toBuffer()],
    CREATOR_COIN_PROGRAM_ID,
  );
}
function getBenefitsListPda(coinMint) {
  return pda(
    [Buffer.from('benefits'), coinMint.toBuffer()],
    CREATOR_COIN_PROGRAM_ID,
  );
}
function getRedemptionCounterPda(coinMint) {
  return pda(
    [Buffer.from('redemption-counter'), coinMint.toBuffer()],
    CREATOR_COIN_PROGRAM_ID,
  );
}

// ──────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────
async function main() {
  const connection = new Connection(RPC, 'confirmed');
  const admin = loadKp(path.join(homedir(), '.config/solana/id.json'));
  console.log(`Admin: ${admin.publicKey.toBase58()}`);
  console.log(`RPC: ${RPC}\n`);

  // Top-up admin so we don't run out
  try {
    await airdrop(connection, admin.publicKey, 5);
  } catch {}

  // ── Step 1: register admin in core ──────────────────────
  console.log('[1] Register admin in core::register_user');
  const { userPda: adminUserPda, created: adminCreated } = await registerUser(
    connection,
    admin,
    'admin',
  );
  console.log(`    admin user_profile = ${adminUserPda.toBase58()} ${adminCreated ? '(NEW)' : '(exists)'}`);

  // Read current follower_count
  async function readFollowerCount(profilePda) {
    const acc = await connection.getAccountInfo(profilePda);
    if (!acc) return 0;
    // UserProfile layout:
    //   8 disc + 32 authority + 4 username_len + username + 4 uri_len + uri
    //   + 4 reputation_score + 4 follower_count + ...
    const data = acc.data;
    let off = 8 + 32;
    const usernameLen = data.readUInt32LE(off);
    off += 4 + usernameLen;
    const uriLen = data.readUInt32LE(off);
    off += 4 + uriLen;
    // reputation_score (u32)
    off += 4;
    const followerCount = data.readUInt32LE(off);
    return followerCount;
  }

  let followerCount = await readFollowerCount(adminUserPda);
  console.log(`    current follower_count = ${followerCount}`);

  // ── Step 2: top-up follower keypairs ────────────────────
  const NEEDED = 100;
  console.log(`\n[2] Stuff ${NEEDED} followers (current: ${followerCount})`);

  let followers = [];
  if (existsSync(FOLLOWERS_STATE_PATH)) {
    const dump = JSON.parse(readFileSync(FOLLOWERS_STATE_PATH, 'utf8'));
    followers = dump.map((arr) => Keypair.fromSecretKey(Uint8Array.from(arr)));
    console.log(`    loaded ${followers.length} followers from cache`);
  }
  while (followers.length < NEEDED) {
    followers.push(Keypair.generate());
  }
  writeFileSync(
    FOLLOWERS_STATE_PATH,
    JSON.stringify(followers.map((kp) => Array.from(kp.secretKey))),
  );

  if (followerCount >= NEEDED) {
    console.log('    ✓ already at threshold; skipping follower stuffing');
  } else {
    // Process in batches to avoid running out of compute / hitting rate limits
    const BATCH = 5;
    for (let i = 0; i < NEEDED; i += BATCH) {
      const batch = followers.slice(i, i + BATCH);
      // Airdrop in parallel
      await Promise.all(
        batch.map(async (kp) => {
          try {
            const bal = await connection.getBalance(kp.publicKey);
            if (bal < 0.01 * LAMPORTS_PER_SOL) {
              await airdrop(connection, kp.publicKey, 0.05);
            }
          } catch {}
        }),
      );
      for (let j = 0; j < batch.length; j++) {
        const f = batch[j];
        const idx = i + j;
        try {
          await registerUser(connection, f, `fol${idx}`);
        } catch (e) {
          console.log(`    follower #${idx} register skipped: ${e.message?.slice(0, 80)}`);
        }
        try {
          const did = await followAdmin(connection, f, adminUserPda, admin.publicKey);
          if (did) process.stdout.write('.');
          else process.stdout.write('-');
        } catch (e) {
          process.stdout.write('!');
        }
      }
    }
    console.log('');
    followerCount = await readFollowerCount(adminUserPda);
    console.log(`    follower_count after stuffing = ${followerCount}`);
    if (followerCount < NEEDED) {
      throw new Error(`Failed to reach ${NEEDED} followers (got ${followerCount})`);
    }
  }

  // ── Step 3: create_creator_coin ─────────────────────────
  console.log(`\n[3] create_creator_coin(symbol="JUDGE")`);
  const creatorCoinPda = getCreatorCoinPda(admin.publicKey);
  const coinMintPda = getCreatorCoinMintPda(admin.publicKey);
  const benefitsListPda = getBenefitsListPda(coinMintPda);

  const creatorTokenAcc = getAssociatedTokenAddressSync(
    coinMintPda,
    admin.publicKey,
  );
  const ccExists = await connection.getAccountInfo(creatorCoinPda);
  const blExists = await connection.getAccountInfo(benefitsListPda);
  const ataExists = await connection.getAccountInfo(creatorTokenAcc);

  if (ccExists && blExists && ataExists) {
    console.log(`    ✓ creator_coin fully finalized at ${creatorCoinPda.toBase58()}`);
  } else {
    const activityOracle = Keypair.generate().publicKey;

    if (!ccExists) {
      // Step 1/3: init_creator_coin_mint
      const s1 = new TransactionInstruction({
        programId: CREATOR_COIN_PROGRAM_ID,
        keys: [
          { pubkey: creatorCoinPda, isSigner: false, isWritable: true },
          { pubkey: coinMintPda, isSigner: false, isWritable: true },
          { pubkey: adminUserPda, isSigner: false, isWritable: false },
          { pubkey: admin.publicKey, isSigner: true, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        ],
        data: Buffer.concat([
          ixDisc('init_creator_coin_mint'),
          strBorsh('JUDGE'),
          u64LE(1_000_000_000n),
          pubkeyArg(activityOracle),
        ]),
      });
      const sig1 = await sendIx(connection, [admin], [s1]);
      console.log(`    ✓ [1/3] init_creator_coin_mint: ${sig1}`);
    } else {
      console.log(`    - [1/3] creator_coin already exists, skipping`);
    }

    if (!blExists) {
      // Step 2/3: init_creator_coin_benefits
      const s2 = new TransactionInstruction({
        programId: CREATOR_COIN_PROGRAM_ID,
        keys: [
          { pubkey: creatorCoinPda, isSigner: false, isWritable: true },
          { pubkey: coinMintPda, isSigner: false, isWritable: false },
          { pubkey: benefitsListPda, isSigner: false, isWritable: true },
          { pubkey: admin.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: ixDisc('init_creator_coin_benefits'),
      });
      const sig2 = await sendIx(connection, [admin], [s2]);
      console.log(`    ✓ [2/3] init_creator_coin_benefits: ${sig2}`);
    } else {
      console.log(`    - [2/3] benefits_list already exists, skipping`);
    }

    if (!ataExists) {
      // Step 3/3: finalize_creator_coin (creates ATA + mints supply)
      const s3 = new TransactionInstruction({
        programId: CREATOR_COIN_PROGRAM_ID,
        keys: [
          { pubkey: creatorCoinPda, isSigner: false, isWritable: true },
          { pubkey: coinMintPda, isSigner: false, isWritable: true },
          { pubkey: creatorTokenAcc, isSigner: false, isWritable: true },
          { pubkey: admin.publicKey, isSigner: true, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        ],
        data: ixDisc('finalize_creator_coin'),
      });
      const sig3 = await sendIx(connection, [admin], [s3]);
      console.log(`    ✓ [3/3] finalize_creator_coin: ${sig3}`);
    } else {
      console.log(`    - [3/3] creator ATA already exists, skipping`);
    }
    console.log(`    creator_coin: ${creatorCoinPda.toBase58()}`);
    console.log(`    coin_mint:    ${coinMintPda.toBase58()}`);
  }

  // ── Step 4: init_redemption_counter ─────────────────────
  console.log(`\n[4] init_redemption_counter`);
  const redemptionCounterPda = getRedemptionCounterPda(coinMintPda);
  const rcExists = await connection.getAccountInfo(redemptionCounterPda);
  if (rcExists) {
    console.log(`    ✓ redemption_counter already exists`);
  } else {
    const data = ixDisc('init_redemption_counter');
    const ix = new TransactionInstruction({
      programId: CREATOR_COIN_PROGRAM_ID,
      keys: [
        { pubkey: redemptionCounterPda, isSigner: false, isWritable: true },
        { pubkey: creatorCoinPda, isSigner: false, isWritable: false },
        { pubkey: coinMintPda, isSigner: false, isWritable: false },
        { pubkey: admin.publicKey, isSigner: true, isWritable: false }, // creator
        { pubkey: admin.publicKey, isSigner: true, isWritable: true }, // payer
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    const sig = await sendIx(connection, [admin], [ix]);
    console.log(`    ✓ init_redemption_counter confirmed: ${sig}`);
  }

  // ── Step 5: add a "Signed Poster" Consumable benefit ───
  console.log(`\n[5] add_benefit (Consumable "Signed Poster", 50 CC)`);
  // Read benefits_list to see if benefit already exists.
  const blAcc = await connection.getAccountInfo(benefitsListPda);
  // benefits_list layout: 8 disc + 32 coin_mint + 32 creator + 4 vec_len + benefits[]
  // Each Benefit: 4 id + 1 type + 8 threshold + 4+uri_len + 32 hash + 1 active
  // [dev-seed 2026-05-19] Check specifically for an active *Consumable* benefit
  // (BenefitType::Consumable == 1). A Holding benefit (type 0) doesn't satisfy
  // the redemption flow, so we still need to add one even if vecLen > 0.
  let alreadyHasBenefit = false;
  if (blAcc) {
    const data = blAcc.data;
    const vecLen = data.readUInt32LE(8 + 32 + 32);
    let off = 8 + 32 + 32 + 4;
    for (let i = 0; i < vecLen; i++) {
      const btype = data.readUInt8(off + 4);
      const uriLen = data.readUInt32LE(off + 13);
      const benSize = 4 + 1 + 8 + 4 + uriLen + 32 + 1;
      const active = data.readUInt8(off + benSize - 1);
      if (active === 1 && btype === 1) {
        alreadyHasBenefit = true;
        break;
      }
      off += benSize;
    }
  }
  if (alreadyHasBenefit) {
    console.log(`    ✓ benefit already exists`);
  } else {
    // add_benefit(benefit_type: BenefitType, threshold: u64, metadata_uri: String, metadata_hash: [u8;32])
    // BenefitType (from benefits.rs): Holding=0, Consumable=1
    const benefitType = 1; // Consumable
    const threshold = 50_000_000_000n; // 50 CC with 9 decimals (matches your CC mint decimals)
    const metadataUri = 'https://dev.aura/benefit/signed-poster';
    const metadataHash = Buffer.alloc(32, 1);
    const data = Buffer.concat([
      ixDisc('add_benefit'),
      Buffer.from([benefitType]),
      u64LE(threshold),
      strBorsh(metadataUri),
      metadataHash,
    ]);
    const ix = new TransactionInstruction({
      programId: CREATOR_COIN_PROGRAM_ID,
      keys: [
        { pubkey: benefitsListPda, isSigner: false, isWritable: true },
        { pubkey: admin.publicKey, isSigner: true, isWritable: false },
      ],
      data,
    });
    const sig = await sendIx(connection, [admin], [ix]);
    console.log(`    ✓ add_benefit confirmed: ${sig}`);
  }

  // ── Final summary ──────────────────────────────────────
  console.log('\n========================================');
  console.log('✅ DEV SEED COMPLETE');
  console.log('========================================');
  console.log(`admin:               ${admin.publicKey.toBase58()}`);
  console.log(`admin user_profile:  ${adminUserPda.toBase58()}`);
  console.log(`creator_coin:        ${creatorCoinPda.toBase58()}`);
  console.log(`coin_mint:           ${coinMintPda.toBase58()}`);
  console.log(`benefits_list:       ${benefitsListPda.toBase58()}`);
  console.log(`redemption_counter:  ${redemptionCounterPda.toBase58()}`);
  console.log(`\nadmin has CC mint ${coinMintPda.toBase58()}`);
}

main().catch((e) => {
  console.error('\n❌ dev-seed-creator-coin FAILED');
  console.error(e);
  if (e.transactionLogs) {
    for (const l of e.transactionLogs) console.error('  ', l);
  }
  process.exit(1);
});
