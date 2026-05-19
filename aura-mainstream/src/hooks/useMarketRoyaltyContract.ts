/**
 * useMarketRoyaltyContract — bridges the CreatePage NFT royalty slider
 * to the on-chain `set_royalty` instruction on the Market program
 * (whitepaper §12 NFT royalty enforcement).
 *
 * Feature-flagged off the same `VITE_CORE_REAL_CHAIN` env var as
 * useCoreContract — the publish flow chains both calls and we don't
 * want a half-on / half-off state where Arweave + publish go through
 * mock but royalty hits chain (or vice versa).
 *
 * Mirrors useBountyContract's structure. Reuses the same Market program
 * id and config (protocol pools + ORA mint).
 *
 * 2026-05-19 — first cut.
 */

import { useMemo } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useUnifiedWalletAsAdapter, type UnifiedWalletAdapter } from './useUnifiedWallet';
import { PublicKey } from '@solana/web3.js';
import {
  MarketModule,
  type MarketModuleConfig,
  NFT_ROYALTY_BPS,
} from '@aura-protocol/sdk';

// Real on-chain program id (matches programs/market/Cargo.toml).
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
      console.warn(
        `[useMarketRoyaltyContract] invalid pubkey for ${name}, falling back to placeholder`,
      );
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

export interface MarketRoyaltyContract {
  enabled: boolean;
  module: MarketModule | null;
  oraMint: PublicKey;
  /** Royalty range in basis points — surface to the UI for client-side validation. */
  range: { minBps: number; maxBps: number; defaultBps: number };
}

/** Stable MarketModule instance scoped to the royalty flow. */
export function useMarketRoyaltyContract(): MarketRoyaltyContract {
  const { connection } = useConnection();
  // 2026-05-19 — unified wallet (Privy embedded > Phantom)
  const wallet = useUnifiedWalletAsAdapter();

  // Same flag as useCoreContract — publish & royalty must travel together.
  const enabled = (import.meta as any).env?.VITE_CORE_REAL_CHAIN === 'true';
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

  // 2026-05-19 H-1 — stabilise the returned object so consumers don't see a
  // new reference on every render. The `range` literal in particular used to
  // re-create three nested object identities each render, which broke any
  // downstream `useMemo`/`useEffect` deps keyed on it.
  return useMemo(() => ({
    enabled,
    module,
    oraMint: cfg.oraMint,
    range: {
      minBps: NFT_ROYALTY_BPS.MIN,
      maxBps: NFT_ROYALTY_BPS.MAX,
      defaultBps: NFT_ROYALTY_BPS.DEFAULT,
    },
  }), [enabled, module, cfg.oraMint]);
}

/**
 * Convenience: validate + convert a percent (5..45 in the UI slider) to
 * basis points (500..4500 on-chain). Throws RangeError if out of range,
 * matching the contract's `MIN_ROYALTY_BPS / MAX_ROYALTY_BPS` guard so
 * the user sees a UI error before signing instead of an on-chain revert.
 */
export function royaltyPercentToBps(percent: number): number {
  if (!Number.isFinite(percent)) {
    throw new RangeError('royalty percent must be a finite number');
  }
  const bps = Math.round(percent * 100);
  if (bps < NFT_ROYALTY_BPS.MIN || bps > NFT_ROYALTY_BPS.MAX) {
    throw new RangeError(
      `royalty ${percent}% (${bps} bps) outside allowed range ` +
        `${NFT_ROYALTY_BPS.MIN / 100}% – ${NFT_ROYALTY_BPS.MAX / 100}%`,
    );
  }
  return bps;
}

export { NFT_ROYALTY_BPS };
