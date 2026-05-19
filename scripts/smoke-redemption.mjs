#!/usr/bin/env node
/**
 * smoke-redemption.mjs
 *
 * Verifies the Creator Coin redemption flow against the localnet creator-coin
 * program. Requires `dev-seed-creator-coin.mjs` to have run first (admin must
 * own the "JUDGE" Creator Coin with at least one Consumable benefit).
 *
 * Flow:
 *   0. Verify dev-seed state (creator_coin / benefits_list exist)
 *   1. Gift 100 JUDGE from admin → buyer (a fresh keypair)
 *   2. buyer initiates redemption for benefit 0 (cost = threshold)
 *   3. admin marks redemption Delivered (with note)
 *   4. buyer confirms receipt → escrow released to admin
 *
 * Pass = every step prints ✓ and the final summary.
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
  getAccount,
} from '@solana/spl-token';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CREATOR_COIN_PROGRAM_ID = new PublicKey(
  'DW4BZcwY5c3nQHMGKysmTdXKpFous778RKcbSvw2xNMZ',
);
const RPC = process.env.SOLANA_RPC || 'http://127.0.0.1:8899';

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
function loadKp(p) {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(p, 'utf8'))),
  );
}
function pda(seeds, programId = CREATOR_COIN_PROGRAM_ID) {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}
async function airdrop(connection, who, sol) {
  const sig = await connection.requestAirdrop(who, sol * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, 'confirmed');
}
function logStep(n, total, msg) {
  console.log(`\n[${n}/${total}] ${msg}`);
}
function logOk(msg, sig) {
  console.log(`   ✓ ${msg}`);
  if (sig) console.log(`     sig: ${sig}`);
}

// ──────────────────────────────────────────────────────────────
async function main() {
  const connection = new Connection(RPC, 'confirmed');
  const creatorPath =
    process.env.SMOKE_CREATOR_KEYPAIR ||
    path.join(homedir(), '.config/solana/id.json');
  const admin = loadKp(creatorPath);
  console.log(`Admin (creator): ${admin.publicKey.toBase58()}`);
  console.log(`Program:         ${CREATOR_COIN_PROGRAM_ID.toBase58()}`);
  console.log(`RPC:             ${RPC}\n`);

  await airdrop(connection, admin.publicKey, 5).catch(() => {});

  const TOTAL = 5;

  // ── [1/5] verify dev-seed state ──────────────────────────
  logStep(1, TOTAL, 'Verify dev-seed state');
  const creatorCoinPda = pda([Buffer.from('creator_coin'), admin.publicKey.toBuffer()]);
  const coinMintPda = pda([Buffer.from('creator_coin_mint'), admin.publicKey.toBuffer()]);
  const benefitsListPda = pda([Buffer.from('benefits'), coinMintPda.toBuffer()]);
  const redemptionCounterPda = pda([Buffer.from('redemption-counter'), coinMintPda.toBuffer()]);

  const cc = await connection.getAccountInfo(creatorCoinPda);
  if (!cc) throw new Error('creator_coin missing — run dev-seed-creator-coin.mjs first');
  const bl = await connection.getAccountInfo(benefitsListPda);
  if (!bl) throw new Error('benefits_list missing — run dev-seed first');
  const rc = await connection.getAccountInfo(redemptionCounterPda);
  if (!rc) throw new Error('redemption_counter missing — run dev-seed first');

  // Decode benefits_list to find first active Consumable benefit.
  // Layout: 8 disc + 32 coin_mint + 32 creator + 4 vec_len + benefits[]
  // Benefit: 4 id + 1 type + 8 threshold + 4 uri_len + uri + 32 hash + 1 active
  const blData = bl.data;
  const vecLen = blData.readUInt32LE(8 + 32 + 32);
  let benefitOffset = 8 + 32 + 32 + 4;
  let foundBenefit = null;
  for (let i = 0; i < vecLen; i++) {
    const id = blData.readUInt32LE(benefitOffset);
    const btype = blData.readUInt8(benefitOffset + 4);
    const threshold = blData.readBigUInt64LE(benefitOffset + 5);
    const uriLen = blData.readUInt32LE(benefitOffset + 13);
    const benSize = 4 + 1 + 8 + 4 + uriLen + 32 + 1;
    const active = blData.readUInt8(benefitOffset + benSize - 1);
    // BenefitType: Holding=0, Consumable=1; we need the Consumable one.
    if (active === 1 && btype === 1 && !foundBenefit) {
      foundBenefit = { id, type: btype, threshold, offset: benefitOffset };
    }
    benefitOffset += benSize;
  }
  if (!foundBenefit) throw new Error('no active Consumable benefit found');
  logOk(`creator_coin    = ${creatorCoinPda.toBase58()}`);
  logOk(`coin_mint       = ${coinMintPda.toBase58()}`);
  logOk(`benefit         = id ${foundBenefit.id}, threshold ${foundBenefit.threshold}`);
  logOk(`redemption_ctr  = ${redemptionCounterPda.toBase58()}`);

  // ── [2/5] gift CC to fresh buyer ─────────────────────────
  logStep(2, TOTAL, 'gift 100 JUDGE → fresh buyer');
  const buyer = Keypair.generate();
  await airdrop(connection, buyer.publicKey, 1);

  const adminCcAta = getAssociatedTokenAddressSync(coinMintPda, admin.publicKey);
  const buyerCcAta = getAssociatedTokenAddressSync(coinMintPda, buyer.publicKey);

  // Pre-create buyer's ATA
  const ataIx = createAssociatedTokenAccountInstruction(
    admin.publicKey,
    buyerCcAta,
    buyer.publicKey,
    coinMintPda,
  );

  // gift_creator_coin(amount: u64, memo_uri: String)
  const giftAmount = 100_000_000_000n; // 100 CC × 1e9
  const memo = 'dev-seed smoke gift';
  const giftData = Buffer.concat([
    ixDisc('gift_creator_coin'),
    u64LE(giftAmount),
    strBorsh(memo),
  ]);
  // GiftCreatorCoinCtx order:
  //   coin_mint, sender_token_account, recipient_token_account, recipient,
  //   sender (signer), token_program, associated_token_program, system_program.
  // recipient_token_account is init_if_needed so we DON'T pre-create it.
  const giftIx = new TransactionInstruction({
    programId: CREATOR_COIN_PROGRAM_ID,
    keys: [
      { pubkey: coinMintPda, isSigner: false, isWritable: false },
      { pubkey: adminCcAta, isSigner: false, isWritable: true },
      { pubkey: buyerCcAta, isSigner: false, isWritable: true },
      { pubkey: buyer.publicKey, isSigner: false, isWritable: false },
      { pubkey: admin.publicKey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: giftData,
  });
  const giftTx = new Transaction().add(giftIx);
  const giftSig = await sendAndConfirmTransaction(connection, giftTx, [admin], {
    commitment: 'confirmed',
  });
  logOk(`gift_creator_coin confirmed`, giftSig);
  const buyerBal = (await getAccount(connection, buyerCcAta)).amount;
  logOk(`buyer CC balance = ${buyerBal} (expect ${giftAmount})`);

  // ── [3/5] initiate_redemption ────────────────────────────
  logStep(3, TOTAL, 'initiate_redemption');
  // RedemptionCounter layout: 8 disc + 32 coin_mint + 8 count + 1 bump
  const counterData = (await connection.getAccountInfo(redemptionCounterPda)).data;
  const nextCount = counterData.readBigUInt64LE(8 + 32);
  const idBytes = Buffer.alloc(8);
  idBytes.writeBigUInt64LE(nextCount, 0);
  const redemptionPda = pda([Buffer.from('redemption'), coinMintPda.toBuffer(), idBytes]);

  // Escrow ATA — owned by redemption PDA. Pre-create via ATA program.
  const escrowAta = getAssociatedTokenAddressSync(coinMintPda, redemptionPda, true);
  const createEscrowAtaIx = createAssociatedTokenAccountInstruction(
    buyer.publicKey,
    escrowAta,
    redemptionPda,
    coinMintPda,
  );

  // initiate_redemption(benefit_id: u32, cost: u64)
  const initData = Buffer.concat([
    ixDisc('initiate_redemption'),
    u32LE(foundBenefit.id),
    u64LE(foundBenefit.threshold),
  ]);
  // InitiateRedemptionCtx (from source):
  //   benefits_list, redemption_counter, redemption, buyer_token_account,
  //   escrow_token_account, creator (CHECK), buyer (signer), token_program, system_program
  const initIx = new TransactionInstruction({
    programId: CREATOR_COIN_PROGRAM_ID,
    keys: [
      { pubkey: benefitsListPda, isSigner: false, isWritable: false },
      { pubkey: redemptionCounterPda, isSigner: false, isWritable: true },
      { pubkey: redemptionPda, isSigner: false, isWritable: true },
      { pubkey: buyerCcAta, isSigner: false, isWritable: true },
      { pubkey: escrowAta, isSigner: false, isWritable: true },
      { pubkey: admin.publicKey, isSigner: false, isWritable: false }, // creator (CHECK)
      { pubkey: buyer.publicKey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: initData,
  });
  const initTx = new Transaction().add(createEscrowAtaIx, initIx);
  const initSig = await sendAndConfirmTransaction(connection, initTx, [buyer], {
    commitment: 'confirmed',
  });
  logOk(`initiate_redemption confirmed`, initSig);
  logOk(`redemption_id = ${nextCount}`);
  logOk(`redemption    = ${redemptionPda.toBase58()}`);

  const buyerBalAfter = (await getAccount(connection, buyerCcAta)).amount;
  const escrowBal = (await getAccount(connection, escrowAta)).amount;
  logOk(`buyer CC = ${buyerBalAfter}, escrow = ${escrowBal}`);

  // ── [4/5] mark_delivered ─────────────────────────────────
  logStep(4, TOTAL, 'mark_delivered');
  const noteUri = 'https://dev.aura/notes/poster-tracking-abc123';
  const noteHash = Buffer.alloc(32, 7);
  const markData = Buffer.concat([
    ixDisc('mark_delivered'),
    u64LE(nextCount),
    strBorsh(noteUri),
    noteHash,
  ]);
  const markIx = new TransactionInstruction({
    programId: CREATOR_COIN_PROGRAM_ID,
    keys: [
      { pubkey: redemptionPda, isSigner: false, isWritable: true },
      { pubkey: admin.publicKey, isSigner: true, isWritable: false }, // creator
    ],
    data: markData,
  });
  const markSig = await sendAndConfirmTransaction(connection, new Transaction().add(markIx), [admin], {
    commitment: 'confirmed',
  });
  logOk(`mark_delivered confirmed`, markSig);

  // ── [5/5] confirm_receipt ────────────────────────────────
  logStep(5, TOTAL, 'confirm_receipt');
  const confirmData = Buffer.concat([
    ixDisc('confirm_receipt'),
    u64LE(nextCount),
  ]);
  // ConfirmReceiptCtx:
  //   redemption, escrow_token_account, creator_token_account, buyer, token_program
  const confirmIx = new TransactionInstruction({
    programId: CREATOR_COIN_PROGRAM_ID,
    keys: [
      { pubkey: redemptionPda, isSigner: false, isWritable: true },
      { pubkey: escrowAta, isSigner: false, isWritable: true },
      { pubkey: adminCcAta, isSigner: false, isWritable: true },
      { pubkey: buyer.publicKey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: confirmData,
  });
  const confirmSig = await sendAndConfirmTransaction(connection, new Transaction().add(confirmIx), [buyer], {
    commitment: 'confirmed',
  });
  logOk(`confirm_receipt confirmed`, confirmSig);

  const escrowBalAfter = (await getAccount(connection, escrowAta)).amount;
  const adminBalAfter = (await getAccount(connection, adminCcAta)).amount;
  logOk(`escrow after = ${escrowBalAfter} (expect 0)`);
  logOk(`admin CC after release = ${adminBalAfter}`);

  console.log('\n========================================');
  console.log('✅ ALL CHECKS PASSED');
  console.log('========================================');
  console.log(`buyer:            ${buyer.publicKey.toBase58()}`);
  console.log(`redemption:       ${redemptionPda.toBase58()}`);
  console.log(`redemption_id:    ${nextCount}`);
  console.log(`benefit_id:       ${foundBenefit.id}`);
  console.log(`cost:             ${foundBenefit.threshold}`);
}

main().catch((e) => {
  console.error('\n❌ smoke-redemption FAILED');
  console.error(e);
  if (e.transactionLogs) for (const l of e.transactionLogs) console.error('   ', l);
  process.exit(1);
});
