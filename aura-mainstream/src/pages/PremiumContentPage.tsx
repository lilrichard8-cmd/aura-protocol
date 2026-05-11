import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Lock, Wallet, Heart, Share2, MessageCircle, Play, Key, Bookmark, Flag, Send } from 'lucide-react';
import { useGoBack } from '@/hooks/useGoBack';
import { Button } from '@/components/ui/button';
import UserAvatar from '@/components/UserAvatar';
import { Input } from '@/components/ui/input';
import type { Post } from '@/types';
import { posts } from '@/data/mock';
import { useMockChain } from '@/context/MockChainContext';
import { useUserPosts } from '@/hooks/useUserPosts';
import { useAuth } from '@/context/AuthContext';
import { useIsSelf } from '@/hooks/useIsSelf';
import { useToast } from '@/context/ToastContext';
import { useOraGuard } from '@/hooks/useOraGuard';
import ReportDialog from '@/components/common/ReportDialog';

export default function PremiumContentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // Smart back: returns to wherever the user navigated in from (passed via
  // location.state.from), falling back to the Content Keys tab if entry has
  // no state. Mirrors NftDetailPage's back UX.
  const goBack = useGoBack('/marketplace?tab=keys');
  const mockChain = useMockChain();
  const { showToast } = useToast();
  const oraGuard = useOraGuard();
  const [purchasing, setPurchasing] = useState(false);
  // 2026-05-11 R18: "unlocked" replaces the old `purchased` state. It's
  // true when the viewer is the creator (their own gated post) OR they
  // already own a Content Key for this post OR they just bought one
  // in this session. Drives the entire blur / CTA / preview flow.
  const [purchased, setPurchased] = useState(false);
  const [showKeyAnimation, setShowKeyAnimation] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [isCurated, setIsCurated] = useState(false);
  const [showReport, setShowReport] = useState(false);

  // 2026-05-11 R17: also search the current user's published posts when
  // resolving a /premium/:id route, otherwise user-published premium
  // content always rendered "Not Found" even though the Marketplace
  // surfaced it.
  // R18: derive whether the current viewer is the creator (no purchase
  // needed) or already owns a content key for this post (also unlocked).
  // Both paths short-circuit the buy CTA below.
  const { user: me } = useAuth();
  const myPosts = useUserPosts(me as any);
  const post: Post | undefined =
    location.state?.post
    || myPosts.find(p => p.id === id)
    || posts.find(p => p.id === id);

  useEffect(() => {
    if (post) {
      setLiked(post.isLiked);
      setLikeCount(post.likes);
    }
  }, [post?.id]);

  const isFollowing = mockChain.followingIds.includes(post?.author?.id || '');
  // 2026-05-11 R19: hide Follow buttons when the viewer authored the post.
  const isAuthorMe = useIsSelf(post?.author?.id);

  // 2026-05-11 R18: auto-unlock for creators (their own post) and
  // anyone who already holds a Content Key for this post. Without this,
  // the page asked the creator to buy their own work, which is absurd.
  const isOwner = !!(post && me && post.author?.id === me.id);
  const alreadyHasKey = !!(
    post && mockChain.ownedKeys?.some(k => k.contentId === post.id)
  );
  useEffect(() => {
    if (isOwner || alreadyHasKey) {
      setPurchased(true);
    }
  }, [isOwner, alreadyHasKey, post?.id]);

  // Removed: prev/next post arrows + ↑/↓ keyboard navigation. They jumped
  // into the generic post detail page (out of the Content Key context) and
  // were visually unclear. Exit via the back button after finishing a piece,
  // matching the NFT detail page UX.

  if (!post || !post.isPremium) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Content Not Found</h1>
          <Button onClick={() => navigate('/')}>Back to Home</Button>
        </div>
      </div>
    );
  }

  const handlePurchase = async () => {
    const cost = post.premiumPrice || 5;
    if (!oraGuard.ensure(cost, 'Content Key')) return;
    setPurchasing(true);
    try {
      await mockChain.buyContentKey(post.id, cost);
      setPurchasing(false);
      setShowKeyAnimation(true);
      setTimeout(() => {
        setShowKeyAnimation(false);
        setPurchased(true);
      }, 2000);
    } catch (err: any) {
      setPurchasing(false);
      if (/insufficient/i.test(err?.message ?? '')) {
        oraGuard.ensure(cost, 'Content Key');
      } else {
        showToast('error', 'Purchase failed', err.message || 'Try again');
      }
    }
  };

  const handleFollowToggle = () => {
    if (isFollowing) {
      mockChain.unfollowUser(post.author.id);
      showToast('info', 'Unfollowed', `Unfollowed ${post.author.displayName}`);
    } else {
      mockChain.followUser(post.author.id);
      showToast('success', 'Following!', `Now following ${post.author.displayName}`);
    }
  };

  const handleLike = () => {
    setLiked(l => !l);
    setLikeCount(c => liked ? c - 1 : c + 1);
  };

  const handleComment = () => {
    if (commentText.trim()) {
      showToast('success', 'Comment posted!', 'Your comment has been added');
      setCommentText('');
    }
  };

  const formatCount = (n: number) => n > 999 ? `${(n / 1000).toFixed(1)}k` : String(n);
  const creatorCut = ((post.premiumPrice || 5) * 0.95).toFixed(2);
  const protocolCut = ((post.premiumPrice || 5) * 0.05).toFixed(2);

  return (
    <>
    {/* Outer shell mirrors NftDetailPage / CoinDetailPage exactly: full-width,
        edge-to-edge, no max-w cap, with bottom padding for breathing room. */}
    <div className="pt-[60px] md:pt-2 pb-24 md:pb-4 min-h-screen">
      {/* Key Acquired Animation */}
      {showKeyAnimation && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-background rounded-2xl p-8 text-center shadow-xl animate-bounce">
            <div className="text-6xl mb-3">🔑</div>
            <h3 className="text-xl font-bold text-[#F59E0B]">Key Acquired!</h3>
            <p className="text-sm text-muted-foreground mt-1">Content unlocked</p>
          </div>
        </div>
      )}

      {/* Header — sticky, full-width. Same anchor as NftDetailPage so the
         floating mobile header doesn't overlap the back row. */}
      <div className="sticky top-[60px] md:top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="px-4 md:px-6 py-3 flex items-center gap-3">
          <button onClick={goBack} className="text-muted-foreground hover:text-foreground" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <UserAvatar src={post.author.avatar} displayName={post.author.displayName} username={post.author.username} className="w-7 h-7 rounded-full" />
            <span className="text-sm font-medium">{post.author.displayName}</span>
            {post.author.isVerified && <span className="text-aura text-xs">&#10003;</span>}
          </div>
          {!isAuthorMe && (
            <button
              onClick={handleFollowToggle}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${isFollowing ? 'bg-secondary text-foreground border border-border' : 'bg-aura text-white'}`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
      </div>

      {/* Main layout — left-aligned flush against the sidebar (same as
         NftDetailPage). 60/40 split lives on md+. */}
      <div className="px-4 md:px-6 py-4 md:py-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">

          {/* Left: Content (3/5) */}
          <div className="md:col-span-3 space-y-4">
            {/* Content Preview */}
            <div
              className="relative w-full bg-muted rounded-xl overflow-hidden"
              style={{ aspectRatio: post.aspectRatio || '3/4' }}
            >
              <img
                src={post.coverImage}
                alt={post.title}
                className="absolute inset-0 w-full h-full object-cover"
              />

              {/* Blur + lock overlay for unpurchased */}
              {!purchased && (
                <div className="absolute inset-0 backdrop-blur-lg bg-black/30 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-400/90 to-orange-500/90 flex items-center justify-center shadow-xl">
                      <Lock className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-white font-medium mb-3">Unlock to view full content</p>
                    <button
                      onClick={handlePurchase}
                      disabled={purchasing}
                      className="px-5 py-2.5 bg-gradient-to-r from-[#F59E0B] to-orange-500 text-white text-sm font-semibold rounded-full shadow-lg hover:scale-105 transition-transform disabled:opacity-50"
                    >
                      {purchasing ? 'Purchasing...' : `🔑 Buy for ${post.premiumPrice} ORA`}
                    </button>
                  </div>
                </div>
              )}

              {/* Video play button */}
              {post.type === 'video' && purchased && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                    <Play className="w-8 h-8 text-white ml-1" fill="white" />
                  </div>
                </div>
              )}
            </div>

            {/* Post info */}
            <div>
              <h1 className="text-xl md:text-2xl font-bold mb-2">{post.title}</h1>
              {post.content && <p className="text-muted-foreground leading-relaxed mb-3">{post.content}</p>}
              <div className="flex flex-wrap gap-2 mb-2">
                {post.tags.map(tag => (
                  <span key={tag} className="px-2 py-1 bg-secondary rounded-full text-xs text-muted-foreground">#{tag}</span>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{post.createdAt}</span>
            </div>

            {/* Action bar — integrated, not floating */}
            <div className="flex items-center gap-2 py-4 border-t border-b border-border flex-wrap">
              <button onClick={handleLike} className="flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-950/20 px-3 py-2 rounded-full transition-colors">
                <Heart className={`w-5 h-5 ${liked ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
                <span className="text-sm text-muted-foreground">{formatCount(likeCount)}</span>
              </button>
              <div className="flex items-center gap-2 px-3 py-2">
                <MessageCircle className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{formatCount(post.comments)}</span>
              </div>
              <button onClick={() => showToast('success', 'Shared!', 'Link copied')} className="flex items-center gap-2 hover:bg-green-50 dark:hover:bg-green-950/20 px-3 py-2 rounded-full transition-colors">
                <Share2 className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Share</span>
              </button>
              <button onClick={() => { setIsCurated(c => !c); showToast('success', isCurated ? 'Uncurated' : '✦ Curated!', isCurated ? 'Removed from curated' : 'Content added to curated'); }} className="flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-950/20 px-3 py-2 rounded-full transition-colors">
                <Bookmark className={`w-5 h-5 ${isCurated ? 'fill-blue-500 text-blue-500' : 'text-muted-foreground'}`} />
              </button>
              <button onClick={() => setShowReport(true)} className="flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-950/20 px-3 py-2 rounded-full transition-colors">
                <Flag className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Right: Sidebar (2/5) */}
          <div className="md:col-span-2 space-y-4">
            {/* Creator info */}
            <div className="bg-card rounded-xl p-4 border flex items-center gap-3">
              <div className="relative">
                <UserAvatar src={post.author.avatar} displayName={post.author.displayName} username={post.author.username} className="w-12 h-12 rounded-full" />
                {post.author.isVerified && (
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-background flex items-center justify-center">
                    <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" /></svg>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="font-semibold">{post.author.displayName}</div>
                <div className="text-xs text-muted-foreground">@{post.author.username} · {post.author.followers.toLocaleString()} followers</div>
              </div>
              {!isAuthorMe && (
                <button
                  onClick={handleFollowToggle}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${isFollowing ? 'bg-secondary text-foreground border border-border' : 'bg-aura text-white'}`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>

            {/* Content Key card */}
            <div className="bg-card rounded-xl p-5 border">
              <div className="flex items-center gap-2 mb-1">
                <Key className="w-5 h-5 text-[#F59E0B]" />
                <h3 className="font-bold text-lg">Content Key</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Buy once, own forever, resell anytime</p>

              {/* Price */}
              <div className="text-3xl font-bold mb-4">
                {post.premiumPrice} <span className="text-lg font-normal text-muted-foreground">ORA</span>
              </div>

              {/* Clean fee breakdown */}
              <div className="bg-secondary rounded-xl p-4 mb-4 space-y-3">
                {/* Progress bar */}
                <div className="flex h-3 rounded-full overflow-hidden">
                  <div className="bg-green-500 transition-all duration-500" style={{ width: '95%' }} />
                  <div className="bg-gray-500 transition-all duration-500" style={{ width: '5%' }} />
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">Creator receives</span>
                  </div>
                  <span className="font-semibold text-green-500">{creatorCut} ORA <span className="text-xs font-normal text-muted-foreground">(95%)</span></span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-500 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">Protocol fee</span>
                  </div>
                  <span className="font-medium">{protocolCut} ORA <span className="text-xs font-normal text-muted-foreground">(5%)</span></span>
                </div>
                <div className="pt-2 border-t border-border text-xs text-muted-foreground">
                  Resale royalty: 5% to original creator
                </div>
              </div>

              {/* Balance */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <Wallet className="w-4 h-4" />
                <span>Balance: {mockChain.oraBalance.toFixed(2)} ORA</span>
              </div>

              {/* 2026-05-11 R18: three states.
                 - isOwner  → "Your post" panel, no purchase.
                 - purchased (alreadyHasKey or just-bought) → Key Owned.
                 - otherwise → Buy CTA. */}
              {isOwner ? (
                <div className="text-center">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gradient-to-br from-aura to-purple-500 flex items-center justify-center">
                    <Key className="w-7 h-7 text-white" />
                  </div>
                  <h4 className="font-bold text-aura mb-1">Your post</h4>
                  <p className="text-xs text-muted-foreground mb-4">
                    You're the creator — you already have full access.
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={() => navigate(`/post/${post.id}`)} size="sm" className="flex-1 bg-aura hover:bg-aura-dark text-white">View Content</Button>
                    <Button variant="outline" size="sm" onClick={() => navigate('/studio?tab=content', { state: { from: location.pathname } })} className="flex-1">Manage in Studio</Button>
                  </div>
                </div>
              ) : purchased ? (
                <div className="text-center">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gradient-to-br from-[#10B981] to-green-500 flex items-center justify-center">
                    <Key className="w-7 h-7 text-white" />
                  </div>
                  <h4 className="font-bold text-[#10B981] mb-1">Key Owned!</h4>
                  <p className="text-xs text-muted-foreground mb-4">You own this Content Key — resell it anytime</p>
                  <div className="flex gap-2">
                    <Button onClick={() => navigate(`/post/${post.id}`)} size="sm" className="flex-1 bg-gradient-to-r from-[#10B981] to-green-600 text-white">View Content</Button>
                    <Button variant="outline" size="sm" onClick={() => navigate('/marketplace?tab=keys', { state: { from: location.pathname } })} className="flex-1">Resell</Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={handlePurchase}
                  disabled={purchasing}
                  className="w-full bg-gradient-to-r from-[#F59E0B] to-orange-500 text-white hover:from-yellow-600 hover:to-orange-600 disabled:opacity-50"
                  size="lg"
                >
                  {purchasing ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />Purchasing...</>
                  ) : (
                    <><Key className="w-4 h-4 mr-2" />Buy Content Key — {post.premiumPrice} ORA</>
                  )}
                </Button>
              )}
            </div>

            {/* What's included */}
            <div className="bg-card rounded-xl p-4 border">
              <h4 className="font-semibold mb-3 text-sm">What's Included</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">🔑 NFT Content Key — transferable & resellable</li>
                <li className="flex items-center gap-2">📺 Full HD content access</li>
                <li className="flex items-center gap-2">♾️ Permanent ownership on-chain</li>
                <li className="flex items-center gap-2">💰 Resell on marketplace anytime</li>
              </ul>
            </div>

            {/* Comment input */}
            {purchased && (
              <div className="bg-card rounded-xl p-4 border">
                <h4 className="font-semibold mb-3 text-sm">Join the Discussion</h4>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Add a comment..."
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    className="flex-1 h-9 rounded-full bg-secondary border-0 text-sm"
                    onKeyDown={e => e.key === 'Enter' && handleComment()}
                  />
                  <button onClick={handleComment} className="w-9 h-9 rounded-full bg-aura text-white flex items-center justify-center flex-shrink-0">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    <ReportDialog open={showReport} onClose={() => setShowReport(false)} postId={post?.id || ''} />
    </>
  );
}
