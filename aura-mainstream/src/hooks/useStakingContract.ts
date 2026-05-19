/**
 * useStakingContract — bridges WalletPage staking tab to the on-chain
 * `aura_staking` program via the AURA SDK StakingModule.
 *
 * Feature-flagged: only activates when `VITE_STAKING_REAL_CHAIN === 'true'`.
 * Otherwise returns `{ enabled: false }` and the page should fall back to
 * MockChainContext (mockChain.stakeOra / unstakeOra / claimStakingReward).
 *
 * Tier 1.5 wire-up (2026-05-19). Mirrors useBountyContract / useOraContract
 * patterns so feature flag toggling is the only thing the page needs to
 * worry about.
 *
 * --- Status (2026-05-19) ---
 *
 * Program deployed at BU5dKjtXCPqCffJe7GaPR8Eu1pVfgWFLAUFeHcT8ENZA on localnet.
 * Staking pool PDA initialized (run `scripts/init-staking-pool.mjs` as admin).
 *
 * Audit-fix-aligned ABI:
 *   • [C-S1] Stake PDA seeds use a per-user `StakeCounter` monotonic nonce.
 *     The SDK auto-initializes the counter on first stake and reads the
 *     current `next_nonce` to derive the stake PDA.
 *   • `stake_ora(amount, lockup_tier)` — no more `stake_nonce` arg.
 *   • `unstake_ora(stake_nonce)` / `claim_staking_reward(stake_nonce)` use
 *     the nonce assigned by the counter at stake time. `fetchStake` returns
 *     `stakeNonce`, which is what callers should persist UI-side.
 *
 * Vault layout: principal vault & reward vault are currently the same ATA
 * (`getAssociatedTokenAddress(oraMint, poolPda)`). The contract's UnstakeOra
 * and ClaimStakingReward contexts pass them as separate AccountInfos, so
 * the SDK exposes `vaultTokenAccount` and `rewardVault` independently; we
 * hand the same ATA to both until reward-vault separation lands.
 */

