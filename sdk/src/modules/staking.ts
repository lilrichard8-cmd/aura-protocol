/**
 * StakingModule — ORA staking on-chain operations.
 *
 * Wraps the `aura_staking` program (programs/staking/src/lib.rs):
 *   - initialize_staking_pool   (admin only, gated to PROGRAM_ADMIN)
 *   - initialize_stake_counter  (one-time per user, mints stake-nonce 0,1,2,…)
 *   - stake_ora(amount, lockup_tier)
 *   - unstake_ora(stake_nonce)
 *   - claim_staking_reward(stake_nonce)
 *   - update_daily_rewards      (admin only)
 *   - close_stake_counter
 *
 * [audit fix C-S1] PDA seeds:
 *   StakingPool:  [b"staking_pool"]
 *   StakeCounter: [b"stake-counter", user]
 *   StakeAccount: [b"stake", user, nonce_u64_le]   ← nonce is monotonic per
 *                                                    user, allocated by the
 *                                                    on-chain StakeCounter
 *
 * Discriminators are real Anchor (sha256("global:<snake_case>")[..8]) so this
 * matches the deployed binary exactly.
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
  /** [audit fix C-S1] per-user monotonic nonce allocator (StakeCounter::SEED). */
  COUNTER: Buffer.from('stake-counter'),
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

export const LOCKUP_PARAMS: Record<LockupTier, { days: number; multiplierBps: number }> = {
  [LockupTier.OneMonth]:     { days: 30,  multiplierBps: 10_000 }, // 1.00x
  [LockupTier.ThreeMonths]:  { days: 90,  multiplierBps: 10_000 }, // 1.00x
  [LockupTier.SixMonths]:    { days: 180, multiplierBps: 15_000 }, // 1.50x
  [LockupTier.TwelveMonths]: { days: 360, multiplierBps: 20_000 }, // 2.00x
};

/** Early unstake penalty (20%). */
export const EARLY_UNSTAKE_PENALTY_BPS = 2_000;

/** Minimum stake amount (1,000 ORA, 9 decimals). Matches MIN_STAKE_AMOUNT. */
export const MIN_STAKE_AMOUNT_RAW = 1_000n * 1_000_000_000n;

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

// ────────────────────────────────────────────────────────────────────────
// PDA helpers
// ────────────────────────────────────────────────────────────────────────

export interface StakingPdas {
  pool: PublicKey;
  counter(user: PublicKey): PublicKey;
  /** [audit fix C-S1] stake PDA seeds = [b"stake", user, nonce_u64_le]. */
  stake(user: PublicKey, nonce: bigint | number): PublicKey;
}

