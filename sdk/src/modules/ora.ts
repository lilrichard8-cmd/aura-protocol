/**
 * OraModule — ORA token program on-chain operations.
 *
 * Wraps the `aura_ora` program (programs/ora/src/lib.rs):
 *   - initialize_ora()                        – create OraConfig + ORA mint PDAs
 *   - mint_initial_supply()                   – mint 1.05B initial supply (CPI → rewards)
 *   - mint_ora(amount)                        – authority-only mint (CPI → rewards)
 *   - burn_ora(amount)                        – user burn (subject to burn floor)
 *   - triple_burn(burn_type, amount)          – protocol-level burn router
 *   - distribute_reward()                     – Model C dual-decay reward (CPI → rewards)
 *   - process_fee(amount)                     – unified 5% fee split
 *   - mau_growth_mint(new_mau)                – MAU-tied growth mint (CPI → rewards)
 *
 * [audit fix C4.M-1 option-C] The ORA mint authority is the `rewards`
 * program's `reward_state` PDA. Every mint path therefore CPI's from `ora`
 * into `rewards::mint_for_*`. SDK callers MUST pass the rewards program id
 * + the `reward_state` PDA in the four mint instructions:
 *   - initializeOra (passes `reward_state` PDA so the mint's authority is
 *     pinned at create-time)
 *   - mintInitialSupply
 *   - mintOra
 *   - distributeReward
 *   - mauGrowthMint
 *
 * All discriminators are Anchor-style sha256("global:<snake>")[..8].
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
// Program-side constants — must match programs/ora/src/lib.rs
// ────────────────────────────────────────────────────────────────────────

export const ORA_SEEDS = {
  CONFIG: Buffer.from('ora_config'),
  MINT: Buffer.from('ora_mint'),
} as const;

/** [audit fix C4.M-1 option-C] rewards program PDA seed (the ORA mint authority). */
export const REWARDS_REWARD_STATE_SEED = Buffer.from('reward_state');

/**
 * [audit fix C4.M-1 option-C] derive the rewards `reward_state` PDA that
 * holds the ORA mint authority. Caller passes the deployed rewards program
 * id.
 */
export function deriveRewardStatePda(rewardsProgramId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [REWARDS_REWARD_STATE_SEED],
    rewardsProgramId
  );
  return pda;
}

export const ORA_DECIMALS = 9;
// [whitepaper-sync v1.1] synced to Whitepaper v1.1 §5.2 / Numbers Handbook §1.
export const ORA_INITIAL_SUPPLY: bigint = 1_100_000_000n * 1_000_000_000n; // 1.1B * 10^9
// [whitepaper-sync v1.1] synced to Whitepaper v1.1 §5.10 / Handbook §3.
export const ORA_MAU_GROWTH_MINT_PER_10K: bigint = 100_000n * 1_000_000_000n;
export const ORA_MAU_GROWTH_MINT_CAP: bigint = 75_000_000n * 1_000_000_000n;
/** Burn floor: stop burning when circulating supply < 30% of initial (330M). */
// [whitepaper-sync v1.1] rescaled to 30% of 1.1B = 330M.
export const ORA_BURN_FLOOR: bigint = 330_000_000n * 1_000_000_000n;

// ──────────────────────────────────────────────────────────────────────
// [whitepaper-sync v1.1] §5.2 Initial Supply Allocation (1.1B)
// ──────────────────────────────────────────────────────────────────────
export const ORA_ALLOCATION_TEAM: bigint = 150_000_000n * 1_000_000_000n;
export const ORA_ALLOCATION_TEAM_SOREN: bigint = 50_000_000n * 1_000_000_000n;
export const ORA_ALLOCATION_TEAM_IRIS: bigint = 30_000_000n * 1_000_000_000n;
export const ORA_ALLOCATION_TEAM_FUTURE: bigint = 70_000_000n * 1_000_000_000n;
export const ORA_ALLOCATION_COMMUNITY: bigint = 500_000_000n * 1_000_000_000n;
export const ORA_ALLOCATION_ECOSYSTEM: bigint = 200_000_000n * 1_000_000_000n;
export const ORA_ALLOCATION_LAUNCH_INCENTIVES: bigint = 150_000_000n * 1_000_000_000n;
export const ORA_ALLOCATION_LIQUIDITY: bigint = 100_000_000n * 1_000_000_000n;

