import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, MessageCircle, Share2, Lock, Coins, Play, Search, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { posts } from '@/data/mock';
import TipModal from '@/components/TipModal';
import CurationStakeModal from '@/components/CurationStakeModal';
import ShareModal from '@/components/ShareModal';

export default function ContentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [unlocked, setUnlocked] = useState(false);
  const [liked, setLiked] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [showCurationModal, setShowCurationModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const post = posts.find((p) => p.id === id);
  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center text-aura-text-secondary">
        Post not found
      </div>
    );
  }

  // Simulate: subscribed to c1 (bronze) and c3 (bronze)
  const subscribedTiers: Record<string, string> = { c1: 't-bronze', c3: 't-bronze' };
  const userTier = subscribedTiers[post.creatorId];

  const tierRank: Record<string, number> = { 't-free': 0, 't-bronze': 1, 't-silver': 2, 't-gold': 3 };
  const isSubscriptionLocked = post.requiredTier && (!userTier || tierRank[userTier] < tierRank[post.requiredTier]);
  const isPPVLocked = post.ppvPrice && !unlocked;
  const isLocked = !!(isSubscriptionLocked || isPPVLocked);

  const tierLabel = (tier: string) => {
    switch (tier) {
      case 't-bronze': return 'Bronze ($5/mo)';
      case 't-silver': return 'Silver ($15/mo)';
      case 't-gold': return 'Gold ($30/mo)';
      default: return tier;
    }
  };

  const formatCount = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toString();

  const [currentImage, setCurrentImage] = useState(0);
  const images = post.images || [post.thumbnail];

  return (
    <div className="min-h-screen pb-20 bg-aura-bg">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#1A1A2E]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-lg mx-auto flex items-center gap-3 px-4 h-14">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div
            className="flex items-center gap-2 flex-1 cursor-pointer group"
            onClick={() => navigate(`/creator/${post.creatorId}`)}
          >
            <img src={post.creator.avatar} alt="" className="w-9 h-9 rounded-full bg-aura-surface border border-white/10" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white group-hover:text-aura-accent transition-colors">{post.creator.displayName}</span>
                {post.creator.isVerified && <span className="text-aura-gold text-[10px] bg-aura-gold/10 px-1 rounded-sm border border-aura-gold/20">✓</span>}
              </div>
              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{post.createdAt}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Full-width content display */}
      <div className="w-full pb-8">
        {/* Content - Full width */}
        <div className="relative w-full bg-black/30">
          {post.type === 'gallery' && !isLocked ? (
            <div className="relative">
              <img
                src={images[currentImage]}
                alt=""
                className="w-full h-auto min-h-[50vh] object-contain bg-black/40"
              />
              {images.length > 1 && (
                <>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 p-2 rounded-full bg-black/40 backdrop-blur-md">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentImage(i)}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${
                          i === currentImage ? 'bg-white w-6' : 'bg-white/30 hover:bg-white/50'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                    <span className="text-white text-xs font-bold tracking-wider">{currentImage + 1} / {images.length}</span>
                  </div>
                </>
              )}
              {/* Watermark */}
              <div className="absolute bottom-4 right-4 text-white/20 text-xs font-bold uppercase tracking-widest pointer-events-none select-none">
                aura.dark/{post.creator.username}
              </div>
            </div>
          ) : (
            <div className="relative w-full">
              <img
                src={post.thumbnail}
                alt=""
                className={`w-full h-auto min-h-[50vh] object-cover transition-all duration-700 ${isLocked ? 'blur-3xl opacity-40 scale-105' : ''}`}
              />
              {/* Video play button */}
              {post.type === 'video' && !isLocked && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 hover:scale-110 transition-transform cursor-pointer">
                    <Play className="w-8 h-8 text-white fill-white ml-1" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Locked overlay */}
          {isLocked && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8 z-10">
              <div className="w-20 h-20 rounded-full bg-white/5 backdrop-blur-xl flex items-center justify-center border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] animate-pulse-slow">
                <Lock className="w-10 h-10 text-white/90" />
              </div>

              {isPPVLocked ? (
                <div className="text-center space-y-4 w-full max-w-xs p-6 rounded-3xl bg-black/40 backdrop-blur-xl border border-white/5">
                  <div className="space-y-1">
                    <p className="text-white font-bold text-lg">Pay-Per-View</p>
                    <p className="text-gray-400 text-sm">Unlock this exclusive content</p>
                  </div>
                  <Button
                    onClick={() => setUnlocked(true)}
                    className="w-full bg-gradient-to-r from-aura-accent to-[#D63B55] hover:from-[#D63B55] hover:to-aura-accent text-white font-bold rounded-xl h-12 shadow-[0_0_20px_rgba(233,69,96,0.3)] transition-all hover:scale-105"
                  >
                    <Coins className="w-5 h-5 mr-2 text-white" />
                    Unlock for {post.ppvPrice} ORA
                  </Button>
                </div>
              ) : isSubscriptionLocked ? (
                <div className="text-center space-y-4 w-full max-w-xs p-6 rounded-3xl bg-black/40 backdrop-blur-xl border border-white/5">
                  <div className="space-y-1">
                    <p className="text-white font-bold text-lg">Subscribers Only</p>
                    <p className="text-gray-400 text-sm">
                      Join {tierLabel(post.requiredTier!)} to view
                    </p>
                  </div>
                  <Button
                    onClick={() => navigate(`/creator/${post.creatorId}`)}
                    className="w-full bg-white text-black hover:bg-gray-200 font-bold rounded-xl h-12 transition-all hover:scale-105"
                  >
                    View Subscription Plans
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Caption & Engagement - Constrained width */}
        <div className="max-w-lg mx-auto px-5 py-6 space-y-6">
          {/* Actions Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <button
                onClick={() => setLiked(!liked)}
                className={`group flex items-center gap-2 transition-all ${liked ? 'text-aura-accent' : 'text-gray-400 hover:text-white'}`}
              >
                <Heart className={`w-7 h-7 transition-transform group-active:scale-125 ${liked ? 'fill-aura-accent' : ''}`} strokeWidth={1.5} />
                <span className="text-sm font-medium">{formatCount(post.likeCount + (liked ? 1 : 0))}</span>
              </button>
              <button className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                <MessageCircle className="w-7 h-7" strokeWidth={1.5} />
                <span className="text-sm font-medium">{formatCount(post.commentCount)}</span>
              </button>
              <button 
                onClick={() => setShowTipModal(true)}
                className="flex items-center gap-2 text-gray-400 hover:text-aura-gold transition-colors"
              >
                <Coins className="w-7 h-7" strokeWidth={1.5} />
                <span className="text-sm font-medium">Tip</span>
              </button>
              <button 
                onClick={() => setShowCurationModal(true)}
                className="flex items-center gap-2 text-gray-400 hover:text-aura-accent transition-colors"
              >
                <Search className="w-7 h-7" strokeWidth={1.5} />
                <span className="text-sm font-medium">Curate</span>
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowShareModal(true)}
                className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"
              >
                <Share2 className="w-6 h-6" strokeWidth={1.5} />
              </button>
              <button 
                onClick={() => navigate(`/report/${post.id}`)}
                className="text-gray-400 hover:text-red-400 transition-colors p-2 hover:bg-red-500/10 rounded-full"
              >
                <Flag className="w-6 h-6" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Caption */}
          <div className="space-y-2">
             <p className="text-base text-gray-200 leading-relaxed font-light">{post.caption}</p>
             <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{post.createdAt}</p>
          </div>



          {/* Comments section */}
          <div className="pt-6">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              Comments <span className="text-gray-500 font-normal">({formatCount(post.commentCount)})</span>
            </h3>
            
            <div className="space-y-4">
              {[
                { user: 'nightowl', text: 'Absolutely stunning! 😍', time: '1h ago', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop' },
                { user: 'art_lover_42', text: 'The detail is incredible, love the lighting here.', time: '2h ago', avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=100&h=100&fit=crop' },
                { user: 'shadow_fan', text: 'Worth every ORA token 💎', time: '3h ago', avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&h=100&fit=crop' },
              ].map((comment, i) => (
                <div key={i} className="flex gap-3 group">
                  <img src={comment.avatar} className="w-8 h-8 rounded-full bg-white/10 object-cover" alt="" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white group-hover:text-aura-accent transition-colors cursor-pointer">{comment.user}</span>
                      <span className="text-[10px] text-gray-500">{comment.time}</span>
                    </div>
                    <p className="text-sm text-gray-300 font-light leading-relaxed">{comment.text}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <button className="w-full text-center text-xs text-gray-500 font-medium mt-6 hover:text-white transition-colors">
              View all comments
            </button>
          </div>
        </div>
      </div>

      {/* Tip Modal */}
      {showTipModal && (
        <TipModal
          recipientName={post.creator.displayName}
          recipientAvatar={post.creator.avatar}
          onClose={() => setShowTipModal(false)}
        />
      )}

      {/* Curation Stake Modal */}
      <CurationStakeModal
        isOpen={showCurationModal}
        onClose={() => setShowCurationModal(false)}
        contentTitle={post.caption}
        contentAuthor={post.creator.username}
        contentThumbnail={post.thumbnail}
      />

      {/* Share Modal */}
      {showShareModal && (
        <ShareModal
          contentUrl={`/post/${post.id}`}
          contentTitle={post.caption}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
