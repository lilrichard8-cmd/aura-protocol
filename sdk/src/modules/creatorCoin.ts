/**
 * CreatorCoinModule — Creator-coin issuance, trading, benefits, redemption.
 *
 * Wraps `aura_creator_coin` (programs/creator-coin/src/lib.rs + benefits.rs +
 * gift.rs + redemption.rs). All discriminators are real Anchor
 * (sha256("global:<snake_case>")[..8]); mirrors `market.ts`.
 *
 * Wrapped instructions:
 *   Core         : create_creator_coin, unlock_monthly
 *   Order book   : create_sell_order, fill_order, cancel_order
 *   Benefits     : init_benefits_list, add_benefit, update_benefit,
 *                  deactivate_benefit
 *   Redemption   : init_redemption_counter, initiate_redemption,
 *                  mark_delivered, confirm_receipt, auto_confirm,
 *                  dispute_redemption, execute_ruling
 *   Gifting      : gift_creator_coin
 *   Primary buy  : primary_buy
 *   Burn tracker : init_burn_tracker
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
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { sha256 } from '@noble/hashes/sha256';

import { TransactionResult } from '../types';

// ────────────────────────────────────────────────────────────────────────
// Constants — must match programs/creator-coin/src/lib.rs
// ────────────────────────────────────────────────────────────────────────

export const CREATOR_COIN_SEEDS = {
  CREATOR_COIN: Buffer.from('creator_coin'),
  CREATOR_COIN_MINT: Buffer.from('creator_coin_mint'),
  USER_PROFILE: Buffer.from('user'),
  ORDER: Buffer.from('order'),
  BENEFITS: Buffer.from('benefits'),
  REDEMPTION_COUNTER: Buffer.from('redemption-counter'),
  REDEMPTION: Buffer.from('redemption'),
  BURN_TRACKER: Buffer.from('burn-tracker'),
} as const;

export const CREATOR_COIN_LIMITS = {
  SYMBOL_MAX: 10,
  MAX_BENEFITS: 50,
  BENEFIT_URI_MAX: 200,
  REDEMPTION_URI_MAX: 200,
  GIFT_MEMO_URI_MAX: 200,
  MIN_FOLLOWERS: 100,
} as const;

/** Trading fee: 5% (200 burn + 200 staking + 50 gas + 50 ops). */
export const CREATOR_COIN_FEE_BPS = {
  TOTAL: 500,
  BURN: 200,
  STAKING: 200,
  GAS: 50,
  OPS: 50,
} as const;

export const INITIAL_SUPPLY_RAW = 2_000n * 1_000_000_000n; // 2000 * 1e9
export const TOTAL_SUPPLY_RAW = 10_000n * 1_000_000_000n;  // 10000 * 1e9
export const LOCKED_SUPPLY_RAW = 8_000n * 1_000_000_000n;  // 8000 * 1e9
export const MONTHLY_UNLOCK_RAW = 1_000n * 1_000_000_000n; // 1000 * 1e9
export const UNLOCK_MONTHS = 8;
export const MONTH_SECONDS = 30 * 24 * 60 * 60;

export enum BenefitType {
  Holding = 0,
  Consumable = 1,
}

export enum RedemptionStatus {
  PendingDelivery = 0,
  Delivered = 1,
  Confirmed = 2,
  Disputed = 3,
}

// ────────────────────────────────────────────────────────────────────────
// Anchor discriminator helpers
// ────────────────────────────────────────────────────────────────────────

function ixDiscriminator(name: string): Buffer {
  return Buffer.from(sha256(Buffer.from(`global:${name}`, 'utf8')).slice(0, 8));
}
function accountDiscriminator(name: string): Buffer {
  return Buffer.from(sha256(Buffer.from(`account:${name}`, 'utf8')).slice(0, 8));
}

