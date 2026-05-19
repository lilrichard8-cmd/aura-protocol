/**
 * useCreatorCoinRedemption — dedicated facade for the Creator-Coin
 * "Taobao-style" redemption flow (fan locks CC in escrow → creator
 * delivers perk → fan confirms / disputes → auto-confirm after timeout).
 *
 * Why a separate hook? `useCreatorCoinContract` is already overloaded
 * with primary-buy / order-book / mint flows. Redemption has its own
 * counter + Redemption account schema and its own lifecycle, so giving
 * it a small, focused hook makes the page wiring readable.
 *
 * Feature-flag: piggy-backs on `VITE_CREATOR_COIN_REAL_CHAIN`. When the
 * flag is off OR the wallet is not connected the hook returns
 * `{ enabled: false }` and callers should fall back to MockChain
 * bookkeeping.
 *
 * Shape mirrors the underlying SDK module:
 *   • initRedemptionCounter(coinMint)
 *   • initiateRedemption({coinMint, benefitId, cost, creator})
 *   • markDelivered({coinMint, redemptionId, noteUri, noteHash})
 *   • confirmReceipt({coinMint, redemptionId, creator})
 *   • disputeRedemption({coinMint, redemptionId, reasonUri, reasonHash})
 *   • autoConfirm({coinMint, redemptionId, creator})
 *   • executeRuling({coinMint, redemptionId, creator, buyer, creatorShareBps})
 *
 * Pages pass logical inputs (creator address, benefit id, cost, …); the
 * hook derives all the ATAs and the redemption PDA. PDA derivation for
 * the escrow ATA uses `allowOwnerOffCurve=true` because the redemption
 * account is itself a PDA (matches the on-chain init_if_needed in
 * `initiate_redemption`).
 */

