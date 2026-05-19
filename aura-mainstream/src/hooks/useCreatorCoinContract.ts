/**
 * useCreatorCoinContract — bridges CoinDetailPage / MintCeremony to the
 * on-chain Creator Coin contract via the AURA SDK CreatorCoinModule.
 *
 * Feature-flagged: only activates when `VITE_CREATOR_COIN_REAL_CHAIN === 'true'`.
 * Otherwise returns `{ enabled: false }` and the page should fall back to
 * MockChainContext.
 *
 * Mirrors the shape of `useBountyContract`. Same rationale: placeholder pool
 * addresses + program not yet deployed to devnet means MockChain is the safe
 * default; switching is one env var: `VITE_CREATOR_COIN_REAL_CHAIN=true`.
 *
 * The hook surfaces:
 *  - high-level helpers (`primaryBuy`, `placeSellOrder`, `fillOrder`,
 *    `cancelOrder`, `createCreatorCoin`) that derive token accounts (ATAs)
 *    from the wallet, so pages only need to pass domain inputs (creator,
 *    amount, price per coin)
 *  - the raw `module` for advanced flows (benefits, redemption, gifts).
 */

import { useMemo, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useUnifiedWalletAsAdapter, type UnifiedWalletAdapter } from './useUnifiedWallet';
import { PublicKey } from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {
  CreatorCoinModule,
  type CreatorCoinOnChain,
} from '@aura-protocol/sdk';
import type { TransactionResult } from '@aura-protocol/sdk';

// Real on-chain program id (matches programs/creator-coin/src/lib.rs).
const CREATOR_COIN_PROGRAM_ID = new PublicKey('DW4BZcwY5c3nQHMGKysmTdXKpFous778RKcbSvw2xNMZ');

/**
 * Protocol-level accounts used by the Creator Coin program. We piggy-back on
 * the same VITE_* vars as `useBountyContract`; once protocol-wide pools are
 * deployed, the two hooks will share the same on-chain addresses.
 */
interface CreatorCoinProtocolConfig {
  oraMint: PublicKey;
  stakingRewardsPool: PublicKey; // ATA(stakingPool, oraMint)
  gasReservePool: PublicKey;     // ATA(gasReserve, oraMint)
  opsTreasuryPool: PublicKey;    // ATA(opsTreasury, oraMint)
}

