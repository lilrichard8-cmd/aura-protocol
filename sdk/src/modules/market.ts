/**
 * MarketModule — Bounty V2 on-chain operations.
 *
 * Bounty V2 contract lives inside the `aura_market` program (see
 * programs/market/src/bounty_v2*.rs). This module wraps the 9 user-facing
 * instructions plus PDA derivation and Borsh encoding.
 *
 * Anchor instruction discriminators are computed at runtime as
 * `sha256("global:<snake_case_name>").slice(0, 8)` to avoid depending on
 * a generated IDL file (the IDL generator in this repo is currently broken
 * due to an Anchor version skew, but discriminator hashing is stable across
 * Anchor 0.27+).
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Keypair,
} from '@solana/web3.js';
import { WalletAdapter } from '@solana/wallet-adapter-base';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';
import { sha256 } from '@noble/hashes/sha256';

import { TransactionResult } from '../types';

// ────────────────────────────────────────────────────────────────────────
// Program-side constants — must match programs/market/src/bounty_v2.rs
// ────────────────────────────────────────────────────────────────────────

export const BOUNTY_V2_SEEDS = {
  OFFICIAL_AUTHORITY: Buffer.from('bounty-official-authority'),
  COUNTER: Buffer.from('bounty-counter'),
  BOUNTY: Buffer.from('bounty-v2'),
  SUBMISSION: Buffer.from('bounty-submission'),
} as const;

export const BOUNTY_V2_LIMITS = {
  MAX_WINNERS: 10,
  MIN_AWARD_AMOUNT: 20,
  TITLE_MAX: 80,
  URI_MAX: 200,
  SUBMISSION_URI_MAX: 200,
} as const;

/** Fee bps — ORA mode (the only mode active in v1). */
export const BOUNTY_V2_FEE_BPS = {
  TOTAL: 500,
  BURN: 200,
  STAKING: 200,
  GAS: 50,
  OPS: 50,
} as const;

export enum BountyStatus {
  Open = 'Open',
  Closed = 'Closed',
  FullyAwarded = 'FullyAwarded',
  Expired = 'Expired',
  Cancelled = 'Cancelled',
}

export enum SubmissionStatus {
  Pending = 'Pending',
  Awarded = 'Awarded',
  Rejected = 'Rejected',
}

// ────────────────────────────────────────────────────────────────────────
// Anchor discriminator helper
// ────────────────────────────────────────────────────────────────────────

/** Compute Anchor's 8-byte instruction discriminator. */
function ixDiscriminator(name: string): Buffer {
  const preimage = Buffer.from(`global:${name}`, 'utf8');
  return Buffer.from(sha256(preimage).slice(0, 8));
}

/** Compute Anchor's 8-byte account discriminator (for parsing fetched accounts). */
function accountDiscriminator(name: string): Buffer {
  const preimage = Buffer.from(`account:${name}`, 'utf8');
  return Buffer.from(sha256(preimage).slice(0, 8));
}

// ────────────────────────────────────────────────────────────────────────
// Borsh primitives
// ────────────────────────────────────────────────────────────────────────

function u8(v: number): Buffer { const b = Buffer.alloc(1); b.writeUInt8(v, 0); return b; }
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
// PDA helpers
// ────────────────────────────────────────────────────────────────────────

export interface BountyV2Pdas {
  officialAuthority: PublicKey;
  counter(sponsor: PublicKey): PublicKey;
  bounty(sponsor: PublicKey, id: bigint): PublicKey;
  submission(bounty: PublicKey, submitter: PublicKey): PublicKey;
}

