#!/usr/bin/env node
/**
 * init-staking-pool.mjs — one-time admin helper to initialize the AURA
 * staking pool PDA on localnet.
 *
 * Usage:
 *   node scripts/init-staking-pool.mjs
 *
 * Behavior:
 *   1. Loads the admin keypair from ~/.config/solana/id.json (same one the
 *      dev-mint plugin uses; must equal `PROGRAM_ADMIN` baked into
 *      programs/staking/src/lib.rs).
 *   2. Derives the staking pool PDA = findProgramAddressSync(["staking_pool"], stakingProgramId).
 *   3. Checks if it's already initialized via getAccountInfo — exits 0 if so.
 *   4. Otherwise builds an `initialize_staking_pool` ix and submits it.
 *
 * ⚠️ Why a script, not the frontend?
 *   - On-chain init is admin-gated (PROGRAM_ADMIN check). Calling it from
 *     the user-facing app would either fail (wrong signer) or require the
 *     admin keypair to live in the browser (terrible).
 *   - Even if anyone could call it, racing the init from the frontend
 *     means multiple users could submit conflicting `creatorFollowerCount`
 *     values (relevant for curation pool, but the staking pool also has
 *     a one-shot vault token-account creation that mustn't race).
 *
 * Status note (2026-05-19): the aura_staking program is NOT currently
 * deployed to the running test validator (the .so exists in
 * target/deploy/aura_staking.so but `solana program show` returns
 * AccountNotFound). Until Iris main runs `anchor deploy` for it, this
 * script will fail with `Program does not exist`.
 */

import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { createHash } from 'crypto';

// ── Config ───────────────────────────────────────────────────────────────
const RPC_URL = process.env.RPC_URL ?? 'http://127.0.0.1:8899';
// [2026-05-19] real deployed staking program id (matches SDK
// PROGRAM_IDS.LOCALNET.staking and programs/staking/src/lib.rs declare_id!).
const STAKING_PROGRAM_ID = new PublicKey(
  process.env.STAKING_PROGRAM_ID ?? 'BU5dKjtXCPqCffJe7GaPR8Eu1pVfgWFLAUFeHcT8ENZA',
);
const ORA_MINT = new PublicKey(
  process.env.ORA_MINT ?? 'AE2saLnjj8u9RGQyftYw4wLX5wR2HbJ3byb1t97CdF8s',
);
const ADMIN_KEYPAIR_PATH =
  process.env.ADMIN_KEYPAIR_PATH ?? join(homedir(), '.config', 'solana', 'id.json');

// ── Helpers ──────────────────────────────────────────────────────────────
function ixDiscriminator(name) {
  return Buffer.from(createHash('sha256').update(`global:${name}`).digest()).slice(0, 8);
}

function loadKeypair(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('[init-staking-pool] RPC:', RPC_URL);
  console.log('[init-staking-pool] Staking program:', STAKING_PROGRAM_ID.toBase58());
  console.log('[init-staking-pool] ORA mint:', ORA_MINT.toBase58());

  const connection = new Connection(RPC_URL, 'confirmed');
  const admin = loadKeypair(ADMIN_KEYPAIR_PATH);
  console.log('[init-staking-pool] Admin:', admin.publicKey.toBase58());

  // 1. Check program existence.
  const progInfo = await connection.getAccountInfo(STAKING_PROGRAM_ID);
  if (!progInfo) {
    console.error(
      `[init-staking-pool] ERROR: staking program ${STAKING_PROGRAM_ID.toBase58()} is not deployed on this validator. Run "anchor deploy" first.`,
    );
    process.exit(2);
  }
  console.log('[init-staking-pool] Program is deployed ✓');

  // 2. Derive pool PDA.
  const [poolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('staking_pool')],
    STAKING_PROGRAM_ID,
  );
  console.log('[init-staking-pool] Pool PDA:', poolPda.toBase58());

  // 3. Already initialized?
  const poolInfo = await connection.getAccountInfo(poolPda);
  if (poolInfo) {
    console.log(
      `[init-staking-pool] Pool already initialized (${poolInfo.data.length} bytes). Nothing to do.`,
    );
    process.exit(0);
  }

  // 4. Build & send init tx.
  console.log('[init-staking-pool] Pool not found — initializing…');
  const ix = new TransactionInstruction({
    programId: STAKING_PROGRAM_ID,
    keys: [
      { pubkey: poolPda, isSigner: false, isWritable: true },
      { pubkey: ORA_MINT, isSigner: false, isWritable: false },
      { pubkey: admin.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: ixDiscriminator('initialize_staking_pool'),
  });
  const tx = new Transaction().add(ix);
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = admin.publicKey;
  tx.sign(admin);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, 'confirmed');
  console.log('[init-staking-pool] ✓ Initialized. tx:', sig);
}

main().catch((e) => {
  console.error('[init-staking-pool] failed:', e);
  process.exit(1);
});
