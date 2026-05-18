/**
 * LaunchIncentivesModule — AURA §5.6 launch incentive programs.
 *
 * Wraps the `aura_launch_incentives` program (programs/launch-incentives/src/lib.rs):
 *
 *   • Million Plan (50M ORA, DAU-milestone unlocked)
 *       - initialize_launch_incentives
 *       - initialize_million_plan_state
 *       - trigger_milestone
 *       - claim_million_reward
 *
 *   • Creator Onboarding Program (50M ORA, 1 follower = 1 ORA, 12-month vest)
 *       - register_onboarding
 *       - claim_monthly_unlock
 *       - forfeit_pending_to_million_plan
 *
 *   • Rising Star Plan (50M ORA, 1 AURA follower = 1 ORA, 5K/mo cap, 12 months)
 *       - register_rising_star
 *       - record_monthly_followers
 *       - claim_rising_star_monthly
 *
 * Numbers anchored to Whitepaper v1.1 §5.6 + Numbers Handbook §4
 * (Handbook is authoritative).
 *
 * [whitepaper-sync v1.1] §5.6 launch-incentives
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';
import { WalletAdapter } from '@solana/wallet-adapter-base';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { sha256 } from '@noble/hashes/sha256';

import { TransactionResult } from '../types';

// ────────────────────────────────────────────────────────────────────────
// Constants — must match programs/launch-incentives/src/lib.rs
// [whitepaper-sync v1.1] §5.6 launch-incentives
// ────────────────────────────────────────────────────────────────────────

export const LAUNCH_INCENTIVES_SEEDS = {
  STATE: Buffer.from('launch_incentives'),
  MILESTONE: Buffer.from('milestone'),
  MILLION_CLAIM: Buffer.from('million_claim'),
  ONBOARDING: Buffer.from('onboarding'),
  RISING_STAR: Buffer.from('rising_star'),
  RS_MONTH: Buffer.from('rs_month'),
} as const;

// Sub-pool budgets (Handbook §4)
export const MILLION_PLAN_POOL:  bigint = 50_000_000n * 1_000_000_000n;
export const ONBOARDING_POOL:    bigint = 50_000_000n * 1_000_000_000n;
export const RISING_STAR_POOL:   bigint = 50_000_000n * 1_000_000_000n;
export const LAUNCH_INCENTIVE_TOTAL: bigint = 150_000_000n * 1_000_000_000n;

// Million Plan (§4.1)
export const MILESTONE_COUNT = 4;
export const MILESTONE_DAU_THRESHOLDS: readonly bigint[] = [
  100_000n, 250_000n, 500_000n, 1_000_000n,
];
export const MILESTONE_RELEASES: readonly bigint[] = [
  5_000_000n * 1_000_000_000n,
  5_000_000n * 1_000_000_000n,
  10_000_000n * 1_000_000_000n,
  30_000_000n * 1_000_000_000n,
];
export const MILESTONE_PER_USER_CAP: bigint = 10_000n * 1_000_000_000n;

// Onboarding (§4.2)
export const ONBOARDING_MIN_EXTERNAL_FOLLOWERS = 10_000n;
export const ONBOARDING_RATE_PER_FOLLOWER: bigint = 1_000_000_000n; // 1 ORA / follower
export const ONBOARDING_PER_CREATOR_CAP: bigint = 1_000_000n * 1_000_000_000n;
export const ONBOARDING_UNLOCK_MONTHS = 12;
export const ONBOARDING_MONTH_SECS = 30 * 24 * 60 * 60;
export const ONBOARDING_MAX_CONSECUTIVE_MISSES = 3;

// Rising Star (§4.3)
export const RISING_STAR_RATE_PER_FOLLOWER: bigint = 1_000_000_000n; // 1 ORA
export const RISING_STAR_MONTHLY_CAP: bigint = 5_000n * 1_000_000_000n;
export const RISING_STAR_DURATION_MONTHS = 12;

// Status enums (must mirror Rust repr)
export enum OnboardingStatus {
  Active = 0,
  Paused = 1,
  Forfeit = 2,
  Completed = 3,
}
export enum RisingStarStatus {
  Active = 0,
  Completed = 1,
  Suspended = 2,
}

// ────────────────────────────────────────────────────────────────────────
// Discriminator helpers
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
function boolByte(v: boolean): Buffer { return Buffer.from([v ? 1 : 0]); }
function stringBytes(s: string): Buffer {
  const enc = Buffer.from(s, 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32LE(enc.length, 0);
  return Buffer.concat([len, enc]);
}

// ────────────────────────────────────────────────────────────────────────
// PDA helpers
// ────────────────────────────────────────────────────────────────────────

export interface LaunchIncentivesPdas {
  state: PublicKey;
}

function makePdas(programId: PublicKey): LaunchIncentivesPdas {
  const [state] = PublicKey.findProgramAddressSync(
    [LAUNCH_INCENTIVES_SEEDS.STATE],
    programId
  );
  return { state };
}

export function deriveMilestonePda(
  programId: PublicKey,
  milestoneId: number
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [LAUNCH_INCENTIVES_SEEDS.MILESTONE, Buffer.from([milestoneId])],
    programId
  );
}

export function deriveMillionClaimPda(
  programId: PublicKey,
  user: PublicKey,
  milestoneId: number
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      LAUNCH_INCENTIVES_SEEDS.MILLION_CLAIM,
      user.toBuffer(),
      Buffer.from([milestoneId]),
    ],
    programId
  );
}

export function deriveOnboardingGrantPda(
  programId: PublicKey,
  creator: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [LAUNCH_INCENTIVES_SEEDS.ONBOARDING, creator.toBuffer()],
    programId
  );
}

export function deriveRisingStarGrantPda(
  programId: PublicKey,
  creator: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [LAUNCH_INCENTIVES_SEEDS.RISING_STAR, creator.toBuffer()],
    programId
  );
}

export function deriveRisingStarMonthPda(
  programId: PublicKey,
  creator: PublicKey,
  monthIndex: number
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      LAUNCH_INCENTIVES_SEEDS.RS_MONTH,
      creator.toBuffer(),
      Buffer.from([monthIndex]),
    ],
    programId
  );
}

// ────────────────────────────────────────────────────────────────────────
// Params
// ────────────────────────────────────────────────────────────────────────

export interface InitializeLaunchIncentivesParams {
  oraMint: PublicKey;
}

export interface InitializeMilestoneStateParams {
  milestoneId: number; // 0..3
}

export interface TriggerMilestoneParams {
  milestoneId: number;
  dauCount: bigint | number;
}

export interface ClaimMillionRewardParams {
  milestoneId: number;
  userContribution: bigint | number;
  millionPlanVault: PublicKey;
  userTokenAccount: PublicKey;
  contributionOracle: PublicKey; // signer
}

export interface RegisterOnboardingParams {
  creator: PublicKey;
  verifiedExternalFollowers: bigint | number;
  /** Optional rising-star grant pda for track-conflict check. */
  risingStarGrantOpt?: PublicKey;
}

