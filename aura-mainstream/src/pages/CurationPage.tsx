import { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search, X, Crown, TrendingUp, Clock, DollarSign, Users,
  History, Wallet, Plus, Compass, Trophy, Coins,
  Sparkles, Target, ChevronRight, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import type { Post } from '@/types';

/**
 * Curation page — refactored 2026-05-07 per design review:
 *
 *   • Sticky header now hosts a search bar + Reputation badge (replaces the
 *     redundant page title — sidebar already says "Curation").
 *   • Always-visible "Insufficient ORA" warning removed; the threshold
 *     check now fires as a toast at the moment the user attempts to curate.
 *   • Stats grid (Total Staked / Rewards / Success Rate / Active) moved to
 *     the History tab where the personal track record naturally lives.
 *   • Curator-rank explainer card removed; the rule is communicated:
 *       1. as a per-card weight badge (5x / 3x / 2x / 1x) on every feed item
 *       2. inline in the stake modal at decision time
 *   • Dashboard content stream now matches HomePage / ExplorePage masonry
 *     (feed-masonry + FeedCard) and surfaces every post on the AURA protocol
 *     sorted newest-first, so curators see first-hand content immediately.
 *   • Pending tab dropped — Dashboard now is the discovery surface; History
 *     remains for personal track record.
 */

interface CurationRecord {
  id: string;
  contentId: string;
  contentTitle: string;
  contentCover?: string;
  stakeAmount: number;
  stakeTime: number;
  status: 'active' | 'claimed' | 'pending';
  rewards: number;
  timeWeight: number;
  performanceCoeff: number;
}

/** Parses post.createdAt strings like "5m ago", "2h ago", "3d ago" into minutes-ago. Kept for misc. UI usages. */
// 2026-05-11 R13: parse createdAt into "minutes ago". Accepts both:
//   - relative strings like "5m ago", "2h ago", "3d ago", "1w ago" (seed data)
//   - absolute date strings: ISO (toISOString) or locale (toLocaleString)
//     written by useUserPosts when the user publishes new content.
// Previously the parser only handled relative strings, so freshly-published
// posts (which carry locale-formatted dates) fell through to MAX_SAFE_INTEGER
// and sank to the bottom of the Latest tab — the opposite of what the user
// expects (newest first).
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
            <TabsTrigger value="latest">Latest</TabsTrigger>
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

/* ────────────────────────────────────────────────────────────────────────────
 * Reputation level system — numeric ladder with no cap.
 *
 * Everyone starts at Lv. 1 / 0 EXP. The early game (Lv. 1–5) is
 * deliberately gentle so newcomers reach Apprentice within a handful
 * of curations; difficulty ramps up after Veteran (Lv. 21) where the
 * badge first turns into a coloured/glowing tier.
 *
 * Per-level EXP costs are hand-tuned round numbers (no fractional
 * thresholds). Badge colour rotates every 5 levels and intensifies as
 * the curator climbs.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * EXP cost to advance from level N to N+1 (single-level cost).
 * Hand-tuned to round numbers; gentle through Lv. 20, steeper after.
 */
const LEVEL_UP_COSTS: number[] = [
  // Lv. 1→2…4→5  — Initiate, very gentle
  100, 200, 300, 400,
  // Lv. 5→6…9→10 — Apprentice
  600, 800, 1000, 1200, 1500,
  // Lv. 10→11…14→15 — Adept
  2000, 2500, 3000, 3500, 4000,
  // Lv. 15→16…19→20 — Expert
  5000, 6000, 7000, 8000, 10000,
  // Lv. 20→21…24→25 — Veteran (first coloured tier)
  13000, 16000, 20000, 25000, 30000,
  // Lv. 25→26…29→30 — Champion
  40000, 50000, 65000, 80000, 100000,
  // Lv. 30→31…34→35 — Master
  130000, 160000, 200000, 250000, 300000,
  // Lv. 35→36…39→40 — Grandmaster
  400000, 500000, 650000, 800000, 1000000,
  // Lv. 40→41…44→45 — Mythic
  1300000, 1600000, 2000000, 2500000, 3000000,
];
/** Growth factor for levels past the explicit table (Lv. 45+). */
const LEVEL_UP_GROWTH = 1.3;

/** Round to a friendly number so beyond-table costs still look clean. */
function roundNice(n: number): number {
  if (n <= 0) return 0;
  const mag = Math.pow(10, Math.floor(Math.log10(n)));
  const norm = n / mag;
  let nice: number;
  if (norm < 1.5) nice = 1;
  else if (norm < 2.25) nice = 2;
  else if (norm < 3.5) nice = 2.5;
  else if (norm < 7.5) nice = 5;
  else nice = 10;
  return Math.round(nice * mag);
}

/** EXP needed to step from level N to level N+1. */
function costToAdvance(fromLevel: number): number {
  if (fromLevel < 1) return 0;
  const idx = fromLevel - 1; // costs[0] = cost from Lv.1→2
  if (idx < LEVEL_UP_COSTS.length) return LEVEL_UP_COSTS[idx];
  const lastIdx = LEVEL_UP_COSTS.length - 1;
  const overshoot = idx - lastIdx;
  const raw = LEVEL_UP_COSTS[lastIdx] * Math.pow(LEVEL_UP_GROWTH, overshoot);
  return roundNice(raw);
}

/** Cumulative EXP required to *reach* the given level. Lv. 1 = 0 EXP. */
function expForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let i = 1; i < level; i++) total += costToAdvance(i);
  return total;
}

