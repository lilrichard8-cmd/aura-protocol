// [whitepaper-sync v1.1] §13 content-keys — SDK module for the on-chain
// `aura_content_keys` program (programs/content-keys/src/lib.rs).
//
// Mirrors the discriminator / Borsh / PDA conventions established in
// `market.ts`. PDA seeds are kept verbatim with the on-chain Rust constants
// so the cross-test (`tests/aura-sdk-contentKeys.ts`) can recompute them
// from this module.

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { WalletAdapter } from '@solana/wallet-adapter-base';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { sha256 } from '@noble/hashes/sha256';

import { TransactionResult } from '../types';

// ────────────────────────────────────────────────────────────────────────
// Constants — must match programs/content-keys/src/lib.rs
// ────────────────────────────────────────────────────────────────────────

export const CONTENT_KEYS_SEEDS = {
  COUNTER: Buffer.from('content-counter'),
  CONTENT: Buffer.from('content'),
  KEY: Buffer.from('content-key'),
  LISTING: Buffer.from('key-listing'),
} as const;

/** [whitepaper-sync v1.1] §13 content-keys — Fee bps mirroring the on-chain
 *  constants in programs/content-keys/src/lib.rs. */
export const CONTENT_KEYS_FEE_BPS = {
  /** Primary sale total = 5% (creator nets 95%). */
  PRIMARY_TOTAL: 500,
  PRIMARY_BURN: 200,
  PRIMARY_STAKING: 200,
  PRIMARY_GAS: 50,
  PRIMARY_OPS: 50,
  /** Default per-content royalty (5%). */
  DEFAULT_ROYALTY: 500,
  /** [audit fix M-CK-1] Lower bound on royalty (5%, §12 NFT minimum). */
  MIN_ROYALTY: 500,
  /** Hard cap on per-content royalty (45%, §12 NFT max / Metaplex pNFT). */
  MAX_ROYALTY: 4_500,
  /** Secondary protocol fee = 5% (split identically to PRIMARY_*). */
  SECONDARY_PROTOCOL_TOTAL: 500,
} as const;

export const CONTENT_KEYS_LIMITS = {
  /** Max length of an Arweave tx id stored on-chain. */
  ARWEAVE_TX_MAX: 64,
} as const;

/** [whitepaper-sync v1.1] §13 content-keys — Access policy enum, matching
 *  the on-chain `AccessType`. */
export enum AccessKind {
  Permanent = 0,
  Subscription = 1,
  BurnAfterReading = 2,
}

export type AccessType =
  | { kind: AccessKind.Permanent }
  | { kind: AccessKind.Subscription; durationSecs: bigint | number }
  | { kind: AccessKind.BurnAfterReading };

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

/** Encode `AccessType` as Anchor enum variant tag + variant payload. */
function encodeAccessType(at: AccessType): Buffer {
  switch (at.kind) {
    case AccessKind.Permanent:
      return u8(0);
    case AccessKind.Subscription:
      return Buffer.concat([u8(1), i64LE(at.durationSecs)]);
    case AccessKind.BurnAfterReading:
      return u8(2);
  }
}

// ────────────────────────────────────────────────────────────────────────
// PDA helpers
// ────────────────────────────────────────────────────────────────────────

export interface ContentKeysPdas {
  counter(creator: PublicKey): PublicKey;
  content(creator: PublicKey, contentId: bigint | number): PublicKey;
  key(content: PublicKey, serial: bigint | number): PublicKey;
  listing(key: PublicKey): PublicKey;
}

function makePdas(programId: PublicKey): ContentKeysPdas {
  return {
    counter(creator) {
      const [pda] = PublicKey.findProgramAddressSync(
        [CONTENT_KEYS_SEEDS.COUNTER, creator.toBuffer()],
        programId
      );
      return pda;
    },
    content(creator, contentId) {
      const [pda] = PublicKey.findProgramAddressSync(
        [CONTENT_KEYS_SEEDS.CONTENT, creator.toBuffer(), u64LE(contentId)],
        programId
      );
      return pda;
    },
    key(content, serial) {
      const [pda] = PublicKey.findProgramAddressSync(
        [CONTENT_KEYS_SEEDS.KEY, content.toBuffer(), u64LE(serial)],
        programId
      );
      return pda;
    },
    listing(key) {
      const [pda] = PublicKey.findProgramAddressSync(
        [CONTENT_KEYS_SEEDS.LISTING, key.toBuffer()],
        programId
      );
      return pda;
    },
  };
}