export const CREATOR_COIN_DISC = accountDiscriminator('CreatorCoin');
export const ORDER_DISC = accountDiscriminator('Order');
export const BENEFITS_LIST_DISC = accountDiscriminator('BenefitsList');
export const REDEMPTION_DISC = accountDiscriminator('Redemption');
export const REDEMPTION_COUNTER_DISC = accountDiscriminator('RedemptionCounter');
export const BURN_TRACKER_DISC = accountDiscriminator('BurnTracker');

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
function bool(v: boolean): Buffer { return u8(v ? 1 : 0); }
function borshString(s: string): Buffer {
  const utf8 = Buffer.from(s, 'utf8');
  return Buffer.concat([u32LE(utf8.length), utf8]);
}
function bytes32(b: Buffer | Uint8Array): Buffer {
  const out = Buffer.alloc(32);
  Buffer.from(b).copy(out, 0, 0, Math.min(32, b.length));
  return out;
}

// ────────────────────────────────────────────────────────────────────────
// PDA helpers
// ────────────────────────────────────────────────────────────────────────

export interface CreatorCoinPdas {
  creatorCoin(creator: PublicKey): PublicKey;
  creatorCoinMint(creator: PublicKey): PublicKey;
  userProfile(user: PublicKey): PublicKey;
  benefits(coinMint: PublicKey): PublicKey;
  redemptionCounter(coinMint: PublicKey): PublicKey;
  redemption(coinMint: PublicKey, redemptionId: bigint | number): PublicKey;
  order(maker: PublicKey, orderNonce: bigint | number): PublicKey;
  burnTracker(): PublicKey;
}

function makePdas(programId: PublicKey): CreatorCoinPdas {
  const findPda = (seeds: Buffer[]) =>
    PublicKey.findProgramAddressSync(seeds, programId)[0];

  return {
    creatorCoin(creator) {
      return findPda([CREATOR_COIN_SEEDS.CREATOR_COIN, creator.toBuffer()]);
    },
    creatorCoinMint(creator) {
      return findPda([CREATOR_COIN_SEEDS.CREATOR_COIN_MINT, creator.toBuffer()]);
    },
    userProfile(user) {
      return findPda([CREATOR_COIN_SEEDS.USER_PROFILE, user.toBuffer()]);
    },
    benefits(coinMint) {
      return findPda([CREATOR_COIN_SEEDS.BENEFITS, coinMint.toBuffer()]);
    },
    redemptionCounter(coinMint) {
      return findPda([CREATOR_COIN_SEEDS.REDEMPTION_COUNTER, coinMint.toBuffer()]);
    },
    redemption(coinMint, id) {
      return findPda([
        CREATOR_COIN_SEEDS.REDEMPTION,
        coinMint.toBuffer(),
        u64LE(BigInt(id)),
      ]);
    },
    order(maker, nonce) {
      return findPda([
        CREATOR_COIN_SEEDS.ORDER,
        maker.toBuffer(),
        u64LE(BigInt(nonce)),
      ]);
    },
    burnTracker() {
      return findPda([CREATOR_COIN_SEEDS.BURN_TRACKER]);
    },
  };
}

// ────────────────────────────────────────────────────────────────────────
// Public param types
// ────────────────────────────────────────────────────────────────────────

export interface CreateCreatorCoinV2Params {
  symbol: string;
  initialPrice: bigint | number;
  activityOracle: PublicKey;
  creatorTokenAccount: PublicKey; // ATA(creator, creatorCoinMintPda)
}

export interface UnlockMonthlyParams {
  creator: PublicKey;
  monthlyPosts: number;
  monthlyTrades: number;
  monthlyInteractions: number;
  creatorTokenAccount: PublicKey;
}

export interface CreateSellOrderParams {
  creatorCoinAddress: PublicKey;
  amount: bigint | number;
  pricePerToken: bigint | number;
  orderNonce: bigint | number;
  makerCoinAccount: PublicKey;
  escrowCoinAccount: PublicKey;
}

export interface FillOrderParams {
  creatorCoin: PublicKey;
  order: PublicKey;
  escrowCoinAccount: PublicKey;
  buyerCoinAccount: PublicKey;
  buyerOraAccount: PublicKey;
  sellerOraAccount: PublicKey;
  oraMint: PublicKey;
  stakingPoolAccount: PublicKey;
  gasReserveAccount: PublicKey;
  opsTreasuryAccount: PublicKey;
  fillAmount: bigint | number;
}

export interface CancelOrderParams {
  creatorCoin: PublicKey;
  order: PublicKey;
  escrowCoinAccount: PublicKey;
  makerCoinAccount: PublicKey;
}

