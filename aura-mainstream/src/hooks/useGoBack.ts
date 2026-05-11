import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Smart back navigation.
 *
 * Detail pages (CoinDetail, NftDetail, etc.) are reached from many surfaces:
 *   - Marketplace (CC market, NFT grid)
 *   - Explore page (leaderboard tile, search hit)
 *   - Profile page (user's own coin badge)
 *   - Wallet page (holdings list)
 *   - Studio page (post-mint deep link)
 *   - Direct URL / refresh / new tab (no history)
 *
 * `navigate(-1)` works for in-app back-clicks but breaks on direct loads or
 * when callers used `replace: true`. To keep back behavior predictable we
 * thread the source path explicitly via `location.state.from`.
 *
 * Callers entering a detail page should pass:
 *     navigate('/marketplace/coin/iris', { state: { from: location.pathname } });
 *     <Link to="..." state={{ from: location.pathname }} />
 *
 * The detail page then calls `goBack()` which:
 *   1. uses `state.from` if present (most accurate),
 *   2. falls back to browser history (`navigate(-1)`) if there's any,
 *   3. falls back to the supplied default route as a last resort.
 */
export function useGoBack(fallback: string = '/') {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    const fromState = (location.state as { from?: string } | null)?.from;
    if (fromState && typeof fromState === 'string') {
      navigate(fromState);
      return;
    }
    // window.history.length > 1 means we have at least one prior entry.
    // Some browsers always report >= 2, so this is a soft check.
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(fallback);
  }, [navigate, location.state, fallback]);
}
