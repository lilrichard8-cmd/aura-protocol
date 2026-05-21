/**
 * ClaimTestOraButton — devnet-only "🚰 Claim 1000 test ORA" CTA.
 *
 * Mounts on the BuyOraPage header and inside the OnboardingPage "First
 * Steps" list. Calls POST /api/faucet which is rate-limited per wallet
 * (1 claim / 24h) and per IP (10 / hour).
 *
 * Visibility rules:
 *   - Always hidden on mainnet (VITE_NETWORK=mainnet or VITE_FAUCET_ENABLED=false)
 *   - On localnet, defers to the existing useAutoFundLocalnet hook (we
 *     return null so the page never shows two faucets side-by-side).
 *   - On devnet, renders the button.
 *
 * State machine:
 *   idle      → button enabled
 *   loading   → spinner + "Claiming…"
 *   cooldown  → disabled + "Next claim in HH:MM"  (set on 429)
 *   error     → toast + return to idle
 *   success   → toast + balance refresh + "Claimed ✓" (5s) → idle
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Coins, Loader2, Check, AlertCircle, Sparkles, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';
import { useOraBalance } from '@/hooks/useOraBalance';
import { useToast } from '@/context/ToastContext';

type Variant = 'card' | 'inline';

interface Props {
  /** Visual layout. `card` is the big BuyOraPage banner; `inline` is the
   *  smaller onboarding-step variant. */
  variant?: Variant;
  className?: string;
}

interface FaucetSuccess {
  ok: true;
  signature: string;
  amount: number;
  mint: string;
  recipient: string;
  network: string;
}
interface FaucetError {
  ok: false;
  error: string;
  message?: string;
  retryAfterSec?: number;
  lastClaimAt?: number;
}
type FaucetResp = FaucetSuccess | FaucetError;

const LS_KEY = 'aura_faucet_last_claim:';
const COOLDOWN_SEC = 24 * 60 * 60;

function readNetwork(): string {
  const explicit = (import.meta as any).env?.VITE_NETWORK as string | undefined;
  if (explicit) return explicit.toLowerCase();
  const cluster = (import.meta as any).env?.VITE_SOLANA_CLUSTER as string | undefined;
  if (cluster) return cluster.toLowerCase();
  const rpc = (import.meta as any).env?.VITE_RPC_URL as string | undefined;
  if (rpc?.includes('127.0.0.1') || rpc?.includes('localhost')) return 'localnet';
  if (rpc?.includes('devnet')) return 'devnet';
  if (rpc?.includes('mainnet')) return 'mainnet';
  return 'devnet';
}

function readEnabled(): boolean {
  const env = (import.meta as any).env;
  // Explicit kill-switch wins.
  if (env?.VITE_FAUCET_ENABLED === 'false') return false;
  // Default rule: only on devnet (localnet has useAutoFundLocalnet).
  const net = readNetwork();
  return net === 'devnet';
}

