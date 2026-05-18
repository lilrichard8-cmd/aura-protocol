/**
 * CurationModule — Handbook §10 two-factor curation (discovery × curator-rank).
 *
 * [whitepaper-sync v1.1]
 *
 * Wraps `aura_curation` (programs/curation/src/lib.rs). The on-chain model
 * was rewritten to match AURA Numbers Handbook §10 / Whitepaper v1.1 §8:
 *   - initialize_pool(creator_follower_count)
 *   - curate                — now also debits 1 ORA cost + checks 100 ORA hold
 *   - deposit_to_pool
 *   - claim_curation_reward (SOL transfer from reward_vault PDA)
 *   - settle_pool           (>= 72h after content publication)
 *
 * All discriminators are real Anchor (sha256("global:<snake_case>")[..8]).
 * The reward_vault PDA seed `[b"reward_vault", content.key().as_ref()]` is
 * also exposed here.
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
import { sha256 } from '@noble/hashes/sha256';

import { TransactionResult } from '../types';

// ────────────────────────────────────────────────────────────────────────
// Constants — must match programs/curation/src/lib.rs
// ────────────────────────────────────────────────────────────────────────

export const CURATION_SEEDS = {
  POOL: Buffer.from('curation_pool'),
  RECORD: Buffer.from('curation_record'),
  REWARD_VAULT: Buffer.from('reward_vault'),
} as const;

/**
 * [whitepaper-sync v1.1] Weight scale factor (replaces the legacy
 * `BASE_WEIGHT = 1000`). All discovery and curator-rank multipliers in
 * the Rust program are stored scaled by this factor so we can keep
 * integer arithmetic and represent fractional multipliers like 1.5×.
 */
export const WEIGHT_SCALE = 100n;

/**
 * [whitepaper-sync v1.1] Legacy alias retained for SDK consumers (and the
 * existing aura-sdk-curation test, which asserts `BASE_WEIGHT === 1000n`).
 * The on-chain semantics changed (no more time-decay 10× / 5× / 2× / 1× /
 * 0.1× tiers) but the literal numeric constant is preserved so older
 * dependents keep compiling. Use `WEIGHT_SCALE` for new code.
 */
export const BASE_WEIGHT = 1_000n;

/** Settlement period in seconds: 72 hours. */
export const SETTLEMENT_PERIOD_SECONDS = 72 * 60 * 60;

/** [whitepaper-sync v1.1] Per-curation cost (1 ORA, 9 decimals). */
export const PER_CURATION_COST_RAW = 1_000_000_000n;

/** [whitepaper-sync v1.1] Sybil holding floor (100 ORA, 9 decimals). */
export const MIN_CURATOR_HOLDING_RAW = 100n * 1_000_000_000n;

/** [whitepaper-sync v1.1] Daily reward-pool sizes for off-chain settlement. */
export const CURATOR_DAILY_POOL_ORA = 10_000n * 1_000_000_000n;
export const CREATOR_DAILY_POOL_ORA = 10_000n * 1_000_000_000n;

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

function u64LE(v: bigint | number): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(typeof v === 'bigint' ? v : BigInt(v), 0);
  return b;
}

// ────────────────────────────────────────────────────────────────────────
// PDA helpers
// ────────────────────────────────────────────────────────────────────────

export interface CurationPdas {
  pool(content: PublicKey): PublicKey;
  record(content: PublicKey, curator: PublicKey): PublicKey;
  rewardVault(content: PublicKey): PublicKey;
}

function makePdas(programId: PublicKey): CurationPdas {
  return {
    pool(content) {
      const [pda] = PublicKey.findProgramAddressSync(
        [CURATION_SEEDS.POOL, content.toBuffer()],
        programId
      );
      return pda;
    },
    record(content, curator) {
      const [pda] = PublicKey.findProgramAddressSync(
        [CURATION_SEEDS.RECORD, content.toBuffer(), curator.toBuffer()],
        programId
      );
      return pda;
    },
    rewardVault(content) {
      const [pda] = PublicKey.findProgramAddressSync(
        [CURATION_SEEDS.REWARD_VAULT, content.toBuffer()],
        programId
      );
      return pda;
    },
  };
}

// ────────────────────────────────────────────────────────────────────────
// Public params
// ────────────────────────────────────────────────────────────────────────

