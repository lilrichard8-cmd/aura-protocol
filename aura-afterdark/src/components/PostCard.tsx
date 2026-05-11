import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Lock, Play, Eye, Coins } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Post } from '@/data/mock';

interface PostCardProps {
  post: Post;
}

export default function PostCard({ post }: PostCardProps) {
  const navigate = useNavigate();

  const formatCount = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
  };

  const tierLabel = (tier: string | null) => {
    switch (tier) {
      case 't-bronze': return 'Bronze';
      case 't-silver': return 'Silver';
      case 't-gold': return 'Gold';
      default: return '';
    }
  };

  return (
    <article
      className="group bg-[#1A1A2E] rounded-3xl overflow-hidden border border-white/5 shadow-xl transition-all duration-700 hover:border-aura-accent/40 hover:shadow-[0_15px_50px_-10px_rgba(233,69,96,0.3)] relative hover:-translate-y-2 hover:scale-[1.02] cursor-pointer"
      onClick={() => {
        if (post.isLive) {
          navigate(`/live/${post.creatorId}`);
        } else {
          navigate(`/post/${post.id}`);
        }
      }}
    >
      {/* Creator header */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-gradient-to-b from-white/5 to-transparent backdrop-blur-sm relative z-20"
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/creator/${post.creatorId}`);
        }}
      >
        <div className="relative">
          <div className={`rounded-full p-[2px] ${post.isLive ? 'bg-gradient-to-tr from-red-500 to-orange-500 animate-spin-slow' : 'bg-gradient-to-tr from-aura-accent to-purple-600'}`}>
            <img
              src={post.creator.avatar}
              alt={post.creator.displayName}
              className="w-9 h-9 rounded-full object-cover border-2 border-[#1A1A2E]"
            />
          </div>
          {post.isLive && (
             <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-red-500 border-2 border-[#1A1A2E] rounded-full animate-bounce shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-white truncate group-hover:text-aura-accent transition-colors">
              {post.creator.displayName}
            </span>
            {post.creator.isVerified && (
              <span className="text-aura-gold text-[10px] bg-aura-gold/10 px-1 rounded-sm border border-aura-gold/20 flex items-center justify-center h-4 w-4 shadow-[0_0_10px_rgba(245,158,11,0.2)]">✓</span>
            )}
          </div>
          <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{post.createdAt}</span>
        </div>
        
        {/* Status Badges */}
        <div className="flex items-center gap-2">
          {post.isCurated && (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-400/30 text-[9px] px-2 py-0.5 font-bold tracking-wide">
              ✅ CURATED
            </Badge>
          )}
          
          {post.isBoosted && (
            <Badge className="bg-orange-500/20 text-orange-400 border-orange-400/30 text-[9px] px-2 py-0.5 font-bold tracking-wide animate-pulse">
              🔥 BOOSTED
            </Badge>
          )}

          {post.isPremium && (
            <Badge className="bg-purple-500/20 text-purple-400 border-purple-400/30 text-[9px] px-2 py-0.5 font-bold tracking-wide">
              🔒 PREMIUM
            </Badge>
          )}
          
          {post.isLive && (
            <Badge className="bg-red-500 hover:bg-red-600 text-white text-[10px] px-2 py-0.5 animate-pulse border-none shadow-[0_0_15px_rgba(239,68,68,0.6)] font-bold tracking-wider">
              LIVE
            </Badge>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="relative aspect-[4/5] overflow-hidden bg-[#0F172A]">
        <img
          src={post.thumbnail}
          alt=""
          className={`w-full h-full object-cover transition-all duration-700 ease-in-out group-hover:scale-110 ${
            post.isLocked 
              ? 'blur-[20px] opacity-50 scale-110 grayscale-[40%] saturate-[0.7]' 
              : ''
          }`}
        />

        {/* Gradient Overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A2E] via-transparent to-transparent opacity-60" />

        {/* Enhanced Locked overlay */}
        {post.isLocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-10 p-6 text-center backdrop-blur-[4px] bg-black/20">
            {/* Lock icon with enhanced effects */}
            <div className="relative group/lock">
              <div className="absolute inset-0 bg-aura-accent/30 blur-2xl rounded-full animate-pulse-slow" />
              <div className="absolute inset-1 bg-aura-accent/20 blur-lg rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
              <div className="relative w-20 h-20 rounded-full bg-black/40 backdrop-blur-xl flex items-center justify-center border-2 border-white/20 shadow-[0_0_40px_rgba(0,0,0,0.8)] group-hover:scale-110 group-hover/lock:border-aura-accent/40 transition-all duration-500">
                <Lock className="w-8 h-8 text-white/90 drop-shadow-2xl group-hover/lock:text-aura-accent transition-colors duration-300" strokeWidth={2.5} />
              </div>
              {/* Rotating ring effect */}
              <div className="absolute inset-0 rounded-full border border-transparent opacity-0 group-hover/lock:opacity-100 transition-opacity duration-500"
                   style={{ 
                     background: 'conic-gradient(from 0deg, transparent, rgba(233, 69, 96, 0.6), transparent)',
                     animation: 'spin 3s linear infinite'
                   }} />
            </div>
            
            <div className="space-y-4 w-full max-w-[240px]">
              {post.ppvPrice ? (
                <button 
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-gradient-to-r from-aura-accent via-[#FF5E78] to-[#D63B55] hover:from-[#FF5E78] hover:via-aura-accent hover:to-[#FF5E78] py-4 rounded-2xl flex items-center justify-center gap-2.5 shadow-[0_0_25px_rgba(233,69,96,0.5)] hover:shadow-[0_0_40px_rgba(233,69,96,0.8)] transition-all duration-500 transform active:scale-95 border border-white/20 group/btn relative overflow-hidden"
                >
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700 skew-x-12" />
                  <Coins className="w-5 h-5 text-white group-hover/btn:rotate-12 group-hover/btn:scale-110 transition-transform duration-300" />
                  <span className="text-white font-black text-sm tracking-wide relative z-10">
                    UNLOCK FOR {post.ppvPrice} ORA
                  </span>
                </button>
              ) : (
                <div className="glass-card px-6 py-4 rounded-2xl border border-white/10 shadow-xl bg-black/30">
                  <span className="text-gray-300 text-[11px] font-bold uppercase tracking-widest block mb-2 opacity-90">
                    Subscribe to see
                  </span>
                  <span className="text-white font-black text-base bg-gradient-to-r from-[#CD7F32] via-[#E5E4E2] to-[#FFD700] bg-clip-text text-transparent drop-shadow-lg">
                    {tierLabel(post.requiredTier)}+ TIER
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live overlay */}
        {post.isLive && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
            <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg border border-white/5">
              <Eye className="w-3 h-3 text-red-400" />
              <span className="text-white text-xs font-bold">
                {formatCount(post.viewerCount || 0)} watching
              </span>
            </div>
          </div>
        )}

        {/* Video indicator */}
        {post.type === 'video' && !post.isLive && !post.isLocked && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <Play className="w-8 h-8 text-white fill-white ml-1" />
            </div>
          </div>
        )}

        {/* Gallery indicator */}
        {post.type === 'gallery' && (
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md border border-white/10">
            <span className="text-white text-xs font-medium tracking-wider">
              1/{post.images?.length || 1}
            </span>
          </div>
        )}
      </div>

      {/* Caption */}
      <div className="px-5 py-4 space-y-3 bg-[#1A1A2E]">
        <p className="text-sm text-gray-300 line-clamp-2 font-light leading-relaxed group-hover:text-white transition-colors">{post.caption}</p>

        {/* Engagement */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-1.5 text-gray-400 hover:text-aura-accent transition-colors group/btn">
              <Heart className="w-5 h-5 group-active/btn:scale-125 transition-transform" />
              <span className="text-xs font-medium">{formatCount(post.likeCount)}</span>
            </button>
            <button className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors">
              <MessageCircle className="w-5 h-5" />
              <span className="text-xs font-medium">{formatCount(post.commentCount)}</span>
            </button>
          </div>
          
          <button className="flex items-center gap-1.5 bg-aura-gold/5 px-2 py-1 rounded-lg border border-aura-gold/10 hover:bg-aura-gold/10 transition-colors">
            <Coins className="w-4 h-4 text-aura-gold" />
            <span className="text-xs font-bold text-aura-gold">{formatCount(post.tipCount)}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
