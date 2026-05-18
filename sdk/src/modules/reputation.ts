/**
 * ReputationModule — Soulbound creator-reputation badges.
 *
 * Wraps the on-chain `aura_reputation` program (see
 * programs/reputation/src/lib.rs). The SBT is a single PDA per creator,
 * indexed by [b"reputation_sbt", creator.key()]. The SDK uses runtime
 * Anchor discriminators (sha256("global:<name>")[..8]) and hand-rolled
 * Borsh encoding — mirrors `market.ts`.
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

import { TransactionResult, ReputationTier } from '../types';

// ────────────────────────────────────────────────────────────────────────
// Program constants — must match programs/reputation/src/lib.rs
// ────────────────────────────────────────────────────────────────────────

export const REPUTATION_SEEDS = {
  SBT: Buffer.from('reputation_sbt'),
} as const;

/** Mirror of on-chain `enum ReputationTier` discriminant order. */
export const REPUTATION_TIER_ORDER: ReputationTier[] = [
  ReputationTier.Bronze,
  ReputationTier.Silver,
  ReputationTier.Gold,
  ReputationTier.Platinum,
  ReputationTier.Diamond,
];

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

function u32LE(v: number): Buffer { const b = Buffer.alloc(4); b.writeUInt32LE(v, 0); return b; }
function u64LE(v: bigint | number): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(typeof v === 'bigint' ? v : BigInt(v), 0);
  return b;
}

// ────────────────────────────────────────────────────────────────────────
// Public types
// ────────────────────────────────────────────────────────────────────────

export interface ReputationSbtOnChain {
  address: PublicKey;
  creator: PublicKey;
  joinedAt: number;
  totalPosts: number;
  totalEarnings: bigint;
  followers: number;
  curationScore: bigint;
  reputationTier: ReputationTier;
  isTransferable: boolean;
  lastUpdated: number;
  bump: number;
}

export interface UpdateReputationParams {
  /** Creator key (must match the SBT's creator). */
  creator: PublicKey;
  totalPosts: number;
  totalEarnings: bigint | number;
  followers: number;
  curationScore: bigint | number;
}

// ────────────────────────────────────────────────────────────────────────
// ReputationModule
// ────────────────────────────────────────────────────────────────────────

export class ReputationModule {
  constructor(
    private connection: Connection,
    private wallet: WalletAdapter,
    private programId: PublicKey,
  ) {}

  /** PDA: [b"reputation_sbt", creator] */
  sbtPda(creator: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [REPUTATION_SEEDS.SBT, creator.toBuffer()],
      this.programId,
    );
    return pda;
  }

  // ─────────────────────────── reads ─────────────────────────────────────

  async fetch(creator: PublicKey): Promise<ReputationSbtOnChain | null> {
    const addr = this.sbtPda(creator);
    const acc = await this.connection.getAccountInfo(addr);
    if (!acc) return null;
    return parseReputationSbt(addr, acc.data);
  }

  /** Backward-compat alias for the legacy v1 API. Returns null when missing. */
  async get(creator: PublicKey): Promise<ReputationSbtOnChain | null> {
    return this.fetch(creator);
  }

  async hasReputation(creator: PublicKey): Promise<boolean> {
    return (await this.fetch(creator)) !== null;
  }

  // ─────────────────────────── writes ────────────────────────────────────

  /** Mint a fresh SBT for the connected wallet. Idempotent. */
  async mint(): Promise<TransactionResult> {
    const creator = this.requireWallet();
    const sbt = this.sbtPda(creator);
    const existing = await this.connection.getAccountInfo(sbt);
    if (existing) return { signature: '', success: true };

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: sbt, isSigner: false, isWritable: true },
        { pubkey: creator, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('mint_reputation_sbt'),
    });
    return this.sendTx([ix]);
  }

  /** Update metrics; the contract recomputes tier on-chain. */
  async update(params: UpdateReputationParams): Promise<TransactionResult> {
    const authority = this.requireWallet();
    const sbt = this.sbtPda(params.creator);

    const data = Buffer.concat([
      ixDiscriminator('update_reputation'),
      u32LE(params.totalPosts),
      u64LE(BigInt(params.totalEarnings)),
      u32LE(params.followers),
      u64LE(BigInt(params.curationScore)),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: sbt, isSigner: false, isWritable: true },
        { pubkey: params.creator, isSigner: false, isWritable: false },
        { pubkey: authority, isSigner: true, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  // ─────────────────────────── helpers ───────────────────────────────────

  /** Pure client-side preview of the on-chain tier formula. */
  static calculateTier(
    totalPosts: number,
    totalEarnings: bigint | number,
    followers: number,
    curationScore: bigint | number,
  ): ReputationTier {
    const earnings = typeof totalEarnings === 'bigint' ? totalEarnings : BigInt(totalEarnings);
    const curation = typeof curationScore === 'bigint' ? curationScore : BigInt(curationScore);
    const score =
      BigInt(totalPosts) * 10n +
      earnings / 10_000n +
      BigInt(followers) * 5n +
      curation / 100n;
    if (score >= 50_000n) return ReputationTier.Diamond;
    if (score >= 20_000n) return ReputationTier.Platinum;
    if (score >= 5_000n) return ReputationTier.Gold;
    if (score >= 1_000n) return ReputationTier.Silver;
    return ReputationTier.Bronze;
  }

  /** Instance shim retained from legacy API. */
  calculateTier(
    totalPosts: number,
    totalEarnings: number,
    followers: number,
    curationScore: number,
  ): ReputationTier {
    return ReputationModule.calculateTier(totalPosts, totalEarnings, followers, curationScore);
  }

  getTierName(tier: ReputationTier): string {
    switch (tier) {
      case ReputationTier.Bronze: return 'Bronze';
      case ReputationTier.Silver: return 'Silver';
      case ReputationTier.Gold: return 'Gold';
      case ReputationTier.Platinum: return 'Platinum';
      case ReputationTier.Diamond: return 'Diamond';
      default: return 'Unknown';
    }
  }

  // ─────────────────────────── internals ─────────────────────────────────

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
// Account parser
// ────────────────────────────────────────────────────────────────────────

const REPUTATION_SBT_DISC = accountDiscriminator('ReputationSBT');

function parseReputationSbt(addr: PublicKey, data: Buffer): ReputationSbtOnChain {
  if (!data.slice(0, 8).equals(REPUTATION_SBT_DISC)) {
    throw new Error('Account is not a ReputationSBT');
  }
  let o = 8;
  const creator = new PublicKey(data.slice(o, o + 32)); o += 32;
  const joinedAt = Number(data.readBigInt64LE(o)); o += 8;
  const totalPosts = data.readUInt32LE(o); o += 4;
  const totalEarnings = data.readBigUInt64LE(o); o += 8;
  const followers = data.readUInt32LE(o); o += 4;
  const curationScore = data.readBigUInt64LE(o); o += 8;
  const tierByte = data.readUInt8(o); o += 1;
  const reputationTier = REPUTATION_TIER_ORDER[tierByte] ?? ReputationTier.Bronze;
  const isTransferable = data.readUInt8(o) !== 0; o += 1;
  const lastUpdated = Number(data.readBigInt64LE(o)); o += 8;
  const bump = data.readUInt8(o); o += 1;

  return {
    address: addr,
    creator,
    joinedAt,
    totalPosts,
    totalEarnings,
    followers,
    curationScore,
    reputationTier,
    isTransferable,
    lastUpdated,
    bump,
  };
}

/** Exported for tests. */
export const __internals = {
  ixDiscriminator,
  accountDiscriminator,
  parseReputationSbt,
  REPUTATION_SBT_DISC,
};
