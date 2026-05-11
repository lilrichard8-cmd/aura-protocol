import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, TrendingUp, Flame, Star } from 'lucide-react';
import { creators, posts } from '@/data/mock';

export default function DiscoverPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const filteredCreators = search
    ? creators.filter(
        (c) =>
          c.displayName.toLowerCase().includes(search.toLowerCase()) ||
          c.username.toLowerCase().includes(search.toLowerCase())
      )
    : creators;

  const trendingPosts = [...posts]
    .sort((a, b) => b.likeCount - a.likeCount)
    .slice(0, 6);

  const formatCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toString());

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#16213E]/80 backdrop-blur-xl border-b border-white/5 pb-2">
        <div className="max-w-6xl mx-auto px-4 pt-4 pb-2 md:ml-64">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-aura-accent transition-colors" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search creators, tags..."
              className="w-full bg-[#1A1A2E] text-white text-sm rounded-2xl pl-11 pr-4 py-3 placeholder:text-gray-500 border border-white/5 focus:border-aura-accent/50 focus:outline-none focus:ring-1 focus:ring-aura-accent/50 transition-all shadow-inner"
            />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 pt-4 space-y-8 md:ml-64">
        {/* Featured Creators */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 tracking-wide uppercase">
              <Star className="w-4 h-4 text-aura-gold fill-aura-gold" />
              Featured
            </h2>
            <button className="text-xs text-aura-accent font-medium hover:text-white transition-colors">View All</button>
          </div>
          
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
            {filteredCreators.map((creator) => (
              <button
                key={creator.id}
                onClick={() => navigate(`/creator/${creator.id}`)}
                className="flex-shrink-0 w-32 group relative"
              >
                <div className="relative mb-3 overflow-hidden rounded-2xl shadow-lg border border-white/5">
                  <img
                    src={creator.cover}
                    alt=""
                    className="w-32 h-40 object-cover transform group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80" />
                  
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center w-full px-2">
                     <img
                      src={creator.avatar}
                      alt=""
                      className="w-10 h-10 rounded-full border-2 border-aura-accent bg-[#1A1A2E] mb-1 shadow-md"
                    />
                    <p className="text-xs font-bold text-white truncate w-full text-center">{creator.displayName}</p>
                  </div>

                  {creator.isLive && (
                    <div className="absolute top-2 right-2">
                       <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                        </span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Trending Grid */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 tracking-wide uppercase px-1">
            <TrendingUp className="w-4 h-4 text-aura-accent" />
            Trending Now
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 rounded-2xl overflow-hidden border border-white/5 bg-[#1A1A2E] p-3">
            {trendingPosts.map((post) => (
              <div
                key={post.id}
                className="relative aspect-square cursor-pointer group overflow-hidden rounded-lg bg-white/5"
                onClick={() => navigate(`/post/${post.id}`)}
              >
                <img
                  src={post.thumbnail}
                  alt=""
                  className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${post.isLocked ? 'blur-sm opacity-60' : ''}`}
                />
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-2">
                  <span className="text-white text-[10px] font-bold bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-sm">
                    {formatCount(post.likeCount)} likes
                  </span>
                </div>

                {post.isLocked && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10">
                      <div className="text-xs text-white/80">🔒</div>
                    </div>
                  </div>
                )}
                
                {post.type === 'video' && !post.isLocked && (
                   <div className="absolute top-1 right-1 bg-black/40 backdrop-blur-sm rounded-full p-1">
                      <div className="w-0 h-0 border-t-[3px] border-t-transparent border-l-[6px] border-l-white border-b-[3px] border-b-transparent ml-0.5"></div>
                   </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Categories */}
        <section className="space-y-4 pb-8">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 tracking-wide uppercase px-1">
            <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
            Categories
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { name: 'Art & Design', count: 1240, color: 'from-pink-500/20 to-purple-500/20' },
              { name: 'Photography', count: 890, color: 'from-blue-500/20 to-cyan-500/20' },
              { name: 'Fitness', count: 2100, color: 'from-green-500/20 to-emerald-500/20' },
              { name: 'Cosplay', count: 760, color: 'from-red-500/20 to-orange-500/20' },
              { name: 'ASMR', count: 430, color: 'from-indigo-500/20 to-violet-500/20' },
              { name: 'Music', count: 560, color: 'from-yellow-500/20 to-amber-500/20' },
            ].map((cat) => (
              <button
                key={cat.name}
                className={`group relative overflow-hidden rounded-2xl p-4 text-left border border-white/5 hover:border-white/20 transition-all bg-gradient-to-br ${cat.color}`}
              >
                <div className="relative z-10">
                   <p className="text-sm font-bold text-white group-hover:scale-105 transition-transform">{cat.name}</p>
                   <p className="text-[10px] text-gray-400 mt-1 font-medium">{formatCount(cat.count)} creators</p>
                </div>
                <div className="absolute right-0 bottom-0 opacity-10 group-hover:opacity-20 transition-opacity transform translate-x-1/4 translate-y-1/4">
                   <div className="w-16 h-16 rounded-full bg-white blur-xl" />
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
