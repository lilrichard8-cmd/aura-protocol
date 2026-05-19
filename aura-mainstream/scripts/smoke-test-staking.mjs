#!/usr/bin/env node
/**
 * smoke-test-staking.mjs — end-to-end stake flow on localnet.
 *
 * Steps:
 *   1. Generate a fresh user keypair.
 *   2. Airdrop 2 SOL from validator faucet.
 *   3. Admin mints 5000 ORA to the user (via `spl-token mint` CLI under
 *      ~/.config/solana/id.json — the dev mint authority).
 *   4. SDK auto-initializes the user's StakeCounter and stakes 1000 ORA at
 *      LockupTier::OneMonth.
 *   5. Verifies the on-chain StakeAccount exists with amount = 1000 ORA.
 *
 * No frontend, no wallet adapter — uses a thin wallet shim that signs with
 * the generated keypair directly.
 *
 * Usage:
 *   node scripts/smoke-test-staking.mjs
 *
 * Exit 0 = passed, non-zero = failed.
 */

import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { spawn } from 'node:child_process';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
// Import directly from compiled module files to sidestep the package barrel
// which re-exports many modules and trips ESM strict resolution on Node 25.
import { StakingModule, LockupTier } from '@aura-protocol/sdk/dist/modules/staking.js';
import { PROGRAM_IDS } from '@aura-protocol/sdk/dist/constants.js';

const RPC_URL = process.env.RPC_URL ?? 'http://127.0.0.1:8899';
const ORA_MINT = new PublicKey(
  process.env.ORA_MINT ?? 'AE2saLnjj8u9RGQyftYw4wLX5wR2HbJ3byb1t97CdF8s',
);
const STAKING_PROGRAM_ID = PROGRAM_IDS.LOCALNET.staking;
const ADMIN_KEYPAIR_PATH = join(homedir(), '.config', 'solana', 'id.json');

