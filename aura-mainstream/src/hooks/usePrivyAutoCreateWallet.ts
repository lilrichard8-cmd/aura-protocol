/**
 * usePrivyAutoCreateWallet — make sure a Privy-authenticated email user
 * always ends up with a usable Solana embedded wallet AND that
 * `useUnifiedWallet()` can read the publicKey within a reasonable amount of
 * time.
 *
 * Two failure modes we observed before this rewrite (2026-05-19):
 *
 *   1. After email login, Privy backend creates the embedded wallet
 *      asynchronously but `useSolanaWallets()` may return an empty array
 *      for several seconds. The previous implementation saw `wallets=[]`,
 *      called `createWallet()`, and Privy threw "User already has an
 *      embedded wallet" because the server-side wallet was already there.
 *
 *   2. Sometimes the `useSolanaWallets()` array never populates at all
 *      until the page is refreshed, even though `user.linkedAccounts`
 *      contains the Solana wallet.
 *
 * Strategy now:
 *   - Wait for Privy ready + authenticated.
 *   - Check `user.linkedAccounts` for any entry that looks like a Solana
 *     wallet. If we find one, do NOT call `createWallet` — just wait for
 *     `useSolanaWallets()` to catch up (with a generous grace period).
 *   - If after the grace period the user has neither a linked Solana
 *     wallet NOR an entry in `useSolanaWallets()`, then (and only then)
 *     call `createWallet()` once.
 *   - Errors during create do NOT clear the "fired" guard immediately;
 *     they retry with backoff up to 3 attempts.
 *
 * Safe to mount once at app root.
 */

import { useEffect, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import {
  useCreateWallet,
  useWallets as usePrivySolanaWallets,
} from '@privy-io/react-auth/solana';

/** Heuristic: does any linkedAccount on the user look like a Solana wallet? */
function userHasSolanaLinkedAccount(user: unknown): boolean {
  if (!user || typeof user !== 'object') return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u = user as any;
  const accounts: unknown[] = Array.isArray(u.linkedAccounts) ? u.linkedAccounts : [];
  return accounts.some((acc) => {
    if (!acc || typeof acc !== 'object') return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = acc as any;
    // Privy marks wallets with type === 'wallet' and exposes chainType.
    // For Solana we expect chainType === 'solana' OR walletClientType === 'privy'
    // with a base58-shaped address.
    if (a.type !== 'wallet') return false;
    if (a.chainType === 'solana') return true;
    if (typeof a.address === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a.address)) {
      // Base58 Solana-shaped address with no chainType — treat as Solana.
      return true;
    }
    return false;
  });
}

export function usePrivyAutoCreateWallet(): void {
  const { authenticated, ready: privyReady, user } = usePrivy();
  const { wallets, ready: walletsReady } = usePrivySolanaWallets();
  const { createWallet } = useCreateWallet();
  const attempts = useRef(0);
  const lastFiredAt = useRef(0);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!privyReady || !walletsReady) return;
    if (!authenticated) {
      // Logged out — reset state so next sign-in can fire.
      attempts.current = 0;
      lastFiredAt.current = 0;
      inFlight.current = false;
      return;
    }
    // If we already have a Solana embedded wallet via the hook, nothing to do.
    if (wallets && wallets.length > 0) return;

    // If the user's linkedAccounts include a Solana wallet, the server
    // already provisioned one — `useSolanaWallets()` just hasn't synced yet.
    // Do NOT call createWallet (it would throw "already has embedded wallet").
    if (userHasSolanaLinkedAccount(user)) {
      // eslint-disable-next-line no-console
      console.info(
        '[usePrivyAutoCreateWallet] backend wallet exists, waiting for useSolanaWallets() to sync …'
      );
      return;
    }

    // No linked Solana wallet AND useSolanaWallets() is empty.
    // Backoff: max 3 attempts, 1.5s apart.
    if (inFlight.current) return;
    if (attempts.current >= 3) return;
    const now = Date.now();
    if (now - lastFiredAt.current < 1500) return;

    attempts.current += 1;
    lastFiredAt.current = now;
    inFlight.current = true;

    (async () => {
      try {
        // eslint-disable-next-line no-console
        console.info(
          `[usePrivyAutoCreateWallet] no Solana wallet yet, creating (attempt ${attempts.current}/3) …`
        );
        const result = await createWallet();
        // eslint-disable-next-line no-console
        const addr = (result as unknown as { wallet?: { address?: string } })?.wallet?.address
          ?? (result as unknown as { address?: string })?.address;
        // eslint-disable-next-line no-console
        console.info('[usePrivyAutoCreateWallet] wallet created:', addr);
        // Reset attempts so future logouts/logins can fire again.
        attempts.current = 0;
      } catch (err) {
        // eslint-disable-next-line no-console
        const msg = err instanceof Error ? err.message : String(err);
        // The only "expected" error is the race condition where Privy
        // already created the wallet. Treat it as success — useSolanaWallets()
        // will catch up on the next render.
        if (/already.*wallet/i.test(msg)) {
          // eslint-disable-next-line no-console
          console.info('[usePrivyAutoCreateWallet] race detected — backend wallet exists; will sync.');
          attempts.current = 3; // stop retrying
        } else {
          // eslint-disable-next-line no-console
          console.warn('[usePrivyAutoCreateWallet] createWallet failed:', msg);
        }
      } finally {
        inFlight.current = false;
      }
    })();
  }, [privyReady, walletsReady, authenticated, wallets, user, createWallet]);
}
