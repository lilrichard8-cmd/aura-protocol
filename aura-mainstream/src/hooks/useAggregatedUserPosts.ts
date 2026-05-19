/**
 * useAggregatedUserPosts \u2014 per-device cross-user post aggregator.
 *
 * Reads every `aura_user_posts:<owner>` key in localStorage AND the
 * legacy `aura_user_posts` blob (the actual content payload for the
 * local user) to construct a unified feed.
 *
 * Important demo limitation: this is per-device only. To see cross-user
 * posts on different machines we need a real indexer (Helius webhook +
 * Postgres). Until then we make the limitation explicit in the UI.
 *
 * 2026-05-19 \u2014 first cut for Tier-2 creator-loop real-chain.
 */

import { useEffect, useMemo, useState } from 'react';
import type { Post, User } from '@/types';
import { rawToPost } from './useUserPosts';
import { listAllKnownPosts, type OnChainPostRef } from '@/lib/onChainPostStore';

const STORAGE_KEY = 'aura_user_posts';

interface RawUserPost {
  id?: string;
  mode?: 'photo' | 'text' | 'video' | 'audio';
  title?: string;
  content?: string;
  images?: string[];
  coverImage?: string;
  audioUrl?: string;
  audioDuration?: string;
  videoUrl?: string;
  videoDuration?: string;
  tags?: string[];
  createdAt?: number | string;
  isPremium?: boolean;
  premiumPrice?: number;
}

function readLegacyBlob(): RawUserPost[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Synthesize a minimal User stub from a base58 author pubkey. Used
 *  when we surface a cross-user on-chain post we have a PDA reference
 *  for but no full profile metadata yet. */
function stubUserFromAuthor(author: string): User {
  const short = `${author.slice(0, 4)}\u2026${author.slice(-4)}`;
  return {
    id: author,
    username: short,
    displayName: short,
    avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${author}`,
    bio: '',
    followers: 0,
    following: 0,
    isVerified: false,
  } as User;
}

export interface AggregatedPostsResult {
  /** Posts the user can render in feed cards. Newest-first. */
  posts: Post[];
  /** PDAs of every on-chain post we've discovered (for downstream live
   *  reads of likes/comments via coreOnChain.fetchPost). */
  postPdas: OnChainPostRef[];
}

/**
 * Hook: returns the aggregated user-published feed across every author
 * we know about on this device (current user + any others whose post
 * registry happens to live in this browser's localStorage, e.g. a
 * second Privy session in the same browser).
 */
export function useAggregatedUserPosts(meUser: User | null | undefined): AggregatedPostsResult {
  const meId = meUser?.id || null;
  const [tick, setTick] = useState(0);

  // Refresh on cross-tab + same-tab storage events.
  useEffect(() => {
    const onChange = () => setTick(t => t + 1);
    window.addEventListener('storage', onChange);
    window.addEventListener('aura_user_posts_changed', onChange as EventListener);
    return () => {
      window.removeEventListener('storage', onChange);
      window.removeEventListener('aura_user_posts_changed', onChange as EventListener);
    };
  }, []);

  return useMemo(() => {
    const legacyBlob = readLegacyBlob();
    const knownPdas = listAllKnownPosts();

    // For posts that came from the current user, look up the full
    // content payload in the legacy blob (which keyed by `postId`).
    const blobById: Record<string, RawUserPost> = {};
    legacyBlob.forEach(it => {
      if (it.id) blobById[it.id] = it;
    });

    const posts: Post[] = [];

    // First emit posts we have full content for (legacy blob \u2014
    // current user's own posts). Use `meUser` as author when matching.
    if (meUser) {
      legacyBlob.forEach((it, idx) => {
        posts.push(rawToPost(it, meUser, idx));
      });
    }

    // Then emit on-chain post PDAs from *other* authors that we don't
    // have full content for. Render as a stub so the user at least
    // sees that someone else has published.
    knownPdas.forEach(ref => {
      // Skip own author \u2014 already covered by legacy blob above.
      if (meId && ref.author === meId) return;
      // Skip when we already have full content via blob join.
      if (ref.postId && blobById[ref.postId]) return;
      const author = stubUserFromAuthor(ref.author);
      posts.push({
        id: ref.postPda,
        type: (ref.mode as Post['type']) || 'photo',
        author,
        title: ref.title || 'On-chain post',
        content: '\ud83d\udd17 On-chain post (full content via Arweave \u2014 coming soon)',
        coverImage: 'https://images.unsplash.com/photo-1635776062764-e025521e3df3?auto=format&fit=crop&w=600&q=80',
        images: [],
        aspectRatio: 0.8,
        likes: 0,
        comments: 0,
        shares: 0,
        isLiked: false,
        isCurated: false,
        isPremium: false,
        tags: ['on-chain'],
        createdAt: new Date(ref.createdAt || Date.now()).toLocaleString(),
        publishedAt: ref.createdAt || Date.now(),
        // Stash the PDA on the post so consumers (PostDetail, FeedCard)
        // can read likes / etc directly from chain.
        onChainPostPda: ref.postPda,
      } as Post & { publishedAt: number; onChainPostPda: string });
    });

    // Sort newest-first.
    posts.sort((a, b) =>
      ((b as any).publishedAt || 0) - ((a as any).publishedAt || 0),
    );

    return { posts, postPdas: knownPdas };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, meId, meUser?.id]);
}
