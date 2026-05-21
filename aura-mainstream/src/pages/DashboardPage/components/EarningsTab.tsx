// Dashboard Earnings tab — vault details, revenue breakdown, recent txns.
// Extracted from DashboardPage.tsx 2026-05-20 P-1 split.
import { useState, useMemo } from 'react';
import {
  Activity, Award, CheckCircle, Coins, Gift,
  Layers, Lock, Repeat, ShoppingBag, Users, Vault, Wallet,
} from 'lucide-react';
import { useMockChain } from '@/context/MockChainContext';
import { CoinTradeRow, HolderRow, RedemptionRow, StakeRow, TxRow, formatRelative } from './dashboardRows';

export function EarningsTab() {
  const mockChain = useMockChain();
  const {
    vaultBalance, vestedAmount, claimedAmount, claimVested, transactions,
    ownCoinTrades, ownCoinHolders, redemptions, stakes, fractionalizedNfts,
    remixes, remixRevenue, licenses, creatorCoinSymbol,
  } = mockChain;
  const [claiming, setClaiming] = useState(false);

  // Revenue sources from REAL on-chain primitives where available:
  //  • CC trades        → ownCoinTrades buys (where someone bought my CC, in ORA)
  //  • Curation rewards → curationStats.totalRewards
  //  • Remix royalties  → remixRevenue
  //  • Other            → vaultBalance remainder (tips/premium not yet tagged)
  const ccTradeRevenue = useMemo(
    () => ownCoinTrades.reduce((s, t) => s + (t.type === 'buy' ? t.total : 0), 0),
    [ownCoinTrades],
  );
  const curationRevenue = mockChain.curationStats.totalRewards;
  const accountedRevenue = ccTradeRevenue + curationRevenue + remixRevenue;
  const otherRevenue = Math.max(0, vaultBalance - accountedRevenue);
  const sources = [
    { label: 'Creator Coin trades', amount: parseFloat(ccTradeRevenue.toFixed(2)), color: 'bg-aura', textColor: 'text-aura' },
    { label: 'Curation rewards', amount: parseFloat(curationRevenue.toFixed(2)), color: 'bg-purple-500', textColor: 'text-purple-500' },
    { label: 'Remix royalties', amount: parseFloat(remixRevenue.toFixed(2)), color: 'bg-emerald-500', textColor: 'text-emerald-500' },
    { label: 'Other / Tips', amount: parseFloat(otherRevenue.toFixed(2)), color: 'bg-rose-500', textColor: 'text-rose-500' },
  ];
  const totalRevenue = sources.reduce((s, x) => s + x.amount, 0) || 1;

  // Recent transactions (last 8)
  const recentTx = [...transactions].slice(0, 8);

  // Active stakes summary
  const totalStakedActive = stakes.reduce((s, x) => s + x.amount, 0);

  // CC redemptions from buyers — only the ones where I'm the creator/issuer.
  const issuerRedemptions = redemptions.filter(r => r.perspective === 'me_as_creator');

  // Top holders sorted by amount desc.
  const topHolders = [...ownCoinHolders].sort((a, b) => b.amount - a.amount).slice(0, 8);

  // My fragmented NFTs (ones I created).
  const myFnfts = fractionalizedNfts.filter(
    f => f.creator === 'You' || f.creator === 'Søren' || f.creator === mockChain.walletAddress,
  );

  const handleClaim = async () => {
    if (vestedAmount <= 0) return;
    setClaiming(true);
    try {
      await claimVested();
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Vault hero */}
      <section className="rounded-2xl border border-aura/30 bg-gradient-to-br from-aura/10 via-purple-500/5 to-amber-500/5 p-5 md:p-7 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-gradient-to-br from-aura/20 to-purple-500/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start gap-4 flex-wrap">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-aura to-purple-500 flex items-center justify-center shrink-0 shadow-lg">
            <Vault className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-0.5">Creator vault</p>
            <h2 className="text-3xl md:text-4xl font-black tabular-nums leading-none">
              {vaultBalance.toFixed(2)} <span className="text-base font-normal text-muted-foreground">ORA</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              All-time earned · 30% of rewards auto-deposited &amp; vesting linearly
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <div className="bg-background/60 rounded-lg px-3 py-1.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Claimable</span>
                <span className="ml-2 font-bold tabular-nums text-emerald-500">{vestedAmount.toFixed(2)} ORA</span>
              </div>
              <div className="bg-background/60 rounded-lg px-3 py-1.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Claimed</span>
                <span className="ml-2 font-bold tabular-nums">{claimedAmount.toFixed(2)} ORA</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleClaim}
            disabled={claiming || vestedAmount <= 0}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-aura to-purple-500 text-white text-sm font-bold disabled:opacity-50 hover:opacity-95 transition-opacity shrink-0"
          >
            <CheckCircle className="w-4 h-4" />
            {claiming ? 'Claiming...' : vestedAmount > 0 ? `Claim ${vestedAmount.toFixed(2)}` : 'Nothing to claim'}
          </button>
        </div>
      </section>

      {/* 2-col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Revenue breakdown */}
        <section className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b bg-secondary/30">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Coins className="w-4 h-4 text-aura" />
              Revenue breakdown
            </h2>
          </div>
          <div className="p-5 space-y-3">
            {/* Stacked bar */}
            <div className="flex h-3 rounded-full overflow-hidden bg-secondary mb-2">
              {sources.map(s => (
                <div
                  key={s.label}
                  className={s.color}
                  style={{ width: `${(s.amount / totalRevenue) * 100}%` }}
                  title={`${s.label}: ${s.amount} ORA`}
                />
              ))}
            </div>
            {/* List */}
            <div className="space-y-2">
              {sources.map(s => {
                const pct = (s.amount / totalRevenue) * 100;
                return (
                  <div key={s.label} className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                      <span>{s.label}</span>
                    </span>
                    <span className="text-right">
                      <span className={`font-bold tabular-nums ${s.textColor}`}>{s.amount.toFixed(2)}</span>
                      <span className="text-[10px] text-muted-foreground ml-1.5">{pct.toFixed(0)}%</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Recent transactions */}
        <section className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b bg-secondary/30">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-aura" />
              Recent transactions
            </h2>
          </div>
          {recentTx.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-xs text-muted-foreground">No transactions yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {recentTx.map(tx => (
                <TxRow key={tx.id} tx={tx} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Creator Coin trades + holders — live secondary market */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b bg-secondary/30 flex items-center justify-between">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Repeat className="w-4 h-4 text-aura" />
              Coin trades {creatorCoinSymbol ? `· $${creatorCoinSymbol}` : ''}
            </h2>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
              {ownCoinTrades.length} on-chain
            </span>
          </div>
          {ownCoinTrades.length === 0 ? (
            <div className="p-8 text-center">
              <ShoppingBag className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No trades yet</p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">Mint a Creator Coin to open your market.</p>
            </div>
          ) : (
            <div className="divide-y max-h-80 overflow-y-auto">
              {ownCoinTrades.slice(0, 12).map(t => (
                <CoinTradeRow key={t.id} t={t} />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b bg-secondary/30 flex items-center justify-between">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-aura" />
              Top holders
            </h2>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
              {ownCoinHolders.length} total
            </span>
          </div>
          {topHolders.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No holders yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {topHolders.map((h, i) => (
                <HolderRow key={h.id} h={h} rank={i + 1} symbol={creatorCoinSymbol} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* CC redemptions + stakes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b bg-secondary/30 flex items-center justify-between">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Gift className="w-4 h-4 text-aura" />
              Coin redemptions
            </h2>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
              {issuerRedemptions.length}
            </span>
          </div>
          {issuerRedemptions.length === 0 ? (
            <div className="p-8 text-center">
              <Gift className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No redemptions yet</p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">Holders will redeem your benefits with their CC.</p>
            </div>
          ) : (
            <div className="divide-y">
              {issuerRedemptions.slice(0, 8).map(r => (
                <RedemptionRow key={r.id} r={r} />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b bg-secondary/30 flex items-center justify-between">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Lock className="w-4 h-4 text-aura" />
              Active stakes
            </h2>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
              {totalStakedActive.toFixed(2)} ORA locked
            </span>
          </div>
          {stakes.length === 0 ? (
            <div className="p-8 text-center">
              <Lock className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No active stakes</p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">Stake ORA in Wallet to boost curation power.</p>
            </div>
          ) : (
            <div className="divide-y">
              {stakes.map(s => (
                <StakeRow key={s.id} s={s} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Remixes + fractional NFTs (only render when there's something) */}
      {(remixes.length > 0 || myFnfts.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {remixes.length > 0 && (
            <section className="rounded-xl border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b bg-secondary/30 flex items-center justify-between">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Layers className="w-4 h-4 text-aura" />
                  Remixes of my work
                </h2>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                  {remixes.length} · {remixRevenue.toFixed(2)} ORA
                </span>
              </div>
              <div className="divide-y">
                {remixes.slice(0, 6).map(r => (
                  <div key={r.id} className="px-4 py-2.5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                      <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{r.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Royalty {(r.revenueSplit * 100).toFixed(0)}% · {formatRelative(r.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {myFnfts.length > 0 && (
            <section className="rounded-xl border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b bg-secondary/30">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Award className="w-4 h-4 text-aura" />
                  Fractionalized NFTs
                </h2>
              </div>
              <div className="divide-y">
                {myFnfts.map(f => {
                  const soldPct = (f.soldFragments / f.totalFragments) * 100;
                  return (
                    <div key={f.id} className="px-4 py-3">
                      <div className="flex items-center gap-3 mb-1.5">
                        <div className="w-9 h-9 rounded-lg bg-secondary/50 flex items-center justify-center text-lg shrink-0">
                          {f.coverEmoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{f.title}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {f.soldFragments.toLocaleString()} / {f.totalFragments.toLocaleString()} fragments · {f.pricePerFragment} ORA each
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold tabular-nums text-aura">{f.revenue.toLocaleString()}</div>
                          <div className="text-[9px] uppercase text-muted-foreground font-bold tracking-wider">ORA</div>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full bg-aura" style={{ width: `${soldPct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Tab 5: Governance — my proposals, votes, election applications
// =====================================================================
export default EarningsTab;
