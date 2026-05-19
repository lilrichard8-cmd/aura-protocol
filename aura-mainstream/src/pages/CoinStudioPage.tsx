// Creator Coin (formerly “Coin Studio”) — the creator's control center
// for their own Creator Coin: holders, vesting, redemptions, benefits.
// Renamed 2026-05-10 — “Coin Studio” was technically opaque to non-Web3
// creators; “Creator Coin” matches the protocol primitive name.
//
// 2026-05-09 R2 — full re-skin into a "dashboard" layout:
//
//   ┌── HERO STRIP ────────────────────────────────────────────────┐
//   │ [Coin Logo 96px gradient]  $JUDGE                             │
//   │                            Colosseum Judge Coin · 23 holders  │
//   │                            [View public] [Share] [Promote]   │
//   └───────────────────────────────────────────────────────────────┘
//   ┌── 4 KPI tiles (Price, Holders, Circulating, Earned ORA) ─────┐
//   ┌── LEFT col-span-2 ────────────────────────┐ ┌── RIGHT col ──┐
//   │ ⚡ Action Center (pending fulfill, vest)   │ │ Top Holders   │
//   │ 📊 Circulation breakdown (4 pillars)       │ │               │
//   │ 🎁 Benefits cards                          │ │ Recent Trades │
//   │ 📦 Redemptions queue (RedemptionsContent)  │ │               │
//   └────────────────────────────────────────────┘ └───────────────┘