export interface InitializeCurationPoolParams {
  contentId: PublicKey;
  /** [whitepaper-sync v1.1] Required: creator follower count at pool init. */
  creatorFollowerCount: bigint | number;
  /** [audit fix M-CR-1] ORA mint (must equal hardcoded ORA_MINT constant). */
  oraMint: PublicKey;
}

export interface CurateParams {
  contentId: PublicKey;
  /** [whitepaper-sync v1.1] Curator's ORA ATA (holds >= 100 ORA, debited 1 ORA). */
  curatorOraAccount: PublicKey;
  /** [whitepaper-sync v1.1] Protocol curation-fee sink (CURATION_FEE_SINK const). */
  curationFeeSink: PublicKey;
  /** SPL Token program id. Defaults to TOKEN_PROGRAM_ID. */
  tokenProgram?: PublicKey;
}

export interface DepositToPoolParams {
  contentId: PublicKey;
  amount: bigint | number;
  /** [audit fix M-CR-1] Depositor's ORA token account. */
  depositorOraAccount: PublicKey;
  /** [audit fix M-CR-1] ORA mint (must equal hardcoded ORA_MINT constant). */
  oraMint: PublicKey;
}

export interface ClaimCurationRewardParams {
  contentId: PublicKey;
  /** [audit fix M-CR-1] Curator's ORA destination token account. */
  curatorOraAccount: PublicKey;
  /** [audit fix M-CR-1] ORA mint (must equal hardcoded ORA_MINT constant). */
  oraMint: PublicKey;
}

export interface SettlePoolParams {
  contentId: PublicKey;
}

// SPL Token program id constant (avoid importing @solana/spl-token here).
const SPL_TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
);

// ────────────────────────────────────────────────────────────────────────
// On-chain types
// ────────────────────────────────────────────────────────────────────────

export interface CurationRecordOnChain {
  address: PublicKey;
  curator: PublicKey;
  contentId: PublicKey;
  curatedAt: number;
  contentPublishTime: number;
  /** [whitepaper-sync v1.1] 1-indexed rank in pool's curation order. */
  curatorRank: number;
  curationWeight: bigint;
  rewardClaimed: bigint;
  bump: number;
}

export interface CurationPoolOnChain {
  address: PublicKey;
  contentId: PublicKey;
  contentPublishTime: number;
  totalPool: bigint;
  totalWeight: bigint;
  curatorsCount: number;
  isSettled: boolean;
  bump: number;
  settleTotalPool: bigint;
  /** [whitepaper-sync v1.1] frozen at init from initialize_pool argument. */
  creatorFollowerCount: bigint;
  /** [whitepaper-sync v1.1] cached `core::Post.author`. */
  creatorAuthor: PublicKey;
}

// ────────────────────────────────────────────────────────────────────────
// CurationModule
// ────────────────────────────────────────────────────────────────────────

export class CurationModule {
  public readonly pdas: CurationPdas;

  constructor(
    private connection: Connection,
    private wallet: WalletAdapter,
    private programId: PublicKey
  ) {
    this.pdas = makePdas(programId);
  }

  // ── reads ─────────────────────────────────────────────────────────────

  async fetchPool(contentId: PublicKey): Promise<CurationPoolOnChain | null> {
    const addr = this.pdas.pool(contentId);
    const acc = await this.connection.getAccountInfo(addr);
    if (!acc) return null;
    return parseCurationPool(addr, acc.data);
  }

  async fetchRecord(contentId: PublicKey, curator: PublicKey): Promise<CurationRecordOnChain | null> {
    const addr = this.pdas.record(contentId, curator);
    const acc = await this.connection.getAccountInfo(addr);
    if (!acc) return null;
    return parseCurationRecord(addr, acc.data);
  }

  // ── writes ────────────────────────────────────────────────────────────

