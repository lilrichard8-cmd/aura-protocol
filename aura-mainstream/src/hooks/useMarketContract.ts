/**
 * useMarketContract — bridges MarketplacePage's NFT trading flow to the
 * on-chain NFT royalty market (programs/market/src/nft_royalty.rs), via
 * the AURA SDK MarketModule's NFT royalty extensions.
 *
 * Note on shape: the deployed `aura_market` program does NOT implement a
 * full order-book (no place_sell_order / fill_sell_order / cancel_sell_order
 * instructions exist on-chain or in the SDK as of v1.1). NFT trades are
 * peer-to-peer atomic swaps mediated by `enforce_royalty_on_sale`, which
 * pulls the agreed price from the buyer and splits it between seller,
 * original creator, and protocol pools in a single transaction.
 *
 * So this hook exposes a thin, accurate API:
 *   • configureRoyalty({ nftMint, royaltyBps })  → set_royalty
 *   • buyNft({ nftMint, salePrice, seller })     → enforce_royalty_on_sale
 *   • fetchRoyaltyConfig(nftMint)                → fetch_nft_royalty_config
 *
 * The MarketplacePage caller decides off-chain how listings/orders are
 * surfaced (today: mock catalog). When `VITE_MARKET_REAL_CHAIN === 'true'`
 * the Buy CTA on a fixed-price NFT routes through `buyNft`. Until the
 * protocol gains a real order-book, "List your NFT" and auctions still
 * fall back to MockChainContext.
 *
 * Feature-flagged: only activates when `VITE_MARKET_REAL_CHAIN === 'true'`.
 */

import { useMemo } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useUnifiedWalletAsAdapter, type UnifiedWalletAdapter } from './useUnifiedWallet';
import { PublicKey } from '@solana/web3.js';
import {
  MarketModule,
  type MarketModuleConfig,
  type NftRoyaltyConfigOnChain,
  type TransactionResult,
  NFT_ROYALTY_BPS,
} from '@aura-protocol/sdk';

/** Real on-chain program id (matches programs/market/Cargo.toml). */
const MARKET_PROGRAM_ID = new PublicKey('9YgDaCgqqHhztHEr8TDBmX3ffrdHw9nMXt2tZXjBA2sc');

/** Reads VITE_* env vars at build time and falls back to placeholders. */
function readMarketConfig(): MarketModuleConfig {
  const sys = new PublicKey('11111111111111111111111111111111');
  const safe = (name: string): PublicKey => {
    const raw = (import.meta as any).env?.[name] as string | undefined;
    if (!raw) return sys;
    try {
      return new PublicKey(raw);
    } catch {
      console.warn(`[useMarketContract] invalid pubkey for ${name}, falling back to placeholder`);
      return sys;
    }
  };
  return {
    stakingRewardsPool: safe('VITE_STAKING_REWARDS_POOL'),
    gasReservePool: safe('VITE_GAS_RESERVE_POOL'),
    opsTreasuryPool: safe('VITE_OPS_TREASURY_POOL'),
    oraMint: safe('VITE_ORA_MINT'),
  };
}

export interface ConfigureRoyaltyArgs {
  nftMint: PublicKey | string;
  /** Basis points; must be in [NFT_ROYALTY_BPS.MIN, NFT_ROYALTY_BPS.MAX]. */
  royaltyBps: number;
}

export interface BuyNftArgs {
  nftMint: PublicKey | string;
  /** Atomic ORA units (lamports, 9 decimals). */
  salePrice: bigint | number;
  /** NFT seller's wallet. */
  seller: PublicKey | string;
}

export interface MarketContract {
  enabled: boolean;
  module: MarketModule | null;
  oraMint: PublicKey;
  /** Mint-side: creator sets royalty bps on a freshly-minted NFT mint. */
  configureRoyalty: (args: ConfigureRoyaltyArgs) => Promise<TransactionResult>;
  /** Buy-side: pay seller `salePrice` ORA atomic units; royalty + protocol
   *  fees are split atomically by the on-chain program. The seller must
   *  also sign (the program lists them as `isSigner: true`); for the
   *  UI's solo-wallet flow this is the same wallet that owns the NFT. */
  buyNft: (args: BuyNftArgs) => Promise<TransactionResult>;
  /** Fetch the on-chain royalty config for a given NFT mint. */
  fetchRoyaltyConfig: (
    nftMint: PublicKey | string,
  ) => Promise<NftRoyaltyConfigOnChain | null>;
  /** Convenience: tells callers whether the deployed program supports a
   *  real order book. Currently always `false` — see file header. */
  hasOrderBook: false;
}

const toPk = (v: PublicKey | string): PublicKey =>
  v instanceof PublicKey ? v : new PublicKey(v);

const disabledResult = (action: string): TransactionResult => ({
  signature: '',
  success: false,
  error: `[useMarketContract] ${action} called while real-chain disabled (set VITE_MARKET_REAL_CHAIN=true)`,
});

/** Returns a stable MarketModule instance keyed to the wallet adapter. */
export function useMarketContract(): MarketContract {
  const { connection } = useConnection();
  // 2026-05-19 — unified wallet (Privy embedded > Phantom)
  const wallet = useUnifiedWalletAsAdapter();

  const enabled = (import.meta as any).env?.VITE_MARKET_REAL_CHAIN === 'true';
  const cfg = useMemo(() => readMarketConfig(), []);

  const module = useMemo(() => {
    if (!enabled) return null;
    return new MarketModule(
      connection,
      wallet as UnifiedWalletAdapter,
      MARKET_PROGRAM_ID,
      cfg,
    );
  }, [connection, wallet, cfg, enabled]);

  return useMemo<MarketContract>(() => ({
    enabled,
    module,
    oraMint: cfg.oraMint,
    hasOrderBook: false,
    async configureRoyalty(args) {
      if (!module) return disabledResult('configureRoyalty');
      return module.setRoyalty({
        nftMint: toPk(args.nftMint),
        royaltyBps: args.royaltyBps,
      });
    },
    async buyNft(args) {
      if (!module) return disabledResult('buyNft');
      return module.enforceRoyalty({
        nftMint: toPk(args.nftMint),
        salePrice: BigInt(args.salePrice),
        seller: toPk(args.seller),
      });
    },
    async fetchRoyaltyConfig(nftMint) {
      if (!module) return null;
      return module.fetchNftRoyaltyConfig(toPk(nftMint));
    },
  }), [enabled, module, cfg.oraMint]);
}

// Re-export commonly-used SDK types so pages can import from one place.
export { NFT_ROYALTY_BPS };
export type { NftRoyaltyConfigOnChain, MarketModuleConfig };
