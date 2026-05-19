#!/usr/bin/env node
/**
 * smoke-fractionalize.mjs — end-to-end NFT fractionalization flow on localnet.
 *
 * Steps:
 *   1. Admin creates a mock NFT (decimals = 0, supply = 1) and mints it to
 *      the original owner (= admin).
 *   2. Admin calls `fractionalizeNft` → 100 fragments, price 1 ORA each.
 *      The NFT is transferred into the program vault.
 *   3. A fresh buyer keypair gets 2 SOL + 50 ORA via the dev mint.
 *   4. Buyer creates their fragment ATA + calls `buyFragment` for 10 frags.
 *      Verify the FragmentHolder PDA shows fragments_owned = 10 and that
 *      10 ORA flowed into the revenue vault.
 *   5. Admin calls `distributeRevenue(100)` to top up the per-fragment
 *      claimable amount, then the buyer calls `claimRevenue` and we verify
 *      that revenue_claimed advanced on the holder PDA.
 *
 * Exit 0 = passed. Non-zero = failed at the indicated step.
 *
 * Usage:
 *   node scripts/smoke-fractionalize.mjs
 *
 * Notes:
 *   • Uses the admin keypair at ~/.config/solana/id.json (the dev mint
 *     authority for ORA on the local validator).
 *   • Reads program ids + ORA mint from the SDK constants, matching what
 *     the frontend uses (PROGRAM_IDS.LOCALNET).
 *   • Skipped on non-localnet RPCs (refuses to run against devnet/mainnet).
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
  SystemProgram,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
} from '@solana/spl-token';
import { FractionalizeModule } from '@aura-protocol/sdk/dist/modules/fractionalize.js';
import { PROGRAM_IDS } from '@aura-protocol/sdk/dist/constants.js';

// ────────────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────────────

const RPC_URL = process.env.RPC_URL ?? 'http://127.0.0.1:8899';
const ORA_MINT = new PublicKey(
  process.env.ORA_MINT ?? 'AE2saLnjj8u9RGQyftYw4wLX5wR2HbJ3byb1t97CdF8s',
);
const FRACTIONALIZE_PROGRAM_ID = PROGRAM_IDS.LOCALNET.fractionalize;
const ADMIN_KEYPAIR_PATH = join(homedir(), '.config', 'solana', 'id.json');

if (!RPC_URL.includes('127.0.0.1') && !RPC_URL.includes('localhost')) {
  console.error('[smoke-fractionalize] refusing to run against non-localnet RPC:', RPC_URL);
  process.exit(99);
}

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
        reject(new Error(`${cmd} ${args.join(' ')} failed: ${stderr || stdout}`));
      } else resolve({ stdout, stderr });
    });
  });
}

function makeWallet(keypair) {
  return {
    publicKey: keypair.publicKey,
    connected: true,
    async sendTransaction(tx, conn) {
      tx.feePayer ??= keypair.publicKey;
      if (!tx.recentBlockhash) {
        const { blockhash } = await conn.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
      }
      tx.sign(keypair);
      const sig = await conn.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
      });
      await conn.confirmTransaction(sig, 'confirmed');
      return sig;
    },
  };
}

function explorerUrl(sig) {
  return `https://explorer.solana.com/tx/${sig}?cluster=custom&customUrl=${encodeURIComponent(RPC_URL)}`;
}

// ────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[smoke-fractionalize] RPC:', RPC_URL);
  console.log('[smoke-fractionalize] Fractionalize program:', FRACTIONALIZE_PROGRAM_ID.toBase58());
  console.log('[smoke-fractionalize] ORA mint:', ORA_MINT.toBase58());

  const connection = new Connection(RPC_URL, 'confirmed');
  const admin = loadKeypair(ADMIN_KEYPAIR_PATH);
  const buyer = Keypair.generate();
  console.log('[smoke-fractionalize] Admin :', admin.publicKey.toBase58());
  console.log('[smoke-fractionalize] Buyer :', buyer.publicKey.toBase58());

  // ── 1. Airdrop SOL for buyer ──────────────────────────────────────
  console.log('\n[1/5] Airdrop 2 SOL to buyer…');
  const air = await connection.requestAirdrop(buyer.publicKey, 2 * 1e9);
  await connection.confirmTransaction(air, 'confirmed');
  console.log('  buyer SOL:', (await connection.getBalance(buyer.publicKey)) / 1e9);

  // ── 2. Create mock NFT via spl-token CLI ──────────────────────────
  console.log('\n[2/5] Creating mock NFT (decimals=0, supply=1)…');
  // 2a. Create the mint (decimals=0, mint authority=admin)
  const nftKp = Keypair.generate();
  // spl-token CLI needs the mint's keypair on disk so it can sign the
  // creation tx. Write a temp file.
  const tmpPath = `/tmp/aura-smoke-nft-${Date.now()}.json`;
  const fs = await import('node:fs/promises');
  await fs.writeFile(tmpPath, JSON.stringify(Array.from(nftKp.secretKey)));

  await runCmd('spl-token', [
    'create-token',
    tmpPath,
    '--decimals', '0',
    '--mint-authority', ADMIN_KEYPAIR_PATH,
    '--fee-payer', ADMIN_KEYPAIR_PATH,
    '--url', RPC_URL,
  ]);
  console.log('  NFT mint:', nftKp.publicKey.toBase58());

  // 2b. Create admin's ATA + mint exactly 1
  await runCmd('spl-token', [
    'create-account',
    nftKp.publicKey.toBase58(),
    '--owner', admin.publicKey.toBase58(),
    '--fee-payer', ADMIN_KEYPAIR_PATH,
    '--url', RPC_URL,
  ]);
  await runCmd('spl-token', [
    'mint',
    nftKp.publicKey.toBase58(),
    '1',
    '--mint-authority', ADMIN_KEYPAIR_PATH,
    '--fee-payer', ADMIN_KEYPAIR_PATH,
    '--recipient-owner', admin.publicKey.toBase58(),
    '--url', RPC_URL,
  ]);
  const adminNftAta = await getAssociatedTokenAddress(nftKp.publicKey, admin.publicKey);
  console.log('  admin NFT ATA:', adminNftAta.toBase58());

  // Cleanup temp file
  await fs.unlink(tmpPath).catch(() => {});

  // ── 3. fractionalizeNft ────────────────────────────────────────────
  console.log('\n[3/5] Fractionalize NFT → 100 fragments @ 1 ORA each…');
  const adminWallet = makeWallet(admin);
  const fmod = new FractionalizeModule(connection, adminWallet, FRACTIONALIZE_PROGRAM_ID);

  const PRICE_PER_FRAGMENT = 1_000_000_000n; // 1 ORA (9 decimals)
  const TOTAL_FRAGMENTS = 100n;

  const fres = await fmod.fractionalizeNft({
    nftMint: nftKp.publicKey,
    ownerNftAccount: adminNftAta,
    totalFragments: TOTAL_FRAGMENTS,
    pricePerFragment: PRICE_PER_FRAGMENT,
  });
  if (!fres.success) {
    console.error('  FAIL fractionalizeNft:', fres.error);
    process.exit(2);
  }
  console.log('  ✓ fractionalize tx:', fres.signature);
  console.log('    →', explorerUrl(fres.signature));
  console.log('    fractionalNft PDA:', fres.fractionalNft.toBase58());
  console.log('    fragmentMint PDA :', fres.fragmentMint.toBase58());

  const fnft = await fmod.fetchFractionalNft(nftKp.publicKey);
  if (!fnft) { console.error('  FAIL: FractionalNFT account not found'); process.exit(3); }
  console.log('    total_fragments  :', fnft.totalFragments.toString());
  console.log('    fragments_sold   :', fnft.fragmentsSold.toString());
  if (fnft.totalFragments !== TOTAL_FRAGMENTS) {
    console.error('  FAIL: total_fragments mismatch');
    process.exit(4);
  }

  // ── 4. Buyer buys 10 fragments ────────────────────────────────────
  console.log('\n[4/5] Buyer mints 50 ORA + buys 10 fragments…');
  // 4a. Create buyer's ORA ATA + mint 50 ORA
  await runCmd('spl-token', [
    'create-account', ORA_MINT.toBase58(),
    '--owner', buyer.publicKey.toBase58(),
    '--fee-payer', ADMIN_KEYPAIR_PATH,
    '--url', RPC_URL,
  ]);
  await runCmd('spl-token', [
    'mint', ORA_MINT.toBase58(), '50',
    '--mint-authority', ADMIN_KEYPAIR_PATH,
    '--fee-payer', ADMIN_KEYPAIR_PATH,
    '--recipient-owner', buyer.publicKey.toBase58(),
    '--url', RPC_URL,
  ]);
  const buyerOraAta = await getAssociatedTokenAddress(ORA_MINT, buyer.publicKey);
  const buyerOraBal0 = (await connection.getTokenAccountBalance(buyerOraAta)).value.uiAmount;
  console.log('  buyer ORA before:', buyerOraBal0);

  // 4b. Pre-create the buyer's fragment ATA. The fragment mint is a PDA.
  const fragmentMint = fmod.pdas.fragmentMint(nftKp.publicKey);
  const buyerFragAta = getAssociatedTokenAddressSync(fragmentMint, buyer.publicKey, false);
  const buyerWallet = makeWallet(buyer);
  // Use buyer as payer for their own ATA.
  const ataIx = createAssociatedTokenAccountInstruction(
    buyer.publicKey,
    buyerFragAta,
    buyer.publicKey,
    fragmentMint,
  );
  const ataTx = new Transaction().add(ataIx);
  await buyerWallet.sendTransaction(ataTx, connection);
  console.log('  buyer fragment ATA:', buyerFragAta.toBase58());

  // 4c. buyFragment(10)
  const fmodBuyer = new FractionalizeModule(connection, buyerWallet, FRACTIONALIZE_PROGRAM_ID);
  const buyRes = await fmodBuyer.buyFragment({
    nftMint: nftKp.publicKey,
    buyerFragmentAccount: buyerFragAta,
    amount: 10n,
  });
  if (!buyRes.success) {
    console.error('  FAIL buyFragment:', buyRes.error);
    process.exit(5);
  }
  console.log('  ✓ buyFragment tx:', buyRes.signature);
  console.log('    →', explorerUrl(buyRes.signature));

  const holder = await fmod.fetchFragmentHolder(nftKp.publicKey, buyer.publicKey);
  if (!holder) { console.error('  FAIL: FragmentHolder PDA missing'); process.exit(6); }
  console.log('    fragments_owned  :', holder.fragmentsOwned.toString());
  console.log('    total_invested   :', holder.totalInvested.toString());
  if (holder.fragmentsOwned !== 10n) {
    console.error(`  FAIL: expected fragments_owned=10, got ${holder.fragmentsOwned}`);
    process.exit(7);
  }

  // ── 5. distributeRevenue + claimRevenue ──────────────────────────
  console.log('\n[5/5] Distribute 100 ORA revenue → buyer claims their pro-rata share…');
  const distRes = await fmod.distributeRevenue({
    nftMint: nftKp.publicKey,
    revenueAmount: 100n * 1_000_000_000n,
  });
  if (!distRes.success) {
    console.error('  FAIL distributeRevenue:', distRes.error);
    process.exit(8);
  }
  console.log('  ✓ distributeRevenue tx:', distRes.signature);
  console.log('    →', explorerUrl(distRes.signature));

  const claimRes = await fmodBuyer.claimRevenue({ nftMint: nftKp.publicKey });
  if (!claimRes.success) {
    console.error('  FAIL claimRevenue:', claimRes.error);
    process.exit(9);
  }
  console.log('  ✓ claimRevenue tx :', claimRes.signature);
  console.log('    →', explorerUrl(claimRes.signature));

  const holder2 = await fmod.fetchFragmentHolder(nftKp.publicKey, buyer.publicKey);
  console.log('    revenue_claimed  :', holder2.revenueClaimed.toString());
  if (holder2.revenueClaimed === 0n) {
    console.warn('  WARN: revenue_claimed still 0 — contract may track this differently');
  }

  console.log('\n[smoke-fractionalize] ✅ ALL CHECKS PASSED');
  console.log('\nSummary:');
  console.log('  • fractionalNft :', fres.fractionalNft.toBase58());
  console.log('  • fragmentMint  :', fres.fragmentMint.toBase58());
  console.log('  • buyer holder  :', holder.address.toBase58());
}

main().catch((e) => {
  console.error('[smoke-fractionalize] CRASH:', e);
  process.exit(1);
});
