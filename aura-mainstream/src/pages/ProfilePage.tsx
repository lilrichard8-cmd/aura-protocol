/**
 * ProfilePage — Bilibili-style creator profile (rebuilt 2026-05-09).
 *
 * Layout (per Zhuoyu 2026-05-09 reference, mirrors space.bilibili.com/<uid>):
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │                COVER BANNER (full width, ~240px)             │
 *   │   ┌─avatar─┐                              [+ Follow] [···]   │
 *   └───┴────────┴──────────────────────────────────────────────────┘
 *   │  Name / handle / Reputation / bio                             │
 *   │  [followers]  [following]  [posts]  ←→  Search / sticky tabs  │
 *   ├──────────────────────────┬───────────────────────────────────┤
 *   │  LEFT MAIN (3/4)         │  RIGHT RAIL (1/4)                 │
 *   │  ┌─ Creator Coin ─┐      │  ┌─ About ─────────┐              │
 *   │  ┌─ My Posts ─→ all      │  ┌─ ORA Wallet ───┐              │
 *   │  ┌─ Curated ──→ all      │  ┌─ Recent Stats ─┐              │
 *   │  ┌─ Liked   ──→ all      │  ┌─ Governance  ─┐              │
 *   │  ┌─ Purchased ─→ all     │                                  │
 *   └──────────────────────────┴───────────────────────────────────┘
 *
 * Tabs: Home (overview) | Create (posts) | Curate (curated) | Liked (liked) | Purchased (purchased)
 *   - "Home" overview shows preview rows (4 items max per section) with
 *     "View all" links that just switch the active tab in place.
 *   - All other tabs render the full masonry grid.
 *
 * Honesty notes:
 *   - Cover image uses `user.bannerImage` if present, otherwise falls back
 *     to a single curated Unsplash banner. We never invent a custom cover
 *     for a wallet user who hasn't set one.
 *   - Wallet users (no on-chain content yet) show genuinely empty sections,
 *     not seeded mock posts.
 *   - The right rail's "Recent stats" reads from real mockChain counters
 *     (creator coin holders, governance votes, transaction count) — no
 *     hard-coded "12 posts this month" lies.
 */
import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  Settings, Share2, Coins, TrendingUp, TrendingDown, Vote,
  Grid3x3, Bookmark, Heart, ShoppingCart, Wallet as WalletIcon,
  ChevronRight, Sparkles, Activity, Edit3, Users, Camera, X,
} from 'lucide-react';
import MintCeremony from '@/components/coin/MintCeremony';
import { useMockChain } from '@/context/MockChainContext';
import { useAuth } from '@/context/AuthContext';
import { useCoreContract } from '@/hooks/useCoreContract';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';
import { useI18n } from '@/context/I18nContext';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/button';
import { currentUser, posts, iris, users } from '@/data/mock';
import type { Post } from '@/types';

type ProfileTab = 'home' | 'posts' | 'curated' | 'liked' | 'purchased';

/**
 * Read user-published posts from localStorage. CreatePage writes to
 * `aura_user_posts` on every successful publish; this is the canonical
 * source for "my authored posts" — not the seeded `myPosts` mock array.
 *
 * Returns Post-shaped objects with sane fallbacks so the existing
 * PostThumb component can render them without changes.
 */