function makePdas(programId: PublicKey): StakingPdas {
  const [pool] = PublicKey.findProgramAddressSync([STAKING_SEEDS.POOL], programId);
  return {
    pool,
    counter(user) {
      const [pda] = PublicKey.findProgramAddressSync(
        [STAKING_SEEDS.COUNTER, user.toBuffer()],
        programId,
      );
      return pda;
    },
    stake(user, nonce) {
      const [pda] = PublicKey.findProgramAddressSync(
        [STAKING_SEEDS.STAKE, user.toBuffer(), u64LE(nonce)],
        programId,
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
  /** Vault token account (ORA, authority = pool PDA). */
  vaultTokenAccount: PublicKey;
  /** User's source ORA ATA. */
  userTokenAccount: PublicKey;
}

export interface UnstakeOraParams {
  /** Monotonic nonce assigned by StakeCounter when the stake was created. */
  stakeNonce: bigint | number;
  vaultTokenAccount: PublicKey;
  /** Reward vault token account (must be owned by staking_pool PDA). */
  rewardVault: PublicKey;
  userTokenAccount: PublicKey;
}

export interface ClaimStakingRewardParams {
  stakeNonce: bigint | number;
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

export interface StakeCounterOnChain {
  address: PublicKey;
  user: PublicKey;
  nextNonce: bigint;
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
    private programId: PublicKey,
  ) {
    this.pdas = makePdas(programId);
  }

  // ── reads ─────────────────────────────────────────────────────────────

  async fetchPool(): Promise<StakingPoolOnChain | null> {
    const acc = await this.connection.getAccountInfo(this.pdas.pool);
    if (!acc) return null;
    return parseStakingPool(this.pdas.pool, acc.data);
  }

  /** Read a user's StakeCounter (returns null if not yet initialized). */
  async fetchCounter(user: PublicKey): Promise<StakeCounterOnChain | null> {
    const addr = this.pdas.counter(user);
    const acc = await this.connection.getAccountInfo(addr);
    if (!acc) return null;
    return parseStakeCounter(addr, acc.data);
  }

  async fetchStake(addr: PublicKey): Promise<StakeAccountOnChain | null> {
    const acc = await this.connection.getAccountInfo(addr);
    if (!acc) return null;
    return parseStakeAccount(addr, acc.data);
  }

  /** Read a stake by (user, nonce). Convenience helper. */
  async fetchStakeByNonce(user: PublicKey, nonce: bigint | number): Promise<StakeAccountOnChain | null> {
    return this.fetchStake(this.pdas.stake(user, nonce));
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

  /**
   * [audit fix C-S1] One-time per user. Idempotent: if the counter already
   * exists, skips with success=true and no-op signature.
   */
  async initializeStakeCounter(): Promise<TransactionResult> {
    const user = this.requireWallet();
    const counterPda = this.pdas.counter(user);
    const existing = await this.connection.getAccountInfo(counterPda);
    if (existing) return { signature: '', success: true };

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: counterPda, isSigner: false, isWritable: true },
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('initialize_stake_counter'),
    });
    return this.sendTx([ix]);
  }

  /**
   * Stake ORA. Auto-ensures the StakeCounter exists, then stakes.
   *
   * Returns the stake PDA and the nonce assigned by the on-chain counter.
   * The nonce is read off-chain immediately before the tx so it matches the
   * Anchor seed evaluation (seeds use `stake_counter.next_nonce` *before*
   * the ix body increments it).
   */
  async stakeOra(
    params: StakeOraParams,
  ): Promise<TransactionResult & { stake?: PublicKey; nonce?: bigint }> {
    const user = this.requireWallet();

    const amount = BigInt(params.amount);
    if (amount <= 0n) return errRes('amount must be > 0');

    const ixs: TransactionInstruction[] = [];
    const counterPda = this.pdas.counter(user);

    // [audit fix C-S1] Ensure counter exists; if it does, read its next_nonce
    // to derive the stake PDA. If not, init it (next_nonce will be 0).
    let nextNonce: bigint;
    const counterAcc = await this.connection.getAccountInfo(counterPda);
    if (!counterAcc) {
      ixs.push(new TransactionInstruction({
        programId: this.programId,
        keys: [
          { pubkey: counterPda, isSigner: false, isWritable: true },
          { pubkey: user, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: ixDiscriminator('initialize_stake_counter'),
      }));
      nextNonce = 0n;
    } else {
      const counter = parseStakeCounter(counterPda, counterAcc.data);
      nextNonce = counter.nextNonce;
    }

    const stakePda = this.pdas.stake(user, nextNonce);

    const data = Buffer.concat([
      ixDiscriminator('stake_ora'),
      u64LE(amount),
      u8(params.lockupTier), // enum is unit-variant → 1 byte
    ]);

    ixs.push(new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.pool, isSigner: false, isWritable: true },
        { pubkey: counterPda, isSigner: false, isWritable: true },
        { pubkey: stakePda, isSigner: false, isWritable: true },
        { pubkey: params.vaultTokenAccount, isSigner: false, isWritable: true },
        { pubkey: params.userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data,
    }));

    const res = await this.sendTx(ixs);
    return { ...res, stake: stakePda, nonce: nextNonce };
  }

  async unstakeOra(params: UnstakeOraParams): Promise<TransactionResult> {
    const user = this.requireWallet();
    const nonce = BigInt(params.stakeNonce);
    const stakePda = this.pdas.stake(user, nonce);

    const data = Buffer.concat([
      ixDiscriminator('unstake_ora'),
      u64LE(nonce),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.pool, isSigner: false, isWritable: true },
        { pubkey: stakePda, isSigner: false, isWritable: true },
        { pubkey: params.vaultTokenAccount, isSigner: false, isWritable: true },
        { pubkey: params.rewardVault, isSigner: false, isWritable: true },
        { pubkey: params.userTokenAccount, isSigner: false, isWritable: true },
        // owner CHECK account: passed twice — once as AccountInfo for the
        // has_one check, then `user` as Signer.
        { pubkey: user, isSigner: false, isWritable: false },
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async claimStakingReward(params: ClaimStakingRewardParams): Promise<TransactionResult> {
    const user = this.requireWallet();
    const nonce = BigInt(params.stakeNonce);
    const stakePda = this.pdas.stake(user, nonce);

    const data = Buffer.concat([
      ixDiscriminator('claim_staking_reward'),
      u64LE(nonce),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.pool, isSigner: false, isWritable: false },
        { pubkey: stakePda, isSigner: false, isWritable: true },
        { pubkey: params.rewardVault, isSigner: false, isWritable: true },
        { pubkey: params.userTokenAccount, isSigner: false, isWritable: true },
        // owner CHECK account, then user signer.
        { pubkey: user, isSigner: false, isWritable: false },
        { pubkey: user, isSigner: true, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  /** Close a fully-drained StakeCounter (refund rent). */
  async closeStakeCounter(): Promise<TransactionResult> {
    const user = this.requireWallet();
    const counterPda = this.pdas.counter(user);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: counterPda, isSigner: false, isWritable: true },
        { pubkey: user, isSigner: true, isWritable: true },
      ],
      data: ixDiscriminator('close_stake_counter'),
    });
    return this.sendTx([ix]);
  }

  /** Authority-only. Adds new rewards to the pool from the 2%-fee bucket. */
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
const STAKE_COUNTER_DISC = accountDiscriminator('StakeCounter');
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

function parseStakeCounter(addr: PublicKey, data: Buffer): StakeCounterOnChain {
  if (!data.slice(0, 8).equals(STAKE_COUNTER_DISC)) {
    throw new Error('Account is not a StakeCounter');
  }
  let o = 8;
  const user = new PublicKey(data.slice(o, o + 32)); o += 32;
  const nextNonce = data.readBigUInt64LE(o); o += 8;
  const bump = data.readUInt8(o); o += 1;
  return { address: addr, user, nextNonce, bump };
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
