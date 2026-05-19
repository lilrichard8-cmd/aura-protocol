/**
 * useAutoFundLocalnet — auto-airdrop helper for Privy embedded wallets on
 * localnet.
 *
 * When the user lands on the app, just signed up with Privy email, and the
 * embedded wallet now exists, we want them to be able to *actually* test
 * Bounty V2 etc. without manually airdropping. The local Solana test-validator
 * supports `requestAirdrop`, so we:
 *
 *   1. Wait for Privy to finish bootstrapping AND for the embedded wallet to exist
 *   2. Check we're on localnet (cluster=localnet OR RPC includes 127.0.0.1)
 *   3. If wallet has < 1 SOL, airdrop 10 SOL
 *   4. Best-effort: ask a dev-only helper to mint some ORA to the user.
 *      For now this is just a `console.warn` stub — the real implementation
 *      will be a localnet-only API route or a one-shot CLI helper.
 *
 * Strict rules:
 *   - We NEVER airdrop on devnet/mainnet — that's the user's responsibility
 *     and devnet has rate-limited faucets that would ban us.
 *   - We dedupe per address via localStorage so refreshing the page doesn't
 *     spam new airdrops.
 *   - We swallow all errors — this is a UX nicety, not core flow.
 */

import { useEffect, useRef } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useUnifiedWallet } from './useUnifiedWallet';

const SEEN_KEY_PREFIX = 'aura_localnet_funded:';
const ORA_SEEN_KEY_PREFIX = 'aura_localnet_ora_funded:';
const TARGET_SOL = 10;
const MIN_SOL = 1;
const DEFAULT_ORA_AMOUNT = 1000;

/**
 * Calls the vite dev-mint plugin endpoint to mint 1000 ORA to the user.
 * No-op (silently logs) outside of localnet. The endpoint itself enforces
 * a localnet check too, so this is defense-in-depth.
 */
async function mintOraDevHelper(address: string): Promise<{ ok: boolean; signature?: string; error?: string }> {
  try {
    const url = `/__dev/mint-ora?addr=${encodeURIComponent(address)}&amount=${DEFAULT_ORA_AMOUNT}`;
    const res = await fetch(url, { method: 'POST' });
    const body = await res.json().catch(() => ({ ok: false, error: 'invalid json' }));
    if (!res.ok || !body.ok) {
      // eslint-disable-next-line no-console
      console.warn('[useAutoFundLocalnet] mint endpoint failed', body);
      return { ok: false, error: body?.error ?? `HTTP ${res.status}` };
    }
    // eslint-disable-next-line no-console
    console.info(`[useAutoFundLocalnet] minted ${DEFAULT_ORA_AMOUNT} ORA to ${address}, sig=${body.signature}`);
    return { ok: true, signature: body.signature };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[useAutoFundLocalnet] mint fetch failed', err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function useAutoFundLocalnet(): void {
  const { connection } = useConnection();
  const uw = useUnifiedWallet();
  // Guard against double-fire from StrictMode + dep changes
  const inFlight = useRef<string | null>(null);

  useEffect(() => {
    // Only ever auto-fund Privy embedded wallets. Phantom users brought their
    // own wallet and probably already have funds.
    if (uw.source !== 'privy') return;
    if (!uw.isLocalnet) return;
    if (!uw.publicKey) return;

    const addr = uw.publicKey.toBase58();
    if (inFlight.current === addr) return;

    // Dedupe across page reloads.
    const seenKey = SEEN_KEY_PREFIX + addr;
    if (localStorage.getItem(seenKey)) return;

    inFlight.current = addr;

    (async () => {
      try {
        // 1) SOL airdrop (only if balance below threshold)
        const balanceLamports = await connection.getBalance(uw.publicKey!);
        const balanceSol = balanceLamports / LAMPORTS_PER_SOL;
        if (balanceSol < MIN_SOL) {
          // eslint-disable-next-line no-console
          console.info(`[useAutoFundLocalnet] balance=${balanceSol} SOL, requesting airdrop of ${TARGET_SOL} SOL …`);
          const sig = await connection.requestAirdrop(uw.publicKey!, TARGET_SOL * LAMPORTS_PER_SOL);
          await connection.confirmTransaction(sig, 'confirmed');
          // eslint-disable-next-line no-console
          console.info(`[useAutoFundLocalnet] airdrop confirmed: ${sig}`);
        }
        localStorage.setItem(seenKey, String(Date.now()));
      } catch (err) {
        // Most common cause: test-validator not running yet. Don't loop.
        // eslint-disable-next-line no-console
        console.warn('[useAutoFundLocalnet] airdrop failed', err);
        // Don't set seenKey — let it retry next session in case validator is back.
      }

      // 2) ORA mint (independent dedupe — once per address only)
      const oraSeenKey = ORA_SEEN_KEY_PREFIX + addr;
      if (!localStorage.getItem(oraSeenKey)) {
        const result = await mintOraDevHelper(addr);
        if (result.ok) {
          localStorage.setItem(oraSeenKey, String(Date.now()));
        }
        // On failure, don't set the seen key — retry on next session.
      }

      if (inFlight.current === addr) inFlight.current = null;
    })();
  }, [connection, uw.source, uw.isLocalnet, uw.publicKey]);
}