function readProtocolConfig(): CreatorCoinProtocolConfig {
  const sys = new PublicKey('11111111111111111111111111111111');
  const safe = (name: string): PublicKey => {
    const raw = (import.meta as any).env?.[name] as string | undefined;
    if (!raw) return sys;
    try {
      return new PublicKey(raw);
    } catch {
      console.warn(`[useCreatorCoinContract] invalid pubkey for ${name}, falling back to placeholder`);
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

// Token decimal scaling. Creator coins use 9 decimals on-chain (matches
// programs/creator-coin/src/lib.rs `INITIAL_SUPPLY_RAW = 2000 * 1e9`).
// We accept a human-readable `number` and scale to base units (BigInt) so
// pages don't have to worry about it.
const CC_DECIMALS = 9;
const ORA_DECIMALS = 9;
function toCcBase(amount: number): bigint {
  if (!Number.isFinite(amount) || amount <= 0) return 0n;
  return BigInt(Math.round(amount * 10 ** CC_DECIMALS));
}
function toOraBase(amount: number): bigint {
  if (!Number.isFinite(amount) || amount <= 0) return 0n;
  return BigInt(Math.round(amount * 10 ** ORA_DECIMALS));
}

export interface CreatorCoinContract {
  enabled: boolean;
  module: CreatorCoinModule | null;
  oraMint: PublicKey;
  /** Resolve the creator-coin mint PDA for any creator. */
  coinMint: (creator: PublicKey) => PublicKey | null;
  /** Read live on-chain state (price, supply, vesting). */
  fetchCoin: (creator: PublicKey) => Promise<CreatorCoinOnChain | null>;
  /** Primary issuance — buy directly from creator's supply at fixed price. */
  primaryBuy: (params: { creator: PublicKey; amount: number }) => Promise<TransactionResult>;
  /** Secondary-market sell order (escrows the coins). */
  placeSellOrder: (params: {
    creator: PublicKey;
    amount: number;
    pricePerCoin: number;
    orderNonce?: bigint;
  }) => Promise<TransactionResult & { order?: PublicKey }>;
  /** Fill someone else's sell order (caller pays ORA, receives CC). */
  fillOrder: (params: {
    creator: PublicKey;
    order: PublicKey;
    seller: PublicKey;
    fillAmount: number;
  }) => Promise<TransactionResult>;
  /** Cancel my own sell order — returns escrowed coins to my wallet. */
  cancelOrder: (params: { creator: PublicKey; order: PublicKey }) => Promise<TransactionResult>;
  /** First-time mint — creates the creator coin + benefits list + ATA. */
  createCreatorCoin: (params: {
    symbol: string;
    initialPrice: number; // ORA per coin (human-readable)
    activityOracle?: PublicKey; // defaults to wallet
  }) => Promise<TransactionResult & { creatorCoin?: PublicKey; mint?: PublicKey }>;
}

/** Returns a stable CreatorCoinModule instance keyed to the wallet adapter. */
export function useCreatorCoinContract(): CreatorCoinContract {
  const { connection } = useConnection();
  // 2026-05-19 — unified wallet (Privy embedded > Phantom)
  const wallet = useUnifiedWalletAsAdapter();

  const enabled = (import.meta as any).env?.VITE_CREATOR_COIN_REAL_CHAIN === 'true';
  const cfg = useMemo(() => readProtocolConfig(), []);

  const module = useMemo(() => {
    if (!enabled) return null;
    // Same structural-cast pragmatism as useBountyContract — the
    // WalletContextState shape matches the SDK's WalletAdapter at runtime.
    return new CreatorCoinModule(
      connection,
      wallet as UnifiedWalletAdapter,
      CREATOR_COIN_PROGRAM_ID
    );
  }, [connection, wallet, enabled]);

  const coinMint = useCallback((creator: PublicKey): PublicKey | null => {
    if (!module) return null;
    return module.pdas.creatorCoinMint(creator);
  }, [module]);

  const fetchCoin = useCallback(async (creator: PublicKey): Promise<CreatorCoinOnChain | null> => {
    if (!module) return null;
    return module.fetchCreatorCoin(creator);
  }, [module]);

  const primaryBuy: CreatorCoinContract['primaryBuy'] = useCallback(async ({ creator, amount }) => {
    if (!module || !wallet.publicKey) {
      return { signature: '', success: false, error: 'Wallet not connected' };
    }
    const buyer = wallet.publicKey;
    const mintPda = module.pdas.creatorCoinMint(creator);
    return module.primaryBuy({
      creator,
      amount: toCcBase(amount),
      buyerOraAccount: getAssociatedTokenAddressSync(cfg.oraMint, buyer),
      creatorOraAccount: getAssociatedTokenAddressSync(cfg.oraMint, creator),
      oraMint: cfg.oraMint,
      stakingPoolAccount: cfg.stakingRewardsPool,
      gasReserveAccount: cfg.gasReservePool,
      opsTreasuryAccount: cfg.opsTreasuryPool,
      buyerCcAccount: getAssociatedTokenAddressSync(mintPda, buyer, true),
    });
  }, [module, wallet.publicKey, cfg]);

  const placeSellOrder: CreatorCoinContract['placeSellOrder'] = useCallback(async ({ creator, amount, pricePerCoin, orderNonce }) => {
    if (!module || !wallet.publicKey) {
      return { signature: '', success: false, error: 'Wallet not connected' };
    }
    const maker = wallet.publicKey;
    const creatorCoinPda = module.pdas.creatorCoin(creator);
    const mintPda = module.pdas.creatorCoinMint(creator);
    // Order nonce: caller may pass one; otherwise we derive a fresh one
    // from millis so duplicate orders in the same session don't collide.
    const nonce = orderNonce ?? BigInt(Date.now());
    return module.createSellOrder({
      creatorCoinAddress: creatorCoinPda,
      amount: toCcBase(amount),
      pricePerToken: toOraBase(pricePerCoin),
      orderNonce: nonce,
      makerCoinAccount: getAssociatedTokenAddressSync(mintPda, maker, true),
      // Escrow ATA owned by the order PDA. Allowing off-curve owner because
      // the order is a PDA, not a wallet.
      escrowCoinAccount: getAssociatedTokenAddressSync(
        mintPda,
        module.pdas.order(maker, nonce),
        true,
      ),
    });
  }, [module, wallet.publicKey]);

  const fillOrder: CreatorCoinContract['fillOrder'] = useCallback(async ({ creator, order, seller, fillAmount }) => {
    if (!module || !wallet.publicKey) {
      return { signature: '', success: false, error: 'Wallet not connected' };
    }
    const buyer = wallet.publicKey;
    const creatorCoinPda = module.pdas.creatorCoin(creator);
    const mintPda = module.pdas.creatorCoinMint(creator);
    return module.fillOrder({
      creatorCoin: creatorCoinPda,
      order,
      escrowCoinAccount: getAssociatedTokenAddressSync(mintPda, order, true),
      buyerCoinAccount: getAssociatedTokenAddressSync(mintPda, buyer, true),
      buyerOraAccount: getAssociatedTokenAddressSync(cfg.oraMint, buyer),
      sellerOraAccount: getAssociatedTokenAddressSync(cfg.oraMint, seller),
      oraMint: cfg.oraMint,
      stakingPoolAccount: cfg.stakingRewardsPool,
      gasReserveAccount: cfg.gasReservePool,
      opsTreasuryAccount: cfg.opsTreasuryPool,
      fillAmount: toCcBase(fillAmount),
    });
  }, [module, wallet.publicKey, cfg]);

  const cancelOrder: CreatorCoinContract['cancelOrder'] = useCallback(async ({ creator, order }) => {
    if (!module || !wallet.publicKey) {
      return { signature: '', success: false, error: 'Wallet not connected' };
    }
    const maker = wallet.publicKey;
    const creatorCoinPda = module.pdas.creatorCoin(creator);
    const mintPda = module.pdas.creatorCoinMint(creator);
    return module.cancelOrder({
      creatorCoin: creatorCoinPda,
      order,
      escrowCoinAccount: getAssociatedTokenAddressSync(mintPda, order, true),
      makerCoinAccount: getAssociatedTokenAddressSync(mintPda, maker, true),
    });
  }, [module, wallet.publicKey]);

  const createCreatorCoin: CreatorCoinContract['createCreatorCoin'] = useCallback(async ({ symbol, initialPrice, activityOracle }) => {
    if (!module || !wallet.publicKey) {
      return { signature: '', success: false, error: 'Wallet not connected' };
    }
    const creator = wallet.publicKey;
    const mintPda = module.pdas.creatorCoinMint(creator);
    return module.createCreatorCoin({
      symbol,
      initialPrice: toOraBase(initialPrice),
      activityOracle: activityOracle ?? creator,
      creatorTokenAccount: getAssociatedTokenAddressSync(mintPda, creator, true),
    });
  }, [module, wallet.publicKey]);

  // 2026-05-20 — stabilise returned object so consumers using it as a
  // useEffect dependency don't re-fire every render.
  return useMemo(
    () => ({
      enabled,
      module,
      oraMint: cfg.oraMint,
      coinMint,
      fetchCoin,
      primaryBuy,
      placeSellOrder,
      fillOrder,
      cancelOrder,
      createCreatorCoin,
    }),
    [
      enabled,
      module,
      cfg.oraMint,
      coinMint,
      fetchCoin,
      primaryBuy,
      placeSellOrder,
      fillOrder,
      cancelOrder,
      createCreatorCoin,
    ],
  );
}

// Re-export commonly-used SDK types so pages can import from one place.
export type { CreatorCoinOnChain };
