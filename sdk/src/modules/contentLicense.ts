/**
 * ContentLicenseModule — On-chain copyright/license records.
 *
 * Wraps `aura_content_license` (programs/content-license/src/lib.rs). Each
 * piece of content gets a per-content PDA license, plus embed/remix records.
 *
 * Mirrors the discriminator/Borsh/PDA conventions from `market.ts`.
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

import { TransactionResult, LicenseType } from '../types';

// ────────────────────────────────────────────────────────────────────────
// Constants — must match programs/content-license/src/lib.rs
// ────────────────────────────────────────────────────────────────────────

export const CONTENT_LICENSE_SEEDS = {
  LICENSE: Buffer.from('license'),
  EMBED: Buffer.from('embed'),
  REMIX: Buffer.from('remix'),
} as const;

export const CONTENT_LICENSE_LIMITS = {
  /** royalty bps must be ≤ 10000 */
  MAX_ROYALTY_BPS: 10_000,
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
function u64LE(v: bigint | number): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(typeof v === 'bigint' ? v : BigInt(v), 0);
  return b;
}
function bool(v: boolean): Buffer { return u8(v ? 1 : 0); }
function i64LE(v: bigint | number): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigInt64LE(typeof v === 'bigint' ? v : BigInt(v), 0);
  return b;
}
function pubkeyBytes(pk: PublicKey): Buffer { return Buffer.from(pk.toBytes()); }

/** Borsh Option<T>: tag byte (0 = none, 1 = some), then optional payload. */
function borshOption(payload: Buffer | null): Buffer {
  if (payload === null) return u8(0);
  return Buffer.concat([u8(1), payload]);
}

// ────────────────────────────────────────────────────────────────────────
// LicenseType discriminant — mirror of Rust enum order
// ────────────────────────────────────────────────────────────────────────

function licenseTypeByte(lt: LicenseType): number {
  // enum order in Rust: CC0=0, CCBY=1, PayToEmbed=2, PayToRemix=3, Exclusive=4
  switch (lt) {
    case LicenseType.CC0: return 0;
    case LicenseType.CCBY: return 1;
    case LicenseType.PayToEmbed: return 2;
    case LicenseType.PayToRemix: return 3;
    case LicenseType.Exclusive: return 4;
    default: throw new Error(`Unknown LicenseType ${lt}`);
  }
}
function byteToLicenseType(b: number): LicenseType {
  return [LicenseType.CC0, LicenseType.CCBY, LicenseType.PayToEmbed,
          LicenseType.PayToRemix, LicenseType.Exclusive][b] ?? LicenseType.CC0;
}

// ────────────────────────────────────────────────────────────────────────
// Public types
// ────────────────────────────────────────────────────────────────────────

export interface ContentLicenseOnChain {
  address: PublicKey;
  contentId: PublicKey;
  creator: PublicKey;
  licenseType: LicenseType;
  embedPrice: bigint;
  remixRoyaltyBps: number;
  commercialAllowed: boolean;
  derivativesAllowed: boolean;
  attributionRequired: boolean;
  totalEmbeds: bigint;
  totalRemixes: bigint;
  totalEmbedRevenue: bigint;
  totalRemixRevenue: bigint;
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
  bump: number;
}

export interface EmbedRecordOnChain {
  address: PublicKey;
  contentId: PublicKey;
  embedder: PublicKey;
  amountPaid: bigint;
  embeddedAt: number;
  bump: number;
}

export interface RemixRecordOnChain {
  address: PublicKey;
  originalContentId: PublicKey;
  newContentId: PublicKey;
  originalCreator: PublicKey;
  remixer: PublicKey;
  amountPaid: bigint;
  royaltyBps: number;
  remixedAt: number;
  totalRevenue: bigint;
  creatorRoyaltyPaid: bigint;
  bump: number;
}

export interface SetLicenseParams {
  /** The content id (PDA or content-account address) used as seed. */
  contentId: PublicKey;
  licenseType: LicenseType;
  embedPrice: bigint | number;
  remixRoyaltyBps: number;
  commercialAllowed: boolean;
  derivativesAllowed: boolean;
  attributionRequired: boolean;
}

