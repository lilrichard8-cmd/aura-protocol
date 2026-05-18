/**
 * RewardsModule — Creation/Curation reward emission.
 *
 * Wraps the `aura_rewards` program (programs/rewards/src/lib.rs):
 *   - initialize_rewards
 *   - distribute_creation_reward    (Model C formula, 5 content tiers)
 *   - distribute_curation_reward    (curation_weight / pool_total_weight)
 *   - transition_phase              (Phase1 100:0 → Phase2 70:30 → Phase3 50:50)
 *   - update_mau
 *
 * [audit fix C4.M-1 option-C] The rewards program ALSO owns the ORA mint
 * authority. Three additional instructions exist on-chain but are CPI-only
 * (callable only from `aura_ora`); the SDK intentionally does not expose them:
 *   - mint_for_ora(amount, purpose)         CPI target for ora::mint_ora /
 *                                            ora::distribute_reward
 *   - mint_for_growth(amount)                CPI target for ora::mau_growth_mint
 *   - mint_for_initial_supply(amount)        CPI target for ora::mint_initial_supply
 * Use the OraModule entry points instead; they CPI into rewards under the
 * hood. The accounts-side gate requires the caller's signer to be the ora
 * program's `ora_config` PDA, so an external SDK call cannot invoke these.
 *
 * Real Anchor discriminators (sha256("global:<name>")[..8]).
 *
 * Triple-Burn mechanism #1: 10% of each reward is burned automatically
 * (see INCENTIVE_TAX_BPS). The SDK exposes a helper `computeCreationReward`
 * that mirrors the Rust formula so the frontend can preview pre-burn rewards.
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
// Constants — must match programs/rewards/src/lib.rs
// ────────────────────────────────────────────────────────────────────────

export const REWARDS_SEEDS = {
  STATE: Buffer.from('reward_state'),
} as const;

/** Total community incentive pool: 500M ORA (9 decimals). */
export const TOTAL_INCENTIVE_POOL: bigint = 500_000_000n * 1_000_000_000n;

/** Incentive tax (burn) — 10%. */
export const INCENTIVE_TAX_BPS = 1_000;

/** MAU threshold where base reward steps from 2 → 1 ORA. */
export const MAU_THRESHOLD = 500_000n;

export enum ContentTier {
  Basic = 0,         // 1.0x
  Standard = 1,      // 1.5x
  Premium = 2,       // 2.0x
  Professional = 3,  // 3.0x
  Exceptional = 4,   // 5.0x
}

export const CONTENT_TIER_MULTIPLIER: Record<ContentTier, number> = {
  [ContentTier.Basic]: 100,
  [ContentTier.Standard]: 150,
  [ContentTier.Premium]: 200,
  [ContentTier.Professional]: 300,
  [ContentTier.Exceptional]: 500,
};

export enum RewardPhase {
  Phase1Creation100 = 0,
  Phase2Split70_30 = 1,
  Phase3Split50_50 = 2,
}

export const PHASE_RATIO_BPS: Record<RewardPhase, { creation: number; curation: number }> = {
  [RewardPhase.Phase1Creation100]: { creation: 10_000, curation: 0 },
  [RewardPhase.Phase2Split70_30]:  { creation: 7_000,  curation: 3_000 },
  [RewardPhase.Phase3Split50_50]:  { creation: 5_000,  curation: 5_000 },
};

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

// ────────────────────────────────────────────────────────────────────────
// PDA helpers
// ────────────────────────────────────────────────────────────────────────

export interface RewardsPdas {
  state: PublicKey;
}

function makePdas(programId: PublicKey): RewardsPdas {
  const [state] = PublicKey.findProgramAddressSync([REWARDS_SEEDS.STATE], programId);
  return { state };
}

// ────────────────────────────────────────────────────────────────────────
// Public params
// ────────────────────────────────────────────────────────────────────────

export interface InitializeRewardsParams {
  oraMint: PublicKey;
}

export interface DistributeCreationRewardParams {
  contentTier: ContentTier;
  oraMint: PublicKey;
  creatorTokenAccount: PublicKey;
}

export interface DistributeCurationRewardParams {
  curationWeight: bigint | number;
  poolTotalWeight: bigint | number;
  poolRewardAmount: bigint | number;
  oraMint: PublicKey;
  curatorTokenAccount: PublicKey;
}

export interface TransitionPhaseParams {
  newPhase: RewardPhase;
}

export interface UpdateMauParams {
  newMau: bigint | number;
}

// ────────────────────────────────────────────────────────────────────────
// On-chain types
// ────────────────────────────────────────────────────────────────────────

export interface RewardStateOnChain {
  address: PublicKey;
  authority: PublicKey;
  oraMint: PublicKey;
  totalDistributed: bigint;
  totalBurned: bigint;
  currentMau: bigint;
  phase: RewardPhase;
  creationRatioBps: number;
  curationRatioBps: number;
  bump: number;
}

// ────────────────────────────────────────────────────────────────────────
// RewardsModule
// ────────────────────────────────────────────────────────────────────────

export class RewardsModule {
  public readonly pdas: RewardsPdas;

  constructor(
    private connection: Connection,
    private wallet: WalletAdapter,
    private programId: PublicKey
  ) {
    this.pdas = makePdas(programId);
  }

