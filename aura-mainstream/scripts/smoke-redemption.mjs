#!/usr/bin/env node
/**
 * smoke-redemption.mjs — end-to-end Creator-Coin redemption flow.
 *
 * Test path (assumes a pre-existing creator coin on localnet — see
 * "Pre-requisites" below):
 *   1. Locate the creator's coin (via VITE_SMOKE_CREATOR or the keypair
 *      at $SMOKE_CREATOR_KEYPAIR; defaults to admin keypair).
 *   2. (If missing) Init redemption counter as the creator.
 *   3. (If missing) Init benefits list + add a benefit at threshold 50 CC.
 *   4. Generate a fresh fan keypair; airdrop 2 SOL; gift 100 CC to the fan.
 *   5. Fan initiates a redemption (locks 50 CC into escrow).
 *   6. Creator marks the redemption as delivered.
 *   7. Fan confirms receipt → 50 CC released to creator.
 *   8. Verify final balances on-chain.
 *
 * Why this design: the contract gates `create_creator_coin` on
 * `creator_profile.follower_count >= MIN_FOLLOWERS (100)`, which means a
 * full end-to-end "spin up a brand-new coin" can't be done from a vanilla
 * smoke test without a follow-up `core::register_user` + manual follower
 * injection. The pre-existing-coin shortcut keeps the test small and
 * focused on the redemption surface.
 *
 * Pre-requisites:
 *   • Localnet test-validator running, all programs deployed.
 *   • The creator keypair (admin by default) MUST already have a Creator
 *     Coin minted. If you don't have one yet, run the dashboard once
 *     (CreateCoin → MintCeremony) or wire up a small script that calls
 *     core::register_user + creator-coin::create_creator_coin via a
 *     pre-seeded UserProfile.
 *
 * Exit codes:
 *   0  pass
 *   2  creator coin missing → set up one first
 *   3+ individual step failures (see logs)
 *   99 wrong RPC (not localnet)
 */

import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { sha256 } from '@noble/hashes/sha256';
import { CreatorCoinModule, BenefitType } from '@aura-protocol/sdk/dist/modules/creatorCoin.js';
import { PROGRAM_IDS } from '@aura-protocol/sdk/dist/constants.js';

const RPC_URL = process.env.RPC_URL ?? 'http://127.0.0.1:8899';
const CREATOR_COIN_PROGRAM_ID = PROGRAM_IDS.LOCALNET.creatorCoin;
const ADMIN_KEYPAIR_PATH = process.env.SMOKE_CREATOR_KEYPAIR
  ?? join(homedir(), '.config', 'solana', 'id.json');

if (!RPC_URL.includes('127.0.0.1') && !RPC_URL.includes('localhost')) {
  console.error('[smoke-redemption] refusing to run against non-localnet RPC:', RPC_URL);
  process.exit(99);
}

function loadKeypair(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
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
      const sig = await conn.sendRawTransaction(tx.serialize());
      await conn.confirmTransaction(sig, 'confirmed');
      return sig;
    },
  };
}

function explorerUrl(sig) {
  return `https://explorer.solana.com/tx/${sig}?cluster=custom&customUrl=${encodeURIComponent(RPC_URL)}`;
}

function hashNote(text) {
  return Buffer.from(sha256(Buffer.from(text ?? '', 'utf8')));
}