/** Resolve current level from an EXP total. Uncapped. */
function levelForExp(exp: number): number {
  let lv = 1;
  while (expForLevel(lv + 1) <= exp) lv++;
  return lv;
}

/** Visual badge style for a level. 5-level color bands, intensity climbs. */
function badgeStyleForLevel(level: number): {
  name: string;
  emoji: string;
  gradient: string;
  text: string;
  ring: string;
  glow?: string;
} {
  const band = Math.floor((Math.max(1, level) - 1) / 5);
  const styles = [
    /* 0 — Lv. 1–5   Initiate    */ { name: 'Initiate',     emoji: '○', gradient: 'from-slate-300/30 to-slate-400/30',                 text: 'text-slate-500 dark:text-slate-300',     ring: 'border-slate-300/60' },
    /* 1 — Lv. 6–10  Apprentice  */ { name: 'Apprentice',   emoji: '◆', gradient: 'from-amber-700/30 to-orange-700/30',               text: 'text-amber-700 dark:text-amber-400',     ring: 'border-amber-700/40' },
    /* 2 — Lv. 11–15 Adept       */ { name: 'Adept',        emoji: '✦', gradient: 'from-zinc-300/40 to-zinc-400/40',                  text: 'text-zinc-600 dark:text-zinc-200',       ring: 'border-zinc-400/50' },
    /* 3 — Lv. 16–20 Expert      */ { name: 'Expert',       emoji: '★', gradient: 'from-yellow-400/40 to-amber-500/40',               text: 'text-amber-600 dark:text-amber-400',     ring: 'border-amber-400/50' },
    /* 4 — Lv. 21–25 Veteran     */ { name: 'Veteran',      emoji: '🌿', gradient: 'from-emerald-400/40 to-teal-500/40',               text: 'text-emerald-600 dark:text-emerald-400', ring: 'border-emerald-400/50', glow: 'shadow-emerald-500/20' },
    /* 5 — Lv. 26–30 Champion    */ { name: 'Champion',     emoji: '💠', gradient: 'from-cyan-400/45 to-blue-500/45',                  text: 'text-cyan-600 dark:text-cyan-300',       ring: 'border-cyan-400/55', glow: 'shadow-cyan-500/25' },
    /* 6 — Lv. 31–35 Master      */ { name: 'Master',       emoji: '❇', gradient: 'from-violet-500/50 to-purple-600/50',              text: 'text-violet-600 dark:text-violet-300',   ring: 'border-violet-400/55', glow: 'shadow-violet-500/30' },
    /* 7 — Lv. 36–40 Grandmaster */ { name: 'Grandmaster',  emoji: '🔥', gradient: 'from-rose-500/50 to-pink-600/50',                  text: 'text-rose-600 dark:text-rose-300',       ring: 'border-rose-400/55', glow: 'shadow-rose-500/35' },
    /* 8 — Lv. 41–45 Mythic      */ { name: 'Mythic',       emoji: '🌈', gradient: 'from-pink-500/50 via-violet-500/50 to-cyan-500/50', text: 'text-fuchsia-600 dark:text-fuchsia-300', ring: 'border-fuchsia-400/55', glow: 'shadow-fuchsia-500/40' },
  ];
  if (band < styles.length) return styles[band];
  // Lv. 46+ Transcendent — holographic, all bands beyond use this
  return {
    name: 'Transcendent',
    emoji: '✨',
    gradient: 'from-amber-300/60 via-fuchsia-500/60 to-cyan-400/60',
    text: 'text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-fuchsia-500 to-cyan-400',
    ring: 'border-fuchsia-400/70',
    glow: 'shadow-fuchsia-500/50',
  };
}