export interface AddBenefitParams {
  coinMint: PublicKey;
  benefitType: BenefitType;
  threshold: bigint | number;
  metadataUri: string;
  metadataHash: Buffer | Uint8Array;
}

export interface UpdateBenefitParams {
  coinMint: PublicKey;
  benefitId: number;
  threshold?: bigint | number;
  metadataUri?: string;
  metadataHash?: Buffer | Uint8Array;
}

export interface DeactivateBenefitParams {
  coinMint: PublicKey;
  benefitId: number;
}

export interface InitiateRedemptionParams {
  coinMint: PublicKey;
  benefitId: number;
  cost: bigint | number;
  buyerTokenAccount: PublicKey;
  escrowTokenAccount: PublicKey;
  creator: PublicKey;
}

export interface MarkDeliveredParams {
  redemptionId: bigint | number;
  coinMint: PublicKey;
  noteUri: string;
  noteHash: Buffer | Uint8Array;
}

export interface ConfirmReceiptParams {
  redemptionId: bigint | number;
  coinMint: PublicKey;
  escrowTokenAccount: PublicKey;
  creatorTokenAccount: PublicKey;
}

export interface AutoConfirmParams {
  redemptionId: bigint | number;
  coinMint: PublicKey;
  escrowTokenAccount: PublicKey;
  creatorTokenAccount: PublicKey;
}

export interface DisputeRedemptionParams {
  redemptionId: bigint | number;
  coinMint: PublicKey;
  reasonUri: string;
  reasonHash: Buffer | Uint8Array;
}

export interface ExecuteRulingParams {
  redemptionId: bigint | number;
  coinMint: PublicKey;
  creatorShareBps: number;
  escrowTokenAccount: PublicKey;
  creatorTokenAccount: PublicKey;
  buyerTokenAccount: PublicKey;
  authority: PublicKey; // PROTOCOL_AUTHORITY signer (currently SystemProgram placeholder)
}

export interface GiftCreatorCoinParams {
  coinMint: PublicKey;
  senderTokenAccount: PublicKey;
  recipient: PublicKey;
  recipientTokenAccount: PublicKey; // ATA(recipient, coinMint) — init_if_needed on-chain
  amount: bigint | number;
  memoUri: string;
}

export interface PrimaryBuyParams {
  creator: PublicKey;
  amount: bigint | number;
  buyerOraAccount: PublicKey;
  creatorOraAccount: PublicKey;
  oraMint: PublicKey;
  stakingPoolAccount: PublicKey;
  gasReserveAccount: PublicKey;
  opsTreasuryAccount: PublicKey;
  buyerCcAccount: PublicKey;
}

// ────────────────────────────────────────────────────────────────────────
// On-chain account shapes (parsed via Borsh)
// ────────────────────────────────────────────────────────────────────────

export interface CreatorCoinOnChain {
  address: PublicKey;
  creator: PublicKey;
  mint: PublicKey;
  symbol: string;
  initialPrice: bigint;
  totalSupply: bigint;
  circulatingSupply: bigint;
  lockedSupply: bigint;
  monthsUnlocked: number;
  lastUnlockTime: number;
  createdAt: number;
  totalTradingVolume: bigint;
  totalFeesEarned: bigint;
  activityOracle: PublicKey;
  bump: number;
}

export interface BurnTrackerOnChain {
  totalBurnedLamports: bigint;
  lastUpdatedSlot: bigint;
  bump: number;
}

// ────────────────────────────────────────────────────────────────────────
// CreatorCoinModule
// ────────────────────────────────────────────────────────────────────────

export class CreatorCoinModule {
  public readonly pdas: CreatorCoinPdas;

  constructor(
    private connection: Connection,
    private wallet: WalletAdapter,
    private programId: PublicKey
  ) {
    this.pdas = makePdas(programId);
  }

  // ────────────────────────────────────────────────────────────────────
  // Read helpers
  // ────────────────────────────────────────────────────────────────────

  async fetchCreatorCoin(creator: PublicKey): Promise<CreatorCoinOnChain | null> {
    const addr = this.pdas.creatorCoin(creator);
    const acc = await this.connection.getAccountInfo(addr);
    if (!acc) return null;
    return parseCreatorCoin(addr, acc.data);
  }