function makePdas(programId: PublicKey): BountyV2Pdas {
  const [officialAuthority] = PublicKey.findProgramAddressSync(
    [BOUNTY_V2_SEEDS.OFFICIAL_AUTHORITY],
    programId
  );
  return {
    officialAuthority,
    counter(sponsor) {
      const [pda] = PublicKey.findProgramAddressSync(
        [BOUNTY_V2_SEEDS.COUNTER, sponsor.toBuffer()],
        programId
      );
      return pda;
    },
    bounty(sponsor, id) {
      const idBuf = u64LE(id);
      const [pda] = PublicKey.findProgramAddressSync(
        [BOUNTY_V2_SEEDS.BOUNTY, sponsor.toBuffer(), idBuf],
        programId
      );
      return pda;
    },
    submission(bounty, submitter) {
      const [pda] = PublicKey.findProgramAddressSync(
        [BOUNTY_V2_SEEDS.SUBMISSION, bounty.toBuffer(), submitter.toBuffer()],
        programId
      );
      return pda;
    },
  };
}

// ────────────────────────────────────────────────────────────────────────
// Public params
// ────────────────────────────────────────────────────────────────────────

export interface CreateBountyParams {
  /** Bounty id to use for this sponsor. Must match the on-chain counter value
   *  (call `nextBountyId(sponsor)` first to discover it). */
  bountyId: bigint;
  totalReward: bigint | number;
  /** 1..=10 */
  maxWinners: number;
  /** Unix-seconds. */
  deadline: number;
  title: string;
  metadataUri: string;
  /** Reward mint. v1 always ORA. */
  paymentMint: PublicKey;
  /** True only when sponsor === OfficialBountyAuthority.authority. */
  isOfficial?: boolean;
}

export interface SubmitWorkParams {
  bounty: PublicKey;
  contentUri: string;
}

export interface AwardSubmissionParams {
  bounty: PublicKey;
  submission: PublicKey;
  /** Gross amount; winner net = gross * 0.95. */
  grossAmount: bigint | number;
  /** Defaults to ATA(submitter, paymentMint). Override only if the submitter
   *  has explicitly designated a different (still-owned) ATA. */
  winnerTokenAccount?: PublicKey;
}

export interface BountyOnChain {
  address: PublicKey;
  id: bigint;
  sponsor: PublicKey;
  isOfficial: boolean;
  paymentMint: PublicKey;
  escrowAccount: PublicKey;
  totalReward: bigint;
  awardedAmount: bigint;
  refundedAmount: bigint;
  maxWinners: number;
  winnersAwarded: number;
  submissionCount: number;
  deadline: number;
  status: BountyStatus;
  metadataUri: string;
  title: string;
  createdAt: number;
}

export interface SubmissionOnChain {
  address: PublicKey;
  bounty: PublicKey;
  submitter: PublicKey;
  contentUri: string;
  submittedAt: number;
  status: SubmissionStatus;
  awardedAmount: bigint;
}

// ────────────────────────────────────────────────────────────────────────
// MarketModule
// ────────────────────────────────────────────────────────────────────────

export interface MarketModuleConfig {
  /** Hardcoded protocol pool accounts (ORA-denominated). Must match
   *  STAKING_REWARDS_POOL / GAS_RESERVE_POOL / OPS_TREASURY_POOL constants
   *  in programs/market/src/lib.rs. */
  stakingRewardsPool: PublicKey;
  gasReservePool: PublicKey;
  opsTreasuryPool: PublicKey;
  /** ORA mint (must match ORA_MINT const). */
  oraMint: PublicKey;
}

export class MarketModule {
  public readonly pdas: BountyV2Pdas;

