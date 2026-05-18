/**
 * StakingModule — ORA staking on-chain operations.
 *
 * Wraps the `aura_staking` program (programs/staking/src/lib.rs):
 *   - initialize_staking_pool
 *   - stake_ora                (with LockupTier: 1mo / 3mo / 6mo / 12mo)  [audit fix R5 H-S-1]
 *   - unstake_ora              (20% penalty when early)
 *   - claim_staking_reward
 *   - update_daily_rewards     (authority only)
 *
 * Discriminators are real Anchor hashes (sha256("global:<snake_case>")[..8])
 * so this matches the deployed binary, not a fake 1-byte tag.
 *
 * NOTE on stake PDA seeds: the on-chain seeds are
 *   [b"stake", user.key().as_ref(), &Clock::get()?.unix_timestamp.to_le_bytes()]
 *
 * i.e. the contract derives the seed using the current cluster time at
 * tx execution. The client cannot match that exactly off-chain. Callers
 * compute a candidate PDA with `nowSeconds` (defaults to `Date.now()/1000`)
 * and submit; if the validator's clock drifts by ≥1s the tx will fail and
 * the caller should retry. (The Rust contract takes an explicit `stake_nonce`
 * arg too — passed but not yet used in the seed derivation; see whitepaper
 * task FIX #12.)
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { WalletAdapter } from '@solana/wallet-adapter-base';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { sha256 } from '@noble/hashes/sha256';

import { TransactionResult } from '../types';

// ────────────────────────────────────────────────────────────────────────
// Constants — must match programs/staking/src/lib.rs
// ────────────────────────────────────────────────────────────────────────

export const STAKING_SEEDS = {
  POOL: Buffer.from('staking_pool'),
  STAKE: Buffer.from('stake'),
} as const;

/** Lockup tiers and their (days, multiplier_bps) — matches LockupTier::params(). */
// [audit fix R5 H-S-1] WP v1.1 §14 + Numbers Handbook §14: 1mo / 3mo / 6mo /
// 12mo with multipliers 1.0/1.0/1.5/2.0. SDK enum mirrors the on-chain Rust
// enum exactly; ordinal index is the Anchor discriminant.
export enum LockupTier {
  OneMonth = 0,
  ThreeMonths = 1,
  SixMonths = 2,
  TwelveMonths = 3,
}

// [audit fix R5 H-S-1] Whitepaper v1.1 §14.3 + Numbers Handbook §14 specify
// 1mo=1.0x / 3mo=1.0x / 6mo=1.5x / 12mo=2.0x. Previous tiers (1d / 30d /
// 90d / 180d) were a Phase-0 placeholder; the 12-month tier was missing and
// the 1-day tier had no WP basis. SDK matches programs/staking/src/lib.rs
// in lockstep.
export const LOCKUP_PARAMS: Record<LockupTier, { days: number; multiplierBps: number }> = {
  [LockupTier.OneMonth]:     { days: 30,  multiplierBps: 10_000 }, // 1.00x
  [LockupTier.ThreeMonths]:  { days: 90,  multiplierBps: 10_000 }, // 1.00x
  [LockupTier.SixMonths]:    { days: 180, multiplierBps: 15_000 }, // 1.50x
  [LockupTier.TwelveMonths]: { days: 360, multiplierBps: 20_000 }, // 2.00x
};

/** Early unstake penalty (20%). */
export const EARLY_UNSTAKE_PENALTY_BPS = 2_000;

// ────────────────────────────────────────────────────────────────────────
// Anchor discriminator helpers
// ────────────────────────────────────────────────────────────────────────

function ixDiscriminator(name: string): Buffer {
  return Buffer.from(sha256(Buffer.from(`global:${name}`, 'utf8')).slice(0, 8));
}

function accountDiscriminator(name: string): Buffer {
  return Buffer.from(sha256(Buffer.from(`account:${name}`, 'utf8')).slice(0, 8));
}

// ────────────────────────────────────────────────────────────────────────
// Borsh primitives
// ────────────────────────────────────────────────────────────────────────

function u8(v: number): Buffer { const b = Buffer.alloc(1); b.writeUInt8(v, 0); return b; }
function u64LE(v: bigint | number): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(typeof v === 'bigint' ? v : BigInt(v), 0);
  return b;
}
function i64LE(v: bigint | number): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigInt64LE(typeof v === 'bigint' ? v : BigInt(v), 0);
  return b;
}

// ────────────────────────────────────────────────────────────────────────
// PDA helpers
// ────────────────────────────────────────────────────────────────────────

export interface StakingPdas {
  pool: PublicKey;
  /** Stake seed contains the unix timestamp from the validator clock when
   *  the tx executes. Pass that timestamp as i64-LE to derive the same PDA
   *  the contract will allocate. */
  stake(user: PublicKey, unixTimestampSeconds: bigint | number): PublicKey;
}