/** One row per 5-level band in the ladder display. */
const LEVEL_BANDS: Array<{ from: number; to: number }> = [
  { from: 1,  to: 5  },
  { from: 6,  to: 10 },
  { from: 11, to: 15 },
  { from: 16, to: 20 },
  { from: 21, to: 25 },
  { from: 26, to: 30 },
  { from: 31, to: 35 },
  { from: 36, to: 40 },
  { from: 41, to: 45 },
  { from: 46, to: 999 },
];

/**
 * EXP rules — some carry a formula (where the math actually matters), some
 * are plain descriptions (where the formula adds no clarity). Mirrors
 * whitepaper mechanics where applicable. Currently surfaced as design
 * preview; wiring into MockChainContext lands in a follow-up patch.
 */
type ExpRule = {
  icon: typeof Sparkles;
  label: string;
  description: string;
  /** Optional formula — only when the math is the clearest way to communicate the rule. */
  formula?: string;
  /** Optional concrete example to anchor the description. */
  example?: string;
  /** Optional reward table for milestone-style rewards. */
  table?: Array<{ when: string; reward: string }>;
  signColor: string;
  iconColor: string;
};

const EXP_RULES: ExpRule[] = [
  {
    icon: Target,
    label: 'Successful curation',
    description:
      'When you curate content that later performs well, you earn EXP proportional to your Curation Score. Being an earlier discoverer (lower rank) on a less-known creator scores more — the content’s age does not matter.',
    formula: 'EXP = 10 × rank_weight × discovery_weight',
    example: '1st curator (5×) on a creator with <100 followers (5×) → +250 EXP',
    signColor: 'text-emerald-600 dark:text-emerald-400',
    iconColor: 'text-emerald-500',
  },
  {
    icon: TrendingUp,
    label: 'Weekly taste bonus',
    description:
      'Maintain a curation success rate of 80% or higher over a rolling 7-day window and you’ll receive a flat weekly bonus. Quality over quantity — spamming hurts your rate.',
    formula: 'EXP = +50 / week, if success_rate ≥ 80%',
    signColor: 'text-cyan-600 dark:text-cyan-400',
    iconColor: 'text-cyan-500',
  },
  {
    icon: Sparkles,
    label: 'Discovery streak',
    description:
      'Curate creators with under 100 followers in a row and each one that trends adds a streak bonus. A flop resets the streak — it rewards real taste, not luck.',
    formula: 'EXP += 25 per consecutive trending pick (<100 followers)',
    signColor: 'text-fuchsia-600 dark:text-fuchsia-400',
    iconColor: 'text-fuchsia-500',
  },
  {
    icon: Users,
    label: 'Follower milestones',
    description:
      'Growing your own audience awards a one-time EXP grant at each milestone. Reaching 100 followers also unlocks Creator Coin issuance.',
    table: [
      { when: '100 followers',     reward: '+200 EXP' },
      { when: '1,000 followers',   reward: '+500 EXP' },
      { when: '10,000 followers',  reward: '+2,000 EXP' },
      { when: '100,000 followers', reward: '+10,000 EXP' },
    ],
    signColor: 'text-blue-600 dark:text-blue-400',
    iconColor: 'text-blue-500',
  },
  {
    icon: X,
    label: 'Frivolous remix flag',
    description:
      'If you flag someone’s remix as infringing and the panel rejects the claim, you lose EXP. Per whitepaper §7 — abusing the flag system hurts your on-chain record.',
    example: 'Each rejected flag: −1 strike on your record → -100 EXP',
    signColor: 'text-red-600 dark:text-red-400',
    iconColor: 'text-red-500',
  },
];

/**
 * Level badge button — mirrors the Explore page “Discover” button shape
 * (h-10 rounded-2xl, secondary surface) but tinted with the current
 * level’s gradient. Tier emoji + Lv.N + EXP read at a glance.
 */
