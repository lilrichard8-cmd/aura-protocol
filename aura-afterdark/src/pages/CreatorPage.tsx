import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Lock, Grid3X3, Coins, Users, ExternalLink, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { creators, posts } from '@/data/mock';

export default function CreatorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [subscribedTier, setSubscribedTier] = useState<string | null>(
    id === 'c1' || id === 'c3' ? 't-bronze' : null
  );

  const creator = creators.find((c) => c.id === id);
  if (!creator) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Creator not found
      </div>
    );
  }

  const creatorPosts = posts.filter((p) => p.creatorId === id);

  const formatCount = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
  };

  const isContentUnlocked = (requiredTier: string | null) => {
    if (!requiredTier) return true; // free
    if (!subscribedTier) return false;
    const tierRank: Record<string, number> = { 't-free': 0, 't-bronze': 1, 't-silver': 2, 't-gold': 3 };
    return (tierRank[subscribedTier] || 0) >= (tierRank[requiredTier] || 0);
  };

  return (
    <div className="min-h-screen pb-24 md:pb-8 bg-[#1A1A2E]">
      {/* Cover */}
      <div className="relative h-64 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#1A1A2E] z-10" />
        <img src={creator.cover} alt="" className="w-full h-full object-cover animate-pulse-slow scale-105" />
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-black/60 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        {creator.isLive && (
          <Badge
            className="absolute top-4 right-4 z-20 bg-red-500 hover:bg-red-600 text-white animate-pulse cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.6)] px-3 py-1 text-xs border-none"
            onClick={() => navigate(`/live/${creator.id}`)}
          >
            LIVE NOW
          </Badge>
        )}
      </div>

      {/* Profile header */}
      <div className="max-w-6xl mx-auto px-4 -mt-20 relative z-20 md:ml-64">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-3 group">
            <div className={`absolute -inset-1 rounded-full blur opacity-75 transition-all duration-500 group-hover:opacity-100 ${creator.isVerified ? 'bg-gradient-to-tr from-aura-gold via-yellow-200 to-amber-600' : 'bg-aura-accent'}`}></div>
            <img
              src={creator.avatar}
              alt={creator.displayName}
              className="relative w-28 h-28 rounded-full border-4 border-[#1A1A2E] bg-[#1A1A2E] object-cover"
            />
            {creator.isVerified && (
              <div className="absolute bottom-1 right-1 bg-aura-gold text-[#1A1A2E] rounded-full p-1 border-2 border-[#1A1A2E] shadow-sm">
                 <Check className="w-3 h-3 stroke-[4]" />
              </div>
            )}
          </div>
          
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2 justify-center">
            {creator.displayName}
          </h1>
          <p className="text-sm text-gray-400 font-medium tracking-wide">@{creator.username}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-8">
          <div className="bg-[#16213E]/50 backdrop-blur-sm rounded-xl p-3 text-center border border-white/5">
            <p className="text-lg font-bold text-white">{formatCount(creator.subscriberCount)}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Subscribers</p>
          </div>
          <div className="bg-[#16213E]/50 backdrop-blur-sm rounded-xl p-3 text-center border border-white/5">
            <p className="text-lg font-bold text-white">{creator.postCount}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Posts</p>
          </div>
          <div className="bg-aura-gold/10 backdrop-blur-sm rounded-xl p-3 text-center border border-aura-gold/20">
            <p className="text-lg font-bold text-aura-gold flex items-center justify-center gap-1">
              <span className="text-xs opacity-70">$</span>{creator.coinPrice}
            </p>
            <p className="text-[10px] text-aura-gold/70 uppercase tracking-wider">Coin Price</p>
          </div>
        </div>

        {/* Bio */}
        <div className="bg-[#16213E]/30 rounded-2xl p-4 mb-6 border border-white/5">
          <p className="text-sm text-gray-300 leading-relaxed text-center font-light">{creator.bio}</p>
        </div>

        {/* Creator Coin Card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#1E1E3A] to-[#0F172A] border border-aura-gold/20 rounded-2xl p-4 flex items-center justify-between mb-8 shadow-lg group hover:border-aura-gold/40 transition-colors">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-aura-gold/10 rounded-full blur-2xl group-hover:bg-aura-gold/20 transition-colors" />
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-aura-gold to-amber-700 flex items-center justify-center shadow-lg shadow-amber-900/40">
              <Coins className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold flex items-center gap-2">
                ${creator.coinSymbol} <span className="text-[10px] bg-aura-gold/20 text-aura-gold px-1.5 py-0.5 rounded border border-aura-gold/20">COIN</span>
              </h3>
              <p className="text-xs text-gray-400">Own a stake in my content</p>
            </div>
          </div>
          <Button size="sm" className="bg-aura-gold hover:bg-aura-gold-hover text-[#1A1A2E] font-bold rounded-lg text-xs px-4 h-9 shadow-[0_0_15px_rgba(245,158,11,0.3)] relative z-10">
            Buy
          </Button>
        </div>

        {/* Subscription Tiers */}
        <div className="space-y-5 mb-10">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 px-1">
            <Users className="w-5 h-5 text-aura-accent" />
            <span>Membership Tiers</span>
          </h2>
          <div className="space-y-4">
            {creator.tiers.map((tier) => {
              const isSubscribed = subscribedTier === tier.id;
              const isFree = tier.price === 0;
              
              // Refined Styles for Tiers
              let containerClasses = "bg-[#16213E] border-white/5";
              let glowColor = "bg-white/5";
              let titleColor = "text-white";
              let buttonGradient = "bg-white/10 hover:bg-white/20 text-white";
              let iconBg = "bg-white/5 text-gray-400";

              if (tier.id === 't-bronze') {
                containerClasses = "bg-gradient-to-br from-[#2D1B15] to-[#16213E] border-[#CD7F32]/30";
                glowColor = "bg-[#CD7F32]/10";
                titleColor = "text-[#CD7F32]";
                buttonGradient = "bg-gradient-to-r from-[#CD7F32] to-[#8B4513] text-white border-none shadow-[0_4px_15px_rgba(205,127,50,0.2)]";
                iconBg = "bg-[#CD7F32]/20 text-[#CD7F32]";
              } else if (tier.id === 't-silver') {
                containerClasses = "bg-gradient-to-br from-[#1C2333] to-[#16213E] border-gray-400/30";
                glowColor = "bg-gray-400/10";
                titleColor = "text-gray-200";
                buttonGradient = "bg-gradient-to-r from-gray-300 to-gray-500 text-[#1A1A2E] font-bold border-none shadow-[0_4px_15px_rgba(200,200,200,0.2)]";
                iconBg = "bg-gray-400/20 text-gray-200";
              } else if (tier.id === 't-gold') {
                containerClasses = "bg-gradient-to-br from-[#332600] to-[#16213E] border-[#FFD700]/40 shadow-[0_0_20px_rgba(255,215,0,0.1)]";
                glowColor = "bg-[#FFD700]/10";
                titleColor = "text-[#FFD700]";
                buttonGradient = "bg-gradient-to-r from-[#FFD700] via-[#FDB931] to-[#D4AF37] text-[#1A1A2E] font-black border-none shadow-[0_4px_20px_rgba(255,215,0,0.3)] animate-pulse-slow";
                iconBg = "bg-[#FFD700]/20 text-[#FFD700]";
              }

              return (
                <div
                  key={tier.id}
                  className={`relative rounded-2xl p-1 transition-all duration-300 ${isSubscribed ? 'ring-2 ring-aura-accent ring-offset-2 ring-offset-[#1A1A2E]' : ''}`}
                >
                  {/* Outer Border/Glow Container */}
                  <div className={`absolute inset-0 rounded-2xl opacity-50 ${glowColor} blur-sm`} />
                  
                  <div className={`relative rounded-xl p-5 border overflow-hidden h-full ${containerClasses}`}>
                    {/* Background Shine for Gold */}
                    {tier.id === 't-gold' && <div className="absolute -top-20 -right-20 w-60 h-60 bg-[#FFD700]/10 blur-3xl rounded-full pointer-events-none animate-pulse-slow" />}

                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <div className="flex gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-inner ${iconBg}`}>
                          {tier.icon}
                        </div>
                        <div>
                          <h3 className={`font-bold text-lg ${titleColor}`}>{tier.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm font-medium text-white/90">
                              {isFree ? 'Free' : `$${tier.price}/mo`}
                            </span>
                            {isSubscribed && <Badge className="bg-green-500/20 text-green-400 border border-green-500/30 text-[9px] px-1.5">ACTIVE</Badge>}
                          </div>
                        </div>
                      </div>
                      
                      {!isSubscribed && (
                        <Button
                          size="sm"
                          onClick={() => setSubscribedTier(tier.id)}
                          className={`rounded-lg px-5 h-9 text-xs tracking-wide transition-all active:scale-95 ${buttonGradient}`}
                        >
                          {isFree ? 'Follow' : 'Join'}
                        </Button>
                      )}
                    </div>
                    
                    <div className="space-y-2.5 mb-4 relative z-10">
                      {tier.perks.map((perk, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <Check className={`w-3.5 h-3.5 mt-1 flex-shrink-0 ${tier.id === 't-gold' ? 'text-[#FFD700]' : 'text-aura-accent'}`} strokeWidth={3} />
                          <span className="text-sm text-gray-300 font-light tracking-wide">{perk}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-3 border-t border-white/5 flex items-center justify-between relative z-10">
                       <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1.5">
                        <Zap className="w-3 h-3" />
                        {tier.contentCount} Posts
                      </span>
                      {tier.id === 't-gold' && (
                          <span className="text-[9px] text-[#FFD700] font-bold tracking-widest flex items-center gap-1">
                              VIP <span className="w-1 h-1 rounded-full bg-[#FFD700] animate-pulse"/>
                          </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Content Grid */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2 px-1">
            <Grid3X3 className="w-4 h-4 text-gray-500" />
            Recent Content
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {creatorPosts.map((post) => {
              const unlocked = isContentUnlocked(post.requiredTier) && !post.ppvPrice;
              return (
                <div
                  key={post.id}
                  className="relative aspect-[3/4] cursor-pointer group overflow-hidden rounded-md bg-[#16213E]"
                  onClick={() => navigate(`/post/${post.id}`)}
                >
                  <img
                    src={post.thumbnail}
                    alt=""
                    className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${!unlocked ? 'blur-xl opacity-50 scale-110' : ''}`}
                  />
                  
                  {!unlocked && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20">
                      <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 mb-1">
                        <Lock className="w-4 h-4 text-white" />
                      </div>
                      {post.ppvPrice ? (
                         <span className="text-[10px] font-bold text-white bg-aura-accent/80 px-1.5 py-0.5 rounded-sm">
                            ${post.ppvPrice}
                         </span>
                      ) : (
                        <span className="text-[8px] font-bold text-gray-300 uppercase tracking-wider">
                           {post.requiredTier?.replace('t-', '')}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {post.isLive && (
                    <div className="absolute top-1 left-1">
                       <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Filler items */}
            {Array.from({ length: Math.max(0, 9 - creatorPosts.length) }).map((_, i) => (
              <div key={`filler-${i}`} className="aspect-[3/4] bg-[#16213E]/50 rounded-md flex items-center justify-center border border-white/5">
                <Lock className="w-4 h-4 text-white/5" />
              </div>
            ))}
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 mb-4 text-center space-y-2">
          <p className="text-[10px] text-gray-600 flex items-center justify-center gap-1 uppercase tracking-widest">
            Stored permanently on Arweave
            <ExternalLink className="w-2.5 h-2.5" />
          </p>
          <div className="flex justify-center gap-2">
             <div className="h-0.5 w-8 bg-gray-800 rounded-full" />
             <div className="h-0.5 w-8 bg-gray-800 rounded-full" />
             <div className="h-0.5 w-8 bg-gray-800 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