export interface ClaimMonthlyUnlockParams {
  activityPassed: boolean;
  activityProofUri: string;
  onboardingVault: PublicKey;
  creatorTokenAccount: PublicKey;
  activityOracle: PublicKey;
}

export interface ForfeitOnboardingParams {
  creator: PublicKey;
  onboardingVault: PublicKey;
  millionPlanVault: PublicKey;
}

export interface RegisterRisingStarParams {
  creator: PublicKey;
  /** Optional onboarding grant pda for track-conflict check. */
  onboardingGrantOpt?: PublicKey;
}

export interface RecordMonthlyFollowersParams {
  creator: PublicKey;
  monthIndex: number; // 0..11
  newFollowers: bigint | number;
}

export interface ClaimRisingStarMonthlyParams {
  monthIndex: number;
  risingStarVault: PublicKey;
  creatorTokenAccount: PublicKey;
}

// ────────────────────────────────────────────────────────────────────────
// On-chain types (deserialised shapes)
// ────────────────────────────────────────────────────────────────────────

export interface LaunchIncentivesStateOnChain {
  address: PublicKey;
  admin: PublicKey;
  oraMint: PublicKey;
  millionPlanRemaining: bigint;
  onboardingRemaining: bigint;
  risingStarRemaining: bigint;
  millionPlanForfeitTopup: bigint;
  bump: number;
}