function readUserPosts(authUser: { displayName?: string; username?: string; avatar?: string; id?: string }): Post[] {
  try {
    const raw = localStorage.getItem('aura_user_posts');
    if (!raw) return [];
    const arr = JSON.parse(raw) as Array<any>;
    return arr.map((item, idx): Post => ({
      id: item.id || `user-${idx}`,
      type: (item.mode as Post['type']) || 'photo',
      author: {
        id: authUser.id || 'me',
        username: authUser.username || 'me',
        displayName: authUser.displayName || authUser.username || 'Me',
        avatar: authUser.avatar || 'https://api.dicebear.com/7.x/identicon/svg?seed=me',
        bio: '',
        followers: 0,
        following: 0,
        isVerified: false,
      },
      title: item.title || (item.mode === 'text' ? '' : 'Untitled'),
      content: item.content,
      coverImage: item.images?.[0] || (item.mode === 'text'
        ? 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=600&q=80'
        : 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=600&q=80'),
      images: item.images,
      aspectRatio: item.mode === 'text' ? 1 : 0.8,
      likes: 0,
      comments: 0,
      shares: 0,
      isLiked: false,
      isCurated: false,
      tags: item.tags || [],
      createdAt: item.createdAt ? new Date(item.createdAt).toLocaleString() : 'just now',
    }));
  } catch {
    return [];
  }
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser } = useAuth();
  const mockChain = useMockChain();
  const { t } = useI18n();
  const { showToast } = useToast();

  // Banner upload — only shown for own profile.
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const handleBannerUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('error', 'Image only', 'Please select a JPG / PNG / WebP image.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      showToast('error', 'Image too large', 'Maximum 4 MB. Compress and try again.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        mockChain.setProfileBannerUrl?.(reader.result);
        showToast('success', 'Banner updated', 'Your new cover image is live.');
      }
    };
    reader.readAsDataURL(file);
  };
  const handleBannerReset = () => {
    mockChain.setProfileBannerUrl?.(null);
    showToast('success', 'Banner reset', 'Restored the default cover image.');
  };

  // Resolve which user we're showing.
  //
  // Priority order:
  //   1. URL has /u/:username → look the target up across iris + users + currentUser.
  //      This is the public-profile entry point used by follow notifications,
  //      mentions, etc.
  //   2. No URL param ("/profile") → the logged-in user (own profile).
  //   3. Not authenticated and no URL → fall back to the demo seed.
  const { username: urlUsername } = useParams<{ username?: string }>();
  const resolveByUsername = (uname: string) => {
    const all = [iris, ...users, currentUser];
    return all.find(u => u.username?.toLowerCase() === uname.toLowerCase());
  };
  const targetByUrl = urlUsername ? resolveByUsername(urlUsername) : null;
  // 404-style state when /u/:username doesn't match anyone.
  const isNotFound = !!urlUsername && !targetByUrl;
  const user = (targetByUrl ?? authUser ?? currentUser) as typeof currentUser;

  const isOwnProfile = !urlUsername && (!authUser || authUser.id === user.id);

  const [activeTab, setActiveTab] = useState<ProfileTab>('home');
  const [showMintModal, setShowMintModal] = useState(false);

  // ── Real content sources (2026-05-09 truth-pass) ─────────────────
  // Every section reads real persisted state:
  //   • Authored  → localStorage `aura_user_posts` (CreatePage writes here)
  //   • Curated   → mockChain.curatedContentIds (curation flow persists)
  //   • Liked     → mockChain.likedPostIds (heart click persists, new 2026-05-09)
  //   • Purchased → mockChain.ownedKeys (PPV / content-key purchase persists)
  // No mock fallback — if the user hasn't done X, the X tab is genuinely empty.
  const myAuthoredPosts: Post[] = useMemo(() => {
    if (isOwnProfile) {
      // Own profile — read user-published drafts/posts from localStorage,
      // since the demo doesn't run a real backend.
      return readUserPosts(user);
    }
    // Public profile — use the seeded mock feed filtered by author.
    // For Iris this surfaces all 9 of her seeded posts; for users with
    // no seeded content this naturally returns an empty array.
    return posts.filter(p => p.author?.id === user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwnProfile, user, mockChain.transactions.length]);

  // Curated / Liked / Purchased come from the *current wallet's* mockChain
  // state and there's no per-user view of those streams. When viewing
  // someone else's profile we show empty state — it's the honest answer
  // until we add real per-user feeds.
  const myCuratedPosts: Post[] = useMemo(() => {
    if (!isOwnProfile) return [];
    const ids = mockChain.curatedContentIds || [];
    return posts.filter(p => ids.includes(p.id));
  }, [mockChain.curatedContentIds, isOwnProfile]);
  const myLikedPosts: Post[] = useMemo(() => {
    if (!isOwnProfile) return [];
    const ids = mockChain.likedPostIds || [];
    return posts.filter(p => ids.includes(p.id));
  }, [mockChain.likedPostIds, isOwnProfile]);
  const myPurchasedPosts: Post[] = useMemo(() => {
    if (!isOwnProfile) return [];
    const keyContentIds = (mockChain.ownedKeys || []).map(k => k.contentId);
    return posts.filter(p => keyContentIds.includes(p.id));
  }, [mockChain.ownedKeys, isOwnProfile]);

  // 2026-05-19 — chain-backed follower/following/post counts for the
  // current wallet (own-profile only). Falls back to mock numbers when
  // the Core flag is off or the profile hasn't been registered yet.
  const coreOnChain = useCoreContract();
  const unifiedWallet = useUnifiedWallet();
  const [chainCounts, setChainCounts] = useState<{
    followerCount: number;
    followingCount: number;
    postCount: number;
  } | null>(null);
  useEffect(() => {
    if (!isOwnProfile) return;
    if (!coreOnChain.enabled || !coreOnChain.module) return;
    if (!unifiedWallet.publicKey) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await coreOnChain.module!.fetchUserProfile(unifiedWallet.publicKey!);
        if (!cancelled && p) {
          setChainCounts({
            followerCount: p.followerCount,
            followingCount: p.followingCount,
            postCount: p.postCount,
          });
        }
      } catch { /* leave null */ }
    })();
    return () => { cancelled = true; };
  }, [isOwnProfile, coreOnChain.enabled, coreOnChain.module, unifiedWallet.publicKey]);

  const followerCount = (isOwnProfile && chainCounts)
    ? chainCounts.followerCount
    : (user.followers || 0);
  const canMint = followerCount >= 100;

  const defaultMintSymbol = (user.username || 'MYCOIN')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 6) || 'MYCOIN';
  const defaultMintName = `${user.displayName || user.username || 'My'} Coin`;

  const handleMintComplete = (mintedSymbol: string) => {
    setShowMintModal(false);
    const slug = mintedSymbol.replace(/^\$/, '').toLowerCase();
    navigate(`/marketplace/coin/${slug}`, { state: { from: location.pathname } });
  };

  const isFollowing = mockChain.followingIds.includes(user.id);
  const handleFollowToggle = async () => {
    if (isFollowing) mockChain.unfollowUser(user.id);
    else mockChain.followUser(user.id);
    // 2026-05-19 — mirror to the chain when the target's id is a
    // base58 public key (≥ 32 chars, base58 alphabet). Best-effort
    // — demo users from mock data have short ids and are skipped.
    if (
      coreOnChain.enabled &&
      coreOnChain.module &&
      unifiedWallet.connected &&
      /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(user.id)
    ) {
      try {
        const target = new (await import('@solana/web3.js')).PublicKey(user.id);
        const res = isFollowing
          ? await coreOnChain.module.unfollowUser(target)
          : await coreOnChain.module.followUser(target);
        if (!res.success) {
          console.warn('[ProfilePage] on-chain follow failed:', res.error);
        }
      } catch (e: any) {
        console.warn('[ProfilePage] follow dispatch failed:', e?.message);
      }
    }
  };

  // Tabs config — each shows a count badge (real count) so users get
  // a sense of "how much is here" before clicking.
  const tabs: Array<{ id: ProfileTab; label: string; icon: typeof Grid3x3; count?: number }> = [
    { id: 'home',      label: t.profilePage?.home ?? 'Home',       icon: Activity },
    { id: 'posts',     label: t.profilePage?.posts ?? 'Posts',     icon: Grid3x3, count: myAuthoredPosts.length },
    { id: 'curated',   label: t.profilePage?.curated ?? 'Curated', icon: Bookmark, count: myCuratedPosts.length },
    { id: 'liked',     label: t.profilePage?.liked ?? 'Liked',     icon: Heart,    count: myLikedPosts.length },
    { id: 'purchased', label: t.profilePage?.purchased ?? 'Purchased', icon: ShoppingCart, count: myPurchasedPosts.length },
  ];

  // Wallet/governance numbers for the right rail — all real.
  const oraBalance = mockChain.oraBalance ?? 0;
  const stakedOra = mockChain.stakedOra ?? 0;
  const myVotesCount = Object.keys(mockChain.myVotes || {}).length;
  const txCount = (mockChain.transactions || []).length;
  const followingCount = (isOwnProfile && chainCounts)
    ? chainCounts.followingCount
    : (mockChain.followingIds || []).length;
  const reputationScore = mockChain.reputationScore ?? 0;
  const reputationTier = mockChain.reputationTier ?? 'Bronze';

  // ─ Public-profile not found. Render a friendly 404 instead of crashing
  //   on `user.X` accesses. Hooks above this point still run — keeps
  //   the rules-of-hooks contract intact across both code paths.
  if (isNotFound) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-12">
        <div className="max-w-md text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <span className="text-3xl">🔍</span>
          </div>
          <h1 className="text-2xl font-bold">User not found</h1>
          <p className="text-sm text-muted-foreground">
            No creator with @{urlUsername} on AURA yet.
          </p>
          <button
            onClick={() => navigate('/explore')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-aura text-white text-xs font-bold hover:bg-aura-dark transition-colors"
          >
            Browse creators
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* COVER BANNER ─ Bilibili-style.
         Own-profile users can upload a custom banner via the camera button
         (visible on hover). Image stored as data URL in
         mockChain.profileBannerUrl, capped at 4 MB. */}
      <div className="relative h-[200px] md:h-[240px] w-full overflow-hidden group">
        <img
          src={
            mockChain.profileBannerUrl
            || (user as any).bannerImage
            || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1600&q=80'
          }
          alt="Cover"
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

        {/* Hidden file input — triggered by the upload button below */}
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleBannerUpload(f);
            e.target.value = '';
          }}
        />

        {/* Top-right actions */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {isOwnProfile && (
            <>
              <button
                onClick={() => bannerInputRef.current?.click()}
                title="Change banner"
                className="px-3 py-1.5 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white text-xs font-semibold transition-all opacity-0 group-hover:opacity-100 inline-flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                Change banner
              </button>
              {mockChain.profileBannerUrl && (
                <button
                  onClick={handleBannerReset}
                  title="Reset to default banner"
                  className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white opacity-0 group-hover:opacity-100 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <span className="w-px h-5 bg-white/30 mx-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </>
          )}
          <button
            onClick={() => navigator.clipboard.writeText(window.location.href)}
            title="Copy link"
            className="p-2 rounded-full bg-black/30 backdrop-blur-md text-white hover:bg-black/50 transition-colors"
          >
            <Share2 className="w-4 h-4" />
          </button>
          {/* Settings only on the user's own profile — hidden when viewing others. */}
          {isOwnProfile && (
            <button
              onClick={() => navigate('/settings')}
              title="Settings"
              className="p-2 rounded-full bg-black/30 backdrop-blur-md text-white hover:bg-black/50 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* HEADER STRIP — overlaps cover, full-width */}
      <div className="px-4 md:px-6 lg:px-8 -mt-16 md:-mt-20 relative">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          {/* Avatar + identity */}
          <div className="flex items-end gap-4">
            <div className="relative shrink-0">
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-aura via-ora to-aura-light p-1 shadow-xl">
                <img
                  src={user.avatar}
                  alt={user.displayName}
                  className="w-full h-full rounded-full object-cover border-4 border-background"
                />
              </div>
              {user.isVerified && (
                <div className="absolute bottom-1 right-1 bg-blue-500 text-white p-1 rounded-full border-2 border-background shadow-md">
                  <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
            <div className="pb-2">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{user.displayName}</h1>
                <ReputationBadge score={reputationScore} tier={reputationTier} />
              </div>
              <p className="text-sm text-muted-foreground font-medium">@{user.username}</p>
            </div>
          </div>

          {/* Action buttons — right-aligned */}
          <div className="flex items-center gap-2 flex-wrap pb-2">
            {isOwnProfile ? (
              <Button
                onClick={() => navigate('/settings')}
                variant="outline"
                className="bg-background/80 backdrop-blur"
              >
                <Edit3 className="w-4 h-4 mr-1.5" />
                Edit profile
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleFollowToggle}
                  className={isFollowing
                    ? 'bg-secondary text-foreground border border-border hover:bg-secondary/80'
                    : 'bg-aura text-white hover:bg-aura-dark'}
                >
                  {isFollowing ? '✓ Following' : '+ Follow'}
                </Button>
                <Button variant="outline">Send message</Button>
              </>
            )}
          </div>
        </div>

        {/* Bio + counters */}
        <div className="mt-3">
          {user.bio && (
            <p className="text-sm text-foreground/80 max-w-2xl leading-relaxed mb-3">
              {user.bio}
            </p>
          )}
          <div className="flex items-center gap-5 text-sm">
            <Counter label="Followers" value={followerCount} />
            {/* When viewing someone else's profile, use their .following
             *  number from the User record. Only the logged-in user has
             *  a live `mockChain.followingIds` we can read from. */}
            <Counter label="Following" value={isOwnProfile ? followingCount : (user.following || 0)} />
            <Counter label="Posts" value={myAuthoredPosts.length} />
            <Counter label="Curated" value={myCuratedPosts.length} />
          </div>
        </div>
      </div>

      {/* STICKY TABS ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/40 mt-6">
        <div className="px-4 md:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto no-scrollbar">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative shrink-0 inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors ${
                  isActive ? 'text-aura' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded-full ${isActive ? 'bg-aura/15 text-aura' : 'bg-muted text-muted-foreground'}`}>
                    {tab.count}
                  </span>
                )}
                {isActive && <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-aura" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* MAIN AREA ────────────────────────────────────────────────── */}
      <div className="px-4 md:px-6 lg:px-8 pt-6">
        {activeTab === 'home' && (
          // Two-column layout: main content + right rail
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_320px] gap-6">
            {/* LEFT MAIN — overview sections */}
            {/* 2026-05-09: Creator Coin card moved to the right rail per Bilibili
               reference; the left main is now content-first. */}
            <div className="min-w-0 space-y-6">
              {/* Section: My posts */}
              <PostsSection
                title="My posts"
                count={myAuthoredPosts.length}
                items={myAuthoredPosts}
                emptyText={'You haven\'t published anything yet — head to Studio to create your first piece.'}
                onViewAll={myAuthoredPosts.length > 4 ? () => setActiveTab('posts') : undefined}
                onPostClick={(id) => navigate(`/post/${id}`)}
                accent="aura"
              />

              {/* Section: Curated */}
              <PostsSection
                title="Curated"
                subtitle="Content you've discovered and earned curation rewards on"
                count={myCuratedPosts.length}
                items={myCuratedPosts}
                emptyText="Nothing curated yet — discover good content in Curation to earn rewards."
                onViewAll={myCuratedPosts.length > 4 ? () => setActiveTab('curated') : undefined}
                onPostClick={(id) => navigate(`/post/${id}`)}
                accent="ora"
              />

              {/* Section: Liked */}
              <PostsSection
                title="Liked"
                count={myLikedPosts.length}
                items={myLikedPosts}
                emptyText="Posts you like will appear here."
                onViewAll={myLikedPosts.length > 4 ? () => setActiveTab('liked') : undefined}
                onPostClick={(id) => navigate(`/post/${id}`)}
                accent="rose"
              />

              {/* Section: Purchased */}
              <PostsSection
                title="Purchased"
                subtitle="Premium content you've unlocked"
                count={myPurchasedPosts.length}
                items={myPurchasedPosts}
                emptyText="No premium content unlocked yet."
                onViewAll={myPurchasedPosts.length > 4 ? () => setActiveTab('purchased') : undefined}
                onPostClick={(id) => navigate(`/post/${id}`)}
                accent="emerald"
              />
            </div>

            {/* RIGHT RAIL — about, wallet snapshot, recent stats */}
            <aside className="space-y-4 lg:sticky lg:top-16 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto pr-1">
              {/* About card.
               *
               * On own profile: shows the live wallet/network/reputation
               * pulled from MockChainContext.
               *
               * On public profile: only fields we actually know are
               * shown. We don't have the target's wallet address, joined
               * date, network, or reputation in mock data, so we show a
               * minimal honest summary based on the User record alone
               * (verification status, follower/following totals).
               */}
              <SidebarCard icon={<Users className="w-3.5 h-3.5" />} title="About">
                <div className="space-y-2 text-[12px]">
                  {isOwnProfile ? (
                    <>
                      <Row label="Wallet" value={
                        <span className="font-mono text-[11px]">
                          {((mockChain.walletAddress || mockChain.publicKey || '') as string)
                            ? `${(mockChain.walletAddress || mockChain.publicKey || '').slice(0, 4)}…${(mockChain.walletAddress || mockChain.publicKey || '').slice(-4)}`
                            : '—'}
                        </span>
                      } />
                      <Row label="Joined" value="May 2026" />
                      <Row label="Reputation" value={
                        <span>
                          <span className="font-bold tabular-nums">{reputationScore}</span>
                          <span className="text-muted-foreground/70 ml-1">{reputationTier}</span>
                        </span>
                      } />
                      <Row label="Network" value={mockChain.network ?? 'Solana mainnet'} />
                    </>
                  ) : (
                    <>
                      <Row label="Followers" value={<span className="font-bold tabular-nums">{(user.followers || 0).toLocaleString()}</span>} />
                      <Row label="Following" value={<span className="font-bold tabular-nums">{(user.following || 0).toLocaleString()}</span>} />
                      {user.isVerified && (
                        <Row label="Status" value={<span className="text-aura font-semibold">Verified creator</span>} />
                      )}
                    </>
                  )}
                </div>
              </SidebarCard>

              {/* Creator Coin mini-entry (was the big card on the left, now
                 a focused entry to the Creator Coin dashboard per 2026-05-09 redesign).
                 Shows price + holders, links to /creator-coin (not Trade). */}
              {isOwnProfile && (
                mockChain.hasCreatorCoin
                  ? <CreatorCoinMiniEntry mockChain={mockChain} onOpenStudio={() => navigate('/creator-coin')} />
                  : <MintCoinMiniCallout
                      canMint={canMint}
                      followerCount={followerCount}
                      onMint={() => setShowMintModal(true)}
                    />
              )}

              {/* Wallet snapshot — entire card click to /wallet (same
                 "open the page" interaction model as the Creator Coin
                 mini entry above). */}
              {isOwnProfile && (
                <button
                  type="button"
                  onClick={() => navigate('/wallet')}
                  title="Open ORA Wallet"
                  className="w-full text-left bg-card rounded-2xl border p-4 hover:border-aura/40 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <WalletIcon className="w-3.5 h-3.5" />
                      ORA Wallet
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-aura transition-colors" />
                  </div>
                  <div className="text-2xl font-black tabular-nums leading-none mb-0.5">
                    {oraBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    <span className="text-xs font-normal text-muted-foreground ml-1">ORA</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mb-3">≈ ${(oraBalance * 2).toFixed(2)} USD</div>
                  <div className="flex gap-2 text-[11px]">
                    <div className="flex-1 rounded-lg bg-secondary/40 px-2 py-1.5">
                      <div className="text-[9px] uppercase tracking-wide text-muted-foreground font-bold">Staked</div>
                      <div className="font-bold tabular-nums">{stakedOra.toLocaleString()}</div>
                    </div>
                    <div className="flex-1 rounded-lg bg-secondary/40 px-2 py-1.5">
                      <div className="text-[9px] uppercase tracking-wide text-muted-foreground font-bold">TX count</div>
                      <div className="font-bold tabular-nums">{txCount}</div>
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-border/40 text-[10px] text-muted-foreground/80 italic flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    Tap to manage staking, send / receive, transactions
                  </div>
                </button>
              )}

              {/* Recent activity — entire card click to /dashboard. */}
              {isOwnProfile && (
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  title="Open Dashboard"
                  className="w-full text-left bg-card rounded-2xl border p-4 hover:border-aura/40 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <Sparkles className="w-3.5 h-3.5" />
                      Recent activity
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-aura transition-colors" />
                  </div>
                  <ul className="space-y-2 text-[12px]">
                    <ActivityRow label="Posts published" value={myAuthoredPosts.length} icon={<Grid3x3 className="w-3 h-3" />} />
                    <ActivityRow label="Pieces curated" value={myCuratedPosts.length} icon={<Bookmark className="w-3 h-3" />} />
                    <ActivityRow label="Governance votes" value={myVotesCount} icon={<Vote className="w-3 h-3" />} />
                    <ActivityRow label="Following" value={followingCount} icon={<Users className="w-3 h-3" />} />
                  </ul>
                  <div className="mt-3 pt-2 border-t border-border/40 text-[10px] text-muted-foreground/80 italic flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    Tap to open Dashboard · charts, vault, full history
                  </div>
                </button>
              )}

              {/* Governance entry — own-profile only. Hidden when viewing
                  another creator's public page (not relevant to them). */}
              {isOwnProfile && (
                <button
                  onClick={() => navigate('/governance/committees')}
                  className="w-full text-left rounded-2xl border bg-gradient-to-br from-purple-500/10 to-indigo-500/10 hover:from-purple-500/15 hover:to-indigo-500/15 px-4 py-3 transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center text-lg">
                      🏛
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold leading-tight">DAO Governance</div>
                      <div className="text-[11px] text-muted-foreground">Vote on proposals & run for committee</div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </button>
              )}

              {/* Public profile: surface the creator's coin (if minted)
                  as a quick entry to their marketplace page — styled to
                  match the own-profile CreatorCoinMiniEntry exactly so
                  the visual language across all profiles stays unified. */}
              {!isOwnProfile && (user as any).creatorCoin?.symbol && (
                <PublicCreatorCoinMiniEntry
                  user={user}
                  mockChain={mockChain}
                  onOpenMarket={() => navigate(`/marketplace/coin/${user.username}`)}
                />
              )}
            </aside>
          </div>
        )}

        {/* Other tabs render the full grid for the matching content type */}
        {activeTab !== 'home' && (
          <FullGrid
            posts={
              activeTab === 'posts' ? myAuthoredPosts
              : activeTab === 'curated' ? myCuratedPosts
              : activeTab === 'liked' ? myLikedPosts
              : myPurchasedPosts
            }
            emptyText={
              activeTab === 'posts' ? 'No posts yet.'
              : activeTab === 'curated' ? 'Nothing curated yet.'
              : activeTab === 'liked' ? 'No likes yet.'
              : 'No premium content unlocked.'
            }
            onPostClick={(id) => navigate(`/post/${id}`)}
          />
        )}
      </div>

      {/* Mint Ceremony — full-screen multi-phase ritual */}
      <MintCeremony
        open={showMintModal}
        defaultSymbol={defaultMintSymbol}
        defaultName={defaultMintName}
        onClose={() => setShowMintModal(false)}
        onMinted={handleMintComplete}
      />
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────

function Counter({ label, value }: { label: string; value: number }) {
  const display = value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString();
  return (
    <div className="flex items-baseline gap-1">
      <span className="font-bold text-foreground tabular-nums">{display}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function ReputationBadge({ score, tier }: { score: number; tier: string }) {
  const tierConfig: Record<string, { color: string; bg: string; emoji: string }> = {
    Unranked: { color: 'text-muted-foreground', bg: 'bg-secondary/40 border-border/40',                     emoji: '—' },
    Bronze:   { color: 'text-amber-700',  bg: 'bg-amber-100 dark:bg-amber-900/30 border-amber-300',        emoji: '🥉' },
    Silver:   { color: 'text-gray-600',   bg: 'bg-gray-100 dark:bg-gray-800/40 border-gray-300',           emoji: '🥈' },
    Gold:     { color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-400',     emoji: '🥇' },
    Platinum: { color: 'text-blue-600',   bg: 'bg-blue-100 dark:bg-blue-900/30 border-blue-400',           emoji: '💎' },
    Diamond:  { color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30 border-purple-400',     emoji: '✨' },
  };
  // Default to Unranked (new accounts) rather than Bronze — honest empty-state.
  const cfg = tierConfig[tier] || tierConfig.Unranked;
  // For unranked users, hide the score suffix so the badge reads "— Unranked"
  // instead of "— Unranked · 0pts".
  const showScore = tier !== 'Unranked';
  return (
    <span
      title={showScore ? `Reputation: ${score} pts` : 'No reputation earned yet — curate, post, or hold tokens to start scoring.'}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.bg} ${cfg.color} cursor-help`}
    >
      {cfg.emoji} {tier}{showScore ? ` · ${score}pts` : ''}
    </span>
  );
}

// ── Section components ───────────────────────────────────────────────

function PostsSection({
  title, subtitle, count, items, emptyText, onViewAll, onPostClick, accent = 'aura',
}: {
  title: string;
  subtitle?: string;
  count: number;
  items: Post[];
  emptyText: string;
  onViewAll?: () => void;
  onPostClick: (id: string) => void;
  accent?: string;
}) {
  return (
    <section>
      <div className="flex items-end justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-bold leading-tight">{title}</h2>
            <span className="text-sm text-muted-foreground tabular-nums">· {count}</span>
          </div>
          {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className={`text-xs font-medium text-muted-foreground hover:text-${accent} transition-colors flex items-center gap-0.5 shrink-0`}
          >
            View all <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border/50 bg-secondary/20 px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {items.slice(0, 4).map(post => (
            <PostThumb key={post.id} post={post} onClick={() => onPostClick(post.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

function FullGrid({
  posts, emptyText, onPostClick,
}: {
  posts: Post[];
  emptyText: string;
  onPostClick: (id: string) => void;
}) {
  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border/50 bg-secondary/20 px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {posts.map(post => (
        <PostThumb key={post.id} post={post} onClick={() => onPostClick(post.id)} />
      ))}
    </div>
  );
}

function PostThumb({ post, onClick }: { post: Post; onClick: () => void }) {
  // Bilibili-style clickable thumbnail. Visual cues:
  // - Whole card is a real <button>, so keyboard + screenreader work.
  // - Hover ring + shadow lift makes interactivity obvious.
  // - Image scales 1.05 on hover; an overlay tint hints "click to view".
  return (
    <button
      type="button"
      onClick={onClick}
      title={post.title || 'Open post'}
      aria-label={`Open post: ${post.title || 'Untitled'}`}
      className="group cursor-pointer rounded-xl overflow-hidden bg-card border border-border/40 hover:border-aura/60 hover:shadow-lg hover:-translate-y-0.5 transition-all text-left focus-visible:ring-2 focus-visible:ring-aura focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div
        className="relative bg-muted overflow-hidden"
        style={{ aspectRatio: post.aspectRatio || 1 }}
      >
        <img
          src={post.coverImage}
          alt={post.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        {/* Hover overlay tint — ensures clickability is felt even on mostly-dark thumbnails */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors duration-300" />
        {post.type === 'video' && (
          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-bold backdrop-blur">
            ▶ {(post as any).videoDuration ?? ''}
          </div>
        )}
        {post.type === 'live' && (
          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-red-500 text-white text-[9px] font-bold animate-pulse">
            LIVE
          </div>
        )}
        {post.isPremium && (
          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-ora text-white text-[9px] font-bold">
            ${post.premiumPrice}
          </div>
        )}
      </div>
      <div className="px-2.5 py-2">
        <p className="text-[12px] font-medium leading-snug line-clamp-2">
          {post.title || (post.type === 'text' ? post.content?.slice(0, 60) + '…' : 'Untitled')}
        </p>
        {post.tags && post.tags.length > 0 && (
          <p className="text-[10px] text-muted-foreground mt-1 truncate">
            {post.tags.slice(0, 3).map(tag => `#${tag}`).join(' ')}
          </p>
        )}
      </div>
    </button>
  );
}

// ── Creator Coin mini-entry (right rail) ────────────────────────────
// 2026-05-09: Replaced the big "Trade $JUDGE" hero card on the left main
// with a compact entry on the right rail. Action takes the user straight
// to the Creator Coin dashboard (not the public Trade page) per Zhuoyu's flow:
//   "click → enter coin studio, not trade"
function CreatorCoinMiniEntry({
  mockChain, onOpenStudio,
}: {
  mockChain: ReturnType<typeof useMockChain>;
  onOpenStudio: () => void;
}) {
  const symbol = mockChain.creatorCoinSymbol || '$COIN';
  const myCoin = mockChain.creatorCoins.find(c => c.symbol === symbol);
  const initialPrice = myCoin?.initialPrice ?? 1.0;
  const lastTrade = mockChain.ownCoinTrades[0];
  const currentPrice = lastTrade?.price ?? initialPrice;
  const change24h = initialPrice > 0
    ? Number((((currentPrice - initialPrice) / initialPrice) * 100).toFixed(2))
    : 0;
  const holdersCount = 1 + mockChain.ownCoinHolders.length;

  return (
    <button
      onClick={onOpenStudio}
      title={`Open ${symbol} dashboard`}
      className="w-full text-left bg-card rounded-2xl border p-4 hover:border-ora/40 hover:shadow-md transition-all group"
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5" />
            Creator Coin
          </div>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-ora transition-colors" />
      </div>
      <div className="flex items-center gap-2.5">
        {myCoin?.logoUrl ? (
          <img src={myCoin.logoUrl} alt={symbol} className="w-9 h-9 rounded-xl object-cover ring-2 ring-ora/40 shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-ora to-ora-dark flex items-center justify-center text-white text-sm font-bold shrink-0">
            $
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold leading-tight truncate">{symbol}</div>
          <div className="text-[10px] text-muted-foreground">💎 {holdersCount} holder{holdersCount === 1 ? '' : 's'}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-black text-ora tabular-nums leading-tight">{currentPrice.toFixed(2)}</div>
          <div className={`text-[10px] font-bold inline-flex items-center gap-0.5 ${change24h >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {change24h >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
            {change24h >= 0 ? '+' : ''}{change24h}%
          </div>
        </div>
      </div>
      <div className="mt-3 pt-2 border-t border-border/40 text-[10px] text-muted-foreground/80 italic flex items-center gap-1">
        <Sparkles className="w-2.5 h-2.5" />
        Tap to manage your Creator Coin · holders, vesting, redemptions
      </div>
    </button>
  );
}

// ── Public Creator-Coin mini entry (someone else's profile) ────────────
function PublicCreatorCoinMiniEntry({
  user, mockChain, onOpenMarket,
}: {
  user: { displayName?: string; username?: string; creatorCoin?: any };
  mockChain: ReturnType<typeof useMockChain>;
  onOpenMarket: () => void;
}) {
  const cc = user.creatorCoin || {};
  const symbol = cc.symbol || '$COIN';
  const initialPrice = cc.initialPrice ?? 1.0;
  const logoUrl = cc.logoUrl as string | undefined;
  const benefits = Array.isArray(cc.benefits) ? cc.benefits : [];

  // Holders count derived from real protocol state, the same way
  // CoinDetailPage computes it: creator's remaining initial batch
  // counts as 1 holder; the local user counts as a 2nd if they hold any.
  const userHold = mockChain.creatorCoins.find(c => c.symbol.toUpperCase() === symbol.toUpperCase());
  const judgeHolding = (userHold?.amount ?? 0) + (userHold?.reservedAmount ?? 0);
  const remaining = mockChain.foreignCoinPrimaryRemaining[symbol] ?? 0;
  const holdersCount = (remaining > 0 ? 1 : 0) + (judgeHolding > 0 ? 1 : 0);

  // Initials for the gradient badge fallback
  const initial = symbol.replace(/^\$/, '').slice(0, 1) || '$';

  return (
    <button
      onClick={onOpenMarket}
      title={`Open ${symbol} market`}
      className="w-full text-left bg-card rounded-2xl border p-4 hover:border-ora/40 hover:shadow-md transition-all group"
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5" />
            Creator Coin
          </div>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-ora transition-colors" />
      </div>
      <div className="flex items-center gap-2.5">
        {logoUrl ? (
          <img src={logoUrl} alt={symbol} className="w-9 h-9 rounded-xl object-cover ring-2 ring-ora/40 shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-ora to-ora-dark flex items-center justify-center text-white text-sm font-bold shrink-0">
            {initial}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold leading-tight truncate">{symbol}</div>
          <div className="text-[10px] text-muted-foreground">
            💎 {holdersCount} holder{holdersCount === 1 ? '' : 's'}
            {benefits.length > 0 && (
              <span className="ml-1.5">· {benefits.length} benefit{benefits.length === 1 ? '' : 's'}</span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-black text-ora tabular-nums leading-tight">{initialPrice.toFixed(2)}</div>
          <div className="text-[10px] font-bold text-muted-foreground">ORA</div>
        </div>
      </div>
      <div className="mt-3 pt-2 border-t border-border/40 text-[10px] text-muted-foreground/80 italic flex items-center gap-1">
        <Sparkles className="w-2.5 h-2.5" />
        Tap to buy {symbol} · unlock holder benefits
      </div>
    </button>
  );
}

// ── Mint coin mini-callout (right rail) ──────────────────────────────
function MintCoinMiniCallout({
  canMint, followerCount, onMint,
}: {
  canMint: boolean;
  followerCount: number;
  onMint: () => void;
}) {
  return (
    <div className="bg-card rounded-2xl border p-4 bg-gradient-to-br from-aura/8 to-purple-500/5">
      <div className="flex items-center gap-2 mb-2">
        <Coins className="w-3.5 h-3.5 text-aura" />
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Creator Coin
        </div>
      </div>
      <h3 className="text-[13px] font-bold mb-1">Mint yours</h3>
      <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
        {canMint
          ? 'You\'re eligible — your personal token unlocks holder perks and a public marketplace.'
          : `Reach 100 followers to unlock minting (${followerCount}/100 so far).`}
      </p>
      <Button
        onClick={onMint}
        disabled={!canMint}
        size="sm"
        className="w-full bg-gradient-to-r from-aura to-purple-500 text-white disabled:opacity-50"
      >
        <Sparkles className="w-3.5 h-3.5 mr-1" />
        {canMint ? 'Mint now' : `${followerCount}/100`}
      </Button>
    </div>
  );
}

// ── Sidebar primitives ───────────────────────────────────────────────
function SidebarCard({
  icon, title, action, children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-2xl border p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          {icon}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 min-w-0">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-foreground/85 truncate">{value}</span>
    </div>
  );
}

function ActivityRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-bold tabular-nums text-foreground">{value}</span>
    </li>
  );
}
