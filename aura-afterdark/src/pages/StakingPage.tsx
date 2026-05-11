import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, TrendingUp, Clock, Trophy, Coins, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface StakingTier {
  id: string;
  name: string;
  period: number; // days
  multiplier: number;
  minAmount: number;
  features: string[];
  gradient: string;
  icon: string;
}

interface ActiveStake {
  id: string;
  amount: number;
  tier: StakingTier;
  stakeDate: Date;
  unlockDate: Date;
  rewardsAccrued: number;
  status: 'active' | 'unlockable' | 'unlocked';
}

const stakingTiers: StakingTier[] = [
  {
    id: 'tier1',
    name: 'Flash Stake',
    period: 1,
    multiplier: 1.0,
    minAmount: 1000,
    features: ['Flexible unlock', 'Base rewards'],
    gradient: 'from-blue-500 to-cyan-500',
    icon: '⚡'
  },
  {
    id: 'tier2',
    name: 'Curation Boost',
    period: 30,
    multiplier: 1.0,
    minAmount: 1000,
    features: ['1x multiplier', 'Curation rights', 'Governance voting'],
    gradient: 'from-aura-accent to-pink-500',
    icon: '🎯'
  },
  {
    id: 'tier3',
    name: 'Power Stake',
    period: 90,
    multiplier: 1.5,
    minAmount: 1000,
    features: ['1.5x multiplier', 'Priority curation', 'Advanced features'],
    gradient: 'from-aura-gold to-orange-500',
    icon: '⚡'
  },
  {
    id: 'tier4',
    name: 'Elite Stake',
    period: 180,
    multiplier: 2.0,
    minAmount: 1000,
    features: ['2x multiplier', 'Exclusive content', 'VIP privileges'],
    gradient: 'from-purple-500 to-red-500',
    icon: '👑'
  }
];

const mockActiveStakes: ActiveStake[] = [
  {
    id: '1',
    amount: 5000,
    tier: stakingTiers[2],
    stakeDate: new Date('2024-02-13'),
    unlockDate: new Date('2024-05-13'),
    rewardsAccrued: 275.5,
    status: 'active'
  },
  {
    id: '2',
    amount: 2000,
    tier: stakingTiers[1],
    stakeDate: new Date('2024-03-01'),
    unlockDate: new Date('2024-03-31'),
    rewardsAccrued: 45.2,
    status: 'unlockable'
  }
];