function loadKeypair(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function runCmd(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${cmd} ${args.join(' ')} failed (code ${code}): ${stderr || stdout}`));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

// Minimal WalletAdapter for SDK: only needs publicKey + sendTransaction.
function makeWallet(connection, keypair) {
  return {
    publicKey: keypair.publicKey,
    async sendTransaction(tx, conn) {
      tx.feePayer ??= keypair.publicKey;
      if (!tx.recentBlockhash) {
        const { blockhash } = await conn.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
      }
      tx.sign(keypair);
      const sig = await conn.sendRawTransaction(tx.serialize());
      await conn.confirmTransaction(sig, 'confirmed');
      return sig;
    },
  };
}

async function main() {
  console.log('[smoke-test] RPC:', RPC_URL);
  console.log('[smoke-test] ORA mint:', ORA_MINT.toBase58());
  console.log('[smoke-test] Staking program:', STAKING_PROGRAM_ID.toBase58());

  const connection = new Connection(RPC_URL, 'confirmed');
  const admin = loadKeypair(ADMIN_KEYPAIR_PATH);
  const user = Keypair.generate();
  console.log('[smoke-test] Admin:', admin.publicKey.toBase58());
  console.log('[smoke-test] User :', user.publicKey.toBase58());

  // 1. Airdrop SOL to user.
  console.log('\n[smoke-test] Airdropping 2 SOL to user…');
  const airdropSig = await connection.requestAirdrop(user.publicKey, 2 * 1e9);
  await connection.confirmTransaction(airdropSig, 'confirmed');
  const solBal = await connection.getBalance(user.publicKey);
  console.log('[smoke-test] User SOL balance:', solBal / 1e9);

  // 2. Create the user's ORA ATA, then mint 5000 ORA to it.
  console.log('\n[smoke-test] Creating user ORA ATA + minting 5000 ORA…');
  await runCmd('spl-token', [
    'create-account',
    ORA_MINT.toBase58(),
    '--owner', user.publicKey.toBase58(),
    '--fee-payer', ADMIN_KEYPAIR_PATH,
    '--url', RPC_URL,
  ]);
  await runCmd('spl-token', [
    'mint',
    ORA_MINT.toBase58(),
    '5000',
    '--mint-authority', ADMIN_KEYPAIR_PATH,
    '--fee-payer', ADMIN_KEYPAIR_PATH,
    '--recipient-owner', user.publicKey.toBase58(),
    '--url', RPC_URL,
  ]);
  const userAta = await getAssociatedTokenAddress(ORA_MINT, user.publicKey);
  const balRes = await connection.getTokenAccountBalance(userAta);
  console.log('[smoke-test] User ORA balance:', balRes.value.uiAmount);

  // 3. Sanity: pool exists, vault ATA exists.
  const wallet = makeWallet(connection, user);
  const stakingMod = new StakingModule(connection, wallet, STAKING_PROGRAM_ID);
  const poolAcc = await stakingMod.fetchPool();
  if (!poolAcc) {
    console.error('[smoke-test] FAIL: staking pool not initialized. Run `node scripts/init-staking-pool.mjs` first.');
    process.exit(2);
  }
  console.log('[smoke-test] Pool PDA :', poolAcc.address.toBase58(), '(total_staked:', poolAcc.totalStaked.toString(), ')');

  const vaultAta = await getAssociatedTokenAddress(ORA_MINT, stakingMod.pdas.pool, true);
  const vaultInfo = await connection.getAccountInfo(vaultAta);
  if (!vaultInfo) {
    console.error(
      `[smoke-test] FAIL: pool vault ATA ${vaultAta.toBase58()} does not exist. Create with:\n` +
      `  spl-token create-account ${ORA_MINT.toBase58()} --owner ${stakingMod.pdas.pool.toBase58()} --fee-payer ${ADMIN_KEYPAIR_PATH} --url ${RPC_URL}`,
    );
    process.exit(3);
  }
  console.log('[smoke-test] Vault ATA:', vaultAta.toBase58());

  // 4. Stake 1000 ORA (minimum) at OneMonth tier. SDK auto-initializes the
  //    StakeCounter in the same tx since it doesn't yet exist.
  console.log('\n[smoke-test] Staking 1000 ORA @ OneMonth (auto-init counter)…');
  const stakeAmountRaw = 1000n * 1_000_000_000n;
  const res = await stakingMod.stakeOra({
    amount: stakeAmountRaw,
    lockupTier: LockupTier.OneMonth,
    vaultTokenAccount: vaultAta,
    userTokenAccount: userAta,
  });
  if (!res.success) {
    console.error('[smoke-test] FAIL: stake tx errored:', res.error);
    process.exit(4);
  }
  console.log('[smoke-test] Stake sig:', res.signature);
  console.log('[smoke-test] Explorer  : https://explorer.solana.com/tx/' + res.signature + '?cluster=custom&customUrl=' + encodeURIComponent(RPC_URL));
  console.log('[smoke-test] Stake PDA :', res.stake.toBase58(), '(nonce', res.nonce.toString(), ')');

  // 5. Read the stake account and verify amount.
  const stakeAcc = await stakingMod.fetchStake(res.stake);
  if (!stakeAcc) {
    console.error('[smoke-test] FAIL: stake account not found after staking');
    process.exit(5);
  }
  if (stakeAcc.amount !== stakeAmountRaw) {
    console.error(`[smoke-test] FAIL: stake amount mismatch: got ${stakeAcc.amount} expected ${stakeAmountRaw}`);
    process.exit(6);
  }
  console.log('[smoke-test] Stake amount:', (Number(stakeAcc.amount) / 1e9), 'ORA ✓');
  console.log('[smoke-test] Lockup tier :', stakeAcc.lockupTier);
  console.log('[smoke-test] Multiplier  :', stakeAcc.multiplierBps, 'bps');
  console.log('[smoke-test] Staked at   :', new Date(stakeAcc.stakedAt * 1000).toISOString());
  console.log('[smoke-test] Unlock at   :', new Date(stakeAcc.unlockAt * 1000).toISOString());

  // 6. Read the counter to verify it advanced.
  const counter = await stakingMod.fetchCounter(user.publicKey);
  if (!counter) {
    console.error('[smoke-test] FAIL: stake counter not found');
    process.exit(7);
  }
  if (counter.nextNonce !== 1n) {
    console.error(`[smoke-test] FAIL: counter.nextNonce expected 1, got ${counter.nextNonce}`);
    process.exit(8);
  }
  console.log('[smoke-test] Counter next_nonce: 1 (advanced from 0) ✓');

  // 7. Verify the principal vault received the tokens.
  const vaultBal = await connection.getTokenAccountBalance(vaultAta);
  console.log('[smoke-test] Vault now holds:', vaultBal.value.uiAmount, 'ORA');

  console.log('\n[smoke-test] ✅ ALL CHECKS PASSED');
}

main().catch((e) => {
  console.error('[smoke-test] failed:', e);
  process.exit(1);
});