  constructor(
    private connection: Connection,
    private wallet: WalletAdapter,
    private programId: PublicKey,
    private cfg: MarketModuleConfig
  ) {
    this.pdas = makePdas(programId);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Read helpers
  // ──────────────────────────────────────────────────────────────────────

  /** Returns the next bounty id this sponsor should use. */
  async nextBountyId(sponsor: PublicKey): Promise<bigint> {
    const counterPda = this.pdas.counter(sponsor);
    const acc = await this.connection.getAccountInfo(counterPda);
    if (!acc) return 0n; // counter not yet initialised
    // Layout: discriminator(8) + sponsor(32) + count(8) + bump(1)
    return acc.data.readBigUInt64LE(8 + 32);
  }

  async fetchBounty(bountyAddress: PublicKey): Promise<BountyOnChain | null> {
    const acc = await this.connection.getAccountInfo(bountyAddress);
    if (!acc) return null;
    return parseBounty(bountyAddress, acc.data);
  }

  async fetchSubmission(addr: PublicKey): Promise<SubmissionOnChain | null> {
    const acc = await this.connection.getAccountInfo(addr);
    if (!acc) return null;
    return parseSubmission(addr, acc.data);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Write helpers
  // ──────────────────────────────────────────────────────────────────────

  /** One-time per sponsor. Idempotent: skips if counter already exists. */
  async ensureBountyCounter(): Promise<TransactionResult> {
    const sponsor = this.requireWallet();
    const counterPda = this.pdas.counter(sponsor);
    const existing = await this.connection.getAccountInfo(counterPda);
    if (existing) return { signature: '', success: true };

    const data = ixDiscriminator('bv2_init_bounty_counter');
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: counterPda, isSigner: false, isWritable: true },
        { pubkey: sponsor, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  /** Create a new bounty. Locks `totalReward` worth of paymentMint into the
   *  bounty's escrow ATA (created if missing). */
  async createBounty(params: CreateBountyParams): Promise<TransactionResult & { bounty?: PublicKey }> {
    const sponsor = this.requireWallet();

    // ── validation ──
    if (params.maxWinners < 1 || params.maxWinners > BOUNTY_V2_LIMITS.MAX_WINNERS)
      return errRes(`maxWinners must be 1..${BOUNTY_V2_LIMITS.MAX_WINNERS}`);
    if (params.title.length > BOUNTY_V2_LIMITS.TITLE_MAX)
      return errRes(`title exceeds ${BOUNTY_V2_LIMITS.TITLE_MAX} chars`);
    if (params.metadataUri.length > BOUNTY_V2_LIMITS.URI_MAX)
      return errRes(`metadataUri exceeds ${BOUNTY_V2_LIMITS.URI_MAX} chars`);
    if (params.deadline <= Math.floor(Date.now() / 1000))
      return errRes('deadline must be in the future');

    const isOfficial = params.isOfficial === true;
    if (!isOfficial && !params.paymentMint.equals(this.cfg.oraMint))
      return errRes('non-official bounties must use the ORA mint');

    const ixs: TransactionInstruction[] = [];

    // 0. Ensure counter exists.
    const counterPda = this.pdas.counter(sponsor);
    const counterAcc = await this.connection.getAccountInfo(counterPda);
    if (!counterAcc) {
      ixs.push(new TransactionInstruction({
        programId: this.programId,
        keys: [
          { pubkey: counterPda, isSigner: false, isWritable: true },
          { pubkey: sponsor, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: ixDiscriminator('bv2_init_bounty_counter'),
      }));
    }

    const bountyPda = this.pdas.bounty(sponsor, params.bountyId);

    // 1. Ensure escrow ATA (owner = bounty PDA) exists.
    const escrowAta = await getAssociatedTokenAddress(
      params.paymentMint,
      bountyPda,
      true /* allowOwnerOffCurve */
    );
    const escrowAcc = await this.connection.getAccountInfo(escrowAta);
    if (!escrowAcc) {
      ixs.push(createAssociatedTokenAccountInstruction(
        sponsor /* payer */,
        escrowAta,
        bountyPda /* owner */,
        params.paymentMint
      ));
    }

    // 2. Sponsor's source ATA.
    const sponsorAta = await getAssociatedTokenAddress(params.paymentMint, sponsor);

    // 3. Build create_bounty instruction.
    const data = Buffer.concat([
      ixDiscriminator('bv2_create_bounty'),
      u64LE(BigInt(params.totalReward)),
      u8(params.maxWinners),
      i64LE(params.deadline),
      borshString(params.title),
      borshString(params.metadataUri),
      bool(isOfficial),
    ]);

    const keys = [
      { pubkey: counterPda, isSigner: false, isWritable: true },
      { pubkey: bountyPda, isSigner: false, isWritable: true },
      { pubkey: params.paymentMint, isSigner: false, isWritable: false },
      { pubkey: sponsorAta, isSigner: false, isWritable: true },
      { pubkey: escrowAta, isSigner: false, isWritable: true },
      // Option<OfficialBountyAuthority>: Anchor 0.29 expects the account to
      // be present when the Option<> resolves. For non-official we pass the
      // PDA address anyway; the account may not exist, in which case the
      // body skips the check. (Verified by reading the Rust side.)
      { pubkey: this.pdas.officialAuthority, isSigner: false, isWritable: false },
      { pubkey: sponsor, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];

    ixs.push(new TransactionInstruction({
      programId: this.programId,
      keys,
      data,
    }));

    const res = await this.sendTx(ixs);
    return { ...res, bounty: bountyPda };
  }

  async submitWork(params: SubmitWorkParams): Promise<TransactionResult & { submission?: PublicKey }> {
    const submitter = this.requireWallet();
    if (params.contentUri.length > BOUNTY_V2_LIMITS.SUBMISSION_URI_MAX)
      return errRes(`contentUri exceeds ${BOUNTY_V2_LIMITS.SUBMISSION_URI_MAX} chars`);

    const submissionPda = this.pdas.submission(params.bounty, submitter);
    const data = Buffer.concat([
      ixDiscriminator('bv2_submit_to_bounty'),
      borshString(params.contentUri),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: params.bounty, isSigner: false, isWritable: true },
        { pubkey: submissionPda, isSigner: false, isWritable: true },
        { pubkey: submitter, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });

    const res = await this.sendTx([ix]);
    return { ...res, submission: submissionPda };
  }

  async awardSubmission(params: AwardSubmissionParams): Promise<TransactionResult> {
    const sponsor = this.requireWallet();
    const bounty = await this.fetchBounty(params.bounty);
    if (!bounty) return errRes('bounty not found');
    if (!bounty.sponsor.equals(sponsor)) return errRes('only sponsor can award');

    const submission = await this.fetchSubmission(params.submission);
    if (!submission) return errRes('submission not found');
    if (!submission.bounty.equals(params.bounty)) return errRes('submission/bounty mismatch');

    // Winner ATA — defaults to ATA(submitter, paymentMint).
    const winnerAta = params.winnerTokenAccount
      ?? await getAssociatedTokenAddress(bounty.paymentMint, submission.submitter);

    // Auto-create winner ATA if missing (sponsor pays the rent — cheaper than
    // failing the whole tx and asking the winner to bootstrap).
    const ixs: TransactionInstruction[] = [];
    if (!params.winnerTokenAccount) {
      const acc = await this.connection.getAccountInfo(winnerAta);
      if (!acc) {
        ixs.push(createAssociatedTokenAccountInstruction(
          sponsor, winnerAta, submission.submitter, bounty.paymentMint
        ));
      }
    }

    const data = Buffer.concat([
      ixDiscriminator('bv2_award_submission'),
      u64LE(BigInt(params.grossAmount)),
    ]);

    ixs.push(new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: params.bounty, isSigner: false, isWritable: true },
        { pubkey: params.submission, isSigner: false, isWritable: true },
        { pubkey: bounty.paymentMint, isSigner: false, isWritable: false },
        { pubkey: bounty.escrowAccount, isSigner: false, isWritable: true },
        { pubkey: winnerAta, isSigner: false, isWritable: true },
        { pubkey: this.cfg.stakingRewardsPool, isSigner: false, isWritable: true },
        { pubkey: this.cfg.gasReservePool, isSigner: false, isWritable: true },
        { pubkey: this.cfg.opsTreasuryPool, isSigner: false, isWritable: true },
        { pubkey: sponsor, isSigner: true, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    }));
    return this.sendTx(ixs);
  }

  async rejectSubmission(bounty: PublicKey, submission: PublicKey): Promise<TransactionResult> {
    const sponsor = this.requireWallet();
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: bounty, isSigner: false, isWritable: false },
        { pubkey: submission, isSigner: false, isWritable: true },
        { pubkey: sponsor, isSigner: true, isWritable: false },
      ],
      data: ixDiscriminator('bv2_reject_submission'),
    });
    return this.sendTx([ix]);
  }

