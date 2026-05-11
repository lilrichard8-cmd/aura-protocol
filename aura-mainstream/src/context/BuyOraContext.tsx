/**
 * BuyOraContext — global open/close control for the Buy ORA modal dialog.
 *
 * Mount <BuyOraProvider> once near the top of the React tree (we do it in
 * App.tsx). Any descendant can then call `useBuyOra().open(suggestedAmount?)`
 * to pop the dialog without having to manage local state or navigate routes.
 *
 * Used by:
 *   - useOraGuard()  — "Buy ORA" CTA on insufficient-balance toasts
 *   - Marketplace top bar Buy ORA button
 *   - Wallet → CurationEligibilityCard Add ORA button
 *
 * 2026-05-11 — Zhuoyu asked for a lighter modal-style top-up flow instead of
 * a full page navigation, so this context replaces the navigate('/buy-ora') path.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import BuyOraDialog from '@/components/wallet/BuyOraDialog';

interface BuyOraContextValue {
  /** Open the Buy ORA dialog. `suggestedAmount` pre-fills the amount field. */
  open: (suggestedAmount?: number) => void;
  /** Close the Buy ORA dialog (rarely needed from outside — dialog auto-closes). */
  close: () => void;
  /** Current open state (useful for disabling triggers while open). */
  isOpen: boolean;
}

const BuyOraContext = createContext<BuyOraContextValue | null>(null);

export function useBuyOra(): BuyOraContextValue {
  const ctx = useContext(BuyOraContext);
  if (!ctx) {
    throw new Error('useBuyOra must be used within <BuyOraProvider>');
  }
  return ctx;
}

export function BuyOraProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestedAmount, setSuggestedAmount] = useState<number | undefined>(undefined);

  const open = useCallback((amount?: number) => {
    setSuggestedAmount(amount && amount > 0 ? amount : undefined);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = useMemo<BuyOraContextValue>(() => ({ open, close, isOpen }), [open, close, isOpen]);

  return (
    <BuyOraContext.Provider value={value}>
      {children}
      <BuyOraDialog open={isOpen} onClose={close} suggestedAmount={suggestedAmount} />
    </BuyOraContext.Provider>
  );
}
