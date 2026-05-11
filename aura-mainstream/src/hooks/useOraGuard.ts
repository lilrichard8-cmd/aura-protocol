/**
 * useOraGuard — central pre-flight check for any action that spends ORA.
 *
 * Pattern:
 *   const guard = useOraGuard();
 *   const onBoost = () => {
 *     if (!guard.ensure(boostCost, 'Boost this post')) return;
 *     await mockChain.boostPost(...);
 *   };
 *
 * If the balance is insufficient, we show an error toast that includes a
 * "Buy ORA" action button taking the user straight to `/buy-ora` with the
 * needed amount pre-filled (via query string `?amount=<n>`).
 *
 * This replaces the dozens of ad-hoc `showToast('error', 'Insufficient ORA')`
 * calls scattered across the codebase. Every action that touches ORA should
 * go through this guard so the CTA is consistent.
 *
 * 2026-05-11 — created in response to Zhuoyu's request to surface a
 * "buy ORA" CTA every time a purchase hits an insufficient balance.
 */
import { useCallback } from 'react';
import { useMockChain } from '@/context/MockChainContext';
import { useToast } from '@/context/ToastContext';
import { useBuyOra } from '@/context/BuyOraContext';

export interface OraGuard {
  /** Returns true if balance is sufficient. Otherwise shows a toast with a
   *  Buy ORA CTA and returns false. */
  ensure: (requiredAmount: number, actionLabel?: string) => boolean;
  /** Navigate to /buy-ora directly (e.g. for explicit Buy buttons). Optionally
   *  pre-fills the amount field. */
  goBuyOra: (suggestedAmount?: number) => void;
}

export function useOraGuard(): OraGuard {
  const mockChain = useMockChain();
  const { showToast } = useToast();
  const buyOra = useBuyOra();

  // Open the lightweight BuyOraDialog (modal) rather than navigating to /buy-ora,
  // so the user keeps their current page context (post / live stream / marketplace).
  const goBuyOra = useCallback((suggestedAmount?: number) => {
    buyOra.open(suggestedAmount);
  }, [buyOra]);

  const ensure = useCallback((requiredAmount: number, actionLabel?: string) => {
    if (!Number.isFinite(requiredAmount) || requiredAmount <= 0) return true;
    if (mockChain.oraBalance >= requiredAmount) return true;

    const need = requiredAmount - mockChain.oraBalance;
    const title = actionLabel ? `Not enough ORA for ${actionLabel}` : 'Not enough ORA';
    const message = `Need ${requiredAmount.toFixed(2)} ORA — you have ${mockChain.oraBalance.toFixed(2)}. Top up ${need.toFixed(2)} to continue.`;
    showToast('error', title, {
      message,
      duration: 7000,
      action: {
        label: 'Buy ORA',
        // Suggest topping up enough to cover the shortfall + small headroom.
        onClick: () => goBuyOra(Math.ceil(need * 1.1)),
      },
    });
    return false;
  }, [mockChain.oraBalance, showToast, goBuyOra]);

  return { ensure, goBuyOra };
}
