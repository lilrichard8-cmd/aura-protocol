import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Eye, Heart, Coins, UserPlus, Check, Compass } from 'lucide-react';
import FeedCard from '@/components/cards/FeedCard';
import { useMockChain } from '@/context/MockChainContext';
import { useAuth } from '@/context/AuthContext';
import {
  useExploreLeaderboards,
  EXPLORE_CATEGORY_META,
  type ExploreCategory,
  type CreatorRanking,
  type PostRanking,
} from '@/hooks/useExploreLeaderboards';
import type { User } from '@/types';

/**
 * Full leaderboard view for a single Explore category.
 *
 * Routes: /explore/:category where :category ∈
 *   active | new | viewed | engaged | traded
 *
 * Layout:
 *   • Sticky header with back button, emoji + title, total count.
 *   • Honesty banner for synthetic metrics (top viewed/traded).
 *   • Body:
 *      - active/new creators → responsive grid of creator cards
 *      - posts (viewed/engaged/traded) → feed masonry of FeedCards with
 *        rank badges overlaid in the top-left corner
 */
export default function ExploreLeaderboardPage() {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();
  const mockChain = useMockChain();
  const { user: me } = useAuth();
  const data = useExploreLeaderboards();

  // Validate category param — bounce to /explore on unknown values.
  const validCategories: ExploreCategory[] = ['active', 'new', 'viewed', 'engaged', 'traded'];
  if (!category || !validCategories.includes(category as ExploreCategory)) {
    return <Navigate to="/explore" replace />;
  }
  const cat = category as ExploreCategory;
  const meta = EXPLORE_CATEGORY_META[cat];

  // Decide what's rendered.
  const counts = {
    active:  data.activeCreators.length,
    new:     data.newCreators.length,
    viewed:  data.topViewed.length,
    engaged: data.topEngaged.length,
    traded:  data.topTraded.length,
  };
  const total = counts[cat];

  const toggleFollow = (userId: string) => {
    if (mockChain.followingIds.includes(userId)) {
      mockChain.unfollowUser?.(userId);
    } else {
      mockChain.followUser?.(userId);
    }
  };

  // ── Sub-renderers ────────────────────────────────────────────────────────
  const renderCreatorCard = (
    user: User,
    postCount: number,
    rank: number,
    opts: { showNewBadge?: boolean } = {},
  ) => {
    const isFollowing = mockChain.followingIds.includes(user.id);
    const isMe = me?.id === user.id;
    return (
      <div
        key={user.id}
        className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col items-center gap-2 hover:border-aura/40 hover:shadow-sm transition-all"
      >
        <div className="absolute" />
        <Link
          // Public profile route — added 2026-05-10. Earlier this page just
          // bounced everything to /profile (own profile) because there was
          // no per-user URL.
          to={`/u/${user.username}`}
          className="relative group"
          title={`Open @${user.username}`}
        >
          <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-aura text-white text-[11px] font-bold flex items-center justify-center shadow-sm border-2 border-background z-20">
            #{rank}
          </div>
          <div className="w-[80px] h-[80px] rounded-full p-[2px] bg-gradient-to-tr from-aura via-cyan-400 to-purple-500 group-hover:rotate-6 transition-transform duration-500">
            <img
              src={user.avatar}
              alt={user.displayName}
              className="w-full h-full rounded-full object-cover border-2 border-background"
            />
          </div>
          {user.creatorCoin && (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-ora text-white text-[10px] font-bold border-2 border-background shadow-sm whitespace-nowrap z-10">
              {user.creatorCoin.symbol}
            </div>
          )}
          {opts.showNewBadge && (
            <div className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-bold border-2 border-background shadow-sm">
              NEW
            </div>
          )}
        </Link>
        <div className="text-center mt-2">
          <div className="text-sm font-bold line-clamp-1 text-foreground">{user.displayName}</div>
          <div className="text-[11px] text-muted-foreground">@{user.username}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {postCount} post{postCount === 1 ? '' : 's'}
          </div>
        </div>
        {!isMe && (
          <button
            onClick={() => toggleFollow(user.id)}
            className={`mt-1 w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
              isFollowing
                ? 'bg-secondary text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                : 'bg-aura text-white hover:opacity-90'
            }`}
          >
            {isFollowing ? (<><Check className="w-3.5 h-3.5" /> Following</>) : (<><UserPlus className="w-3.5 h-3.5" /> Follow</>)}
          </button>
        )}
      </div>
    );
  };

  const formatCompact = (n: number) =>
    Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.round(n));

  const honestyNote = (() => {
    if (cat === 'viewed') return 'Synthetic metric: combines live viewer count with weighted likes/comments/shares until a true view counter ships.';
    if (cat === 'traded') return 'Synthetic metric: ranks premium-locked posts by unlock price weighted by interest until on-chain sales counts are wired up.';
    return null;
  })();

  return (
    <div className="pt-[60px] md:pt-2 pb-24 md:pb-4 min-h-screen">
      {/* Sticky header */}
      <div className="sticky top-[60px] md:top-0 z-30 bg-background/95 backdrop-blur border-b border-border/40 px-4 md:px-6 py-3">
        <div className="flex items-center gap-3 max-w-5xl">
          <button
            onClick={() => navigate(-1)}
            className="flex-shrink-0 w-9 h-9 rounded-full hover:bg-secondary inline-flex items-center justify-center transition-colors"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-lg leading-none">{meta.emoji}</span>
              <h1 className="text-base md:text-lg font-bold text-foreground line-clamp-1">{meta.title}</h1>
            </div>
            <div className="text-[11px] text-muted-foreground line-clamp-1">
              {meta.meta} · {total.toLocaleString()} {(cat === 'active' || cat === 'new') ? 'creator' : 'post'}{total === 1 ? '' : 's'}
            </div>
          </div>
          <Link
            to="/explore"
            className="hidden md:inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-secondary/60 hover:bg-secondary text-xs font-semibold text-foreground transition-colors"
          >
            All categories
          </Link>
        </div>
      </div>

      {/* Honesty banner for synthetic metrics */}
      {honestyNote && (
        <div className="mx-4 md:mx-6 mt-4 mb-2 rounded-xl border border-amber-200/60 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-200">
          ℹ︎ {honestyNote}
        </div>
      )}

      {/* Body */}
      <div className="px-4 md:px-6 pt-4">
        {/* ACTIVE / NEW CREATORS — responsive grid */}
        {(cat === 'active' || cat === 'new') && (() => {
          const list: CreatorRanking[] = cat === 'active' ? data.activeCreators : data.newCreators;
          if (list.length === 0) return <Empty />;
          return (
            <div className="relative grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
              {list.map(({ user, postCount }, i) => (
                <div key={user.id} className="relative">
                  {renderCreatorCard(user, postCount, i + 1, { showNewBadge: cat === 'new' })}
                </div>
              ))}
            </div>
          );
        })()}

        {/* POST LEADERBOARDS (viewed/engaged/traded) — masonry of FeedCard with rank overlay */}
        {(cat === 'viewed' || cat === 'engaged' || cat === 'traded') && (() => {
          const list: PostRanking[] =
            cat === 'viewed'  ? data.topViewed
            : cat === 'engaged' ? data.topEngaged
            : data.topTraded;
          if (list.length === 0) return <Empty />;

          const Icon = cat === 'viewed' ? Eye : cat === 'engaged' ? Heart : Coins;
          const formatMetric = (entry: PostRanking) => {
            if (cat === 'traded') return `${(entry.unitPrice ?? 0).toLocaleString()} ORA`;
            return formatCompact(entry.score);
          };

          return (
            <div className="feed-masonry px-[2px]">
              {list.map((entry, i) => (
                <div key={entry.post.id} className="feed-masonry-item relative">
                  {/* rank badge — top-left, sits above FeedCard */}
                  <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/70 backdrop-blur text-white text-[11px] font-bold shadow-sm">
                    #{i + 1}
                  </div>
                  {/* metric badge — top-right */}
                  <div className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-aura/95 text-white text-[11px] font-bold shadow-sm">
                    <Icon className="w-3 h-3" /> {formatMetric(entry)}
                  </div>
                  <FeedCard post={entry.post} />
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-6">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-aura/20 to-cyan-400/20 flex items-center justify-center mb-4">
        <Compass className="w-7 h-7 text-aura" />
      </div>
      <h2 className="text-base font-bold mb-2">No data yet</h2>
      <p className="text-sm text-muted-foreground max-w-xs mb-4">
        Once creators start publishing, this leaderboard will fill up.
      </p>
      <Link
        to="/explore"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-aura text-white text-sm font-bold hover:opacity-90 transition"
      >
        Back to Explore
      </Link>
    </div>
  );
}