// ──────────────────────────────────────────────────────────────────────
// [whitepaper-sync v1.1] §5.5 Management Performance Pool
// ──────────────────────────────────────────────────────────────────────
export const ORA_PERF_POOL_ANNUAL_BUDGET: bigint = 30_000_000n * 1_000_000_000n;
export const ORA_PERF_POOL_MAX_YEARS = 3;
export const ORA_PERF_POOL_MAX_TOTAL: bigint = 90_000_000n * 1_000_000_000n;

// ──────────────────────────────────────────────────────────────────────
// [whitepaper-sync v1.1] §5.8 Perpetual annual emission schedule
// ──────────────────────────────────────────────────────────────────────
export const ORA_ANNUAL_EMISSION_Y1_BPS = 500;   // 5%
export const ORA_ANNUAL_EMISSION_Y2_BPS = 400;   // 4%
export const ORA_ANNUAL_EMISSION_Y3_BPS = 300;   // 3%
export const ORA_ANNUAL_EMISSION_FLOOR_BPS = 200; // Y4+ permanent floor 2%
export const ORA_ANNUAL_EMISSION_CREATOR_SHARE_BPS = 8000; // 80%
export const ORA_ANNUAL_EMISSION_DAO_SHARE_BPS = 2000;     // 20%

// ──────────────────────────────────────────────────────────────────────
// [whitepaper-sync v1.1] §3 Storage emission framework + Y1 emergency authority
// ──────────────────────────────────────────────────────────────────────
export const ORA_STORAGE_EMISSION_TRIGGER_CAP_BPS = 300; // 3% per trigger
export const ORA_Y1_EMERGENCY_AUTHORITY_BPS = 100;       // 1% Y1 single mint
export const ORA_SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

/** BurnType enum — value indices must match Rust enum declaration order. */
export enum BurnType {
  IncentiveTax = 0,
  TransactionFee = 1,
  TypeBFeature = 2,
}

// ────────────────────────────────────────────────────────────────────────
// Anchor discriminator helpers
// ────────────────────────────────────────────────────────────────────────

export function ixDiscriminator(name: string): Buffer {
  const preimage = Buffer.from(`global:${name}`, 'utf8');
  return Buffer.from(sha256(preimage).slice(0, 8));
}

export function accountDiscriminator(name: string): Buffer {
  const preimage = Buffer.from(`account:${name}`, 'utf8');
  return Buffer.from(sha256(preimage).slice(0, 8));
}

// ────────────────────────────────────────────────────────────────────────
// Borsh primitives
// ────────────────────────────────────────────────────────────────────────

function u8(v: number): Buffer { const b = Buffer.alloc(1); b.writeUInt8(v, 0); return b; }
function u64LE(v: bigint | number): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(typeof v === 'bigint' ? v : BigInt(v), 0);
  return b;
}

// ────────────────────────────────────────────────────────────────────────
// PDA helpers
// ────────────────────────────────────────────────────────────────────────

export interface OraPdas {
  config: PublicKey;
  mint: PublicKey;
  configBump: number;
  mintBump: number;
}

function makePdas(programId: PublicKey): OraPdas {
  const [config, configBump] = PublicKey.findProgramAddressSync(
    [ORA_SEEDS.CONFIG],
    programId
  );
  const [mint, mintBump] = PublicKey.findProgramAddressSync(
    [ORA_SEEDS.MINT],
    programId
  );
  return { config, mint, configBump, mintBump };
}

// ────────────────────────────────────────────────────────────────────────
// Account types (parsed)
// ────────────────────────────────────────────────────────────────────────