  async initializePool(params: InitializeCurationPoolParams): Promise<TransactionResult & { pool?: PublicKey }> {
    const authority = this.requireWallet();
    const poolPda = this.pdas.pool(params.contentId);
    const rewardVaultPda = this.pdas.rewardVault(params.contentId);
    const data = Buffer.concat([
      ixDiscriminator('initialize_pool'),
      u64LE(BigInt(params.creatorFollowerCount)),
    ]);
    // [audit fix M-CR-1] Anchor account order: curation_pool, content,
    // reward_vault, ora_mint, authority, token_program, rent, system_program.
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: poolPda, isSigner: false, isWritable: true },
        { pubkey: params.contentId, isSigner: false, isWritable: false },
        { pubkey: rewardVaultPda, isSigner: false, isWritable: true },
        { pubkey: params.oraMint, isSigner: false, isWritable: false },
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: SPL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    const res = await this.sendTx([ix]);
    return { ...res, pool: poolPda };
  }

  async curate(params: CurateParams): Promise<TransactionResult & { record?: PublicKey }> {
    const curator = this.requireWallet();
    const recordPda = this.pdas.record(params.contentId, curator);
    const poolPda = this.pdas.pool(params.contentId);
    const tokenProgram = params.tokenProgram ?? SPL_TOKEN_PROGRAM_ID;
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: recordPda, isSigner: false, isWritable: true },
        { pubkey: poolPda, isSigner: false, isWritable: true },
        { pubkey: params.contentId, isSigner: false, isWritable: false },
        { pubkey: curator, isSigner: true, isWritable: true },
        { pubkey: params.curatorOraAccount, isSigner: false, isWritable: true },
        { pubkey: params.curationFeeSink, isSigner: false, isWritable: true },
        { pubkey: tokenProgram, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('curate'),
    });
    const res = await this.sendTx([ix]);
    return { ...res, record: recordPda };
  }

  async depositToPool(params: DepositToPoolParams): Promise<TransactionResult> {
    const authority = this.requireWallet();
    const poolPda = this.pdas.pool(params.contentId);
    const rewardVaultPda = this.pdas.rewardVault(params.contentId);
    const data = Buffer.concat([
      ixDiscriminator('deposit_to_pool'),
      u64LE(BigInt(params.amount)),
    ]);
    // [audit fix M-CR-1] Anchor account order: curation_pool, content,
    // reward_vault, depositor_ora_account, ora_mint, depositor,
    // token_program, system_program.
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: poolPda, isSigner: false, isWritable: true },
        { pubkey: params.contentId, isSigner: false, isWritable: false },
        { pubkey: rewardVaultPda, isSigner: false, isWritable: true },
        { pubkey: params.depositorOraAccount, isSigner: false, isWritable: true },
        { pubkey: params.oraMint, isSigner: false, isWritable: false },
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: SPL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async claimCurationReward(params: ClaimCurationRewardParams): Promise<TransactionResult> {
    const curator = this.requireWallet();
    const recordPda = this.pdas.record(params.contentId, curator);
    const poolPda = this.pdas.pool(params.contentId);
    const rewardVaultPda = this.pdas.rewardVault(params.contentId);

    // [audit fix M-CR-1] Anchor account order: curation_record, curation_pool,
    // content, reward_vault, curator_ora_account, ora_mint, curator, token_program.
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: recordPda, isSigner: false, isWritable: true },
        { pubkey: poolPda, isSigner: false, isWritable: true },
        { pubkey: params.contentId, isSigner: false, isWritable: false },
        { pubkey: rewardVaultPda, isSigner: false, isWritable: true },
        { pubkey: params.curatorOraAccount, isSigner: false, isWritable: true },
        { pubkey: params.oraMint, isSigner: false, isWritable: false },
        { pubkey: curator, isSigner: true, isWritable: true },
        { pubkey: SPL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('claim_curation_reward'),
    });
    return this.sendTx([ix]);
  }

  async settlePool(params: SettlePoolParams): Promise<TransactionResult> {
    const authority = this.requireWallet();
    const poolPda = this.pdas.pool(params.contentId);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: poolPda, isSigner: false, isWritable: true },
        { pubkey: params.contentId, isSigner: false, isWritable: false },
        { pubkey: authority, isSigner: true, isWritable: false },
      ],
      data: ixDiscriminator('settle_pool'),
    });
    return this.sendTx([ix]);
  }

  // ── pure helpers ──────────────────────────────────────────────────────

  /**
   * [whitepaper-sync v1.1] Handbook §10 Discovery Weight by creator follower
   * count. Returned scaled by WEIGHT_SCALE = 100.
   *   <100         → 500  (5.0×)
   *   100–1,000    → 300  (3.0×)
   *   1K–10K       → 150  (1.5×)
   *   10K–100K     → 100  (1.0×)
   *   >100K        → 50   (0.5×)
   */
  static discoveryWeight(followerCount: bigint | number): bigint {
    const fc = typeof followerCount === 'bigint' ? followerCount : BigInt(followerCount);
    if (fc < 100n) return 500n;
    if (fc < 1_000n) return 300n;
    if (fc < 10_000n) return 150n;
    if (fc < 100_000n) return 100n;
    return 50n;
  }

  /**
   * [whitepaper-sync v1.1] Handbook §10 Curator Rank Weight by order of
   * curation (1-indexed). Returned scaled by WEIGHT_SCALE = 100.
   *   1st: 5.0× / 2nd: 4.5× / 3rd: 4.2× / ... / 10th: 3.0×
   *   11–50:   2.0× / 51–200: 1.5× / 201–500: 1.2× / 501+: 0.5×
   */
  static curatorRankWeight(rank: number): bigint {
    if (rank === 1) return 500n;
    if (rank === 2) return 450n;
    if (rank === 3) return 420n;
    if (rank === 4) return 400n;
    if (rank === 5) return 380n;
    if (rank === 6) return 360n;
    if (rank === 7) return 340n;
    if (rank === 8) return 320n;
    if (rank === 9) return 310n;
    if (rank === 10) return 300n;
    if (rank <= 50) return 200n;
    if (rank <= 200) return 150n;
    if (rank <= 500) return 120n;
    return 50n;
  }

  /**
   * [whitepaper-sync v1.1] Curation Score = discovery × rank (scaled).
   * Returns weight in WEIGHT_SCALE units (i.e. weight = 100 means 1.0×).
   */
  static curationWeight(followerCount: bigint | number, rank: number): bigint {
    const d = CurationModule.discoveryWeight(followerCount);
    const r = CurationModule.curatorRankWeight(rank);
    return (d * r) / WEIGHT_SCALE;
  }

  /** Compute the share of pool a curator would receive given (weight, pool stats). */
  static computeReward(curatorWeight: bigint, totalWeight: bigint, totalPool: bigint): bigint {
    if (totalWeight === 0n || totalPool === 0n) return 0n;
    return (curatorWeight * totalPool) / totalWeight;
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

const CURATION_POOL_DISC = accountDiscriminator('CurationPool');
const CURATION_RECORD_DISC = accountDiscriminator('CurationRecord');

function parseCurationPool(addr: PublicKey, data: Buffer): CurationPoolOnChain {
  if (!data.slice(0, 8).equals(CURATION_POOL_DISC)) {
    throw new Error('Account is not a CurationPool');
  }
  let o = 8;
  const contentId = new PublicKey(data.slice(o, o + 32)); o += 32;
  const contentPublishTime = Number(data.readBigInt64LE(o)); o += 8;
  const totalPool = data.readBigUInt64LE(o); o += 8;
  const totalWeight = data.readBigUInt64LE(o); o += 8;
  const curatorsCount = data.readUInt32LE(o); o += 4;
  const isSettled = data.readUInt8(o) === 1; o += 1;
  const bump = data.readUInt8(o); o += 1;
  const settleTotalPool = data.readBigUInt64LE(o); o += 8;
  // [whitepaper-sync v1.1] new fields
  const creatorFollowerCount = data.readBigUInt64LE(o); o += 8;
  const creatorAuthor = new PublicKey(data.slice(o, o + 32)); o += 32;
  return {
    address: addr, contentId, contentPublishTime, totalPool, totalWeight,
    curatorsCount, isSettled, bump, settleTotalPool,
    creatorFollowerCount, creatorAuthor,
  };
}

function parseCurationRecord(addr: PublicKey, data: Buffer): CurationRecordOnChain {
  if (!data.slice(0, 8).equals(CURATION_RECORD_DISC)) {
    throw new Error('Account is not a CurationRecord');
  }
  let o = 8;
  const curator = new PublicKey(data.slice(o, o + 32)); o += 32;
  const contentId = new PublicKey(data.slice(o, o + 32)); o += 32;
  const curatedAt = Number(data.readBigInt64LE(o)); o += 8;
  const contentPublishTime = Number(data.readBigInt64LE(o)); o += 8;
  // [whitepaper-sync v1.1] u32 curator_rank replaced the old i64 time_delta_seconds
  const curatorRank = data.readUInt32LE(o); o += 4;
  const curationWeight = data.readBigUInt64LE(o); o += 8;
  const rewardClaimed = data.readBigUInt64LE(o); o += 8;
  const bump = data.readUInt8(o); o += 1;
  return {
    address: addr, curator, contentId, curatedAt, contentPublishTime,
    curatorRank, curationWeight, rewardClaimed, bump,
  };
}
