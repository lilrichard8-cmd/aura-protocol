#!/usr/bin/env node
/**
 * smoke-fractionalize.mjs
 *
 * End-to-end smoke test for the aura_fractionalize program against a running
 * solana-test-validator on localhost:8899.
 *
 * Steps:
 *   1. Mint a synthetic 1-of-1 NFT to admin (decimals = 0, supply = 1)
 *   2. fractionalize_nft (100 fragments at 1000 lamports each)
 *   3. buy_fragment(10) as a fresh buyer keypair
 *   4. sell_fragment(5) as that buyer
 *   5. claim_revenue (no-op early — confirms wiring)
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
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddressSync,
  getAccount,
} from '@solana/spl-token';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRACTIONALIZE_PROGRAM_ID = new PublicKey(
  '2QPBHcFbYc9UwoS5KBoGRcZ5Db4idyN1GxnbAuBLY38h',
);
const RPC = process.env.SOLANA_RPC || 'http://127.0.0.1:8899';

// ──────────────────────────────────────────────────────────────
// Anchor discriminator helpers
// ──────────────────────────────────────────────────────────────
function ixDisc(name) {
  return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
}
function u64LE(v) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(v), 0);
  return b;
}

// ──────────────────────────────────────────────────────────────
// PDA helpers
// ──────────────────────────────────────────────────────────────
const SEEDS = {
  FNFT: Buffer.from('fractional_nft'),
  FRAG_MINT: Buffer.from('fragment_mint'),
  NFT_VAULT: Buffer.from('nft_vault'),
  REV_VAULT: Buffer.from('revenue_vault'),
  HOLDER: Buffer.from('fragment_holder'),
};
function pda(seeds) {
  return PublicKey.findProgramAddressSync(seeds, FRACTIONALIZE_PROGRAM_ID)[0];
}

// ──────────────────────────────────────────────────────────────
// Boilerplate
// ──────────────────────────────────────────────────────────────
function loadKp(p) {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(p, 'utf8'))),
  );
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
// Main
// ──────────────────────────────────────────────────────────────
async function main() {
  const connection = new Connection(RPC, 'confirmed');
  const admin = loadKp(path.join(homedir(), '.config/solana/id.json'));
  console.log(`Admin: ${admin.publicKey.toBase58()}`);
  console.log(`Program: ${FRACTIONALIZE_PROGRAM_ID.toBase58()}`);
  console.log(`RPC: ${RPC}\n`);

  await airdrop(connection, admin.publicKey, 5).catch(() => {});

  const TOTAL = 5;

  // ── [1/5] mint synthetic NFT ──────────────────────────────
  logStep(1, TOTAL, 'Mint synthetic 1-of-1 NFT to admin');
  const nftMint = await createMint(
    connection,
    admin,
    admin.publicKey,
    null,
    0, // decimals
  );
  const ownerNftAcc = await createAssociatedTokenAccount(
    connection,
    admin,
    nftMint,
    admin.publicKey,
  );
  const mintSig = await mintTo(
    connection,
    admin,
    nftMint,
    ownerNftAcc,
    admin,
    1,
  );
  logOk(`NFT mint = ${nftMint.toBase58()}`, mintSig);
  logOk(`Owner NFT ATA = ${ownerNftAcc.toBase58()}`);

  // ── [2/5] fractionalize via 3-instruction split ──────────
  logStep(
    2,
    TOTAL,
    'fractionalize via 3-step split (100 fragments @ 1000 lamports)',
  );
  const fnft = pda([SEEDS.FNFT, nftMint.toBuffer()]);
  const fragMint = pda([SEEDS.FRAG_MINT, nftMint.toBuffer()]);
  const nftVault = pda([SEEDS.NFT_VAULT, nftMint.toBuffer()]);
  const revVault = pda([SEEDS.REV_VAULT, nftMint.toBuffer()]);

  const TOTAL_FRAG = 100;
  const PRICE_LAMP = 1000;

  // Step 1/3: init_fractional_state
  const s1Data = Buffer.concat([
    ixDisc('init_fractional_state'),
    u64LE(TOTAL_FRAG),
    u64LE(PRICE_LAMP),
  ]);
  const s1 = new TransactionInstruction({
    programId: FRACTIONALIZE_PROGRAM_ID,
    keys: [
      { pubkey: fnft, isSigner: false, isWritable: true },
      { pubkey: nftMint, isSigner: false, isWritable: false },
      { pubkey: admin.publicKey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: s1Data,
  });

  // Step 2/3: init_fragment_mint
  const s2 = new TransactionInstruction({
    programId: FRACTIONALIZE_PROGRAM_ID,
    keys: [
      { pubkey: fnft, isSigner: false, isWritable: true },
      { pubkey: fragMint, isSigner: false, isWritable: true },
      { pubkey: admin.publicKey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: ixDisc('init_fragment_mint'),
  });

  // Step 3/3: init_vaults_and_lock
  const s3 = new TransactionInstruction({
    programId: FRACTIONALIZE_PROGRAM_ID,
    keys: [
      { pubkey: fnft, isSigner: false, isWritable: true },
      { pubkey: nftMint, isSigner: false, isWritable: false },
      { pubkey: nftVault, isSigner: false, isWritable: true },
      { pubkey: revVault, isSigner: false, isWritable: true },
      { pubkey: ownerNftAcc, isSigner: false, isWritable: true },
      { pubkey: admin.publicKey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: ixDisc('init_vaults_and_lock'),
  });

  // All three in one transaction.
  const tx = new Transaction().add(s1, s2, s3);
  const sig = await sendAndConfirmTransaction(connection, tx, [admin], {
    commitment: 'confirmed',
  });
  logOk(`3-step fractionalize confirmed in single tx`, sig);
  logOk(`fractional_nft PDA = ${fnft.toBase58()}`);
  logOk(`fragment_mint PDA = ${fragMint.toBase58()}`);
  logOk(`nft_vault PDA     = ${nftVault.toBase58()}`);
  logOk(`revenue_vault PDA = ${revVault.toBase58()}`);

  // Quick state read
  const fnftAcc = await connection.getAccountInfo(fnft);
  if (!fnftAcc) throw new Error('fractional_nft account missing after init');
  logOk(`fractional_nft data length = ${fnftAcc.data.length} bytes`);

  // ── [3/5] buy_fragment(10) ────────────────────────────────
  logStep(3, TOTAL, 'buy_fragment(10) as a fresh buyer');
  const buyer = Keypair.generate();
  await airdrop(connection, buyer.publicKey, 1);
  const buyerFragAta = getAssociatedTokenAddressSync(fragMint, buyer.publicKey);
  // Create buyer ATA for fragment mint
  await createAssociatedTokenAccount(connection, buyer, fragMint, buyer.publicKey);

  const holderPda = pda([SEEDS.HOLDER, fnft.toBuffer(), buyer.publicKey.toBuffer()]);
  const BUY_AMT = 10;
  const buyData = Buffer.concat([ixDisc('buy_fragment'), u64LE(BUY_AMT)]);
  const buyIx = new TransactionInstruction({
    programId: FRACTIONALIZE_PROGRAM_ID,
    keys: [
      { pubkey: fnft, isSigner: false, isWritable: true },
      { pubkey: fragMint, isSigner: false, isWritable: true },
      { pubkey: revVault, isSigner: false, isWritable: true },
      { pubkey: holderPda, isSigner: false, isWritable: true },
      { pubkey: buyerFragAta, isSigner: false, isWritable: true },
      { pubkey: buyer.publicKey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: buyData,
  });
  const buyTx = new Transaction().add(buyIx);
  const buySig = await sendAndConfirmTransaction(connection, buyTx, [buyer], {
    commitment: 'confirmed',
  });
  logOk(`buy_fragment(${BUY_AMT}) confirmed`, buySig);

  const buyerFragBal = (await getAccount(connection, buyerFragAta)).amount;
  logOk(`buyer fragment balance = ${buyerFragBal}`);

  // ── [4/5] sell_fragment(5) ────────────────────────────────
  logStep(4, TOTAL, 'sell_fragment(5) as same buyer');
  const SELL_AMT = 5;
  const sellData = Buffer.concat([ixDisc('sell_fragment'), u64LE(SELL_AMT)]);
  const sellIx = new TransactionInstruction({
    programId: FRACTIONALIZE_PROGRAM_ID,
    keys: [
      { pubkey: fnft, isSigner: false, isWritable: true },
      { pubkey: fragMint, isSigner: false, isWritable: true },
      { pubkey: revVault, isSigner: false, isWritable: true },
      { pubkey: holderPda, isSigner: false, isWritable: true },
      { pubkey: buyerFragAta, isSigner: false, isWritable: true },
      // Optional license_vote: Anchor 0.29 expects program-id sentinel for None
      { pubkey: FRACTIONALIZE_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: buyer.publicKey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: sellData,
  });
  const sellTx = new Transaction().add(sellIx);
  let sellSig;
  try {
    sellSig = await sendAndConfirmTransaction(connection, sellTx, [buyer], {
      commitment: 'confirmed',
    });
  } catch (e) {
    console.log('   first sell attempt failed; retrying with explicit None sentinel for license_vote');
    console.log('   error:', e.transactionMessage || e.message);
    throw e;
  }
  logOk(`sell_fragment(${SELL_AMT}) confirmed`, sellSig);

  const buyerFragBalAfter = (await getAccount(connection, buyerFragAta)).amount;
  logOk(`buyer fragment balance after sell = ${buyerFragBalAfter} (expect 5)`);

  // ── [5/5] claim_revenue (idempotent — verifies wiring) ───
  logStep(5, TOTAL, 'claim_revenue (early; no revenue distributed yet)');
  const claimData = ixDisc('claim_revenue');
  const claimIx = new TransactionInstruction({
    programId: FRACTIONALIZE_PROGRAM_ID,
    keys: [
      { pubkey: fnft, isSigner: false, isWritable: true },
      { pubkey: holderPda, isSigner: false, isWritable: true },
      { pubkey: revVault, isSigner: false, isWritable: true },
      { pubkey: buyer.publicKey, isSigner: true, isWritable: true },
    ],
    data: claimData,
  });
  const claimTx = new Transaction().add(claimIx);
  try {
    const claimSig = await sendAndConfirmTransaction(connection, claimTx, [buyer], {
      commitment: 'confirmed',
    });
    logOk(`claim_revenue confirmed`, claimSig);
  } catch (e) {
    // Expected to fail with NoRevenueAvailable / NoRevenueDistributed — still
    // a successful wiring test (program reachable, accounts decode OK).
    const msg =
      e.transactionMessage ||
      e.message ||
      JSON.stringify(e.transactionLogs || []) ||
      String(e);
    if (
      /NoRevenueDistributed|NoRevenueAvailable|0x1778|0x1779/i.test(msg) ||
      (e.transactionLogs || []).some((l) => /NoRevenueAvailable|NoRevenueDistributed/.test(l))
    ) {
      logOk(`claim_revenue correctly rejected (no revenue) — wiring OK`);
    } else {
      throw e;
    }
  }

  console.log('\n========================================');
  console.log('✅ ALL CHECKS PASSED');
  console.log('========================================');
  console.log(`fractional_nft:  ${fnft.toBase58()}`);
  console.log(`fragment_mint:   ${fragMint.toBase58()}`);
  console.log(`nft_vault:       ${nftVault.toBase58()}`);
  console.log(`revenue_vault:   ${revVault.toBase58()}`);
  console.log(`buyer:           ${buyer.publicKey.toBase58()}`);
}

main().catch((e) => {
  console.error('\n❌ smoke-fractionalize FAILED');
  console.error(e);
  process.exit(1);
});