export interface OraConfigOnChain {
  address: PublicKey;
  authority: PublicKey;
  mint: PublicKey;
  totalBurned: bigint;
  mauGrowthMinted: bigint;
  currentMau: bigint;
  lastMauCheckpoint: bigint;
  bump: number;
}

// ────────────────────────────────────────────────────────────────────────
// OraModule
// ────────────────────────────────────────────────────────────────────────

export class OraModule {
  public readonly pdas: OraPdas;

  constructor(
    private connection: Connection,
    private wallet: WalletAdapter,
    private programId: PublicKey
  ) {
    this.pdas = makePdas(programId);
  }

  // ──────────────────────────────────────────────────────────────────
  // Read helpers
  // ──────────────────────────────────────────────────────────────────

  async fetchConfig(): Promise<OraConfigOnChain | null> {
    const acc = await this.connection.getAccountInfo(this.pdas.config);
    if (!acc) return null;
    return parseOraConfig(this.pdas.config, acc.data);
  }

  /** Convenience: the ORA mint PDA address (same as `pdas.mint`). */
  get mint(): PublicKey {
    return this.pdas.mint;
  }

  // ──────────────────────────────────────────────────────────────────
  // Write helpers
  // ──────────────────────────────────────────────────────────────────

  /**
   * Initialise OraConfig + ORA mint. One-time (authority only).
   *
   * [audit fix C4.M-1 option-C] `rewardsProgramId` is required so the mint's
   * authority can be pinned to the rewards `reward_state` PDA at create-time.
   * Deploy order:
   *   1. ora::initialize_ora (this call, pins mint authority to rewards PDA)
   *   2. rewards::initialize_rewards (registers the ORA mint with rewards;
   *      its sanity check passes because the authority already matches)
   *   3. ora::mint_initial_supply (CPI's back into rewards to mint 1.05B)
   */
  async initializeOra(rewardsProgramId: PublicKey): Promise<TransactionResult> {
    const authority = this.requireWallet();
    const rewardStatePda = deriveRewardStatePda(rewardsProgramId);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.config, isSigner: false, isWritable: true },
        { pubkey: this.pdas.mint, isSigner: false, isWritable: true },
        // [audit fix C4.M-1 option-C] reward_state PDA (mint authority)
        { pubkey: rewardStatePda, isSigner: false, isWritable: false },
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('initialize_ora'),
    });
    return this.sendTx([ix]);
  }

  /**
   * Mint the 1.05B initial supply to the authority's token account.
   *
   * [audit fix C4.M-1 option-C] CPIs into `rewards::mint_for_initial_supply`.
   * Caller must pass the rewards program id so we can derive `reward_state`.
   */
  async mintInitialSupply(
    authorityTokenAccount: PublicKey,
    rewardsProgramId: PublicKey
  ): Promise<TransactionResult> {
    const authority = this.requireWallet();
    const rewardStatePda = deriveRewardStatePda(rewardsProgramId);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.config, isSigner: false, isWritable: true },
        { pubkey: this.pdas.mint, isSigner: false, isWritable: true },
        { pubkey: authorityTokenAccount, isSigner: false, isWritable: true },
        // [audit fix C4.M-1 option-C] reward_state + rewards_program for CPI
        { pubkey: rewardStatePda, isSigner: false, isWritable: false },
        { pubkey: authority, isSigner: true, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: rewardsProgramId, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('mint_initial_supply'),
    });
    return this.sendTx([ix]);
  }

  /**
   * Authority-only mint of ORA to a recipient token account.
   *
   * [audit fix C4.M-1 option-C] CPIs into `rewards::mint_for_ora` (purpose=AdHoc).
   */
  async mintOra(
    recipientTokenAccount: PublicKey,
    amount: bigint | number,
    rewardsProgramId: PublicKey
  ): Promise<TransactionResult> {
    const authority = this.requireWallet();
    if (BigInt(amount) <= 0n) return errRes('amount must be > 0');
    const rewardStatePda = deriveRewardStatePda(rewardsProgramId);

    const data = Buffer.concat([
      ixDiscriminator('mint_ora'),
      u64LE(BigInt(amount)),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.config, isSigner: false, isWritable: true },
        { pubkey: this.pdas.mint, isSigner: false, isWritable: true },
        { pubkey: recipientTokenAccount, isSigner: false, isWritable: true },
        // [audit fix C4.M-1 option-C] reward_state + rewards_program for CPI
        { pubkey: rewardStatePda, isSigner: false, isWritable: false },
        { pubkey: authority, isSigner: true, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: rewardsProgramId, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  /** Burn ORA from caller's token account (subject to burn floor). */
  async burnOra(userTokenAccount: PublicKey, amount: bigint | number): Promise<TransactionResult> {
    const user = this.requireWallet();
    if (BigInt(amount) <= 0n) return errRes('amount must be > 0');

    const data = Buffer.concat([
      ixDiscriminator('burn_ora'),
      u64LE(BigInt(amount)),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.config, isSigner: false, isWritable: true },
        { pubkey: this.pdas.mint, isSigner: false, isWritable: true },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: user, isSigner: true, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  /**
   * Triple-burn entry point.
   * - IncentiveTax: 10% of `amount` burned from sourceTokenAccount
   * - TransactionFee: 2.5% of `amount` * MAU multiplier
   * - TypeBFeature: 95% of `amount` burned
   * The caller (`authority`) must be the SPL-token authority of sourceTokenAccount.
   */
  async tripleBurn(
    burnType: BurnType,
    sourceTokenAccount: PublicKey,
    amount: bigint | number
  ): Promise<TransactionResult> {
    const authority = this.requireWallet();
    if (BigInt(amount) <= 0n) return errRes('amount must be > 0');

    const data = Buffer.concat([
      ixDiscriminator('triple_burn'),
      u8(burnType),
      u64LE(BigInt(amount)),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.config, isSigner: false, isWritable: true },
        { pubkey: this.pdas.mint, isSigner: false, isWritable: true },
        { pubkey: sourceTokenAccount, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  /**
   * Distribute Model C dual-decay reward (authority only).
   *
   * [audit fix C4.M-1 option-C] CPIs into `rewards::mint_for_ora` (purpose=DistributeReward).
   */
  async distributeReward(
    recipientTokenAccount: PublicKey,
    rewardsProgramId: PublicKey
  ): Promise<TransactionResult> {
    const authority = this.requireWallet();
    const rewardStatePda = deriveRewardStatePda(rewardsProgramId);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.config, isSigner: false, isWritable: true },
        { pubkey: this.pdas.mint, isSigner: false, isWritable: true },
        { pubkey: recipientTokenAccount, isSigner: false, isWritable: true },
        // [audit fix C4.M-1 option-C] reward_state + rewards_program for CPI
        { pubkey: rewardStatePda, isSigner: false, isWritable: false },
        { pubkey: authority, isSigner: true, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: rewardsProgramId, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('distribute_reward'),
    });
    return this.sendTx([ix]);
  }

  /**
   * Process unified 5% fee: 2.5% burn + 2% staking + 0.5% platform.
   * `feeSourceAccount` is the SPL token account `payer` controls and pays from.
   */
  async processFee(args: {
    feeSourceAccount: PublicKey;
    stakingPoolAccount: PublicKey;
    platformAccount: PublicKey;
    amount: bigint | number;
  }): Promise<TransactionResult> {
    const payer = this.requireWallet();
    if (BigInt(args.amount) <= 0n) return errRes('amount must be > 0');

    const data = Buffer.concat([
      ixDiscriminator('process_fee'),
      u64LE(BigInt(args.amount)),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.config, isSigner: false, isWritable: true },
        { pubkey: this.pdas.mint, isSigner: false, isWritable: true },
        { pubkey: args.feeSourceAccount, isSigner: false, isWritable: true },
        { pubkey: args.stakingPoolAccount, isSigner: false, isWritable: true },
        { pubkey: args.platformAccount, isSigner: false, isWritable: true },
        { pubkey: payer, isSigner: true, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  /**
   * MAU growth mint — per 10k new MAU → 500k ORA, cap 75M total.
   *
   * [audit fix C4.M-1 option-C] CPIs into `rewards::mint_for_growth`.
   */
  async mauGrowthMint(args: {
    growthReserveAccount: PublicKey;
    newMau: bigint | number;
    rewardsProgramId: PublicKey;
  }): Promise<TransactionResult> {
    const authority = this.requireWallet();
    const rewardStatePda = deriveRewardStatePda(args.rewardsProgramId);

    const data = Buffer.concat([
      ixDiscriminator('mau_growth_mint'),
      u64LE(BigInt(args.newMau)),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.config, isSigner: false, isWritable: true },
        { pubkey: this.pdas.mint, isSigner: false, isWritable: true },
        { pubkey: args.growthReserveAccount, isSigner: false, isWritable: true },
        // [audit fix C4.M-1 option-C] reward_state + rewards_program for CPI
        { pubkey: rewardStatePda, isSigner: false, isWritable: false },
        { pubkey: authority, isSigner: true, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: args.rewardsProgramId, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  // ──────────────────────────────────────────────────────────────────
  // Off-chain reward / fee math (mirrors the on-chain formulas)
  // ──────────────────────────────────────────────────────────────────

  /** Compute the gross reward (before 10% incentive-tax burn) for a given MAU.
   *  Base = 2 ORA (MAU<500k) / 1 ORA (MAU>=500k); bonus = 18 / (1 + MAU/50000). */
  static computeRewardGross(mau: bigint): bigint {
    const ten9 = 1_000_000_000n;
    const base: bigint = mau < 500_000n ? 2n * ten9 : ten9;
    const bonus: bigint = (18n * ten9 * 50_000n) / (50_000n + mau);
    return base + bonus;
  }

  /** Net reward after burning 10% incentive tax. */
  static computeRewardNet(mau: bigint): bigint {
    const gross = OraModule.computeRewardGross(mau);
    const burn = (gross * 10n) / 100n;
    return gross - burn;
  }

  /** Split a fee amount according to the unified 5% rule. Returns the four parts. */
  static computeFeeSplit(amount: bigint): {
    fee: bigint; burnPortion: bigint; stakingPortion: bigint; platformPortion: bigint;
  } {
    const fee = (amount * 5n) / 100n;
    const burnPortion = (fee * 50n) / 100n;       // 2.5% of total
    const stakingPortion = (fee * 40n) / 100n;    // 2% of total
    const platformPortion = fee - burnPortion - stakingPortion; // 0.5%
    return { fee, burnPortion, stakingPortion, platformPortion };
  }

  // ──────────────────────────────────────────────────────────────────
  // Internals
  // ──────────────────────────────────────────────────────────────────

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

export const ORA_CONFIG_DISC = accountDiscriminator('OraConfig');

function parseOraConfig(addr: PublicKey, data: Buffer): OraConfigOnChain {
  if (!data.slice(0, 8).equals(ORA_CONFIG_DISC)) {
    throw new Error('Account is not an OraConfig');
  }
  let o = 8;
  const authority = new PublicKey(data.slice(o, o + 32)); o += 32;
  const mint = new PublicKey(data.slice(o, o + 32)); o += 32;
  const totalBurned = data.readBigUInt64LE(o); o += 8;
  const mauGrowthMinted = data.readBigUInt64LE(o); o += 8;
  const currentMau = data.readBigUInt64LE(o); o += 8;
  const lastMauCheckpoint = data.readBigUInt64LE(o); o += 8;
  const bump = data.readUInt8(o); o += 1;
  return {
    address: addr,
    authority,
    mint,
    totalBurned,
    mauGrowthMinted,
    currentMau,
    lastMauCheckpoint,
    bump,
  };
}

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

function errRes(msg: string): TransactionResult {
  return { signature: '', success: false, error: msg };
}