// ────────────────────────────────────────────────────────────────────────
// Public params
// ────────────────────────────────────────────────────────────────────────

export interface PublishContentParams {
  /** Content id (must equal the creator's current counter value). */
  contentId: bigint;
  arweaveTxId: string;
  /** Price in ORA atomic units. */
  keyPriceLamports: bigint | number;
  /** Per-content secondary royalty bps (≤ 4500). */
  royaltyBps: number;
  accessType: AccessType;
}

export interface UpdateContentParams {
  contentAddress: PublicKey;
  newArweaveTxId: string;
}

export interface BuyKeyParams {
  /** Creator of the content (used to derive PDAs). */
  creator: PublicKey;
  contentId: bigint;
}

export interface ListKeyParams {
  creator: PublicKey;
  contentId: bigint;
  keySerial: bigint;
  listPriceLamports: bigint | number;
}

export interface BuyListedKeyParams {
  creator: PublicKey;
  contentId: bigint;
  keySerial: bigint;
}

export interface ContentOnChain {
  address: PublicKey;
  contentId: bigint;
  creator: PublicKey;
  arweaveTxId: string;
  keyPriceLamports: bigint;
  royaltyBps: number;
  accessType: AccessType;
  totalKeysMinted: bigint;
  isActive: boolean;
  createdAt: number;
}

export interface ContentKeyOnChain {
  address: PublicKey;
  contentId: bigint;
  keyOwner: PublicKey;
  purchasedAt: number;
  purchasePrice: bigint;
  keySerial: bigint;
  isActive: boolean;
}

export interface KeyListingOnChain {
  address: PublicKey;
  key: PublicKey;
  seller: PublicKey;
  listPriceLamports: bigint;
  listedAt: number;
  isActive: boolean;
}

// ────────────────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────────────────

export interface ContentKeysModuleConfig {
  /** ORA mint (must match the on-chain `ORA_MINT` const). */
  oraMint: PublicKey;
  /** Hardcoded protocol pools — must match the on-chain consts. */
  stakingRewardsPool: PublicKey;
  gasReservePool: PublicKey;
  opsTreasuryPool: PublicKey;
}

// ────────────────────────────────────────────────────────────────────────
// ContentKeysModule
// ────────────────────────────────────────────────────────────────────────

export class ContentKeysModule {
  public readonly pdas: ContentKeysPdas;

  constructor(
    private connection: Connection,
    private wallet: WalletAdapter,
    private programId: PublicKey,
    private cfg: ContentKeysModuleConfig
  ) {
    this.pdas = makePdas(programId);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Read helpers
  // ──────────────────────────────────────────────────────────────────────

  /** Next content_id this creator should pass to `publish_content`. */
  async nextContentId(creator: PublicKey): Promise<bigint> {
    const counterPda = this.pdas.counter(creator);
    const acc = await this.connection.getAccountInfo(counterPda);
    if (!acc) return 0n;
    // Layout: discriminator(8) + creator(32) + count(8) + bump(1)
    return acc.data.readBigUInt64LE(8 + 32);
  }

  async fetchContent(address: PublicKey): Promise<ContentOnChain | null> {
    const acc = await this.connection.getAccountInfo(address);
    if (!acc) return null;
    return parseContent(address, acc.data);
  }

  async fetchKey(address: PublicKey): Promise<ContentKeyOnChain | null> {
    const acc = await this.connection.getAccountInfo(address);
    if (!acc) return null;
    return parseKey(address, acc.data);
  }

  async fetchListing(address: PublicKey): Promise<KeyListingOnChain | null> {
    const acc = await this.connection.getAccountInfo(address);
    if (!acc) return null;
    return parseListing(address, acc.data);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Write helpers
  // ──────────────────────────────────────────────────────────────────────

  /** One-time per creator. Idempotent — no-op if counter already exists. */
  async ensureContentCounter(): Promise<TransactionResult> {
    const creator = this.requireWallet();
    const counterPda = this.pdas.counter(creator);
    const existing = await this.connection.getAccountInfo(counterPda);
    if (existing) return { signature: '', success: true };
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: counterPda, isSigner: false, isWritable: true },
        { pubkey: creator, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('init_content_counter'),
    });
    return this.sendTx([ix]);
  }

