import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, X, UserPlus, Check, Compass,
  ChevronDown, ChevronUp, ChevronRight, Sparkles, Eye, Heart, Coins,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import FeedCard from '@/components/cards/FeedCard';
import { posts, adPosts, categories } from '@/data/mock';
import { useUserPosts } from '@/hooks/useUserPosts';
import { useI18n } from '@/context/I18nContext';
import { useMockChain } from '@/context/MockChainContext';
import { useAuth } from '@/context/AuthContext';
import {
  useExploreLeaderboards,
  EXPLORE_CATEGORY_META,
  type CreatorRanking,
  type PostRanking,
} from '@/hooks/useExploreLeaderboards';
import type { Post, User } from '@/types';

/**
 * Explore — discovery surface for the protocol.
 *
 * Layout philosophy (matches HomePage refactor):
 *   • No decorative mock users, no hard-coded trending strings.
 *   • Top discovery panel is collapsed by default (search bar only).
 *   • Click "Discover" → all six leaderboards render at once, each as a
 *     horizontal scroll of preview cards.
 *   • Click a section title → dedicated full-ranking page at /explore/:cat.
 *
 * Honesty notes (echoed in useExploreLeaderboards.ts):
 *   • "Top Viewed" uses likes/comments as a stand-in for views until a real
 *     view counter ships.
 *   • "Top Traded" ranks `isPremium` posts by premium price weighted by
 *     interest, until on-chain sales counts are available.
 */

const DISCOVERY_OPEN_KEY = 'aura.exploreDiscoveryOpen';
const PREVIEW_LIMIT = 8;