  // ── reads ─────────────────────────────────────────────────────────────

  async fetchState(): Promise<RewardStateOnChain | null> {
    const acc = await this.connection.getAccountInfo(this.pdas.state);
    if (!acc) return null;
    return parseRewardState(this.pdas.state, acc.data);
  }

  // ── writes ────────────────────────────────────────────────────────────

  async initializeRewards(params: InitializeRewardsParams): Promise<TransactionResult> {
    const authority = this.requireWallet();
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.state, isSigner: false, isWritable: true },
        { pubkey: params.oraMint, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('initialize_rewards'),
    });
    return this.sendTx([ix]);
  }

  async distributeCreationReward(params: DistributeCreationRewardParams): Promise<TransactionResult> {
    const authority = this.requireWallet();
    const data = Buffer.concat([
      ixDiscriminator('distribute_creation_reward'),
      u8(params.contentTier),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.state, isSigner: false, isWritable: true },
        { pubkey: params.oraMint, isSigner: false, isWritable: true },
        { pubkey: params.creatorTokenAccount, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async distributeCurationReward(params: DistributeCurationRewardParams): Promise<TransactionResult> {
    const authority = this.requireWallet();
    const data = Buffer.concat([
      ixDiscriminator('distribute_curation_reward'),
      u64LE(BigInt(params.curationWeight)),
      u64LE(BigInt(params.poolTotalWeight)),
      u64LE(BigInt(params.poolRewardAmount)),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.state, isSigner: false, isWritable: true },
        { pubkey: params.oraMint, isSigner: false, isWritable: true },
        { pubkey: params.curatorTokenAccount, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async transitionPhase(params: TransitionPhaseParams): Promise<TransactionResult> {
    const authority = this.requireWallet();
    const data = Buffer.concat([
      ixDiscriminator('transition_phase'),
      u8(params.newPhase),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.state, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async updateMau(params: UpdateMauParams): Promise<TransactionResult> {
    const authority = this.requireWallet();
    const data = Buffer.concat([
      ixDiscriminator('update_mau'),
      u64LE(BigInt(params.newMau)),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.state, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  // ── pure helpers (mirror on-chain formulas) ──────────────────────────

  /**
   * Compute the gross creation reward in raw ORA units (9 decimals) that a
   * creator would receive *before* phase ratio and the 10% burn tax.
   *
   * Formula (matches programs/rewards/src/lib.rs):
   *   base       = (mau < 500_000) ? 2 : 1      (in whole ORA)
   *   decay      = (18 * 1e9 * 50_000) / (50_000 + mau)
   *   baseReward = base * 1e9 + decay           (raw units)
   *   raw        = baseReward * tier_multiplier / 100
   */
  static computeRawCreationReward(mau: bigint, tier: ContentTier): bigint {
    const base = mau < MAU_THRESHOLD ? 2n : 1n;
    const decay = (18n * 1_000_000_000n * 50_000n) / (50_000n + mau);
    const baseReward = base * 1_000_000_000n + decay;
    const mult = BigInt(CONTENT_TIER_MULTIPLIER[tier]);
    return (baseReward * mult) / 100n;
  }

  /** Apply phase ratio to a raw reward. */
  static applyPhaseCreation(raw: bigint, phase: RewardPhase): bigint {
    const bps = BigInt(PHASE_RATIO_BPS[phase].creation);
    return (raw * bps) / 10_000n;
  }

  /** Compute the 10% burn portion. */
  static burnPortion(phaseAdjusted: bigint): bigint {
    return (phaseAdjusted * BigInt(INCENTIVE_TAX_BPS)) / 10_000n;
  }

  /** Net (post-burn) reward delivered to creator wallet. */
  static netCreationReward(mau: bigint, tier: ContentTier, phase: RewardPhase): bigint {
    const raw = RewardsModule.computeRawCreationReward(mau, tier);
    const phased = RewardsModule.applyPhaseCreation(raw, phase);
    const burn = RewardsModule.burnPortion(phased);
    return phased - burn;
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
// Parsers
// ────────────────────────────────────────────────────────────────────────

const REWARD_STATE_DISC = accountDiscriminator('RewardState');

function parseRewardState(addr: PublicKey, data: Buffer): RewardStateOnChain {
  if (!data.slice(0, 8).equals(REWARD_STATE_DISC)) {
    throw new Error('Account is not a RewardState');
  }
  let o = 8;
  const authority = new PublicKey(data.slice(o, o + 32)); o += 32;
  const oraMint = new PublicKey(data.slice(o, o + 32)); o += 32;
  const totalDistributed = data.readBigUInt64LE(o); o += 8;
  const totalBurned = data.readBigUInt64LE(o); o += 8;
  const currentMau = data.readBigUInt64LE(o); o += 8;
  const phaseByte = data.readUInt8(o); o += 1;
  const creationRatioBps = data.readUInt16LE(o); o += 2;
  const curationRatioBps = data.readUInt16LE(o); o += 2;
  const bump = data.readUInt8(o); o += 1;
  return {
    address: addr, authority, oraMint, totalDistributed, totalBurned,
    currentMau, phase: phaseByte as RewardPhase, creationRatioBps,
    curationRatioBps, bump,
  };
}
