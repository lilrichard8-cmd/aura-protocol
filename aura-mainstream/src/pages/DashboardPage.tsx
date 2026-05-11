// Dashboard — creator's all-in-one global overview.
// 2026-05-09 R2: re-imagined as a tabbed dashboard giving the user a "see
// everything at a glance" feel. Four tabs:
//   1. Overview  — top-level KPIs, vault snapshot, 7-day activity chart, quick actions
//   2. Content   — your published posts, sortable, with per-post metrics
//   3. Bounties  — bounties you posted & participated in, grouped by status
//   4. Earnings  — vault details, revenue breakdown, ORA flow, recent txns
//
// All data is read from MockChainContext + localStorage (`aura_user_posts`).
// Where the chain doesn't track per-post analytics, we synthesize plausible
// numbers from deterministic hashes of the post id (so they stay stable
// across reloads).

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Eye, Users, Coins, Vault, CheckCircle,
  LayoutDashboard, FileText, Trophy, Wallet, ArrowUpRight, ArrowDownRight,
  Heart, MessageCircle, Share2, Sparkles, Flame, ImageIcon, Music, Video,
  Award, Clock, Target, Plus, ExternalLink, Activity, Vote, Pin, Zap,
  ShoppingBag, UserPlus, Lock, Layers, Gift, Repeat,
} from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { useMockChain, type Proposal } from '@/context/MockChainContext';
import { computeStats, getCommitteeMeta, TIER_META, type ProposalTier } from '@/components/governance/proposalHelpers';
import UserAvatar from '@/components/UserAvatar';

// Deterministic pseudo-random (0..1) for stable-but-fake per-post metrics.
function seedRand(seed: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    h = (h ^ seed.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

type TabId = 'overview' | 'content' | 'bounties' | 'governance' | 'earnings';

const TABS: Array<{ id: TabId; label: string; icon: typeof Coins }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'content', label: 'Content', icon: FileText },
  { id: 'bounties', label: 'Bounties', icon: Trophy },
  { id: 'governance', label: 'Governance', icon: Vote },
  { id: 'earnings', label: 'Earnings', icon: Wallet },
];

function readUserPosts(): Array<{
  id: string;
  mode: 'photo' | 'text' | 'video' | 'audio';
  title: string;
  content?: string;
  images?: string[];
  createdAt: number;
}> {
  try {
    const raw = localStorage.getItem('aura_user_posts');
    if (!raw) return [];
    const arr = JSON.parse(raw) as Array<any>;
    return arr.map((item, idx) => ({
      id: item.id || `user-${idx}`,
      mode: (item.mode as 'photo' | 'text' | 'video' | 'audio') || 'photo',
      title: item.title || (item.mode === 'text' ? (item.content?.slice(0, 60) ?? 'Untitled') : 'Untitled'),
      content: item.content,
      images: item.images,
      createdAt: item.createdAt || Date.now() - idx * 3600_000,
    }));
  } catch {
    return [];
  }
}

