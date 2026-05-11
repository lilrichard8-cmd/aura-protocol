import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Search, Filter, Eye, Heart, Star, Users, TrendingUp, Calendar } from 'lucide-react';
import { creators, posts } from '@/data/mock';

type SearchTab = 'creators' | 'content' | 'coins' | 'tags';
type SortBy = 'relevance' | 'recent' | 'popular';
type DateFilter = 'all' | 'today' | 'week' | 'month';

const mockTags = [
  { name: 'art', postCount: 2456, trending: true },
  { name: 'photography', postCount: 1890, trending: false },
  { name: 'fitness', postCount: 3421, trending: true },
  { name: 'cosplay', postCount: 1234, trending: false },
  { name: 'asmr', postCount: 567, trending: true },
];

const mockCreatorCoins = creators.map(creator => ({
  ...creator,
  marketCap: Math.floor(Math.random() * 1000000) + 100000,
  volume24h: Math.floor(Math.random() * 50000) + 5000,
  priceChange: (Math.random() - 0.5) * 20,
}));

export default function SearchResultsPage() {
  const { query } = useParams<{ query: string }>();
  const [activeTab, setActiveTab] = useState<SearchTab>('creators');
  const [sortBy, setSortBy] = useState<SortBy>('relevance');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [showNSFW, setShowNSFW] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  
  const searchQuery = query || '';
  
  const filteredCreators = useMemo(() => {
    return creators.filter(creator =>
      creator.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      creator.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      creator.bio.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);
  
  const filteredContent = useMemo(() => {
    return posts.filter(post =>
      post.caption.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.creator.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);
  
  const filteredCoins = useMemo(() => {
    return mockCreatorCoins.filter(coin =>
      coin.coinSymbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      coin.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);
  
  const filteredTags = useMemo(() => {
    return mockTags.filter(tag =>
      tag.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);
  
  const tabs = [
    { key: 'creators' as SearchTab, label: 'Creators', count: filteredCreators.length },
    { key: 'content' as SearchTab, label: 'Content', count: filteredContent.length },
    { key: 'coins' as SearchTab, label: 'Creator Coins', count: filteredCoins.length },
    { key: 'tags' as SearchTab, label: 'Tags', count: filteredTags.length },
  ];
  
  const renderCreators = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredCreators.map(creator => (
        <div key={creator.id} className="bg-aura-card p-6 rounded-lg border border-aura-border hover:border-aura-accent/50 transition-colors group cursor-pointer">
          <div className="flex items-center gap-4 mb-4">
            <img
              src={creator.avatar}
              alt=""
              className="w-16 h-16 rounded-full object-cover"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-lg group-hover:text-aura-accent transition-colors">
                  {creator.displayName}
                </h3>
                {creator.isVerified && (
                  <Star className="w-5 h-5 text-aura-gold" fill="currentColor" />
                )}
              </div>
              <p className="text-sm text-aura-text-secondary">@{creator.username}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-aura-text-secondary">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {creator.subscriberCount.toLocaleString()}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  {creator.postCount}
                </span>
              </div>
            </div>
          </div>
          <p className="text-sm text-aura-text-secondary mb-4 line-clamp-2">{creator.bio}</p>
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="text-aura-gold font-bold">${creator.coinPrice}</span>
              <span className="text-aura-text-secondary ml-1">{creator.coinSymbol}</span>
            </div>
            <button className="px-4 py-2 bg-aura-accent hover:bg-aura-accent-hover text-white rounded-lg text-sm font-medium transition-colors">
              Follow
            </button>
          </div>
        </div>
      ))}
    </div>
  );
  
  const renderContent = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {filteredContent.map(post => (
        <div key={post.id} className="group cursor-pointer">
          <div className="relative rounded-lg overflow-hidden mb-3">
            <img
              src={post.thumbnail}
              alt=""
              className="w-full h-64 object-cover group-hover:scale-105 transition-transform"
            />
            
            {/* Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent">
              <div className="absolute bottom-3 left-3 right-3">
                <div className="flex items-center gap-3 text-white text-sm">
                  <span className="flex items-center gap-1">
                    <Heart className="w-4 h-4" />
                    {post.likeCount > 1000 ? `${(post.likeCount / 1000).toFixed(1)}K` : post.likeCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {post.commentCount}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Status Badges */}
            <div className="absolute top-3 right-3 flex flex-col gap-2">
              {post.isLocked && (
                <div className="px-2 py-1 bg-aura-accent text-white text-xs font-bold rounded">
                  {post.ppvPrice ? `$${post.ppvPrice}` : 'LOCKED'}
                </div>
              )}
              {post.isCurated && (
                <div className="px-2 py-1 bg-aura-gold text-black text-xs font-bold rounded">
                  ✨ CURATED
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <img
              src={post.creator.avatar}
              alt=""
              className="w-8 h-8 rounded-full object-cover"
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm mb-1 line-clamp-2 group-hover:text-aura-accent transition-colors">
                {post.caption}
              </p>
              <div className="flex items-center gap-1 text-xs text-aura-text-secondary">
                <span>{post.creator.displayName}</span>
                {post.creator.isVerified && (
                  <Star className="w-3 h-3 text-aura-gold" fill="currentColor" />
                )}
                <span>•</span>
                <span>{post.createdAt}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
  
  const renderCoins = () => (
    <div className="space-y-4">
      {filteredCoins.map(coin => (
        <div key={coin.id} className="bg-aura-card p-6 rounded-lg border border-aura-border hover:border-aura-accent/50 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img
                src={coin.avatar}
                alt=""
                className="w-12 h-12 rounded-full object-cover"
              />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-lg">{coin.coinSymbol}</h3>
                  <span className="text-aura-text-secondary">•</span>
                  <span className="text-aura-text-secondary">{coin.displayName}</span>
                  {coin.isVerified && (
                    <Star className="w-4 h-4 text-aura-gold" fill="currentColor" />
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-aura-text-secondary">
                  <span>Market Cap: ${(coin.marketCap / 1000).toFixed(0)}K</span>
                  <span>Volume: ${(coin.volume24h / 1000).toFixed(1)}K</span>
                  <span className="flex items-center gap-4">
                    <Users className="w-4 h-4" />
                    {coin.subscriberCount.toLocaleString()} holders
                  </span>
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-2xl font-bold">${coin.coinPrice}</div>
              <div className={`text-sm flex items-center gap-1 ${
                coin.priceChange >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                <TrendingUp className={`w-4 h-4 ${coin.priceChange < 0 ? 'rotate-180' : ''}`} />
                {coin.priceChange >= 0 ? '+' : ''}{coin.priceChange.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
  
  const renderTags = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredTags.map(tag => (
        <div key={tag.name} className="bg-aura-card p-6 rounded-lg border border-aura-border hover:border-aura-accent/50 transition-colors cursor-pointer group">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold group-hover:text-aura-accent transition-colors">
              #{tag.name}
            </h3>
            {tag.trending && (
              <div className="flex items-center gap-1 px-2 py-1 bg-aura-accent/20 text-aura-accent rounded text-xs font-medium">
                <TrendingUp className="w-3 h-3" />
                Trending
              </div>
            )}
          </div>
          <p className="text-aura-text-secondary text-sm">
            {tag.postCount.toLocaleString()} posts
          </p>
        </div>
      ))}
    </div>
  );
  
  const renderCurrentTab = () => {
    switch (activeTab) {
      case 'creators': return renderCreators();
      case 'content': return renderContent();
      case 'coins': return renderCoins();
      case 'tags': return renderTags();
      default: return renderCreators();
    }
  };
  
  const hasResults = filteredCreators.length > 0 || filteredContent.length > 0 || 
                   filteredCoins.length > 0 || filteredTags.length > 0;
  
  return (
    <div className="min-h-screen bg-aura-bg text-aura-text md:pl-64">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Search className="w-8 h-8 text-aura-accent" />
            <h1 className="text-3xl font-bold">Search Results</h1>
          </div>
          <p className="text-aura-text-secondary">
            {hasResults 
              ? `Results for "${searchQuery}"`
              : `No results found for "${searchQuery}"`
            }
          </p>
        </div>
        
        {hasResults && (
          <>
            {/* Tabs */}
            <div className="flex items-center gap-1 mb-6 bg-aura-surface rounded-lg p-1 overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
                    activeTab === tab.key
                      ? 'bg-aura-accent text-white shadow-lg'
                      : 'text-aura-text-secondary hover:text-aura-text hover:bg-aura-surface/50'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    activeTab === tab.key 
                      ? 'bg-white/20 text-white'
                      : 'bg-aura-border text-aura-text-secondary'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
            
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    showFilters
                      ? 'bg-aura-accent text-white'
                      : 'bg-aura-surface border border-aura-border hover:bg-aura-surface/80'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Filters
                </button>
                
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="px-4 py-2 bg-aura-surface border border-aura-border rounded-lg focus:outline-none focus:border-aura-accent"
                >
                  <option value="relevance">Most Relevant</option>
                  <option value="recent">Most Recent</option>
                  <option value="popular">Most Popular</option>
                </select>
                
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                  className="px-4 py-2 bg-aura-surface border border-aura-border rounded-lg focus:outline-none focus:border-aura-accent"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>
              </div>
              
              {/* NSFW Toggle */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showNSFW}
                    onChange={(e) => setShowNSFW(e.target.checked)}
                    className="text-aura-accent"
                  />
                  <span>Show NSFW content</span>
                </label>
              </div>
            </div>
            
            {/* Results */}
            <div>
              {renderCurrentTab()}
            </div>
          </>
        )}
        
        {/* No Results */}
        {!hasResults && (
          <div className="text-center py-12">
            <Search className="w-16 h-16 text-aura-text-secondary mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">No results found</h3>
            <p className="text-aura-text-secondary mb-4">
              Try adjusting your search terms or filters
            </p>
            <div className="text-sm text-aura-text-secondary">
              <p>Suggestions:</p>
              <ul className="mt-2 space-y-1">
                <li>• Check your spelling</li>
                <li>• Try different keywords</li>
                <li>• Use fewer words</li>
                <li>• Browse popular creators instead</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}