/**
 * CurationModule — Curation pool / time-decayed weighting / reward claims.
 *
 * Wraps `aura_curation` (programs/curation/src/lib.rs):
 *   - initialize_pool
 *   - curate
 *   - deposit_to_pool
 *   - claim_curation_reward       (SOL transfer from reward_vault PDA)
 *   - settle_pool                 (>= 72h after content publication)
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

/** Base weight used in time-decay (matches BASE_WEIGHT in lib.rs). */
export const BASE_WEIGHT = 1_000n;

/** Settlement period in seconds: 72 hours. */
export const SETTLEMENT_PERIOD_SECONDS = 72 * 60 * 60;

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
}

export interface CurateParams {
  contentId: PublicKey;
}

export interface DepositToPoolParams {
  contentId: PublicKey;
  amount: bigint | number;
}

export interface ClaimCurationRewardParams {
  contentId: PublicKey;
}

export interface SettlePoolParams {
  contentId: PublicKey;
}

// ────────────────────────────────────────────────────────────────────────
// On-chain types
// ────────────────────────────────────────────────────────────────────────

export interface CurationRecordOnChain {
  address: PublicKey;
  curator: PublicKey;
  contentId: PublicKey;
  curatedAt: number;
  contentPublishTime: number;
  timeDeltaSeconds: number;
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
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: poolPda, isSigner: false, isWritable: true },
        { pubkey: params.contentId, isSigner: false, isWritable: false },
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('initialize_pool'),
    });
    const res = await this.sendTx([ix]);
    return { ...res, pool: poolPda };
  }

  async curate(params: CurateParams): Promise<TransactionResult & { record?: PublicKey }> {
    const curator = this.requireWallet();
    const recordPda = this.pdas.record(params.contentId, curator);
    const poolPda = this.pdas.pool(params.contentId);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: recordPda, isSigner: false, isWritable: true },
        { pubkey: poolPda, isSigner: false, isWritable: true },
        { pubkey: params.contentId, isSigner: false, isWritable: true },
        { pubkey: curator, isSigner: true, isWritable: true },
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
    const data = Buffer.concat([
      ixDiscriminator('deposit_to_pool'),
      u64LE(BigInt(params.amount)),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: poolPda, isSigner: false, isWritable: true },
        { pubkey: params.contentId, isSigner: false, isWritable: false },
        { pubkey: authority, isSigner: true, isWritable: false },
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

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: recordPda, isSigner: false, isWritable: true },
        { pubkey: poolPda, isSigner: false, isWritable: false },
        { pubkey: params.contentId, isSigner: false, isWritable: false },
        { pubkey: rewardVaultPda, isSigner: false, isWritable: true },
        { pubkey: curator, isSigner: true, isWritable: true },
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

  /** Mirrors calculate_time_decay_weight() in Rust. Returns the weight a
   *  curator earns for discovering content at `timeDeltaSeconds` past publish. */
  static timeDecayWeight(timeDeltaSeconds: number): bigint {
    const HOUR = 60 * 60;
    if (timeDeltaSeconds < HOUR) return BASE_WEIGHT * 10n;          // 10x
    if (timeDeltaSeconds < 6 * HOUR) return BASE_WEIGHT * 5n;       // 5x
    if (timeDeltaSeconds < 24 * HOUR) return BASE_WEIGHT * 2n;      // 2x
    if (timeDeltaSeconds < 72 * HOUR) return BASE_WEIGHT;           // 1x
    return BASE_WEIGHT / 10n;                                       // 0.1x
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
  return {
    address: addr, contentId, contentPublishTime, totalPool, totalWeight,
    curatorsCount, isSettled, bump,
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
  const timeDeltaSeconds = Number(data.readBigInt64LE(o)); o += 8;
  const curationWeight = data.readBigUInt64LE(o); o += 8;
  const rewardClaimed = data.readBigUInt64LE(o); o += 8;
  const bump = data.readUInt8(o); o += 1;
  return {
    address: addr, curator, contentId, curatedAt, contentPublishTime,
    timeDeltaSeconds, curationWeight, rewardClaimed, bump,
  };
}
