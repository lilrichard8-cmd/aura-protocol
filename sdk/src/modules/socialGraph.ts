/**
 * SocialGraphModule — Portable follow-graph NFTs.
 *
 * Wraps `aura_social_graph` (programs/social-graph/src/lib.rs). The follow
 * graph lives in a per-user PDA seeded by [b"social_graph", owner]. Reallocs
 * happen on-chain via Anchor's `realloc`, so the SDK just sends the
 * instructions with the wallet as payer.
 *
 * NOTE: as of this SDK build, the Rust program has a known compile issue
 * around the Bumps trait on `FollowCreator` / `UnfollowCreator`. The wrapper
 * is written against the Rust source as-is and will become live once that's
 * fixed upstream.
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
// Constants — must match programs/social-graph/src/lib.rs
// ────────────────────────────────────────────────────────────────────────

export const SOCIAL_GRAPH_SEEDS = {
  GRAPH: Buffer.from('social_graph'),
} as const;

export const SOCIAL_GRAPH_LIMITS = {
  MAX_FOLLOWING: 1000,
  GRAPH_URI_MAX: 200,
} as const;

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
function u32LE(v: number): Buffer { const b = Buffer.alloc(4); b.writeUInt32LE(v, 0); return b; }
function bool(v: boolean): Buffer { return u8(v ? 1 : 0); }
function borshString(s: string): Buffer {
  const utf8 = Buffer.from(s, 'utf8');
  return Buffer.concat([u32LE(utf8.length), utf8]);
}
function pubkeyBytes(pk: PublicKey): Buffer { return Buffer.from(pk.toBytes()); }

// ────────────────────────────────────────────────────────────────────────
// Public types
// ────────────────────────────────────────────────────────────────────────

export interface SocialGraphOnChain {
  address: PublicKey;
  owner: PublicKey;
  following: PublicKey[];
  followersCount: number;
  graphUri: string;
  portable: boolean;
  createdAt: number;
  bump: number;
}

export interface InitializeSocialGraphParams {
  graphUri: string;
  portable: boolean;
}

// ────────────────────────────────────────────────────────────────────────
// SocialGraphModule
// ────────────────────────────────────────────────────────────────────────

export class SocialGraphModule {
  constructor(
    private connection: Connection,
    private wallet: WalletAdapter,
    private programId: PublicKey,
  ) {}

  graphPda(owner: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [SOCIAL_GRAPH_SEEDS.GRAPH, owner.toBuffer()],
      this.programId,
    );
    return pda;
  }

  // ─────────────────────────── reads ─────────────────────────────────────

  async fetch(owner: PublicKey): Promise<SocialGraphOnChain | null> {
    const addr = this.graphPda(owner);
    const acc = await this.connection.getAccountInfo(addr);
    if (!acc) return null;
    return parseSocialGraph(addr, acc.data);
  }

  async isFollowing(owner: PublicKey, target: PublicKey): Promise<boolean> {
    const g = await this.fetch(owner);
    if (!g) return false;
    return g.following.some((k) => k.equals(target));
  }

  // ─────────────────────────── writes ────────────────────────────────────

  async initialize(params: InitializeSocialGraphParams): Promise<TransactionResult> {
    const owner = this.requireWallet();
    if (params.graphUri.length > SOCIAL_GRAPH_LIMITS.GRAPH_URI_MAX) {
      return errRes(`graphUri exceeds ${SOCIAL_GRAPH_LIMITS.GRAPH_URI_MAX} chars`);
    }
    const graph = this.graphPda(owner);
    const data = Buffer.concat([
      ixDiscriminator('initialize_social_graph'),
      borshString(params.graphUri),
      bool(params.portable),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: graph, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async follow(creator: PublicKey): Promise<TransactionResult> {
    const owner = this.requireWallet();
    const ownGraph = this.graphPda(owner);
    const targetGraph = this.graphPda(creator);
    const data = Buffer.concat([
      ixDiscriminator('follow_creator'),
      pubkeyBytes(creator),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: ownGraph, isSigner: false, isWritable: true },
        { pubkey: targetGraph, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async unfollow(creator: PublicKey): Promise<TransactionResult> {
    const owner = this.requireWallet();
    const ownGraph = this.graphPda(owner);
    const targetGraph = this.graphPda(creator);
    const data = Buffer.concat([
      ixDiscriminator('unfollow_creator'),
      pubkeyBytes(creator),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: ownGraph, isSigner: false, isWritable: true },
        { pubkey: targetGraph, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async updateGraphUri(newUri: string): Promise<TransactionResult> {
    const owner = this.requireWallet();
    if (newUri.length > SOCIAL_GRAPH_LIMITS.GRAPH_URI_MAX) {
      return errRes(`graphUri exceeds ${SOCIAL_GRAPH_LIMITS.GRAPH_URI_MAX} chars`);
    }
    const graph = this.graphPda(owner);
    const data = Buffer.concat([
      ixDiscriminator('update_graph_uri'),
      borshString(newUri),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: graph, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async togglePortable(): Promise<TransactionResult> {
    const owner = this.requireWallet();
    const graph = this.graphPda(owner);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: graph, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: false },
      ],
      data: ixDiscriminator('toggle_portable'),
    });
    return this.sendTx([ix]);
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
// Parser
// ────────────────────────────────────────────────────────────────────────

const SOCIAL_GRAPH_DISC = accountDiscriminator('SocialGraphNFT');

function parseSocialGraph(addr: PublicKey, data: Buffer): SocialGraphOnChain {
  if (!data.slice(0, 8).equals(SOCIAL_GRAPH_DISC)) {
    throw new Error('Account is not a SocialGraphNFT');
  }
  let o = 8;
  const owner = new PublicKey(data.slice(o, o + 32)); o += 32;
  const followingLen = data.readUInt32LE(o); o += 4;
  const following: PublicKey[] = [];
  for (let i = 0; i < followingLen; i++) {
    following.push(new PublicKey(data.slice(o, o + 32)));
    o += 32;
  }
  const followersCount = data.readUInt32LE(o); o += 4;
  const uriLen = data.readUInt32LE(o); o += 4;
  const graphUri = data.slice(o, o + uriLen).toString('utf8'); o += uriLen;
  const portable = data.readUInt8(o) !== 0; o += 1;
  const createdAt = Number(data.readBigInt64LE(o)); o += 8;
  const bump = data.readUInt8(o); o += 1;

  return {
    address: addr,
    owner,
    following,
    followersCount,
    graphUri,
    portable,
    createdAt,
    bump,
  };
}

function errRes(msg: string): TransactionResult {
  return { signature: '', success: false, error: msg };
}

export const __internals = {
  ixDiscriminator,
  accountDiscriminator,
  parseSocialGraph,
  SOCIAL_GRAPH_DISC,
};