  async fetchBurnTracker(): Promise<BurnTrackerOnChain | null> {
    const acc = await this.connection.getAccountInfo(this.pdas.burnTracker());
    if (!acc) return null;
    return parseBurnTracker(acc.data);
  }

  // ────────────────────────────────────────────────────────────────────
  // Core
  // ────────────────────────────────────────────────────────────────────

  async createCreatorCoin(params: CreateCreatorCoinV2Params): Promise<TransactionResult & { creatorCoin?: PublicKey; mint?: PublicKey }> {
    const creator = this.requireWallet();
    if (params.symbol.length > CREATOR_COIN_LIMITS.SYMBOL_MAX)
      return errRes(`symbol exceeds ${CREATOR_COIN_LIMITS.SYMBOL_MAX} chars`);

    const creatorCoinPda = this.pdas.creatorCoin(creator);
    const mintPda = this.pdas.creatorCoinMint(creator);
    const benefitsPda = this.pdas.benefits(mintPda);
    const profilePda = this.pdas.userProfile(creator);

    const data = Buffer.concat([
      ixDiscriminator('create_creator_coin'),
      borshString(params.symbol),
      u64LE(BigInt(params.initialPrice)),
      params.activityOracle.toBuffer(),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: creatorCoinPda, isSigner: false, isWritable: true },
        { pubkey: mintPda, isSigner: false, isWritable: true },
        { pubkey: benefitsPda, isSigner: false, isWritable: true },
        { pubkey: params.creatorTokenAccount, isSigner: false, isWritable: true },
        { pubkey: profilePda, isSigner: false, isWritable: false },
        { pubkey: creator, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data,
    });
    const res = await this.sendTx([ix]);
    return { ...res, creatorCoin: creatorCoinPda, mint: mintPda };
  }

