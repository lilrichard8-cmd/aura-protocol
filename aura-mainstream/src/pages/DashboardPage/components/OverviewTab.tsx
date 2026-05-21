// Dashboard Overview tab — top KPIs, vault snapshot, activity, quick actions.
// Extracted from DashboardPage.tsx 2026-05-20 P-1 split.
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useOraContract } from '@/hooks/useOraContract';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';
import { useChainTxHistory } from '@/hooks/useChainTxHistory';
import {
  Coins, Vault, CheckCircle,
  FileText, Trophy, Wallet,
  Heart, Sparkles, Flame,
  Award, Target, Activity, Vote, Zap,
  UserPlus, Lock, Users,
} from 'lucide-react';
import { useMockChain } from '@/context/MockChainContext';
import UserAvatar from '@/components/UserAvatar';
import { KpiTile, PostRow, QuickAction, SnapshotRow, TxRow, formatRelative } from './dashboardRows';

export function OverviewTab({
  postMetrics, myBountiesCount,
}: {
  postMetrics: Array<{ post: any; views: number | null; likes: number; comments: number; curations: number | null; earned: number | null; isPinned: boolean; isBoosted: boolean }>;
  myBountiesCount: number;
}) {
  // Removed t/d (was used for hardcoded mock chart data).
  const mockChain = useMockChain();

  // 2026-05-19 Tier 2 — real-chain bridge. When ORA real-chain is on,
  // KPI tiles read live SPL + SOL balance; otherwise we fall back to
  // mockChain values. The activity feed also splices in the most recent
  // on-chain signatures so it stops looking empty after refreshes.
  const onChain = useOraContract();
  const uw = useUnifiedWallet();
  const { connection } = useConnection();
  const chainHistory = useChainTxHistory();
  const liveChain = onChain.enabled && uw.publicKey !== null;
  const [chainOra, setChainOra] = useState<number | null>(null);
  const [chainSol, setChainSol] = useState<number | null>(null);
  useEffect(() => {
    if (!liveChain || !uw.publicKey) {
      setChainOra(null);
      setChainSol(null);
      return;
    }
    let cancel = false;
    const owner = uw.publicKey;
    const tick = async () => {
      try {
        const [oraRaw, lamports] = await Promise.all([
          onChain.getBalance(owner),
          connection.getBalance(owner),
        ]);
        if (cancel) return;
        setChainOra(Number(oraRaw) / Math.pow(10, onChain.decimals));
        setChainSol(lamports / LAMPORTS_PER_SOL);
      } catch { /* keep last value */ }
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => { cancel = true; window.clearInterval(id); };
  }, [liveChain, uw.publicKey, onChain, connection]);

  const displayedOra = liveChain && chainOra != null ? chainOra : mockChain.oraBalance;
  const displayedSol = liveChain && chainSol != null ? chainSol : mockChain.solBalance;

  // Roll-ups straight from on-chain primitives. No fake fallbacks.
  const totalLikes = postMetrics.reduce((s, m) => s + m.likes, 0);
  const totalComments = postMetrics.reduce((s, m) => s + m.comments, 0);
  const followersCount = mockChain.myCoinHolders; // proxy: holders are the closest live audience metric we track

  // Live on-chain proposal participation (read-only summary).
  const myProposals = useMemo(
    () => mockChain.proposals.filter(p => p.proposer === mockChain.walletAddress || p.proposer === 'You'),
    [mockChain.proposals, mockChain.walletAddress],
  );
  const votedCount = Object.keys(mockChain.myVotes).length;
  // Latest CC trade event (one-line teaser when present).
  const latestCoinTrade = mockChain.ownCoinTrades[0];
  // Recent transactions for activity feed (last 5). Real chain rows are
  // merged in front when present so the feed stops looking empty.
  const recentTx = useMemo(() => {
    const seen = new Set(mockChain.transactions.map((t) => t.txHash));
    const chainRows = chainHistory.txs
      .filter((c) => !seen.has(c.txHash))
      .map((c) => ({
        id: c.id,
        type: 'send' as const,
        amount: c.amount,
        timestamp: c.timestamp,
        txHash: c.txHash,
        details: c.details,
      }));
    return [...chainRows, ...mockChain.transactions]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
  }, [mockChain.transactions, chainHistory.txs]);

  return (
    <div className="space-y-5">
      {/* Top KPI row — 4 tiles, all real */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile
          icon={<Coins className="w-4 h-4" />}
          label={liveChain ? 'ORA balance (on-chain)' : 'ORA balance'}
          value={displayedOra.toFixed(2)}
          unit={`${displayedSol.toFixed(2)} SOL`}
          tone="aura"
        />
        <KpiTile
          icon={<Vault className="w-4 h-4" />}
          label="Vault balance"
          value={mockChain.vaultBalance.toFixed(2)}
          unit={`${mockChain.vestedAmount.toFixed(2)} claimable`}
          tone="purple"
        />
        <KpiTile
          icon={<Heart className="w-4 h-4" />}
          label="Engagement"
          value={(totalLikes + totalComments).toString()}
          unit={`${totalLikes} likes · ${totalComments} comments`}
          tone="rose"
        />
        <KpiTile
          icon={<Users className="w-4 h-4" />}
          label="Coin holders"
          value={followersCount.toLocaleString()}
          unit={`${mockChain.followingIds.length} following`}
          tone="amber"
        />
      </div>

      {/* 2-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left col */}
        <div className="lg:col-span-2 space-y-5">
          {/* Recent on-chain activity — replaces fake 7-day chart */}
          <section className="rounded-xl border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b bg-secondary/30 flex items-center justify-between">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Activity className="w-4 h-4 text-aura" />
                Recent activity
              </h2>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                on-chain
              </span>
            </div>
            {recentTx.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground mb-1">No activity yet</p>
                <p className="text-xs text-muted-foreground/70">Your wallet's transactions will appear here.</p>
              </div>
            ) : (
              <div className="divide-y">
                {recentTx.map(tx => (
                  <TxRow key={tx.id} tx={tx} />
                ))}
              </div>
            )}
          </section>

          {/* Your content — lists posts with REAL likes/comments */}
          <section className="rounded-xl border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b bg-secondary/30 flex items-center justify-between">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                Your content
              </h2>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                {postMetrics.length} {postMetrics.length === 1 ? 'post' : 'posts'}
              </span>
            </div>
            {postMetrics.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground mb-2">No content yet</p>
                <p className="text-xs text-muted-foreground/70">Publish your first post to start tracking metrics.</p>
              </div>
            ) : (
              <div className="divide-y">
                {[...postMetrics]
                  .sort((a, b) => (b.likes + b.comments) - (a.likes + a.comments))
                  .slice(0, 5)
                  .map((m, i) => (
                    <PostRow key={m.post.id} m={m} rank={i + 1} />
                  ))}
              </div>
            )}
          </section>
        </div>

        {/* Right col — sticky quick stats */}
        <div className="space-y-5 lg:sticky lg:top-32 lg:self-start">
          {/* Quick stats card */}
          <section className="rounded-xl border bg-card p-5 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-aura" />
              Your snapshot
            </h3>
            <div className="space-y-2">
              <SnapshotRow icon={<FileText className="w-3.5 h-3.5" />} label="Posts published" value={postMetrics.length.toString()} />
              <SnapshotRow icon={<Trophy className="w-3.5 h-3.5" />} label="Active bounties" value={myBountiesCount.toString()} />
              <SnapshotRow icon={<UserPlus className="w-3.5 h-3.5" />} label="Following" value={mockChain.followingIds.length.toString()} />
              <SnapshotRow icon={<Vote className="w-3.5 h-3.5" />} label="Proposals authored" value={myProposals.length.toString()} />
              <SnapshotRow icon={<CheckCircle className="w-3.5 h-3.5" />} label="Votes cast" value={votedCount.toString()} />
              <SnapshotRow icon={<Users className="w-3.5 h-3.5" />} label="Coin holders" value={mockChain.myCoinHolders.toString()} />
              <SnapshotRow icon={<Sparkles className="w-3.5 h-3.5" />} label="Curation rewards" value={`${mockChain.curationStats.totalRewards.toFixed(2)} ORA`} />
              <SnapshotRow icon={<Lock className="w-3.5 h-3.5" />} label="Total staked" value={`${(mockChain.stakes.reduce((s, x) => s + x.amount, 0) || 0).toFixed(0)} ORA`} />
            </div>
          </section>

          {/* Quick actions */}
          <section className="rounded-xl border bg-card p-5 space-y-2.5">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-aura" />
              Quick actions
            </h3>
            <QuickAction label="Create new post" sub="Publish to AURA" onClick={() => window.location.assign('/create')} />
            <QuickAction label="Post a bounty" sub="Crowdsource creators" onClick={() => window.location.assign('/create?mode=bounty')} />
            <QuickAction label="Manage Creator Coin" sub="Holders, vesting, redemptions" onClick={() => window.location.assign('/creator-coin')} />
            <QuickAction label="Wallet" sub="ORA, stakes, vesting" onClick={() => window.location.assign('/wallet')} />
            <QuickAction label="Governance" sub="Vote, propose, run" onClick={() => window.location.assign('/governance/active')} />
          </section>

          {/* Latest CC trade ping */}
          {latestCoinTrade && (
            <section className="rounded-xl border bg-gradient-to-br from-aura/5 via-purple-500/5 to-transparent p-5">
              <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-aura" />
                Latest coin trade
              </h3>
              <div className="flex items-center gap-3">
                <UserAvatar src={latestCoinTrade.userAvatar} displayName={latestCoinTrade.userName} username={latestCoinTrade.userUsername} className="w-9 h-9 rounded-full" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">
                    {latestCoinTrade.userName} <span className="text-muted-foreground font-normal">{latestCoinTrade.type === 'buy' ? 'bought' : 'sold'}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">{formatRelative(latestCoinTrade.timestamp)}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-xs font-bold tabular-nums ${latestCoinTrade.type === 'buy' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {latestCoinTrade.type === 'buy' ? '+' : '-'}{latestCoinTrade.amount.toLocaleString()} CC
                  </div>
                  <div className="text-[9px] uppercase text-muted-foreground font-bold tracking-wider">{latestCoinTrade.total.toFixed(2)} ORA</div>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Tab 2: Content
// ═══════════════════════════════════════════════════════════════════════
export default OverviewTab;
