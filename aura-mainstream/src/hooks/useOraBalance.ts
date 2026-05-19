/**
 * useOraBalance — read the current user's on-chain ORA SPL balance with
 * lightweight polling, with graceful fallback when the wallet isn't ready
 * or real-chain mode is off.
 *
 * Returns:
 *   - `balance`: number in UI units (ORA, decimals=9). null when unknown
 *     yet (wallet not connected, or first poll hasn't completed).
 *   - `enabled`: true when real-chain mode is on AND a wallet pubkey is
 *     present (Privy or Phantom).
 *   - `error`: last polling error message, if any. UI can display "—".
 *   - `refresh()`: trigger an immediate re-fetch (e.g. after a transfer).
 *
 * Polling cadence: 10s. Why not websockets? A wallet-pill update at this
 * cadence is plenty for human perception, and SPL balance subscriptions
 * would add `geyser` complexity we don't need yet.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useUnifiedWallet } from './useUnifiedWallet';
import { useOraContract } from './useOraContract';

export interface OraBalanceState {
  balance: number | null;
  enabled: boolean;
  error: string | null;
  refresh: () => void;
}

const DEFAULT_POLL_MS = 10_000;

export function useOraBalance(pollMs: number = DEFAULT_POLL_MS): OraBalanceState {
  const uw = useUnifiedWallet();
  const onChain = useOraContract();
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);
  const lastPk = useRef<string | null>(null);

  const enabled = onChain.enabled && uw.publicKey !== null;

  const fetchOnce = useCallback(async () => {
    if (!onChain.enabled) return;
    const pk = uw.publicKey;
    if (!pk) return;
    try {
      const raw = await onChain.getBalance(pk);
      if (cancelled.current) return;
      const ui = Number(raw) / Math.pow(10, onChain.decimals);
      setBalance(ui);
      setError(null);
    } catch (e) {
      if (cancelled.current) return;
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [onChain, uw.publicKey]);

  useEffect(() => {
    cancelled.current = false;
    // If wallet changed (or just connected), reset the displayed balance
    // so we don't show the previous user's number for a tick.
    const pk = uw.publicKey?.toBase58() ?? null;
    if (pk !== lastPk.current) {
      lastPk.current = pk;
      setBalance(null);
      setError(null);
    }
    if (!enabled) return;
    fetchOnce();
    const id = window.setInterval(fetchOnce, pollMs);
    return () => {
      cancelled.current = true;
      window.clearInterval(id);
    };
  }, [enabled, fetchOnce, pollMs, uw.publicKey]);

  const refresh = useCallback(() => { fetchOnce(); }, [fetchOnce]);

  return { balance, enabled, error, refresh };
}