export default function StakingPage() {
  const navigate = useNavigate();
  const [showStakeModal, setShowStakeModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState<StakingTier | null>(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [showFeeBreakdown, setShowFeeBreakdown] = useState(false);

  // Mock data
  const totalStaked = mockActiveStakes.reduce((sum, stake) => sum + stake.amount, 0);
  const totalRewards = mockActiveStakes.reduce((sum, stake) => sum + stake.rewardsAccrued, 0);
  const avgAPY = 28.5;

  const handleStake = (tier: StakingTier) => {
    setSelectedTier(tier);
    setShowStakeModal(true);
  };

  const handleStakeConfirm = () => {
    if (!stakeAmount || parseFloat(stakeAmount) < (selectedTier?.minAmount || 1000)) {
      alert(`Minimum stake amount is ${selectedTier?.minAmount || 1000} ORA`);
      return;
    }

    alert(`✅ Stake successful!\n\nDetails:\n• Amount: ${stakeAmount} ORA\n• Tier: ${selectedTier?.name} (${selectedTier?.period} days)\n• Multiplier: ${selectedTier?.multiplier}x\n• Expected APY: ${avgAPY}%\n\nTx Hash: TX${Date.now()}`);
    
    setShowStakeModal(false);
    setStakeAmount('');
    setSelectedTier(null);
  };

  const handleClaim = (stakeId: string) => {
    const stake = mockActiveStakes.find(s => s.id === stakeId);
    if (!stake) return;
    
    alert(`💰 Rewards claimed: ${stake.rewardsAccrued.toFixed(2)} ORA`);
  };

  const handleUnstake = (stakeId: string) => {
    const stake = mockActiveStakes.find(s => s.id === stakeId);
    if (!stake) return;
    
    alert(`✅ Unstaked: ${stake.amount} ORA\nRewards: ${stake.rewardsAccrued.toFixed(2)} ORA`);
  };

  const getDaysLeft = (unlockDate: Date) => {
    const now = new Date();
    const diff = unlockDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  return (
    <div className="min-h-screen pb-24 md:pb-8 bg-aura-bg">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-aura-bg/90 backdrop-blur-md border-b border-aura-border/50">
        <div className="max-w-6xl mx-auto flex items-center gap-3 px-4 h-14 md:ml-64">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-aura-surface/50 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-aura-text" />
          </button>
          <h1 className="text-lg font-bold text-aura-text flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Staking
          </h1>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 pt-4 space-y-6 md:ml-64">
        {/* Staking Overview */}
        <div className="bg-gradient-to-br from-aura-accent/20 to-aura-card border border-aura-accent/20 rounded-2xl p-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-aura-text mb-2 flex items-center justify-center gap-2">
              <Lock className="w-6 h-6" />
              Staking Overview
            </h2>
            <p className="text-aura-text-secondary">Stake ORA tokens to earn rewards and governance rights</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-aura-surface/30 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-aura-text mb-1">{totalStaked.toLocaleString()}</div>
              <div className="text-sm text-aura-text-secondary">Total Staked ORA</div>
            </div>
            <div className="bg-aura-surface/30 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-aura-gold mb-1">{avgAPY}%</div>
              <div className="text-sm text-aura-text-secondary">Average APY</div>
            </div>
            <div className="bg-aura-surface/30 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-400 mb-1">{totalRewards.toFixed(1)}</div>
              <div className="text-sm text-aura-text-secondary">Total Rewards</div>
            </div>
          </div>
        </div>

        {/* Staking Tiers */}
        <div>
          <h3 className="text-xl font-bold text-aura-text mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-aura-gold" />
            Staking Tiers
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stakingTiers.map((tier) => (
              <div
                key={tier.id}
                className="bg-aura-card/30 border border-aura-border/50 rounded-2xl p-4 hover:border-aura-accent/50 transition-all hover:scale-105"
              >
                <div className={`bg-gradient-to-r ${tier.gradient} rounded-xl p-4 mb-4 text-center`}>
                  <div className="text-3xl mb-2">{tier.icon}</div>
                  <h4 className="text-white font-bold text-lg">{tier.name}</h4>
                  <p className="text-white/90 text-sm">{tier.period} day lock</p>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between">
                    <span className="text-aura-text-secondary text-sm">Multiplier</span>
                    <span className="text-aura-accent font-bold">{tier.multiplier}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-aura-text-secondary text-sm">Min Stake</span>
                    <span className="text-aura-text font-semibold">{tier.minAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-aura-text-secondary text-sm">Expected APY</span>
                    <span className="text-green-400 font-bold">{(avgAPY * tier.multiplier).toFixed(1)}%</span>
                  </div>
                </div>

                <div className="space-y-1 mb-4">
                  {tier.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-green-400" />
                      <span className="text-aura-text-secondary text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => handleStake(tier)}
                  className="w-full bg-aura-accent hover:bg-aura-accent-hover text-white font-semibold"
                >
                  Stake Now
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Active Stakes */}
        <div className="bg-aura-card/30 border border-aura-border/50 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-aura-text flex items-center gap-2">
              <Coins className="w-5 h-5" />
              My Stakes
            </h3>
            <Button
              onClick={() => {
                const totalRewards = mockActiveStakes.reduce((sum, stake) => sum + stake.rewardsAccrued, 0);
                alert(`💰 All rewards claimed: ${totalRewards.toFixed(2)} ORA`);
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              Claim All
            </Button>
          </div>

          {mockActiveStakes.length === 0 ? (
            <div className="text-center py-8">
              <Lock className="w-16 h-16 text-aura-text-secondary mx-auto mb-4" />
              <p className="text-aura-text-secondary">No active stakes. Choose a tier to start staking!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {mockActiveStakes.map((stake) => (
                <div
                  key={stake.id}
                  className="bg-aura-surface/20 rounded-xl p-4 border border-aura-border/30"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-bold text-aura-text">{stake.tier.name}</h4>
                      <p className="text-aura-text-secondary text-sm">
                        Staked on {stake.stakeDate.toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        stake.status === 'active' 
                          ? 'border-blue-500/50 text-blue-400'
                          : stake.status === 'unlockable'
                          ? 'border-green-500/50 text-green-400'
                          : 'border-gray-500/50 text-gray-400'
                      }
                    >
                      {stake.status === 'active' 
                        ? 'Active'
                        : stake.status === 'unlockable'
                        ? 'Unlockable'
                        : 'Completed'
                      }
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="bg-aura-bg/50 rounded-lg p-3">
                      <div className="text-xs text-aura-text-secondary">Staked Amount</div>
                      <div className="text-lg font-bold text-aura-accent">{stake.amount.toLocaleString()}</div>
                    </div>
                    <div className="bg-aura-bg/50 rounded-lg p-3">
                      <div className="text-xs text-aura-text-secondary">Multiplier</div>
                      <div className="text-lg font-bold text-aura-gold">{stake.tier.multiplier}x</div>
                    </div>
                    <div className="bg-aura-bg/50 rounded-lg p-3">
                      <div className="text-xs text-aura-text-secondary">Rewards</div>
                      <div className="text-lg font-bold text-green-400">{stake.rewardsAccrued.toFixed(2)}</div>
                    </div>
                    <div className="bg-aura-bg/50 rounded-lg p-3">
                      <div className="text-xs text-aura-text-secondary">Days Left</div>
                      <div className="text-lg font-bold text-aura-text">
                        {stake.status === 'active' ? getDaysLeft(stake.unlockDate) : 0}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleClaim(stake.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Claim Rewards
                    </Button>
                    
                    {stake.status === 'unlockable' && (
                      <Button
                        onClick={() => handleUnstake(stake.id)}
                        variant="outline"
                        className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                      >
                        Unstake
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fee Breakdown */}
        <div className="bg-aura-card/30 border border-aura-border/50 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-aura-text flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Reward Sources
            </h3>
            <Button
              variant="ghost"
              onClick={() => setShowFeeBreakdown(!showFeeBreakdown)}
              className="text-aura-accent"
            >
              {showFeeBreakdown ? 'Hide' : 'Show'} Details
            </Button>
          </div>

          {showFeeBreakdown && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/20 rounded-xl p-4">
                  <h4 className="font-bold text-green-400 mb-2 flex items-center gap-2">
                    <Coins className="w-4 h-4" />
                    Inflation Rewards (20%)
                  </h4>
                  <p className="text-aura-text-secondary text-sm">
                    New ORA tokens minted and distributed to stakers to maintain network incentives
                  </p>
                  <div className="text-xl font-bold text-green-400 mt-2">Primary Source</div>
                </div>
                
                <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-xl p-4">
                  <h4 className="font-bold text-blue-400 mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Trading Fees (2%)
                  </h4>
                  <p className="text-aura-text-secondary text-sm">
                    A portion of platform transaction fees distributed to stakers
                  </p>
                  <div className="text-xl font-bold text-blue-400 mt-2">Secondary Source</div>
                </div>
              </div>

              <div className="bg-aura-gold/10 border border-aura-gold/20 rounded-xl p-4">
                <h4 className="font-bold text-aura-gold mb-2">Dynamic Adjustment Mechanism</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-aura-text-secondary">
                  <div>
                    <div className="font-semibold text-aura-text mb-1">Staking Rate Impact</div>
                    <ul className="space-y-1">
                      <li>• Staking rate &lt; 50%: Increase rewards</li>
                      <li>• Staking rate &gt; 80%: Decrease rewards</li>
                      <li>• Target staking rate: 60-70%</li>
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold text-aura-text mb-1">Network Activity</div>
                    <ul className="space-y-1">
                      <li>• Higher volume: More fee distribution</li>
                      <li>• User growth: Increased inflation rewards</li>
                      <li>• Governance participation: Extra incentives</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stake Modal */}
      {showStakeModal && selectedTier && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-aura-card rounded-2xl p-6 max-w-md w-full border border-aura-border">
            <h2 className="text-2xl font-bold text-aura-text mb-4">
              {selectedTier.icon} {selectedTier.name}
            </h2>

            <div className="bg-aura-surface/30 rounded-xl p-4 mb-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-aura-text-secondary">Lock Period</span>
                  <span className="text-aura-text">{selectedTier.period} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-aura-text-secondary">Multiplier</span>
                  <span className="text-aura-accent font-bold">{selectedTier.multiplier}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-aura-text-secondary">Expected APY</span>
                  <span className="text-green-400 font-bold">{(avgAPY * selectedTier.multiplier).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-aura-text-secondary">Min Stake</span>
                  <span className="text-aura-text">{selectedTier.minAmount.toLocaleString()} ORA</span>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-aura-text mb-2">Stake Amount (ORA)</label>
              <input
                type="number"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                className="w-full px-4 py-3 bg-aura-surface/30 border border-aura-border rounded-lg text-aura-text focus:outline-none focus:border-aura-accent"
                placeholder={`Min ${selectedTier.minAmount.toLocaleString()}`}
                min={selectedTier.minAmount}
              />
              
              <div className="flex gap-2 mt-3">
                {[selectedTier.minAmount, 5000, 10000, 50000].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setStakeAmount(amount.toString())}
                    className="flex-1 py-2 bg-aura-surface/20 border border-aura-border rounded-lg text-sm hover:bg-aura-accent/20 hover:border-aura-accent/50 transition-all text-aura-text"
                  >
                    {amount.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {stakeAmount && parseFloat(stakeAmount) >= selectedTier.minAmount && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6">
                <div className="text-sm">
                  <div className="flex justify-between mb-2">
                    <span className="text-aura-text-secondary">Est. Annual Rewards</span>
                    <span className="text-green-400 font-bold">
                      {((parseFloat(stakeAmount) * avgAPY * selectedTier.multiplier) / 100).toFixed(2)} ORA
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-aura-text-secondary">Unlock Date</span>
                    <span className="text-aura-text">
                      {new Date(Date.now() + selectedTier.period * 24 * 60 * 60 * 1000).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowStakeModal(false);
                  setSelectedTier(null);
                  setStakeAmount('');
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleStakeConfirm}
                disabled={!stakeAmount || parseFloat(stakeAmount) < selectedTier.minAmount}
                className="flex-1 bg-aura-accent hover:bg-aura-accent-hover"
              >
                Confirm Stake
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}