  async cancelBounty(bounty: PublicKey): Promise<TransactionResult> {
    return this.closeLike(bounty, 'bv2_cancel_bounty');
  }

  async closeBounty(bounty: PublicKey): Promise<TransactionResult> {
    return this.closeLike(bounty, 'bv2_close_bounty');
  }

  private async closeLike(bountyAddr: PublicKey, ixName: string): Promise<TransactionResult> {
    const sponsor = this.requireWallet();
    const bounty = await this.fetchBounty(bountyAddr);
    if (!bounty) return errRes('bounty not found');
    if (!bounty.sponsor.equals(sponsor)) return errRes('only sponsor can close');

    const sponsorAta = await getAssociatedTokenAddress(bounty.paymentMint, sponsor);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: bountyAddr, isSigner: false, isWritable: true },
        { pubkey: bounty.escrowAccount, isSigner: false, isWritable: true },
        { pubkey: sponsorAta, isSigner: false, isWritable: true },
        { pubkey: sponsor, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator(ixName),
    });
    return this.sendTx([ix]);
  }

  /** Permissionless — any caller can trigger refund of an expired bounty.
   *  Rent + escrow funds always go back to the original sponsor. */
  async refundExpired(bountyAddr: PublicKey): Promise<TransactionResult> {
    const caller = this.requireWallet();
    const bounty = await this.fetchBounty(bountyAddr);
    if (!bounty) return errRes('bounty not found');

    const sponsorAta = await getAssociatedTokenAddress(bounty.paymentMint, bounty.sponsor);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: bounty.sponsor, isSigner: false, isWritable: true },
        { pubkey: bountyAddr, isSigner: false, isWritable: true },
        { pubkey: bounty.escrowAccount, isSigner: false, isWritable: true },
        { pubkey: sponsorAta, isSigner: false, isWritable: true },
        { pubkey: caller, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('bv2_refund_expired'),
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
      const sponsor = this.requireWallet();
      const tx = new Transaction().add(...ixs);
      const { blockhash } = await this.connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = sponsor;
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

const BOUNTY_V2_DISC = accountDiscriminator('BountyV2');
const SUBMISSION_DISC = accountDiscriminator('BountySubmission');

function readString(buf: Buffer, offset: number): { value: string; nextOffset: number } {
  const len = buf.readUInt32LE(offset);
  const start = offset + 4;
  const end = start + len;
  return { value: buf.slice(start, end).toString('utf8'), nextOffset: end };
}

function parseBounty(addr: PublicKey, data: Buffer): BountyOnChain {
  if (!data.slice(0, 8).equals(BOUNTY_V2_DISC)) {
    throw new Error('Account is not a BountyV2');
  }
  let o = 8;
  const id = data.readBigUInt64LE(o); o += 8;
  const sponsor = new PublicKey(data.slice(o, o + 32)); o += 32;
  const isOfficial = data.readUInt8(o) !== 0; o += 1;
  const paymentMint = new PublicKey(data.slice(o, o + 32)); o += 32;
  const escrowAccount = new PublicKey(data.slice(o, o + 32)); o += 32;
  const totalReward = data.readBigUInt64LE(o); o += 8;
  const awardedAmount = data.readBigUInt64LE(o); o += 8;
  const refundedAmount = data.readBigUInt64LE(o); o += 8;
  const maxWinners = data.readUInt8(o); o += 1;
  const winnersAwarded = data.readUInt8(o); o += 1;
  const submissionCount = data.readUInt32LE(o); o += 4;
  const deadline = Number(data.readBigInt64LE(o)); o += 8;
  const statusByte = data.readUInt8(o); o += 1;
  const status = ([
    BountyStatus.Open, BountyStatus.Closed, BountyStatus.FullyAwarded,
    BountyStatus.Expired, BountyStatus.Cancelled,
  ])[statusByte] ?? BountyStatus.Open;
  const metaRes = readString(data, o); o = metaRes.nextOffset;
  const titleRes = readString(data, o); o = titleRes.nextOffset;
  const createdAt = Number(data.readBigInt64LE(o)); o += 8;

  return {
    address: addr,
    id,
    sponsor,
    isOfficial,
    paymentMint,
    escrowAccount,
    totalReward,
    awardedAmount,
    refundedAmount,
    maxWinners,
    winnersAwarded,
    submissionCount,
    deadline,
    status,
    metadataUri: metaRes.value,
    title: titleRes.value,
    createdAt,
  };
}

function parseSubmission(addr: PublicKey, data: Buffer): SubmissionOnChain {
  if (!data.slice(0, 8).equals(SUBMISSION_DISC)) {
    throw new Error('Account is not a BountySubmission');
  }
  let o = 8;
  const bounty = new PublicKey(data.slice(o, o + 32)); o += 32;
  const submitter = new PublicKey(data.slice(o, o + 32)); o += 32;
  const uriRes = readString(data, o); o = uriRes.nextOffset;
  const submittedAt = Number(data.readBigInt64LE(o)); o += 8;
  const statusByte = data.readUInt8(o); o += 1;
  const status = ([SubmissionStatus.Pending, SubmissionStatus.Awarded, SubmissionStatus.Rejected])[statusByte] ?? SubmissionStatus.Pending;
  const awardedAmount = data.readBigUInt64LE(o); o += 8;

  return {
    address: addr,
    bounty,
    submitter,
    contentUri: uriRes.value,
    submittedAt,
    status,
    awardedAmount,
  };
}

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

function errRes(msg: string): TransactionResult {
  return { signature: '', success: false, error: msg };
}

/** Compute the net amount a winner receives, given a gross award. */
export function computeWinnerNet(gross: bigint): bigint {
  const fee = (gross * BigInt(BOUNTY_V2_FEE_BPS.TOTAL)) / 10_000n;
  return gross - fee;
}

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  [whitepaper-sync v1.1] §12 NFT Royalty enforcement                  ║
// ╚═════════════════════════════════════════════════════════════════════════╝
//
// Mirrors `programs/market/src/royalty.rs`. WP §12.1 specifies:
//   • min royalty 5% (500 bps)
//   • max royalty 45% (4500 bps)
//   • default royalty 5% (500 bps)
//   • protocol fee 5% (500 bps) on top — split 40/40/10/10 per §5.7.

export const NFT_ROYALTY_SEEDS = {
  CONFIG: Buffer.from('nft-royalty'),
} as const;

export const NFT_ROYALTY_BPS = {
  MIN: 500,
  MAX: 4500,
  DEFAULT: 500,
} as const;

/** Protocol fee bps on NFT secondary sales — same as CC / bounty paths. */
export const NFT_PROTOCOL_FEE_BPS = {
  TOTAL: 500,
  BURN: 200,
  STAKING: 200,
  GAS: 50,
  OPS: 50,
} as const;

/** Maximum combined deduction (royalty + protocol fee). Tops out at 50%. */
export const NFT_MAX_TOTAL_DEDUCTION_BPS = NFT_ROYALTY_BPS.MAX + NFT_PROTOCOL_FEE_BPS.TOTAL;

export interface NftSaleSplit {
  royalty: bigint;
  feeTotal: bigint;
  burn: bigint;
  staking: bigint;
  gas: bigint;
  ops: bigint;
  sellerNet: bigint;
}

/**
 * Compute the WP §12 split client-side. Mirrors `royalty::compute_nft_sale_split`
 * in the on-chain program. Useful for UIs that want to preview the
 * royalty + fee breakdown before the buyer signs the transaction.
 */
export function computeNftSaleSplit(salePrice: bigint, royaltyBps: number): NftSaleSplit {
  if (royaltyBps < NFT_ROYALTY_BPS.MIN || royaltyBps > NFT_ROYALTY_BPS.MAX) {
    throw new Error(
      `royaltyBps ${royaltyBps} out of range [${NFT_ROYALTY_BPS.MIN}, ${NFT_ROYALTY_BPS.MAX}]`
    );
  }
  const bps = BigInt(royaltyBps);
  const royalty = (salePrice * bps) / 10_000n;
  const feeTotal = (salePrice * BigInt(NFT_PROTOCOL_FEE_BPS.TOTAL)) / 10_000n;
  const burn = (salePrice * BigInt(NFT_PROTOCOL_FEE_BPS.BURN)) / 10_000n;
  const staking = (salePrice * BigInt(NFT_PROTOCOL_FEE_BPS.STAKING)) / 10_000n;
  const gas = (salePrice * BigInt(NFT_PROTOCOL_FEE_BPS.GAS)) / 10_000n;
  // Ops absorbs rounding residue — mirrors on-chain saturating_sub chain.
  const ops = feeTotal - burn - staking - gas;
  const sellerNet = salePrice - royalty - feeTotal;
  if (sellerNet < 0n) {
    throw new Error('Royalty + fee exceeded sale price');
  }
  return { royalty, feeTotal, burn, staking, gas, ops, sellerNet };
}

export interface NftRoyaltyConfigOnChain {
  address: PublicKey;
  nftMint: PublicKey;
  originalCreator: PublicKey;
  royaltyBps: number;
  createdAt: number;
  totalRoyaltiesPaid: bigint;
  saleCount: bigint;
  bump: number;
}

const NFT_ROYALTY_CONFIG_DISC = accountDiscriminator('NftRoyaltyConfig');

function parseNftRoyaltyConfig(addr: PublicKey, data: Buffer): NftRoyaltyConfigOnChain {
  if (!data.slice(0, 8).equals(NFT_ROYALTY_CONFIG_DISC)) {
    throw new Error('Account is not a NftRoyaltyConfig');
  }
  let o = 8;
  const nftMint = new PublicKey(data.slice(o, o + 32)); o += 32;
  const originalCreator = new PublicKey(data.slice(o, o + 32)); o += 32;
  const royaltyBps = data.readUInt16LE(o); o += 2;
  const createdAt = Number(data.readBigInt64LE(o)); o += 8;
  const totalRoyaltiesPaid = data.readBigUInt64LE(o); o += 8;
  const saleCount = data.readBigUInt64LE(o); o += 8;
  const bump = data.readUInt8(o); o += 1;
  return {
    address: addr,
    nftMint,
    originalCreator,
    royaltyBps,
    createdAt,
    totalRoyaltiesPaid,
    saleCount,
    bump,
  };
}

/** Derive the NftRoyaltyConfig PDA for an NFT mint. */
export function deriveNftRoyaltyConfig(
  programId: PublicKey,
  nftMint: PublicKey
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [NFT_ROYALTY_SEEDS.CONFIG, nftMint.toBuffer()],
    programId
  );
  return pda;
}

