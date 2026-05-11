import { useMemo } from 'react';
import { posts } from '@/data/mock';
import { useAuth } from '@/context/AuthContext';
import type { Post, User } from '@/types';

/**
 * Shared derivation of every Explore-page leaderboard.
 *
 * Returns full (un-sliced) rankings; consumers slice for previews.
 *
 * Honesty notes:
 * - There's no real `views` field on Post; only live posts have `viewerCount`.
 *   We synthesise a "view score" from `viewerCount` + likes/comments/shares.
 * - There's no real on-chain trade volume either. We rank `isPremium` posts by
 *   premium price weighted by interest (likes + comments) as a stand-in until
 *   we wire up actual sales counts.
 */

export type CreatorRanking = { user: User; postCount: number; firstAt: number };
export type PostRanking = { post: Post; score: number; unitPrice?: number };

export type ExploreCategory =
  | 'active'
  | 'new'
  | 'viewed'
  | 'engaged'
  | 'traded';

export const EXPLORE_CATEGORY_META: Record<
  ExploreCategory,
  { title: string; emoji: string; meta: string; route: string }
> = {
  active:  { title: 'Active on AURA', emoji: '⚡', meta: 'Creators publishing right now',    route: '/explore/active'  },
  new:     { title: 'New voices',     emoji: '🌱', meta: 'Emerging creators · ≤3 posts',     route: '/explore/new'     },
  viewed:  { title: 'Most viewed',    emoji: '👁', meta: 'Across the network',               route: '/explore/viewed'  },
  engaged: { title: 'Most engaged',   emoji: '💬', meta: 'Likes · comments · shares',        route: '/explore/engaged' },
  traded:  { title: 'Top traded',     emoji: '💎', meta: 'Premium unlocks · price × interest', route: '/explore/traded' },
};

export function useExploreLeaderboards() {
  const { user: me } = useAuth();

  const activeCreators: CreatorRanking[] = useMemo(() => {
    const map = new Map<string, CreatorRanking>();
    for (const p of posts) {
      if (!p.author) continue;
      if (me && p.author.id === me.id) continue;
      const t = Date.parse(p.createdAt) || 0;
      const cur = map.get(p.author.id);
      if (cur) {
        cur.postCount += 1;
        if (t && (!cur.firstAt || t < cur.firstAt)) cur.firstAt = t;
      } else {
        map.set(p.author.id, { user: p.author, postCount: 1, firstAt: t });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.postCount - a.postCount);
  }, [me]);

  const newCreators: CreatorRanking[] = useMemo(() => {
    return activeCreators
      .filter(c => c.postCount <= 3)
      .slice()
      .sort((a, b) => b.firstAt - a.firstAt);
  }, [activeCreators]);

  const topViewed: PostRanking[] = useMemo(() => {
    return [...posts]
      .map(p => ({
        post: p,
        score: (p.viewerCount ?? 0) * 10 + p.likes * 7 + p.comments * 2 + p.shares,
      }))
      .sort((a, b) => b.score - a.score);
  }, []);

  const topEngaged: PostRanking[] = useMemo(() => {
    return [...posts]
      .map(p => ({ post: p, score: p.likes + p.comments * 2 + p.shares * 3 }))
      .sort((a, b) => b.score - a.score);
  }, []);

  const topTraded: PostRanking[] = useMemo(() => {
    return posts
      .filter(p => p.isPremium && (p.premiumPrice ?? 0) > 0)
      .map(p => ({
        post: p,
        score: (p.premiumPrice ?? 0) * (1 + (p.likes + p.comments) / 100),
        unitPrice: p.premiumPrice ?? 0,
      }))
      .sort((a, b) => b.score - a.score);
  }, []);

  return {
    activeCreators,
    newCreators,
    topViewed,
    topEngaged,
    topTraded,
  };
}
