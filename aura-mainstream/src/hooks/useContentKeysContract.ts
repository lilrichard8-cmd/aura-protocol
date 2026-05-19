/**
 * useContentKeysContract — bridges the MarketplacePage Content Keys tab to
 * the on-chain `aura_content_keys` program via the AURA SDK
 * ContentKeysModule.
 *
 * Feature-flagged: only activates when `VITE_CONTENT_KEYS_REAL_CHAIN === 'true'`.
 * Otherwise returns `{ enabled: false }` and the page falls back to
 * MockChainContext (buyContentKey / buyListedKey / etc).
 *
 * Why a flag (mirrors useBountyContract): the protocol pool addresses
 * (STAKING / GAS / OPS) and the ORA mint are still placeholders until the
 * program is deployed to devnet. Real-chain mode is opt-in:
 *
 *   VITE_CONTENT_KEYS_REAL_CHAIN=true
 *   VITE_STAKING_REWARDS_POOL=...
 *   VITE_GAS_RESERVE_POOL=...
 *   VITE_OPS_TREASURY_POOL=...
 *   VITE_ORA_MINT=...
 *
 * Surface mirrors the SDK 1:1 but accepts string|number where convenient
 * and converts to PublicKey/bigint internally.
 */

import { useMemo } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useUnifiedWalletAsAdapter, type UnifiedWalletAdapter } from './useUnifiedWallet';
import { PublicKey } from '@solana/web3.js';
import {
  ContentKeysModule,
  type ContentKeysModuleConfig,
  type EncryptedContentOnChain,
  type ContentKeyOnChain,
  type KeyListingOnChain,
  type AccessType,
  type BuyKeyParams,
  type ListKeyParams,
  type BuyListedKeyParams,
  type PublishContentKeysParams,
  type TransactionResult,
  AccessKind,
  CONTENT_KEYS_FEE_BPS,
} from '@aura-protocol/sdk';

/** Real on-chain program id (matches programs/content-keys/src/lib.rs declare_id!). */
const CONTENT_KEYS_PROGRAM_ID = new PublicKey(
  'HCZyqzGVjmUKfUfztmL4ceeZkw3Pm5spdsBjWQ4yaHqT',
);

function readConfig(): ContentKeysModuleConfig {
  const sys = new PublicKey('11111111111111111111111111111111');
  const safe = (name: string): PublicKey => {
    const raw = (import.meta as any).env?.[name] as string | undefined;
    if (!raw) return sys;
    try {
      return new PublicKey(raw);
    } catch {
      console.warn(`[useContentKeysContract] invalid pubkey for ${name}, falling back to placeholder`);
      return sys;
    }
  };
  return {
    oraMint: safe('VITE_ORA_MINT'),
    stakingRewardsPool: safe('VITE_STAKING_REWARDS_POOL'),
    gasReservePool: safe('VITE_GAS_RESERVE_POOL'),
    opsTreasuryPool: safe('VITE_OPS_TREASURY_POOL'),
  };
}

const toPk = (v: PublicKey | string): PublicKey =>
  v instanceof PublicKey ? v : new PublicKey(v);

const disabledResult = (action: string): TransactionResult => ({
  signature: '',
  success: false,
  error: `[useContentKeysContract] ${action} called while real-chain disabled (set VITE_CONTENT_KEYS_REAL_CHAIN=true)`,
});

export interface PublishEncryptedContentArgs {
  /** Content id (the SDK auto-fetches `nextContentId(creator)` if omitted). */
  contentId?: bigint | number;
  arweaveTxId: string;
  /** Key price in ORA atomic units (lamports, 9 decimals). */
  keyPriceLamports: bigint | number;
  /** Per-content secondary royalty bps. Defaults to 500 (5%). */
  royaltyBps?: number;
  /** Defaults to permanent access. */
  accessType?: AccessType;
}

export interface BuyKeyArgs {
  creator: PublicKey | string;
  contentId: bigint | number;
}

export interface ListKeyArgs {
  creator: PublicKey | string;
  contentId: bigint | number;
  keySerial: bigint | number;
  /** Resale ask in ORA atomic units. */
  listPriceLamports: bigint | number;
}

export interface BuyListedKeyArgs {
  creator: PublicKey | string;
  contentId: bigint | number;
  keySerial: bigint | number;
}

export interface DelistKeyArgs {
  /** The on-chain KeyListing PDA. */
  listingPda: PublicKey | string;
}

export interface ContentKeysContract {
  enabled: boolean;
  module: ContentKeysModule | null;
  oraMint: PublicKey;
  programId: PublicKey;

  /** Creator-side: publish encrypted content + open its primary key sale. */
  publishEncryptedContent: (
    args: PublishEncryptedContentArgs,
  ) => Promise<TransactionResult & { content?: PublicKey }>;