function formatRemaining(secLeft: number): string {
  const h = Math.floor(secLeft / 3600);
  const m = Math.floor((secLeft % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.max(1, secLeft)}s`;
}

export function ClaimTestOraButton({ variant = 'card', className }: Props): React.ReactElement | null {
  const uw = useUnifiedWallet();
  const { showToast } = useToast();
  const { balance, refresh: refreshBalance } = useOraBalance();
  const enabled = useMemo(readEnabled, []);
  const network = useMemo(readNetwork, []);

  const [phase, setPhase] = useState<'idle' | 'loading' | 'success'>('idle');
  const [cooldownSec, setCooldownSec] = useState<number>(0);
  const [lastSig, setLastSig] = useState<string | null>(null);

  const addr = uw.publicKey?.toBase58() ?? null;

  // On wallet change, see if there's a saved cooldown.
  useEffect(() => {
    if (!addr) { setCooldownSec(0); return; }
    const raw = localStorage.getItem(LS_KEY + addr);
    if (!raw) { setCooldownSec(0); return; }
    const lastAt = Number(raw);
    if (!Number.isFinite(lastAt)) { setCooldownSec(0); return; }
    const elapsed = Math.floor((Date.now() - lastAt) / 1000);
    const left = COOLDOWN_SEC - elapsed;
    setCooldownSec(left > 0 ? left : 0);
  }, [addr]);

  // Tick the cooldown countdown each second.
  useEffect(() => {
    if (cooldownSec <= 0) return;
    const id = window.setInterval(() => {
      setCooldownSec((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldownSec > 0]);

  const handleClaim = useCallback(async () => {
    if (!addr) {
      showToast('error', 'Connect a wallet first');
      return;
    }
    setPhase('loading');
    try {
      const res = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ walletAddress: addr }),
      });
      const data = (await res.json().catch(() => ({ ok: false, error: 'invalid_response' }))) as FaucetResp;

      if (!res.ok || !data.ok) {
        const err = data as FaucetError;
        if (res.status === 429) {
          const wait = err.retryAfterSec ?? COOLDOWN_SEC;
          // Persist last claim time so refreshes don't reset the countdown.
          if (err.lastClaimAt) {
            localStorage.setItem(LS_KEY + addr, String(err.lastClaimAt));
          } else {
            localStorage.setItem(LS_KEY + addr, String(Date.now() - (COOLDOWN_SEC - wait) * 1000));
          }
          setCooldownSec(wait);
          setPhase('idle');
          showToast('warning', 'Already claimed', {
            message: `Next claim available in ${formatRemaining(wait)}.`,
          });
          return;
        }
        setPhase('idle');
        showToast('error', 'Claim failed', {
          message: err.message ?? err.error ?? 'Unknown error',
        });
        return;
      }

      const ok = data as FaucetSuccess;
      setLastSig(ok.signature);
      localStorage.setItem(LS_KEY + addr, String(Date.now()));
      setCooldownSec(COOLDOWN_SEC);
      setPhase('success');
      showToast('success', `+${ok.amount} ORA claimed`, {
        message: 'Funds will appear in a few seconds.',
      });
      // Give the chain a moment, then refresh balance a couple of times.
      setTimeout(() => refreshBalance(), 1500);
      setTimeout(() => refreshBalance(), 6000);
      // Reset to idle after 5s so user can see the success state.
      setTimeout(() => setPhase('idle'), 5000);
    } catch (err) {
      setPhase('idle');
      showToast('error', 'Network error', {
        message: err instanceof Error ? err.message : 'Could not reach faucet',
      });
    }
  }, [addr, showToast, refreshBalance]);

  if (!enabled) return null;
  if (!uw.connected || !addr) {
    // Don't render on a connected-wallet-required page; the wrapper page
    // already shows a "connect wallet" CTA elsewhere.
    if (variant === 'inline') return null;
    return (
      <div className={`rounded-2xl border-2 border-dashed border-purple-300/40 bg-purple-500/5 p-5 text-center ${className ?? ''}`}>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Coins className="w-4 h-4" />
          Connect a wallet to claim test ORA on {network}.
        </div>
      </div>
    );
  }

  // ── Inline variant (used in onboarding "first steps" list) ─────────
  if (variant === 'inline') {
    const disabled = phase === 'loading' || cooldownSec > 0;
    return (
      <div className={`flex items-center gap-3 ${className ?? ''}`}>
        <Button
          type="button"
          size="sm"
          onClick={handleClaim}
          disabled={disabled}
          className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 disabled:opacity-70"
        >
          {phase === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {phase === 'success' && <Check className="w-3.5 h-3.5" />}
          {phase === 'idle' && cooldownSec === 0 && <Coins className="w-3.5 h-3.5" />}
          {phase === 'loading'
            ? 'Claiming…'
            : phase === 'success'
              ? 'Claimed!'
              : cooldownSec > 0
                ? `Next claim in ${formatRemaining(cooldownSec)}`
                : 'Claim 1000 ORA'}
        </Button>
        <span className="text-xs text-muted-foreground">
          {balance !== null
            ? <>Balance: <span className="font-mono font-medium text-foreground">{balance.toFixed(2)}</span> ORA</>
            : null}
        </span>
      </div>
    );
  }

  // ── Card variant (top of BuyOraPage) ───────────────────────────────
  const disabled = phase === 'loading' || cooldownSec > 0;
  return (
    <div className={`rounded-2xl border border-purple-300/40 bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-amber-500/10 p-5 md:p-6 ${className ?? ''}`}>
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold">Get free test ORA</h3>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-500 px-2 py-0.5 rounded">
              {network} only
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            New on AURA? Grab <span className="font-semibold text-foreground">1000 ORA</span> from the
            faucet — no real money needed. One claim per wallet every 24 hours.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={handleClaim}
              disabled={disabled}
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 disabled:opacity-70"
            >
              {phase === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
              {phase === 'success' && <Check className="w-4 h-4" />}
              {phase === 'idle' && cooldownSec === 0 && <Coins className="w-4 h-4" />}
              {phase === 'loading'
                ? 'Claiming…'
                : phase === 'success'
                  ? '+1000 ORA claimed'
                  : cooldownSec > 0
                    ? `Next claim in ${formatRemaining(cooldownSec)}`
                    : 'Claim 1000 ORA'}
            </Button>
            {balance !== null && (
              <span className="text-xs text-muted-foreground">
                Balance: <span className="font-mono font-medium text-foreground">{balance.toFixed(2)}</span> ORA
              </span>
            )}
            {lastSig && phase === 'success' && (
              <a
                href={`https://explorer.solana.com/tx/${lastSig}?cluster=${network === 'devnet' ? 'devnet' : 'mainnet'}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-purple-500 hover:underline"
              >
                <ExternalLink className="w-3 h-3" /> View tx
              </a>
            )}
            {cooldownSec > 0 && phase !== 'loading' && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-3 h-3" /> Already claimed in the last 24h
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ClaimTestOraButton;
