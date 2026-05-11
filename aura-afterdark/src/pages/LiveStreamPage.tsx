import { useState } from 'react';
import { Eye, Star, Radio, Search, Filter } from 'lucide-react';
import { liveCategories, mockLiveStreams } from '@/data/mockLive';
import { LiveStreamCategory, LiveStreamInfo } from '@/types/live';

export default function LiveStreamPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  const filteredStreams = mockLiveStreams.filter(stream => {
    const matchesCategory = activeCategory === 'all' || stream.category === activeCategory;
    const matchesSearch = stream.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         stream.creator.displayName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  
  const featuredStreams = mockLiveStreams.slice(0, 3);
  
  return (
    <div className="min-h-screen bg-aura-bg text-aura-text md:pl-64">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Radio className="w-8 h-8 text-aura-accent animate-pulse" />
              Live Streams
            </h1>
            <p className="text-aura-text-secondary">
              {filteredStreams.length} creators are live now
            </p>
          </div>
          
          <button className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-aura-accent to-red-500 hover:from-aura-accent-hover hover:to-red-600 text-white rounded-lg transition-all shadow-lg">
            <Radio className="w-5 h-5" />
            Go Live
          </button>
        </div>
        
        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-aura-text-secondary" />
            <input
              type="text"
              placeholder="Search streams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-aura-surface border border-aura-border rounded-lg focus:outline-none focus:border-aura-accent"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-colors ${
              showFilters
                ? 'bg-aura-accent text-white'
                : 'bg-aura-surface border border-aura-border hover:bg-aura-surface/80'
            }`}
          >
            <Filter className="w-5 h-5" />
            Filters
          </button>
        </div>
        
        {/* Categories */}
        <div className="flex overflow-x-auto gap-2 mb-8 pb-2">
          {liveCategories.map(category => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                activeCategory === category.id
                  ? 'bg-aura-accent text-white'
                  : 'bg-aura-surface border border-aura-border hover:bg-aura-surface/80'
              }`}
            >
              <span>{category.icon}</span>
              <span className="text-sm font-medium">{category.name}</span>
            </button>
          ))}
        </div>
        
        {/* Featured Streams */}
        {activeCategory === 'all' && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Featured Streams</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featuredStreams.map(stream => (
                <div key={stream.id} className="group cursor-pointer">
                  <div className="relative rounded-lg overflow-hidden mb-3">
                    <img
                      src={stream.thumbnail}
                      alt=""
                      className="w-full h-48 object-cover group-hover:scale-105 transition-transform"
                    />
                    
                    {/* Live Badge */}
                    <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1 bg-red-500 text-white rounded-full text-sm font-medium">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      LIVE
                    </div>
                    
                    {/* Viewer Count */}
                    <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-black/50 text-white rounded text-sm">
                      <Eye className="w-4 h-4" />
                      {stream.viewerCount.toLocaleString()}
                    </div>
                    
                    {/* Tip Progress */}
                    {stream.tipGoal && (
                      <div className="absolute bottom-3 left-3 right-3">
                        <div className="bg-black/50 rounded p-2">
                          <div className="flex justify-between text-xs text-white mb-1">
                            <span>${stream.tipCurrent}</span>
                            <span>Goal: ${stream.tipGoal}</span>
                          </div>
                          <div className="w-full bg-gray-600 rounded-full h-1.5">
                            <div
                              className="bg-aura-gold h-1.5 rounded-full transition-all"
                              style={{ width: `${((stream.tipCurrent || 0) / stream.tipGoal) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <img
                      src={stream.creator.avatar}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1 group-hover:text-aura-accent transition-colors">
                        {stream.title}
                      </h3>
                      <div className="flex items-center gap-1 text-sm text-aura-text-secondary">
                        <span>{stream.creator.displayName}</span>
                        {stream.creator.isVerified && (
                          <Star className="w-4 h-4 text-aura-gold" fill="currentColor" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-aura-text-secondary">
                        <span className="capitalize">{stream.category}</span>
                        <span>•</span>
                        <span>{stream.viewerCount.toLocaleString()} viewers</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* All Streams */}
        <div>
          <h2 className="text-xl font-semibold mb-4">
            {activeCategory === 'all' ? 'All Streams' : `${liveCategories.find(c => c.id === activeCategory)?.name} Streams`}
          </h2>
          
          {filteredStreams.length === 0 ? (
            <div className="text-center py-12">
              <Radio className="w-16 h-16 text-aura-text-secondary mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-semibold mb-2">No live streams</h3>
              <p className="text-aura-text-secondary">
                {searchQuery 
                  ? `No streams match "${searchQuery}"`
                  : `No ${activeCategory !== 'all' ? activeCategory : ''} streams are live right now.`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredStreams.map(stream => (
                <div key={stream.id} className="group cursor-pointer">
                  <div className="relative rounded-lg overflow-hidden mb-3">
                    <img
                      src={stream.thumbnail}
                      alt=""
                      className="w-full h-40 object-cover group-hover:scale-105 transition-transform"
                    />
                    
                    {/* Live Badge */}
                    <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-red-500 text-white rounded text-xs font-medium">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                      LIVE
                    </div>
                    
                    {/* Viewer Count */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-black/50 text-white rounded text-xs">
                      <Eye className="w-3 h-3" />
                      {stream.viewerCount > 1000 
                        ? `${(stream.viewerCount / 1000).toFixed(1)}K`
                        : stream.viewerCount
                      }
                    </div>
                    
                    {/* Special Badges */}
                    {stream.isTicketed && (
                      <div className="absolute bottom-2 left-2 px-2 py-1 bg-aura-gold text-black text-xs font-bold rounded">
                        ${stream.ticketPrice}
                      </div>
                    )}
                    
                    {stream.isPrivate && (
                      <div className="absolute bottom-2 right-2 px-2 py-1 bg-aura-accent text-white text-xs font-bold rounded">
                        PRIVATE
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <img
                      src={stream.creator.avatar}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm mb-1 group-hover:text-aura-accent transition-colors line-clamp-2">
                        {stream.title}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-aura-text-secondary mb-1">
                        <span className="truncate">{stream.creator.displayName}</span>
                        {stream.creator.isVerified && (
                          <Star className="w-3 h-3 text-aura-gold flex-shrink-0" fill="currentColor" />
                        )}
                      </div>
                      <div className="text-xs text-aura-text-secondary capitalize">
                        {stream.category}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}