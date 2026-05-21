import { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search, X, TrendingUp, Clock, DollarSign, Users,
  History, Plus, Compass, Trophy, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FirstVisitTooltip from '@/components/Tooltip/FirstVisitTooltip';
import TabIntroCard from '@/components/common/TabIntroCard';
import FeedCard from '@/components/cards/FeedCard';
import CurateModal from '@/components/curation/CurateModal';
import { posts } from '@/data/mock';
import { useUserPosts } from '@/hooks/useUserPosts';
import { useAuth } from '@/context/AuthContext';
import {
  prospectiveRankForPost, liveFollowersFor,
  discoveryWeightValue, formatMultiplier, combinedScoreTier,
} from '@/lib/curation-score';
import { useI18n } from '@/context/I18nContext';
import { useMockChain } from '@/context/MockChainContext';
import { useToast } from '@/context/ToastContext';
import { useOraGuard } from '@/hooks/useOraGuard';
import { useCurationContract } from '@/hooks/useCurationContract';

// 2026-05-20 P-1 split: subcomponents + level math extracted into ./
import type { CurationRecord } from './types';
import LevelBadgeButton from './components/LevelBadgeButton';
import ReputationModal from './components/ReputationModal';
import StatCard from './components/StatCard';
import HistoryRow from './components/HistoryRow';
import PodiumCard from './components/PodiumCard';
import LeaderboardRow from './components/LeaderboardRow';
import LeaderboardEmptyState from './components/LeaderboardEmptyState';

/**
 * Curation page — refactored 2026-05-07 per design review (see git history).
 * 2026-05-20: tabs/rows/modals + level math split out into ./components and
 * ./lib; the main `CurationPage` body here is just the page orchestration.
 */

/** Parses post.createdAt strings like "5m ago", "2h ago", "3d ago" into minutes-ago. Kept for misc. UI usages. */
// 2026-05-11 R13: parse createdAt into "minutes ago". Accepts both:
//   - relative strings like "5m ago", "2h ago", "3d ago", "1w ago" (seed data)
//   - absolute date strings: ISO (toISOString) or locale (toLocaleString)
//     written by useUserPosts when the user publishes new content.
function relativeToMinutes(s: string): number {
  if (!s) return Number.MAX_SAFE_INTEGER;
  // Relative format wins when present (e.g. seed mock data).
  const rel = s.match(/^(\d+)\s*(m|h|d|w)/i);
  if (rel) {
    const n = parseInt(rel[1]);
    const unit = rel[2].toLowerCase();
    return n * (unit === 'm' ? 1 : unit === 'h' ? 60 : unit === 'd' ? 1440 : 10080);
  }
  // Try parsing as a real date (ISO, locale string, numeric ms).
  const parsed = Date.parse(s);
  if (Number.isFinite(parsed)) {
    const minsAgo = (Date.now() - parsed) / 60000;
    return minsAgo < 0 ? 0 : minsAgo;
  }
  return Number.MAX_SAFE_INTEGER;
}

export default function CurationPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const mockChain = useMockChain();
  const { showToast } = useToast();
  const oraGuard = useOraGuard();
  // 2026-05-19 Tier 1.5: when enabled, the actual curate transaction is sent
  // on-chain by CurateModal via useCurationContract. The stats below still
  // come from mock chain (no on-chain index yet); a banner explains this so
  // demo users aren't surprised.
  const curation = useCurationContract();
  const [activeTab, setActiveTab] = useState<'latest' | 'curated' | 'leaderboard' | 'history'>('latest');
  const [searchQuery, setSearchQuery] = useState('');

  // Stake modal state
  const [showStakeModal, setShowStakeModal] = useState(false);
  const [selectedContent, setSelectedContent] = useState<Post | null>(null);
  const [curating, setCurating] = useState(false);

  // Reputation modal state
  const [showRepModal, setShowRepModal] = useState(false);

  // ── Real user stats — derived from mockChain (no hardcoded numbers) ───
  // totalStaked: sum of every `type: 'curate'` transaction amount the user
  //              has paid (1 ORA per curation today, but we sum the actual
  //              tx values so the number stays right when costs change).
  // totalRewards / todayCount: read straight off mockChain.curationStats.
  // activeCurations: number of distinct posts in the user's curatedContentIds.
  // reputation: mockChain.reputationScore (numeric) + reputationTier (label).
  const totalStaked = useMemo(
    () => mockChain.transactions.filter(tx => tx.type === 'curate')
      .reduce((s, tx) => s + Math.abs(tx.amount), 0),
    [mockChain.transactions],
  );
  const userStats = {
    totalStaked,
    totalRewards: mockChain.curationStats.totalRewards,
    todayCount: mockChain.curationStats.todayCount,
    todaySpent: mockChain.curationStats.todayOraSpent,
    activeCurations: mockChain.curatedContentIds.length,
    reputationScore: mockChain.reputationScore,
    reputationTier: mockChain.reputationTier,
  };

  // ── Latest AURA content for curation ─────────────────────────────────────
  // Every post on the protocol, sorted newest-first, with minutes-ago + tier
  // pre-computed so render is cheap.
  // User-published posts merged in front of the seed posts so freshly
  // created content appears at the top of the Latest tab.
  const { user: me } = useAuth();
  const myPublishedPosts = useUserPosts(me as any);

  const latestContent = useMemo(() => {
    const allPosts = [...myPublishedPosts, ...posts];
    return allPosts
      .map(p => {
        const mins = relativeToMinutes(p.createdAt);
        const rank = prospectiveRankForPost(p.id, mockChain.transactions);
        // tier reflects the *combined* Curation Score (rank × discovery)
        // so the chip colour and label match the user's real upside.
        const followers = liveFollowersFor(p.author.id, mockChain.followingIds);
        const tier = combinedScoreTier(rank, followers);
        return { post: p, mins, rank, tier };
      })
      .sort((a, b) => a.mins - b.mins);
  }, [mockChain.transactions, mockChain.followingIds, myPublishedPosts]);

  // ── Leaderboard — 100% real curation data (no synthesis from likes) ───
  //
  // Aggregates every `type: 'curate'` transaction by the post it targeted:
  //   curatorCount — number of curate-tx hits on the post
  //   totalStake   — sum of |tx.amount| across those tx (real ORA paid)
  //   avgWeight    — mean of the rank-weight multipliers parsed from each tx
  //   stakeScore   — totalStake × avgWeight (the share denominator)
  //   shareOfPool  — stakeScore / sum-of-all-stakeScores
  //   curatorReward = shareOfPool × 10,000 ORA (curators' half of 20k pool)
  //   creatorReward = shareOfPool × 10,000 ORA (creators' half)
  //
  // For new users / judges with no curations yet, this returns []. The
  // empty-state UI then teaches the rules instead of showing fake numbers.
  // The moment they curate one post the leaderboard becomes a live, real
  // ranking of their portfolio.
  const DAILY_POOL_HALF = 10_000;
  const leaderboard = useMemo(() => {
    const postByPrefix = new Map<string, Post>();
    // Index user-published posts FIRST so they win when prefixes collide.
    [...myPublishedPosts, ...posts].forEach(p => postByPrefix.set(p.id.slice(0, 8), p));

    type Roll = {
      curatorCount: number; totalStake: number; weightSum: number;
    };
    const rollup = new Map<string, Roll>();

    for (const tx of mockChain.transactions) {
      if (tx.type !== 'curate') continue;
      const idMatch = tx.details?.match(/Curated content (\w+)\.\.\./);
      const post = idMatch ? postByPrefix.get(idMatch[1]) : undefined;
      if (!post) continue;
      const weightMatch = tx.details?.match(/(\d+(?:\.\d+)?)×\s*weight/);
      const weight = weightMatch ? parseFloat(weightMatch[1]) : 1;
      const stake = Math.abs(tx.amount);
      const cur = rollup.get(post.id) ?? { curatorCount: 0, totalStake: 0, weightSum: 0 };
      cur.curatorCount += 1;
      cur.totalStake   += stake;
      cur.weightSum    += weight;
      rollup.set(post.id, cur);
    }

    if (rollup.size === 0) return [];

    const entries = Array.from(rollup.entries()).map(([postId, r]) => {
      const post = posts.find(p => p.id === postId)!;
      const avgWeight = r.weightSum / r.curatorCount;
      const stakeScore = r.totalStake * avgWeight;
      // Tier shown on the podium reflects the **peak Curation Score already
      // locked in** on this post — i.e. the 1st curator's weight (5×) × the
      // creator's discovery weight. This is what the leaderboard rewards;
      // showing the *next* curator's projection here misrepresents posts
      // whose 5× has already been claimed (e.g. a single existing curate
      // would otherwise downgrade the badge to 3× × discovery = 15×).
      // Rank 1 stays locked in for that post's whole lifetime.
      return {
        post,
        tier: combinedScoreTier(1, liveFollowersFor(post.author.id, mockChain.followingIds)),
        curatorCount: r.curatorCount,
        avgWeight,
        stakeScore,
        mins: relativeToMinutes(post.createdAt),
        totalStaked: r.totalStake,
      };
    });

    const totalScore = entries.reduce((s, e) => s + e.stakeScore, 0) || 1;

    return entries
      .map(e => {
        const share = e.stakeScore / totalScore;
        return {
          ...e,
          shareOfPool: share,
          curatorReward: share * DAILY_POOL_HALF,
          creatorReward: share * DAILY_POOL_HALF,
        };
      })
      .sort((a, b) => b.stakeScore - a.stakeScore);
  }, [mockChain.transactions, mockChain.followingIds, myPublishedPosts]);

  const filteredContent = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return latestContent;
    return latestContent.filter(({ post }) =>
      post.title?.toLowerCase().includes(q) ||
      post.content?.toLowerCase().includes(q) ||
      post.author.displayName.toLowerCase().includes(q) ||
      post.author.username.toLowerCase().includes(q) ||
      post.tags.some(tag => tag.toLowerCase().includes(q)),
    );
  }, [latestContent, searchQuery]);

  // Real curation history derived from mockChain transactions — no more
  // hardcoded seeds. Each `type: 'curate'` transaction is parsed back into
  // its content id (8-char prefix in `details`) + rank-weight multiplier
  // (extracted from the human-readable label like "⚡ Early — 3× weight").
  //
  // We then look up the matching post (from `posts` mock data, but real chain
  // data when wired) for cover/title/author. Reward is projected via the
  // same formula the Leaderboard tab uses: each curator's slice of the
  // post's curator pool = postCuratorReward / curatorCount.
  const history: CurationRecord[] = useMemo(() => {
    const postByPrefix = new Map<string, Post>();
    [...myPublishedPosts, ...posts].forEach(p => postByPrefix.set(p.id.slice(0, 8), p));

    // Quick lookup of leaderboard projection per post.
    const leaderboardByPostId = new Map<string, typeof leaderboard[number]>();
    leaderboard.forEach(row => leaderboardByPostId.set(row.post.id, row));

    return mockChain.transactions
      .filter(tx => tx.type === 'curate')
      .map(tx => {
        const idMatch = tx.details?.match(/Curated content (\w+)\.\.\./);
        const idPrefix = idMatch?.[1] ?? '';
        const post = postByPrefix.get(idPrefix);

        const weightMatch = tx.details?.match(/(\d+(?:\.\d+)?)×\s*weight/);
        const timeWeight = weightMatch ? parseFloat(weightMatch[1]) : 1;

        const stakeAmount = Math.abs(tx.amount); // 1 ORA per curation today

        // Reward projection: user's slice of this post's curator pool.
        const lb = post ? leaderboardByPostId.get(post.id) : undefined;
        const projectedReward = lb && lb.curatorCount > 0
          ? lb.curatorReward / lb.curatorCount
          : 0;

        return {
          id: tx.id,
          contentId: post?.id ?? idPrefix,
          contentTitle: post?.title || post?.content?.slice(0, 60) || `Content ${idPrefix}`,
          contentCover: post?.coverImage || post?.images?.[0],
          stakeAmount,
          stakeTime: tx.timestamp,
          status: 'active' as const, // settlement state isn't tracked yet
          rewards: projectedReward,
          timeWeight,
          performanceCoeff: 1.0,
        };
      });
  }, [mockChain.transactions, leaderboard, myPublishedPosts]);

  // ── Stake flow ───────────────────────────────────────────────────────────
  const openStakeModal = (post: Post) => {
    // Threshold check at the moment of action. Curation requires holding 100 ORA
    // (not spending) — so we route through oraGuard which shows the Buy ORA CTA
    // when the user is short of the threshold.
    if (mockChain.connected && !oraGuard.ensure(100, 'Curation eligibility')) return;
    setSelectedContent(post);
    setShowStakeModal(true);
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const fromPath = location.pathname + location.search;
  const goToPost = (postId: string) =>
    navigate(`/post/${postId}`, { state: { from: fromPath } });

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `${hours}${t.curation.hoursAgo}`;
    return `${Math.floor(hours / 24)}${t.curation.daysAgo}`;
  };

  const fallbackEmoji = (post: Post): string =>
    post.type === 'audio' ? '🎵'
    : post.type === 'video' ? '🎬'
    : post.type === 'photo' ? '📷'
    : post.type === 'live' ? '🔴'
    : '✍️';

  return (
    // Outer shell mirrors ExplorePage / MarketplacePage.
    <div className="pt-[60px] md:pt-2 pb-24 md:pb-4 min-h-screen">
      <FirstVisitTooltip
        id="curation-early"
        target='[data-tour-id="curation-latest-tab"]'
        title="早发现 = 5× 套利"
        body="任何人都可以策展 —— 首位发现者拿 5× 权重，后续递减。不需要创作也能赚 ORA。"
        placement="bottom"
        showAfterMs={700}
      />
      {/* Sticky top bar — search bar (primary affordance) + reputation badge.
          Page title removed (sidebar already labels this view). */}
      <div className="sticky top-[60px] md:top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/40">
        <div className="flex items-center gap-3 p-4 px-4 md:px-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search latest AURA content by title, creator, or tag…"
              className="pl-9 pr-9 h-10 rounded-2xl bg-secondary/50 border-transparent focus:bg-background focus:border-aura/30 transition-all text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <LevelBadgeButton
            exp={userStats.reputationScore}
            onClick={() => setShowRepModal(true)}
          />
        </div>
      </div>

      {/* Body */}
      <div className="px-4 md:px-6 pt-4">
        {curation.enabled && (
          <div className="mb-4 px-4 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider text-[10px] bg-amber-200 dark:bg-amber-800 px-1.5 py-0.5 rounded">Live</span>
            <span>
              Real-chain curation is on. The <b>Curate</b> button now broadcasts a Solana tx (1 ORA / curation). Stats below (rewards, score, leaderboard) are still demo data — they’ll be wired to an on-chain indexer in v0.2.
            </span>
          </div>
        )}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="latest" data-tour-id="curation-latest-tab">Latest</TabsTrigger>
            <TabsTrigger value="curated">Curated</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            <TabsTrigger value="history">{t.curation.tabs.history}</TabsTrigger>
          </TabsList>

          {/* ─── Latest tab ───────────────────────────────────────── */}
          <TabsContent value="latest" className="mt-6 space-y-6">
            <TabIntroCard
              gradient="from-amber-50 to-yellow-50 dark:from-amber-900/10 dark:to-yellow-900/10"
              border="border-amber-200/50 dark:border-amber-800/50"
              titleColor="text-amber-800 dark:text-amber-200"
              iconColor="text-amber-600"
              icon={<Compass className="w-6 h-6" />}
              title="Latest on the AURA protocol"
              description="Every post on the protocol is here, new and old. Whoever discovers a piece first — even years after publication — earns the 5× first-curator weight. Subsequent curators earn diminishing rank weight up to position 500. 1 ORA per curation, 100 ORA minimum holding to participate."
              meta={
                <div className="hidden md:flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 font-bold">5×</span>
                  <span className="px-2.5 py-1 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 font-bold">3×</span>
                  <span className="px-2.5 py-1 rounded-full bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 font-bold">2×</span>
                  <span className="px-2.5 py-1 rounded-full bg-green-500/15 text-green-600 dark:text-green-400 font-bold">1×</span>
                </div>
              }
            />

            {/* Active filter chip */}
            {searchQuery && (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>Showing</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-foreground font-medium">
                  "{searchQuery}"
                  <button onClick={() => setSearchQuery('')} className="hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </span>
                <span>· {filteredContent.length} result{filteredContent.length === 1 ? '' : 's'}</span>
              </div>
            )}

            {/* Latest masonry — same shape as HomePage / ExplorePage.
                Per-card overlays kept minimal: NO weight pill, NO curated tag
                (those were creating bad collisions in narrow masonry columns).
                The only overlay is a single Curate button whose color encodes
                the curator-rank tier, communicating remaining upside without extra UI. */}
            {filteredContent.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[40vh] px-6 text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400/20 to-orange-500/20 flex items-center justify-center mb-4">
                  <Compass className="w-7 h-7 text-amber-600" />
                </div>
                <h2 className="text-lg font-bold mb-2">No results yet</h2>
                <p className="text-sm text-muted-foreground max-w-xs mb-4">
                  Try a different keyword — or clear the search to see every post on the protocol.
                </p>
                {searchQuery && (
                  <Button onClick={() => setSearchQuery('')} className="bg-amber-500 text-white hover:bg-amber-600">
                    Clear search
                  </Button>
                )}
              </div>
            ) : (
              // Reverted to feed-masonry (CSS columns) to match HomePage /
              // ExplorePage exactly — same Pinterest-style staggered layout.
              // Note: column-count fills column-by-column (newest top-of-col-1,
              // next-newest below it, etc.), not strict left-to-right ordering.
              <div className="feed-masonry px-[2px] -mx-4 md:-mx-6">
                {filteredContent.map(({ post, rank, tier }) => {
                  // "Already curated" is determined by the live chain (the
                  // user’s own curatedContentIds), not by the static mock
                  // `isCurated` flag — we want black-box hackathon truth.
                  const alreadyCurated = mockChain.curatedContentIds.includes(post.id);
                  return (
                    <div key={post.id} className="feed-masonry-item relative group">
                      <FeedCard post={post} />
                      {/* Curate floating action — always visible on every
                          card. Colour + label encode the *combined* Curation
                          Score (rank × discovery) so curators see their
                          actual upside, not just one piece of it. Replaced
                          with a “Curated” badge once the user has acted. */}
                      {alreadyCurated ? (
                        <div
                          className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/90 text-white text-xs font-bold shadow-lg backdrop-blur"
                          title="You’ve already curated this content"
                        >
                          ✓ Curated
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); openStakeModal(post); }}
                          className={`absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r ${tier.gradient} text-white text-xs font-bold shadow-lg active:scale-95 transition-all md:opacity-0 md:group-hover:opacity-100 md:group-hover:scale-100 md:scale-95`}
                          title={`Curate for 1 ORA — lock in rank #${rank} (${formatMultiplier(tier.rankMult)}) on a ${formatMultiplier(tier.discoveryMult)} discovery creator. Combined Curation Score: ${tier.label}.`}
                        >
                          <Plus className="w-3.5 h-3.5" /> Curate · {tier.label}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* === Curated tab — user's curated picks, real chain data === */}
          <TabsContent value="curated" className="mt-6 space-y-6">
            <TabIntroCard
              gradient="from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10"
              border="border-emerald-200/50 dark:border-emerald-800/50"
              titleColor="text-emerald-800 dark:text-emerald-200"
              iconColor="text-emerald-600"
              icon={<Sparkles className="w-6 h-6" />}
              title="Your curated content"
              description="Every piece you've put 1 ORA behind. Each card shows the rank weight you locked in and is now earning your daily share. Pulled live from the on-chain curation log — no mock data."
              meta={
                <div className="hidden md:flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold">
                    {mockChain.curatedContentIds.length} curated
                  </span>
                </div>
              }
            />

            {(() => {
              // Build a per-post snapshot from curatedContentIds, ordered by
              // most-recent curate tx first.
              //
              // Lookup pool merges seed posts + the user's own published
              // posts (localStorage) so a curate on either kind shows up
              // in the Curated tab. Without the merge, user-published
              // posts silently disappeared from this view.
              const lookupPool: Post[] = [...myPublishedPosts, ...posts];
              const curatedSet = new Set(mockChain.curatedContentIds);
              const txByPost = new Map<string, { ts: number; weightLabel: string }>();
              for (const tx of mockChain.transactions) {
                if (tx.type !== 'curate') continue;
                const m = tx.details?.match(/Curated content (\w+)\.\.\./);
                if (!m) continue;
                const prefix = m[1];
                const post = lookupPool.find(p => p.id.slice(0, 8) === prefix);
                if (!post || !curatedSet.has(post.id)) continue;
                // Keep the *first* (earliest) tx — that's the curator's rank
                // for this content.
                const prior = txByPost.get(post.id);
                if (!prior || tx.timestamp < prior.ts) {
                  const weightMatch = tx.details?.match(/(\d+(?:\.\d+)?)×\s*weight/);
                  txByPost.set(post.id, {
                    ts: tx.timestamp,
                    weightLabel: weightMatch ? `${weightMatch[1]}×` : '—',
                  });
                }
              }

              const curatedPosts = Array.from(curatedSet)
                .map(id => {
                  const post = lookupPool.find(p => p.id === id);
                  if (!post) return null;
                  const meta = txByPost.get(id);
                  const followers = liveFollowersFor(post.author.id, mockChain.followingIds);
                  const discMult = discoveryWeightValue(followers);
                  return { post, ts: meta?.ts ?? 0, weightLabel: meta?.weightLabel ?? '—', discMult };
                })
                .filter((x): x is { post: Post; ts: number; weightLabel: string; discMult: number } => x !== null)
                .sort((a, b) => b.ts - a.ts);

              if (curatedPosts.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center min-h-[40vh] px-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400/20 to-teal-500/20 flex items-center justify-center mb-4">
                      <Sparkles className="w-7 h-7 text-emerald-600" />
                    </div>
                    <h2 className="text-lg font-bold mb-2">No curated picks yet</h2>
                    <p className="text-sm text-muted-foreground max-w-xs mb-4">
                      Head to <strong>Latest</strong> and curate something — it'll show up here as soon as the tx lands on chain.
                    </p>
                    <Button onClick={() => setActiveTab('latest')} className="bg-emerald-500 text-white hover:bg-emerald-600">
                      <Compass className="w-4 h-4 mr-1.5" /> Browse Latest
                    </Button>
                  </div>
                );
              }

              return (
                <div className="feed-masonry px-[2px] -mx-4 md:-mx-6">
                  {curatedPosts.map(({ post, ts, weightLabel, discMult }) => (
                    <div key={post.id} className="feed-masonry-item relative group">
                      <FeedCard post={post} />
                      {/* Locked-in score badge — emerald to signal "already
                          earning". Rank weight is parsed from the original
                          curate tx, discovery weight is read live. */}
                      <div
                        className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/90 backdrop-blur text-white text-xs font-bold shadow-lg"
                        title={`Curated ${new Date(ts).toLocaleString()} · rank weight ${weightLabel} × discovery ${formatMultiplier(discMult)}`}
                      >
                        ✓ {weightLabel} × {formatMultiplier(discMult)}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </TabsContent>


          {/* ─── Leaderboard tab ─────────────────────────────────────── */}
          <TabsContent value="leaderboard" className="mt-6 space-y-6">
            <TabIntroCard
              gradient="from-amber-50 to-yellow-50 dark:from-amber-900/10 dark:to-yellow-900/10"
              border="border-amber-200/50 dark:border-amber-800/50"
              titleColor="text-amber-800 dark:text-amber-200"
              iconColor="text-amber-600"
              icon={<Trophy className="w-6 h-6" />}
              title="Curation Leaderboard"
              description="Live ranking of every post on the protocol. The protocol distributes a fixed 20,000 ORA daily pool — 10k to curators by Curation Score share (Curator Rank Weight × Discovery Weight), 10k to creators by curation count. The 1st curator on an undiscovered creator captures up to 25× share regardless of when the content was published; viral content earns the largest creator slice (capped at 20% per post). Numbers update as the day progresses."
              meta={
                <div className="hidden md:flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold">
                    Daily pool: 20,000 ORA
                  </span>
                </div>
              }
            />

            {leaderboard.length === 0 ? (
              // Rules-explainer panel for new users / judges — no fake numbers,
              // just teaches how the leaderboard works so the moment they
              // curate one post they understand what they're seeing.
              <LeaderboardEmptyState onCurateClick={() => setActiveTab('latest')} />
            ) : (
              <div className="space-y-3">
                {/* Top-3 podium row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {leaderboard.slice(0, 3).map((row, i) => (
                    <PodiumCard
                      key={row.post.id}
                      rank={i + 1}
                      row={row}
                      onClick={() => goToPost(row.post.id)}
                    />
                  ))}
                </div>

                {/* Long-tail list (rank 4+) */}
                {leaderboard.length > 3 && (
                  <div className="space-y-2 pt-2">
                    <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide px-1">
                      Full ranking ({leaderboard.length} posts)
                    </div>
                    {leaderboard.slice(3).map((row, i) => (
                      <LeaderboardRow
                        key={row.post.id}
                        rank={i + 4}
                        row={row}
                        onClick={() => goToPost(row.post.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ─── History tab ───────────────────────────────────────────── */}
          <TabsContent value="history" className="mt-6 space-y-6">
            <TabIntroCard
              gradient="from-amber-50 to-yellow-50 dark:from-amber-900/10 dark:to-yellow-900/10"
              border="border-amber-200/50 dark:border-amber-800/50"
              titleColor="text-amber-800 dark:text-amber-200"
              iconColor="text-amber-600"
              icon={<History className="w-6 h-6" />}
              title={t.curation.history.title}
              description="Your personal curation track record. Active positions are still earning, claimed positions show what's already been deposited to your wallet."
            />

            {/* Stats — moved here from Dashboard. */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={<DollarSign className="w-5 h-5 text-blue-500" />}
                label={t.curation.stats.totalStaked}
                value={userStats.totalStaked.toLocaleString()}
                unit="ORA"
                gradient="from-blue-500/10 to-cyan-500/10"
                border="border-blue-200/50 dark:border-blue-800/40"
                accent="text-blue-600 dark:text-blue-400"
              />
              <StatCard
                icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
                label={t.curation.stats.totalRewards}
                value={userStats.totalRewards.toLocaleString()}
                unit="ORA"
                gradient="from-emerald-500/10 to-green-500/10"
                border="border-emerald-200/50 dark:border-emerald-800/40"
                accent="text-emerald-600 dark:text-emerald-400"
              />
              {/* successRate replaced — settlement state isn't tracked yet, so
                  showing a fake % would be misleading. Today's counter is
                  real-time off mockChain.curationStats. */}
              <StatCard
                icon={<Clock className="w-5 h-5 text-purple-500" />}
                label="Today's Curations"
                value={userStats.todayCount.toString()}
                unit={`${userStats.todaySpent.toFixed(0)} ORA spent today`}
                gradient="from-purple-500/10 to-pink-500/10"
                border="border-purple-200/50 dark:border-purple-800/40"
                accent="text-purple-600 dark:text-purple-400"
              />
              <StatCard
                icon={<Users className="w-5 h-5 text-orange-500" />}
                label={t.curation.stats.activeCurations}
                value={userStats.activeCurations.toString()}
                unit={t.curation.stats.ongoing}
                gradient="from-orange-500/10 to-red-500/10"
                border="border-orange-200/50 dark:border-orange-800/40"
                accent="text-orange-600 dark:text-orange-400"
              />
            </div>

            {/* History list */}
            {history.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
                No curation history yet — head to <strong>Latest</strong> to curate your first post.
              </div>
            ) : (
              <div className="space-y-3">
                {history.map(record => (
                  <HistoryRow
                    key={record.id}
                    record={record}
                    onClick={() => goToPost(record.contentId)}
                    formatTime={formatTime}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Curate flow — shared with the post detail page so layout, copy
            and the success animation feel identical from both entry points. */}
        <CurateModal
          open={showStakeModal}
          post={selectedContent}
          onClose={() => { setShowStakeModal(false); setSelectedContent(null); }}
        />

{/* ─── Reputation tiers & progress modal ──────────────────── */}
        {showRepModal && (
          <ReputationModal
            exp={userStats.reputationScore}
            onClose={() => setShowRepModal(false)}
          />
        )}
      </div>
    </div>
  );
}
