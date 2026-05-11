// useUserPosts — hydrates the localStorage-backed `aura_user_posts` stream
// (everything the current wallet has published via /create) into the
// global `Post` shape that the feeds (Home, Explore, Curation Latest,
// Profile, Dashboard, etc.) already render.
//
// The store is currently per-device (no real backend), so every reader
// sees the same blob; that's fine for the demo because the feeds always
// merge user posts AHEAD of the seeded mock posts so freshly-published
// content lands at the top.

import { useEffect, useState } from 'react';
import type { Post } from '@/types';
import type { User } from '@/types';

const STORAGE_KEY = 'aura_user_posts';

interface RawUserPost {
  id?: string;
  mode?: 'photo' | 'text' | 'video' | 'audio';
  title?: string;
  content?: string;
  images?: string[];
  /** 2026-05-11 R14: explicit cover image. For audio posts this is the
   *  album-art the user uploaded; for video posts it's the auto-extracted
   *  first frame (or a user-supplied override). Takes priority over
   *  images[0] when present. */
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

function readRaw(): RawUserPost[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Normalize a localStorage blob into the canonical Post shape used by
 *  feed cards. Falls back to safe defaults so a partially-written entry
 *  never crashes the renderer. */
export function rawToPost(item: RawUserPost, author: User, idx: number = 0): Post {
  // Accept ISO strings (CreatePage stores `new Date().toISOString()`)
  // and numeric ms timestamps (older entries).
  let ts: number;
  if (typeof item.createdAt === 'number') {
    ts = item.createdAt;
  } else if (typeof item.createdAt === 'string') {
    const parsed = Date.parse(item.createdAt);
    ts = Number.isFinite(parsed) ? parsed : Date.now();
  } else {
    ts = Date.now();
  }
  const created = new Date(ts).toLocaleString();
  return {
    id: item.id || `user-${idx}-${ts}`,
    type: (item.mode as Post['type']) || 'photo',
    author,
    title: item.title || (item.mode === 'text' ? '' : 'Untitled'),
    content: item.content,
    // 2026-05-11 R14: explicit coverImage (audio album-art / video first
    // frame) wins over images[0]; falls back to unsplash stock for posts
    // with no media at all (legacy text drafts).
    coverImage: item.coverImage
      || item.images?.[0]
      || (item.mode === 'text'
        ? 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=600&q=80'
        : 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=600&q=80'),
    images: item.images,
    audioUrl: item.audioUrl,
    audioDuration: item.audioDuration,
    videoUrl: item.videoUrl,
    videoDuration: item.videoDuration,
    aspectRatio: item.mode === 'text' ? 1 : 0.8,
    likes: 0,
    comments: 0,
    shares: 0,
    isLiked: false,
    isCurated: false,
    isPremium: item.isPremium,
    premiumPrice: item.premiumPrice,
    tags: item.tags || [],
    createdAt: created,
    // The publishedAt timestamp lets feeds sort by recency without
    // reparsing `createdAt`. Older feeds that don't read this key
    // simply ignore it.
    publishedAt: ts,
  } as Post & { publishedAt: number };
}

/** React hook that returns the current wallet's user-published posts as
 *  an array of canonical `Post` objects, sorted newest-first. The hook
 *  keeps a tick count so re-publishes (which write to the same key) are
 *  reflected without a manual reload. */
export function useUserPosts(author: User | null | undefined): Post[] {
  const [posts, setPosts] = useState<Post[]>(() =>
    author
      ? readRaw().map((it, i) => rawToPost(it, author, i))
      : [],
  );

  useEffect(() => {
    if (!author) {
      setPosts([]);
      return;
    }
    const refresh = () => {
      const next = readRaw()
        .map((it, i) => rawToPost(it, author, i))
        .sort((a, b) => ((b as any).publishedAt || 0) - ((a as any).publishedAt || 0));
      setPosts(next);
    };
    refresh();
    // Pick up writes from this same tab (the storage event only fires
    // for OTHER tabs). We emit a CustomEvent('aura_user_posts_changed')
    // from CreatePage after writing so feeds refresh immediately.
    const onChange = () => refresh();
    window.addEventListener('storage', onChange);
    window.addEventListener('aura_user_posts_changed', onChange as EventListener);
    return () => {
      window.removeEventListener('storage', onChange);
      window.removeEventListener('aura_user_posts_changed', onChange as EventListener);
    };
  }, [author]);

  return posts;
}