export interface SetRoyaltyParams {
  nftMint: PublicKey;
  /** Basis points; must be in [NFT_ROYALTY_BPS.MIN, NFT_ROYALTY_BPS.MAX]. */
  royaltyBps: number;
}

export interface EnforceRoyaltyParams {
  nftMint: PublicKey;
  salePrice: bigint | number;
  seller: PublicKey;
  /** Optional override; defaults to seller's ATA(ORA). */
  sellerOraAccount?: PublicKey;
  /** Optional override; defaults to buyer's (wallet) ATA(ORA). */
  buyerOraAccount?: PublicKey;
  /** Optional override; defaults to ATA(originalCreator, ORA). When omitted,
   *  the SDK fetches the on-chain royalty config to discover the creator. */
  creatorOraAccount?: PublicKey;
}

// ────────────────────────────────────────────────────────────────────────
// MarketModule — NFT royalty extensions
// ────────────────────────────────────────────────────────────────────────

declare module './market' {
  interface MarketModule {
    setRoyalty(params: SetRoyaltyParams): Promise<TransactionResult>;
    enforceRoyalty(params: EnforceRoyaltyParams): Promise<TransactionResult>;
    fetchNftRoyaltyConfig(nftMint: PublicKey): Promise<NftRoyaltyConfigOnChain | null>;
  }
}