import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMockChain } from '@/context/MockChainContext';
import { useAuth } from '@/context/AuthContext';
import { useCreatorCoinContract, type CreatorCoinOnChain } from '@/hooks/useCreatorCoinContract';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';
import {
  Coins, TrendingUp, Users, Sparkles, ExternalLink,
  Share2, Megaphone, Bell, Lock, Activity, Package,
  ArrowUpRight, ArrowDownRight, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import RedemptionsContent from '@/components/profile/RedemptionsContent';
import { useToast } from '@/context/ToastContext';
import MintCeremony from '@/components/coin/MintCeremony';
import BatchUnlockCeremony from '@/components/coin/BatchUnlockCeremony';
import BatchPricingPlan from '@/components/coin/BatchPricingPlan';
import UserAvatar from '@/components/UserAvatar';

const TOTAL_SUPPLY = 10_000;

function formatTimeAgo(ts?: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function CoinStudioPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const mockChain = useMockChain();
  const { showToast } = useToast();
  const { user } = useAuth();
  // Real-chain read bridge — VITE_CREATOR_COIN_REAL_CHAIN=true populates live
  // supply/price/locked numbers from the on-chain CreatorCoin account. We
  // keep mockChain as the canonical UI source (which already mirrors the
  // mint result via MintCeremony) and only overlay the on-chain values when
  // the read succeeds; otherwise we silently fall back to mock.
  const onChain = useCreatorCoinContract();
  const uw = useUnifiedWallet();
  const [chainCoin, setChainCoin] = useState<CreatorCoinOnChain | null>(null);
  // Mint modal state — hoisted above the conditional return so hooks order
  // stays stable whether or not the user has already minted.
  const [showMintModal, setShowMintModal] = useState(false);
  // Vesting batch unlock state — these tools used to live on the public
  // CoinDetailPage; we moved them here so fans never see them.
  const [showBatchUnlock, setShowBatchUnlock] = useState(false);
  const [showBatchPlan, setShowBatchPlan] = useState(false);

  // Defaults derived from the auth profile, mirroring ProfilePage so the
  // ceremony pre-fills consistent values across both entry points.
  const defaultMintSymbol = ((user?.username || 'MYCOIN')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 6)) || 'MYCOIN';
  const defaultMintName = `${user?.displayName || user?.username || 'My'} Coin`;

  const handleMintComplete = (mintedSymbol: string) => {
    setShowMintModal(false);
    showToast('success', `🎉 Minted ${mintedSymbol} — your Creator Coin dashboard is unlocked.`);
    // Stay on the Creator Coin page so the creator can immediately see their dashboard.
  };

  // ── No minted coin yet → inline CTA to mint right here (no detour to Profile).
  if (!mockChain.hasCreatorCoin || !mockChain.creatorCoinSymbol) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center px-6 py-12">
          <div className="max-w-md text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-aura/10 text-aura mx-auto">
              <Sparkles className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-bold">Mint your Creator Coin</h1>
            <p className="text-sm text-muted-foreground">
              This is your Creator Coin control room — manage holders, vesting, redemptions and benefits all in one place.
              Mint your coin to unlock it.
            </p>
            <Button
              onClick={() => setShowMintModal(true)}
              className="bg-gradient-to-r from-aura to-purple-500 text-white"
            >
              <Sparkles className="w-4 h-4 mr-1" />
              Mint now
            </Button>
          </div>
        </div>
        <MintCeremony
          open={showMintModal}
          defaultSymbol={defaultMintSymbol}
          defaultName={defaultMintName}
          onClose={() => setShowMintModal(false)}
          onMinted={handleMintComplete}
        />
      </>
    );
  }

  // ── Data
  const symbol = mockChain.creatorCoinSymbol;
  const ticker = symbol;
  const myCoin = mockChain.creatorCoins.find(c => c.symbol === symbol);
  // Live chain refresh — fires when the wallet/module first becomes available
  // and again whenever the mock state changes (so we re-fetch after every
  // ceremony). Polling is intentionally sparse: this dashboard isn't a hot
  // trading view, and the wallet won't routinely change.
  useEffect(() => {
    if (!onChain.enabled || !onChain.module || !uw.publicKey) {
      setChainCoin(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const live = await onChain.fetchCoin(uw.publicKey!);
        if (!cancelled) setChainCoin(live);
      } catch {
        if (!cancelled) setChainCoin(null);
      }
    })();
    return () => { cancelled = true; };
  }, [onChain.enabled, onChain.module, uw.publicKey, mockChain.creatorCoinVestingMonth, mockChain.creatorCoinBalance]);
  // Live-chain values overlay mock display when available. The chain stores
  // amounts in 9-decimal base units; we scale back for the UI which expects
  // human-readable token counts (matching the mock's 0–2000 range).
  const chainCirculating = chainCoin ? Number(chainCoin.circulatingSupply) / 1e9 : null;
  const chainLocked = chainCoin ? Number(chainCoin.lockedSupply) / 1e9 : null;
  const chainInitialPrice = chainCoin ? Number(chainCoin.initialPrice) / 1e9 : null;
  const chainMonthsUnlocked = chainCoin ? chainCoin.monthsUnlocked : null;
  const balance = mockChain.creatorCoinBalance ?? 0;
  const reserved = myCoin?.reservedAmount ?? 0;
  const locked = chainLocked ?? (mockChain.creatorCoinLocked ?? 0);
  const vestingMonth = chainMonthsUnlocked ?? (mockChain.creatorCoinVestingMonth ?? 0);
  const initialPrice = chainInitialPrice ?? (myCoin?.initialPrice ?? 1);
  const benefits = myCoin?.benefits ?? [];
  const holders = mockChain.ownCoinHolders;
  const trades = mockChain.ownCoinTrades;
  const totalHolders = mockChain.ownCoinHolders.length;

  const holdersTotal = holders.reduce((s, h) => s + h.amount, 0);
  // Prefer on-chain circulating supply when available; mock fallback otherwise.
  const totalCirculating = chainCirculating ?? (balance + reserved + holdersTotal);
  const earnedFromTrades = trades.reduce((s, t) => s + t.total * 0.95, 0);

  // Pending redemption fulfillments — biggest action item.
  const pendingFulfill = mockChain.redemptions.filter(
    r => r.symbol === symbol && r.perspective === 'me_as_creator' && r.status === 'pending',
  );
  const confirmedRedemptions = mockChain.redemptions.filter(
    r => r.symbol === symbol && r.status === 'confirmed',
  );

  // New trades within last 7 days.
  const weekAgo = Date.now() - 7 * 86400_000;
  const recentTradeCount = trades.filter(t => t.timestamp >= weekAgo).length;

  // Vesting progress
  const vestingProgress = Math.max(0, Math.min(1, vestingMonth / 10));
  const monthsRemaining = 10 - vestingMonth;

  // ── Pixel rectangles for circulation bar (avoid 0-width invisible slices)
  const pct = (n: number) => (n / TOTAL_SUPPLY) * 100;

  // ── Render
  return (
    <>
    {/* Full-bleed: no max-w cap, lets the studio breathe on wide screens. */}
    <div className="px-4 md:px-6 lg:px-8 py-6 pb-24 md:pb-12 space-y-6">

      {/* ── HERO STRIP ── */}
      <div className="relative overflow-hidden rounded-2xl border border-aura/20 bg-gradient-to-br from-aura/10 via-purple-500/5 to-transparent p-5 md:p-7">
        {/* Decorative gradient blob */}
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-gradient-to-br from-aura/20 to-purple-500/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center gap-5">
          {/* Coin logo */}
          {myCoin?.logoUrl ? (
            <img
              src={myCoin.logoUrl}
              alt={ticker}
              className="w-24 h-24 rounded-3xl object-cover ring-4 ring-white/30 shadow-xl shrink-0"
            />
          ) : (
            <div className="w-24 h-24 rounded-3xl flex items-center justify-center text-white text-3xl font-black shadow-xl ring-4 ring-white/30 shrink-0 bg-gradient-to-br from-aura via-purple-500 to-[#F59E0B]">
              {ticker.replace('$', '').slice(0, 2).toUpperCase()}
            </div>
          )}

          {/* Identity + actions */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Coins className="w-4 h-4 text-aura" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Creator Coin</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black flex items-center gap-3">
              <span className="font-mono">{ticker}</span>
              {myCoin?.name && (
                <span className="text-base md:text-lg font-medium text-muted-foreground truncate">
                  · {myCoin.name}
                </span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Your control room — manage holders, vesting, redemptions, and benefits in one place.
            </p>

            {/* Action chip row */}
            <div className="flex items-center gap-2 flex-wrap mt-4">
              <Button
                size="sm"
                onClick={() => navigate(`/marketplace/coin/${symbol.replace(/^\$/, '').toLowerCase()}`, { state: { from: location.pathname } })}
                className="bg-aura hover:bg-aura-dark text-white"
              >
                <ExternalLink className="w-4 h-4 mr-1.5" />
                View public page
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const url = `${window.location.origin}/marketplace/coin/${symbol.replace(/^\$/, '').toLowerCase()}`;
                  navigator.clipboard.writeText(url);
                  showToast('success', 'Link copied', 'Public coin page URL copied to clipboard');
                }}
              >
                <Share2 className="w-4 h-4 mr-1.5" />
                Share
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => showToast('info', 'Coming soon', 'Promote campaign workflow is in design')}
              >
                <Megaphone className="w-4 h-4 mr-1.5" />
                Promote
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4 KPI TILES ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile
          icon={<TrendingUp className="w-4 h-4" />}
          label="Initial price"
          value={initialPrice.toFixed(2)}
          unit="ORA"
          tone="emerald"
        />
        <KpiTile
          icon={<Users className="w-4 h-4" />}
          label="Holders"
          value={totalHolders.toLocaleString()}
          unit={recentTradeCount > 0 ? `+${recentTradeCount} this week` : 'no new this week'}
          tone="purple"
        />
        <KpiTile
          icon={<Activity className="w-4 h-4" />}
          label="Circulating"
          value={totalCirculating.toLocaleString()}
          unit={`${((totalCirculating / TOTAL_SUPPLY) * 100).toFixed(1)}% of supply`}
          tone="amber"
        />
        <KpiTile
          icon={<Coins className="w-4 h-4" />}
          label="Earned"
          value={earnedFromTrades.toFixed(2)}
          unit="ORA from sales"
          tone="aura"
        />
      </div>

      {/* ── 2-COLUMN BODY ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* LEFT COLUMN (col-span-2 on lg+) */}
        <div className="lg:col-span-2 space-y-5">

          {/* ── Action Center ── */}
          <section className="rounded-xl border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b bg-secondary/30 flex items-center justify-between">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Bell className="w-4 h-4 text-aura" />
                Action center
              </h2>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                {pendingFulfill.length + (locked > 0 ? 1 : 0)} item{pendingFulfill.length + (locked > 0 ? 1 : 0) !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="divide-y">
              {/* Pending fulfillments */}
              {pendingFulfill.length > 0 ? (
                <ActionRow
                  tone="rose"
                  icon={<Package className="w-4 h-4" />}
                  title={`${pendingFulfill.length} redemption${pendingFulfill.length > 1 ? 's' : ''} awaiting fulfillment`}
                  subtitle={`Holders are waiting for: ${pendingFulfill.slice(0, 2).map(r => r.benefitTitle).join(', ')}${pendingFulfill.length > 2 ? '…' : ''}`}
                  actionLabel="Fulfill"
                  onAction={() => {
                    document.querySelector('[data-section="redemptions"]')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                />
              ) : (
                <ActionRow
                  tone="emerald"
                  icon={<Package className="w-4 h-4" />}
                  title="All redemptions caught up"
                  subtitle="No pending perks to fulfill — nice work."
                />
              )}

              {/* Vesting + batch unlock controls.
               *  These were previously on the public Coin Detail page,
               *  but only the creator should see/operate them. Moved
               *  here 2026-05-10 per Zhuoyu. */}
              {locked > 0 && (
                <div className="space-y-2">
                  <ActionRow
                    tone="indigo"
                    icon={<Lock className="w-4 h-4" />}
                    title={`${locked.toLocaleString()} ${ticker} locked in vesting`}
                    subtitle={`Month ${vestingMonth} of 10 · ${monthsRemaining} month${monthsRemaining !== 1 ? 's' : ''} until full unlock`}
                    progress={vestingProgress}
                  />
                  <div className="flex items-center gap-2 flex-wrap pl-12">
                    <button
                      onClick={() => setShowBatchPlan(true)}
                      className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground/80 text-xs font-semibold transition-colors"
                    >
                      📜 Released batches
                    </button>
                    {vestingMonth < 10 && (
                      <button
                        onClick={() => setShowBatchUnlock(true)}
                        className="px-3 py-1.5 rounded-lg bg-aura/10 hover:bg-aura/20 text-aura text-xs font-semibold transition-colors"
                      >
                        ⏭ Release next batch
                      </button>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      Creator-only · fans can't see this
                    </span>
                  </div>
                </div>
              )}

              {/* Holder growth ping */}
              {recentTradeCount > 0 && (
                <ActionRow
                  tone="amber"
                  icon={<TrendingUp className="w-4 h-4" />}
                  title={`${recentTradeCount} new trade${recentTradeCount > 1 ? 's' : ''} this week`}
                  subtitle="Momentum is building — consider a Promote campaign."
                />
              )}
            </div>
          </section>

          {/* ── Circulation breakdown ── */}
          <section className="rounded-xl border bg-card p-5">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Activity className="w-4 h-4 text-aura" />
                Circulation breakdown
              </h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                Total supply: {TOTAL_SUPPLY.toLocaleString()}
              </span>
            </div>
            {/* Stacked bar */}
            <div className="flex h-3 rounded-full overflow-hidden bg-secondary mb-3">
              <div className="bg-aura" style={{ width: `${pct(balance)}%` }} title={`In your wallet: ${balance}`} />
              <div className="bg-orange-500" style={{ width: `${pct(reserved)}%` }} title={`Escrowed: ${reserved}`} />
              <div className="bg-purple-500" style={{ width: `${pct(holdersTotal)}%` }} title={`Held by others: ${holdersTotal}`} />
              <div className="bg-blue-500/40" style={{ width: `${pct(locked)}%` }} title={`Vesting: ${locked}`} />
            </div>
            {/* 4-pillar grid (each is its own tile) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Pillar dot="bg-aura" label="In wallet" value={balance} ticker={ticker} />
              <Pillar dot="bg-orange-500" label="Escrowed" value={reserved} ticker={ticker} sub="sell orders" />
              <Pillar dot="bg-purple-500" label="Held by fans" value={holdersTotal} ticker={ticker} sub={`${holders.length} wallets`} />
              <Pillar dot="bg-blue-500/40" label="Vesting" value={locked} ticker={ticker} sub={`mo ${vestingMonth}/10`} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">
              {confirmedRedemptions.length > 0 ? (
                <>{confirmedRedemptions.length} perk{confirmedRedemptions.length !== 1 ? 's' : ''} delivered &amp; confirmed</>
              ) : (
                <>No redemptions confirmed yet</>
              )}
            </p>
          </section>

          {/* ── Benefits ── */}
          <section className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-aura" />
                Benefits ({benefits.length})
              </h2>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Edit at mint time</span>
            </div>
            {benefits.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No benefits configured yet.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2.5">
                {benefits.map(b => (
                  <div
                    key={b.id}
                    className={`relative rounded-xl border p-3.5 ${
                      b.type === 'hold'
                        ? 'border-purple-500/30 bg-purple-500/5'
                        : 'border-orange-500/30 bg-orange-500/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-sm font-bold leading-tight">{b.title}</span>
                      <span className={`shrink-0 text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full ${
                        b.type === 'hold'
                          ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300'
                          : 'bg-orange-500/15 text-orange-700 dark:text-orange-300'
                      }`}>
                        {b.type === 'hold' ? `≥ ${b.threshold} hold` : `Pay ${b.threshold}`}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{b.description}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Redemptions queue (anchor for action-center scroll) ── */}
          <section data-section="redemptions" className="rounded-xl border bg-card overflow-hidden scroll-mt-24">
            <div className="px-5 py-3 border-b bg-secondary/30">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Package className="w-4 h-4 text-aura" />
                Redemptions
              </h2>
            </div>
            <div className="p-5 md:p-6">
              <RedemptionsContent />
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN — sticky on lg+ */}
        <div className="space-y-5 lg:sticky lg:top-4 lg:self-start">

          {/* ── Top Holders ── */}
          <section className="rounded-xl border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b bg-secondary/30">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Users className="w-4 h-4 text-aura" />
                Top holders ({1 + holders.length})
              </h2>
            </div>
            <div className="divide-y">
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-aura/5 text-sm">
                <span className="text-[10px] font-black text-aura tabular-nums w-5">#1</span>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-aura to-purple-500 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                  YOU
                </div>
                <span className="flex-1 font-bold truncate">You (Creator)</span>
                <span className="font-mono text-xs tabular-nums text-aura font-bold">
                  {(balance + reserved).toLocaleString()}
                </span>
              </div>
              {holders.slice(0, 8).map((h, i) => (
                <div
                  key={h.id}
                  className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-secondary/40 text-sm transition-colors"
                >
                  <span className="text-[10px] font-bold text-muted-foreground tabular-nums w-5">#{i + 2}</span>
                  <UserAvatar src={h.avatar} displayName={h.name} username={h.username} className="w-7 h-7 rounded-full shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs truncate">{h.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">@{h.username}</div>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-foreground/80">
                    {h.amount.toLocaleString()}
                  </span>
                </div>
              ))}
              {holders.length > 8 && (
                <div className="px-4 py-2.5 text-center text-[10px] text-muted-foreground">
                  +{holders.length - 8} more holders
                </div>
              )}
            </div>
          </section>

          {/* ── Recent Trades ── */}
          {trades.length > 0 ? (
            <section className="rounded-xl border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b bg-secondary/30">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-aura" />
                  Recent trades
                </h2>
              </div>
              <div className="divide-y">
                {trades.slice(0, 8).map(t => (
                  <div key={t.id} className="px-4 py-2.5 hover:bg-secondary/40 transition-colors">
                    <div className="flex items-center gap-2.5 mb-1">
                      <UserAvatar src={t.userAvatar} displayName={t.userName} username={t.userUsername} className="w-6 h-6 rounded-full shrink-0" />
                      <div className="flex-1 min-w-0 text-xs font-bold truncate">{t.userName}</div>
                      {t.type && (
                        <div className={`text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 shrink-0 ${
                          t.type === 'buy'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                        }`}>
                          {t.type === 'buy' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {t.type}
                        </div>
                      )}
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimeAgo(t.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between text-[11px] pl-8">
                      <span className="text-muted-foreground tabular-nums">
                        {t.amount.toLocaleString()} {ticker}
                        {typeof t.price === 'number' && (
                          <> @ {t.price.toFixed(2)}</>
                        )}
                      </span>
                      <span className="font-bold tabular-nums">
                        {(t.total ?? 0).toFixed(2)} ORA
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="rounded-xl border-2 border-dashed bg-card/50 p-6 text-center">
              <TrendingUp className="w-6 h-6 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No trades yet</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                Promote your coin to attract first buyers
              </p>
            </section>
          )}
        </div>
      </div>
    </div>

    {/* Batch unlock + pricing-plan modals (creator-only). */}
    {symbol && (() => {
      const ownCoin = mockChain.creatorCoins.find(c => c.symbol === symbol);
      const monthIdx = mockChain.creatorCoinVestingMonth ?? 0;
      const plannedPrice = ownCoin?.batchPrices?.[monthIdx];
      return (
        <>
          <BatchUnlockCeremony
            open={showBatchUnlock}
            symbol={symbol}
            logoUrl={ownCoin?.logoUrl}
            currentPrice={plannedPrice ?? initialPrice}
            onClose={() => setShowBatchUnlock(false)}
            onUnlocked={(batch, price) => {
              showToast('success', `🌸 Vesting Batch ${batch} unlocked: 800 ${symbol} @ ${price.toFixed(4)} ORA each`);
            }}
          />
          <BatchPricingPlan
            open={showBatchPlan}
            symbol={symbol}
            currentPrice={initialPrice}
            onClose={() => setShowBatchPlan(false)}
          />
        </>
      );
    })()}
    </>
  );
}

// ── KPI tile ───────────────────────────────────────────────────────────────
function KpiTile({
  icon, label, value, unit, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  tone: 'emerald' | 'purple' | 'amber' | 'aura';
}) {
  const toneClasses = {
    emerald: 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent',
    purple: 'border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-transparent',
    amber: 'border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent',
    aura: 'border-aura/30 bg-gradient-to-br from-aura/5 to-transparent',
  }[tone];
  const valueColor = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    purple: 'text-purple-600 dark:text-purple-400',
    amber: 'text-amber-600 dark:text-amber-400',
    aura: 'text-aura',
  }[tone];
  return (
    <div className={`rounded-xl border p-4 ${toneClasses}`}>
      <div className="flex items-center gap-1.5 mb-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-bold">{label}</span>
      </div>
      <p className={`text-2xl md:text-3xl font-black tabular-nums leading-none ${valueColor}`}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground mt-1.5">{unit}</p>
    </div>
  );
}

// ── Action row ─────────────────────────────────────────────────────────────
function ActionRow({
  tone, icon, title, subtitle, actionLabel, onAction, progress,
}: {
  tone: 'rose' | 'indigo' | 'emerald' | 'amber';
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
  progress?: number;
}) {
  const accent = {
    rose: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
    indigo: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
    emerald: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  }[tone];
  const progressBar = {
    rose: 'bg-rose-500',
    indigo: 'bg-indigo-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
  }[tone];

  return (
    <div className="px-5 py-3.5 flex items-start gap-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        {typeof progress === 'number' && (
          <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${progressBar}`}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}
      </div>
      {actionLabel && onAction && (
        <Button
          size="sm"
          variant="outline"
          onClick={onAction}
          className="shrink-0"
        >
          {actionLabel}
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      )}
    </div>
  );
}

// ── Pillar tile ────────────────────────────────────────────────────────────
function Pillar({
  dot, label, value, ticker, sub,
}: {
  dot: string;
  label: string;
  value: number;
  ticker: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg bg-secondary/30 px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">{label}</span>
      </div>
      <p className="text-base font-black tabular-nums leading-none">
        {value.toLocaleString()}
        <span className="text-[10px] font-normal text-muted-foreground ml-1">{ticker}</span>
      </p>
      {sub && (
        <p className="text-[10px] text-muted-foreground/80 mt-0.5">{sub}</p>
      )}
    </div>
  );
}
