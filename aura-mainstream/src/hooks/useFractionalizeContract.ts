/**
 * useFractionalizeContract — bridges Marketplace / FractionDetailPage to
 * the on-chain `aura_fractionalize` program via the AURA SDK
 * `FractionalizeModule`.
 *
 * Feature-flagged via `VITE_FRACTIONALIZE_REAL_CHAIN` (default: true on
 * localnet). When the flag is off OR the user wallet is not connected the
 * hook returns `{ enabled: false }` and the caller falls back to
 * MockChainContext bookkeeping. This is the same pattern used by
 * `useBountyContract` and `useCreatorCoinContract`.
 *
 * On-chain program id is read from `PROGRAM_IDS.LOCALNET.fractionalize` in
 * the SDK constants barrel (see sdk/src/constants.ts:61).
 *
 * Surface area mirrors `FractionalizeModule` but accepts page-friendly
 * inputs:
 *   • `nftMint`, `holder` (PublicKey strings allowed via helpers)
 *   • automatic derivation of the buyer / seller fragment ATA
 *   • `fragmentAmount` always in raw u64 base units (the on-chain
 *     fragment_mint is decimals = 0, so this is just a count)
 *
 * 2026-05-19 — Tier-2 creator-loop wire-up. The fractionalize program
 * has been deployed to the local test validator and these flows have
 * been smoke-tested via `scripts/smoke-fractionalize.mjs`.
 */

import { useMemo, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  FractionalizeModule,
  PROGRAM_IDS,
  FRACTIONALIZE_SEEDS,
  type FractionalNftOnChain,
  type FragmentHolderOnChain,
  type TransactionResult,
} from '@aura-protocol/sdk';
import {
  useUnifiedWalletAsAdapter,
  type UnifiedWalletAdapter,
} from './useUnifiedWallet';

// ────────────────────────────────────────────────────────────────────────
// Program id
// ────────────────────────────────────────────────────────────────────────

/** Real on-chain program id — matches programs/fractionalize declare_id. */
export const FRACTIONALIZE_PROGRAM_ID: PublicKey =
  PROGRAM_IDS.LOCALNET.fractionalize;

// ────────────────────────────────────────────────────────────────────────
// Public hook surface
// ────────────────────────────────────────────────────────────────────────

export interface FractionalizeContract {
  enabled: boolean;
  module: FractionalizeModule | null;
  /** PDA helpers — re-exposed for pages that need to derive addresses. */
  pdas: FractionalizeModule['pdas'] | null;
  /** Live wallet pubkey or null. */
  payer: PublicKey | null;
  /** Whether the connected wallet has a signer attached. */
  walletReady: boolean;

  // ── reads ──────────────────────────────────────────────────────────
  fetchFractionalNft: (nftMint: PublicKey) => Promise<FractionalNftOnChain | null>;
  fetchFragmentHolder: (
    nftMint: PublicKey,
    holder?: PublicKey,
  ) => Promise<FragmentHolderOnChain | null>;

  // ── writes ─────────────────────────────────────────────────────────
  fractionalizeNft: (params: {
    nftMint: PublicKey;
    /** Owner's NFT token account (typically ATA(owner, nftMint)). */
    ownerNftAccount?: PublicKey;
    totalFragments: bigint | number;
    pricePerFragment: bigint | number;
  }) => Promise<TransactionResult & { fractionalNft?: PublicKey; fragmentMint?: PublicKey }>;

  buyFragment: (params: {
    nftMint: PublicKey;
    amount: bigint | number;
    /** Buyer fragment ATA. Defaults to ATA(wallet, fragmentMintPda). */
    buyerFragmentAccount?: PublicKey;
  }) => Promise<TransactionResult>;

  sellFragment: (params: {
    nftMint: PublicKey;
    amount: bigint | number;
    sellerFragmentAccount?: PublicKey;
  }) => Promise<TransactionResult>;

  distributeRevenue: (params: {
    nftMint: PublicKey;
    revenueAmount: bigint | number;
  }) => Promise<TransactionResult>;

  claimRevenue: (params: { nftMint: PublicKey }) => Promise<TransactionResult>;

  voteOnLicense: (params: {
    nftMint: PublicKey;
    licenseProposalId: bigint | number;
    approve: boolean;
  }) => Promise<TransactionResult & { licenseVote?: PublicKey }>;

  finalizeLicenseVote: (params: {
    nftMint: PublicKey;
    licenseProposalId: bigint | number;
  }) => Promise<TransactionResult>;

  reclaimNft: (params: {
    nftMint: PublicKey;
    ownerNftAccount?: PublicKey;
  }) => Promise<TransactionResult>;
}

// ────────────────────────────────────────────────────────────────────────
// Implementation
// ────────────────────────────────────────────────────────────────────────

function readFlag(): boolean {
  // Default ON — fractionalize program is deployed on the local validator
  // and SDK ABI has been validated. Caller can flip
  // `VITE_FRACTIONALIZE_REAL_CHAIN=false` to force mock.
  const raw = (import.meta as any).env?.VITE_FRACTIONALIZE_REAL_CHAIN;
  if (raw === undefined) return true;
  return raw === 'true' || raw === true;
}

const noResult: TransactionResult = {
  signature: '',
  success: false,
  error: 'Wallet not connected or fractionalize disabled',
};