export interface MilestoneStateOnChain {
  address: PublicKey;
  milestoneId: number;
  dauThreshold: bigint;
  poolSize: bigint;
  totalContributionWeight: bigint;
  triggered: boolean;
  triggeredAt: bigint;
  fullyDistributed: boolean;
  bump: number;
}

export interface OnboardingGrantOnChain {
  address: PublicKey;
  creator: PublicKey;
  externalFollowers: bigint;
  totalAmount: bigint;
  unlockedAmount: bigint;
  remainingAmount: bigint;
  consecutiveMisses: number;
  startAt: bigint;
  lastUnlockAt: bigint;
  status: OnboardingStatus;
  bump: number;
}

export interface RisingStarGrantOnChain {
  address: PublicKey;
  creator: PublicKey;
  startAt: bigint;
  monthsCompleted: number;
  totalClaimed: bigint;
  status: RisingStarStatus;
  bump: number;
}

// ────────────────────────────────────────────────────────────────────────
// Module
// ────────────────────────────────────────────────────────────────────────

export class LaunchIncentivesModule {
  public readonly pdas: LaunchIncentivesPdas;

  constructor(
    private connection: Connection,
    private wallet: WalletAdapter,
    private programId: PublicKey
  ) {
    this.pdas = makePdas(programId);
  }

  // ── reads ─────────────────────────────────────────────────────────────

  async fetchState(): Promise<LaunchIncentivesStateOnChain | null> {
    const acc = await this.connection.getAccountInfo(this.pdas.state);
    if (!acc) return null;
    const buf = acc.data;
    // skip 8-byte discriminator
    let o = 8;
    const admin = new PublicKey(buf.subarray(o, o + 32)); o += 32;
    const oraMint = new PublicKey(buf.subarray(o, o + 32)); o += 32;
    const mp = buf.readBigUInt64LE(o); o += 8;
    const ob = buf.readBigUInt64LE(o); o += 8;
    const rs = buf.readBigUInt64LE(o); o += 8;
    const ft = buf.readBigUInt64LE(o); o += 8;
    const bump = buf.readUInt8(o); o += 1;
    return {
      address: this.pdas.state,
      admin,
      oraMint,
      millionPlanRemaining: mp,
      onboardingRemaining: ob,
      risingStarRemaining: rs,
      millionPlanForfeitTopup: ft,
      bump,
    };
  }

  // ── builders: Million Plan ────────────────────────────────────────────