  /** Buyer-side: purchase a freshly-minted primary key. */
  buyKey: (
    args: BuyKeyArgs,
  ) => Promise<TransactionResult & { key?: PublicKey }>;

  /** Holder-side: list an owned key for resale on the secondary market. */
  listKey: (
    args: ListKeyArgs,
  ) => Promise<TransactionResult & { listing?: PublicKey }>;

  /** Buyer-side: take an existing secondary listing. */
  buyListedKey: (args: BuyListedKeyArgs) => Promise<TransactionResult>;

  /** Holder-side: cancel an active secondary listing. */
  delistKey: (args: DelistKeyArgs) => Promise<TransactionResult>;

  /** Fetch the available primary content listing by PDA. */
  fetchAvailableContent: (
    contentPda: PublicKey | string,
  ) => Promise<EncryptedContentOnChain | null>;

  /** Fetch a primary key account. */
  fetchKey: (keyPda: PublicKey | string) => Promise<ContentKeyOnChain | null>;

  /** Fetch a secondary listing account. */
  fetchKeyListing: (
    listingPda: PublicKey | string,
  ) => Promise<KeyListingOnChain | null>;
}

/** Returns a stable ContentKeysModule instance keyed to the wallet adapter. */
export function useContentKeysContract(): ContentKeysContract {
  const { connection } = useConnection();
  // 2026-05-19 — unified wallet (Privy embedded > Phantom)
  const wallet = useUnifiedWalletAsAdapter();

  const enabled = (import.meta as any).env?.VITE_CONTENT_KEYS_REAL_CHAIN === 'true';
  const cfg = useMemo(() => readConfig(), []);

  const module = useMemo(() => {
    if (!enabled) return null;
    return new ContentKeysModule(
      connection,
      wallet as UnifiedWalletAdapter,
      CONTENT_KEYS_PROGRAM_ID,
      cfg,
    );
  }, [connection, wallet, cfg, enabled]);

  return useMemo<ContentKeysContract>(() => ({
    enabled,
    module,
    oraMint: cfg.oraMint,
    programId: CONTENT_KEYS_PROGRAM_ID,

    async publishEncryptedContent(args) {
      if (!module) return disabledResult('publishEncryptedContent');
      const creator = wallet.publicKey;
      if (!creator) return { signature: '', success: false, error: 'wallet not connected' };
      const contentId =
        args.contentId !== undefined
          ? BigInt(args.contentId)
          : await module.nextContentId(creator);
      const params: PublishContentKeysParams = {
        contentId,
        arweaveTxId: args.arweaveTxId,
        keyPriceLamports: BigInt(args.keyPriceLamports),
        royaltyBps: args.royaltyBps ?? CONTENT_KEYS_FEE_BPS.DEFAULT_ROYALTY,
        accessType: args.accessType ?? { kind: AccessKind.Permanent },
      };
      return module.publishContent(params);
    },

    async buyKey(args) {
      if (!module) return disabledResult('buyKey');
      const params: BuyKeyParams = {
        creator: toPk(args.creator),
        contentId: BigInt(args.contentId),
      };
      return module.buyKey(params);
    },

    async listKey(args) {
      if (!module) return disabledResult('listKey');
      const params: ListKeyParams = {
        creator: toPk(args.creator),
        contentId: BigInt(args.contentId),
        keySerial: BigInt(args.keySerial),
        listPriceLamports: BigInt(args.listPriceLamports),
      };
      return module.listKey(params);
    },

    async buyListedKey(args) {
      if (!module) return disabledResult('buyListedKey');
      const params: BuyListedKeyParams = {
        creator: toPk(args.creator),
        contentId: BigInt(args.contentId),
        keySerial: BigInt(args.keySerial),
      };
      return module.buyListedKey(params);
    },

    async delistKey(args) {
      if (!module) return disabledResult('delistKey');
      return module.delistKey(toPk(args.listingPda));
    },

    async fetchAvailableContent(contentPda) {
      if (!module) return null;
      return module.fetchContent(toPk(contentPda));
    },

    async fetchKey(keyPda) {
      if (!module) return null;
      return module.fetchKey(toPk(keyPda));
    },

    async fetchKeyListing(listingPda) {
      if (!module) return null;
      return module.fetchListing(toPk(listingPda));
    },
  }), [enabled, module, cfg.oraMint, wallet.publicKey]);
}

// Re-export commonly-used SDK types so pages can import from one place.
export { AccessKind, CONTENT_KEYS_FEE_BPS };
export type {
  EncryptedContentOnChain,
  ContentKeyOnChain,
  KeyListingOnChain,
  ContentKeysModuleConfig,
  AccessType,
};