  /** Oracle-signed monthly unlock. The transaction must be signed by the
   *  oracle authority recorded on `creator_coin.activity_oracle` — i.e. the
   *  wallet connected here must be the oracle, not the creator. */
  async unlockMonthly(params: UnlockMonthlyParams): Promise<TransactionResult> {
    const oracle = this.requireWallet();
    const creatorCoinPda = this.pdas.creatorCoin(params.creator);
    const mintPda = this.pdas.creatorCoinMint(params.creator);

    const data = Buffer.concat([
      ixDiscriminator('unlock_monthly'),
      u32LE(params.monthlyPosts),
      u32LE(params.monthlyTrades),
      u32LE(params.monthlyInteractions),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: creatorCoinPda, isSigner: false, isWritable: true },
        { pubkey: mintPda, isSigner: false, isWritable: true },
        { pubkey: params.creatorTokenAccount, isSigner: false, isWritable: true },
        { pubkey: params.creator, isSigner: false, isWritable: false },
        { pubkey: oracle, isSigner: true, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  // ────────────────────────────────────────────────────────────────────
  // Order book
  // ────────────────────────────────────────────────────────────────────

  async createSellOrder(params: CreateSellOrderParams): Promise<TransactionResult & { order?: PublicKey }> {
    const maker = this.requireWallet();
    const orderPda = this.pdas.order(maker, params.orderNonce);

    const data = Buffer.concat([
      ixDiscriminator('create_sell_order'),
      u64LE(BigInt(params.amount)),
      u64LE(BigInt(params.pricePerToken)),
      u64LE(BigInt(params.orderNonce)),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: params.creatorCoinAddress, isSigner: false, isWritable: false },
        { pubkey: orderPda, isSigner: false, isWritable: true },
        { pubkey: params.makerCoinAccount, isSigner: false, isWritable: true },
        { pubkey: params.escrowCoinAccount, isSigner: false, isWritable: true },
        { pubkey: maker, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    const res = await this.sendTx([ix]);
    return { ...res, order: orderPda };
  }

  async fillOrder(params: FillOrderParams): Promise<TransactionResult> {
    const buyer = this.requireWallet();
    const data = Buffer.concat([
      ixDiscriminator('fill_order'),
      u64LE(BigInt(params.fillAmount)),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: params.creatorCoin, isSigner: false, isWritable: true },
        { pubkey: params.order, isSigner: false, isWritable: true },
        { pubkey: params.escrowCoinAccount, isSigner: false, isWritable: true },
        { pubkey: params.buyerCoinAccount, isSigner: false, isWritable: true },
        { pubkey: params.buyerOraAccount, isSigner: false, isWritable: true },
        { pubkey: params.sellerOraAccount, isSigner: false, isWritable: true },
        { pubkey: params.oraMint, isSigner: false, isWritable: false },
        { pubkey: params.stakingPoolAccount, isSigner: false, isWritable: true },
        { pubkey: params.gasReserveAccount, isSigner: false, isWritable: true },
        { pubkey: params.opsTreasuryAccount, isSigner: false, isWritable: true },
        { pubkey: buyer, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async cancelOrder(params: CancelOrderParams): Promise<TransactionResult> {
    const maker = this.requireWallet();
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: params.creatorCoin, isSigner: false, isWritable: false },
        { pubkey: params.order, isSigner: false, isWritable: true },
        { pubkey: params.escrowCoinAccount, isSigner: false, isWritable: true },
        { pubkey: params.makerCoinAccount, isSigner: false, isWritable: true },
        { pubkey: maker, isSigner: true, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('cancel_order'),
    });
    return this.sendTx([ix]);
  }

  // ────────────────────────────────────────────────────────────────────
  // Benefits
  // ────────────────────────────────────────────────────────────────────

  async initBenefitsList(coinMint: PublicKey): Promise<TransactionResult> {
    const creator = this.requireWallet();
    const creatorCoinPda = this.pdas.creatorCoin(creator);
    const benefitsPda = this.pdas.benefits(coinMint);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: creatorCoinPda, isSigner: false, isWritable: false },
        { pubkey: benefitsPda, isSigner: false, isWritable: true },
        { pubkey: coinMint, isSigner: false, isWritable: false },
        { pubkey: creator, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('init_benefits_list'),
    });
    return this.sendTx([ix]);
  }

  async addBenefit(params: AddBenefitParams): Promise<TransactionResult> {
    const creator = this.requireWallet();
    if (params.metadataUri.length > CREATOR_COIN_LIMITS.BENEFIT_URI_MAX)
      return errRes(`metadataUri exceeds ${CREATOR_COIN_LIMITS.BENEFIT_URI_MAX} chars`);

    const benefitsPda = this.pdas.benefits(params.coinMint);
    const data = Buffer.concat([
      ixDiscriminator('add_benefit'),
      u8(params.benefitType),
      u64LE(BigInt(params.threshold)),
      borshString(params.metadataUri),
      bytes32(params.metadataHash as Buffer),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: benefitsPda, isSigner: false, isWritable: true },
        { pubkey: creator, isSigner: true, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async updateBenefit(params: UpdateBenefitParams): Promise<TransactionResult> {
    const creator = this.requireWallet();
    const benefitsPda = this.pdas.benefits(params.coinMint);

    // Option<u64> / Option<String> / Option<[u8;32]> encoded as 1-byte tag + value.
    const thresholdBuf = params.threshold !== undefined
      ? Buffer.concat([u8(1), u64LE(BigInt(params.threshold))])
      : u8(0);
    const uriBuf = params.metadataUri !== undefined
      ? Buffer.concat([u8(1), borshString(params.metadataUri)])
      : u8(0);
    const hashBuf = params.metadataHash !== undefined
      ? Buffer.concat([u8(1), bytes32(params.metadataHash as Buffer)])
      : u8(0);

    const data = Buffer.concat([
      ixDiscriminator('update_benefit'),
      u32LE(params.benefitId),
      thresholdBuf,
      uriBuf,
      hashBuf,
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: benefitsPda, isSigner: false, isWritable: true },
        { pubkey: creator, isSigner: true, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async deactivateBenefit(params: DeactivateBenefitParams): Promise<TransactionResult> {
    const creator = this.requireWallet();
    const benefitsPda = this.pdas.benefits(params.coinMint);
    const data = Buffer.concat([
      ixDiscriminator('deactivate_benefit'),
      u32LE(params.benefitId),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: benefitsPda, isSigner: false, isWritable: true },
        { pubkey: creator, isSigner: true, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  // ────────────────────────────────────────────────────────────────────
  // Redemption
  // ────────────────────────────────────────────────────────────────────

  /**
   * Initialize the per-coin Redemption counter.
   *
   * Account order matches `InitRedemptionCounterCtx` (creator-coin/src/lib.rs):
   *   redemption_counter | creator_coin | coin_mint | creator(signer) |
   *   payer(signer) | system_program
   *
   * The connected wallet MUST be the coin's creator (it signs both as
   * creator and as payer). Anchor's `Signers` deduplicates so the wallet
   * appears once.
   *
   * 2026-05-19 SDK fix — earlier revision was missing `creator_coin` +
   * a separate `creator` signer entry and would always fail the
   * `constraint = creator_coin.creator == creator.key()` check.
   */
  async initRedemptionCounter(coinMint: PublicKey): Promise<TransactionResult> {
    const creator = this.requireWallet();
    const counterPda = this.pdas.redemptionCounter(coinMint);
    const creatorCoinPda = this.pdas.creatorCoin(creator);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: counterPda, isSigner: false, isWritable: true },
        { pubkey: creatorCoinPda, isSigner: false, isWritable: false },
        { pubkey: coinMint, isSigner: false, isWritable: false },
        // Anchor allows the same wallet to be both `creator` and `payer`.
        // We still list it twice with isSigner=true to be explicit about
        // the on-chain account constraints.
        { pubkey: creator, isSigner: true, isWritable: false },
        { pubkey: creator, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('init_redemption_counter'),
    });
    return this.sendTx([ix]);
  }

  async initiateRedemption(params: InitiateRedemptionParams): Promise<TransactionResult & { redemption?: PublicKey }> {
    const buyer = this.requireWallet();
    const benefitsPda = this.pdas.benefits(params.coinMint);
    const counterPda = this.pdas.redemptionCounter(params.coinMint);

    // The redemption PDA depends on the on-chain counter value at execution
    // time. Caller must fetch the counter and pass `currentCount` via the
    // SDK; we cannot derive deterministically without an extra RPC.
    // To keep parity with the Rust seed derivation we fetch here.
    const counterAcc = await this.connection.getAccountInfo(counterPda);
    if (!counterAcc) return errRes('redemption counter not initialized');
    // Layout: discriminator(8) + coin_mint(32) + count(8) + bump(1)
    const count = counterAcc.data.readBigUInt64LE(8 + 32);
    const redemptionPda = this.pdas.redemption(params.coinMint, count);

    const data = Buffer.concat([
      ixDiscriminator('initiate_redemption'),
      u32LE(params.benefitId),
      u64LE(BigInt(params.cost)),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: benefitsPda, isSigner: false, isWritable: false },
        { pubkey: counterPda, isSigner: false, isWritable: true },
        { pubkey: redemptionPda, isSigner: false, isWritable: true },
        { pubkey: params.buyerTokenAccount, isSigner: false, isWritable: true },
        { pubkey: params.escrowTokenAccount, isSigner: false, isWritable: true },
        { pubkey: params.creator, isSigner: false, isWritable: false },
        { pubkey: buyer, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    const res = await this.sendTx([ix]);
    return { ...res, redemption: redemptionPda };
  }

  async markDelivered(params: MarkDeliveredParams): Promise<TransactionResult> {
    const creator = this.requireWallet();
    if (params.noteUri.length > CREATOR_COIN_LIMITS.REDEMPTION_URI_MAX)
      return errRes(`noteUri exceeds ${CREATOR_COIN_LIMITS.REDEMPTION_URI_MAX} chars`);
    const redemptionPda = this.pdas.redemption(params.coinMint, params.redemptionId);
    const data = Buffer.concat([
      ixDiscriminator('mark_delivered'),
      u64LE(BigInt(params.redemptionId)),
      borshString(params.noteUri),
      bytes32(params.noteHash as Buffer),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: redemptionPda, isSigner: false, isWritable: true },
        { pubkey: creator, isSigner: true, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async confirmReceipt(params: ConfirmReceiptParams): Promise<TransactionResult> {
    const buyer = this.requireWallet();
    const redemptionPda = this.pdas.redemption(params.coinMint, params.redemptionId);
    const data = Buffer.concat([
      ixDiscriminator('confirm_receipt'),
      u64LE(BigInt(params.redemptionId)),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: redemptionPda, isSigner: false, isWritable: true },
        { pubkey: params.escrowTokenAccount, isSigner: false, isWritable: true },
        { pubkey: params.creatorTokenAccount, isSigner: false, isWritable: true },
        { pubkey: buyer, isSigner: true, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async autoConfirm(params: AutoConfirmParams): Promise<TransactionResult> {
    const keeper = this.requireWallet();
    const redemptionPda = this.pdas.redemption(params.coinMint, params.redemptionId);
    const data = Buffer.concat([
      ixDiscriminator('auto_confirm'),
      u64LE(BigInt(params.redemptionId)),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: redemptionPda, isSigner: false, isWritable: true },
        { pubkey: params.escrowTokenAccount, isSigner: false, isWritable: true },
        { pubkey: params.creatorTokenAccount, isSigner: false, isWritable: true },
        { pubkey: keeper, isSigner: true, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async disputeRedemption(params: DisputeRedemptionParams): Promise<TransactionResult> {
    const buyer = this.requireWallet();
    if (params.reasonUri.length > CREATOR_COIN_LIMITS.REDEMPTION_URI_MAX)
      return errRes(`reasonUri exceeds ${CREATOR_COIN_LIMITS.REDEMPTION_URI_MAX} chars`);
    const redemptionPda = this.pdas.redemption(params.coinMint, params.redemptionId);
    const data = Buffer.concat([
      ixDiscriminator('dispute_redemption'),
      u64LE(BigInt(params.redemptionId)),
      borshString(params.reasonUri),
      bytes32(params.reasonHash as Buffer),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: redemptionPda, isSigner: false, isWritable: true },
        { pubkey: buyer, isSigner: true, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async executeRuling(params: ExecuteRulingParams): Promise<TransactionResult> {
    // Authority must sign — passed by caller; the connected wallet should
    // either BE the authority or this tx must be co-signed.
    const _wallet = this.requireWallet();
    if (params.creatorShareBps > 10_000)
      return errRes('creatorShareBps must be 0..=10000');
    const redemptionPda = this.pdas.redemption(params.coinMint, params.redemptionId);
    const data = Buffer.concat([
      ixDiscriminator('execute_ruling'),
      u64LE(BigInt(params.redemptionId)),
      u16LE(params.creatorShareBps),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: redemptionPda, isSigner: false, isWritable: true },
        { pubkey: params.escrowTokenAccount, isSigner: false, isWritable: true },
        { pubkey: params.creatorTokenAccount, isSigner: false, isWritable: true },
        { pubkey: params.buyerTokenAccount, isSigner: false, isWritable: true },
        { pubkey: params.authority, isSigner: true, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  // ────────────────────────────────────────────────────────────────────
  // Gift
  // ────────────────────────────────────────────────────────────────────

  async giftCreatorCoin(params: GiftCreatorCoinParams): Promise<TransactionResult> {
    const sender = this.requireWallet();
    if (params.memoUri.length > CREATOR_COIN_LIMITS.GIFT_MEMO_URI_MAX)
      return errRes(`memoUri exceeds ${CREATOR_COIN_LIMITS.GIFT_MEMO_URI_MAX} chars`);
    const data = Buffer.concat([
      ixDiscriminator('gift_creator_coin'),
      u64LE(BigInt(params.amount)),
      borshString(params.memoUri),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: params.coinMint, isSigner: false, isWritable: false },
        { pubkey: params.senderTokenAccount, isSigner: false, isWritable: true },
        { pubkey: params.recipientTokenAccount, isSigner: false, isWritable: true },
        { pubkey: params.recipient, isSigner: false, isWritable: false },
        { pubkey: sender, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  // ────────────────────────────────────────────────────────────────────
  // Primary issuance
  // ────────────────────────────────────────────────────────────────────

  async primaryBuy(params: PrimaryBuyParams): Promise<TransactionResult> {
    const buyer = this.requireWallet();
    const creatorCoinPda = this.pdas.creatorCoin(params.creator);
    const mintPda = this.pdas.creatorCoinMint(params.creator);
    const burnTrackerPda = this.pdas.burnTracker();

    const data = Buffer.concat([
      ixDiscriminator('primary_buy'),
      u64LE(BigInt(params.amount)),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: creatorCoinPda, isSigner: false, isWritable: true },
        { pubkey: mintPda, isSigner: false, isWritable: true },
        { pubkey: params.buyerOraAccount, isSigner: false, isWritable: true },
        { pubkey: params.creatorOraAccount, isSigner: false, isWritable: true },
        { pubkey: params.oraMint, isSigner: false, isWritable: false },
        { pubkey: params.stakingPoolAccount, isSigner: false, isWritable: true },
        { pubkey: params.gasReserveAccount, isSigner: false, isWritable: true },
        { pubkey: params.opsTreasuryAccount, isSigner: false, isWritable: true },
        { pubkey: params.buyerCcAccount, isSigner: false, isWritable: true },
        { pubkey: burnTrackerPda, isSigner: false, isWritable: true },
        { pubkey: buyer, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  // ────────────────────────────────────────────────────────────────────
  // Burn tracker init
  // ────────────────────────────────────────────────────────────────────

  async initBurnTracker(): Promise<TransactionResult> {
    const payer = this.requireWallet();
    const burnTrackerPda = this.pdas.burnTracker();
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: burnTrackerPda, isSigner: false, isWritable: true },
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('init_burn_tracker'),
    });
    return this.sendTx([ix]);
  }

  // ────────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────────

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
// Account parsers
// ────────────────────────────────────────────────────────────────────────

function readString(buf: Buffer, offset: number): { value: string; nextOffset: number } {
  const len = buf.readUInt32LE(offset);
  const start = offset + 4;
  const end = start + len;
  return { value: buf.slice(start, end).toString('utf8'), nextOffset: end };
}

function parseCreatorCoin(addr: PublicKey, data: Buffer): CreatorCoinOnChain {
  if (!data.slice(0, 8).equals(CREATOR_COIN_DISC)) {
    throw new Error('Account is not a CreatorCoin');
  }
  let o = 8;
  const creator = new PublicKey(data.slice(o, o + 32)); o += 32;
  const mint = new PublicKey(data.slice(o, o + 32)); o += 32;
  const sym = readString(data, o); o = sym.nextOffset;
  const initialPrice = data.readBigUInt64LE(o); o += 8;
  const totalSupply = data.readBigUInt64LE(o); o += 8;
  const circulatingSupply = data.readBigUInt64LE(o); o += 8;
  const lockedSupply = data.readBigUInt64LE(o); o += 8;
  const monthsUnlocked = data.readUInt8(o); o += 1;
  const lastUnlockTime = Number(data.readBigInt64LE(o)); o += 8;
  const createdAt = Number(data.readBigInt64LE(o)); o += 8;
  const totalTradingVolume = data.readBigUInt64LE(o); o += 8;
  const totalFeesEarned = data.readBigUInt64LE(o); o += 8;
  const activityOracle = new PublicKey(data.slice(o, o + 32)); o += 32;
  const bump = data.readUInt8(o); o += 1;

  return {
    address: addr,
    creator,
    mint,
    symbol: sym.value,
    initialPrice,
    totalSupply,
    circulatingSupply,
    lockedSupply,
    monthsUnlocked,
    lastUnlockTime,
    createdAt,
    totalTradingVolume,
    totalFeesEarned,
    activityOracle,
    bump,
  };
}

function parseBurnTracker(data: Buffer): BurnTrackerOnChain {
  if (!data.slice(0, 8).equals(BURN_TRACKER_DISC)) {
    throw new Error('Account is not a BurnTracker');
  }
  // u128 (16 bytes) + u64 (8) + u8 (1)
  let o = 8;
  // Read u128 as two u64s combined
  const lo = data.readBigUInt64LE(o);
  const hi = data.readBigUInt64LE(o + 8);
  const totalBurnedLamports = lo + (hi << 64n);
  o += 16;
  const lastUpdatedSlot = data.readBigUInt64LE(o); o += 8;
  const bump = data.readUInt8(o);
  return { totalBurnedLamports, lastUpdatedSlot, bump };
}

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

function errRes(msg: string): TransactionResult {
  return { signature: '', success: false, error: msg };
}

export const __internals = {
  ixDiscriminator,
  accountDiscriminator,
  u8, u16LE, u32LE, u64LE, bool, borshString, bytes32,
};
