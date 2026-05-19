/**
 * FractionalizeModule — NFT fractionalization on-chain operations.
 *
 * Wraps `aura_fractionalize` (programs/fractionalize/src/lib.rs).
 * Real Anchor discriminators (sha256("global:<name>")[..8]).
 *
 * Wrapped instructions:
 *   fractionalize_nft, buy_fragment, sell_fragment, distribute_revenue,
 *   claim_revenue, vote_on_license, finalize_license_vote, reclaim_nft.
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
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { sha256 } from '@noble/hashes/sha256';

import { TransactionResult } from '../types';

// ────────────────────────────────────────────────────────────────────────
// Constants — must match programs/fractionalize/src/lib.rs
// ────────────────────────────────────────────────────────────────────────

export const FRACTIONALIZE_SEEDS = {
  FRACTIONAL_NFT: Buffer.from('fractional_nft'),
  FRAGMENT_MINT: Buffer.from('fragment_mint'),
  NFT_VAULT: Buffer.from('nft_vault'),
  REVENUE_VAULT: Buffer.from('revenue_vault'),
  FRAGMENT_HOLDER: Buffer.from('fragment_holder'),
  LICENSE_VOTE: Buffer.from('license_vote'),
} as const;

export const FRACTIONALIZE_LIMITS = {
  MAX_FRAGMENTS: 1_000_000n,
  DEFAULT_VOTE_THRESHOLD_BPS: 5_000, // 50%
  VOTING_PERIOD_SECONDS: 72 * 60 * 60,
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

export const FRACTIONAL_NFT_DISC = accountDiscriminator('FractionalNFT');
export const FRAGMENT_HOLDER_DISC = accountDiscriminator('FragmentHolder');
export const LICENSE_VOTE_DISC = accountDiscriminator('LicenseVote');

// ────────────────────────────────────────────────────────────────────────
// Borsh primitives
// ────────────────────────────────────────────────────────────────────────

function u8(v: number): Buffer { const b = Buffer.alloc(1); b.writeUInt8(v, 0); return b; }
function u64LE(v: bigint | number): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(typeof v === 'bigint' ? v : BigInt(v), 0);
  return b;
}
function bool(v: boolean): Buffer { return u8(v ? 1 : 0); }

// ────────────────────────────────────────────────────────────────────────
// PDA helpers
// ────────────────────────────────────────────────────────────────────────

export interface FractionalizePdas {
  fractionalNft(nftMint: PublicKey): PublicKey;
  fragmentMint(nftMint: PublicKey): PublicKey;
  nftVault(nftMint: PublicKey): PublicKey;
  revenueVault(nftMint: PublicKey): PublicKey;
  fragmentHolder(fractionalNft: PublicKey, holder: PublicKey): PublicKey;
  licenseVote(fractionalNft: PublicKey, proposalId: bigint | number): PublicKey;
}

function makePdas(programId: PublicKey): FractionalizePdas {
  const findPda = (seeds: Buffer[]) =>
    PublicKey.findProgramAddressSync(seeds, programId)[0];
  return {
    fractionalNft(nft) {
      return findPda([FRACTIONALIZE_SEEDS.FRACTIONAL_NFT, nft.toBuffer()]);
    },
    fragmentMint(nft) {
      return findPda([FRACTIONALIZE_SEEDS.FRAGMENT_MINT, nft.toBuffer()]);
    },
    nftVault(nft) {
      return findPda([FRACTIONALIZE_SEEDS.NFT_VAULT, nft.toBuffer()]);
    },
    revenueVault(nft) {
      return findPda([FRACTIONALIZE_SEEDS.REVENUE_VAULT, nft.toBuffer()]);
    },
    fragmentHolder(fnft, holder) {
      return findPda([
        FRACTIONALIZE_SEEDS.FRAGMENT_HOLDER,
        fnft.toBuffer(),
        holder.toBuffer(),
      ]);
    },
    licenseVote(fnft, id) {
      return findPda([
        FRACTIONALIZE_SEEDS.LICENSE_VOTE,
        fnft.toBuffer(),
        u64LE(BigInt(id)),
      ]);
    },
  };
}

// ────────────────────────────────────────────────────────────────────────
// Public params
// ────────────────────────────────────────────────────────────────────────

export interface FractionalizeNftParams {
  nftMint: PublicKey;
  ownerNftAccount: PublicKey;
  totalFragments: bigint | number;
  pricePerFragment: bigint | number;
}

export interface BuyFragmentParams {
  nftMint: PublicKey;
  buyerFragmentAccount: PublicKey;
  amount: bigint | number;
}

export interface SellFragmentParams {
  nftMint: PublicKey;
  sellerFragmentAccount: PublicKey;
  amount: bigint | number;
}

export interface DistributeRevenueParams {
  nftMint: PublicKey;
  revenueAmount: bigint | number;
}

export interface ClaimRevenueParams {
  nftMint: PublicKey;
}

export interface VoteOnLicenseParams {
  nftMint: PublicKey;
  licenseProposalId: bigint | number;
  approve: boolean;
}

export interface FinalizeLicenseVoteParams {
  nftMint: PublicKey;
  licenseProposalId: bigint | number;
}

export interface ReclaimNftParams {
  nftMint: PublicKey;
  ownerNftAccount: PublicKey;
}

// ────────────────────────────────────────────────────────────────────────
// On-chain shapes
// ────────────────────────────────────────────────────────────────────────

export interface FractionalNftOnChain {
  address: PublicKey;
  originalNft: PublicKey;
  originalOwner: PublicKey;
  fragmentMint: PublicKey;
  totalFragments: bigint;
  fragmentsSold: bigint;
  pricePerFragment: bigint;
  totalRevenue: bigint;
  revenueDistributed: bigint;
  isActive: boolean;
  createdAt: number;
  voteThresholdBps: number;
  bump: number;
}

export interface FragmentHolderOnChain {
  address: PublicKey;
  holder: PublicKey;
  fractionalNft: PublicKey;
  fragmentsOwned: bigint;
  totalInvested: bigint;
  revenueClaimed: bigint;
  hasVoted: boolean;
  bump: number;
}

// ────────────────────────────────────────────────────────────────────────
// FractionalizeModule
// ────────────────────────────────────────────────────────────────────────

export class FractionalizeModule {
  public readonly pdas: FractionalizePdas;

  constructor(
    private connection: Connection,
    private wallet: WalletAdapter,
    private programId: PublicKey
  ) {
    this.pdas = makePdas(programId);
  }

  // ── Read helpers ─────────────────────────────────────────────────────

  async fetchFractionalNft(nftMint: PublicKey): Promise<FractionalNftOnChain | null> {
    const addr = this.pdas.fractionalNft(nftMint);
    const acc = await this.connection.getAccountInfo(addr);
    if (!acc) return null;
    return parseFractionalNft(addr, acc.data);
  }

  async fetchFragmentHolder(nftMint: PublicKey, holder: PublicKey): Promise<FragmentHolderOnChain | null> {
    const fnft = this.pdas.fractionalNft(nftMint);
    const addr = this.pdas.fragmentHolder(fnft, holder);
    const acc = await this.connection.getAccountInfo(addr);
    if (!acc) return null;
    return parseFragmentHolder(addr, acc.data);
  }

  // ── Write helpers ────────────────────────────────────────────────────

  /**
   * fractionalizeNft — [stack-fix 2026-05-19] The on-chain program now
   * splits the original monolithic `fractionalize_nft` instruction into
   * three sub-instructions (init_fractional_state, init_fragment_mint,
   * init_vaults_and_lock) to stay under the 4KB BPF stack cap. This SDK
   * method batches all three into a single transaction so the public
   * interface is unchanged from the caller's perspective.
   */
  async fractionalizeNft(params: FractionalizeNftParams): Promise<TransactionResult & { fractionalNft?: PublicKey; fragmentMint?: PublicKey }> {
    const owner = this.requireWallet();
    if (BigInt(params.totalFragments) > FRACTIONALIZE_LIMITS.MAX_FRAGMENTS)
      return errRes('totalFragments exceeds max');

    const fnft = this.pdas.fractionalNft(params.nftMint);
    const fragMint = this.pdas.fragmentMint(params.nftMint);
    const nftVault = this.pdas.nftVault(params.nftMint);
    const revVault = this.pdas.revenueVault(params.nftMint);

    // Step 1/3: init_fractional_state
    const ix1 = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: fnft, isSigner: false, isWritable: true },
        { pubkey: params.nftMint, isSigner: false, isWritable: false },
        { pubkey: owner, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([
        ixDiscriminator('init_fractional_state'),
        u64LE(BigInt(params.totalFragments)),
        u64LE(BigInt(params.pricePerFragment)),
      ]),
    });

    // Step 2/3: init_fragment_mint
    const ix2 = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: fnft, isSigner: false, isWritable: true },
        { pubkey: fragMint, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('init_fragment_mint'),
    });

    // Step 3/3: init_vaults_and_lock
    const ix3 = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: fnft, isSigner: false, isWritable: true },
        { pubkey: params.nftMint, isSigner: false, isWritable: false },
        { pubkey: nftVault, isSigner: false, isWritable: true },
        { pubkey: revVault, isSigner: false, isWritable: true },
        { pubkey: params.ownerNftAccount, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('init_vaults_and_lock'),
    });

    const res = await this.sendTx([ix1, ix2, ix3]);
    return { ...res, fractionalNft: fnft, fragmentMint: fragMint };
  }

  async buyFragment(params: BuyFragmentParams): Promise<TransactionResult> {
    const buyer = this.requireWallet();
    const fnft = this.pdas.fractionalNft(params.nftMint);
    const fragMint = this.pdas.fragmentMint(params.nftMint);
    const revVault = this.pdas.revenueVault(params.nftMint);
    const holderPda = this.pdas.fragmentHolder(fnft, buyer);

    const data = Buffer.concat([
      ixDiscriminator('buy_fragment'),
      u64LE(BigInt(params.amount)),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: fnft, isSigner: false, isWritable: true },
        { pubkey: fragMint, isSigner: false, isWritable: true },
        { pubkey: revVault, isSigner: false, isWritable: true },
        { pubkey: holderPda, isSigner: false, isWritable: true },
        { pubkey: params.buyerFragmentAccount, isSigner: false, isWritable: true },
        { pubkey: buyer, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async sellFragment(params: SellFragmentParams): Promise<TransactionResult> {
    const seller = this.requireWallet();
    const fnft = this.pdas.fractionalNft(params.nftMint);
    const fragMint = this.pdas.fragmentMint(params.nftMint);
    const revVault = this.pdas.revenueVault(params.nftMint);
    const holderPda = this.pdas.fragmentHolder(fnft, seller);

    const data = Buffer.concat([
      ixDiscriminator('sell_fragment'),
      u64LE(BigInt(params.amount)),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        // [audit/sell] fractional_nft is `mut` in the Accounts struct;
        // marking it writable.
        { pubkey: fnft, isSigner: false, isWritable: true },
        { pubkey: fragMint, isSigner: false, isWritable: true },
        { pubkey: revVault, isSigner: false, isWritable: true },
        { pubkey: holderPda, isSigner: false, isWritable: true },
        { pubkey: params.sellerFragmentAccount, isSigner: false, isWritable: true },
        // [stack-fix 2026-05-19] Optional license_vote: pass program id
        // sentinel to indicate None (Anchor 0.29 convention).
        { pubkey: this.programId, isSigner: false, isWritable: false },
        { pubkey: seller, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async distributeRevenue(params: DistributeRevenueParams): Promise<TransactionResult> {
    const authority = this.requireWallet();
    const fnft = this.pdas.fractionalNft(params.nftMint);
    const data = Buffer.concat([
      ixDiscriminator('distribute_revenue'),
      u64LE(BigInt(params.revenueAmount)),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: fnft, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async claimRevenue(params: ClaimRevenueParams): Promise<TransactionResult> {
    const holder = this.requireWallet();
    const fnft = this.pdas.fractionalNft(params.nftMint);
    const holderPda = this.pdas.fragmentHolder(fnft, holder);
    const revVault = this.pdas.revenueVault(params.nftMint);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: fnft, isSigner: false, isWritable: false },
        { pubkey: holderPda, isSigner: false, isWritable: true },
        { pubkey: revVault, isSigner: false, isWritable: true },
        { pubkey: holder, isSigner: true, isWritable: true },
      ],
      data: ixDiscriminator('claim_revenue'),
    });
    return this.sendTx([ix]);
  }

  async voteOnLicense(params: VoteOnLicenseParams): Promise<TransactionResult & { licenseVote?: PublicKey }> {
    const voter = this.requireWallet();
    const fnft = this.pdas.fractionalNft(params.nftMint);
    const holderPda = this.pdas.fragmentHolder(fnft, voter);
    const votePda = this.pdas.licenseVote(fnft, params.licenseProposalId);

    const data = Buffer.concat([
      ixDiscriminator('vote_on_license'),
      u64LE(BigInt(params.licenseProposalId)),
      bool(params.approve),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: fnft, isSigner: false, isWritable: false },
        { pubkey: holderPda, isSigner: false, isWritable: true },
        { pubkey: votePda, isSigner: false, isWritable: true },
        { pubkey: voter, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    const res = await this.sendTx([ix]);
    return { ...res, licenseVote: votePda };
  }

  async finalizeLicenseVote(params: FinalizeLicenseVoteParams): Promise<TransactionResult> {
    const authority = this.requireWallet();
    const fnft = this.pdas.fractionalNft(params.nftMint);
    const votePda = this.pdas.licenseVote(fnft, params.licenseProposalId);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: fnft, isSigner: false, isWritable: false },
        { pubkey: votePda, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: false },
      ],
      data: ixDiscriminator('finalize_license_vote'),
    });
    return this.sendTx([ix]);
  }

  async reclaimNft(params: ReclaimNftParams): Promise<TransactionResult> {
    const owner = this.requireWallet();
    const fnft = this.pdas.fractionalNft(params.nftMint);
    const holderPda = this.pdas.fragmentHolder(fnft, owner);
    const nftVault = this.pdas.nftVault(params.nftMint);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: fnft, isSigner: false, isWritable: true },
        { pubkey: holderPda, isSigner: false, isWritable: false },
        { pubkey: nftVault, isSigner: false, isWritable: true },
        { pubkey: params.ownerNftAccount, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('reclaim_nft'),
    });
    return this.sendTx([ix]);
  }

  // ── Internals ────────────────────────────────────────────────────────

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

function parseFractionalNft(addr: PublicKey, data: Buffer): FractionalNftOnChain {
  if (!data.slice(0, 8).equals(FRACTIONAL_NFT_DISC)) {
    throw new Error('Account is not a FractionalNFT');
  }
  let o = 8;
  const originalNft = new PublicKey(data.slice(o, o + 32)); o += 32;
  const originalOwner = new PublicKey(data.slice(o, o + 32)); o += 32;
  const fragmentMint = new PublicKey(data.slice(o, o + 32)); o += 32;
  const totalFragments = data.readBigUInt64LE(o); o += 8;
  const fragmentsSold = data.readBigUInt64LE(o); o += 8;
  const pricePerFragment = data.readBigUInt64LE(o); o += 8;
  const totalRevenue = data.readBigUInt64LE(o); o += 8;
  const revenueDistributed = data.readBigUInt64LE(o); o += 8;
  const isActive = data.readUInt8(o) !== 0; o += 1;
  const createdAt = Number(data.readBigInt64LE(o)); o += 8;
  const voteThresholdBps = data.readUInt16LE(o); o += 2;
  const bump = data.readUInt8(o);
  return {
    address: addr,
    originalNft, originalOwner, fragmentMint,
    totalFragments, fragmentsSold, pricePerFragment,
    totalRevenue, revenueDistributed, isActive,
    createdAt, voteThresholdBps, bump,
  };
}

function parseFragmentHolder(addr: PublicKey, data: Buffer): FragmentHolderOnChain {
  if (!data.slice(0, 8).equals(FRAGMENT_HOLDER_DISC)) {
    throw new Error('Account is not a FragmentHolder');
  }
  let o = 8;
  const holder = new PublicKey(data.slice(o, o + 32)); o += 32;
  const fractionalNft = new PublicKey(data.slice(o, o + 32)); o += 32;
  const fragmentsOwned = data.readBigUInt64LE(o); o += 8;
  const totalInvested = data.readBigUInt64LE(o); o += 8;
  const revenueClaimed = data.readBigUInt64LE(o); o += 8;
  const hasVoted = data.readUInt8(o) !== 0; o += 1;
  const bump = data.readUInt8(o);
  return {
    address: addr,
    holder, fractionalNft, fragmentsOwned, totalInvested,
    revenueClaimed, hasVoted, bump,
  };
}

function errRes(msg: string): TransactionResult {
  return { signature: '', success: false, error: msg };
}

export const __internals = {
  ixDiscriminator,
  accountDiscriminator,
  u8, u64LE, bool,
};