  buildInitializeLaunchIncentives(params: InitializeLaunchIncentivesParams): TransactionInstruction {
    if (!this.wallet.publicKey) throw new Error('Wallet not connected');
    const data = ixDiscriminator('initialize_launch_incentives');
    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.state, isSigner: false, isWritable: true },
        { pubkey: params.oraMint, isSigner: false, isWritable: false },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
  }

  buildInitializeMilestoneState(params: InitializeMilestoneStateParams): TransactionInstruction {
    if (!this.wallet.publicKey) throw new Error('Wallet not connected');
    const [milestone] = deriveMilestonePda(this.programId, params.milestoneId);
    const data = Buffer.concat([
      ixDiscriminator('initialize_million_plan_state'),
      u8(params.milestoneId),
    ]);
    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.state, isSigner: false, isWritable: false },
        { pubkey: milestone, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
  }

  buildTriggerMilestone(params: TriggerMilestoneParams): TransactionInstruction {
    if (!this.wallet.publicKey) throw new Error('Wallet not connected');
    const [milestone] = deriveMilestonePda(this.programId, params.milestoneId);
    const data = Buffer.concat([
      ixDiscriminator('trigger_milestone'),
      u64LE(params.dauCount),
    ]);
    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.state, isSigner: false, isWritable: false },
        { pubkey: milestone, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
      ],
      data,
    });
  }

  buildClaimMillionReward(params: ClaimMillionRewardParams): TransactionInstruction {
    if (!this.wallet.publicKey) throw new Error('Wallet not connected');
    const user = this.wallet.publicKey;
    const [milestone] = deriveMilestonePda(this.programId, params.milestoneId);
    const [claim] = deriveMillionClaimPda(this.programId, user, params.milestoneId);
    const data = Buffer.concat([
      ixDiscriminator('claim_million_reward'),
      u8(params.milestoneId),
      u64LE(params.userContribution),
    ]);
    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.state, isSigner: false, isWritable: true },
        { pubkey: milestone, isSigner: false, isWritable: true },
        { pubkey: claim, isSigner: false, isWritable: true },
        { pubkey: params.millionPlanVault, isSigner: false, isWritable: true },
        { pubkey: params.userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: params.contributionOracle, isSigner: true, isWritable: false },
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
  }

  // ── builders: Onboarding ──────────────────────────────────────────────

  buildRegisterOnboarding(params: RegisterOnboardingParams): TransactionInstruction {
    if (!this.wallet.publicKey) throw new Error('Wallet not connected');
    const [grant] = deriveOnboardingGrantPda(this.programId, params.creator);
    const data = Buffer.concat([
      ixDiscriminator('register_onboarding'),
      u64LE(params.verifiedExternalFollowers),
    ]);
    const keys = [
      { pubkey: this.pdas.state, isSigner: false, isWritable: true },
      { pubkey: grant, isSigner: false, isWritable: true },
      { pubkey: params.creator, isSigner: false, isWritable: false },
    ];
    if (params.risingStarGrantOpt) {
      keys.push({ pubkey: params.risingStarGrantOpt, isSigner: false, isWritable: false });
    }
    keys.push(
      // oauth_oracle (signer) — for Phase-1 we let wallet sign as admin
      { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
      // admin signer (could be the same wallet)
      { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    );
    return new TransactionInstruction({ programId: this.programId, keys, data });
  }

  buildClaimMonthlyUnlock(params: ClaimMonthlyUnlockParams): TransactionInstruction {
    if (!this.wallet.publicKey) throw new Error('Wallet not connected');
    const creator = this.wallet.publicKey;
    const [grant] = deriveOnboardingGrantPda(this.programId, creator);
    const data = Buffer.concat([
      ixDiscriminator('claim_monthly_unlock'),
      boolByte(params.activityPassed),
      stringBytes(params.activityProofUri),
    ]);
    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.state, isSigner: false, isWritable: false },
        { pubkey: grant, isSigner: false, isWritable: true },
        { pubkey: creator, isSigner: true, isWritable: true },
        { pubkey: params.activityOracle, isSigner: true, isWritable: false },
        { pubkey: params.onboardingVault, isSigner: false, isWritable: true },
        { pubkey: params.creatorTokenAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });
  }

  buildForfeitPending(params: ForfeitOnboardingParams): TransactionInstruction {
    if (!this.wallet.publicKey) throw new Error('Wallet not connected');
    const [grant] = deriveOnboardingGrantPda(this.programId, params.creator);
    const data = ixDiscriminator('forfeit_pending_to_million_plan');
    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.state, isSigner: false, isWritable: true },
        { pubkey: grant, isSigner: false, isWritable: true },
        { pubkey: params.onboardingVault, isSigner: false, isWritable: true },
        { pubkey: params.millionPlanVault, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
      ],
      data,
    });
  }

  // ── builders: Rising Star ─────────────────────────────────────────────

  buildRegisterRisingStar(params: RegisterRisingStarParams): TransactionInstruction {
    if (!this.wallet.publicKey) throw new Error('Wallet not connected');
    const [grant] = deriveRisingStarGrantPda(this.programId, params.creator);
    const data = ixDiscriminator('register_rising_star');
    const keys = [
      { pubkey: this.pdas.state, isSigner: false, isWritable: false },
      { pubkey: grant, isSigner: false, isWritable: true },
      { pubkey: params.creator, isSigner: false, isWritable: false },
    ];
    if (params.onboardingGrantOpt) {
      keys.push({ pubkey: params.onboardingGrantOpt, isSigner: false, isWritable: false });
    }
    keys.push(
      { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    );
    return new TransactionInstruction({ programId: this.programId, keys, data });
  }

  buildRecordMonthlyFollowers(params: RecordMonthlyFollowersParams): TransactionInstruction {
    if (!this.wallet.publicKey) throw new Error('Wallet not connected');
    const [grant] = deriveRisingStarGrantPda(this.programId, params.creator);
    const [month] = deriveRisingStarMonthPda(this.programId, params.creator, params.monthIndex);
    const data = Buffer.concat([
      ixDiscriminator('record_monthly_followers'),
      u8(params.monthIndex),
      u64LE(params.newFollowers),
    ]);
    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.state, isSigner: false, isWritable: false },
        { pubkey: grant, isSigner: false, isWritable: false },
        { pubkey: month, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
  }

  buildClaimRisingStarMonthly(params: ClaimRisingStarMonthlyParams): TransactionInstruction {
    if (!this.wallet.publicKey) throw new Error('Wallet not connected');
    const creator = this.wallet.publicKey;
    const [grant] = deriveRisingStarGrantPda(this.programId, creator);
    const [month] = deriveRisingStarMonthPda(this.programId, creator, params.monthIndex);
    const data = Buffer.concat([
      ixDiscriminator('claim_rising_star_monthly'),
      u8(params.monthIndex),
    ]);
    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.state, isSigner: false, isWritable: true },
        { pubkey: grant, isSigner: false, isWritable: true },
        { pubkey: month, isSigner: false, isWritable: true },
        { pubkey: params.risingStarVault, isSigner: false, isWritable: true },
        { pubkey: params.creatorTokenAccount, isSigner: false, isWritable: true },
        { pubkey: creator, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });
  }

  // ── send helpers ──────────────────────────────────────────────────────

  async sendIx(ix: TransactionInstruction): Promise<TransactionResult> {
    try {
      if (!this.wallet.publicKey) throw new Error('Wallet not connected');
      const tx = new Transaction().add(ix);
      tx.feePayer = this.wallet.publicKey;
      tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
      const sig = await this.wallet.sendTransaction(tx, this.connection);
      await this.connection.confirmTransaction(sig, 'confirmed');
      return { signature: sig, success: true };
    } catch (e) {
      return { signature: '', success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  // ── high-level wrappers ───────────────────────────────────────────────

  initializeLaunchIncentives(p: InitializeLaunchIncentivesParams): Promise<TransactionResult> {
    return this.sendIx(this.buildInitializeLaunchIncentives(p));
  }
  initializeMilestoneState(p: InitializeMilestoneStateParams): Promise<TransactionResult> {
    return this.sendIx(this.buildInitializeMilestoneState(p));
  }
  triggerMilestone(p: TriggerMilestoneParams): Promise<TransactionResult> {
    return this.sendIx(this.buildTriggerMilestone(p));
  }
  claimMillionReward(p: ClaimMillionRewardParams): Promise<TransactionResult> {
    return this.sendIx(this.buildClaimMillionReward(p));
  }
  registerOnboarding(p: RegisterOnboardingParams): Promise<TransactionResult> {
    return this.sendIx(this.buildRegisterOnboarding(p));
  }
  claimMonthlyUnlock(p: ClaimMonthlyUnlockParams): Promise<TransactionResult> {
    return this.sendIx(this.buildClaimMonthlyUnlock(p));
  }
  forfeitPending(p: ForfeitOnboardingParams): Promise<TransactionResult> {
    return this.sendIx(this.buildForfeitPending(p));
  }
  registerRisingStar(p: RegisterRisingStarParams): Promise<TransactionResult> {
    return this.sendIx(this.buildRegisterRisingStar(p));
  }
  recordMonthlyFollowers(p: RecordMonthlyFollowersParams): Promise<TransactionResult> {
    return this.sendIx(this.buildRecordMonthlyFollowers(p));
  }
  claimRisingStarMonthly(p: ClaimRisingStarMonthlyParams): Promise<TransactionResult> {
    return this.sendIx(this.buildClaimRisingStarMonthly(p));
  }
}

// Expose for tests
export const __test = { ixDiscriminator, accountDiscriminator };
