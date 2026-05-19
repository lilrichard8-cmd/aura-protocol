/**
 * useBountyContract — bridges the BountyCreatePage / BountyDetailPage to the
 * on-chain Bounty V2 contract via the AURA SDK MarketModule.
 *
 * Feature-flagged: only activates when `VITE_BOUNTY_REAL_CHAIN === 'true'`.
 * Otherwise returns `{ enabled: false }` and the page should fall back to
 * MockChainContext.
 *
 * The reason for a flag (instead of replacing MockChainContext outright):
 *  - The protocol pool addresses (STAKING/GAS/OPS) and the ORA mint are
 *    still placeholders in the deployed program (see lib.rs ⚠️ DO NOT DEPLOY).
 *  - The bounty V2 contract has only been unit-tested; it has not been
 *    deployed to devnet yet. Until then, mock chain is the safe default.
 *  - Switching is one env var: `VITE_BOUNTY_REAL_CHAIN=true npm run dev`.
 */

import { useMemo } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useUnifiedWalletAsAdapter, type UnifiedWalletAdapter } from './useUnifiedWallet';
import {
  MarketModule,
  type MarketModuleConfig,
  type BountyOnChain,
  type SubmissionOnChain,
  BountyStatus,
  SubmissionStatus,
  BOUNTY_V2_LIMITS,
} from '@aura-protocol/sdk';

// Real on-chain program id (matches programs/market/Cargo.toml).
export const MARKET_PROGRAM_ID = new PublicKey('9YgDaCgqqHhztHEr8TDBmX3ffrdHw9nMXt2tZXjBA2sc');

/** Reads VITE_* env vars at build time and falls back to placeholders. */
function readMarketConfig(): MarketModuleConfig {
  const sys = new PublicKey('11111111111111111111111111111111');
  const safe = (name: string): PublicKey => {
    const raw = (import.meta as any).env?.[name] as string | undefined;
    if (!raw) return sys;
    try {
      return new PublicKey(raw);
    } catch {
      console.warn(`[useBountyContract] invalid pubkey for ${name}, falling back to placeholder`);
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

export interface BountyContract {
  enabled: boolean;
  module: MarketModule | null;
  oraMint: PublicKey;
}

/** Returns a stable MarketModule instance keyed to the active (unified) wallet. */
export function useBountyContract(): BountyContract {
  const { connection } = useConnection();
  // 2026-05-19 — switched from useWallet() (wallet-adapter only) to the unified
  // wallet so Privy embedded users can sign bounty transactions too.
  // The returned object is structurally compatible with the SDK's WalletAdapter
  // (publicKey + connected + sendTransaction).
  const wallet = useUnifiedWalletAsAdapter();

  const enabled = (import.meta as any).env?.VITE_BOUNTY_REAL_CHAIN === 'true';
  const cfg = useMemo(() => readMarketConfig(), []);

  const module = useMemo(() => {
    if (!enabled) return null;
    return new MarketModule(
      connection,
      wallet as UnifiedWalletAdapter,
      MARKET_PROGRAM_ID,
      cfg
    );
  }, [connection, wallet, cfg, enabled]);

  return {
    enabled,
    module,
    oraMint: cfg.oraMint,
  };
}

// Re-export commonly-used SDK types so pages can import from one place.
export {
  BountyStatus,
  SubmissionStatus,
  BOUNTY_V2_LIMITS,
};
export type { BountyOnChain, SubmissionOnChain, MarketModuleConfig };