MarketModule.prototype.setRoyalty = async function (
  this: MarketModule,
  params: SetRoyaltyParams
): Promise<TransactionResult> {
  const creator = (this as any).requireWallet() as PublicKey;
  if (
    params.royaltyBps < NFT_ROYALTY_BPS.MIN ||
    params.royaltyBps > NFT_ROYALTY_BPS.MAX
  ) {
    return errRes(
      `royaltyBps must be within [${NFT_ROYALTY_BPS.MIN}, ${NFT_ROYALTY_BPS.MAX}]`
    );
  }
  const programId = (this as any).programId as PublicKey;
  const royaltyConfig = deriveNftRoyaltyConfig(programId, params.nftMint);

  const u16LE = (v: number) => {
    const b = Buffer.alloc(2);
    b.writeUInt16LE(v, 0);
    return b;
  };

  const data = Buffer.concat([
    ixDiscriminator('set_royalty'),
    u16LE(params.royaltyBps),
  ]);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: royaltyConfig, isSigner: false, isWritable: true },
      { pubkey: params.nftMint, isSigner: false, isWritable: false },
      { pubkey: creator, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
  return (this as any).sendTx([ix]);
};

MarketModule.prototype.fetchNftRoyaltyConfig = async function (
  this: MarketModule,
  nftMint: PublicKey
): Promise<NftRoyaltyConfigOnChain | null> {
  const programId = (this as any).programId as PublicKey;
  const pda = deriveNftRoyaltyConfig(programId, nftMint);
  const acc = await (this as any).connection.getAccountInfo(pda);
  if (!acc) return null;
  return parseNftRoyaltyConfig(pda, acc.data);
};

