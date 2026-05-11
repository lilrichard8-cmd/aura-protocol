import { useState } from 'react';
import { Star, Users, Eye, TrendingUp, Heart } from 'lucide-react';
import { Creator } from '@/data/mock';

interface CreatorCardProps {
  creator: Creator;
  showFollowButton?: boolean;
  showCoinPrice?: boolean;
  showStats?: boolean;
  variant?: 'default' | 'compact' | 'detailed';
  className?: string;
}

export default function CreatorCard({ 
  creator, 
  showFollowButton = true,
  showCoinPrice = true,
  showStats = true,
  variant = 'default',
  className = ''
}: CreatorCardProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  
  const handleFollowClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFollowing(!isFollowing);
  };
  
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-3 p-3 bg-aura-card rounded-lg border border-aura-border hover:border-aura-accent/50 transition-colors cursor-pointer ${className}`}>
        <div className="relative">
          <img
            src={creator.avatar}
            alt=""
            className="w-12 h-12 rounded-full object-cover"
          />
          {creator.isLive && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-red-500 border-2 border-aura-card rounded-full" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-1">
            <h3 className="font-semibold text-sm truncate">{creator.displayName}</h3>
            {creator.isVerified && (
              <Star className="w-4 h-4 text-aura-gold flex-shrink-0" fill="currentColor" />
            )}
          </div>
          <p className="text-xs text-aura-text-secondary">@{creator.username}</p>
          {showStats && (
            <div className="flex items-center gap-3 mt-1 text-xs text-aura-text-secondary">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {creator.subscriberCount > 1000 
                  ? `${(creator.subscriberCount / 1000).toFixed(1)}K`
                  : creator.subscriberCount
                }
              </span>
              {showCoinPrice && (
                <span className="text-aura-gold font-bold">
                  ${creator.coinPrice} {creator.coinSymbol}
                </span>
              )}
            </div>
          )}
        </div>
        
        {showFollowButton && (
          <button
            onClick={handleFollowClick}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isFollowing
                ? 'bg-aura-surface border border-aura-border text-aura-text hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-400'
                : 'bg-aura-accent hover:bg-aura-accent-hover text-white'
            }`}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        )}
      </div>
    );
  }
  
  if (variant === 'detailed') {
    return (
      <div className={`bg-aura-card rounded-lg border border-aura-border hover:border-aura-accent/50 transition-colors cursor-pointer overflow-hidden ${className}`}>
        {/* Cover Image */}
        <div className="relative h-32">
          <img
            src={creator.cover}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          
          {creator.isLive && (
            <div className="absolute top-3 right-3 flex items-center gap-2 px-2 py-1 bg-red-500 text-white rounded-full text-xs font-medium">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              LIVE
            </div>
          )}
        </div>
        
        <div className="p-4">
          {/* Avatar & Name */}
          <div className="flex items-start gap-4 mb-4 -mt-8 relative">
            <img
              src={creator.avatar}
              alt=""
              className="w-16 h-16 rounded-full object-cover border-4 border-aura-card"
            />
            <div className="flex-1 pt-6">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-lg">{creator.displayName}</h3>
                {creator.isVerified && (
                  <Star className="w-5 h-5 text-aura-gold" fill="currentColor" />
                )}
              </div>
              <p className="text-sm text-aura-text-secondary">@{creator.username}</p>
            </div>
            
            {showFollowButton && (
              <button
                onClick={handleFollowClick}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors mt-6 ${
                  isFollowing
                    ? 'bg-aura-surface border border-aura-border text-aura-text hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-400'
                    : 'bg-aura-accent hover:bg-aura-accent-hover text-white'
                }`}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
          
          {/* Bio */}
          <p className="text-sm text-aura-text-secondary mb-4 line-clamp-2">{creator.bio}</p>
          
          {/* Stats */}
          {showStats && (
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-aura-text-secondary" />
                <span className="font-semibold">{creator.subscriberCount.toLocaleString()}</span>
                <span className="text-aura-text-secondary">subscribers</span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-aura-text-secondary" />
                <span className="font-semibold">{creator.postCount}</span>
                <span className="text-aura-text-secondary">posts</span>
              </div>
            </div>
          )}
          
          {/* Creator Coin */}
          {showCoinPrice && (
            <div className="flex items-center justify-between p-3 bg-aura-surface rounded-lg">
              <div>
                <p className="text-xs text-aura-text-secondary">Creator Coin</p>
                <p className="font-bold text-aura-gold">${creator.coinPrice}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-aura-text-secondary">{creator.coinSymbol}</p>
                <div className="flex items-center gap-1 text-xs text-green-400">
                  <TrendingUp className="w-3 h-3" />
                  +5.2%
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // Default variant
  return (
    <div className={`bg-aura-card p-6 rounded-lg border border-aura-border hover:border-aura-accent/50 transition-colors cursor-pointer ${className}`}>
      <div className="flex items-center gap-4 mb-4">
        <div className="relative">
          <img
            src={creator.avatar}
            alt=""
            className="w-16 h-16 rounded-full object-cover"
          />
          {creator.isLive && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 border-2 border-aura-card rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            </div>
          )}
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-lg">{creator.displayName}</h3>
            {creator.isVerified && (
              <Star className="w-5 h-5 text-aura-gold" fill="currentColor" />
            )}
          </div>
          <p className="text-sm text-aura-text-secondary">@{creator.username}</p>
          
          {showStats && (
            <div className="flex items-center gap-4 mt-2 text-xs text-aura-text-secondary">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {creator.subscriberCount > 1000 
                  ? `${(creator.subscriberCount / 1000).toFixed(1)}K`
                  : creator.subscriberCount
                }
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {creator.postCount}
              </span>
            </div>
          )}
        </div>
        
        {showFollowButton && (
          <button
            onClick={handleFollowClick}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isFollowing
                ? 'bg-aura-surface border border-aura-border text-aura-text hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-400'
                : 'bg-aura-accent hover:bg-aura-accent-hover text-white'
            }`}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        )}
      </div>
      
      <p className="text-sm text-aura-text-secondary mb-4 line-clamp-2">{creator.bio}</p>
      
      {showCoinPrice && (
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="text-aura-gold font-bold">${creator.coinPrice}</span>
            <span className="text-aura-text-secondary ml-1">{creator.coinSymbol}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-green-400">
            <TrendingUp className="w-3 h-3" />
            +5.2%
          </div>
        </div>
      )}
    </div>
  );
}