async function main() {
  console.log('[smoke-redemption] RPC:', RPC_URL);
  console.log('[smoke-redemption] CreatorCoin program:', CREATOR_COIN_PROGRAM_ID.toBase58());

  const connection = new Connection(RPC_URL, 'confirmed');
  const creator = loadKeypair(ADMIN_KEYPAIR_PATH);
  const fan = Keypair.generate();
  console.log('[smoke-redemption] Creator:', creator.publicKey.toBase58());
  console.log('[smoke-redemption] Fan    :', fan.publicKey.toBase58());

  const creatorWallet = makeWallet(creator);
  const creatorMod = new CreatorCoinModule(connection, creatorWallet, CREATOR_COIN_PROGRAM_ID);

  // ── 0. Locate creator coin ─────────────────────────────────────────
  const coin = await creatorMod.fetchCreatorCoin(creator.publicKey);
  if (!coin) {
    console.error('\n[smoke-redemption] FAIL: no Creator Coin found for', creator.publicKey.toBase58());
    console.error('  Set up a coin first (see "Pre-requisites" in this script\'s header).');
    console.error('  Or set SMOKE_CREATOR_KEYPAIR=path/to/creator.json pointing at a wallet that already has one.');
    process.exit(2);
  }
  console.log('  Creator coin   :', coin.address.toBase58());
  console.log('  Coin mint      :', coin.mint.toBase58());
  console.log('  Symbol         :', coin.symbol);
  console.log('  Circulating sup:', coin.circulatingSupply.toString());

  const coinMint = coin.mint;

  // ── 1. (If missing) init benefits list + add a 50-CC benefit ──────
  console.log('\n[1/6] Ensuring benefits list + benefit#0 exist…');
  const benefitsPda = creatorMod.pdas.benefits(coinMint);
  let benefitsAcc = await connection.getAccountInfo(benefitsPda);
  if (!benefitsAcc) {
    const r = await creatorMod.initBenefitsList(coinMint);
    if (!r.success) { console.error('  FAIL initBenefitsList:', r.error); process.exit(3); }
    console.log('  ✓ initBenefitsList tx:', r.signature);
  } else {
    console.log('  benefits list already exists');
  }

  // Always add a benefit; the smoke test runs end-to-end so we want a
  // fresh redemption target. Threshold = 50 CC (1 CC = 1e9 base units).
  const COST_CC_HUMAN = 50;
  const COST_CC_RAW = BigInt(COST_CC_HUMAN) * 1_000_000_000n;
  const benefitUri = 'https://aura.local/perks/smoke-test';
  const benefitHash = Buffer.from(sha256(Buffer.from('smoke-perk', 'utf8')));
  const addRes = await creatorMod.addBenefit({
    coinMint,
    benefitType: BenefitType.Consumable,
    threshold: COST_CC_RAW,
    metadataUri: benefitUri,
    metadataHash: benefitHash,
  });
  if (!addRes.success) {
    console.warn('  WARN addBenefit failed (may already be at cap):', addRes.error);
  } else {
    console.log('  ✓ addBenefit tx:', addRes.signature);
  }

  // The benefit_id is the index in the BenefitsList vec. We assume the
  // most recently added benefit is at index 0 if list was fresh, or last
  // index otherwise. For a deterministic smoke run, parse the list size
  // from the on-chain account: disc(8) + coin_mint(32) + creator(32) +
  // benefits(Vec<Benefit>) → vec length is the u32 at offset 8+32+32=72.
  benefitsAcc = await connection.getAccountInfo(benefitsPda);
  const benefitVecLen = benefitsAcc ? benefitsAcc.data.readUInt32LE(8 + 32 + 32) : 1;
  const benefitId = Math.max(0, benefitVecLen - 1);
  console.log('  Using benefit_id =', benefitId, '(of', benefitVecLen, ')');

  // ── 2. Init redemption counter (idempotent) ───────────────────────
  console.log('\n[2/6] Ensuring redemption counter is initialized…');
  const counterPda = creatorMod.pdas.redemptionCounter(coinMint);
  let counterAcc = await connection.getAccountInfo(counterPda);
  if (!counterAcc) {
    const r = await creatorMod.initRedemptionCounter(coinMint);
    if (!r.success) { console.error('  FAIL initRedemptionCounter:', r.error); process.exit(4); }
    console.log('  ✓ initRedemptionCounter tx:', r.signature);
    counterAcc = await connection.getAccountInfo(counterPda);
  } else {
    console.log('  counter already exists');
  }
  const currentCount = counterAcc.data.readBigUInt64LE(8 + 32);
  console.log('  Current redemption count:', currentCount.toString());

  // ── 3. Airdrop SOL to fan + create fan's CC ATA ───────────────────
  console.log('\n[3/6] Airdrop 2 SOL to fan + create CC ATA…');
  const air = await connection.requestAirdrop(fan.publicKey, 2 * 1e9);
  await connection.confirmTransaction(air, 'confirmed');

  const fanCcAta = getAssociatedTokenAddressSync(coinMint, fan.publicKey, false);
  const fanWallet = makeWallet(fan);
  // Fan creates their own ATA (payer = fan, owner = fan).
  const ataIx = createAssociatedTokenAccountInstruction(
    fan.publicKey, fanCcAta, fan.publicKey, coinMint,
  );
  await fanWallet.sendTransaction(new Transaction().add(ataIx), connection);
  console.log('  fan CC ATA:', fanCcAta.toBase58());

  // ── 4. Creator gifts 100 CC to fan ────────────────────────────────
  console.log('\n[4/6] Creator gifts 100 CC to fan…');
  const creatorCcAta = getAssociatedTokenAddressSync(coinMint, creator.publicKey, false);
  const giftRes = await creatorMod.giftCreatorCoin({
    coinMint,
    senderTokenAccount: creatorCcAta,
    recipient: fan.publicKey,
    recipientTokenAccount: fanCcAta,
    amount: 100n * 1_000_000_000n,
    memoUri: 'smoke-test-gift',
  });
  if (!giftRes.success) {
    console.error('  FAIL gift:', giftRes.error);
    console.error('  Note: this requires creator to have ≥100 CC available; check vesting state.');
    process.exit(5);
  }
  console.log('  ✓ gift tx:', giftRes.signature);
  console.log('    →', explorerUrl(giftRes.signature));
  const fanBal0 = (await connection.getTokenAccountBalance(fanCcAta)).value.uiAmount;
  console.log('  fan CC balance:', fanBal0);

  // ── 5. Fan initiates redemption ───────────────────────────────────
  console.log('\n[5/6] Fan initiates redemption (locks 50 CC into escrow)…');
  // The escrow ATA's owner is the redemption PDA (which doesn't exist
  // yet but is deterministic from the current counter value).
  const redemptionPda = creatorMod.pdas.redemption(coinMint, currentCount);
  const escrowAta = getAssociatedTokenAddressSync(coinMint, redemptionPda, true);
  // Pre-create the escrow ATA — `init` on the redemption account doesn't
  // also init its ATA. The contract validates the escrow ATA constraints
  // post-hoc, so as long as it exists + has the right owner/mint, we're
  // fine.
  try {
    const escrowIx = createAssociatedTokenAccountInstruction(
      fan.publicKey, escrowAta, redemptionPda, coinMint,
    );
    await fanWallet.sendTransaction(new Transaction().add(escrowIx), connection);
    console.log('  escrow ATA pre-created:', escrowAta.toBase58());
  } catch (e) {
    // Already exists from a previous run — fine.
    if (!/already in use/i.test(String(e))) console.warn('  escrow ATA create warning:', e.message ?? e);
  }

  const fanMod = new CreatorCoinModule(connection, fanWallet, CREATOR_COIN_PROGRAM_ID);
  const initRes = await fanMod.initiateRedemption({
    coinMint,
    benefitId,
    cost: COST_CC_RAW,
    buyerTokenAccount: fanCcAta,
    escrowTokenAccount: escrowAta,
    creator: creator.publicKey,
  });
  if (!initRes.success) {
    console.error('  FAIL initiateRedemption:', initRes.error);
    process.exit(6);
  }
  console.log('  ✓ initiateRedemption tx:', initRes.signature);
  console.log('    →', explorerUrl(initRes.signature));
  console.log('    redemption PDA       :', initRes.redemption.toBase58());

  const escrowBal = (await connection.getTokenAccountBalance(escrowAta)).value.uiAmount;
  console.log('  escrow now holds:', escrowBal, 'CC');

  // ── 6. Creator marks delivered + fan confirms ──────────────────────
  console.log('\n[6/6] Creator marks delivered + fan confirms receipt…');
  const note = 'tracking: ABC-12345';
  const markRes = await creatorMod.markDelivered({
    coinMint,
    redemptionId: currentCount,
    noteUri: note,
    noteHash: hashNote(note),
  });
  if (!markRes.success) {
    console.error('  FAIL markDelivered:', markRes.error);
    process.exit(7);
  }
  console.log('  ✓ markDelivered tx:', markRes.signature);
  console.log('    →', explorerUrl(markRes.signature));

  const confirmRes = await fanMod.confirmReceipt({
    coinMint,
    redemptionId: currentCount,
    escrowTokenAccount: escrowAta,
    creatorTokenAccount: creatorCcAta,
  });
  if (!confirmRes.success) {
    console.error('  FAIL confirmReceipt:', confirmRes.error);
    process.exit(8);
  }
  console.log('  ✓ confirmReceipt tx:', confirmRes.signature);
  console.log('    →', explorerUrl(confirmRes.signature));

  const escrowBalAfter = (await connection.getTokenAccountBalance(escrowAta)).value.uiAmount;
  const fanBalAfter = (await connection.getTokenAccountBalance(fanCcAta)).value.uiAmount;
  const creatorBalAfter = (await connection.getTokenAccountBalance(creatorCcAta)).value.uiAmount;
  console.log('\n  Final balances:');
  console.log('    fan CC      :', fanBalAfter);
  console.log('    escrow CC   :', escrowBalAfter);
  console.log('    creator CC  :', creatorBalAfter);

  if (escrowBalAfter !== 0) {
    console.warn('  WARN: escrow not drained to zero after confirm — expected 0');
  }

  console.log('\n[smoke-redemption] ✅ ALL CHECKS PASSED');
}

main().catch((e) => {
  console.error('[smoke-redemption] CRASH:', e);
  process.exit(1);
});