import { useMemo, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { sha256 } from '@noble/hashes/sha256';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import {
  CreatorCoinModule,
  PROGRAM_IDS,
  REDEMPTION_DISC,
  RedemptionStatus,
  type TransactionResult,
} from '@aura-protocol/sdk';
import {
  useUnifiedWalletAsAdapter,
  type UnifiedWalletAdapter,
} from './useUnifiedWallet';

const CREATOR_COIN_PROGRAM_ID = PROGRAM_IDS.LOCALNET.creatorCoin;

// ────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────

/** Mirrors the on-chain Redemption account (creator-coin/src/redemption.rs). */
export interface RedemptionOnChain {
  address: PublicKey;
  id: bigint;
  coinMint: PublicKey;
  benefitId: number;
  cost: bigint;
  buyer: PublicKey;
  creator: PublicKey;
  status: RedemptionStatus;
  createdAtSlot: bigint;
  deliveredAtSlot: bigint | null;
  confirmedAtSlot: bigint | null;
  disputedAtSlot: bigint | null;
  deliveryNoteUri: string;
  deliveryNoteHash: Buffer;
  disputeReasonUri: string;
  disputeReasonHash: Buffer;
  bump: number;
}

export interface RedemptionCounterOnChain {
  address: PublicKey;
  coinMint: PublicKey;
  count: bigint;
  bump: number;
}

export interface CreatorCoinRedemption {
  enabled: boolean;
  module: CreatorCoinModule | null;
  payer: PublicKey | null;

  // ── reads ─────────────────────────────────────────────────────────
  fetchCounter: (coinMint: PublicKey) => Promise<RedemptionCounterOnChain | null>;
  fetchRedemption: (
    coinMint: PublicKey,
    redemptionId: bigint | number,
  ) => Promise<RedemptionOnChain | null>;
  /** Find all Redemption accounts for a given mint, optionally filtered
   *  by buyer or creator (uses memcmp). */
  listRedemptions: (filter: {
    coinMint?: PublicKey;
    buyer?: PublicKey;
    creator?: PublicKey;
  }) => Promise<RedemptionOnChain[]>;

  // ── writes ────────────────────────────────────────────────────────
  /** One-time init of the redemption counter (creator op, idempotent). */
  initRedemptionCounter: (coinMint: PublicKey) => Promise<TransactionResult>;

  /** Fan locks `cost` CC into escrow and creates the Redemption PDA. */
  initiateRedemption: (params: {
    coinMint: PublicKey;
    creator: PublicKey;
    benefitId: number;
    cost: bigint | number;
  }) => Promise<TransactionResult & { redemption?: PublicKey }>;

  /** Creator op: mark a redemption as delivered with an optional note. */
  markDelivered: (params: {
    coinMint: PublicKey;
    redemptionId: bigint | number;
    noteUri?: string;
  }) => Promise<TransactionResult>;

  /** Fan op: confirm receipt → CC released from escrow → creator. */
  confirmReceipt: (params: {
    coinMint: PublicKey;
    redemptionId: bigint | number;
    creator: PublicKey;
  }) => Promise<TransactionResult>;

  /** Keeper op (anyone): release escrow to creator after AUTO_CONFIRM
   *  slots have elapsed and status is still Delivered. */
  autoConfirm: (params: {
    coinMint: PublicKey;
    redemptionId: bigint | number;
    creator: PublicKey;
  }) => Promise<TransactionResult>;

  /** Fan op: dispute a delivered redemption with a reason. */
  disputeRedemption: (params: {
    coinMint: PublicKey;
    redemptionId: bigint | number;
    reasonUri?: string;
  }) => Promise<TransactionResult>;

  /** Arbitrator op: execute the final ruling, splitting escrow between
   *  creator (bps) and buyer (rest). */
  executeRuling: (params: {
    coinMint: PublicKey;
    redemptionId: bigint | number;
    creator: PublicKey;
    buyer: PublicKey;
    creatorShareBps: number;
  }) => Promise<TransactionResult>;
}

// ────────────────────────────────────────────────────────────────────────
// Implementation
// ────────────────────────────────────────────────────────────────────────

function hashNote(text: string): Buffer {
  return Buffer.from(sha256(Buffer.from(text, 'utf8')));
}

function escrowAtaFor(coinMint: PublicKey, redemptionPda: PublicKey): PublicKey {
  // Redemption account is a PDA → owner is off-curve.
  return getAssociatedTokenAddressSync(coinMint, redemptionPda, true);
}

// Borsh layout for Redemption:
//   disc(8) | id(8) | coin_mint(32) | benefit_id(4) | cost(8) |
//   buyer(32) | creator(32) | status(1) |
//   created_at_slot(8) |
//   delivered_at_slot Option<u64> (1+8) |
//   confirmed_at_slot Option<u64> (1+8) |
//   disputed_at_slot  Option<u64> (1+8) |
//   delivery_note_uri (4 + len) | delivery_note_hash(32) |
//   dispute_reason_uri(4 + len) | dispute_reason_hash(32) |
//   bump(1)
function parseRedemption(addr: PublicKey, data: Buffer): RedemptionOnChain {
  if (!data.slice(0, 8).equals(REDEMPTION_DISC)) {
    throw new Error('Account is not a Redemption');
  }
  let o = 8;
  const id = data.readBigUInt64LE(o); o += 8;
  const coinMint = new PublicKey(data.slice(o, o + 32)); o += 32;
  const benefitId = data.readUInt32LE(o); o += 4;
  const cost = data.readBigUInt64LE(o); o += 8;
  const buyer = new PublicKey(data.slice(o, o + 32)); o += 32;
  const creator = new PublicKey(data.slice(o, o + 32)); o += 32;
  const statusByte = data.readUInt8(o); o += 1;
  const status = statusByte as RedemptionStatus;
  const createdAtSlot = data.readBigUInt64LE(o); o += 8;

  const readOptU64 = (): bigint | null => {
    const tag = data.readUInt8(o); o += 1;
    if (tag === 0) return null;
    const v = data.readBigUInt64LE(o); o += 8;
    return v;
  };
  const deliveredAtSlot = readOptU64();
  const confirmedAtSlot = readOptU64();
  const disputedAtSlot = readOptU64();

  const readString = (): string => {
    const len = data.readUInt32LE(o); o += 4;
    const s = data.slice(o, o + len).toString('utf8'); o += len;
    return s;
  };
  const deliveryNoteUri = readString();
  const deliveryNoteHash = Buffer.from(data.slice(o, o + 32)); o += 32;
  const disputeReasonUri = readString();
  const disputeReasonHash = Buffer.from(data.slice(o, o + 32)); o += 32;
  const bump = data.readUInt8(o);

  return {
    address: addr,
    id, coinMint, benefitId, cost, buyer, creator,
    status, createdAtSlot, deliveredAtSlot, confirmedAtSlot,
    disputedAtSlot, deliveryNoteUri, deliveryNoteHash,
    disputeReasonUri, disputeReasonHash, bump,
  };
}

function parseCounter(addr: PublicKey, data: Buffer): RedemptionCounterOnChain {
  // disc(8) | coin_mint(32) | count(8) | bump(1)
  return {
    address: addr,
    coinMint: new PublicKey(data.slice(8, 40)),
    count: data.readBigUInt64LE(40),
    bump: data.readUInt8(48),
  };
}

function readFlag(): boolean {
  const raw = (import.meta as any).env?.VITE_CREATOR_COIN_REAL_CHAIN;
  if (raw === undefined) return false;
  return raw === 'true' || raw === true;
}

const noResult: TransactionResult = {
  signature: '',
  success: false,
  error: 'Wallet not connected or redemption disabled',
};

export function useCreatorCoinRedemption(): CreatorCoinRedemption {
  const { connection } = useConnection();
  const wallet = useUnifiedWalletAsAdapter();
  const enabled = readFlag();

  const module = useMemo(() => {
    if (!enabled) return null;
    return new CreatorCoinModule(
      connection,
      wallet as UnifiedWalletAdapter,
      CREATOR_COIN_PROGRAM_ID,
    );
  }, [connection, wallet, enabled]);

  // ── reads ─────────────────────────────────────────────────────────

  const fetchCounter = useCallback(
    async (coinMint: PublicKey): Promise<RedemptionCounterOnChain | null> => {
      if (!module) return null;
      const addr = module.pdas.redemptionCounter(coinMint);
      const acc = await connection.getAccountInfo(addr);
      if (!acc) return null;
      try {
        return parseCounter(addr, acc.data);
      } catch (e) {
        console.warn('[useCreatorCoinRedemption] parseCounter failed', e);
        return null;
      }
    },
    [module, connection],
  );

  const fetchRedemption = useCallback(
    async (
      coinMint: PublicKey,
      redemptionId: bigint | number,
    ): Promise<RedemptionOnChain | null> => {
      if (!module) return null;
      const addr = module.pdas.redemption(coinMint, redemptionId);
      const acc = await connection.getAccountInfo(addr);
      if (!acc) return null;
      try {
        return parseRedemption(addr, acc.data);
      } catch (e) {
        console.warn('[useCreatorCoinRedemption] parseRedemption failed', e);
        return null;
      }
    },
    [module, connection],
  );

  const listRedemptions = useCallback(
    async (filter: {
      coinMint?: PublicKey;
      buyer?: PublicKey;
      creator?: PublicKey;
    }): Promise<RedemptionOnChain[]> => {
      if (!module) return [];
      // Build memcmp filters against the Redemption layout:
      //   disc(8) | id(8) | coin_mint(32@16) | benefit_id(4) | cost(8) |
      //   buyer(32@64) | creator(32@96) | …
      const filters: any[] = [
        // Account-disc filter
        { memcmp: { offset: 0, bytes: bs58Encode(REDEMPTION_DISC) } },
      ];
      if (filter.coinMint) {
        filters.push({
          memcmp: { offset: 16, bytes: filter.coinMint.toBase58() },
        });
      }
      if (filter.buyer) {
        filters.push({
          memcmp: { offset: 64, bytes: filter.buyer.toBase58() },
        });
      }
      if (filter.creator) {
        filters.push({
          memcmp: { offset: 96, bytes: filter.creator.toBase58() },
        });
      }
      const accs = await connection.getProgramAccounts(
        CREATOR_COIN_PROGRAM_ID,
        { filters, commitment: 'confirmed' },
      );
      const out: RedemptionOnChain[] = [];
      for (const { pubkey, account } of accs) {
        try {
          out.push(parseRedemption(pubkey, account.data as Buffer));
        } catch {
          // skip malformed
        }
      }
      // Newest first by createdAtSlot
      out.sort((a, b) => Number(b.createdAtSlot - a.createdAtSlot));
      return out;
    },
    [module, connection],
  );

  // ── writes ────────────────────────────────────────────────────────

  const initRedemptionCounter = useCallback(
    async (coinMint: PublicKey) => {
      if (!module || !wallet.publicKey) return noResult;
      return module.initRedemptionCounter(coinMint);
    },
    [module, wallet],
  );

  const initiateRedemption: CreatorCoinRedemption['initiateRedemption'] =
    useCallback(
      async ({ coinMint, creator, benefitId, cost }) => {
        if (!module || !wallet.publicKey) return noResult;
        const buyer = wallet.publicKey;
        // Counter must exist; on-chain seeds depend on its current value
        // (the SDK reads it inside `initiateRedemption`). The escrow ATA
        // owner is the redemption PDA, which we have to pre-derive using
        // the same count value the SDK is about to use.
        const counterPda = module.pdas.redemptionCounter(coinMint);
        const counterAcc = await connection.getAccountInfo(counterPda);
        if (!counterAcc) {
          return {
            signature: '',
            success: false,
            error:
              'Redemption counter not initialized — creator must call initRedemptionCounter first',
          };
        }
        const count = counterAcc.data.readBigUInt64LE(8 + 32);
        const redemptionPda = module.pdas.redemption(coinMint, count);
        const buyerTokenAccount = getAssociatedTokenAddressSync(
          coinMint,
          buyer,
          false,
        );
        const escrowTokenAccount = escrowAtaFor(coinMint, redemptionPda);

        return module.initiateRedemption({
          coinMint,
          benefitId,
          cost,
          buyerTokenAccount,
          escrowTokenAccount,
          creator,
        });
      },
      [module, wallet, connection],
    );

  const markDelivered: CreatorCoinRedemption['markDelivered'] = useCallback(
    async ({ coinMint, redemptionId, noteUri }) => {
      if (!module || !wallet.publicKey) return noResult;
      const note = (noteUri ?? '').slice(0, 200);
      return module.markDelivered({
        redemptionId,
        coinMint,
        noteUri: note,
        noteHash: hashNote(note),
      });
    },
    [module, wallet],
  );

  const confirmReceipt: CreatorCoinRedemption['confirmReceipt'] = useCallback(
    async ({ coinMint, redemptionId, creator }) => {
      if (!module || !wallet.publicKey) return noResult;
      const redemptionPda = module.pdas.redemption(coinMint, redemptionId);
      const escrowTokenAccount = escrowAtaFor(coinMint, redemptionPda);
      const creatorTokenAccount = getAssociatedTokenAddressSync(
        coinMint,
        creator,
        false,
      );
      return module.confirmReceipt({
        redemptionId,
        coinMint,
        escrowTokenAccount,
        creatorTokenAccount,
      });
    },
    [module, wallet],
  );

  const autoConfirm: CreatorCoinRedemption['autoConfirm'] = useCallback(
    async ({ coinMint, redemptionId, creator }) => {
      if (!module || !wallet.publicKey) return noResult;
      const redemptionPda = module.pdas.redemption(coinMint, redemptionId);
      const escrowTokenAccount = escrowAtaFor(coinMint, redemptionPda);
      const creatorTokenAccount = getAssociatedTokenAddressSync(
        coinMint,
        creator,
        false,
      );
      return module.autoConfirm({
        redemptionId,
        coinMint,
        escrowTokenAccount,
        creatorTokenAccount,
      });
    },
    [module, wallet],
  );

  const disputeRedemption: CreatorCoinRedemption['disputeRedemption'] =
    useCallback(
      async ({ coinMint, redemptionId, reasonUri }) => {
        if (!module || !wallet.publicKey) return noResult;
        const reason = (reasonUri ?? '').slice(0, 200);
        return module.disputeRedemption({
          redemptionId,
          coinMint,
          reasonUri: reason,
          reasonHash: hashNote(reason),
        });
      },
      [module, wallet],
    );

  const executeRuling: CreatorCoinRedemption['executeRuling'] = useCallback(
    async ({ coinMint, redemptionId, creator, buyer, creatorShareBps }) => {
      if (!module || !wallet.publicKey) return noResult;
      const redemptionPda = module.pdas.redemption(coinMint, redemptionId);
      const escrowTokenAccount = escrowAtaFor(coinMint, redemptionPda);
      const creatorTokenAccount = getAssociatedTokenAddressSync(
        coinMint,
        creator,
        false,
      );
      const buyerTokenAccount = getAssociatedTokenAddressSync(
        coinMint,
        buyer,
        false,
      );
      return module.executeRuling({
        redemptionId,
        coinMint,
        creatorShareBps,
        escrowTokenAccount,
        creatorTokenAccount,
        buyerTokenAccount,
        // PROTOCOL_AUTHORITY placeholder — production wires governance here.
        authority: SystemProgram.programId,
      });
    },
    [module, wallet],
  );

  // 2026-05-20 — stabilise returned object so consumers using it as a
  // useEffect dependency don't re-fire every render.
  return useMemo(
    () => ({
      enabled,
      module,
      payer: wallet.publicKey ?? null,
      fetchCounter,
      fetchRedemption,
      listRedemptions,
      initRedemptionCounter,
      initiateRedemption,
      markDelivered,
      confirmReceipt,
      autoConfirm,
      disputeRedemption,
      executeRuling,
    }),
    [
      enabled,
      module,
      wallet.publicKey,
      fetchCounter,
      fetchRedemption,
      listRedemptions,
      initRedemptionCounter,
      initiateRedemption,
      markDelivered,
      confirmReceipt,
      autoConfirm,
      disputeRedemption,
      executeRuling,
    ],
  );
}

// ────────────────────────────────────────────────────────────────────────
// Local base58 helper for getProgramAccounts memcmp.
// ────────────────────────────────────────────────────────────────────────

// Minimal base58 encoder (no extra dep). Buffer is small (8B disc).
const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function bs58Encode(bytes: Buffer): string {
  // Convert to base58 the simple way (good enough for ≤ 32 bytes here).
  let zeros = 0;
  for (const b of bytes) {
    if (b === 0) zeros++;
    else break;
  }
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let s = '';
  while (n > 0n) {
    const r = n % 58n;
    s = B58_ALPHABET[Number(r)] + s;
    n = n / 58n;
  }
  return '1'.repeat(zeros) + s;
}

export { RedemptionStatus };