export interface UpdateLicenseParams {
  contentId: PublicKey;
  licenseType?: LicenseType;
  embedPrice?: bigint | number;
  remixRoyaltyBps?: number;
  commercialAllowed?: boolean;
  derivativesAllowed?: boolean;
  attributionRequired?: boolean;
}

export interface PayToEmbedParams {
  contentId: PublicKey;
  creator: PublicKey;
  amount: bigint | number;
  /** Unix-seconds; used as a seed for the EmbedRecord PDA (matches on-chain
   *  `Clock::get()?.unix_timestamp` used at instruction time). */
  unixTimestamp: number;
}

export interface PayToRemixParams {
  contentId: PublicKey;
  creator: PublicKey;
  newContentId: PublicKey;
  amount: bigint | number;
  unixTimestamp: number;
}

// ────────────────────────────────────────────────────────────────────────
// ContentLicenseModule
// ────────────────────────────────────────────────────────────────────────

export class ContentLicenseModule {
  constructor(
    private connection: Connection,
    private wallet: WalletAdapter,
    private programId: PublicKey,
  ) {}

  licensePda(contentId: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [CONTENT_LICENSE_SEEDS.LICENSE, contentId.toBuffer()],
      this.programId,
    );
    return pda;
  }

  embedRecordPda(contentId: PublicKey, embedder: PublicKey, unixTimestamp: number): PublicKey {
    const ts = i64LE(BigInt(unixTimestamp));
    const [pda] = PublicKey.findProgramAddressSync(
      [CONTENT_LICENSE_SEEDS.EMBED, contentId.toBuffer(), embedder.toBuffer(), ts],
      this.programId,
    );
    return pda;
  }

  remixRecordPda(contentId: PublicKey, remixer: PublicKey, unixTimestamp: number): PublicKey {
    const ts = i64LE(BigInt(unixTimestamp));
    const [pda] = PublicKey.findProgramAddressSync(
      [CONTENT_LICENSE_SEEDS.REMIX, contentId.toBuffer(), remixer.toBuffer(), ts],
      this.programId,
    );
    return pda;
  }

  // ─────────────────────────── reads ─────────────────────────────────────

  async fetchLicense(contentId: PublicKey): Promise<ContentLicenseOnChain | null> {
    const addr = this.licensePda(contentId);
    const acc = await this.connection.getAccountInfo(addr);
    if (!acc) return null;
    return parseContentLicense(addr, acc.data);
  }

  async fetchEmbedRecord(addr: PublicKey): Promise<EmbedRecordOnChain | null> {
    const acc = await this.connection.getAccountInfo(addr);
    if (!acc) return null;
    return parseEmbedRecord(addr, acc.data);
  }

  async fetchRemixRecord(addr: PublicKey): Promise<RemixRecordOnChain | null> {
    const acc = await this.connection.getAccountInfo(addr);
    if (!acc) return null;
    return parseRemixRecord(addr, acc.data);
  }

  // ─────────────────────────── writes ────────────────────────────────────

  async setLicense(params: SetLicenseParams): Promise<TransactionResult> {
    const creator = this.requireWallet();
    if (params.remixRoyaltyBps > CONTENT_LICENSE_LIMITS.MAX_ROYALTY_BPS) {
      return errRes('remixRoyaltyBps > 10000');
    }
    const licensePda = this.licensePda(params.contentId);
    const data = Buffer.concat([
      ixDiscriminator('set_license'),
      u8(licenseTypeByte(params.licenseType)),
      u64LE(BigInt(params.embedPrice)),
      u16LE(params.remixRoyaltyBps),
      bool(params.commercialAllowed),
      bool(params.derivativesAllowed),
      bool(params.attributionRequired),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: licensePda, isSigner: false, isWritable: true },
        { pubkey: params.contentId, isSigner: false, isWritable: false },
        { pubkey: creator, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async updateLicense(params: UpdateLicenseParams): Promise<TransactionResult> {
    const creator = this.requireWallet();
    const licensePda = this.licensePda(params.contentId);

    if (params.remixRoyaltyBps !== undefined &&
        params.remixRoyaltyBps > CONTENT_LICENSE_LIMITS.MAX_ROYALTY_BPS) {
      return errRes('remixRoyaltyBps > 10000');
    }

    const optLt = params.licenseType !== undefined
      ? borshOption(u8(licenseTypeByte(params.licenseType))) : borshOption(null);
    const optEp = params.embedPrice !== undefined
      ? borshOption(u64LE(BigInt(params.embedPrice))) : borshOption(null);
    const optRb = params.remixRoyaltyBps !== undefined
      ? borshOption(u16LE(params.remixRoyaltyBps)) : borshOption(null);
    const optCa = params.commercialAllowed !== undefined
      ? borshOption(bool(params.commercialAllowed)) : borshOption(null);
    const optDa = params.derivativesAllowed !== undefined
      ? borshOption(bool(params.derivativesAllowed)) : borshOption(null);
    const optAr = params.attributionRequired !== undefined
      ? borshOption(bool(params.attributionRequired)) : borshOption(null);

    const data = Buffer.concat([
      ixDiscriminator('update_license'),
      optLt, optEp, optRb, optCa, optDa, optAr,
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: licensePda, isSigner: false, isWritable: true },
        { pubkey: creator, isSigner: true, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async payToEmbed(params: PayToEmbedParams): Promise<TransactionResult & { embedRecord?: PublicKey }> {
    const embedder = this.requireWallet();
    const licensePda = this.licensePda(params.contentId);
    const embedRecord = this.embedRecordPda(params.contentId, embedder, params.unixTimestamp);
    const data = Buffer.concat([
      ixDiscriminator('pay_to_embed'),
      u64LE(BigInt(params.amount)),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: licensePda, isSigner: false, isWritable: true },
        { pubkey: embedRecord, isSigner: false, isWritable: true },
        { pubkey: embedder, isSigner: true, isWritable: true },
        { pubkey: params.creator, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    const res = await this.sendTx([ix]);
    return { ...res, embedRecord };
  }

  async payToRemix(params: PayToRemixParams): Promise<TransactionResult & { remixRecord?: PublicKey }> {
    const remixer = this.requireWallet();
    const licensePda = this.licensePda(params.contentId);
    const remixRecord = this.remixRecordPda(params.contentId, remixer, params.unixTimestamp);
    const data = Buffer.concat([
      ixDiscriminator('pay_to_remix'),
      u64LE(BigInt(params.amount)),
      pubkeyBytes(params.newContentId),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: licensePda, isSigner: false, isWritable: true },
        { pubkey: remixRecord, isSigner: false, isWritable: true },
        { pubkey: remixer, isSigner: true, isWritable: true },
        { pubkey: params.creator, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    const res = await this.sendTx([ix]);
    return { ...res, remixRecord };
  }

  async distributeRemixRevenue(
    remixRecord: PublicKey,
    originalCreator: PublicKey,
    remixer: PublicKey,
    amount: bigint | number,
  ): Promise<TransactionResult> {
    const payer = this.requireWallet();
    const data = Buffer.concat([
      ixDiscriminator('distribute_remix_revenue'),
      u64LE(BigInt(amount)),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: remixRecord, isSigner: false, isWritable: true },
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: originalCreator, isSigner: false, isWritable: true },
        { pubkey: remixer, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async deactivateLicense(contentId: PublicKey): Promise<TransactionResult> {
    const creator = this.requireWallet();
    const licensePda = this.licensePda(contentId);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: licensePda, isSigner: false, isWritable: true },
        { pubkey: creator, isSigner: true, isWritable: false },
      ],
      data: ixDiscriminator('deactivate_license'),
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
// Parsers
// ────────────────────────────────────────────────────────────────────────

const CONTENT_LICENSE_DISC = accountDiscriminator('ContentLicense');
const EMBED_RECORD_DISC = accountDiscriminator('EmbedRecord');
const REMIX_RECORD_DISC = accountDiscriminator('RemixRecord');

function parseContentLicense(addr: PublicKey, data: Buffer): ContentLicenseOnChain {
  if (!data.slice(0, 8).equals(CONTENT_LICENSE_DISC)) {
    throw new Error('Account is not a ContentLicense');
  }
  let o = 8;
  const contentId = new PublicKey(data.slice(o, o + 32)); o += 32;
  const creator = new PublicKey(data.slice(o, o + 32)); o += 32;
  const licenseType = byteToLicenseType(data.readUInt8(o)); o += 1;
  const embedPrice = data.readBigUInt64LE(o); o += 8;
  const remixRoyaltyBps = data.readUInt16LE(o); o += 2;
  const commercialAllowed = data.readUInt8(o) !== 0; o += 1;
  const derivativesAllowed = data.readUInt8(o) !== 0; o += 1;
  const attributionRequired = data.readUInt8(o) !== 0; o += 1;
  const totalEmbeds = data.readBigUInt64LE(o); o += 8;
  const totalRemixes = data.readBigUInt64LE(o); o += 8;
  const totalEmbedRevenue = data.readBigUInt64LE(o); o += 8;
  const totalRemixRevenue = data.readBigUInt64LE(o); o += 8;
  const createdAt = Number(data.readBigInt64LE(o)); o += 8;
  const updatedAt = Number(data.readBigInt64LE(o)); o += 8;
  const isActive = data.readUInt8(o) !== 0; o += 1;
  const bump = data.readUInt8(o); o += 1;
  return {
    address: addr, contentId, creator, licenseType, embedPrice,
    remixRoyaltyBps, commercialAllowed, derivativesAllowed, attributionRequired,
    totalEmbeds, totalRemixes, totalEmbedRevenue, totalRemixRevenue,
    createdAt, updatedAt, isActive, bump,
  };
}

function parseEmbedRecord(addr: PublicKey, data: Buffer): EmbedRecordOnChain {
  if (!data.slice(0, 8).equals(EMBED_RECORD_DISC)) {
    throw new Error('Account is not an EmbedRecord');
  }
  let o = 8;
  const contentId = new PublicKey(data.slice(o, o + 32)); o += 32;
  const embedder = new PublicKey(data.slice(o, o + 32)); o += 32;
  const amountPaid = data.readBigUInt64LE(o); o += 8;
  const embeddedAt = Number(data.readBigInt64LE(o)); o += 8;
  const bump = data.readUInt8(o); o += 1;
  return { address: addr, contentId, embedder, amountPaid, embeddedAt, bump };
}

function parseRemixRecord(addr: PublicKey, data: Buffer): RemixRecordOnChain {
  if (!data.slice(0, 8).equals(REMIX_RECORD_DISC)) {
    throw new Error('Account is not a RemixRecord');
  }
  let o = 8;
  const originalContentId = new PublicKey(data.slice(o, o + 32)); o += 32;
  const newContentId = new PublicKey(data.slice(o, o + 32)); o += 32;
  const originalCreator = new PublicKey(data.slice(o, o + 32)); o += 32;
  const remixer = new PublicKey(data.slice(o, o + 32)); o += 32;
  const amountPaid = data.readBigUInt64LE(o); o += 8;
  const royaltyBps = data.readUInt16LE(o); o += 2;
  const remixedAt = Number(data.readBigInt64LE(o)); o += 8;
  const totalRevenue = data.readBigUInt64LE(o); o += 8;
  const creatorRoyaltyPaid = data.readBigUInt64LE(o); o += 8;
  const bump = data.readUInt8(o); o += 1;
  return {
    address: addr, originalContentId, newContentId, originalCreator, remixer,
    amountPaid, royaltyBps, remixedAt, totalRevenue, creatorRoyaltyPaid, bump,
  };
}

function errRes(msg: string): TransactionResult {
  return { signature: '', success: false, error: msg };
}

export const __internals = {
  ixDiscriminator,
  accountDiscriminator,
  parseContentLicense,
  parseEmbedRecord,
  parseRemixRecord,
  CONTENT_LICENSE_DISC,
  EMBED_RECORD_DISC,
  REMIX_RECORD_DISC,
  licenseTypeByte,
};
