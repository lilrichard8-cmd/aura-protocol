import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Compass, Users } from 'lucide-react';
import FeedCard from '@/components/cards/FeedCard';
import { posts, adPosts, users } from '@/data/mock';
import { useI18n } from '@/context/I18nContext';
import { useMockChain } from '@/context/MockChainContext';
import { useAuth } from '@/context/AuthContext';
import { useUserPosts } from '@/hooks/useUserPosts';
import { useAggregatedUserPosts } from '@/hooks/useAggregatedUserPosts';

export default function HomePage() {
  const { t } = useI18n();
  const mockChain = useMockChain();
  const { user: me } = useAuth();
  // The local user's own published posts ALWAYS appear in their feed,
  // regardless of follow graph — you should see your own work surfaced
  // immediately after publishing.
  const myPublishedPosts = useUserPosts(me as any);
  // 2026-05-19 — cross-user on-chain post discovery (per-device). Pulls
  // every `aura_user_posts:*` registry from localStorage so we can show
  // posts from other Privy sessions / wallets that have published in
  // this browser. Will be replaced by a Helius indexer pre-mainnet.
  const { posts: aggregatedPosts } = useAggregatedUserPosts(me as any);

  // HomeFeed: own posts + followed users' content + external ads (10:1 ratio).
  // Recompute whenever followingIds or my published posts change.
  const followingPosts = useMemo(() => {
    const dynamicFollowingIds = mockChain.followingIds.length > 0
      ? mockChain.followingIds
      : ['iris', users[0]?.id, users[1]?.id].filter(Boolean);
    const organicPosts = posts.filter(post =>
      dynamicFollowingIds.includes(post.author.id)
    );
    // Aggregated cross-user on-chain posts (stubs for other authors).
    // Skip ones already in `myPublishedPosts` by id (deduped by PDA / id).
    const myIds = new Set(myPublishedPosts.map(p => p.id));
    const otherChainPosts = aggregatedPosts.filter(p => !myIds.has(p.id));
    // My own posts come first — newest at the top.
    const merged = [...myPublishedPosts, ...otherChainPosts, ...organicPosts];
    const out: typeof posts = [];
    merged.forEach((post, i) => {
      out.push(post);
      if ((i + 1) % 10 === 0 && adPosts.length > 0) {
        out.push(adPosts[0]);
      }
    });
    return out;
  }, [mockChain.followingIds, myPublishedPosts, aggregatedPosts]);

  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [displayPosts, setDisplayPosts] = useState(followingPosts);

  // Keep displayPosts in sync when followingPosts changes (e.g. follow new
  // creator). Without this, the feed froze on its initial snapshot.
  useEffect(() => {
    setDisplayPosts(followingPosts);
  }, [followingPosts]);
  const touchStartY = useRef(0);
  const isAtTop = useRef(true);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 0) {
      touchStartY.current = e.touches[0].clientY;
      isAtTop.current = true;
    } else {
      isAtTop.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isAtTop.current || refreshing) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.4, 100));
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 60) triggerRefresh();
    setPullDistance(0);
  };

  const triggerRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setDisplayPosts([...followingPosts]);
      setRefreshing(false);
    }, 1500);
  }, [followingPosts]);

  return (
    <div
      className="pt-[60px] md:pt-2 pb-24 md:pb-4 min-h-screen"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh */}
      <div
        className="flex flex-col items-center justify-center overflow-hidden transition-all duration-300 ease-out md:hidden"
        style={{ height: refreshing ? 80 : pullDistance, opacity: Math.min(pullDistance / 40, 1) }}
      >
        <div className={`${refreshing ? 'animate-spin' : ''} relative`}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <defs>
              <linearGradient id="aura-ptr" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop stopColor="#14C8A8" /><stop offset="1" stopColor="#38BDF8" />
              </linearGradient>
            </defs>
            <circle cx="16" cy="16" r="14" stroke="url(#aura-ptr)" strokeWidth="3" strokeLinecap="round" strokeDasharray="10 10" />
            <circle cx="16" cy="16" r="6" fill="url(#aura-ptr)" />
          </svg>
        </div>
        {!refreshing && pullDistance > 40 && (
          <span className="text-[10px] text-aura mt-2 font-bold tracking-wider uppercase">{t.common.releaseToRefresh}</span>
        )}
      </div>

      {/* Masonry feed — CSS columns, max 6 cols. No infinite scroll: mock data is finite. */}
      {displayPosts.length > 0 ? (
        <div className="feed-masonry px-[2px]">
          {displayPosts.map(post => (
            <div key={post.id} className="feed-masonry-item">
              <FeedCard post={post} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-aura/20 to-cyan-400/20 flex items-center justify-center mb-4">
            <Users className="w-7 h-7 text-aura" />
          </div>
          <h2 className="text-lg font-bold mb-2">Your feed is quiet</h2>
          <p className="text-sm text-muted-foreground max-w-xs mb-6">
            Follow creators on Explore to see their posts here, or open Curation to discover what the community is mining.
          </p>
          <div className="flex gap-3">
            <Link
              to="/explore"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-aura text-white text-sm font-bold hover:opacity-90 transition"
            >
              <Compass className="w-4 h-4" />
              Explore
            </Link>
            <Link
              to="/curation"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-sm font-bold hover:bg-muted transition"
            >
              Curation
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