export default function ExplorePage() {
  const { t } = useI18n();
  const mockChain = useMockChain();
  const { user: me } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Discovery panel: collapsed by default, persisted in localStorage.
  const [discoveryOpen, setDiscoveryOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(DISCOVERY_OPEN_KEY) === '1';
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(DISCOVERY_OPEN_KEY, discoveryOpen ? '1' : '0');
  }, [discoveryOpen]);

  // Pull every leaderboard once, slice for previews.
  const {
    activeCreators,
    newCreators,
    topViewed,
    topEngaged,
    topTraded,
  } = useExploreLeaderboards();

  // ── Sort + filter the feed ───────────────────────────────────────────────
  // User-published posts (localStorage) merged AHEAD of seed posts so
  // freshly-created content shows up at the top of Explore.
  const myPublishedPosts = useUserPosts(me as any);

  const filteredPosts: Post[] = useMemo(() => {
    // Merge user-published posts in front of seed posts. They sort
    // newest-first inside `myPublishedPosts` already.
    const merged: Post[] = [...myPublishedPosts, ...posts];
    const sorted = [...merged].sort((a, b) => {
      const sa = (a.isCurated ? 2 : 0) + (a.isBoosted ? 1 : 0);
      const sb = (b.isCurated ? 2 : 0) + (b.isBoosted ? 1 : 0);
      return sb - sa;
    });
    const q = searchQuery.trim().toLowerCase();
    return sorted.filter(post => {
      const matchesSearch = q === '' ||
        post.title?.toLowerCase().includes(q) ||
        post.content?.toLowerCase().includes(q) ||
        post.author.displayName.toLowerCase().includes(q) ||
        post.author.username.toLowerCase().includes(q) ||
        post.tags.some(tag => tag.toLowerCase().includes(q));

      const matchesCategory = activeCategory === 'all' ||
        (activeCategory === 'live' && post.type === 'live') ||
        (activeCategory === 'photography' && post.type === 'photo') ||
        (activeCategory === 'video' && post.type === 'video') ||
        (activeCategory === 'text' && post.type === 'text') ||
        (activeCategory === 'music' && (post.type === 'audio' || post.tags.includes('music'))) ||
        (activeCategory === 'illustration' && post.tags.some(tag => ['illustration', 'digital-art'].includes(tag)));

      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory, myPublishedPosts]);

  // ── Follow toggle (real mockChain action) ────────────────────────────────
  const toggleFollow = (userId: string) => {
    if (mockChain.followingIds.includes(userId)) {
      mockChain.unfollowUser?.(userId);
    } else {
      mockChain.followUser?.(userId);
    }
  };

  // ── Local renderers (shared with leaderboard page would inflate cost; the
  //    leaderboard page has its own grid renderers tuned for full lists) ────
  const renderCreatorCard = (
    user: User,
    postCount: number,
    opts: { showNewBadge?: boolean } = {},
  ) => {
    const isFollowing = mockChain.followingIds.includes(user.id);
    const isMe = me?.id === user.id;
    return (
      <div
        key={user.id}
        className="flex-shrink-0 w-[148px] rounded-2xl border border-border/60 bg-card p-3 flex flex-col items-center gap-2 hover:border-aura/40 hover:shadow-sm transition-all"
      >
        <button
          onClick={() => setSearchQuery(user.username)}
          className="relative group"
          title={`Filter feed by @${user.username}`}
        >
          <div className="w-[60px] h-[60px] rounded-full p-[2px] bg-gradient-to-tr from-aura via-cyan-400 to-purple-500 group-hover:rotate-6 transition-transform duration-500">
            <img
              src={user.avatar}
              alt={user.displayName}
              className="w-full h-full rounded-full object-cover border-2 border-background"
            />
          </div>
          {user.creatorCoin && (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-ora text-white text-[9px] font-bold border-2 border-background shadow-sm whitespace-nowrap z-10">
              {user.creatorCoin.symbol}
            </div>
          )}
          {opts.showNewBadge && (
            <div className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[8px] font-bold border-2 border-background shadow-sm">
              NEW
            </div>
          )}
        </button>
        <div className="text-center mt-1">
          <div className="text-[12px] font-bold line-clamp-1 text-foreground">{user.displayName}</div>
          <div className="text-[10px] text-muted-foreground">{postCount} post{postCount === 1 ? '' : 's'}</div>
        </div>
        {!isMe && (
          <button
            onClick={() => toggleFollow(user.id)}
            className={`mt-1 w-full inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
              isFollowing
                ? 'bg-secondary text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                : 'bg-aura text-white hover:opacity-90'
            }`}
          >
            {isFollowing ? (<><Check className="w-3 h-3" /> Following</>) : (<><UserPlus className="w-3 h-3" /> Follow</>)}
          </button>
        )}
      </div>
    );
  };

  const renderPostMiniCard = (
    post: Post,
    rank: number,
    metric: number,
    opts: { Icon: typeof Eye; format: (n: number) => string },
  ) => {
    const cover = post.coverImage || post.images?.[0];
    const fallbackEmoji = post.type === 'audio' ? '🎵' : post.type === 'video' ? '🎬' : post.type === 'photo' ? '📷' : '✍️';
    const Icon = opts.Icon;
    return (
      <Link
        key={post.id}
        to={`/post/${post.id}`}
        className="flex-shrink-0 w-[170px] rounded-2xl border border-border/60 bg-card overflow-hidden hover:border-aura/40 hover:shadow-md transition-all group"
      >
        <div className="relative aspect-square bg-muted overflow-hidden">
          {cover ? (
            <img
              src={cover}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl bg-gradient-to-br from-aura/10 to-purple-500/10">
              {fallbackEmoji}
            </div>
          )}
          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur text-white text-[10px] font-bold">
            #{rank}
          </div>
          <div className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-aura/95 text-white text-[10px] font-bold shadow-sm">
            <Icon className="w-3 h-3" /> {opts.format(metric)}
          </div>
        </div>
        <div className="p-2.5">
          <div className="text-xs font-semibold line-clamp-2 text-foreground leading-tight mb-1 min-h-[28px]">
            {post.title || post.content?.slice(0, 60) || 'Untitled'}
          </div>
          <div className="text-[10px] text-muted-foreground line-clamp-1">@{post.author.username}</div>
        </div>
      </Link>
    );
  };

  // Reusable horizontal scroll wrapper.
  const HorizontalScroll = ({ children }: { children: ReactNode }) => (
    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
      {children}
    </div>
  );

  return (
    // Outer shell mirrors HomePage exactly: full-width, pt-[60px] on mobile to
    // clear the floating header, no max-w cap, no explicit bg (inherits app bg).
    <div className="pt-[60px] md:pt-2 pb-24 md:pb-4 min-h-screen">
      {/* Top controls: search bar (always visible) + collapsible Discover panel.
          Left-aligned flush against the sidebar to match the masonry below. */}
      <div className="px-4 md:px-6">
        {/* Search row + Discover toggle */}
        <div className="pt-3 md:pt-4 mb-4 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t.explore.searchPlaceholder}
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
          <button
            onClick={() => setDiscoveryOpen(o => !o)}
            className={`flex-shrink-0 h-10 px-3 inline-flex items-center gap-1.5 rounded-2xl text-xs font-semibold transition-all border ${
              discoveryOpen
                ? 'bg-aura text-white border-aura shadow-sm'
                : 'bg-secondary/50 text-foreground border-transparent hover:bg-secondary'
            }`}
            aria-expanded={discoveryOpen}
            aria-controls="explore-discovery-panel"
            aria-label={discoveryOpen ? 'Hide discovery panel' : 'Show discovery panel'}
            title={discoveryOpen ? 'Hide discovery' : 'Discover trends, creators, and top posts'}
          >
            <Sparkles className={`w-3.5 h-3.5 ${discoveryOpen ? '' : 'text-aura'}`} />
            <span className="hidden sm:inline">Discover</span>
            {discoveryOpen
              ? <ChevronUp className="w-3.5 h-3.5" />
              : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Discovery panel — every section as horizontal card row */}
        {discoveryOpen && (
          <div
            id="explore-discovery-panel"
            className="mb-6 rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-4 space-y-6 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            {/* ⚡ Active creators */}
            {activeCreators.length > 0 ? (
              <section>
                <SectionHeader
                  emoji={EXPLORE_CATEGORY_META.active.emoji}
                  title={EXPLORE_CATEGORY_META.active.title}
                  meta={`${activeCreators.length} creator${activeCreators.length === 1 ? '' : 's'}`}
                  route={EXPLORE_CATEGORY_META.active.route}
                />
                <HorizontalScroll>
                  {activeCreators
                    .slice(0, PREVIEW_LIMIT)
                    .map(({ user, postCount }: CreatorRanking) =>
                      renderCreatorCard(user, postCount),
                    )}
                </HorizontalScroll>
              </section>
            ) : null}

            {/* 🌱 New / emerging creators */}
            {newCreators.length > 0 ? (
              <section>
                <SectionHeader
                  emoji={EXPLORE_CATEGORY_META.new.emoji}
                  title={EXPLORE_CATEGORY_META.new.title}
                  meta="≤3 posts so far"
                  route={EXPLORE_CATEGORY_META.new.route}
                />
                <HorizontalScroll>
                  {newCreators
                    .slice(0, PREVIEW_LIMIT)
                    .map(({ user, postCount }: CreatorRanking) =>
                      renderCreatorCard(user, postCount, { showNewBadge: true }),
                    )}
                </HorizontalScroll>
              </section>
            ) : null}

            {/* 👁 Top viewed */}
            {topViewed.length > 0 ? (
              <section>
                <SectionHeader
                  emoji={EXPLORE_CATEGORY_META.viewed.emoji}
                  title={EXPLORE_CATEGORY_META.viewed.title}
                  meta={EXPLORE_CATEGORY_META.viewed.meta}
                  route={EXPLORE_CATEGORY_META.viewed.route}
                />
                <HorizontalScroll>
                  {topViewed.slice(0, PREVIEW_LIMIT).map(({ post, score }: PostRanking, i) =>
                    renderPostMiniCard(post, i + 1, score, {
                      Icon: Eye,
                      format: n => Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.round(n)),
                    }),
                  )}
                </HorizontalScroll>
              </section>
            ) : null}

            {/* 💬 Top engaged */}
            {topEngaged.length > 0 ? (
              <section>
                <SectionHeader
                  emoji={EXPLORE_CATEGORY_META.engaged.emoji}
                  title={EXPLORE_CATEGORY_META.engaged.title}
                  meta={EXPLORE_CATEGORY_META.engaged.meta}
                  route={EXPLORE_CATEGORY_META.engaged.route}
                />
                <HorizontalScroll>
                  {topEngaged.slice(0, PREVIEW_LIMIT).map(({ post, score }: PostRanking, i) =>
                    renderPostMiniCard(post, i + 1, score, {
                      Icon: Heart,
                      format: n => Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.round(n)),
                    }),
                  )}
                </HorizontalScroll>
              </section>
            ) : null}

            {/* 💎 Top traded */}
            {topTraded.length > 0 ? (
              <section>
                <SectionHeader
                  emoji={EXPLORE_CATEGORY_META.traded.emoji}
                  title={EXPLORE_CATEGORY_META.traded.title}
                  meta={EXPLORE_CATEGORY_META.traded.meta}
                  route={EXPLORE_CATEGORY_META.traded.route}
                />
                <HorizontalScroll>
                  {topTraded.slice(0, PREVIEW_LIMIT).map(({ post, unitPrice }: PostRanking, i) =>
                    renderPostMiniCard(post, i + 1, unitPrice ?? 0, {
                      Icon: Coins,
                      format: n => `${n.toLocaleString()} ORA`,
                    }),
                  )}
                </HorizontalScroll>
              </section>
            ) : null}

            {/* Empty fallback if literally nothing has data */}
            {activeCreators.length === 0 && newCreators.length === 0 &&
              topViewed.length === 0 && topEngaged.length === 0 &&
              topTraded.length === 0 && (
                <EmptyHint label="No discovery data yet — be the first to post." />
            )}
          </div>
        )}
      </div>

      {/* Category sticky tabs — full-width strip, mirrors HomePage's edge-to-edge feel */}
      <div className="sticky top-[60px] md:top-0 z-30 bg-background/95 backdrop-blur border-b border-border/40 mb-4 px-4 md:px-6">
        <div className="flex overflow-x-auto no-scrollbar">
          {categories.map(cat => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex-shrink-0 relative px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="text-base">{cat.icon}</span> {cat.name}
                </span>
                {isActive && (
                  <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-aura rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active filter chip — visible feedback that search/category are on */}
      {(searchQuery || activeCategory !== 'all') && (
        <div className="flex items-center gap-2 mb-3 text-[11px] text-muted-foreground px-4 md:px-6">
          <span>Showing</span>
          {activeCategory !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-aura/10 text-aura font-medium">
              {categories.find(c => c.id === activeCategory)?.icon} {categories.find(c => c.id === activeCategory)?.name}
            </span>
          )}
          {searchQuery && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-foreground font-medium">
              "{searchQuery}"
              <button onClick={() => setSearchQuery('')} className="hover:text-destructive"><X className="w-3 h-3" /></button>
            </span>
          )}
          <span>· {filteredPosts.length} result{filteredPosts.length === 1 ? '' : 's'}</span>
        </div>
      )}

      {/* Results — masonry edge-to-edge (px-[2px]) to match HomePage exactly */}
      {filteredPosts.length > 0 ? (
        <div className="feed-masonry px-[2px]">
          {filteredPosts.flatMap((post, i) => {
            const items = [
              <div key={post.id} className="feed-masonry-item">
                <FeedCard post={post} />
              </div>
            ];
            if ((i + 1) % 10 === 0 && adPosts.length > 0) {
              items.push(
                <div key={`ad-${i}`} className="feed-masonry-item">
                  <FeedCard post={adPosts[0]} />
                </div>
              );
            }
            return items;
          })}
        </div>
      ) : (
        // Empty state — mirrors HomePage: gradient circle icon, h2, copy, CTA pair.
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-aura/20 to-cyan-400/20 flex items-center justify-center mb-4">
            <Compass className="w-7 h-7 text-aura" />
          </div>
          <h2 className="text-lg font-bold mb-2">No results yet</h2>
          <p className="text-sm text-muted-foreground max-w-xs mb-6">
            Try a different keyword, clear the category filter, or tap a trending tag above to discover something new.
          </p>
          <div className="flex gap-3">
            {(searchQuery || activeCategory !== 'all') && (
              <button
                onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-aura text-white text-sm font-bold hover:opacity-90 transition"
              >
                Reset filters
              </button>
            )}
            <button
              onClick={() => { setSearchQuery(''); setActiveCategory('all'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-sm font-bold hover:bg-muted transition"
            >
              Browse all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyHint({ label }: { label: string }) {
  return (
    <div className="py-8 text-center text-xs text-muted-foreground">
      {label}
    </div>
  );
}

/**
 * Section header with optional clickable title that routes to the dedicated
 * leaderboard page. Renders meta + "View all →" on the right.
 */
function SectionHeader({
  icon, emoji, title, meta, route,
}: {
  icon?: ReactNode;
  emoji?: string;
  title: string;
  meta?: string;
  route?: string;
}) {
  const content = (
    <>
      {icon}
      {emoji && <span className="text-sm leading-none">{emoji}</span>}
      <span>{title}</span>
    </>
  );
  return (
    <div className="mb-3 flex justify-between items-baseline gap-2">
      {route ? (
        <Link
          to={route}
          className="flex items-center gap-1.5 text-xs font-bold text-foreground hover:text-aura transition-colors"
          title={`View full ${title.toLowerCase()} ranking`}
        >
          {content}
        </Link>
      ) : (
        <h3 className="flex items-center gap-1.5 text-xs font-bold text-foreground">
          {content}
        </h3>
      )}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        {meta && <span>{meta}</span>}
        {route && (
          <Link
            to={route}
            className="inline-flex items-center gap-0.5 font-semibold text-aura hover:opacity-80 whitespace-nowrap"
          >
            View all <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
