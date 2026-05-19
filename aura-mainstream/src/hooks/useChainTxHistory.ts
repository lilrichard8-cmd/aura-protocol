/**
 * useChainTxHistory — fetches recent on-chain signatures for the connected
 * wallet (or its ORA ATA) and parses them into a lightweight transaction
 * summary list the UI can render.
 *
 * Why this exists (2026-05-19 — Tier-2 wire-up):
 *   - WalletPage / DashboardPage / NotificationsPage all want to show
 *     "recent activity" but the mock chain has zero overlap with real
 *     SPL transfers happening on-chain.
 *   - There is no on-chain indexer in localnet, so we use the basic
 *     `connection.getSignaturesForAddress(address, {limit})` RPC which
 *     returns timestamped signatures + memos. This is enough to render
 *     a unified history alongside the existing mock list.
 *
 * Scope discipline:
 *   - Best-effort. If RPC fails / address is missing / off-chain mode,
 *     returns an empty array. Callers should keep mock fallback intact.
 *   - We pull signatures for BOTH the user wallet AND their ORA ATA so
 *     ORA token movements (which touch the ATA, not the wallet) show up.
 *   - We do NOT parse transaction content beyond what
 *     `getParsedTransaction` gives us; deeper decoding belongs in an
 *     indexer, not a hook.
 *
 * Returned shape mirrors mockChain.transactions enough that the History
 * tab in WalletPage can splice it in without reshaping rows.
 */

import { useEffect, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { useOraContract } from './useOraContract';
import { useUnifiedWallet } from './useUnifiedWallet';

export interface ChainTx {
  /** Stable id (`chain:` prefixed) so it never collides with mock tx ids. */
  id: string;
  /** Real signature — used for Explorer links. */
  txHash: string;
  /** ms since epoch */
  timestamp: number;
  /** Best-effort type label inferred from logs/memos; falls back to 'on-chain'. */
  type: string;
  /** Free-form details — the first memo line if present, else a slot stub. */
  details: string;
  /** Signed amount in ORA UI units when we can infer one, else 0. */
  amount: number;
  /** Marker so the row UI can pick a different background. */
  source: 'chain';
}

interface State {
  txs: ChainTx[];
  loading: boolean;
  error: string | null;
}

const POLL_MS = 30_000;
const LIMIT = 25;

/**
 * Pulls the most recent signatures for the connected wallet AND its ORA
 * ATA, merges, dedupes, sorts newest-first. Refreshes every 30s.
 *
 * Returns `{ txs: [], loading: false }` when real-chain mode is off so the
 * UI can simply spread `...chainHistory.txs` and get nothing in mock mode.
 */
export function useChainTxHistory(): State {
  const { connection } = useConnection();
  const uw = useUnifiedWallet();
  const onChain = useOraContract();
  const enabled = onChain.enabled && uw.publicKey !== null;
  const [state, setState] = useState<State>({ txs: [], loading: false, error: null });

  useEffect(() => {
    if (!enabled || !uw.publicKey) {
      setState({ txs: [], loading: false, error: null });
      return;
    }
    let cancelled = false;
    const owner = uw.publicKey;

    const tick = async () => {
      if (!cancelled) setState((s) => ({ ...s, loading: true }));
      try {
        const ata = await getAssociatedTokenAddress(onChain.oraMint, owner);
        const [walletSigs, ataSigs] = await Promise.all([
          connection.getSignaturesForAddress(owner, { limit: LIMIT }).catch(() => []),
          connection.getSignaturesForAddress(ata, { limit: LIMIT }).catch(() => []),
        ]);
        const merged = new Map<string, ChainTx>();
        for (const s of [...walletSigs, ...ataSigs]) {
          if (!s.signature) continue;
          if (merged.has(s.signature)) continue;
          const ts = (s.blockTime ?? Math.floor(Date.now() / 1000)) * 1000;
          // Pull a tiny bit of context from memo if present.
          let type = 'on-chain';
          let details = `Slot ${s.slot}`;
          if (s.memo) {
            // memo format: "[1] some text" — strip the bracket prefix.
            details = s.memo.replace(/^\[\d+\]\s*/, '').slice(0, 120) || details;
          }
          if (s.err) type = 'failed';
          merged.set(s.signature, {
            id: `chain:${s.signature}`,
            txHash: s.signature,
            timestamp: ts,
            type,
            details,
            amount: 0,
            source: 'chain',
          });
        }
        const txs = Array.from(merged.values()).sort((a, b) => b.timestamp - a.timestamp);
        if (!cancelled) setState({ txs, loading: false, error: null });
      } catch (e) {
        if (!cancelled) {
          setState({
            txs: [],
            loading: false,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    };

    tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, uw.publicKey, connection, onChain.oraMint]);

  return state;
}
