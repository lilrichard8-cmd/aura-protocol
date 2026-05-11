import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio } from 'lucide-react';
import PostCard from '@/components/PostCard';
import { posts, creators } from '@/data/mock';

type FeedTab = 'following' | 'foryou';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<FeedTab>('foryou');
  const navigate = useNavigate();

  // "Following" = posts from subscribed creators (c1, c3)
  const followingPosts = posts.filter((p) => ['c1', 'c3'].includes(p.creatorId));
  // "For You" = all posts shuffled (algorithm simulation)
  const forYouPosts = [...posts].sort(() => 0.5 - Math.random());

  const activePosts = activeTab === 'following' ? followingPosts : forYouPosts;

  const liveCreators = creators.filter((c) => c.isLive);

  return (
    <div className="min-h-screen pb-24 md:pb-8 bg-[#1A1A2E]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#1A1A2E]/90 backdrop-blur-xl border-b border-white/5 shadow-2xl shadow-black/20">
        <div className="max-w-6xl mx-auto px-4 pt-4 pb-0 md:ml-64">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-black tracking-tighter flex items-center gap-2 group cursor-pointer">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/70 group-hover:from-aura-accent group-hover:to-[#D63B55] transition-all duration-500">AURA</span>
              <span className="text-aura-accent/80 text-[10px] font-bold tracking-[0.2em] uppercase border-l-2 border-aura-accent/20 pl-2 group-hover:text-white transition-colors">After Dark</span>
            </h1>
            <button
              onClick={() => navigate('/wallet')}
              className="group flex items-center gap-2 bg-[#0F3460]/50 hover:bg-[#0F3460] border border-aura-gold/20 px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 shadow-[0_0_15px_rgba(245,158,11,0.1)] hover:shadow-[0_0_20px_rgba(245,158,11,0.2)]"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-aura-gold opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-aura-gold"></span>
              </span>
              <span className="text-aura-gold group-hover:text-[#FFD700] tracking-wide font-mono">2,450 ORA</span>
            </button>
          </div>

          {/* Tab switcher */}
          <div className="relative flex items-center">
            <button
              onClick={() => setActiveTab('following')}
              className={`flex-1 pb-3 text-sm font-bold transition-all duration-300 relative z-10 ${
                activeTab === 'following' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Following
            </button>
            <button
              onClick={() => setActiveTab('foryou')}
              className={`flex-1 pb-3 text-sm font-bold transition-all duration-300 relative z-10 ${
                activeTab === 'foryou' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              For You
            </button>
            
            {/* Enhanced Sliding Underline */}
            <div 
              className="absolute bottom-0 h-[3px] bg-gradient-to-r from-aura-accent via-[#FF5E78] to-[#D63B55] rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-[0_0_20px_rgba(233,69,96,1),0_0_40px_rgba(233,69,96,0.3)] animate-pulse-slow"
              style={{
                left: activeTab === 'following' ? '0%' : '50%',
                width: '50%',
                transform: 'scaleY(1.2)',
              }}
            />
            {/* Additional glow layer */}
            <div 
              className="absolute bottom-0 h-[6px] bg-aura-accent/20 blur-sm rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
              style={{
                left: activeTab === 'following' ? '0%' : '50%',
                width: '50%',
              }}
            />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 pt-6 space-y-8 md:ml-64">
        {/* Live Now banner */}
        {liveCreators.length > 0 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-2 px-1">
              <Radio className="w-4 h-4 text-red-500 animate-pulse" />
              <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">Live Now</span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 mask-linear-fade">
              {liveCreators.map((creator, i) => (
                <button
                  key={creator.id}
                  onClick={() => navigate(`/live/${creator.id}`)}
                  className="flex-shrink-0 flex flex-col items-center gap-2 group transition-transform active:scale-95"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="relative">
                    {/* Multiple glow layers for live effect */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-red-500 via-orange-500 to-red-600 animate-spin-slow opacity-80 blur-md group-hover:opacity-100 transition-opacity" />
                    <div className="absolute inset-1 rounded-full bg-red-500/40 animate-pulse-slow blur-sm" />
                    <div className="w-[72px] h-[72px] rounded-full p-[3px] bg-gradient-to-tr from-red-500 via-orange-400 to-red-600 relative z-10 shadow-[0_0_20px_rgba(239,68,68,0.6)]">
                      <img
                        src={creator.avatar}
                        alt={creator.displayName}
                        className="w-full h-full rounded-full object-cover bg-[#1A1A2E] border-2 border-[#1A1A2E]"
                      />
                    </div>
                    {/* Enhanced LIVE badge */}
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-20">
                      <div className="relative">
                        <div className="absolute inset-0 bg-red-500 rounded-sm blur-sm opacity-60 animate-pulse-slow" />
                        <div className="relative bg-gradient-to-r from-red-500 to-red-600 text-white text-[9px] font-black px-2.5 py-1 rounded-sm shadow-lg border border-[#1A1A2E] tracking-wider animate-pulse">
                          LIVE
                        </div>
                        {/* Pulsing dots */}
                        <div className="absolute -right-1 -top-1 w-2 h-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-gray-400 group-hover:text-white transition-colors truncate w-20 text-center mt-1">
                    {creator.displayName.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Feed - Responsive Grid */}
        <div className="grid gap-6 pb-8 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {activePosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>

        {/* End of feed */}
        <div className="text-center py-8 text-aura-text-secondary text-sm">
          You've reached the end of your feed
        </div>
      </div>
    </div>
  );
}
