import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Layers, Plus, Minus, Wallet, Coins, Compass, Activity, Link2,
} from 'lucide-react';
import { PublicKey } from '@solana/web3.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useMockChain } from '@/context/MockChainContext';
import { useToast } from '@/context/ToastContext';
import { useOraGuard } from '@/hooks/useOraGuard';
import { useGoBack } from '@/hooks/useGoBack';
import { useFractionalizeContract } from '@/hooks/useFractionalizeContract';

/**
 * Fractional Ownership detail page.
 *
 * Pulls the canonical fractional NFT record from `mockChain.fractionalizedNfts`
 * and renders the full trade panel (buy / sell / claim revenue) in a layout
 * that mirrors NftDetailPage:
 *   • Outer shell `pt-[60px] md:pt-2 pb-24 md:pb-4 min-h-screen`
 *   • Sticky header `top-[60px] md:top-0` with smart back button
 *   • 60/40 split — cover + key stats on the left, trade panel on the right
 *
 * Currency is **ORA** throughout. All copy is English.
 */
export default function FractionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  // Smart back: returns to wherever the user navigated in from (typically the
  // Fractions tab in Marketplace), falling back to /marketplace?tab=fractions.
  const goBack = useGoBack('/marketplace?tab=fractions');
  const mockChain = useMockChain();
  const { showToast } = useToast();
  const oraGuard = useOraGuard();
  // 2026-05-19 — real-chain bridge. Active when
  // VITE_FRACTIONALIZE_REAL_CHAIN=true AND the mock NFT record carries a
  // real on-chain `nftMint` (FractionalizedNft.mintAddress). Otherwise
  // mock-only.
  const fractionalizeChain = useFractionalizeContract();
  const [count, setCount] = useState('1');
  const [busy, setBusy] = useState(false);

  const nft = mockChain.fractionalizedNfts.find(n => n.id === id);

  if (!nft) {
    return (
      <div className="pt-[60px] md:pt-2 pb-24 md:pb-4 min-h-screen">
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-aura/20 to-cyan-400/20 flex items-center justify-center mb-4">
            <Compass className="w-7 h-7 text-aura" />
          </div>
          <h1 className="text-lg font-bold mb-2">Fractional NFT not found</h1>
          <p className="text-sm text-muted-foreground max-w-xs mb-6">
            The fractional NFT id <code className="font-mono">{id}</code> isn't listed yet.
          </p>
          <Link
            to="/marketplace?tab=fractions"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-aura text-white text-sm font-bold hover:opacity-90 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Fractions
          </Link>
        </div>
      </div>
    );
  }

  // ── Derived stats ────────────────────────────────────────────────────────
  const available = nft.totalFragments - nft.soldFragments;
  const soldPct = Math.min(100, (nft.soldFragments / nft.totalFragments) * 100);
  const ownedPct = nft.totalFragments > 0
    ? (nft.ownedFragments / nft.totalFragments) * 100
    : 0;
  const myRevenueShare = (nft.ownedFragments / nft.totalFragments) * nft.revenue;
  const cnt = Math.max(1, parseInt(count) || 1);
  const totalCost = cnt * nft.pricePerFragment;
  const marketCap = nft.pricePerFragment * nft.totalFragments;

  // ── Actions ──────────────────────────────────────────────────────────────
  // Resolve the on-chain NFT mint, if the FractionalizedNft record carries
  // one (real-chain enabled fragmental NFTs). Mock-only entries return null.
  const onChainMint: PublicKey | null = (() => {
    const raw = (nft as any).mintAddress as string | undefined;
    if (!raw) return null;
    try { return new PublicKey(raw); } catch { return null; }
  })();
  const chainModeActive = fractionalizeChain.enabled && !!onChainMint && fractionalizeChain.walletReady;

  // Best-effort chain dispatch — logs result and surfaces a toast on
  // failure but never blocks the mock-chain flow.
  const dispatchChain = async (
    label: string,
    fn: () => Promise<{ success: boolean; error?: string; signature?: string }>,
  ) => {
    if (!chainModeActive) return;
    try {
      const r = await fn();
      if (!r.success) {
        console.warn(`[FractionDetailPage] on-chain ${label} failed:`, r.error);
        showToast('info', `On-chain ${label} skipped: ${r.error?.slice(0, 80) ?? 'unknown'}`);
      } else {
        console.log(`[FractionDetailPage] on-chain ${label} tx:`, r.signature);
      }
    } catch (e: any) {
      console.warn(`[FractionDetailPage] on-chain ${label} threw`, e);
    }
  };

  const handleBuy = async () => {
    const n = Math.min(cnt, available);
    if (n <= 0) {
      showToast('error', 'No fragments available');
      return;
    }
    const cost = n * nft.pricePerFragment;
    if (!oraGuard.ensure(cost, 'Fragment purchase')) return;
    setBusy(true);
    try {
      await mockChain.buyFragment(nft.id, n);
      showToast('success', `Bought ${n} fragment${n === 1 ? '' : 's'} for ${cost.toFixed(2)} ORA`);
      // Real-chain dispatch — fire-and-forget.
      if (chainModeActive && onChainMint) {
        dispatchChain('buyFragment', () =>
          fractionalizeChain.buyFragment({ nftMint: onChainMint, amount: BigInt(n) }),
        );
      }
    } catch (e: any) {
      if (/insufficient/i.test(e?.message ?? '')) {
        oraGuard.ensure(cost, 'Fragment purchase');
      } else {
        showToast('error', e?.message || 'Purchase failed');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSell = async () => {
    const n = Math.min(cnt, nft.ownedFragments);
    if (n <= 0) {
      showToast('error', 'You have no fragments to sell');
      return;
    }
    setBusy(true);
    try {
      await mockChain.sellFragment(nft.id, n);
      showToast('success', `Sold ${n} fragment${n === 1 ? '' : 's'}`);
      if (chainModeActive && onChainMint) {
        dispatchChain('sellFragment', () =>
          fractionalizeChain.sellFragment({ nftMint: onChainMint, amount: BigInt(n) }),
        );
      }
    } catch (e: any) {
      showToast('error', e?.message || 'Sale failed');
    } finally {
      setBusy(false);
    }
  };

  const handleClaim = async () => {
    setBusy(true);
    try {
      const claimed = await mockChain.claimFragmentRevenue(nft.id);
      showToast('success', `Claimed ${claimed.toFixed(2)} ORA`, 'Revenue deposited to your wallet');
      if (chainModeActive && onChainMint) {
        dispatchChain('claimRevenue', () =>
          fractionalizeChain.claimRevenue({ nftMint: onChainMint }),
        );
      }
    } catch (e: any) {
      showToast('error', e?.message || 'Claim failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    // Outer shell mirrors ExplorePage / MarketplacePage / NftDetailPage.
    <div className="pt-[60px] md:pt-2 pb-24 md:pb-4 min-h-screen">
      {/* Sticky header */}
      <div className="sticky top-[60px] md:top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/40">
        <div className="flex items-center justify-between p-4 px-4 md:px-6">
          <div className="flex items-center gap-4 min-w-0">
            <Button variant="ghost" size="sm" onClick={goBack} className="shrink-0" aria-label="Back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold truncate">{nft.title}</h1>
              <p className="text-sm text-muted-foreground truncate">Fractional Ownership · by {nft.creator}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {chainModeActive && (
              <Badge
                className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 whitespace-nowrap"
                title="This fractional NFT is on-chain. Trades dispatch real Solana transactions."
              >
                <Link2 className="w-3 h-3 mr-1" /> On-chain
              </Badge>
            )}
            <Badge className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white whitespace-nowrap">
              <Layers className="w-3 h-3 mr-1" /> Fractional
            </Badge>
          </div>
        </div>
      </div>

      {/* Body — left-aligned, full-width */}
      <div className="px-4 md:px-6 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* Left: cover + stats + ownership breakdown (60% = 3/5) */}
          <div className="md:col-span-3 space-y-4">
            {/* Cover */}
            <div className="aspect-video bg-gradient-to-br from-indigo-500/15 via-blue-500/10 to-purple-500/15 rounded-xl overflow-hidden flex flex-col items-center justify-center">
              <div className="text-7xl mb-2">{nft.coverEmoji}</div>
              <div className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">
                Fractional Ownership
              </div>
            </div>

            {/* Key Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Price / Fragment" value={`${nft.pricePerFragment} ORA`} accent="text-indigo-600 dark:text-indigo-400" />
              <Stat label="Total Supply"     value={nft.totalFragments.toLocaleString()} />
              <Stat label="Sold"             value={`${nft.soldFragments.toLocaleString()} (${soldPct.toFixed(0)}%)`} accent="text-emerald-600 dark:text-emerald-400" />
              <Stat label="Available"        value={available.toLocaleString()} />
            </div>

            {/* Sold-progress bar */}
            <div className="bg-card rounded-xl p-4 border">
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="text-sm font-bold">Distribution</h3>
                <span className="text-[11px] text-muted-foreground">
                  Market cap: {marketCap.toLocaleString()} ORA
                </span>
              </div>
              <div className="h-3 rounded-full bg-secondary overflow-hidden flex">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all"
                  style={{ width: `${soldPct}%` }}
                  title={`Sold: ${nft.soldFragments.toLocaleString()} (${soldPct.toFixed(1)}%)`}
                />
                {ownedPct > 0 && (
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all -ml-px"
                    style={{ width: `${ownedPct}%` }}
                    title={`Yours: ${nft.ownedFragments.toLocaleString()} (${ownedPct.toFixed(2)}%)`}
                  />
                )}
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground mt-2">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" /> Sold {soldPct.toFixed(1)}%
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> You own {ownedPct.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Revenue Pool */}
            <div className="bg-card rounded-xl p-4 border">
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="text-sm font-bold inline-flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-amber-500" /> Revenue pool
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  Pro-rata to fragment holders
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">Pool balance</div>
                  <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{nft.revenue.toLocaleString()} ORA</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">Your share</div>
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {myRevenueShare.toFixed(2)} ORA
                  </div>
                </div>
              </div>
              {nft.ownedFragments > 0 && nft.revenue > 0 && (
                <Button
                  variant="outline"
                  className="w-full mt-3 text-amber-600 dark:text-amber-400 border-amber-400/60"
                  onClick={handleClaim}
                  disabled={busy}
                >
                  💰 Claim {myRevenueShare.toFixed(2)} ORA
                </Button>
              )}
            </div>

            {/* About */}
            <div className="bg-card rounded-xl p-4 border">
              <h3 className="text-sm font-bold mb-2">How fractional ownership works</h3>
              <ul className="text-sm text-muted-foreground space-y-1.5 leading-relaxed">
                <li>• Each fragment is a transferable on-chain share of <strong>{nft.title}</strong>.</li>
                <li>• When the underlying NFT earns revenue (royalties, lease, exhibition fees), it flows into the shared pool.</li>
                <li>• Holders can claim their pro-rata share at any time, or sell their fragments back into the open market.</li>
                <li>• Sale of the underlying NFT is gated by a fragment-holder vote.</li>
              </ul>
            </div>
          </div>

          {/* Right: Trade panel (40% = 2/5) */}
          <div className="md:col-span-2 space-y-4">
            <div className="md:sticky md:top-24 space-y-4">
              {/* Trade box */}
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 rounded-xl p-5 border border-indigo-200/50 dark:border-indigo-800/50">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Trade fragments</h2>
                  <Activity className="w-4 h-4 text-indigo-500" />
                </div>

                {/* Quantity stepper */}
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Quantity
                </label>
                <div className="flex items-center gap-2 mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCount(String(Math.max(1, cnt - 1)))}
                    aria-label="Decrement"
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                    className="text-center"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCount(String(cnt + 1))}
                    aria-label="Increment"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>

                {/* Cost summary */}
                <div className="bg-background/60 rounded-lg p-3 space-y-2 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unit price</span>
                    <span className="font-medium">{nft.pricePerFragment} ORA</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quantity</span>
                    <span className="font-medium">{cnt}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="text-muted-foreground">Total</span>
                    <span className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                      {totalCost.toFixed(2)} ORA
                    </span>
                  </div>
                </div>

                {/* Wallet balance */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Balance: {mockChain.oraBalance.toFixed(2)} ORA</span>
                </div>

                {/* Buy / Sell */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={handleBuy}
                    disabled={busy || available <= 0}
                    className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white"
                  >
                    {available <= 0 ? 'Sold out' : `Buy ${cnt}`}
                  </Button>
                  <Button
                    onClick={handleSell}
                    disabled={busy || nft.ownedFragments <= 0}
                    variant="outline"
                  >
                    Sell {Math.min(cnt, nft.ownedFragments) || 0}
                  </Button>
                </div>
              </div>

              {/* Holdings card */}
              <div className="bg-card rounded-xl p-5 border">
                <h3 className="text-sm font-bold mb-3 inline-flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-500" /> Your position
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fragments owned</span>
                    <span className="font-bold">
                      {nft.ownedFragments.toLocaleString()}
                      <span className="text-[11px] font-normal text-muted-foreground">
                        {' '}/ {nft.totalFragments.toLocaleString()}
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ownership share</span>
                    <span className="font-bold">{ownedPct.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cost basis (current)</span>
                    <span className="font-bold">
                      {(nft.ownedFragments * nft.pricePerFragment).toFixed(2)} ORA
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Claimable revenue</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {myRevenueShare.toFixed(2)} ORA
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label, value, accent,
}: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-card rounded-xl p-3 border">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">{label}</div>
      <div className={`text-base font-bold leading-tight ${accent || ''}`}>{value}</div>
    </div>
  );
}
