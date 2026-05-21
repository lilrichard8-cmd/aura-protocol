#!/usr/bin/env node
/**
 * mint-test-ora-to.mjs — manual fallback when the faucet is down OR
 * when you want to give a specific address a non-standard amount.
 *
 * Usage:
 *   node scripts/mint-test-ora-to.mjs <walletAddress> [amount=1000] [--mint=<pubkey>] [--rpc=<url>] [--keypair=<path>]
 *
 * Defaults:
 *   amount   = 1000 ORA
 *   mint     = $FAUCET_ORA_MINT or $VITE_ORA_MINT
 *   rpc      = $FAUCET_RPC_URL  or $VITE_RPC_URL  or https://api.devnet.solana.com
 *   keypair  = ./deploy-keypair.json (mint authority) → ~/.config/solana/id.json fallback
 *
 * The script:
 *   1. Loads the mint authority keypair from disk (JSON array form).
 *   2. Derives the recipient's ATA, creates it if missing.
 *   3. Mints `amount` * 10^9 base units (ORA decimals=9) to the ATA.
 *   4. Confirms and prints the signature.
 *
 * Safety:
 *   - Refuses to mint > 1,000,000 ORA in one shot (use multiple calls).
 *   - Prints the cluster + mint authority pubkey before sending so you
 *     can't accidentally drain a mainnet authority.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getAccount,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

const ORA_DECIMALS = 9;
const MAX_AMOUNT = 1_000_000;

function parseArgs(argv) {
  const out = { positional: [], flags: {} };
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      out.flags[k] = v ?? true;
    } else {
      out.positional.push(a);
    }
  }
  return out;
}

function loadKeypair(p) {
  const expanded = p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
  if (!fs.existsSync(expanded)) {
    throw new Error(`Keypair not found: ${expanded}`);
  }
  const raw = fs.readFileSync(expanded, 'utf8').trim();
  const arr = JSON.parse(raw);
  if (!Array.isArray(arr) || arr.length !== 64) {
    throw new Error(`Keypair file ${expanded} is not a 64-byte JSON array`);
  }
  return Keypair.fromSecretKey(Uint8Array.from(arr));
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [recipient, amountStr] = positional;

  if (!recipient || flags.help || flags.h) {
    console.error('Usage: node scripts/mint-test-ora-to.mjs <walletAddress> [amount=1000] [--mint=...] [--rpc=...] [--keypair=...]');
    process.exit(1);
  }

  const amount = Number(amountStr ?? 1000);
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    throw new Error(`Invalid amount ${amountStr}; must be 1..${MAX_AMOUNT}`);
  }

  const mintAddr =
    flags.mint
    ?? process.env.FAUCET_ORA_MINT
    ?? process.env.VITE_ORA_MINT;
  if (!mintAddr) {
    throw new Error('No mint address. Pass --mint=<pubkey> or set FAUCET_ORA_MINT / VITE_ORA_MINT.');
  }
  const rpcUrl =
    flags.rpc
    ?? process.env.FAUCET_RPC_URL
    ?? process.env.VITE_RPC_URL
    ?? 'https://api.devnet.solana.com';
  const keypairPath =
    flags.keypair
    ?? process.env.FAUCET_KEYPAIR_PATH
    ?? (fs.existsSync('./deploy-keypair.json')
      ? './deploy-keypair.json'
      : path.join(os.homedir(), '.config/solana/id.json'));

  const authority = loadKeypair(keypairPath);
  const recipientPk = new PublicKey(recipient);
  const mintPk = new PublicKey(mintAddr);
  const conn = new Connection(rpcUrl, 'confirmed');

  const lamports = BigInt(amount) * BigInt(10 ** ORA_DECIMALS);

  console.log('─── mint-test-ora-to ─────────────────────────────');
  console.log(`  RPC          : ${rpcUrl}`);
  console.log(`  Mint         : ${mintAddr}`);
  console.log(`  Authority    : ${authority.publicKey.toBase58()} (from ${keypairPath})`);
  console.log(`  Recipient    : ${recipientPk.toBase58()}`);
  console.log(`  Amount       : ${amount} ORA (${lamports.toString()} base units)`);

  // Sanity: refuse mainnet by default unless --yes-mainnet is passed.
  if (rpcUrl.includes('mainnet') && flags['yes-mainnet'] !== true) {
    throw new Error('Refusing to mint on mainnet without --yes-mainnet. (You really should not be using this on mainnet.)');
  }

  const ata = await getAssociatedTokenAddress(mintPk, recipientPk, true);
  console.log(`  Recipient ATA: ${ata.toBase58()}`);

  let ataExists = false;
  try {
    await getAccount(conn, ata);
    ataExists = true;
  } catch {
    ataExists = false;
  }

  const tx = new Transaction();
  if (!ataExists) {
    console.log('  → ATA missing, will create');
    tx.add(
      createAssociatedTokenAccountInstruction(
        authority.publicKey,
        ata,
        recipientPk,
        mintPk,
        TOKEN_PROGRAM_ID,
      ),
    );
  }
  tx.add(
    createMintToInstruction(
      mintPk,
      ata,
      authority.publicKey,
      lamports,
      [],
      TOKEN_PROGRAM_ID,
    ),
  );

  const sig = await sendAndConfirmTransaction(conn, tx, [authority], {
    commitment: 'confirmed',
    skipPreflight: false,
  });
  console.log(`  ✅ Done. Signature: ${sig}`);
  if (rpcUrl.includes('devnet')) {
    console.log(`     https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  } else if (rpcUrl.includes('mainnet')) {
    console.log(`     https://explorer.solana.com/tx/${sig}`);
  }
}

main().catch((err) => {
  console.error('❌ mint failed:', err.message ?? err);
  process.exit(1);
});