MarketModule.prototype.enforceRoyalty = async function (
  this: MarketModule,
  params: EnforceRoyaltyParams
): Promise<TransactionResult> {
  const buyer = (this as any).requireWallet() as PublicKey;
  const cfg = (this as any).cfg as MarketModuleConfig;
  const programId = (this as any).programId as PublicKey;

  const royaltyConfig = deriveNftRoyaltyConfig(programId, params.nftMint);

  // Resolve creator ATA (requires fetching config when override absent).
  let creatorOraAccount = params.creatorOraAccount;
  if (!creatorOraAccount) {
    const onchain = await this.fetchNftRoyaltyConfig(params.nftMint);
    if (!onchain) return errRes('NftRoyaltyConfig not found — creator must call setRoyalty first');
    creatorOraAccount = await getAssociatedTokenAddress(cfg.oraMint, onchain.originalCreator);
  }

  const sellerOraAccount =
    params.sellerOraAccount ?? (await getAssociatedTokenAddress(cfg.oraMint, params.seller));
  const buyerOraAccount =
    params.buyerOraAccount ?? (await getAssociatedTokenAddress(cfg.oraMint, buyer));

  const data = Buffer.concat([
    ixDiscriminator('enforce_royalty_on_sale'),
    u64LE(BigInt(params.salePrice)),
  ]);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: royaltyConfig, isSigner: false, isWritable: true },
      { pubkey: params.nftMint, isSigner: false, isWritable: false },
      { pubkey: cfg.oraMint, isSigner: false, isWritable: false },
      { pubkey: buyerOraAccount, isSigner: false, isWritable: true },
      { pubkey: sellerOraAccount, isSigner: false, isWritable: true },
      { pubkey: creatorOraAccount, isSigner: false, isWritable: true },
      { pubkey: cfg.stakingRewardsPool, isSigner: false, isWritable: true },
      { pubkey: cfg.gasReservePool, isSigner: false, isWritable: true },
      { pubkey: cfg.opsTreasuryPool, isSigner: false, isWritable: true },
      { pubkey: params.seller, isSigner: true, isWritable: false },
      { pubkey: buyer, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });
  return (this as any).sendTx([ix]);
};