export default function DashboardPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const mockChain = useMockChain();
  const [tab, setTab] = useState<TabId>('overview');

  // ── Derived data shared across tabs
  const userPosts = useMemo(() => readUserPosts(), []);
  const myBounties = useMemo(
    () => mockChain.bounties.filter(b => b.creator === 'You' || (mockChain.publicKey && b.creator.startsWith(mockChain.publicKey.slice(0, 6)))),
    [mockChain.bounties, mockChain.publicKey],
  );
  // Submitted bounties: derived from real submission state. Until on-chain submission
  // tracking lands, this is honestly empty so judges see only their own activity.
  // (BountyItem doesn't yet carry a submitter list; once it does this filter activates.)
  const submittedBounties = useMemo<typeof mockChain.bounties>(
    () => [],
    [],
  );

  // Per-post metrics — 100% real on-chain data. No synthesized noise.
  // Views aren't tracked on-chain yet, so we surface that honestly as null;
  // the UI renders "—" for unknown numbers rather than fake numbers.
  const postMetrics = useMemo(() => {
    return userPosts.map(p => {
      const realComments = mockChain.postComments.filter(c => c.postId === p.id).length;
      const realLikes = mockChain.likedPostIds.includes(p.id) ? 1 : 0;
      const isPinned = mockChain.pinnedContentIds.includes(p.id);
      const isBoosted = mockChain.boostedContentIds.includes(p.id);
      return {
        post: p,
        // Views: not yet on-chain. UI shows "—" when null.
        views: null as number | null,
        likes: realLikes,
        comments: realComments,
        // Curations + earned per-post attribution requires tx tagging which
        // we haven't wired yet — keep null so the UI is honest.
        curations: null as number | null,
        earned: null as number | null,
        isPinned,
        isBoosted,
      };
    });
  }, [userPosts, mockChain.postComments, mockChain.likedPostIds, mockChain.pinnedContentIds, mockChain.boostedContentIds]);

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      {/* Sticky header with tabs */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="px-4 md:px-6 lg:px-8 pt-4 pb-0">
          <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
            <div>
              <h1 className="text-xl md:text-2xl font-black flex items-center gap-2">
                <LayoutDashboard className="w-5 h-5 text-aura" />
                {t.dashboard.title}
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{t.dashboard.subtitle}</p>
            </div>
            {/* Quick actions in header */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/create')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-aura text-white text-xs font-bold hover:bg-aura-dark transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Create
              </button>
            </div>
          </div>
          {/* Tab strip */}
          <div className="flex gap-1 -mx-1 overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`relative inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                  tab === id
                    ? 'text-aura'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {tab === id && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 bg-aura rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 md:px-6 lg:px-8 py-6">
        {tab === 'overview' && <OverviewTab postMetrics={postMetrics} myBountiesCount={myBounties.length} />}
        {tab === 'content' && <ContentTab postMetrics={postMetrics} navigate={navigate} />}
        {tab === 'bounties' && <BountiesTab myBounties={myBounties} submittedBounties={submittedBounties} navigate={navigate} />}
        {tab === 'governance' && <GovernanceTab navigate={navigate} />}
        {tab === 'earnings' && <EarningsTab />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Tab 1: Overview
// ═══════════════════════════════════════════════════════════════════════
function OverviewTab({
  postMetrics, myBountiesCount,
}: {
  postMetrics: Array<{ post: any; views: number | null; likes: number; comments: number; curations: number | null; earned: number | null; isPinned: boolean; isBoosted: boolean }>;
  myBountiesCount: number;
}) {
  // Removed t/d (was used for hardcoded mock chart data).
  const mockChain = useMockChain();

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
  // Recent transactions for activity feed (last 5)
  const recentTx = mockChain.transactions.slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Top KPI row — 4 tiles, all real */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile
          icon={<Coins className="w-4 h-4" />}
          label="ORA balance"
          value={mockChain.oraBalance.toFixed(2)}
          unit={`${mockChain.solBalance.toFixed(2)} SOL`}
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
function ContentTab({
  postMetrics, navigate,
}: {
  postMetrics: Array<{ post: any; views: number | null; likes: number; comments: number; curations: number | null; earned: number | null; isPinned: boolean; isBoosted: boolean }>;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [filter, setFilter] = useState<'all' | 'photo' | 'text' | 'audio' | 'video'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'likes' | 'comments'>('newest');

  const filtered = useMemo(() => {
    let out = postMetrics;
    if (filter !== 'all') out = out.filter(m => m.post.mode === filter);
    out = [...out];
    if (sortBy === 'likes') out.sort((a, b) => b.likes - a.likes);
    else if (sortBy === 'comments') out.sort((a, b) => b.comments - a.comments);
    else out.sort((a, b) => b.post.createdAt - a.post.createdAt);
    return out;
  }, [postMetrics, filter, sortBy]);

  const totals = useMemo(() => ({
    posts: postMetrics.length,
    likes: postMetrics.reduce((s, m) => s + m.likes, 0),
    comments: postMetrics.reduce((s, m) => s + m.comments, 0),
    pinned: postMetrics.filter(m => m.isPinned).length,
    boosted: postMetrics.filter(m => m.isBoosted).length,
  }), [postMetrics]);

  const filterChips: Array<{ id: typeof filter; label: string; icon: typeof Coins }> = [
    { id: 'all', label: 'All', icon: FileText },
    { id: 'photo', label: 'Photo', icon: ImageIcon },
    { id: 'text', label: 'Text', icon: FileText },
    { id: 'audio', label: 'Audio', icon: Music },
    { id: 'video', label: 'Video', icon: Video },
  ];

  return (
    <div className="space-y-5">
      {/* Stats row — only metrics we actually have on-chain */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiTile icon={<FileText className="w-4 h-4" />} label="Posts" value={totals.posts.toString()} unit="published" tone="aura" />
        <KpiTile icon={<Heart className="w-4 h-4" />} label="Likes" value={totals.likes.toLocaleString()} unit="on-chain" tone="rose" />
        <KpiTile icon={<MessageCircle className="w-4 h-4" />} label="Comments" value={totals.comments.toLocaleString()} unit="on-chain" tone="purple" />
        <KpiTile icon={<Pin className="w-4 h-4" />} label="Pinned" value={totals.pinned.toString()} unit="posts" tone="emerald" />
        <KpiTile icon={<Zap className="w-4 h-4" />} label="Boosted" value={totals.boosted.toString()} unit="posts" tone="amber" />
      </div>

      {/* Filter + sort bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex gap-1.5 flex-wrap">
          {filterChips.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                filter === id
                  ? 'bg-aura text-white'
                  : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2 py-1 rounded-lg bg-secondary/40 border border-border text-xs font-medium"
          >
            <option value="newest">Newest</option>
            <option value="likes">Most liked</option>
            <option value="comments">Most discussed</option>
          </select>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border/50 bg-secondary/20 p-12 text-center">
          <FileText className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
          <p className="font-medium text-sm mb-1">
            {postMetrics.length === 0 ? 'No content yet' : `No ${filter} posts`}
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            {postMetrics.length === 0
              ? 'Publish your first post to start tracking metrics.'
              : 'Try a different filter, or create new content.'}
          </p>
          <button
            onClick={() => navigate('/create')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-aura text-white text-xs font-bold hover:bg-aura-dark transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Create new
          </button>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="divide-y">
            {filtered.map((m, i) => (
              <PostRow key={m.post.id} m={m} rank={i + 1} showRank={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Tab 3: Bounties
// ═══════════════════════════════════════════════════════════════════════
function BountiesTab({
  myBounties, submittedBounties, navigate,
}: {
  myBounties: any[];
  submittedBounties: any[];
  navigate: ReturnType<typeof useNavigate>;
}) {
  const totalRewardLocked = myBounties
    .filter(b => b.status === 'active')
    .reduce((s, b) => s + b.reward, 0);
  const totalAwarded = myBounties
    .filter(b => b.status === 'completed')
    .reduce((s, b) => s + b.reward, 0);
  const totalSubmissions = myBounties.reduce((s, b) => s + b.submissionCount, 0);

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile icon={<Trophy className="w-4 h-4" />} label="Active bounties" value={myBounties.filter(b => b.status === 'active').length.toString()} unit="open for submissions" tone="aura" />
        <KpiTile icon={<Coins className="w-4 h-4" />} label="Reward locked" value={totalRewardLocked.toLocaleString()} unit="ORA in escrow" tone="amber" />
        <KpiTile icon={<CheckCircle className="w-4 h-4" />} label="Awarded" value={totalAwarded.toLocaleString()} unit="ORA distributed" tone="emerald" />
        <KpiTile icon={<MessageCircle className="w-4 h-4" />} label="Submissions" value={totalSubmissions.toString()} unit="received total" tone="purple" />
      </div>

      {/* Posted bounties */}
      <section className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b bg-secondary/30 flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Trophy className="w-4 h-4 text-aura" />
            Bounties you posted ({myBounties.length})
          </h2>
          <button
            onClick={() => navigate('/create?mode=bounty')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-aura text-white text-xs font-bold hover:bg-aura-dark transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New bounty
          </button>
        </div>
        {myBounties.length === 0 ? (
          <div className="p-10 text-center">
            <Trophy className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm font-medium mb-1">No bounties posted yet</p>
            <p className="text-xs text-muted-foreground">
              Crowdsource work from creators by offering ORA rewards.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {myBounties.map(b => (
              <BountyRow key={b.id} bounty={b} role="poster" navigate={navigate} />
            ))}
          </div>
        )}
      </section>

      {/* Bounties you participated in */}
      <section className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b bg-secondary/30">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Target className="w-4 h-4 text-aura" />
            Bounties you submitted to ({submittedBounties.length})
          </h2>
        </div>
        {submittedBounties.length === 0 ? (
          <div className="p-10 text-center">
            <Target className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm font-medium mb-1">No submissions yet</p>
            <p className="text-xs text-muted-foreground mb-3">
              Browse open bounties and submit your work to earn ORA.
            </p>
            <button
              onClick={() => navigate('/explore')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-bold hover:bg-secondary/70 transition-colors"
            >
              Browse bounties
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {submittedBounties.map(b => (
              <BountyRow key={b.id} bounty={b} role="submitter" navigate={navigate} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Tab 4: Earnings
// ═══════════════════════════════════════════════════════════════════════
function EarningsTab() {
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
function GovernanceTab({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const mockChain = useMockChain();
  const myProposals = useMemo(
    () => mockChain.proposals.filter(p =>
      p.proposer === mockChain.walletAddress
      || p.proposer === 'You'
      || (mockChain.publicKey ? p.proposer === mockChain.publicKey : false),
    ),
    [mockChain.proposals, mockChain.walletAddress, mockChain.publicKey],
  );
  const votedProposals = useMemo(() => {
    return Object.entries(mockChain.myVotes)
      .map(([id, vote]) => ({
        proposal: mockChain.proposals.find(p => p.id === id),
        vote: vote as 'for' | 'against',
      }))
      .filter((x): x is { proposal: Proposal; vote: 'for' | 'against' } => x.proposal !== undefined);
  }, [mockChain.myVotes, mockChain.proposals]);

  const myApplications = useMemo(
    () => mockChain.electionApplications.filter(a => a.applicantWallet === mockChain.walletAddress && !a.withdrawn),
    [mockChain.electionApplications, mockChain.walletAddress],
  );

  const passedCount = myProposals.filter(p => p.status === 'passed').length;
  const activeCount = myProposals.filter(p => p.status === 'voting').length;
  const totalSupportCast = votedProposals.length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile icon={<Vote className="w-4 h-4" />} label="Proposals authored" value={myProposals.length.toString()} unit="on-chain" tone="aura" />
        <KpiTile icon={<Activity className="w-4 h-4" />} label="Active" value={activeCount.toString()} unit="in voting" tone="purple" />
        <KpiTile icon={<CheckCircle className="w-4 h-4" />} label="Passed" value={passedCount.toString()} unit="approved" tone="emerald" />
        <KpiTile icon={<Target className="w-4 h-4" />} label="Votes cast" value={totalSupportCast.toString()} unit="on others" tone="amber" />
      </div>

      <section className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b bg-secondary/30 flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Vote className="w-4 h-4 text-aura" />
            Proposals you authored ({myProposals.length})
          </h2>
          <button
            onClick={() => navigate('/governance/create')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-aura text-white text-xs font-bold hover:bg-aura-dark transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New proposal
          </button>
        </div>
        {myProposals.length === 0 ? (
          <div className="p-10 text-center">
            <Vote className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm font-medium mb-1">No proposals yet</p>
            <p className="text-xs text-muted-foreground mb-4">
              Propose changes to the protocol — reward params, partnerships, technical upgrades.
            </p>
            <button
              onClick={() => navigate('/governance/create')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-aura text-white text-xs font-bold hover:bg-aura-dark transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Create your first proposal
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {myProposals.map(p => (
              <ProposalRow key={p.id} p={p} navigate={navigate} myVote={mockChain.myVotes[p.id]} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b bg-secondary/30">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-aura" />
            Votes you cast ({votedProposals.length})
          </h2>
        </div>
        {votedProposals.length === 0 ? (
          <div className="p-10 text-center">
            <CheckCircle className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm font-medium mb-1">No votes cast yet</p>
            <p className="text-xs text-muted-foreground mb-3">
              Make your voice heard — vote on active community proposals.
            </p>
            <button
              onClick={() => navigate('/governance/active')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-bold hover:bg-secondary/70 transition-colors"
            >
              Browse active proposals
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {votedProposals.map(({ proposal, vote }) => (
              <ProposalRow key={proposal.id} p={proposal} navigate={navigate} myVote={vote} showMyVote />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b bg-secondary/30">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Award className="w-4 h-4 text-aura" />
            Committee applications ({myApplications.length})
          </h2>
        </div>
        {myApplications.length === 0 ? (
          <div className="p-10 text-center">
            <Award className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm font-medium mb-1">No active applications</p>
            <p className="text-xs text-muted-foreground mb-3">
              Run for a seat on Development, Operations, Technical, or Content committees.
            </p>
            <button
              onClick={() => navigate('/governance/committees')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-bold hover:bg-secondary/70 transition-colors"
            >
              View committees
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {myApplications.map(a => {
              const meta = getCommitteeMeta(a.committee);
              return (
                <div key={a.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-aura/15 flex items-center justify-center shrink-0 text-lg">
                    {meta?.icon ?? '🏛️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-semibold">{meta?.name ?? a.committee} committee</p>
                      <span className="text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded-full bg-aura/15 text-aura">
                        Cycle {a.electionCycleId}
                      </span>
                    </div>
                    {a.tagline && (
                      <p className="text-[11px] text-muted-foreground italic mb-1 line-clamp-1">“{a.tagline}”</p>
                    )}
                    <p className="text-[10px] text-muted-foreground line-clamp-2">{a.goals}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Staked at submit: <span className="font-bold">{a.stakedAtSubmit.toLocaleString()} ORA</span>
                      <span className="mx-1.5">·</span>
                      Submitted {formatRelative(a.submittedAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/governance/committee/${a.committee}`)}
                    className="text-[10px] text-aura font-bold hover:underline shrink-0"
                  >
                    View →
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Shared sub-components
// ═══════════════════════════════════════════════════════════════════════
function KpiTile({
  icon, label, value, unit, tone, changeUp,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  tone: 'emerald' | 'purple' | 'amber' | 'aura' | 'rose';
  changeUp?: boolean;
}) {
  const toneClasses: Record<typeof tone, string> = {
    emerald: 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent',
    purple: 'border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-transparent',
    amber: 'border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent',
    aura: 'border-aura/30 bg-gradient-to-br from-aura/5 to-transparent',
    rose: 'border-rose-500/30 bg-gradient-to-br from-rose-500/5 to-transparent',
  };
  const valueColor: Record<typeof tone, string> = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    purple: 'text-purple-600 dark:text-purple-400',
    amber: 'text-amber-600 dark:text-amber-400',
    aura: 'text-aura',
    rose: 'text-rose-600 dark:text-rose-400',
  };
  return (
    <div className={`rounded-xl border p-4 ${toneClasses[tone]}`}>
      <div className="flex items-center gap-1.5 mb-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-bold">{label}</span>
      </div>
      <p className={`text-2xl md:text-3xl font-black tabular-nums leading-none ${valueColor[tone]}`}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground mt-1.5 inline-flex items-center gap-1">
        {typeof changeUp === 'boolean' && (
          changeUp ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-rose-500" />
        )}
        {unit}
      </p>
    </div>
  );
}

function BarChart({ data, color, label }: { data: number[]; color: string; label: string }) {
  const max = Math.max(...data, 1);
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  // 7-col grid; each column: top number + flex-1 bar slot + bottom letter.
  // The flex-1 slot is the bar canvas: bars are absolutely sized via percentage
  // OR explicit pixel height (max bar height = 64px). This reliably fills the
  // parent's vertical space without depending on flex height inheritance, which
  // is fragile when a column flex container has multiple non-flex children.
  const BAR_PX = 60;
  return (
    <div>
      <p className="text-[11px] font-semibold mb-2 text-muted-foreground">{label}</p>
      <div className="grid grid-cols-7 gap-1.5">
        {data.map((v, i) => {
          const h = Math.max(2, Math.round((v / max) * BAR_PX));
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-[9px] text-muted-foreground tabular-nums leading-none">{v}</span>
              <div className="w-full flex items-end justify-center" style={{ height: BAR_PX }}>
                <div
                  className={`w-full rounded-t-md ${color} transition-all duration-500`}
                  style={{ height: h }}
                />
              </div>
              <span className="text-[9px] text-muted-foreground leading-none">{days[i]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PostRow({ m, rank, showRank = true }: { m: { post: any; views: number | null; likes: number; comments: number; curations: number | null; earned: number | null; isPinned?: boolean; isBoosted?: boolean }; rank: number; showRank?: boolean }) {
  const TypeIcon = m.post.mode === 'photo' ? ImageIcon
    : m.post.mode === 'audio' ? Music
    : m.post.mode === 'video' ? Video
    : FileText;

  return (
    <div className="px-4 py-3 hover:bg-secondary/30 transition-colors">
      <div className="flex items-center gap-3">
        {showRank && (
          <span className={`text-[10px] font-black tabular-nums shrink-0 w-5 ${
            rank === 1 ? 'text-amber-500' : rank === 2 ? 'text-slate-400' : rank === 3 ? 'text-orange-500' : 'text-muted-foreground'
          }`}>
            #{rank}
          </span>
        )}
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-aura/20 to-purple-500/20 flex items-center justify-center shrink-0">
          <TypeIcon className="w-4 h-4 text-aura" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold truncate">{m.post.title || (m.post.content?.slice(0, 50) ?? 'Untitled')}</p>
            {m.isPinned && (
              <span className="inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded-full bg-aura/15 text-aura">
                <Pin className="w-2.5 h-2.5" />
                Pinned
              </span>
            )}
            {m.isBoosted && (
              <span className="inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Zap className="w-2.5 h-2.5" />
                Boosted
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground inline-flex items-center gap-2 mt-0.5">
            <span className="uppercase tracking-wider font-bold">{m.post.mode}</span>
            <span>·</span>
            <span>{formatRelative(m.post.createdAt)}</span>
          </p>
        </div>
        {/* Inline metrics — — placeholder when not yet tracked on-chain */}
        <div className="hidden sm:flex items-center gap-4 text-xs tabular-nums">
          <Metric icon={<Eye className="w-3 h-3" />} value={m.views == null ? '—' : m.views.toLocaleString()} />
          <Metric icon={<Heart className="w-3 h-3" />} value={m.likes.toLocaleString()} />
          <Metric icon={<MessageCircle className="w-3 h-3" />} value={m.comments.toLocaleString()} />
          <Metric icon={<Sparkles className="w-3 h-3" />} value={m.curations == null ? '—' : m.curations.toString()} />
        </div>
        <div className="text-right shrink-0">
          {m.earned == null ? (
            <div className="text-xs text-muted-foreground tabular-nums">— ORA</div>
          ) : (
            <>
              <div className="text-sm font-bold tabular-nums text-aura">+{m.earned.toFixed(2)}</div>
              <div className="text-[9px] uppercase text-muted-foreground font-bold tracking-wider">ORA</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      {icon}
      {value}
    </span>
  );
}

function BountyRow({ bounty, role, navigate }: { bounty: any; role: 'poster' | 'submitter'; navigate: ReturnType<typeof useNavigate> }) {
  const deadlineDate = new Date(bounty.deadline);
  const daysLeft = Math.max(0, Math.floor((deadlineDate.getTime() - Date.now()) / 86400000));
  const isExpiring = bounty.status === 'active' && daysLeft <= 2;

  const statusMeta = {
    active: { label: 'Active', tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
    completed: { label: 'Awarded', tone: 'bg-aura/15 text-aura' },
    expired: { label: 'Expired', tone: 'bg-muted text-muted-foreground' },
  }[bounty.status as 'active' | 'completed' | 'expired'];

  return (
    <div
      className="px-4 py-3 hover:bg-secondary/30 transition-colors cursor-pointer"
      onClick={() => navigate(`/bounty/${bounty.id}`)}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center shrink-0">
          <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-sm font-semibold truncate">{bounty.title}</p>
            <span className={`text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded-full ${statusMeta.tone}`}>
              {statusMeta.label}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground line-clamp-1 mb-1">{bounty.description}</p>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {bounty.status === 'active' ? `${daysLeft}d left` : new Date(bounty.deadline).toLocaleDateString()}
              {isExpiring && <span className="text-rose-500 font-bold">!</span>}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="w-3 h-3" />
              {bounty.submissionCount} submission{bounty.submissionCount !== 1 ? 's' : ''}
            </span>
            {role === 'submitter' && (
              <span className="inline-flex items-center gap-1 text-aura">
                <CheckCircle className="w-3 h-3" />
                You submitted
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400">{bounty.reward.toLocaleString()}</div>
          <div className="text-[9px] uppercase text-muted-foreground font-bold tracking-wider">ORA</div>
        </div>
      </div>
    </div>
  );
}

function TxRow({ tx }: { tx: any }) {
  const isCredit = ['airdrop', 'reward', 'sell_coin', 'unstake'].includes(tx.type);
  const isDebit = ['buy_coin', 'buy_key', 'send', 'stake', 'mint_coin', 'curate', 'redeem_cc'].includes(tx.type);
  const ArrowIcon = isCredit ? ArrowDownRight : isDebit ? ArrowUpRight : Coins;

  const typeLabels: Record<string, string> = {
    airdrop: 'Airdrop', publish: 'Publish', reward: 'Reward', mint_coin: 'Mint coin',
    buy_coin: 'Buy coin', sell_coin: 'Sell coin', curate: 'Curate', buy_key: 'Buy key',
    send: 'Send', stake: 'Stake', unstake: 'Unstake', send_cc: 'Send CC', redeem_cc: 'Redeem CC',
  };

  return (
    <div className="px-4 py-2.5 flex items-center gap-3 hover:bg-secondary/30 transition-colors">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
        isCredit ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : isDebit ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'bg-muted text-muted-foreground'
      }`}>
        <ArrowIcon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold">{typeLabels[tx.type] || tx.type}</p>
        <p className="text-[10px] text-muted-foreground truncate">{tx.details}</p>
      </div>
      <div className="text-right shrink-0">
        {tx.amount !== 0 && (
          <div className={`text-xs font-bold tabular-nums ${isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
            {isCredit ? '+' : isDebit ? '-' : ''}{Math.abs(tx.amount).toFixed(2)}
          </div>
        )}
        <div className="text-[9px] text-muted-foreground tabular-nums">{formatRelative(tx.timestamp)}</div>
      </div>
    </div>
  );
}

function SnapshotRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-sm font-bold tabular-nums">{value}</span>
    </div>
  );
}

function QuickAction({ label, sub, onClick }: { label: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-3 rounded-lg border border-border/40 bg-secondary/20 hover:bg-secondary/40 hover:border-aura/40 transition-all text-left group"
    >
      <div>
        <p className="text-xs font-bold">{label}</p>
        <p className="text-[10px] text-muted-foreground">{sub}</p>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-aura transition-colors" />
    </button>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

// ─── Earnings sub-components ───────────────────────────────────────────

function CoinTradeRow({ t }: { t: any }) {
  const isBuy = t.type === 'buy';
  return (
    <div className="px-4 py-2.5 flex items-center gap-3 hover:bg-secondary/30 transition-colors">
      <UserAvatar src={t.userAvatar} displayName={t.userName} username={t.userUsername} className="w-8 h-8 rounded-full shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">
          {t.userName} <span className="text-muted-foreground font-normal">{isBuy ? 'bought' : 'sold'}</span>
        </p>
        <p className="text-[10px] text-muted-foreground">@{t.userUsername} · {formatRelative(t.timestamp)}</p>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-xs font-bold tabular-nums ${isBuy ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
          {isBuy ? '+' : '-'}{t.amount.toLocaleString()} CC
        </div>
        <div className="text-[9px] text-muted-foreground tabular-nums">{t.total.toFixed(2)} ORA @ {t.price.toFixed(3)}</div>
      </div>
    </div>
  );
}

function HolderRow({ h, rank, symbol }: { h: any; rank: number; symbol: string | null }) {
  return (
    <div className="px-4 py-2.5 flex items-center gap-3 hover:bg-secondary/30 transition-colors">
      <span className={`text-[10px] font-black tabular-nums shrink-0 w-5 ${
        rank === 1 ? 'text-amber-500' : rank === 2 ? 'text-slate-400' : rank === 3 ? 'text-orange-500' : 'text-muted-foreground'
      }`}>
        #{rank}
      </span>
      <UserAvatar src={h.avatar} displayName={h.name} username={h.username} className="w-8 h-8 rounded-full shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">{h.name}</p>
        <p className="text-[10px] text-muted-foreground truncate">@{h.username}</p>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs font-bold tabular-nums text-aura">{h.amount.toLocaleString()}</div>
        <div className="text-[9px] uppercase text-muted-foreground font-bold tracking-wider">{symbol ?? 'CC'}</div>
      </div>
    </div>
  );
}

function RedemptionRow({ r }: { r: any }) {
  const statusMeta: Record<string, { label: string; tone: string }> = {
    pending_delivery: { label: 'Awaiting delivery', tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
    delivered: { label: 'Delivered', tone: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
    confirmed: { label: 'Confirmed', tone: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
    disputed: { label: 'Disputed', tone: 'bg-rose-500/15 text-rose-700 dark:text-rose-400' },
  };
  const meta = statusMeta[r.status] ?? statusMeta.pending_delivery;
  return (
    <div className="px-4 py-2.5 flex items-start gap-3 hover:bg-secondary/30 transition-colors">
      {r.buyerAvatar ? (
        <UserAvatar src={r.buyerAvatar} displayName={r.buyerName} className="w-8 h-8 rounded-full shrink-0 mt-0.5" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
          <Gift className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          <p className="text-xs font-semibold truncate">{r.buyerName}</p>
          <span className={`text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded-full ${meta.tone}`}>
            {meta.label}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground line-clamp-1">{r.benefitTitle}</p>
        <p className="text-[10px] text-muted-foreground">{formatRelative(r.createdAt)}</p>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs font-bold tabular-nums text-aura">{r.cost.toLocaleString()}</div>
        <div className="text-[9px] uppercase text-muted-foreground font-bold tracking-wider">{r.symbol}</div>
      </div>
    </div>
  );
}

function StakeRow({ s }: { s: any }) {
  const remainingMs = Math.max(0, s.unlocksAt - Date.now());
  const remainingDays = Math.ceil(remainingMs / 86400000);
  const isUnlocked = remainingMs <= 0;
  return (
    <div className="px-4 py-2.5 flex items-center gap-3 hover:bg-secondary/30 transition-colors">
      <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0">
        <Lock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold">
          {s.amount.toLocaleString()} ORA <span className="text-muted-foreground font-normal">· {s.lockDays}-day lock</span>
        </p>
        <p className="text-[10px] text-muted-foreground">
          Multiplier {s.multiplier}× · Started {formatRelative(s.startedAt)}
        </p>
      </div>
      <div className="text-right shrink-0">
        {isUnlocked ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="w-3 h-3" />
            Unlocked
          </span>
        ) : (
          <span className="text-[10px] font-bold tabular-nums text-muted-foreground">{remainingDays}d left</span>
        )}
      </div>
    </div>
  );
}

// ─── Governance sub-components ─────────────────────────────────────────

function ProposalRow({
  p, navigate, myVote, showMyVote = false,
}: {
  p: Proposal;
  navigate: ReturnType<typeof useNavigate>;
  myVote?: 'for' | 'against';
  showMyVote?: boolean;
}) {
  const stats = computeStats(p);
  const tier = (p.tier ?? 'tier-3') as ProposalTier;
  const tierMeta = TIER_META[tier];
  const committeeMeta = getCommitteeMeta(p.committee);

  const statusMeta: Record<Proposal['status'], { label: string; tone: string }> = {
    voting: { label: 'Voting', tone: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
    passed: { label: 'Passed', tone: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
    rejected: { label: 'Rejected', tone: 'bg-rose-500/15 text-rose-700 dark:text-rose-400' },
  };
  const sm = statusMeta[p.status];

  return (
    <div
      className="px-4 py-3 hover:bg-secondary/30 transition-colors cursor-pointer"
      onClick={() => navigate(`/governance/proposal/${p.id}`)}
    >
      <div className="flex items-start gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-aura/15 flex items-center justify-center shrink-0 text-lg">
          {committeeMeta?.icon ?? '🏛️'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <p className="text-sm font-semibold truncate">{p.title}</p>
            <span className={`text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded-full ${sm.tone}`}>
              {sm.label}
            </span>
            <span className={`text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded-full ${tierMeta.tone}`}>
              {tierMeta.shortLabel}
            </span>
            {showMyVote && myVote && (
              <span className={`text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded-full ${
                myVote === 'for'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
              }`}>
                You voted {myVote}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground line-clamp-1 mb-1">{p.description}</p>
          <p className="text-[10px] text-muted-foreground">
            {committeeMeta?.name ?? 'Unassigned'} committee
            <span className="mx-1.5">·</span>
            Deadline {p.deadline}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold tabular-nums text-aura">{stats.totalVotes.toLocaleString()}</div>
          <div className="text-[9px] uppercase text-muted-foreground font-bold tracking-wider">votes</div>
        </div>
      </div>

      {/* Approval + quorum twin progress */}
      <div className="grid grid-cols-2 gap-3 pl-12">
        <div>
          <div className="flex items-center justify-between text-[9px] uppercase tracking-wider font-bold text-muted-foreground mb-0.5">
            <span>Approval</span>
            <span className={stats.approvalMet ? 'text-emerald-600 dark:text-emerald-400' : ''}>
              {stats.approvalPct.toFixed(0)}% / {tierMeta.approval}%
            </span>
          </div>
          <div className="relative h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 ${stats.approvalMet ? 'bg-emerald-500' : 'bg-aura'}`}
              style={{ width: `${Math.min(100, stats.approvalPct)}%` }}
            />
            <div
              className="absolute inset-y-0 w-px bg-foreground/30"
              style={{ left: `${tierMeta.approval}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-[9px] uppercase tracking-wider font-bold text-muted-foreground mb-0.5">
            <span>Quorum</span>
            <span className={stats.quorumMet ? 'text-emerald-600 dark:text-emerald-400' : ''}>
              {stats.quorumPct.toFixed(1)}% / {tierMeta.quorum}%
            </span>
          </div>
          <div className="relative h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 ${stats.quorumMet ? 'bg-emerald-500' : 'bg-purple-500'}`}
              style={{ width: `${Math.min(100, stats.quorumPct)}%` }}
            />
            {tierMeta.quorum > 0 && (
              <div
                className="absolute inset-y-0 w-px bg-foreground/30"
                style={{ left: `${tierMeta.quorum}%` }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
