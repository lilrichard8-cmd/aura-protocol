import { useState, useRef, useEffect, useCallback } from 'react';
import VideoPlayer from '@/components/media/VideoPlayer';
import FeeBreakdown from '@/components/common/FeeBreakdown';
import UserAvatar from '@/components/UserAvatar';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, MessageCircle, Share2, Bookmark, Send, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, MoreHorizontal, Flag, X, Plus, Minus, Zap, Pin, FileText, GitBranch, Palette } from 'lucide-react';
import ReportDialog from '@/components/common/ReportDialog';
import { Input } from '@/components/ui/input';
import { posts, comments as defaultComments, currentUser } from '@/data/mock';
import { useUserPosts } from '@/hooks/useUserPosts';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { useAuth } from '@/context/AuthContext';
import type { Comment } from '@/types';
import { useToast } from '@/context/ToastContext';
import { useOraGuard } from '@/hooks/useOraGuard';
import { useIsSelf } from '@/hooks/useIsSelf';
import { useI18n } from '@/context/I18nContext';
import { useMockChain } from '@/context/MockChainContext';
import CurateModal from '@/components/curation/CurateModal';

export default function PostDetailPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { user: me } = useAuth();
  // User-published posts (localStorage). When the URL points to one of
  // these the lookup below resolves to the real post instead of
  // silently falling back to posts[0] (Iris's first post).
  const userPosts = useUserPosts(me as any);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const oraGuard = useOraGuard();
  const { user: authUser } = useAuth();
  const activeUser = authUser || currentUser;
  const post = userPosts.find(p => p.id === id)
    || posts.find(p => p.id === id)
    || posts[0];
  // 2026-05-11 R10: resolve IndexedDB media refs into blob: URLs so the
  // audio/video elements can actually play. Plain URLs pass through.
  const resolvedAudioUrl = useMediaUrl(post.audioUrl);
  const resolvedVideoUrl = useMediaUrl(post.videoUrl);
  const mockChain = useMockChain();
  // Persisted like state — reads from mockChain so the heart stays in sync
  // with the Profile "Liked" tab and survives reloads. Like count =
  // the post's seeded likes + 1 if the current user has liked it.
  const liked = (mockChain.likedPostIds || []).includes(post.id);
  const likeCount = (post.likes ?? 0) + (liked ? 1 : 0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [commentText, setCommentText] = useState('');
  // Persisted comments for this post, sourced from mockChain so they
  // survive navigation. Falls back to the legacy `defaultComments`
  // seed for empty-feed visuals when no real comments exist yet.
  const localComments: Comment[] = post
    ? (mockChain.postComments || [])
        .filter(c => c.postId === post.id)
        .map((c): Comment => ({
          id: c.id,
          author: {
            id: c.authorWallet,
            username: c.authorUsername,
            displayName: c.authorName,
            avatar: c.authorAvatar,
            bio: '',
            followers: 0,
            following: 0,
            isVerified: false,
          },
          content: c.content,
          likes: 0,
          isLiked: false,
          createdAt: 'just now',
          quotedAuthor: c.quotedAuthor,
          quotedUsername: c.quotedUsername,
          quotedContent: c.quotedContent,
        }))
    : defaultComments;
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showCurateModal, setShowCurateModal] = useState(false);
  const [curating, setCurating] = useState(false);
  const [isCurated, setIsCurated] = useState(mockChain.curatedContentIds.includes(post?.id || ''));
  const isFollowing = mockChain.followingIds.includes(post?.author?.id || '');
  // 2026-05-11 R19: hide Follow buttons on the viewer's own posts.
  const isAuthorMe = useIsSelf(post?.author?.id);
  const [followerCount, setFollowerCount] = useState(post?.author?.followers || 0);
  // Boost state
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [boostAmount, setBoostAmount] = useState(10);
  const [boosting, setBoosting] = useState(false);
  const isBoosted = mockChain.boostedContentIds.includes(post.id);
  const isPinned = mockChain.pinnedContentIds.includes(post.id);
  // License state
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const license = mockChain.licenses[post.id];
  const hasEmbedAccess = mockChain.embeddedContentIds.includes(post.id);
  const hasRemixAccess = mockChain.remixLicensedContentIds.includes(post.id);
  const [paying, setPaying] = useState<'embed' | 'remix' | null>(null);
  // Remix state
  const [showRemixConfirm, setShowRemixConfirm] = useState(false);
  const [remixing, setRemixing] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  // Comment reply state
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [showReplies, setShowReplies] = useState<Record<string, boolean>>({});
  const commentInputRef = useRef<HTMLInputElement>(null);
  // Real audio playback — fed by `resolvedAudioUrl` (data: or blob: URL)
  // when present, falls back to a fake-progress simulation so legacy
  // mock posts without audioUrl still show a working player surface.
  // 2026-05-11: rewired from a setInterval simulation to a real
  //   <audio> element so user-uploaded audio posts actually play.
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'one' | 'all'>('off');
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioFakeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const parseDuration = (d: string) => { const p = d.split(':'); return (parseInt(p[0])||0)*60 + (parseInt(p[1])||0); };
  const fallbackTotalSec = post.audioDuration ? parseDuration(post.audioDuration) : 200;
  const [realTotalSec, setRealTotalSec] = useState<number | null>(null);
  const totalSec = realTotalSec ?? fallbackTotalSec;
  const formatSec = (s: number) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;

  // Bind playback callbacks once the <audio> element mounts.
  useEffect(() => {
    const el = audioElRef.current;
    if (!el) return;
    const onTime = () => setAudioProgress(Math.floor(el.currentTime));
    const onMeta = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) setRealTotalSec(Math.round(el.duration));
    };
    const onEnd = () => {
      setAudioPlaying(false);
      if (repeatMode === 'one') {
        el.currentTime = 0;
        el.play().catch(() => undefined);
        setAudioPlaying(true);
      } else {
        setAudioProgress(0);
      }
    };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('ended', onEnd);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('ended', onEnd);
    };
  }, [resolvedAudioUrl, repeatMode]);

  const toggleAudioPlay = () => {
    const el = audioElRef.current;
    if (el && resolvedAudioUrl) {
      // Real path — drive the HTMLAudioElement directly.
      if (audioPlaying) {
        el.pause();
        setAudioPlaying(false);
      } else {
        el.play().then(() => setAudioPlaying(true)).catch(() => {
          // Autoplay blocked or invalid src — keep UI in sync.
          setAudioPlaying(false);
        });
      }
      return;
    }
    // Fallback fake-progress simulation for legacy posts without audioUrl.
    if (audioPlaying) {
      if (audioFakeIntervalRef.current) clearInterval(audioFakeIntervalRef.current);
      audioFakeIntervalRef.current = null;
      setAudioPlaying(false);
    } else {
      setAudioPlaying(true);
      audioFakeIntervalRef.current = setInterval(() => {
        setAudioProgress(p => {
          if (p >= totalSec) {
            clearInterval(audioFakeIntervalRef.current!);
            setAudioPlaying(false);
            return 0;
          }
          return p + 1;
        });
      }, 1000);
    }
  };

  // Click-on-progress-bar seek for real audio.
  const seekAudioTo = (frac: number) => {
    const clamped = Math.max(0, Math.min(1, frac));
    if (audioElRef.current && resolvedAudioUrl) {
      const t = clamped * (realTotalSec ?? audioElRef.current.duration ?? 0);
      audioElRef.current.currentTime = t;
      setAudioProgress(Math.floor(t));
    } else {
      setAudioProgress(Math.round(clamped * totalSec));
    }
  };

  const images = post.images || (post.coverImage ? [post.coverImage] : []);

  // Post navigation (TikTok-style)
  const postIndex = posts.findIndex(p => p.id === post.id);
  const vertTouchStart = useRef(0);
  const handleNavPrev = useCallback(() => {
    if (postIndex > 0) navigate(`/post/${posts[postIndex - 1].id}`);
  }, [postIndex, navigate]);
  const handleNavNext = useCallback(() => {
    if (postIndex < posts.length - 1) navigate(`/post/${posts[postIndex + 1].id}`);
  }, [postIndex, navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') handleNavPrev();
      if (e.key === 'ArrowDown') handleNavNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleNavPrev, handleNavNext]);

  const handleLike = () => {
    const wasLiked = liked;
    mockChain.toggleLikePost?.(post.id);
    showToast(
      'success',
      wasLiked ? 'Unliked' : 'Liked!',
      `Post ${wasLiked ? 'removed from' : 'added to'} your favorites`,
    );
    // Note: liking someone else's post is *outbound* — the recipient (the
    // post's author) is the one who would receive a notification. We
    // never notify the current user about their own outbound action.
  };

  const handleComment = () => {
    if (!post) return;
    if (commentText.trim()) {
      const text = replyingTo ? `@reply ${commentText.trim()}` : commentText.trim();
      // Persist on the mockChain so the comment survives navigation and
      // refreshes (replaces the old `localComments` useState which was
      // wiped on every page mount).
      mockChain.addPostComment({
        postId: post.id,
        authorWallet: mockChain.publicKey || mockChain.walletAddress || activeUser.id,
        authorName: activeUser.displayName,
        authorUsername: activeUser.username,
        authorAvatar: activeUser.avatar,
        content: text,
        replyTo: replyingTo ?? undefined,
      });
      showToast('success', 'Comment posted!', 'Your comment has been added');
      setCommentText('');
      setReplyingTo(null);
      // Demo behaviour: when the current user comments under someone else's
      // post, simulate the post's author engaging back — first a like, then
      // a reply. Both arrive as notifications to the current user, and the
      // reply is also persisted as a real comment with the user's text
      // captured as a quote block.
      if (post.author && post.author.id !== activeUser.id) {
        mockChain.simulateAuthorReplyToComment({
          postId: post.id,
          postTitle: post.title,
          postAuthor: post.author,
          commenterUsername: activeUser.username,
          commenterDisplayName: activeUser.displayName,
          commentText: text,
        });
      }
    }
  };

  const handleReply = (commentId: string) => {
    setReplyingTo(commentId);
    setCommentText('');
    setTimeout(() => commentInputRef.current?.focus(), 100);
  };

  const handleScrollToComments = () => {
    commentInputRef.current?.focus();
  };

  const handleCurate = () => {
    setShowCurateModal(true);
  };

  const handleBoost = async () => {
    if (!oraGuard.ensure(boostAmount, 'Boost')) return;
    setBoosting(true);
    try {
      await mockChain.boostContent(post.id, boostAmount);
      setShowBoostModal(false);
      showToast('success', '⚡ Boosted!', `${boostAmount} ORA spent — 90% burned, 5% staked, 5% ops`);
    } catch (e: any) {
      // Re-route insufficient-balance errors through the guard so the CTA appears
      // even if the chain check fires before our pre-flight (race / stale state).
      if (/insufficient/i.test(e?.message ?? '')) {
        oraGuard.ensure(boostAmount, 'Boost');
      } else {
        showToast('error', 'Boost failed', e.message);
      }
    } finally {
      setBoosting(false);
    }
  };

  const handlePin = () => {
    mockChain.pinContent(post.id);
    showToast('success', '📌 Pinned!', 'Content pinned to your profile');
  };

  const handlePayEmbed = async () => {
    if (!license) return;
    if (!oraGuard.ensure(license.embedPrice, 'Embed license')) return;
    setPaying('embed');
    try {
      await mockChain.payToEmbed(post.id);
      showToast('success', '✅ Embed Access Granted', `Paid ${license.embedPrice} ORA`);
    } catch (e: any) {
      if (/insufficient/i.test(e?.message ?? '')) {
        oraGuard.ensure(license.embedPrice, 'Embed license');
      } else {
        showToast('error', 'Payment failed', e.message);
      }
    } finally {
      setPaying(null);
    }
  };

  const handlePayRemix = async () => {
    if (!license) return;
    if (!oraGuard.ensure(license.remixPrice, 'Remix license')) return;
    setPaying('remix');
    try {
      await mockChain.payToRemix(post.id);
      showToast('success', '✅ Remix License Granted', `Paid ${license.remixPrice} ORA`);
    } catch (e: any) {
      if (/insufficient/i.test(e?.message ?? '')) {
        oraGuard.ensure(license.remixPrice, 'Remix license');
      } else {
        showToast('error', 'Payment failed', e.message);
      }
    } finally {
      setPaying(null);
    }
  };

  const handleCreateRemix = async () => {
    setRemixing(true);
    try {
      await mockChain.createRemix(post.id, post.author.displayName);
      setShowRemixConfirm(false);
      showToast('success', '🎵 Remix Created!', 'Your remix is now in your Remix list');
    } catch (e: any) {
      showToast('error', 'Remix failed', e.message);
    } finally {
      setRemixing(false);
    }
  };

  const handleFollowToggle = () => {
    if (isFollowing) {
      mockChain.unfollowUser(post.author.id);
      setFollowerCount(c => c - 1);
      showToast('info', 'Unfollowed', `You unfollowed ${post.author.displayName}`);
    } else {
      mockChain.followUser(post.author.id);
      setFollowerCount(c => c + 1);
      showToast('success', 'Following!', `You are now following ${post.author.displayName}`);
    }
  };

  const prevImage = () => setCurrentImageIndex(i => Math.max(0, i - 1));
  const nextImage = () => setCurrentImageIndex(i => Math.min(images.length - 1, i + 1));

  // Handle touch swipe
  const touchStartX = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 50) nextImage();
    if (diff < -50) prevImage();
  };

  // Video/Live detail (Full screen mobile style)
  // Video/Live detail - Left(60%) video + Right(40%) interactions
  if (post.type === 'video' || post.type === 'live') {
    return (
      <>
        {/* Desktop Layout */}
        <div className="hidden md:flex min-h-screen">
          {/* Left Side - Video (60%) */}
          <div className="flex-[3] lg:flex-[3] bg-black flex items-center justify-center relative">
            <button onClick={() => navigate(-1)} className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="relative w-full h-full">
              <VideoPlayer src={resolvedVideoUrl ?? undefined} poster={post.coverImage} className="w-full h-full" />
              {post.type === 'live' && (
                <div className="absolute top-4 right-4 z-10 flex items-center gap-1 px-3 py-1.5 rounded-md bg-red-500 text-white text-xs font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
                </div>
              )}
            </div>
          </div>
          {/* Right Side - Interactions (40%) — exact same as photo detail */}
          <div className="flex-[2] lg:flex-[2] bg-background flex flex-col">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UserAvatar src={post.author.avatar} displayName={post.author.displayName} username={post.author.username} className="w-10 h-10 rounded-full" />
                  <div>
                    <div className="flex items-center gap-1"><span className="font-semibold">{post.author.displayName}</span>{post.author.isVerified && <span className="text-aura text-sm">&#10003;</span>}</div>
                    <span className="text-sm text-muted-foreground">@{post.author.username}</span>
                  </div>
                </div>
                {!isAuthorMe && (<button onClick={handleFollowToggle} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${isFollowing ? 'bg-secondary text-foreground border border-border' : 'bg-aura text-white hover:bg-aura-dark'}`}>{isFollowing ? 'Following' : 'Follow'}</button>)}
              </div>
              <div className="mt-4">
                <h1 className="text-xl font-bold mb-2">{post.title}</h1>
                {post.content && <p className="text-foreground/80 leading-relaxed mb-3">{post.content}</p>}
                <div className="flex flex-wrap gap-2 mb-3">{post.tags.map(tag => <span key={tag} className="text-sm text-aura font-medium hover:text-aura-dark cursor-pointer">#{tag}</span>)}</div>
                <span className="text-sm text-muted-foreground">{post.createdAt}</span>
              </div>
              <div className="flex items-center gap-6 mt-6">
                <button onClick={handleLike} className="flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-full transition-colors"><Heart className={`w-5 h-5 ${liked ? 'fill-red-500 text-red-500' : 'text-muted-foreground hover:text-red-500'}`} /><span className={`text-sm ${liked ? 'text-red-500' : 'text-muted-foreground'}`}>{likeCount}</span></button>
                <div className="flex items-center gap-2"><MessageCircle className="w-5 h-5 text-muted-foreground" /><span className="text-sm text-muted-foreground">{post.comments}</span></div>
                <button onClick={() => showToast('success', 'Shared!', 'Post shared')} className="flex items-center gap-2 hover:bg-green-50 dark:hover:bg-green-900/20 px-3 py-2 rounded-full transition-colors"><Share2 className="w-5 h-5 text-muted-foreground hover:text-green-500" /><span className="text-sm text-muted-foreground">{post.shares}</span></button>
                <button onClick={handleCurate} className="flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-2 rounded-full transition-colors"><Palette className="w-5 h-5 text-muted-foreground hover:text-blue-500" /></button>
                <button onClick={() => setShowReport(true)} className="flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-full transition-colors"><Flag className="w-5 h-5 text-muted-foreground hover:text-red-500" /></button>
                <button onClick={() => setShowBoostModal(true)} className="flex items-center gap-1.5 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 px-3 py-2 rounded-full transition-colors"><Zap className={`w-5 h-5 ${isBoosted ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`} /><span className="text-xs text-muted-foreground">{isBoosted ? '⚡ Boosted' : 'Boost'}</span></button>
                <button onClick={handlePin} disabled={isPinned} className="flex items-center gap-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-2 rounded-full transition-colors disabled:opacity-60"><Pin className={`w-5 h-5 ${isPinned ? 'text-blue-400' : 'text-muted-foreground'}`} /></button>
                <button onClick={() => setShowLicenseModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-secondary transition-colors"><FileText className="w-5 h-5 text-muted-foreground" /></button>
                {license && <button onClick={() => setShowRemixConfirm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"><GitBranch className="w-5 h-5 text-green-500" /><span className="text-xs text-green-500">Remix</span></button>}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto"><div className="p-6 space-y-6"><h3 className="font-semibold text-lg">Comments ({localComments.length})</h3>{localComments.map(comment => (<div key={comment.id}><div className="flex items-start gap-3"><UserAvatar src={comment.author.avatar} displayName={comment.author.displayName} username={comment.author.username} className="w-8 h-8 rounded-full" /><div className="flex-1"><div className="flex items-center gap-2"><span className="font-semibold text-sm">{comment.author.displayName}</span><span className="text-xs text-muted-foreground">{comment.createdAt}</span></div>{comment.quotedAuthor && comment.quotedContent && (<div className="mt-1.5 mb-2 pl-3 py-2 border-l-2 border-aura/40 bg-secondary/40 rounded-r-md text-xs"><div className="text-[10px] font-semibold text-muted-foreground mb-0.5">@{comment.quotedUsername || comment.quotedAuthor} said:</div><p className="text-muted-foreground leading-snug">{comment.quotedContent}</p></div>)}<p className="text-sm mt-1 leading-relaxed">{comment.content}</p><div className="flex items-center gap-4 mt-2"><button className="flex items-center gap-1 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded-full transition-colors"><Heart className={`w-4 h-4 ${comment.isLiked ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} /><span className="text-xs text-muted-foreground">{comment.likes}</span></button><button onClick={() => handleReply(comment.id)} className="text-xs text-muted-foreground hover:text-foreground">Reply</button></div>{comment.replies?.map(reply => (<div key={reply.id} className="flex items-start gap-2 mt-3 pl-4 border-l-2 border-border"><UserAvatar src={reply.author.avatar} displayName={reply.author.displayName} username={reply.author.username} className="w-6 h-6 rounded-full" /><div><div className="flex items-center gap-1"><span className="text-xs font-semibold">{reply.author.displayName}</span><span className="text-[10px] text-muted-foreground">{reply.createdAt}</span></div><p className="text-sm mt-1">{reply.content}</p></div></div>))}</div></div></div>))}</div></div>
            <div className="p-6 border-t border-border"><div className="flex items-center gap-3"><Input ref={commentInputRef} placeholder="Add a comment..." value={commentText} onChange={(e) => setCommentText(e.target.value)} className="flex-1 h-10 rounded-full bg-secondary border-0" onKeyDown={(e) => e.key === 'Enter' && handleComment()} /><button onClick={handleComment} className="w-10 h-10 rounded-full flex items-center justify-center bg-aura text-white flex-shrink-0 hover:bg-aura-dark transition-colors"><Send className="w-4 h-4" /></button></div></div>
          </div>
        </div>
        {/* Mobile: TikTok-style fullscreen */}
        <div className="md:hidden min-h-screen bg-black relative">
          <button onClick={() => navigate(-1)} className="absolute top-4 left-4 z-50 w-8 h-8 rounded-full bg-black/30 flex items-center justify-center"><ArrowLeft className="w-4 h-4 text-white" /></button>
          <div className="relative w-full h-screen">
            <VideoPlayer src={resolvedVideoUrl ?? undefined} poster={post.coverImage} className="w-full h-full" />
            {post.type === 'live' && <div className="absolute top-4 right-4 z-10 flex items-center gap-1 px-2 py-1 rounded-md bg-red-500 text-white text-xs font-bold"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />LIVE</div>}
            <div className="absolute right-3 bottom-32 flex flex-col items-center gap-5">
              <UserAvatar src={post.author.avatar} displayName={post.author.displayName} username={post.author.username} className="w-10 h-10 rounded-full border-2 border-white" />
              <button onClick={handleLike} className="flex flex-col items-center gap-1"><Heart className={`w-7 h-7 ${liked ? 'fill-red-500 text-red-500' : 'text-white'}`} /><span className="text-white text-[10px]">{likeCount}</span></button>
              <button onClick={handleScrollToComments} className="flex flex-col items-center gap-1"><MessageCircle className="w-7 h-7 text-white" /><span className="text-white text-[10px]">{post.comments}</span></button>
              <button onClick={() => { navigator.clipboard.writeText(window.location.href); showToast('success', 'Link copied!', 'Share link copied to clipboard'); }} className="flex flex-col items-center gap-1"><Share2 className="w-7 h-7 text-white" /><span className="text-white text-[10px]">{post.shares}</span></button>
              <button onClick={handleCurate} className="flex flex-col items-center gap-1"><Palette className="w-7 h-7 text-white" /><span className="text-white text-[10px]">Curate</span></button>
            </div>
            <div className="absolute bottom-6 left-4 right-16">
              <p className="text-white font-semibold text-sm">@{post.author.username}</p>
              <p className="text-white/80 text-xs mt-1">{post.title}</p>
              <div className="flex flex-wrap gap-1 mt-2">{post.tags.map(tag => <span key={tag} className="text-white/60 text-[10px]">#{tag}</span>)}</div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Audio detail page
  // Audio detail - Left(60%) player + Right(40%) interactions (same as photo)
  if (post.type === 'audio') {
    return (
      <>
        {/* Hidden HTMLAudioElement that drives real playback. Sits at the
            top of the fragment so it mounts before the player chrome
            attaches its ref-based listeners. */}
        {resolvedAudioUrl && (
          <audio
            ref={audioElRef}
            src={resolvedAudioUrl}
            preload="metadata"
            style={{ display: 'none' }}
          />
        )}
        {/* Desktop Layout */}
        <div className="hidden md:flex min-h-screen">
          {/* Left Side - Audio Player (60%) */}
          <div className="flex-[3] bg-gradient-to-br from-gray-900 via-purple-950/80 to-gray-900 flex flex-col relative overflow-hidden">
            <button onClick={() => navigate(-1)} className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>

            {/* Full-size Album Art */}
            <div className="flex-1 relative">
              {post.coverImage ? (
                <img src={post.coverImage} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-800 to-indigo-900 flex items-center justify-center">
                  <Bookmark className="w-32 h-32 text-purple-300/20" />
                </div>
              )}
              {/* Gradient overlay at bottom for player controls */}
              <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
            </div>

            {/* Player Controls - Spotify/Apple Music style, overlaid on bottom */}
            <div className="absolute inset-x-0 bottom-0 p-6 lg:p-8">
              {/* Track Info */}
              <div className="mb-4">
                <h1 className="text-xl lg:text-2xl font-bold text-white truncate">{post.title}</h1>
                {post.content && <p className="text-white/60 text-sm mt-1 truncate">{post.content}</p>}
              </div>

              {/* Progress Bar */}
              <div className="mb-3">
                <div className="group relative h-1 rounded-full bg-white/20 w-full cursor-pointer hover:h-1.5 transition-all" onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); const frac = (e.clientX - rect.left) / rect.width; seekAudioTo(frac); }}>
                  <div className="h-full rounded-full bg-white transition-all" style={{width: `${totalSec > 0 ? (audioProgress / totalSec) * 100 : 0}%`}} />
                  <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity" style={{left: `${totalSec > 0 ? (audioProgress / totalSec) * 100 : 0}%`}} />
                </div>
                <div className="flex justify-between text-[11px] text-white/40 mt-1.5">
                  <span>{formatSec(audioProgress)}</span>
                  <span>{post.audioDuration || '0:00'}</span>
                </div>
              </div>

              {/* Transport Controls */}
              <div className="flex items-center justify-center gap-8">
                {/* Shuffle */}
                <button onClick={() => setShuffle(s => !s)} className={`${shuffle ? 'text-green-400' : 'text-white/40'} hover:text-white transition-colors`}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>
                </button>
                {/* Previous */}
                <button onClick={() => seekAudioTo(0)} className="text-white/70 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                </button>
                {/* Play/Pause */}
                <button onClick={toggleAudioPlay} className="w-12 h-12 rounded-full bg-white flex items-center justify-center hover:scale-105 transition-transform active:scale-95">
                  {audioPlaying
                    ? <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                    : <svg className="w-5 h-5 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
                </button>
                {/* Next */}
                <button onClick={() => seekAudioTo(0)} className="text-white/70 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                </button>
                {/* Repeat */}
                <button onClick={() => setRepeatMode(m => m === 'off' ? 'one' : m === 'one' ? 'all' : 'off')} className={`${repeatMode !== 'off' ? 'text-green-400' : 'text-white/40'} hover:text-white transition-colors relative`}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
                  {repeatMode === 'one' && <span className="absolute -top-1 -right-1 text-[8px] font-bold text-green-400">1</span>}
                </button>
              </div>
            </div>
          </div>
          {/* Right Side - Interactions (40%) — exact same as photo detail */}
          <div className="flex-[2] lg:flex-[2] bg-background flex flex-col">
            {/* Post Header */}
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UserAvatar src={post.author.avatar} displayName={post.author.displayName} username={post.author.username} className="w-10 h-10 rounded-full" />
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold">{post.author.displayName}</span>
                      {post.author.isVerified && <span className="text-aura text-sm">&#10003;</span>}
                    </div>
                    <span className="text-sm text-muted-foreground">@{post.author.username}</span>
                  </div>
                </div>
                {!isAuthorMe && (<button onClick={handleFollowToggle} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${isFollowing ? 'bg-secondary text-foreground border border-border' : 'bg-aura text-white hover:bg-aura-dark'}`}>
                  {isFollowing ? 'Following' : 'Follow'}
                </button>)}
              </div>

              <div className="mt-4">
                <h1 className="text-xl font-bold mb-2">{post.title}</h1>
                {post.content && (
                  <p className="text-foreground/80 leading-relaxed mb-3">{post.content}</p>
                )}
                <div className="flex flex-wrap gap-2 mb-3">
                  {post.tags.map(tag => (
                    <span key={tag} className="text-sm text-aura font-medium hover:text-aura-dark cursor-pointer">#{tag}</span>
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">{post.createdAt}</span>
              </div>

              {/* Interaction Buttons */}
              <div className="flex items-center gap-6 mt-6">
                <button onClick={handleLike} className="flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-full transition-colors">
                  <Heart className={`w-5 h-5 ${liked ? 'fill-red-500 text-red-500' : 'text-muted-foreground hover:text-red-500'}`} />
                  <span className={`text-sm ${liked ? 'text-red-500' : 'text-muted-foreground'}`}>{likeCount}</span>
                </button>
                <div className="flex items-center gap-2"><MessageCircle className="w-5 h-5 text-muted-foreground" /><span className="text-sm text-muted-foreground">{post.comments}</span></div>
                <button onClick={() => showToast('success', 'Shared!', 'Post shared to your network')} className="flex items-center gap-2 hover:bg-green-50 dark:hover:bg-green-900/20 px-3 py-2 rounded-full transition-colors">
                  <Share2 className="w-5 h-5 text-muted-foreground hover:text-green-500" />
                  <span className="text-sm text-muted-foreground hover:text-green-500">{post.shares}</span>
                </button>
                <button onClick={handleCurate} className="flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-2 rounded-full transition-colors">
                  <Palette className="w-5 h-5 text-muted-foreground hover:text-blue-500" />
                </button>
                <button onClick={() => setShowReport(true)} className="flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-full transition-colors">
                  <Flag className="w-5 h-5 text-muted-foreground hover:text-red-500" />
                </button>
                <button onClick={() => setShowBoostModal(true)} className="flex items-center gap-1.5 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 px-3 py-2 rounded-full transition-colors">
                  <Zap className={`w-5 h-5 ${isBoosted ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`} />
                  <span className="text-xs text-muted-foreground">{isBoosted ? '⚡ Boosted' : 'Boost'}</span>
                </button>
                <button onClick={handlePin} disabled={isPinned} className="flex items-center gap-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-2 rounded-full transition-colors disabled:opacity-60">
                  <Pin className={`w-5 h-5 ${isPinned ? 'text-blue-400' : 'text-muted-foreground'}`} />
                </button>
                <button onClick={() => setShowLicenseModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-secondary transition-colors">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                </button>
                {license && <button onClick={() => setShowRemixConfirm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
                  <GitBranch className="w-5 h-5 text-green-500" />
                  <span className="text-xs text-green-500">Remix</span>
                </button>}
              </div>
            </div>

            {/* Comments Section - Scrollable */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                <h3 className="font-semibold text-lg">Comments ({localComments.length})</h3>
                {localComments.map(comment => (
                  <div key={comment.id}>
                    <div className="flex items-start gap-3">
                      <UserAvatar src={comment.author.avatar} displayName={comment.author.displayName} username={comment.author.username} className="w-8 h-8 rounded-full" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{comment.author.displayName}</span>
                          <span className="text-xs text-muted-foreground">{comment.createdAt}</span>
                        </div>
                        {comment.quotedAuthor && comment.quotedContent && (<div className="mt-1.5 mb-2 pl-3 py-2 border-l-2 border-aura/40 bg-secondary/40 rounded-r-md text-xs"><div className="text-[10px] font-semibold text-muted-foreground mb-0.5">@{comment.quotedUsername || comment.quotedAuthor} said:</div><p className="text-muted-foreground leading-snug">{comment.quotedContent}</p></div>)}<p className="text-sm mt-1 leading-relaxed">{comment.content}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <button className="flex items-center gap-1 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded-full transition-colors">
                            <Heart className={`w-4 h-4 ${comment.isLiked ? 'fill-red-500 text-red-500' : 'text-muted-foreground hover:text-red-500'}`} />
                            <span className="text-xs text-muted-foreground">{comment.likes}</span>
                          </button>
                          <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">Reply</button>
                        </div>
                        {comment.replies?.map(reply => (
                          <div key={reply.id} className="flex items-start gap-2 mt-3 pl-4 border-l-2 border-border">
                            <UserAvatar src={reply.author.avatar} displayName={reply.author.displayName} username={reply.author.username} className="w-6 h-6 rounded-full" />
                            <div>
                              <div className="flex items-center gap-1">
                                <span className="text-xs font-semibold">{reply.author.displayName}</span>
                                <span className="text-[10px] text-muted-foreground">{reply.createdAt}</span>
                              </div>
                              <p className="text-sm mt-1">{reply.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Comment Input */}
            <div className="p-6 border-t border-border">
              <div className="flex items-center gap-3">
                <Input
                  placeholder="Add a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="flex-1 h-10 rounded-full bg-secondary border-0"
                  onKeyDown={(e) => e.key === 'Enter' && handleComment()}
                />
                <button onClick={handleComment} className="w-10 h-10 rounded-full flex items-center justify-center bg-aura text-white flex-shrink-0 hover:bg-aura-dark transition-colors">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
        {/* Mobile: keep simple centered layout */}
        <div className="md:hidden min-h-screen bg-background pb-16">
          <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3"><button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></button><span className="font-semibold text-sm">Audio</span></div>
          <div className="px-4 py-6 flex flex-col items-center">
            <div className="w-56 h-56 rounded-2xl overflow-hidden shadow-2xl mb-6">{post.coverImage ? <img src={post.coverImage} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-purple-900 flex items-center justify-center"><Bookmark className="w-16 h-16 text-purple-300/40" /></div>}</div>
            <h1 className="text-xl font-bold mb-1">{post.title}</h1>
            {post.content && <p className="text-muted-foreground text-sm mb-4">{post.content}</p>}
            <button onClick={toggleAudioPlay} className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-xl mb-4">{audioPlaying ? <svg className="w-7 h-7 text-white" fill="white" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : <svg className="w-7 h-7 text-white ml-0.5" fill="white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}</button>
            <div className="w-full max-w-xs"><div className="h-1 rounded-full bg-secondary mb-1"><div className="h-full rounded-full bg-purple-500" style={{width:'0%'}} /></div><div className="flex justify-between text-xs text-muted-foreground"><span>0:00</span><span>{post.audioDuration || '0:00'}</span></div></div>
          </div>
          <div className="px-4 py-3 border-t border-b border-border flex items-center justify-around">
            <button onClick={handleLike} className="flex items-center gap-1.5"><Heart className={`w-5 h-5 ${liked ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} /><span className="text-xs">{likeCount}</span></button>
            <div className="flex items-center gap-1.5"><MessageCircle className="w-5 h-5 text-muted-foreground" /><span className="text-xs">{post.comments}</span></div>
            <button onClick={() => showToast('success','Shared!','Post shared')}><div className="flex items-center gap-1.5"><Share2 className="w-5 h-5 text-muted-foreground" /><span className="text-xs">{post.shares}</span></div></button>
            <button onClick={handleCurate}><div className="flex items-center gap-1.5"><Palette className="w-5 h-5 text-muted-foreground" /><span className="text-xs">Curate</span></div></button>
          </div>
        </div>
        {/* Curate Modal */}
        <CurateModal
          open={showCurateModal}
          post={post}
          onClose={() => setShowCurateModal(false)}
          onCurated={() => setIsCurated(true)}
        />
      </>
    );
  }

  // Text detail - Desktop: Left(60%) reading pane + Right(40%) interactions (same as photo)
  if (post.type === 'text') {
    return (
      <>
        {/* Desktop Layout */}
        <div className="hidden md:flex min-h-screen">
          {/* Left Side - Text Reading Pane (60%) */}
          <div className="flex-[3] bg-background border-r border-border flex flex-col relative">
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4 flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></button>
              <span className="text-sm font-semibold text-muted-foreground">Thread</span>
            </div>
            <div className="flex-1 overflow-y-auto px-8 py-8 max-w-2xl">
              <article>
                <h1 className="text-3xl font-bold mb-6 leading-tight">{post.title}</h1>
                <div className="text-lg leading-relaxed whitespace-pre-wrap text-foreground/90">{post.content}</div>
              </article>
              <div className="flex flex-wrap gap-2 mt-8">
                {post.tags.map(tag => (
                  <span key={tag} className="px-3 py-1 bg-secondary rounded-full text-sm text-aura">#{tag}</span>
                ))}
              </div>
            </div>
          </div>
          {/* Right Side - Interactions (40%) — exact same as photo detail */}
          <div className="flex-[2] bg-background flex flex-col">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UserAvatar src={post.author.avatar} displayName={post.author.displayName} username={post.author.username} className="w-10 h-10 rounded-full" />
                  <div>
                    <div className="flex items-center gap-1"><span className="font-semibold">{post.author.displayName}</span>{post.author.isVerified && <span className="text-aura text-sm">&#10003;</span>}</div>
                    <span className="text-sm text-muted-foreground">@{post.author.username}</span>
                  </div>
                </div>
                {!isAuthorMe && (<button onClick={handleFollowToggle} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${isFollowing ? 'bg-secondary text-foreground border border-border' : 'bg-aura text-white hover:bg-aura-dark'}`}>{isFollowing ? 'Following' : 'Follow'}</button>)}
              </div>
              <div className="mt-4">
                <h1 className="text-xl font-bold mb-2">{post.title}</h1>
                {post.content && <p className="text-foreground/80 leading-relaxed mb-3 line-clamp-3">{post.content}</p>}
                <div className="flex flex-wrap gap-2 mb-3">{post.tags.map(tag => <span key={tag} className="text-sm text-aura font-medium cursor-pointer">#{tag}</span>)}</div>
                <span className="text-sm text-muted-foreground">{post.createdAt}</span>
              </div>
              <div className="flex flex-wrap items-center gap-6 mt-6">
                <button onClick={handleLike} className="flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-full transition-colors"><Heart className={`w-5 h-5 ${liked ? 'fill-red-500 text-red-500' : 'text-muted-foreground hover:text-red-500'}`} /><span className={`text-sm ${liked ? 'text-red-500' : 'text-muted-foreground'}`}>{likeCount}</span></button>
                <div className="flex items-center gap-2"><MessageCircle className="w-5 h-5 text-muted-foreground" /><span className="text-sm text-muted-foreground">{post.comments}</span></div>
                <button onClick={() => showToast('success', 'Shared!', 'Post shared to your network')} className="flex items-center gap-2 hover:bg-green-50 dark:hover:bg-green-900/20 px-3 py-2 rounded-full transition-colors"><Share2 className="w-5 h-5 text-muted-foreground hover:text-green-500" /><span className="text-sm text-muted-foreground">{post.shares}</span></button>
                <button onClick={handleCurate} className="flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-2 rounded-full transition-colors"><Palette className="w-5 h-5 text-muted-foreground hover:text-blue-500" /></button>
                <button onClick={() => setShowReport(true)} className="flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-full transition-colors"><Flag className="w-5 h-5 text-muted-foreground hover:text-red-500" /></button>
                <button onClick={() => setShowBoostModal(true)} className="flex items-center gap-1.5 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 px-3 py-2 rounded-full transition-colors"><Zap className={`w-5 h-5 ${isBoosted ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`} /><span className="text-xs text-muted-foreground">{isBoosted ? '⚡ Boosted' : 'Boost'}</span></button>
                <button onClick={handlePin} disabled={isPinned} className="flex items-center gap-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-2 rounded-full transition-colors disabled:opacity-60"><Pin className={`w-5 h-5 ${isPinned ? 'text-blue-400' : 'text-muted-foreground'}`} /></button>
                <button onClick={() => setShowLicenseModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-secondary transition-colors"><FileText className="w-5 h-5 text-muted-foreground" /></button>
                {license && <button onClick={() => setShowRemixConfirm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"><GitBranch className="w-5 h-5 text-green-500" /><span className="text-xs text-green-500">Remix</span></button>}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto"><div className="p-6 space-y-6"><h3 className="font-semibold text-lg">Comments ({localComments.length})</h3>{localComments.map(comment => (<div key={comment.id}><div className="flex items-start gap-3"><UserAvatar src={comment.author.avatar} displayName={comment.author.displayName} username={comment.author.username} className="w-8 h-8 rounded-full" /><div className="flex-1"><div className="flex items-center gap-2"><span className="font-semibold text-sm">{comment.author.displayName}</span><span className="text-xs text-muted-foreground">{comment.createdAt}</span></div>{comment.quotedAuthor && comment.quotedContent && (<div className="mt-1.5 mb-2 pl-3 py-2 border-l-2 border-aura/40 bg-secondary/40 rounded-r-md text-xs"><div className="text-[10px] font-semibold text-muted-foreground mb-0.5">@{comment.quotedUsername || comment.quotedAuthor} said:</div><p className="text-muted-foreground leading-snug">{comment.quotedContent}</p></div>)}<p className="text-sm mt-1 leading-relaxed">{comment.content}</p><div className="flex items-center gap-4 mt-2"><button className="flex items-center gap-1 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded-full transition-colors"><Heart className={`w-4 h-4 ${comment.isLiked ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} /><span className="text-xs text-muted-foreground">{comment.likes}</span></button><button onClick={() => handleReply(comment.id)} className="text-xs text-muted-foreground hover:text-foreground">Reply</button></div>{comment.replies?.map(reply => (<div key={reply.id} className="flex items-start gap-2 mt-3 pl-4 border-l-2 border-border"><UserAvatar src={reply.author.avatar} displayName={reply.author.displayName} username={reply.author.username} className="w-6 h-6 rounded-full" /><div><div className="flex items-center gap-1"><span className="text-xs font-semibold">{reply.author.displayName}</span><span className="text-[10px] text-muted-foreground">{reply.createdAt}</span></div><p className="text-sm mt-1">{reply.content}</p></div></div>))}</div></div></div>))}</div></div>
            <div className="p-6 border-t border-border"><div className="flex items-center gap-3"><Input ref={commentInputRef} placeholder="Add a comment..." value={commentText} onChange={(e) => setCommentText(e.target.value)} className="flex-1 h-10 rounded-full bg-secondary border-0" onKeyDown={(e) => e.key === 'Enter' && handleComment()} /><button onClick={handleComment} className="w-10 h-10 rounded-full flex items-center justify-center bg-aura text-white flex-shrink-0 hover:bg-aura-dark transition-colors"><Send className="w-4 h-4" /></button></div></div>
          </div>
        </div>
        {/* Mobile: thread-style single column */}
        <div className="md:hidden pt-0 pb-16 min-h-screen">
          <div className="sticky top-0 z-50 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></button>
            <span className="text-sm font-semibold">Thread</span>
          </div>
          <div className="px-4 py-6">
            <div className="flex items-start gap-3 mb-4">
              <UserAvatar src={post.author.avatar} displayName={post.author.displayName} username={post.author.username} className="w-10 h-10 rounded-full" />
              <div><p className="font-semibold">{post.author.displayName}</p><p className="text-sm text-muted-foreground">@{post.author.username} · {post.createdAt}</p></div>
            </div>
            <h1 className="text-xl font-bold mb-3">{post.title}</h1>
            <div className="text-base leading-relaxed whitespace-pre-wrap mb-4">{post.content}</div>
            <div className="flex flex-wrap gap-2 mb-4">{post.tags.map(tag => <span key={tag} className="px-2 py-1 bg-secondary rounded-full text-xs text-aura">#{tag}</span>)}</div>
            <div className="flex flex-wrap items-center gap-4 py-3 border-y border-border">
              <button onClick={handleLike} className="flex items-center gap-1.5"><Heart className={`w-5 h-5 ${liked ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} /><span className="text-sm">{likeCount}</span></button>
              <div className="flex items-center gap-1.5"><MessageCircle className="w-5 h-5 text-muted-foreground" /><span className="text-sm">{post.comments}</span></div>
              <button onClick={() => showToast('success','Shared!','Post shared')}><Share2 className="w-5 h-5 text-muted-foreground" /></button>
              <button onClick={handleCurate}><Palette className="w-5 h-5 text-muted-foreground" /></button>
            </div>
          </div>
        </div>
        {/* Curate Modal */}
                <CurateModal
          open={showCurateModal}
          post={post}
          onClose={() => setShowCurateModal(false)}
          onCurated={() => setIsCurated(true)}
        />
        {/* License Modal */}
        {showLicenseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-background rounded-2xl p-6 mx-4 max-w-sm w-full shadow-xl">
              <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold flex items-center gap-2"><FileText className="w-5 h-5 text-blue-400" /> Content License</h2><button onClick={() => setShowLicenseModal(false)}><X className="w-5 h-5" /></button></div>
              {license ? (<div className="space-y-3"><div className="bg-card border border-border rounded-xl p-4"><div className="flex justify-between items-center mb-2"><span className="text-sm text-muted-foreground">Embed Price</span><span className="font-bold">{license.embedPrice} ORA</span></div><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Remix Price</span><span className="font-bold">{license.remixPrice} ORA</span></div></div><button onClick={handlePayEmbed} disabled={!!paying || hasEmbedAccess} className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">{hasEmbedAccess ? '✅ Embed Access Granted' : paying === 'embed' ? 'Processing...' : `Pay ${license.embedPrice} ORA to Embed`}</button><button onClick={handlePayRemix} disabled={!!paying || hasRemixAccess} className="w-full py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">{hasRemixAccess ? '✅ Remix License Granted' : paying === 'remix' ? 'Processing...' : `Pay ${license.remixPrice} ORA to Remix`}</button></div>) : (<p className="text-muted-foreground text-sm text-center py-6">No license configured.</p>)}
            </div>
          </div>
        )}
        {/* Remix Confirm Modal */}
        {showRemixConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-background rounded-2xl p-6 mx-4 max-w-sm w-full shadow-xl">
              <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold flex items-center gap-2"><GitBranch className="w-5 h-5 text-green-400" /> Create Remix</h2><button onClick={() => setShowRemixConfirm(false)}><X className="w-5 h-5" /></button></div>
              {hasRemixAccess ? (<><p className="text-sm text-muted-foreground mb-4">You have remix license. Revenue split: 10% to original creator.</p><button onClick={handleCreateRemix} disabled={remixing} className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold disabled:opacity-50">{remixing ? 'Creating...' : '🎵 Create Remix'}</button></>) : (<><p className="text-sm text-muted-foreground mb-4">You need to pay for a remix license first.</p><button onClick={() => { setShowRemixConfirm(false); setShowLicenseModal(true); }} className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold">Get Remix License</button></>)}
            </div>
          </div>
        )}
        <ReportDialog open={showReport} onClose={() => setShowReport(false)} postId={post.id} />
      </>
    );
  }

  // Photo detail - Desktop: Left(60%) + Right(40%), Mobile: Stacked
  // Vertical touch swipe for post nav
  const handleVertTouchStart = (e: React.TouchEvent) => { vertTouchStart.current = e.touches[0].clientY; };
  const handleVertTouchEnd = (e: React.TouchEvent) => {
    const diff = vertTouchStart.current - e.changedTouches[0].clientY;
    if (diff > 60) handleNavNext();
    if (diff < -60) handleNavPrev();
  };

  return (
    <>
      {/* Nav hint arrows (desktop) */}
      {postIndex > 0 && <button onClick={handleNavPrev} className="hidden md:flex fixed right-6 top-20 z-50 w-9 h-9 rounded-full bg-background/80 border border-border items-center justify-center hover:bg-secondary transition-colors" title="Previous post (↑)"><ChevronUp className="w-5 h-5" /></button>}
      {postIndex < posts.length - 1 && <button onClick={handleNavNext} className="hidden md:flex fixed right-6 top-32 z-50 w-9 h-9 rounded-full bg-background/80 border border-border items-center justify-center hover:bg-secondary transition-colors" title="Next post (↓)"><ChevronDown className="w-5 h-5" /></button>}

      {/* Mobile Layout */}
      <div className="md:hidden pt-0 pb-16 max-w-lg mx-auto min-h-screen px-0" onTouchStart={handleVertTouchStart} onTouchEnd={handleVertTouchEnd}>
        {/* Mobile Header */}
        <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <UserAvatar src={post.author.avatar} displayName={post.author.displayName} username={post.author.username} className="w-7 h-7 rounded-full" />
            <span className="text-sm font-medium">{post.author.displayName}</span>
            {post.author.isVerified && <span className="text-aura text-xs">&#10003;</span>}
          </div>
          {!isAuthorMe && (<button onClick={handleFollowToggle} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${isFollowing ? 'bg-secondary text-foreground border border-border' : 'bg-aura text-white'}`}>
            {isFollowing ? 'Following' : 'Follow'}
          </button>)}
          <div className="relative">
            <button onClick={() => setShowReportMenu(!showReportMenu)} className="p-1.5 rounded-full hover:bg-secondary transition-colors">
              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
            </button>
            {showReportMenu && (
              <div className="absolute right-0 mt-1 bg-background rounded-lg shadow-lg border border-border/40 py-1 min-w-[100px] z-50">
                <button onClick={() => { setShowReportMenu(false); setShowReport(true); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-secondary/50"><Flag className="w-3.5 h-3.5" />{t.postDetail.report}</button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Image Gallery */}
        {images.length > 0 && (
          <div
            className="relative bg-black"
            ref={imageContainerRef}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className="overflow-hidden">
              <div
                className="flex transition-transform duration-300"
                style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
              >
                {images.map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt=""
                    className="w-full flex-shrink-0 object-contain max-h-[70vh]"
                  />
                ))}
              </div>
            </div>

            {images.length > 1 && (
              <>
                {currentImageIndex > 0 && (
                  <button
                    onClick={prevImage}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 flex items-center justify-center"
                  >
                    <ChevronLeft className="w-4 h-4 text-white" />
                  </button>
                )}
                {currentImageIndex < images.length - 1 && (
                  <button
                    onClick={nextImage}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 flex items-center justify-center"
                  >
                    <ChevronRight className="w-4 h-4 text-white" />
                  </button>
                )}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, i) => (
                    <span
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${
                        i === currentImageIndex ? 'bg-white' : 'bg-white/40'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Mobile Content */}
        <div className="px-4 py-4">
          <h1 className="text-lg font-bold">{post.title}</h1>
          {post.content && (
            <p className="text-sm text-foreground/80 mt-2 leading-relaxed">{post.content}</p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {post.tags.map(tag => (
              <span key={tag} className="text-xs text-aura font-medium">#{tag}</span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">{post.createdAt}</p>
        </div>

        {/* Mobile Interaction Bar */}
        <div className="px-4 py-3 border-t border-b border-border flex items-center justify-around">
          <button onClick={handleLike} className="flex items-center gap-1.5">
            <Heart className={`w-5 h-5 ${liked ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
            <span className="text-xs">{likeCount}</span>
          </button>
          <div className="flex items-center gap-1.5">
            <MessageCircle className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs">{post.comments}</span>
          </div>
          <button onClick={() => showToast('success', 'Shared!', 'Post shared to your network')}>
            <div className="flex items-center gap-1.5">
              <Share2 className="w-5 h-5 text-muted-foreground" />
              <span className="text-xs">{post.shares}</span>
            </div>
          </button>
          <button onClick={handleCurate}>
            <div className="flex items-center gap-1.5">
              <Palette className="w-5 h-5 text-muted-foreground" />
              <span className="text-xs">Curate</span>
            </div>
          </button>
          <button onClick={() => setShowReport(true)}>
            <div className="flex items-center gap-1.5">
              <Flag className="w-5 h-5 text-muted-foreground" />
              <span className="text-xs">{t.postDetail.report}</span>
            </div>
          </button>
        </div>

        {/* Mobile Comments */}
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold mb-3">Comments ({localComments.length})</h3>
          <div className="space-y-4">
            {localComments.map(comment => (
              <div key={comment.id}>
                <div className="flex items-start gap-2.5">
                  <UserAvatar src={comment.author.avatar} displayName={comment.author.displayName} username={comment.author.username} className="w-8 h-8 rounded-full" />
                  <div className="flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold">{comment.author.displayName}</span>
                      <span className="text-[10px] text-muted-foreground">{comment.createdAt}</span>
                    </div>
                    {comment.quotedAuthor && comment.quotedContent && (
                      <div className="mt-1 mb-1.5 pl-2.5 py-1.5 border-l-2 border-aura/40 bg-secondary/40 rounded-r-md text-[11px]">
                        <div className="text-[9px] font-semibold text-muted-foreground mb-0.5">@{comment.quotedUsername || comment.quotedAuthor} said:</div>
                        <p className="text-muted-foreground leading-snug">{comment.quotedContent}</p>
                      </div>
                    )}
                    <p className="text-sm mt-0.5">{comment.content}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <button className="flex items-center gap-1">
                        <Heart className={`w-3.5 h-3.5 ${comment.isLiked ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
                        <span className="text-[10px] text-muted-foreground">{comment.likes}</span>
                      </button>
                      <button className="text-[10px] text-muted-foreground font-medium">Reply</button>
                    </div>

                    {comment.replies && comment.replies.length > 0 && (
                      <div className="mt-2 space-y-2 pl-1 border-l-2 border-border ml-1">
                        {comment.replies.map(reply => (
                          <div key={reply.id} className="flex items-start gap-2 pl-2">
                            <UserAvatar src={reply.author.avatar} displayName={reply.author.displayName} username={reply.author.username} className="w-6 h-6 rounded-full" />
                            <div>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] font-semibold">{reply.author.displayName}</span>
                                <span className="text-[9px] text-muted-foreground">{reply.createdAt}</span>
                              </div>
                              <p className="text-xs mt-0.5">{reply.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Comment Input */}
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-2 flex items-center gap-2 max-w-lg mx-auto">
          <Input
            placeholder="Add a comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            className="flex-1 h-9 rounded-full bg-secondary border-0 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleComment()}
          />
          <button 
            onClick={handleComment}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-aura text-white flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Desktop Layout - Left(60%) + Right(40%) */}
      <div className="hidden md:flex min-h-screen">
        {/* Left Side - Content (60%) */}
        <div className="flex-[3] lg:flex-[3] bg-black flex items-center justify-center relative">
          <button 
            onClick={() => navigate(-1)} 
            className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {images.length > 0 && (
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={images[currentImageIndex]}
                alt=""
                className="max-w-full max-h-full object-contain"
              />

              {images.length > 1 && (
                <>
                  {currentImageIndex > 0 && (
                    <button
                      onClick={prevImage}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                  )}
                  {currentImageIndex < images.length - 1 && (
                    <button
                      onClick={nextImage}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  )}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentImageIndex(i)}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          i === currentImageIndex ? 'bg-white' : 'bg-white/40'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right Side - Comments & Interactions (40%) */}
        <div className="flex-[2] lg:flex-[2] bg-background flex flex-col">
          {/* Post Header */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserAvatar src={post.author.avatar} displayName={post.author.displayName} username={post.author.username} className="w-10 h-10 rounded-full" />
                <div>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold">{post.author.displayName}</span>
                    {post.author.isVerified && <span className="text-aura text-sm">&#10003;</span>}
                  </div>
                  <span className="text-sm text-muted-foreground">@{post.author.username}</span>
                </div>
              </div>
              {!isAuthorMe && (<button onClick={handleFollowToggle} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${isFollowing ? 'bg-secondary text-foreground border border-border' : 'bg-aura text-white hover:bg-aura-dark'}`}>
                {isFollowing ? 'Following' : 'Follow'}
              </button>)}
            </div>

            <div className="mt-4">
              <h1 className="text-xl font-bold mb-2">{post.title}</h1>
              {post.content && (
                <p className="text-foreground/80 leading-relaxed mb-3">{post.content}</p>
              )}
              <div className="flex flex-wrap gap-2 mb-3">
                {post.tags.map(tag => (
                  <span key={tag} className="text-sm text-aura font-medium hover:text-aura-dark cursor-pointer">#{tag}</span>
                ))}
              </div>
              <span className="text-sm text-muted-foreground">{post.createdAt}</span>
            </div>

            {/* Desktop Interaction Buttons */}
            <div className="flex items-center gap-6 mt-6">
              <button 
                onClick={handleLike} 
                className="flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-full transition-colors"
              >
                <Heart className={`w-5 h-5 ${liked ? 'fill-red-500 text-red-500' : 'text-muted-foreground hover:text-red-500'}`} />
                <span className={`text-sm ${liked ? 'text-red-500' : 'text-muted-foreground'}`}>{likeCount}</span>
              </button>
              
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{post.comments}</span>
              </div>
              
              <button 
                onClick={() => showToast('success', 'Shared!', 'Post shared to your network')}
                className="flex items-center gap-2 hover:bg-green-50 dark:hover:bg-green-900/20 px-3 py-2 rounded-full transition-colors"
              >
                <Share2 className="w-5 h-5 text-muted-foreground hover:text-green-500" />
                <span className="text-sm text-muted-foreground hover:text-green-500">{post.shares}</span>
              </button>
              
              <button 
                onClick={handleCurate}
                className="flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-2 rounded-full transition-colors"
              >
                <Palette className="w-5 h-5 text-muted-foreground hover:text-blue-500" />
              </button>
              
              <button 
                onClick={() => setShowReport(true)}
                className="flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-full transition-colors"
              >
                <Flag className="w-5 h-5 text-muted-foreground hover:text-red-500" />
              </button>
              {/* Boost */}
              <button onClick={() => setShowBoostModal(true)} className="flex items-center gap-1.5 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 px-3 py-2 rounded-full transition-colors">
                <Zap className={`w-5 h-5 ${isBoosted ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`} />
                <span className="text-xs text-muted-foreground">{isBoosted ? '⚡ Boosted' : 'Boost'}</span>
              </button>
              {/* Pin */}
              <button onClick={handlePin} disabled={isPinned} className="flex items-center gap-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-2 rounded-full transition-colors disabled:opacity-60">
                <Pin className={`w-5 h-5 ${isPinned ? 'text-blue-400' : 'text-muted-foreground'}`} />
              </button>
              {/* License */}
              <button onClick={() => setShowLicenseModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-secondary transition-colors">
                <FileText className="w-5 h-5 text-muted-foreground" />
              </button>
              {/* Remix */}
              {license && <button onClick={() => setShowRemixConfirm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
                <GitBranch className="w-5 h-5 text-green-500" />
                <span className="text-xs text-green-500">Remix</span>
              </button>}
            </div>
          </div>

          {/* Comments Section - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">
              <h3 className="font-semibold text-lg">Comments ({localComments.length})</h3>
              
              {localComments.map(comment => (
                <div key={comment.id}>
                  <div className="flex items-start gap-3">
                    <UserAvatar src={comment.author.avatar} displayName={comment.author.displayName} username={comment.author.username} className="w-8 h-8 rounded-full" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{comment.author.displayName}</span>
                        <span className="text-xs text-muted-foreground">{comment.createdAt}</span>
                      </div>
                      {comment.quotedAuthor && comment.quotedContent && (<div className="mt-1.5 mb-2 pl-3 py-2 border-l-2 border-aura/40 bg-secondary/40 rounded-r-md text-xs"><div className="text-[10px] font-semibold text-muted-foreground mb-0.5">@{comment.quotedUsername || comment.quotedAuthor} said:</div><p className="text-muted-foreground leading-snug">{comment.quotedContent}</p></div>)}<p className="text-sm mt-1 leading-relaxed">{comment.content}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <button className="flex items-center gap-1 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded-full transition-colors">
                          <Heart className={`w-4 h-4 ${comment.isLiked ? 'fill-red-500 text-red-500' : 'text-muted-foreground hover:text-red-500'}`} />
                          <span className="text-xs text-muted-foreground">{comment.likes}</span>
                        </button>
                        <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">Reply</button>
                      </div>

                      {/* Replies */}
                      {comment.replies?.map(reply => (
                        <div key={reply.id} className="flex items-start gap-2 mt-3 pl-4 border-l-2 border-border">
                          <UserAvatar src={reply.author.avatar} displayName={reply.author.displayName} username={reply.author.username} className="w-6 h-6 rounded-full" />
                          <div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-semibold">{reply.author.displayName}</span>
                              <span className="text-[10px] text-muted-foreground">{reply.createdAt}</span>
                            </div>
                            <p className="text-sm mt-1">{reply.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comment Input - Desktop */}
          <div className="p-6 border-t border-border">
            <div className="flex items-center gap-3">
              <Input
                placeholder="Add a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 h-10 rounded-full bg-secondary border-0"
                onKeyDown={(e) => e.key === 'Enter' && handleComment()}
              />
              <button 
                onClick={handleComment}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-aura text-white flex-shrink-0 hover:bg-aura-dark transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Curate Modal */}
            <CurateModal
        open={showCurateModal}
        post={post}
        onClose={() => setShowCurateModal(false)}
        onCurated={() => setIsCurated(true)}
      />

      {/* License Modal */}
      {showLicenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background rounded-2xl p-6 mx-4 max-w-sm w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2"><FileText className="w-5 h-5 text-blue-400" /> Content License</h2>
              <button onClick={() => setShowLicenseModal(false)}><X className="w-5 h-5" /></button>
            </div>
            {license ? (
              <div className="space-y-3">
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Embed Price</span>
                    <span className="font-bold">{license.embedPrice} ORA</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Remix Price</span>
                    <span className="font-bold">{license.remixPrice} ORA</span>
                  </div>
                </div>
                <button onClick={handlePayEmbed} disabled={!!paying || hasEmbedAccess} className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                  {hasEmbedAccess ? '✅ Embed Access Granted' : paying === 'embed' ? 'Processing...' : `Pay ${license.embedPrice} ORA to Embed`}
                </button>
                <button onClick={handlePayRemix} disabled={!!paying || hasRemixAccess} className="w-full py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                  {hasRemixAccess ? '✅ Remix License Granted' : paying === 'remix' ? 'Processing...' : `Pay ${license.remixPrice} ORA to Remix`}
                </button>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-6">No license configured for this content.</p>
            )}
          </div>
        </div>
      )}

      {/* Remix Confirm Modal */}
      {showRemixConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background rounded-2xl p-6 mx-4 max-w-sm w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2"><GitBranch className="w-5 h-5 text-green-400" /> Create Remix</h2>
              <button onClick={() => setShowRemixConfirm(false)}><X className="w-5 h-5" /></button>
            </div>
            {hasRemixAccess ? (
              <>
                <p className="text-sm text-muted-foreground mb-4">You have remix license. Create a remix of this content — revenue split: 10% to original creator.</p>
                <button onClick={handleCreateRemix} disabled={remixing} className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold disabled:opacity-50">
                  {remixing ? 'Creating...' : '🎵 Create Remix'}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4">You need to pay for a remix license first ({license ? `${license.remixPrice} ORA` : 'license not set'}).</p>
                <button onClick={() => { setShowRemixConfirm(false); setShowLicenseModal(true); }} className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold">Get Remix License</button>
              </>
            )}
          </div>
        </div>
      )}

      <ReportDialog open={showReport} onClose={() => setShowReport(false)} postId={post.id} />
    </>
  );
}