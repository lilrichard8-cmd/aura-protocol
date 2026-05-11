import { useState } from 'react';
import { Search, Trophy, TrendingUp, Users, Coins, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ActiveCuration {
  id: string;
  title: string;
  creator: string;
  staked: number;
  multiplier: number;
  reward: number;
  status: 'active' | 'unlockable';
}

const mockActiveCurations: ActiveCuration[] = [
  {
    id: '1',
    title: 'Neon Dreams #47',
    creator: 'crimson_rose',
    staked: 250,
    multiplier: 2.0,
    reward: 18.5,
    status: 'active'
  },
  {
    id: '2',
    title: 'After Hours',
    creator: 'nightshade',
    staked: 100,
    multiplier: 1.5,
    reward: 6.2,
    status: 'unlockable'
  }
];

const leaderboard = [
  { rank: 1, user: 'TopCurator', staked: 50000, reward: 2500, badge: '👑' },
  { rank: 2, user: 'ArtHunter', staked: 35000, reward: 1750, badge: '🔥' },
  { rank: 3, user: 'TrendSeeker', staked: 28000, reward: 1400, badge: '⚡' },
  { rank: 4, user: 'You', staked: 350, reward: 24.7, badge: '✨' }
];

export default function CurationPage() {
  const [showStats, setShowStats] = useState(true);

  const totalRewards = mockActiveCurations.reduce((sum, c) => sum + c.reward, 0);
  const totalStaked = mockActiveCurations.reduce((sum, c) => sum + c.staked, 0);

  return (
    <div className="min-h-screen bg-aura-bg text-aura-text pb-24 md:pb-8">
      <div className="max-w-6xl mx-auto px-4 py-8 md:ml-64 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-aura-gold via-orange-500 to-red-500">
                Curation Mining
              </span>
            </h1>
            <p className="text-aura-text-secondary mt-2">
              Curate quality content and earn ORA rewards
            </p>
          </div>
          <Button
            onClick={() => setShowStats(!showStats)}
            variant="outline"
            className="border-aura-border text-aura-text"
          >
            {showStats ? 'Hide' : 'Show'} Stats
          </Button>
        </div>

        {/* Overview */}
        {showStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-aura-card/30 border border-aura-border/50 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <Coins className="w-5 h-5 text-aura-gold" />
                <span className="text-sm text-aura-text-secondary">Total Staked</span>
              </div>
              <div className="text-2xl font-bold text-aura-text">{totalStaked.toLocaleString()} ORA</div>
            </div>
            <div className="bg-aura-card/30 border border-aura-border/50 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <span className="text-sm text-aura-text-secondary">Total Rewards</span>
              </div>
              <div className="text-2xl font-bold text-green-400">{totalRewards.toFixed(2)} ORA</div>
            </div>
            <div className="bg-aura-card/30 border border-aura-border/50 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <Star className="w-5 h-5 text-aura-accent" />
                <span className="text-sm text-aura-text-secondary">Reputation Score</span>
              </div>
              <div className="text-2xl font-bold text-aura-accent">82.5</div>
              <div className="text-xs text-aura-text-secondary mt-1">Gold Curator</div>
            </div>
          </div>
        )}

        {/* Active Curations */}
        <div className="bg-aura-card/30 border border-aura-border/50 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-aura-text flex items-center gap-2">
              <Search className="w-5 h-5 text-aura-accent" />
              Your Active Curations
            </h2>
            <Badge variant="outline" className="border-aura-border text-aura-text-secondary">
              {mockActiveCurations.length} active
            </Badge>
          </div>

          {mockActiveCurations.length === 0 ? (
            <div className="text-center py-8 text-aura-text-secondary">
              <Search className="w-12 h-12 mx-auto mb-3" />
              <p>No active curations. Start curating to earn rewards!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {mockActiveCurations.map((curation) => (
                <div
                  key={curation.id}
                  className="flex items-center justify-between p-4 bg-aura-surface/20 rounded-xl border border-aura-border/30"
                >
                  <div>
                    <div className="font-semibold text-aura-text">{curation.title}</div>
                    <div className="text-xs text-aura-text-secondary">by @{curation.creator}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-aura-accent font-bold">{curation.staked} ORA</div>
                    <div className="text-xs text-aura-text-secondary">
                      {curation.multiplier}x • {curation.reward.toFixed(2)} ORA
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={curation.status === 'active'
                      ? 'border-blue-500/50 text-blue-400'
                      : 'border-green-500/50 text-green-400'}
                  >
                    {curation.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div className="bg-aura-card/30 border border-aura-border/50 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-aura-text flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-aura-gold" />
            Curation Leaderboard
          </h2>
          <div className="space-y-3">
            {leaderboard.map((curator) => (
              <div
                key={curator.rank}
                className={`flex items-center gap-3 p-3 rounded-xl ${
                  curator.user === 'You' ? 'bg-aura-accent/10 border border-aura-accent/30' : 'bg-aura-surface/20'
                }`}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold bg-aura-surface/50">
                  {curator.rank <= 3 ? curator.badge : `#${curator.rank}`}
                </div>
                <div className="flex-1">
                  <div className={`font-semibold text-sm ${curator.user === 'You' ? 'text-aura-accent' : 'text-aura-text'}`}>
                    {curator.user}
                  </div>
                  <div className="text-xs text-aura-text-secondary">
                    Staked {curator.staked.toLocaleString()} ORA
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-green-400">{curator.reward.toFixed(0)}</div>
                  <div className="text-xs text-aura-text-secondary">Rewards</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reputation */}
        <div className="bg-gradient-to-r from-aura-accent/10 to-aura-gold/10 border border-aura-border/50 rounded-2xl p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Users className="w-5 h-5 text-aura-gold" />
            <span className="text-aura-text-secondary">Curation Reputation</span>
          </div>
          <div className="text-3xl font-bold text-aura-gold">82.5</div>
          <div className="text-xs text-aura-text-secondary">Top 12% curators</div>
        </div>
      </div>
    </div>
  );
}