function makePdas(programId: PublicKey): StakingPdas {
  const [pool] = PublicKey.findProgramAddressSync([STAKING_SEEDS.POOL], programId);
  return {
    pool,
    stake(user, ts) {
      const tsBuf = i64LE(ts);
      const [pda] = PublicKey.findProgramAddressSync(
        [STAKING_SEEDS.STAKE, user.toBuffer(), tsBuf],
        programId
      );
      return pda;
    },
  };
}

// ────────────────────────────────────────────────────────────────────────
// Public params
// ────────────────────────────────────────────────────────────────────────

export interface InitializeStakingPoolParams {
  oraMint: PublicKey;
}

export interface StakeOraParams {
  amount: bigint | number;
  lockupTier: LockupTier;
  /** Disambiguator passed to the program (does not currently affect PDA). */
  stakeNonce: bigint | number;
  /** Vault token account (ORA, authority = pool PDA). */
  vaultTokenAccount: PublicKey;
  /** User's source ORA ATA. */
  userTokenAccount: PublicKey;
  /** Unix-seconds to use for PDA derivation. Default: current time. */
  nowSeconds?: bigint | number;
}

export interface UnstakeOraParams {
  /** Stake PDA address (use the same `unixTimestamp` originally used). */
  stakeAddress: PublicKey;
  vaultTokenAccount: PublicKey;
  userTokenAccount: PublicKey;
}

export interface ClaimStakingRewardParams {
  stakeAddress: PublicKey;
  rewardVault: PublicKey;
  userTokenAccount: PublicKey;
}

export interface UpdateDailyRewardsParams {
  rewardAmount: bigint | number;
  rewardSource: PublicKey;
  rewardVault: PublicKey;
}

// ────────────────────────────────────────────────────────────────────────
// On-chain account types
// ────────────────────────────────────────────────────────────────────────

export interface StakingPoolOnChain {
  address: PublicKey;
  authority: PublicKey;
  oraMint: PublicKey;
  totalStaked: bigint;
  totalWeightedStake: bigint;
  rewardPoolBalance: bigint;
  lastDailyUpdate: number;
  accumulatedRewardPerWeight: bigint;
  bump: number;
}

export interface StakeAccountOnChain {
  address: PublicKey;
  owner: PublicKey;
  stakeNonce: bigint;
  amount: bigint;
  lockupTier: LockupTier;
  stakedAt: number;
  unlockAt: number;
  multiplierBps: number;
  rewardDebt: bigint;
  claimedRewards: bigint;
  bump: number;
}

// ────────────────────────────────────────────────────────────────────────
// StakingModule
// ────────────────────────────────────────────────────────────────────────

export class StakingModule {
  public readonly pdas: StakingPdas;

  constructor(
    private connection: Connection,
    private wallet: WalletAdapter,
    private programId: PublicKey
  ) {
    this.pdas = makePdas(programId);
  }

  // ── reads ─────────────────────────────────────────────────────────────

  async fetchPool(): Promise<StakingPoolOnChain | null> {
    const acc = await this.connection.getAccountInfo(this.pdas.pool);
    if (!acc) return null;
    return parseStakingPool(this.pdas.pool, acc.data);
  }

  async fetchStake(addr: PublicKey): Promise<StakeAccountOnChain | null> {
    const acc = await this.connection.getAccountInfo(addr);
    if (!acc) return null;
    return parseStakeAccount(addr, acc.data);
  }

  // ── writes ────────────────────────────────────────────────────────────

