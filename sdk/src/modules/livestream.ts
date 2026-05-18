/**
 * LivestreamModule — Tipping, subs, PPV, large-tip boosts.
 *
 * Wraps `aura_livestream` (programs/livestream/src/lib.rs). All money flows
 * are in ORA (6 decimals on-chain). Fee split: 2.5% burn + 2% staking +
 * 0.5% platform = 5% total on tips; 5% flat platform fee on subs and PPV.
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
// Constants — must match programs/livestream/src/lib.rs
// ────────────────────────────────────────────────────────────────────────

export const LIVESTREAM_SEEDS = {
  STREAM: Buffer.from('stream'),
  TIP: Buffer.from('tip'),
  SUBSCRIPTION: Buffer.from('subscription'),
  PPV: Buffer.from('ppv'),
  PPV_ACCESS: Buffer.from('ppv_access'),
  TIP_BOOST: Buffer.from('tip_boost'),
} as const;

export const LIVESTREAM_FEE_BPS = {
  BURN: 250,
  STAKING: 200,
  PLATFORM: 50,
  TOTAL: 500,
} as const;

export const LIVESTREAM_LIMITS = {
  TITLE_MAX: 128,
  /** 100 ORA at 6 decimals = 100_000_000 lamports. */
  LARGE_TIP_THRESHOLD: 100_000_000n,
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
function u16LE(v: number): Buffer { const b = Buffer.alloc(2); b.writeUInt16LE(v, 0); return b; }
function u32LE(v: number): Buffer { const b = Buffer.alloc(4); b.writeUInt32LE(v, 0); return b; }
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
function bool(v: boolean): Buffer { return u8(v ? 1 : 0); }
function borshString(s: string): Buffer {
  const utf8 = Buffer.from(s, 'utf8');
  return Buffer.concat([u32LE(utf8.length), utf8]);
}

// ────────────────────────────────────────────────────────────────────────
// Public types
// ────────────────────────────────────────────────────────────────────────

export interface LiveStreamOnChain {
  address: PublicKey;
  creator: PublicKey;
  streamId: bigint;
  title: string;
  startTime: number;
  endTime: number;
  isLive: boolean;
  peakViewers: bigint;
  totalTips: bigint;
  totalSubscriptions: bigint;
  bump: number;
}

export interface TipRecordOnChain {
  address: PublicKey;
  fan: PublicKey;
  creator: PublicKey;
  amount: bigint;
  timestamp: number;
  isLargeTip: boolean;
  bump: number;
}

export interface SubscriptionOnChain {
  address: PublicKey;
  fan: PublicKey;
  creator: PublicKey;
  monthlyAmount: bigint;
  startedAt: number;
  expiresAt: number;
  isActive: boolean;
  bump: number;
}

export interface PpvEventOnChain {
  address: PublicKey;
  creator: PublicKey;
  ppvId: bigint;
  title: string;
  price: bigint;
  totalPurchases: bigint;
  totalRevenue: bigint;
  isActive: boolean;
  createdAt: number;
  bump: number;
}

export interface PpvAccessOnChain {
  address: PublicKey;
  fan: PublicKey;
  ppvEvent: PublicKey;
  purchasedAt: number;
  bump: number;
}

export interface TipBoostOnChain {
  address: PublicKey;
  fan: PublicKey;
  creator: PublicKey;
  tipAmount: bigint;
  boostMultiplier: number;
  timestamp: number;
  bump: number;
}

export interface StartStreamParams {
  title: string;
  streamId: bigint | number;
}
export interface EndStreamParams {
  streamId: bigint | number;
  peakViewers: bigint | number;
}
export interface TipStreamerParams {
  stream: PublicKey;
  streamCreator: PublicKey;
  streamId: bigint | number;
  amount: bigint | number;
  tipNonce: bigint | number;
  fanTokenAccount: PublicKey;
  creatorTokenAccount: PublicKey;
  stakingPool: PublicKey;
  platformTreasury: PublicKey;
  oraMint: PublicKey;
}
export interface SubscribeParams {
  creator: PublicKey;
  monthlyAmount: bigint | number;
  fanTokenAccount: PublicKey;
  creatorTokenAccount: PublicKey;
  platformTreasury: PublicKey;
}
export interface CreatePpvParams {
  ppvId: bigint | number;
  title: string;
  price: bigint | number;
}
export interface PurchasePpvParams {
  creator: PublicKey;
  ppvId: bigint | number;
  fanTokenAccount: PublicKey;
  creatorTokenAccount: PublicKey;
  platformTreasury: PublicKey;
}

// ────────────────────────────────────────────────────────────────────────
// LivestreamModule
// ────────────────────────────────────────────────────────────────────────