import { useMemo, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { useUnifiedWalletAsAdapter, type UnifiedWalletAdapter } from './useUnifiedWallet';
import {
  StakingModule,
  LockupTier,
  LOCKUP_PARAMS,
  EARLY_UNSTAKE_PENALTY_BPS,
  PROGRAM_IDS,
} from '@aura-protocol/sdk';
import type { StakeAccountOnChain, StakingPoolOnChain } from '@aura-protocol/sdk/dist/modules/staking';

// Real on-chain program id (matches programs/staking/Cargo.toml +
// SDK PROGRAM_IDS.LOCALNET.staking). The SDK constant already points here;
// kept explicit for parity with useBountyContract.
const DEFAULT_STAKING_PROGRAM_ID = PROGRAM_IDS.LOCALNET.staking;

function readPubkey(name: string, fallback: PublicKey): PublicKey {
  const raw = (import.meta as any).env?.[name] as string | undefined;
  if (!raw) return fallback;
  try {
    return new PublicKey(raw);
  } catch {
    console.warn(`[useStakingContract] invalid pubkey for ${name}, falling back`);
    return fallback;
  }
}

/** Map UI lock-day choices to SDK LockupTier enum. */
export function lockDaysToTier(days: number): LockupTier {
  if (days >= 360) return LockupTier.TwelveMonths;
  if (days >= 180) return LockupTier.SixMonths;
  if (days >= 90) return LockupTier.ThreeMonths;
  return LockupTier.OneMonth;
}

export interface TxResult {
  signature: string;
  success: boolean;
  error?: string;
}

export interface StakeOraArgs {
  /** UI ORA amount (whole-token units). Will be scaled to raw with 9 decimals. */
  amount: number;
  /** Lock days from the UI tier selector (30 / 90 / 180 / 360). */
  lockDays: number;
}

export interface UnstakeOraArgs {
  /**
   * [audit fix C-S1] Per-user monotonic nonce assigned by StakeCounter at
   * stake time. Read off `fetchStake(addr).stakeNonce` if you only have the
   * PDA in hand.
   */
  stakeNonce: bigint | number;
}

export interface ClaimRewardArgs {
  stakeNonce: bigint | number;
}

export interface StakingContract {
  /** True only when VITE_STAKING_REAL_CHAIN=true AND env config resolves. */
  enabled: boolean;
  module: StakingModule | null;
  oraMint: PublicKey;
  decimals: number;
  /** Re-exported for UI badges that show lockup tier params. */
  LOCKUP_PARAMS: typeof LOCKUP_PARAMS;
  EARLY_UNSTAKE_PENALTY_BPS: typeof EARLY_UNSTAKE_PENALTY_BPS;
  /** Read the staking pool global state (totals, accumulated rewards). */
  fetchPool: () => Promise<StakingPoolOnChain | null>;
  /** Read a single stake account by PDA. */
  fetchStake: (addr: PublicKey) => Promise<StakeAccountOnChain | null>;
  /**
   * Stake `amount` ORA with the given lock period.
   * Auto-initializes the per-user StakeCounter on first stake.
   * Returns the stake PDA AND the nonce assigned by the on-chain counter.
   */
  stakeOra: (
    args: StakeOraArgs,
  ) => Promise<TxResult & { stake?: PublicKey; nonce?: bigint }>;
  /** Unstake the stake identified by `stakeNonce` (full amount). */
  unstakeOra: (args: UnstakeOraArgs) => Promise<TxResult>;
  /** Claim accrued reward for the stake identified by `stakeNonce`. */
  claimReward: (args: ClaimRewardArgs) => Promise<TxResult>;
  /** One-time per user; idempotent. Most callers don't need this —
   *  `stakeOra` auto-initializes the counter. */
  initializeStakeCounter: () => Promise<TxResult>;
}

export function useStakingContract(): StakingContract {
  const { connection } = useConnection();
  // Unified wallet so Privy embedded users can sign too.
  const wallet = useUnifiedWalletAsAdapter();

  const flag = (import.meta as any).env?.VITE_STAKING_REAL_CHAIN === 'true';
  const oraMint = useMemo(
    () =>
      readPubkey('VITE_ORA_MINT', new PublicKey('11111111111111111111111111111111')),
    [],
  );
  // `enabled` requires both the flag AND a non-placeholder mint, mirroring
  // useOraContract.
  const mintIsPlaceholder = oraMint.equals(new PublicKey('11111111111111111111111111111111'));
  const enabled = flag && !mintIsPlaceholder;

  const programId = useMemo(
    () => readPubkey('VITE_STAKING_PROGRAM_ID', DEFAULT_STAKING_PROGRAM_ID),
    [],
  );

  const module = useMemo(() => {
    if (!enabled) return null;
    return new StakingModule(connection, wallet as UnifiedWalletAdapter, programId);
  }, [connection, wallet, programId, enabled]);

  // The on-chain pool holds the vault token account. The SDK doesn't surface
  // its address directly; the deployed program creates the vault as an ATA of
  // the pool PDA against the ORA mint, so we derive it here.
  // 2026-05-20 — useCallback because stakeOra/unstakeOra/claimReward depend
  // on it; identity stability here propagates to the outer returned object.
  const getVaultAta = useCallback(async (): Promise<PublicKey> => {
    if (!module) throw new Error('Staking module not enabled');
    return getAssociatedTokenAddress(oraMint, module.pdas.pool, true);
  }, [module, oraMint]);

  const fetchPool: StakingContract['fetchPool'] = useCallback(async () => {
    if (!module) return null;
    try {
      return await module.fetchPool();
    } catch (e) {
      console.warn('[useStakingContract] fetchPool failed:', e);
      return null;
    }
  }, [module]);

  const fetchStake: StakingContract['fetchStake'] = useCallback(async (addr) => {
    if (!module) return null;
    try {
      return await module.fetchStake(addr);
    } catch (e) {
      console.warn('[useStakingContract] fetchStake failed:', e);
      return null;
    }
  }, [module]);

  const stakeOra: StakingContract['stakeOra'] = useCallback(async ({ amount, lockDays }) => {
    if (!module) return { signature: '', success: false, error: 'Staking module not enabled' };
    if (!wallet.publicKey) return { signature: '', success: false, error: 'Wallet not connected' };
    if (!(amount > 0)) return { signature: '', success: false, error: 'amount must be > 0' };
    const raw = BigInt(Math.round(amount * 1e9)); // ORA has 9 decimals
    const tier = lockDaysToTier(lockDays);
    try {
      const [vaultAta, userAta] = await Promise.all([
        getVaultAta(),
        getAssociatedTokenAddress(oraMint, wallet.publicKey),
      ]);
        // [audit fix C-S1] StakeCounter (per-user monotonic nonce) is
      // auto-initialized by the SDK on first stake; the nonce assigned by
      // the on-chain counter is returned as `res.nonce`. Callers needing to
      // unstake/claim should persist this nonce (or re-derive it from
      // `fetchStake().stakeNonce`).
      const res = await module.stakeOra({
        amount: raw,
        lockupTier: tier,
        vaultTokenAccount: vaultAta,
        userTokenAccount: userAta,
      });
      return {
        signature: res.signature,
        success: res.success,
        error: res.error,
        stake: res.stake,
        nonce: res.nonce,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { signature: '', success: false, error: msg };
    }
  }, [module, wallet.publicKey, oraMint, getVaultAta]);

  const initializeStakeCounter: StakingContract['initializeStakeCounter'] = useCallback(async () => {
    if (!module) return { signature: '', success: false, error: 'Staking module not enabled' };
    if (!wallet.publicKey) return { signature: '', success: false, error: 'Wallet not connected' };
    try {
      return await module.initializeStakeCounter();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { signature: '', success: false, error: msg };
    }
  }, [module, wallet.publicKey]);

  const unstakeOra: StakingContract['unstakeOra'] = useCallback(async ({ stakeNonce }) => {
    if (!module) return { signature: '', success: false, error: 'Staking module not enabled' };
    if (!wallet.publicKey) return { signature: '', success: false, error: 'Wallet not connected' };
    try {
      const [vaultAta, userAta] = await Promise.all([
        getVaultAta(),
        getAssociatedTokenAddress(oraMint, wallet.publicKey),
      ]);
      // Principal vault & reward vault are the same ATA for now.
      const res = await module.unstakeOra({
        stakeNonce,
        vaultTokenAccount: vaultAta,
        rewardVault: vaultAta,
        userTokenAccount: userAta,
      });
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { signature: '', success: false, error: msg };
    }
  }, [module, wallet.publicKey, oraMint, getVaultAta]);

  const claimReward: StakingContract['claimReward'] = useCallback(async ({ stakeNonce }) => {
    if (!module) return { signature: '', success: false, error: 'Staking module not enabled' };
    if (!wallet.publicKey) return { signature: '', success: false, error: 'Wallet not connected' };
    try {
      const [vaultAta, userAta] = await Promise.all([
        getVaultAta(),
        getAssociatedTokenAddress(oraMint, wallet.publicKey),
      ]);
      const res = await module.claimStakingReward({
        stakeNonce,
        rewardVault: vaultAta,
        userTokenAccount: userAta,
      });
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { signature: '', success: false, error: msg };
    }
  }, [module, wallet.publicKey, oraMint, getVaultAta]);

  // 2026-05-20 — stabilise the returned object so consumers using it as a
  // useEffect dependency don't re-fire every render. All inner functions are
  // now useCallback'd, so their identities are stable; the outer useMemo
  // re-runs only when those identities actually change.
  return useMemo(
    () => ({
      enabled,
      module,
      oraMint,
      decimals: 9,
      LOCKUP_PARAMS,
      EARLY_UNSTAKE_PENALTY_BPS,
      fetchPool,
      fetchStake,
      stakeOra,
      unstakeOra,
      claimReward,
      initializeStakeCounter,
    }),
    [
      enabled,
      module,
      oraMint,
      fetchPool,
      fetchStake,
      stakeOra,
      unstakeOra,
      claimReward,
      initializeStakeCounter,
    ],
  );
}

export { LockupTier, TOKEN_PROGRAM_ID };
export type { StakeAccountOnChain, StakingPoolOnChain };