  async initializeStakingPool(params: InitializeStakingPoolParams): Promise<TransactionResult> {
    const authority = this.requireWallet();
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.pool, isSigner: false, isWritable: true },
        { pubkey: params.oraMint, isSigner: false, isWritable: false },
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('initialize_staking_pool'),
    });
    return this.sendTx([ix]);
  }

  /** Stake ORA. Returns the stake account PDA on success. */
  async stakeOra(params: StakeOraParams): Promise<TransactionResult & { stake?: PublicKey; nowSeconds?: bigint }> {
    const user = this.requireWallet();

    const amount = BigInt(params.amount);
    if (amount <= 0n) return errRes('amount must be > 0');

    const now = params.nowSeconds !== undefined
      ? BigInt(params.nowSeconds)
      : BigInt(Math.floor(Date.now() / 1000));

    const stakePda = this.pdas.stake(user, now);

    const data = Buffer.concat([
      ixDiscriminator('stake_ora'),
      u64LE(amount),
      u8(params.lockupTier),         // enum is unit-variant → 1 byte
      u64LE(BigInt(params.stakeNonce)),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.pool, isSigner: false, isWritable: true },
        { pubkey: stakePda, isSigner: false, isWritable: true },
        { pubkey: params.vaultTokenAccount, isSigner: false, isWritable: true },
        { pubkey: params.userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data,
    });

    const res = await this.sendTx([ix]);
    return { ...res, stake: stakePda, nowSeconds: now };
  }

  async unstakeOra(params: UnstakeOraParams): Promise<TransactionResult> {
    const user = this.requireWallet();
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.pool, isSigner: false, isWritable: true },
        { pubkey: params.stakeAddress, isSigner: false, isWritable: true },
        { pubkey: params.vaultTokenAccount, isSigner: false, isWritable: true },
        { pubkey: params.userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: user, isSigner: false, isWritable: false }, // owner check via has_one
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('unstake_ora'),
    });
    return this.sendTx([ix]);
  }

  async claimStakingReward(params: ClaimStakingRewardParams): Promise<TransactionResult> {
    const user = this.requireWallet();
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.pool, isSigner: false, isWritable: false },
        { pubkey: params.stakeAddress, isSigner: false, isWritable: true },
        { pubkey: params.rewardVault, isSigner: false, isWritable: true },
        { pubkey: params.userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: user, isSigner: true, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('claim_staking_reward'),
    });
    return this.sendTx([ix]);
  }

  /** Authority-only. Adds new rewards to the pool from a 2%-fee bucket. */
  async updateDailyRewards(params: UpdateDailyRewardsParams): Promise<TransactionResult> {
    const authority = this.requireWallet();
    const data = Buffer.concat([
      ixDiscriminator('update_daily_rewards'),
      u64LE(BigInt(params.rewardAmount)),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.pool, isSigner: false, isWritable: true },
        { pubkey: params.rewardSource, isSigner: false, isWritable: true },
        { pubkey: params.rewardVault, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  // ── pure helpers ──────────────────────────────────────────────────────

  /** Compute weighted stake amount = amount * multiplier_bps / 10000. */
  static weighted(amount: bigint, multiplierBps: number): bigint {
    return (amount * BigInt(multiplierBps)) / 10_000n;
  }

  /** Compute early-unstake penalty given gross staked amount. */
  static earlyUnstakePenalty(amount: bigint): bigint {
    return (amount * BigInt(EARLY_UNSTAKE_PENALTY_BPS)) / 10_000n;
  }

  // ── internals ─────────────────────────────────────────────────────────

  private requireWallet(): PublicKey {
    if (!this.wallet.publicKey) throw new Error('Wallet not connected');
    return this.wallet.publicKey;
  }

  private async sendTx(ixs: TransactionInstruction[]): Promise<TransactionResult> {
    try {
      const payer = this.requireWallet();
      const tx = new Transaction().add(...ixs);
      const { blockhash } = await this.connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = payer;
      const sig = await this.wallet.sendTransaction(tx, this.connection);
      await this.connection.confirmTransaction(sig);
      return { signature: sig, success: true };
    } catch (e) {
      return { signature: '', success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}

// ────────────────────────────────────────────────────────────────────────
// Account parsers
// ────────────────────────────────────────────────────────────────────────

const STAKING_POOL_DISC = accountDiscriminator('StakingPool');
const STAKE_ACCOUNT_DISC = accountDiscriminator('StakeAccount');

function parseStakingPool(addr: PublicKey, data: Buffer): StakingPoolOnChain {
  if (!data.slice(0, 8).equals(STAKING_POOL_DISC)) {
    throw new Error('Account is not a StakingPool');
  }
  let o = 8;
  const authority = new PublicKey(data.slice(o, o + 32)); o += 32;
  const oraMint = new PublicKey(data.slice(o, o + 32)); o += 32;
  const totalStaked = data.readBigUInt64LE(o); o += 8;
  const totalWeightedStake = data.readBigUInt64LE(o); o += 8;
  const rewardPoolBalance = data.readBigUInt64LE(o); o += 8;
  const lastDailyUpdate = Number(data.readBigInt64LE(o)); o += 8;
  const accumulatedRewardPerWeight = data.readBigUInt64LE(o); o += 8;
  const bump = data.readUInt8(o); o += 1;
  return {
    address: addr, authority, oraMint, totalStaked, totalWeightedStake,
    rewardPoolBalance, lastDailyUpdate, accumulatedRewardPerWeight, bump,
  };
}

function parseStakeAccount(addr: PublicKey, data: Buffer): StakeAccountOnChain {
  if (!data.slice(0, 8).equals(STAKE_ACCOUNT_DISC)) {
    throw new Error('Account is not a StakeAccount');
  }
  let o = 8;
  const owner = new PublicKey(data.slice(o, o + 32)); o += 32;
  const stakeNonce = data.readBigUInt64LE(o); o += 8;
  const amount = data.readBigUInt64LE(o); o += 8;
  const lockupByte = data.readUInt8(o); o += 1;
  const lockupTier = (lockupByte as LockupTier);
  const stakedAt = Number(data.readBigInt64LE(o)); o += 8;
  const unlockAt = Number(data.readBigInt64LE(o)); o += 8;
  const multiplierBps = data.readUInt16LE(o); o += 2;
  const rewardDebt = data.readBigUInt64LE(o); o += 8;
  const claimedRewards = data.readBigUInt64LE(o); o += 8;
  const bump = data.readUInt8(o); o += 1;
  return {
    address: addr, owner, stakeNonce, amount, lockupTier, stakedAt,
    unlockAt, multiplierBps, rewardDebt, claimedRewards, bump,
  };
}

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

function errRes(msg: string): TransactionResult {
  return { signature: '', success: false, error: msg };
}
