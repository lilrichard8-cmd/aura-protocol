/**
 * VaultModule — vesting-vault on-chain operations.
 *
 * Wraps the `aura_vault` program (programs/vault/src/lib.rs):
 *   - initialize_vault_config()
 *   - initialize_vault()
 *   - deposit_earnings(amount)
 *   - spend_pending(amount, purpose)
 *   - claim_vested()
 *   - freeze_vault() / unfreeze_vault()   – arbitration only
 *   - seize_funds(amount)                 – arbitration only
 *
 * All discriminators are Anchor sha256("global:<snake>")[..8].
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
// Program-side constants — must match programs/vault/src/lib.rs
// ────────────────────────────────────────────────────────────────────────

export const VAULT_SEEDS = {
  CONFIG: Buffer.from('vault_config'),
  VAULT: Buffer.from('vault'),
} as const;

/** Seven-day vesting period (seconds). */
export const VAULT_VESTING_PERIOD_SECS = 7 * 24 * 60 * 60;

/** SpendPurpose enum — value indices must match Rust enum declaration order. */
export enum SpendPurpose {
  MintNFT = 0,
  AdBid = 1,
  Boost = 2,
  Other = 3,
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

export interface VaultPdas {
  config: PublicKey;
  vault(owner: PublicKey): PublicKey;
}

function makePdas(programId: PublicKey): VaultPdas {
  const [config] = PublicKey.findProgramAddressSync(
    [VAULT_SEEDS.CONFIG],
    programId
  );
  return {
    config,
    vault(owner) {
      const [pda] = PublicKey.findProgramAddressSync(
        [VAULT_SEEDS.VAULT, owner.toBuffer()],
        programId
      );
      return pda;
    },
  };
}

// ────────────────────────────────────────────────────────────────────────
// Account types (parsed)
// ────────────────────────────────────────────────────────────────────────

export interface VaultConfigOnChain {
  address: PublicKey;
  arbitrationAuthority: PublicKey;
  bump: number;
}

export interface VestingVaultOnChain {
  address: PublicKey;
  owner: PublicKey;
  pendingBalance: bigint;
  lockedBalance: bigint;
  totalEarned: bigint;
  totalClaimed: bigint;
  lastDepositTime: number;
  isFrozen: boolean;
  bump: number;
}

// ────────────────────────────────────────────────────────────────────────
// VaultModule
// ────────────────────────────────────────────────────────────────────────

export class VaultModule {
  public readonly pdas: VaultPdas;

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

  async fetchConfig(): Promise<VaultConfigOnChain | null> {
    const acc = await this.connection.getAccountInfo(this.pdas.config);
    if (!acc) return null;
    return parseVaultConfig(this.pdas.config, acc.data);
  }

  async fetchVault(owner: PublicKey): Promise<VestingVaultOnChain | null> {
    const pda = this.pdas.vault(owner);
    const acc = await this.connection.getAccountInfo(pda);
    if (!acc) return null;
    return parseVestingVault(pda, acc.data);
  }

  // ──────────────────────────────────────────────────────────────────
  // Write helpers
  // ──────────────────────────────────────────────────────────────────