export class LivestreamModule {
  constructor(
    private connection: Connection,
    private wallet: WalletAdapter,
    private programId: PublicKey,
  ) {}

  streamPda(creator: PublicKey, streamId: bigint | number): PublicKey {
    const idBuf = u64LE(BigInt(streamId));
    const [pda] = PublicKey.findProgramAddressSync(
      [LIVESTREAM_SEEDS.STREAM, creator.toBuffer(), idBuf],
      this.programId,
    );
    return pda;
  }

  tipRecordPda(stream: PublicKey, fan: PublicKey, tipNonce: bigint | number): PublicKey {
    const nBuf = u64LE(BigInt(tipNonce));
    const [pda] = PublicKey.findProgramAddressSync(
      [LIVESTREAM_SEEDS.TIP, stream.toBuffer(), fan.toBuffer(), nBuf],
      this.programId,
    );
    return pda;
  }

  subscriptionPda(creator: PublicKey, fan: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [LIVESTREAM_SEEDS.SUBSCRIPTION, creator.toBuffer(), fan.toBuffer()],
      this.programId,
    );
    return pda;
  }

  ppvPda(creator: PublicKey, ppvId: bigint | number): PublicKey {
    const idBuf = u64LE(BigInt(ppvId));
    const [pda] = PublicKey.findProgramAddressSync(
      [LIVESTREAM_SEEDS.PPV, creator.toBuffer(), idBuf],
      this.programId,
    );
    return pda;
  }

  ppvAccessPda(ppvEvent: PublicKey, fan: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [LIVESTREAM_SEEDS.PPV_ACCESS, ppvEvent.toBuffer(), fan.toBuffer()],
      this.programId,
    );
    return pda;
  }

  tipBoostPda(tipRecord: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [LIVESTREAM_SEEDS.TIP_BOOST, tipRecord.toBuffer()],
      this.programId,
    );
    return pda;
  }

  // ─────────────────────────── reads ─────────────────────────────────────

  async fetchStream(creator: PublicKey, streamId: bigint | number): Promise<LiveStreamOnChain | null> {
    const addr = this.streamPda(creator, streamId);
    const acc = await this.connection.getAccountInfo(addr);
    if (!acc) return null;
    return parseStream(addr, acc.data);
  }

  async fetchTipRecord(addr: PublicKey): Promise<TipRecordOnChain | null> {
    const acc = await this.connection.getAccountInfo(addr);
    if (!acc) return null;
    return parseTipRecord(addr, acc.data);
  }

  async fetchSubscription(creator: PublicKey, fan: PublicKey): Promise<SubscriptionOnChain | null> {
    const addr = this.subscriptionPda(creator, fan);
    const acc = await this.connection.getAccountInfo(addr);
    if (!acc) return null;
    return parseSubscription(addr, acc.data);
  }

  async fetchPpv(creator: PublicKey, ppvId: bigint | number): Promise<PpvEventOnChain | null> {
    const addr = this.ppvPda(creator, ppvId);
    const acc = await this.connection.getAccountInfo(addr);
    if (!acc) return null;
    return parsePpv(addr, acc.data);
  }

  // ─────────────────────────── writes ────────────────────────────────────

  async startStream(params: StartStreamParams): Promise<TransactionResult & { stream?: PublicKey }> {
    const creator = this.requireWallet();
    if (params.title.length > LIVESTREAM_LIMITS.TITLE_MAX) {
      return { ...errRes(`title exceeds ${LIVESTREAM_LIMITS.TITLE_MAX} chars`) };
    }
    const stream = this.streamPda(creator, params.streamId);
    const data = Buffer.concat([
      ixDiscriminator('start_stream'),
      borshString(params.title),
      u64LE(BigInt(params.streamId)),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: stream, isSigner: false, isWritable: true },
        { pubkey: creator, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    const res = await this.sendTx([ix]);
    return { ...res, stream };
  }

  async endStream(params: EndStreamParams): Promise<TransactionResult> {
    const creator = this.requireWallet();
    const stream = this.streamPda(creator, params.streamId);
    const data = Buffer.concat([
      ixDiscriminator('end_stream'),
      u64LE(BigInt(params.peakViewers)),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: stream, isSigner: false, isWritable: true },
        { pubkey: creator, isSigner: true, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async tipStreamer(params: TipStreamerParams): Promise<TransactionResult & { tipRecord?: PublicKey }> {
    const fan = this.requireWallet();
    const tipRecord = this.tipRecordPda(params.stream, fan, params.tipNonce);
    const data = Buffer.concat([
      ixDiscriminator('tip_streamer'),
      u64LE(BigInt(params.amount)),
      u64LE(BigInt(params.tipNonce)),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: params.stream, isSigner: false, isWritable: true },
        { pubkey: tipRecord, isSigner: false, isWritable: true },
        { pubkey: params.fanTokenAccount, isSigner: false, isWritable: true },
        { pubkey: params.creatorTokenAccount, isSigner: false, isWritable: true },
        { pubkey: params.stakingPool, isSigner: false, isWritable: true },
        { pubkey: params.platformTreasury, isSigner: false, isWritable: true },
        { pubkey: params.oraMint, isSigner: false, isWritable: true },
        { pubkey: fan, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    const res = await this.sendTx([ix]);
    return { ...res, tipRecord };
  }

  async subscribe(params: SubscribeParams): Promise<TransactionResult & { subscription?: PublicKey }> {
    const fan = this.requireWallet();
    const subscription = this.subscriptionPda(params.creator, fan);
    const data = Buffer.concat([
      ixDiscriminator('subscribe_to_creator'),
      u64LE(BigInt(params.monthlyAmount)),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: subscription, isSigner: false, isWritable: true },
        { pubkey: params.fanTokenAccount, isSigner: false, isWritable: true },
        { pubkey: params.creatorTokenAccount, isSigner: false, isWritable: true },
        { pubkey: params.platformTreasury, isSigner: false, isWritable: true },
        { pubkey: params.creator, isSigner: false, isWritable: false },
        { pubkey: fan, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    const res = await this.sendTx([ix]);
    return { ...res, subscription };
  }

  async renewSubscription(params: SubscribeParams): Promise<TransactionResult> {
    const fan = this.requireWallet();
    const subscription = this.subscriptionPda(params.creator, fan);
    const data = Buffer.concat([
      ixDiscriminator('renew_subscription'),
      u64LE(BigInt(params.monthlyAmount)),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: subscription, isSigner: false, isWritable: true },
        { pubkey: params.fanTokenAccount, isSigner: false, isWritable: true },
        { pubkey: params.creatorTokenAccount, isSigner: false, isWritable: true },
        { pubkey: params.platformTreasury, isSigner: false, isWritable: true },
        { pubkey: params.creator, isSigner: false, isWritable: false },
        { pubkey: fan, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async createPayPerView(params: CreatePpvParams): Promise<TransactionResult & { ppvEvent?: PublicKey }> {
    const creator = this.requireWallet();
    if (params.title.length > LIVESTREAM_LIMITS.TITLE_MAX) {
      return errRes(`title exceeds ${LIVESTREAM_LIMITS.TITLE_MAX} chars`);
    }
    const ppvEvent = this.ppvPda(creator, params.ppvId);
    const data = Buffer.concat([
      ixDiscriminator('create_pay_per_view'),
      u64LE(BigInt(params.ppvId)),
      borshString(params.title),
      u64LE(BigInt(params.price)),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: ppvEvent, isSigner: false, isWritable: true },
        { pubkey: creator, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    const res = await this.sendTx([ix]);
    return { ...res, ppvEvent };
  }

  async purchasePpv(params: PurchasePpvParams): Promise<TransactionResult & { ppvAccess?: PublicKey }> {
    const fan = this.requireWallet();
    const ppvEvent = this.ppvPda(params.creator, params.ppvId);
    const ppvAccess = this.ppvAccessPda(ppvEvent, fan);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: ppvEvent, isSigner: false, isWritable: true },
        { pubkey: ppvAccess, isSigner: false, isWritable: true },
        { pubkey: params.fanTokenAccount, isSigner: false, isWritable: true },
        { pubkey: params.creatorTokenAccount, isSigner: false, isWritable: true },
        { pubkey: params.platformTreasury, isSigner: false, isWritable: true },
        { pubkey: fan, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('purchase_ppv'),
    });
    const res = await this.sendTx([ix]);
    return { ...res, ppvAccess };
  }

  async creatorCoinTipBoost(tipRecord: PublicKey): Promise<TransactionResult & { tipBoost?: PublicKey }> {
    const authority = this.requireWallet();
    const tipBoost = this.tipBoostPda(tipRecord);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: tipRecord, isSigner: false, isWritable: false },
        { pubkey: tipBoost, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('creator_coin_tip_boost'),
    });
    const res = await this.sendTx([ix]);
    return { ...res, tipBoost };
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
// Helpers + parsers
// ────────────────────────────────────────────────────────────────────────

function readString(buf: Buffer, offset: number): { value: string; nextOffset: number } {
  const len = buf.readUInt32LE(offset);
  const start = offset + 4;
  const end = start + len;
  return { value: buf.slice(start, end).toString('utf8'), nextOffset: end };
}

const LIVESTREAM_DISC = accountDiscriminator('LiveStream');
const TIP_RECORD_DISC = accountDiscriminator('TipRecord');
const SUBSCRIPTION_DISC = accountDiscriminator('Subscription');
const PPV_EVENT_DISC = accountDiscriminator('PPVEvent');
const PPV_ACCESS_DISC = accountDiscriminator('PPVAccess');
const TIP_BOOST_DISC = accountDiscriminator('TipBoost');

function parseStream(addr: PublicKey, data: Buffer): LiveStreamOnChain {
  if (!data.slice(0, 8).equals(LIVESTREAM_DISC)) throw new Error('Not a LiveStream');
  let o = 8;
  const creator = new PublicKey(data.slice(o, o + 32)); o += 32;
  const streamId = data.readBigUInt64LE(o); o += 8;
  const titleR = readString(data, o); o = titleR.nextOffset;
  const startTime = Number(data.readBigInt64LE(o)); o += 8;
  const endTime = Number(data.readBigInt64LE(o)); o += 8;
  const isLive = data.readUInt8(o) !== 0; o += 1;
  const peakViewers = data.readBigUInt64LE(o); o += 8;
  const totalTips = data.readBigUInt64LE(o); o += 8;
  const totalSubscriptions = data.readBigUInt64LE(o); o += 8;
  const bump = data.readUInt8(o); o += 1;
  return {
    address: addr, creator, streamId, title: titleR.value,
    startTime, endTime, isLive, peakViewers, totalTips, totalSubscriptions, bump,
  };
}

function parseTipRecord(addr: PublicKey, data: Buffer): TipRecordOnChain {
  if (!data.slice(0, 8).equals(TIP_RECORD_DISC)) throw new Error('Not a TipRecord');
  let o = 8;
  const fan = new PublicKey(data.slice(o, o + 32)); o += 32;
  const creator = new PublicKey(data.slice(o, o + 32)); o += 32;
  const amount = data.readBigUInt64LE(o); o += 8;
  const timestamp = Number(data.readBigInt64LE(o)); o += 8;
  const isLargeTip = data.readUInt8(o) !== 0; o += 1;
  const bump = data.readUInt8(o); o += 1;
  return { address: addr, fan, creator, amount, timestamp, isLargeTip, bump };
}

function parseSubscription(addr: PublicKey, data: Buffer): SubscriptionOnChain {
  if (!data.slice(0, 8).equals(SUBSCRIPTION_DISC)) throw new Error('Not a Subscription');
  let o = 8;
  const fan = new PublicKey(data.slice(o, o + 32)); o += 32;
  const creator = new PublicKey(data.slice(o, o + 32)); o += 32;
  const monthlyAmount = data.readBigUInt64LE(o); o += 8;
  const startedAt = Number(data.readBigInt64LE(o)); o += 8;
  const expiresAt = Number(data.readBigInt64LE(o)); o += 8;
  const isActive = data.readUInt8(o) !== 0; o += 1;
  const bump = data.readUInt8(o); o += 1;
  return { address: addr, fan, creator, monthlyAmount, startedAt, expiresAt, isActive, bump };
}

function parsePpv(addr: PublicKey, data: Buffer): PpvEventOnChain {
  if (!data.slice(0, 8).equals(PPV_EVENT_DISC)) throw new Error('Not a PPVEvent');
  let o = 8;
  const creator = new PublicKey(data.slice(o, o + 32)); o += 32;
  const ppvId = data.readBigUInt64LE(o); o += 8;
  const titleR = readString(data, o); o = titleR.nextOffset;
  const price = data.readBigUInt64LE(o); o += 8;
  const totalPurchases = data.readBigUInt64LE(o); o += 8;
  const totalRevenue = data.readBigUInt64LE(o); o += 8;
  const isActive = data.readUInt8(o) !== 0; o += 1;
  const createdAt = Number(data.readBigInt64LE(o)); o += 8;
  const bump = data.readUInt8(o); o += 1;
  return {
    address: addr, creator, ppvId, title: titleR.value,
    price, totalPurchases, totalRevenue, isActive, createdAt, bump,
  };
}

function errRes(msg: string): TransactionResult {
  return { signature: '', success: false, error: msg };
}

/** Off-chain mirror of `calculate_boost_multiplier` for previewing. */
export function calculateBoostMultiplier(amount: bigint): number {
  const ora = amount / 1_000_000n;
  if (ora >= 1000n) return 500;
  if (ora >= 500n) return 300;
  return 200;
}

export const __internals = {
  ixDiscriminator,
  accountDiscriminator,
  LIVESTREAM_DISC,
  TIP_RECORD_DISC,
  SUBSCRIPTION_DISC,
  PPV_EVENT_DISC,
  PPV_ACCESS_DISC,
  TIP_BOOST_DISC,
};