  async publishContent(
    params: PublishContentParams
  ): Promise<TransactionResult & { content?: PublicKey }> {
    const creator = this.requireWallet();
    if (params.arweaveTxId.length > CONTENT_KEYS_LIMITS.ARWEAVE_TX_MAX)
      return errRes(`arweaveTxId exceeds ${CONTENT_KEYS_LIMITS.ARWEAVE_TX_MAX} chars`);
    if (
      params.royaltyBps < CONTENT_KEYS_FEE_BPS.MIN_ROYALTY ||
      params.royaltyBps > CONTENT_KEYS_FEE_BPS.MAX_ROYALTY
    )
      return errRes(
        `royaltyBps must be within [${CONTENT_KEYS_FEE_BPS.MIN_ROYALTY}, ${CONTENT_KEYS_FEE_BPS.MAX_ROYALTY}]`
      );

    const ixs: TransactionInstruction[] = [];

    // Ensure counter exists.
    const counterPda = this.pdas.counter(creator);
    const counterAcc = await this.connection.getAccountInfo(counterPda);
    if (!counterAcc) {
      ixs.push(new TransactionInstruction({
        programId: this.programId,
        keys: [
          { pubkey: counterPda, isSigner: false, isWritable: true },
          { pubkey: creator, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: ixDiscriminator('init_content_counter'),
      }));
    }

    const contentPda = this.pdas.content(creator, params.contentId);
    const data = Buffer.concat([
      ixDiscriminator('publish_content'),
      u64LE(params.contentId),
      borshString(params.arweaveTxId),
      u64LE(BigInt(params.keyPriceLamports)),
      u16LE(params.royaltyBps),
      encodeAccessType(params.accessType),
    ]);

    ixs.push(new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: counterPda, isSigner: false, isWritable: true },
        { pubkey: contentPda, isSigner: false, isWritable: true },
        { pubkey: creator, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data,
    }));

    const res = await this.sendTx(ixs);
    return { ...res, content: contentPda };
  }