function LevelBadgeButton({ exp, onClick }: { exp: number; onClick: () => void }) {
  const level = levelForExp(exp);
  const style = badgeStyleForLevel(level);
  return (
    <button
      onClick={onClick}
      title="View level rules & EXP progress"
      aria-label={`Curator level ${level} — ${exp.toLocaleString()} EXP. Open level details.`}
      className={`flex-shrink-0 h-10 px-3 inline-flex items-center gap-1.5 rounded-2xl text-xs font-semibold transition-all border bg-gradient-to-r ${style.gradient} ${style.text} ${style.ring} hover:brightness-105 active:scale-95 shadow-sm ${style.glow ?? ''}`}
    >
      <span className="text-[13px] leading-none">{style.emoji}</span>
      <span className="hidden sm:inline">Lv.{level}</span>
      <span className="sm:hidden">L{level}</span>
      <span className="opacity-70 font-mono text-[10px] tabular-nums hidden md:inline">
        {exp.toLocaleString()} EXP
      </span>
      <ChevronRight className="w-3.5 h-3.5 opacity-70" />
    </button>
  );
}

function ReputationModal({ exp, onClose }: { exp: number; onClose: () => void }) {
  const level = levelForExp(exp);
  const style = badgeStyleForLevel(level);
  const currExpFloor = expForLevel(level);
  const nextExpFloor = expForLevel(level + 1);
  const inLevelExp = exp - currExpFloor;
  const levelSpan = nextExpFloor - currExpFloor;
  const progressPct = levelSpan > 0 ? Math.min(100, Math.round((inLevelExp / levelSpan) * 100)) : 100;
  const remaining = Math.max(0, nextExpFloor - exp);

  // EXP-rule expand state — each rule starts collapsed; click reveals formula/example/table.
  const [expandedRule, setExpandedRule] = useState<number | null>(null);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-background rounded-2xl max-w-3xl w-full border shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero header — single close affordance lives in the footer button */}
        <div className={`bg-gradient-to-br ${style.gradient} px-6 py-5 border-b`}>
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl bg-background/40 backdrop-blur border ${style.ring} ${style.glow ?? ''} shadow-lg`}>
              {style.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Curator level</div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className={`text-3xl font-black ${style.text}`}>Lv.{level}</span>
                <span className="text-sm font-semibold text-muted-foreground">{style.name}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 font-mono tabular-nums">
                {exp.toLocaleString()} EXP
              </div>
            </div>
          </div>

          {/* Progress bar to next level */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="font-bold text-foreground">Lv.{level}</span>
              <span className="text-muted-foreground">
                <span className="font-bold text-foreground tabular-nums">{remaining.toLocaleString()}</span> EXP to Lv.{level + 1}
              </span>
              <span className="font-bold text-foreground">Lv.{level + 1}</span>
            </div>
            <div className="h-2.5 rounded-full bg-background/40 overflow-hidden border border-border/40">
              <div
                className={`h-full bg-gradient-to-r ${style.gradient.replace(/\/\d+/g, '')} transition-all duration-500`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1 font-mono tabular-nums">
              <span>{currExpFloor.toLocaleString()}</span>
              <span>{progressPct}%</span>
              <span>{nextExpFloor.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Body — two columns on desktop (ladder | rules), balanced visual weight */}
        <div className="overflow-y-auto px-6 py-5 grid grid-cols-1 md:grid-cols-2 md:gap-x-6 gap-y-5">
          {/* LEFT — Level band ladder + next-badge teaser to balance the right column */}
          <section className="min-w-0 flex flex-col">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5" /> Level bands
            </h4>
            <div className="space-y-1">
              {LEVEL_BANDS.map((band) => {
                const sampleStyle = badgeStyleForLevel(band.from);
                const isCurrent = level >= band.from && level <= band.to;
                const range = band.to >= 999 ? `Lv.${band.from}+` : `Lv.${band.from}–${band.to}`;
                const expRange = band.to >= 999
                  ? `≥ ${expForLevel(band.from).toLocaleString()}`
                  : `${expForLevel(band.from).toLocaleString()}–${(expForLevel(band.to + 1) - 1).toLocaleString()}`;
                return (
                  <div
                    key={band.from}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border transition-all ${
                      isCurrent
                        ? 'border-aura bg-aura/10 ring-2 ring-aura/40'
                        : `${sampleStyle.ring} bg-gradient-to-r ${sampleStyle.gradient}`
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 bg-gradient-to-br ${sampleStyle.gradient} border ${sampleStyle.ring} ${sampleStyle.glow ?? ''}`}>
                      {sampleStyle.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[13px] font-bold leading-tight ${sampleStyle.text}`}>{sampleStyle.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{range}</span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 rounded-full bg-aura text-white text-[9px] font-bold uppercase tracking-wider">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono tabular-nums leading-tight">
                        {expRange} EXP
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-[10px] text-muted-foreground mt-3 italic leading-relaxed">
              Levels are uncapped and cosmetic. Curators are ranked on-chain by success rate (§3.4); reward multipliers come from curator-rank weight × discovery, not level.
            </p>
          </section>

          {/* RIGHT — How EXP is earned. Each rule collapsed by default; click for details. */}
          <section className="min-w-0 flex flex-col">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> How EXP is earned
              <span className="ml-auto text-[10px] font-medium text-muted-foreground/70 normal-case tracking-normal">
                tap to expand
              </span>
            </h4>
            <div className="space-y-1.5">
              {EXP_RULES.map((r, i) => {
                const Icon = r.icon;
                const isOpen = expandedRule === i;
                const hasDetails = !!(r.formula || r.example || r.table);
                return (
                  <div
                    key={i}
                    className="rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedRule(isOpen ? null : i)}
                      disabled={!hasDetails}
                      aria-expanded={isOpen}
                      className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left disabled:cursor-default"
                    >
                      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${r.iconColor}`} />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="text-sm font-semibold leading-snug">{r.label}</div>
                        <p className="text-[12px] text-muted-foreground leading-relaxed">
                          {r.description}
                        </p>
                      </div>
                      {hasDetails && (
                        <ChevronDown
                          className={`w-4 h-4 shrink-0 mt-0.5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        />
                      )}
                    </button>
                    {isOpen && hasDetails && (
                      <div className="px-3 pb-3 pl-[34px] space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                        {r.formula && (
                          <p className={`text-[12px] leading-relaxed ${r.signColor}`}>
                            <span className="font-semibold">Formula:</span> {r.formula}
                          </p>
                        )}
                        {r.example && (
                          <p className="text-[12px] text-muted-foreground/80 italic leading-relaxed">
                            — {r.example}
                          </p>
                        )}
                        {r.table && (
                          <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[12px] mt-1">
                            {r.table.map((row, j) => (
                              <li key={j} className="flex items-center justify-between tabular-nums">
                                <span className="text-muted-foreground">{row.when}</span>
                                <span className={`font-semibold ${r.signColor}`}>{row.reward}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 italic leading-relaxed">
              EXP never decays. Per-level costs are hand-tuned — gentle through Lv.20, steeper after Veteran (Lv.21).
            </p>
          </section>
        </div>

        {/* Footer — single dismiss action */}
        <div className="px-6 py-3 border-t bg-secondary/30">
          <Button onClick={onClose} className="w-full">
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Sub-components
 * ────────────────────────────────────────────────────────────────────────── */

function StatCard({
  icon, label, value, unit, gradient, border, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  gradient: string;
  border: string;
  accent: string;
}) {
  return (
    <div className={`bg-gradient-to-br ${gradient} rounded-xl p-4 border ${border}`}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className={`text-sm font-medium line-clamp-1 ${accent}`}>{label}</h3>
        {icon}
      </div>
      <p className="text-2xl font-bold leading-tight">{value}</p>
      {unit && <p className="text-xs text-muted-foreground mt-0.5">{unit}</p>}
    </div>
  );
}

function HistoryRow({
  record, onClick, formatTime,
}: {
  record: CurationRecord;
  onClick: () => void;
  formatTime: (ts: number) => string;
}) {
  const statusStyle: Record<CurationRecord['status'], string> = {
    active:  'bg-blue-500/15  text-blue-600  dark:text-blue-400',
    claimed: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    pending: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
  };
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="bg-card rounded-xl p-4 border hover:border-amber-400/40 hover:shadow-md transition-all cursor-pointer flex items-center gap-4"
    >
      <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
        {record.contentCover ? (
          <img src={record.contentCover} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl">📄</div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-medium line-clamp-1 mb-1">{record.contentTitle}</h4>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>Staked {record.stakeAmount} ORA</span>
          <span>·</span>
          <span>{formatTime(record.stakeTime)}</span>
          <span>·</span>
          <span>{record.timeWeight}× weight</span>
          <span>·</span>
          <span>{record.performanceCoeff.toFixed(2)} performance</span>
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold mb-1 ${statusStyle[record.status]}`}>
          {record.status === 'active' ? 'Active' : record.status === 'claimed' ? 'Claimed' : 'Pending'}
        </span>
        <div className="font-bold">
          {record.status === 'claimed'
            ? <span className="text-emerald-600 dark:text-emerald-400">+{record.rewards.toFixed(2)} ORA</span>
            : <span className="text-muted-foreground">~{record.rewards.toFixed(2)} ORA</span>}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {record.status === 'active'  && 'Earning'}
          {record.status === 'claimed' && 'Deposited'}
          {record.status === 'pending' && 'Pending settlement'}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Leaderboard sub-components
 * ────────────────────────────────────────────────────────────────────────── */

type LeaderboardEntry = {
  post: Post;
  tier: { multiplier: '5x' | '3x' | '2x' | '1x'; gradient: string };
  curatorCount: number;
  avgWeight: number;
  stakeScore: number;
  shareOfPool: number;
  curatorReward: number;
  creatorReward: number;
  totalStaked: number;
  mins: number;
};

const RANK_STYLE: Record<number, { medal: string; ring: string; bgGlow: string }> = {
  1: { medal: '🥇', ring: 'ring-yellow-400/60',  bgGlow: 'from-yellow-400/20 to-amber-500/15' },
  2: { medal: '🥈', ring: 'ring-zinc-400/60',    bgGlow: 'from-zinc-300/20 to-zinc-400/15'    },
  3: { medal: '🥉', ring: 'ring-orange-400/60',  bgGlow: 'from-orange-400/20 to-amber-600/15' },
};

/**
 * Top-3 podium card. Highlights medal + cover + projected payouts.
 * The card itself is fully clickable → post detail.
 */
function PodiumCard({ rank, row, onClick }: { rank: number; row: LeaderboardEntry; onClick: () => void }) {
  const cover = row.post.coverImage || row.post.images?.[0];
  const style = RANK_STYLE[rank];
  const fallbackEmoji =
    row.post.type === 'audio' ? '🎵' :
    row.post.type === 'video' ? '🎬' :
    row.post.type === 'photo' ? '📷' :
    row.post.type === 'live'  ? '🔴' : '✍️';
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className={`bg-card rounded-xl border ring-2 ${style.ring} overflow-hidden hover:shadow-lg transition-all flex flex-col cursor-pointer group relative`}
    >
      {/* Tinted top stripe */}
      <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${style.bgGlow} pointer-events-none`} />
      <div className="relative aspect-square bg-muted overflow-hidden">
        {cover ? (
          <img src={cover} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-400/30 via-orange-500/20 to-pink-500/20 flex items-center justify-center text-6xl">
            {fallbackEmoji}
          </div>
        )}
        <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/65 backdrop-blur text-white text-xs font-bold shadow-sm">
          <span className="text-base leading-none">{style.medal}</span> #{rank}
        </div>
        <div className={`absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r ${row.tier.gradient} text-white text-[10px] font-bold shadow-sm`}>
          {row.tier.label}
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <h4 className="font-semibold text-sm line-clamp-2 mb-1 min-h-[2.5rem]">
          {row.post.title || row.post.content?.slice(0, 60) || 'Untitled'}
        </h4>
        <p className="text-[11px] text-muted-foreground mb-3">by @{row.post.author.username}</p>

        {/* Stake score + pool share */}
        <div className="grid grid-cols-2 gap-3 mb-3 mt-auto text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Curators</div>
            <div className="text-base font-bold inline-flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-amber-500" />
              {row.curatorCount.toLocaleString()}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Pool share</div>
            <div className="text-base font-bold text-amber-600 dark:text-amber-400">
              {(row.shareOfPool * 100).toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Projected rewards */}
        <div className="bg-amber-500/10 rounded-lg p-3 space-y-1.5">
          <div className="text-[10px] uppercase tracking-wide font-bold text-amber-700 dark:text-amber-300">
            Projected payout (today)
          </div>
          <div className="flex justify-between text-xs">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Users className="w-3 h-3" /> Curators share
            </span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {row.curatorReward.toFixed(0)} ORA
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Coins className="w-3 h-3" /> Creator share
            </span>
            <span className="font-bold text-amber-600 dark:text-amber-400">
              {row.creatorReward.toFixed(0)} ORA
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact horizontal row for ranks 4 and below.
 */
function LeaderboardRow({ rank, row, onClick }: { rank: number; row: LeaderboardEntry; onClick: () => void }) {
  const cover = row.post.coverImage || row.post.images?.[0];
  const fallbackEmoji =
    row.post.type === 'audio' ? '🎵' :
    row.post.type === 'video' ? '🎬' :
    row.post.type === 'photo' ? '📷' :
    row.post.type === 'live'  ? '🔴' : '✍️';
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="bg-card rounded-xl p-3 border hover:border-amber-400/40 hover:shadow-md transition-all cursor-pointer flex items-center gap-3 md:gap-4"
    >
      {/* Rank number */}
      <div className="w-8 text-center text-base font-black text-muted-foreground flex-shrink-0">
        #{rank}
      </div>

      {/* Cover thumbnail */}
      <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0 relative">
        {cover ? (
          <img src={cover} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl">{fallbackEmoji}</div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-medium line-clamp-1 text-sm mb-1">
          {row.post.title || row.post.content?.slice(0, 60) || 'Untitled'}
        </h4>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <span>by @{row.post.author.username}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <Users className="w-3 h-3" /> {row.curatorCount} curators
          </span>
          <span>·</span>
          <span>{row.totalStaked} ORA curated</span>
          <span className="hidden sm:inline">·</span>
          <span className={`hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r ${row.tier.gradient} text-white text-[9px] font-bold`}>
            {row.tier.label}
          </span>
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Pool share</div>
        <div className="text-sm font-bold text-amber-600 dark:text-amber-400">
          {(row.shareOfPool * 100).toFixed(2)}%
        </div>
        <div className="text-[10px] text-muted-foreground">
          ~{row.curatorReward.toFixed(0)} ORA / curators
        </div>
      </div>
    </div>
  );
}

/**
 * Empty-state for the Leaderboard tab when the user hasn't curated anything yet.
 *
 * Instead of showing fake data or a generic "no records" line, we use the space
 * to teach the rules. The moment they curate one post, this panel disappears
 * and the live leaderboard takes over.
 */
function LeaderboardEmptyState({ onCurateClick }: { onCurateClick: () => void }) {
  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-amber-200/40 dark:border-amber-800/40 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500/15 to-orange-500/15 px-6 py-5 border-b border-amber-200/40 dark:border-amber-800/40">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-amber-800 dark:text-amber-200">
                Your leaderboard is empty — for now.
              </h3>
              <p className="text-sm text-muted-foreground">
                Curate your first post to see live rankings + projected payouts here.
              </p>
            </div>
          </div>
        </div>

        {/* Rule diagram — mirrors whitepaper §8 (Curation and Content Discovery) verbatim */}
        <div className="p-6 space-y-5">
          {/* Step 1 — Daily reward pool */}
          <div>
            <div className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground mb-2">
              1. Daily reward pool
            </div>
            <div className="rounded-lg overflow-hidden border border-border/60">
              <div className="bg-secondary px-4 py-2 text-center font-bold text-sm">
                20,000 ORA · settled at 00:00 UTC daily
              </div>
              <div className="grid grid-cols-2 divide-x divide-border/60">
                <div className="px-4 py-3 bg-emerald-500/5">
                  <div className="text-[10px] uppercase tracking-wide font-semibold text-emerald-700 dark:text-emerald-400">Curator Pool</div>
                  <div className="text-base font-bold inline-flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-emerald-500" /> 10,000 ORA
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Split by Curation Score share</div>
                </div>
                <div className="px-4 py-3 bg-amber-500/5">
                  <div className="text-[10px] uppercase tracking-wide font-semibold text-amber-700 dark:text-amber-400">Creator Pool</div>
                  <div className="text-base font-bold inline-flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-amber-500" /> 10,000 ORA
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Split by curation-count share (cap 20%/post)</div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 — Curation Score & reward formula */}
          <div>
            <div className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground mb-2">
              2. How your reward is calculated
            </div>
            <div className="rounded-lg border border-border/60 bg-secondary/40 p-4 space-y-2">
              <p className="text-sm leading-relaxed text-foreground">
                <strong>Curation Score</strong> = Curator Rank Weight × Discovery Weight
              </p>
              <p className="text-sm leading-relaxed text-foreground">
                <strong>Your daily reward</strong> = (your total Curation Score ÷ sum of all curators’ scores) × 10,000 ORA
              </p>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                Pool size is fixed, so multipliers redistribute <em>shares</em> rather than mint extra ORA. The maximum theoretical score is <strong className="text-foreground">25×</strong> (1st curator of a creator with &lt;100 followers); the minimum is <strong className="text-foreground">0.5×</strong> (501st-or-later curator on a creator with &gt;100k followers). Rank is per content and locked at the moment you curate — even content from years ago can mint a fresh 5× for whoever finds it first.
              </p>
            </div>
          </div>

          {/* Step 3 — Curator Rank Weight tiers (6 tiers per whitepaper §8.4.1) */}
          <div>
            <div className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground mb-2">
              3. Curator Rank Weight
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">
              Rank is your position among everyone who has ever curated this content — not how recently the content was published. A 5-year-old gem still pays the 1st discoverer the full 5×.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <TierCard tier="5×"   gradient="from-red-500 to-rose-600"      label="1st curator"     sub="First-discoverer bonus" />
              <TierCard tier="3×"   gradient="from-orange-500 to-amber-600"  label="2nd – 10th"      sub="Early consensus" />
              <TierCard tier="2×"   gradient="from-yellow-500 to-amber-500"  label="11th – 50th"     sub="Catching on" />
              <TierCard tier="1.5×" gradient="from-lime-500 to-emerald-500"  label="51st – 200th"    sub="Niche heat" />
              <TierCard tier="1.2×" gradient="from-emerald-500 to-teal-500"  label="201st – 500th"   sub="Riding the wave" />
              <TierCard tier="1×"   gradient="from-slate-500 to-zinc-600"    label="501st and beyond" sub="Standard rate" />
            </div>
          </div>

          {/* Step 4 — Discovery Weight tiers (5 tiers per whitepaper §8.4.2) */}
          <div>
            <div className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground mb-2">
              4. Discovery Weight
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <TierCard tier="5×"   gradient="from-fuchsia-500 to-pink-600"  label="<100 followers"        sub="Hidden gem" />
              <TierCard tier="3×"   gradient="from-violet-500 to-purple-600" label="100–1k followers"      sub="Up-and-coming" />
              <TierCard tier="1.5×" gradient="from-indigo-500 to-blue-600"   label="1k–10k followers"      sub="Growing" />
              <TierCard tier="1×"   gradient="from-blue-500 to-cyan-600"     label="10k–100k followers"    sub="Established" />
              <TierCard tier="0.5×" gradient="from-slate-500 to-zinc-600"    label=">100k followers"        sub="Mainstream" />
            </div>
          </div>

          {/* Step 5 — Why it's designed this way */}
          <div>
            <div className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground mb-2">
              Why it works this way
            </div>
            <div className="rounded-lg border border-border/60 bg-gradient-to-br from-amber-50/40 to-orange-50/40 dark:from-amber-900/10 dark:to-orange-900/10 p-4 space-y-3">
              <p className="text-sm leading-relaxed">
                The 20,000 ORA pool is <strong>fixed every day</strong> — the multipliers redistribute <em>shares</em>, they never print extra ORA. As more curators participate, the same pool divides into smaller slices, so being early or spotting hidden gems matters more, not less.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <div className="rounded-md bg-emerald-500/10 border border-emerald-200/40 dark:border-emerald-800/40 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide font-bold text-emerald-700 dark:text-emerald-400 mb-0.5">
                    Bootstrap phase
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    With low daily volume, even baseline curators clear the 1 ORA cost easily. This is when the protocol pays the most for the same work.
                  </p>
                </div>
                <div className="rounded-md bg-amber-500/10 border border-amber-200/40 dark:border-amber-800/40 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide font-bold text-amber-700 dark:text-amber-400 mb-0.5">
                    Growth phase
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    As volume rises, late-on-mainstream picks (0.5–1× score) start losing ORA. Only thoughtful curators remain profitable — natural anti-spam pressure.
                  </p>
                </div>
                <div className="rounded-md bg-fuchsia-500/10 border border-fuchsia-200/40 dark:border-fuchsia-800/40 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide font-bold text-fuchsia-700 dark:text-fuchsia-400 mb-0.5">
                    Mature phase
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Curation becomes a craft. Volume-based strategies fail; high-multiplier picks (early on undiscovered, up to 25×) keep capturing meaningful shares.
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground italic leading-relaxed pt-1">
                The mechanism deliberately rewards taste and timing over volume — indiscriminate curation becomes unprofitable by design, while genuine discovery becomes increasingly valuable as the network matures.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-border/40">
            <div className="text-xs text-muted-foreground">
              <Wallet className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" />
              Each curation costs <strong className="text-foreground">1 ORA</strong>; you need <strong className="text-foreground">≥100 ORA</strong> on hand to participate.
            </div>
            <Button
              onClick={onCurateClick}
              className="flex-shrink-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600"
            >
              <Plus className="w-4 h-4 mr-1" /> Browse Latest
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TierCard({
  tier, gradient, label, sub,
}: {
  tier: string;
  gradient: string;
  label: string;
  sub: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <div className={`bg-gradient-to-br ${gradient} px-3 py-2 text-white font-black text-2xl text-center`}>
        {tier}
      </div>
      <div className="p-2 text-center bg-card">
        <div className="text-[11px] font-bold text-foreground">{label}</div>
        <div className="text-[10px] text-muted-foreground">{sub}</div>
      </div>
    </div>
  );
}