  /** Initialise the singleton VaultConfig (sets caller as arbitration authority). */
  async initializeVaultConfig(): Promise<TransactionResult> {
    const admin = this.requireWallet();

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.pdas.config, isSigner: false, isWritable: true },
        { pubkey: admin, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('initialize_vault_config'),
    });
    return this.sendTx([ix]);
  }

  /** Initialise the caller's vesting vault PDA. */
  async initializeVault(): Promise<TransactionResult & { vault?: PublicKey }> {
    const owner = this.requireWallet();
    const vault = this.pdas.vault(owner);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('initialize_vault'),
    });
    const res = await this.sendTx([ix]);
    return { ...res, vault };
  }

  /** Add to pending balance (caller is the vault owner). */
  async depositEarnings(amount: bigint | number): Promise<TransactionResult> {
    const owner = this.requireWallet();
    if (BigInt(amount) <= 0n) return errRes('amount must be > 0');

    const vault = this.pdas.vault(owner);
    const data = Buffer.concat([
      ixDiscriminator('deposit_earnings'),
      u64LE(BigInt(amount)),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  /** Spend from pending balance (caller is the vault owner). */
  async spendPending(amount: bigint | number, purpose: SpendPurpose): Promise<TransactionResult> {
    const owner = this.requireWallet();
    if (BigInt(amount) <= 0n) return errRes('amount must be > 0');

    const vault = this.pdas.vault(owner);
    const data = Buffer.concat([
      ixDiscriminator('spend_pending'),
      u64LE(BigInt(amount)),
      u8(purpose),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  /** Claim everything that has finished vesting (7-day period since last deposit). */
  async claimVested(): Promise<TransactionResult> {
    const owner = this.requireWallet();
    const vault = this.pdas.vault(owner);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: true },
      ],
      data: ixDiscriminator('claim_vested'),
    });
    return this.sendTx([ix]);
  }

  /** Freeze a vault. Caller must be the arbitration authority recorded in VaultConfig. */
  async freezeVault(vaultOwner: PublicKey): Promise<TransactionResult> {
    return this.arbitrationAction(vaultOwner, 'freeze_vault');
  }

  /** Unfreeze a vault. Caller must be the arbitration authority. */
  async unfreezeVault(vaultOwner: PublicKey): Promise<TransactionResult> {
    return this.arbitrationAction(vaultOwner, 'unfreeze_vault');
  }

  private async arbitrationAction(
    vaultOwner: PublicKey,
    ixName: 'freeze_vault' | 'unfreeze_vault'
  ): Promise<TransactionResult> {
    const authority = this.requireWallet();
    const vault = this.pdas.vault(vaultOwner);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: this.pdas.config, isSigner: false, isWritable: false },
        { pubkey: authority, isSigner: true, isWritable: false },
      ],
      data: ixDiscriminator(ixName),
    });
    return this.sendTx([ix]);
  }

  /** Seize an amount from a vault's pending balance. Arbitration only. */
  async seizeFunds(args: {
    vaultOwner: PublicKey;
    recipient: PublicKey;
    amount: bigint | number;
  }): Promise<TransactionResult> {
    const authority = this.requireWallet();
    if (BigInt(args.amount) <= 0n) return errRes('amount must be > 0');

    const vault = this.pdas.vault(args.vaultOwner);
    const data = Buffer.concat([
      ixDiscriminator('seize_funds'),
      u64LE(BigInt(args.amount)),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: this.pdas.config, isSigner: false, isWritable: false },
        { pubkey: authority, isSigner: true, isWritable: false },
        { pubkey: args.recipient, isSigner: false, isWritable: true },
      ],
      data,
    });
    return this.sendTx([ix]);
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

export const VAULT_CONFIG_DISC = accountDiscriminator('VaultConfig');
export const VESTING_VAULT_DISC = accountDiscriminator('VestingVault');

function parseVaultConfig(addr: PublicKey, data: Buffer): VaultConfigOnChain {
  if (!data.slice(0, 8).equals(VAULT_CONFIG_DISC)) {
    throw new Error('Account is not a VaultConfig');
  }
  let o = 8;
  const arbitrationAuthority = new PublicKey(data.slice(o, o + 32)); o += 32;
  const bump = data.readUInt8(o); o += 1;
  return { address: addr, arbitrationAuthority, bump };
}

function parseVestingVault(addr: PublicKey, data: Buffer): VestingVaultOnChain {
  if (!data.slice(0, 8).equals(VESTING_VAULT_DISC)) {
    throw new Error('Account is not a VestingVault');
  }
  let o = 8;
  const owner = new PublicKey(data.slice(o, o + 32)); o += 32;
  const pendingBalance = data.readBigUInt64LE(o); o += 8;
  const lockedBalance = data.readBigUInt64LE(o); o += 8;
  const totalEarned = data.readBigUInt64LE(o); o += 8;
  const totalClaimed = data.readBigUInt64LE(o); o += 8;
  const lastDepositTime = Number(data.readBigInt64LE(o)); o += 8;
  const isFrozen = data.readUInt8(o) !== 0; o += 1;
  const bump = data.readUInt8(o); o += 1;
  return {
    address: addr,
    owner,
    pendingBalance,
    lockedBalance,
    totalEarned,
    totalClaimed,
    lastDepositTime,
    isFrozen,
    bump,
  };
}

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

function errRes(msg: string): TransactionResult {
  return { signature: '', success: false, error: msg };
}