export function useFractionalizeContract(): FractionalizeContract {
  const { connection } = useConnection();
  const wallet = useUnifiedWalletAsAdapter();
  const enabled = readFlag();
  const walletReady = !!wallet.publicKey;

  const module = useMemo(() => {
    if (!enabled) return null;
    return new FractionalizeModule(
      connection,
      wallet as UnifiedWalletAdapter,
      FRACTIONALIZE_PROGRAM_ID,
    );
  }, [connection, wallet, enabled]);

  const ensureModule = (): module is FractionalizeModule => !!module;

  const fetchFractionalNft = useCallback(async (nftMint: PublicKey) => {
    if (!module) return null;
    return module.fetchFractionalNft(nftMint);
  }, [module]);

  const fetchFragmentHolder = useCallback(async (
    nftMint: PublicKey,
    holder?: PublicKey,
  ) => {
    if (!module) return null;
    const h = holder ?? wallet.publicKey ?? undefined;
    if (!h) return null;
    return module.fetchFragmentHolder(nftMint, h);
  }, [module, wallet.publicKey]);

  const buyerFragmentAtaFor = (nftMint: PublicKey, holder: PublicKey) => {
    // fragment_mint is a PDA, so the ATA owner is a normal wallet -> not
    // off-curve. Pass `allowOwnerOffCurve = false`.
    const fragMint = module!.pdas.fragmentMint(nftMint);
    return getAssociatedTokenAddressSync(fragMint, holder, false);
  };

  const fractionalizeNft: FractionalizeContract['fractionalizeNft'] = useCallback(async (p) => {
    if (!ensureModule() || !wallet.publicKey) return noResult;
    const owner = wallet.publicKey;
    const ownerNftAccount =
      p.ownerNftAccount ?? getAssociatedTokenAddressSync(p.nftMint, owner, false);
    return module!.fractionalizeNft({
      nftMint: p.nftMint,
      ownerNftAccount,
      totalFragments: p.totalFragments,
      pricePerFragment: p.pricePerFragment,
    });
  }, [module, wallet.publicKey]);

  const buyFragment: FractionalizeContract['buyFragment'] = useCallback(async (p) => {
    if (!ensureModule() || !wallet.publicKey) return noResult;
    const buyer = wallet.publicKey;
    const buyerFragmentAccount =
      p.buyerFragmentAccount ?? buyerFragmentAtaFor(p.nftMint, buyer);
    return module!.buyFragment({
      nftMint: p.nftMint,
      buyerFragmentAccount,
      amount: p.amount,
    });
  }, [module, wallet.publicKey]);

  const sellFragment: FractionalizeContract['sellFragment'] = useCallback(async (p) => {
    if (!ensureModule() || !wallet.publicKey) return noResult;
    const seller = wallet.publicKey;
    const sellerFragmentAccount =
      p.sellerFragmentAccount ?? buyerFragmentAtaFor(p.nftMint, seller);
    return module!.sellFragment({
      nftMint: p.nftMint,
      sellerFragmentAccount,
      amount: p.amount,
    });
  }, [module, wallet.publicKey]);

  const distributeRevenue: FractionalizeContract['distributeRevenue'] = useCallback(async (p) => {
    if (!ensureModule() || !wallet.publicKey) return noResult;
    return module!.distributeRevenue({
      nftMint: p.nftMint,
      revenueAmount: p.revenueAmount,
    });
  }, [module, wallet.publicKey]);

  const claimRevenue: FractionalizeContract['claimRevenue'] = useCallback(async (p) => {
    if (!ensureModule() || !wallet.publicKey) return noResult;
    return module!.claimRevenue({ nftMint: p.nftMint });
  }, [module, wallet.publicKey]);

  const voteOnLicense: FractionalizeContract['voteOnLicense'] = useCallback(async (p) => {
    if (!ensureModule() || !wallet.publicKey) {
      return { ...noResult, licenseVote: undefined } as any;
    }
    return module!.voteOnLicense({
      nftMint: p.nftMint,
      licenseProposalId: p.licenseProposalId,
      approve: p.approve,
    });
  }, [module, wallet.publicKey]);

  const finalizeLicenseVote: FractionalizeContract['finalizeLicenseVote'] = useCallback(async (p) => {
    if (!ensureModule() || !wallet.publicKey) return noResult;
    return module!.finalizeLicenseVote({
      nftMint: p.nftMint,
      licenseProposalId: p.licenseProposalId,
    });
  }, [module, wallet.publicKey]);

  const reclaimNft: FractionalizeContract['reclaimNft'] = useCallback(async (p) => {
    if (!ensureModule() || !wallet.publicKey) return noResult;
    const owner = wallet.publicKey;
    const ownerNftAccount =
      p.ownerNftAccount ?? getAssociatedTokenAddressSync(p.nftMint, owner, false);
    return module!.reclaimNft({
      nftMint: p.nftMint,
      ownerNftAccount,
    });
  }, [module, wallet.publicKey]);

  // 2026-05-20 — stabilise returned object so consumers using it as a
  // useEffect dependency don't re-fire every render.
  return useMemo(
    () => ({
      enabled,
      module,
      pdas: module?.pdas ?? null,
      payer: wallet.publicKey ?? null,
      walletReady,
      fetchFractionalNft,
      fetchFragmentHolder,
      fractionalizeNft,
      buyFragment,
      sellFragment,
      distributeRevenue,
      claimRevenue,
      voteOnLicense,
      finalizeLicenseVote,
      reclaimNft,
    }),
    [
      enabled,
      module,
      wallet.publicKey,
      walletReady,
      fetchFractionalNft,
      fetchFragmentHolder,
      fractionalizeNft,
      buyFragment,
      sellFragment,
      distributeRevenue,
      claimRevenue,
      voteOnLicense,
      finalizeLicenseVote,
      reclaimNft,
    ],
  );
}

// Re-export the seeds so pages can derive PDAs if needed.
export { FRACTIONALIZE_SEEDS, TOKEN_PROGRAM_ID };
export type { FractionalNftOnChain, FragmentHolderOnChain };