  async updateContent(params: UpdateContentParams): Promise<TransactionResult> {
    const creator = this.requireWallet();
    if (params.newArweaveTxId.length > CONTENT_KEYS_LIMITS.ARWEAVE_TX_MAX)
      return errRes(`newArweaveTxId exceeds ${CONTENT_KEYS_LIMITS.ARWEAVE_TX_MAX} chars`);

    const data = Buffer.concat([
      ixDiscriminator('update_content'),
      borshString(params.newArweaveTxId),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: params.contentAddress, isSigner: false, isWritable: true },
        { pubkey: creator, isSigner: true, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async deactivateContent(contentAddress: PublicKey): Promise<TransactionResult> {
    const creator = this.requireWallet();
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: contentAddress, isSigner: false, isWritable: true },
        { pubkey: creator, isSigner: true, isWritable: false },
      ],
      data: ixDiscriminator('deactivate_content'),
    });
    return this.sendTx([ix]);
  }

  async buyKey(
    params: BuyKeyParams
  ): Promise<TransactionResult & { key?: PublicKey }> {
    const buyer = this.requireWallet();
    const contentPda = this.pdas.content(params.creator, params.contentId);
    const content = await this.fetchContent(contentPda);
    if (!content) return errRes('content not found');
    if (!content.isActive) return errRes('content is inactive');

    const nextSerial = content.totalKeysMinted + 1n;
    const keyPda = this.pdas.key(contentPda, nextSerial);

    const buyerAta = await getAssociatedTokenAddress(this.cfg.oraMint, buyer);
    const creatorAta = await getAssociatedTokenAddress(this.cfg.oraMint, params.creator);

    const data = Buffer.concat([
      ixDiscriminator('buy_key'),
      u64LE(params.contentId),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: contentPda, isSigner: false, isWritable: true },
        { pubkey: keyPda, isSigner: false, isWritable: true },
        { pubkey: this.cfg.oraMint, isSigner: false, isWritable: true },
        { pubkey: buyerAta, isSigner: false, isWritable: true },
        { pubkey: creatorAta, isSigner: false, isWritable: true },
        { pubkey: this.cfg.stakingRewardsPool, isSigner: false, isWritable: true },
        { pubkey: this.cfg.gasReservePool, isSigner: false, isWritable: true },
        { pubkey: this.cfg.opsTreasuryPool, isSigner: false, isWritable: true },
        { pubkey: buyer, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data,
    });

    const res = await this.sendTx([ix]);
    return { ...res, key: keyPda };
  }

  async listKey(
    params: ListKeyParams
  ): Promise<TransactionResult & { listing?: PublicKey }> {
    const seller = this.requireWallet();
    const contentPda = this.pdas.content(params.creator, params.contentId);
    const keyPda = this.pdas.key(contentPda, params.keySerial);
    const listingPda = this.pdas.listing(keyPda);

    const data = Buffer.concat([
      ixDiscriminator('list_key'),
      u64LE(params.contentId),
      u64LE(BigInt(params.listPriceLamports)),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: contentPda, isSigner: false, isWritable: false },
        { pubkey: keyPda, isSigner: false, isWritable: true },
        { pubkey: listingPda, isSigner: false, isWritable: true },
        { pubkey: seller, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data,
    });
    const res = await this.sendTx([ix]);
    return { ...res, listing: listingPda };
  }

  async delistKey(listing: PublicKey): Promise<TransactionResult> {
    const seller = this.requireWallet();
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: listing, isSigner: false, isWritable: true },
        { pubkey: seller, isSigner: true, isWritable: false },
      ],
      data: ixDiscriminator('delist_key'),
    });
    return this.sendTx([ix]);
  }

  async buyListedKey(params: BuyListedKeyParams): Promise<TransactionResult> {
    const buyer = this.requireWallet();
    const contentPda = this.pdas.content(params.creator, params.contentId);
    const keyPda = this.pdas.key(contentPda, params.keySerial);
    const listingPda = this.pdas.listing(keyPda);

    const listing = await this.fetchListing(listingPda);
    if (!listing) return errRes('listing not found');

    const buyerAta = await getAssociatedTokenAddress(this.cfg.oraMint, buyer);
    const sellerAta = await getAssociatedTokenAddress(this.cfg.oraMint, listing.seller);
    const creatorAta = await getAssociatedTokenAddress(this.cfg.oraMint, params.creator);

    const data = Buffer.concat([
      ixDiscriminator('buy_listed_key'),
      u64LE(params.contentId),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: contentPda, isSigner: false, isWritable: false },
        { pubkey: keyPda, isSigner: false, isWritable: true },
        { pubkey: listingPda, isSigner: false, isWritable: true },
        { pubkey: this.cfg.oraMint, isSigner: false, isWritable: true },
        { pubkey: buyerAta, isSigner: false, isWritable: true },
        { pubkey: sellerAta, isSigner: false, isWritable: true },
        { pubkey: creatorAta, isSigner: false, isWritable: true },
        { pubkey: this.cfg.stakingRewardsPool, isSigner: false, isWritable: true },
        { pubkey: this.cfg.gasReservePool, isSigner: false, isWritable: true },
        { pubkey: this.cfg.opsTreasuryPool, isSigner: false, isWritable: true },
        { pubkey: buyer, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Internals
  // ──────────────────────────────────────────────────────────────────────

  private requireWallet(): PublicKey {
    if (!this.wallet.publicKey) throw new Error('Wallet not connected');
    return this.wallet.publicKey;
  }

  private async sendTx(ixs: TransactionInstruction[]): Promise<TransactionResult> {
    try {
      const wallet = this.requireWallet();
      const tx = new Transaction().add(...ixs);
      const { blockhash } = await this.connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet;
      const sig = await this.wallet.sendTransaction(tx, this.connection);
      await this.connection.confirmTransaction(sig);
      return { signature: sig, success: true };
    } catch (e) {
      return { signature: '', success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}

// ────────────────────────────────────────────────────────────────────────
// Account parsers (Borsh)
// ────────────────────────────────────────────────────────────────────────

const CONTENT_DISC = accountDiscriminator('EncryptedContent');
const KEY_DISC = accountDiscriminator('ContentKey');
const LISTING_DISC = accountDiscriminator('KeyListing');

function readString(buf: Buffer, offset: number): { value: string; nextOffset: number } {
  const len = buf.readUInt32LE(offset);
  const start = offset + 4;
  const end = start + len;
  return { value: buf.slice(start, end).toString('utf8'), nextOffset: end };
}

function readAccessType(buf: Buffer, offset: number): { value: AccessType; nextOffset: number } {
  const tag = buf.readUInt8(offset);
  let o = offset + 1;
  if (tag === 0) return { value: { kind: AccessKind.Permanent }, nextOffset: o };
  if (tag === 1) {
    const dur = buf.readBigInt64LE(o); o += 8;
    return { value: { kind: AccessKind.Subscription, durationSecs: dur }, nextOffset: o };
  }
  if (tag === 2) return { value: { kind: AccessKind.BurnAfterReading }, nextOffset: o };
  throw new Error(`Unknown AccessType tag: ${tag}`);
}

function parseContent(addr: PublicKey, data: Buffer): ContentOnChain {
  if (!data.slice(0, 8).equals(CONTENT_DISC)) {
    throw new Error('Account is not an EncryptedContent');
  }
  let o = 8;
  const contentId = data.readBigUInt64LE(o); o += 8;
  const creator = new PublicKey(data.slice(o, o + 32)); o += 32;
  const arweaveRes = readString(data, o); o = arweaveRes.nextOffset;
  const keyPriceLamports = data.readBigUInt64LE(o); o += 8;
  const royaltyBps = data.readUInt16LE(o); o += 2;
  const atRes = readAccessType(data, o); o = atRes.nextOffset;
  const totalKeysMinted = data.readBigUInt64LE(o); o += 8;
  const isActive = data.readUInt8(o) !== 0; o += 1;
  const createdAt = Number(data.readBigInt64LE(o)); o += 8;
  return {
    address: addr,
    contentId,
    creator,
    arweaveTxId: arweaveRes.value,
    keyPriceLamports,
    royaltyBps,
    accessType: atRes.value,
    totalKeysMinted,
    isActive,
    createdAt,
  };
}

function parseKey(addr: PublicKey, data: Buffer): ContentKeyOnChain {
  if (!data.slice(0, 8).equals(KEY_DISC)) {
    throw new Error('Account is not a ContentKey');
  }
  let o = 8;
  const contentId = data.readBigUInt64LE(o); o += 8;
  const keyOwner = new PublicKey(data.slice(o, o + 32)); o += 32;
  const purchasedAt = Number(data.readBigInt64LE(o)); o += 8;
  const purchasePrice = data.readBigUInt64LE(o); o += 8;
  const keySerial = data.readBigUInt64LE(o); o += 8;
  const isActive = data.readUInt8(o) !== 0; o += 1;
  return {
    address: addr,
    contentId,
    keyOwner,
    purchasedAt,
    purchasePrice,
    keySerial,
    isActive,
  };
}

function parseListing(addr: PublicKey, data: Buffer): KeyListingOnChain {
  if (!data.slice(0, 8).equals(LISTING_DISC)) {
    throw new Error('Account is not a KeyListing');
  }
  let o = 8;
  const key = new PublicKey(data.slice(o, o + 32)); o += 32;
  const seller = new PublicKey(data.slice(o, o + 32)); o += 32;
  const listPriceLamports = data.readBigUInt64LE(o); o += 8;
  const listedAt = Number(data.readBigInt64LE(o)); o += 8;
  const isActive = data.readUInt8(o) !== 0; o += 1;
  return { address: addr, key, seller, listPriceLamports, listedAt, isActive };
}

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

function errRes(msg: string): TransactionResult {
  return { signature: '', success: false, error: msg };
}

/** Compute the net amount a creator receives on a primary key sale. */
export function computeCreatorNetPrimary(gross: bigint): bigint {
  const fee = (gross * BigInt(CONTENT_KEYS_FEE_BPS.PRIMARY_TOTAL)) / 10_000n;
  return gross - fee;
}

/** Compute the seller's proceeds on a secondary resale (after royalty + protocol fee). */
export function computeSellerProceedsSecondary(
  gross: bigint,
  royaltyBps: number
): bigint {
  const protocol = (gross * BigInt(CONTENT_KEYS_FEE_BPS.SECONDARY_PROTOCOL_TOTAL)) / 10_000n;
  const royalty = (gross * BigInt(royaltyBps)) / 10_000n;
  return gross - protocol - royalty;
}
