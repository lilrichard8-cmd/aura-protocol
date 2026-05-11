import { useState } from 'react';
import { X, Search, TrendingUp, Clock, Target, Sparkles, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface CurationStakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentTitle: string;
  contentAuthor: string;
  contentThumbnail: string;
}

interface CurationHistory {
  amount: number;
  timestamp: string;
  multiplier: number;
  estimatedReward: number;
}

const mockCurationHistory: CurationHistory[] = [
  {
    amount: 50,
    timestamp: '2024-03-12 15:30',
    multiplier: 2.0,
    estimatedReward: 8.5
  },
  {
    amount: 25,
    timestamp: '2024-03-11 09:15',
    multiplier: 1.5,
    estimatedReward: 3.2
  }
];

const mockCurrentSignals = {
  totalStaked: 1250,
  curators: 23,
  qualityScore: 8.5,
  trending: 'rising' as const
};

export default function CurationStakeModal({
  isOpen,
  onClose,
  contentTitle,
  contentAuthor,
  contentThumbnail
}: CurationStakeModalProps) {
  const [stakeAmount, setStakeAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  if (!isOpen) return null;

  const getTimeMultiplier = () => {
    // Simulate time-based multiplier calculation
    const publishTime = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
    const now = Date.now();
    const hoursSincePublish = (now - publishTime) / (1000 * 60 * 60);
    
    if (hoursSincePublish <= 0.25) return 5.0;
    if (hoursSincePublish <= 1) return 3.0;
    if (hoursSincePublish <= 6) return 2.0;
    if (hoursSincePublish <= 24) return 1.5;
    return 1.0;
  };

  const calculateExpectedReward = () => {
    if (!stakeAmount || parseFloat(stakeAmount) < 10) return 0;
    
    const amount = parseFloat(stakeAmount);
    const timeMultiplier = getTimeMultiplier();
    const qualityEstimate = mockCurrentSignals.qualityScore / 10;
    const baseReward = amount * 0.12; // 12% base APR
    
    return baseReward * timeMultiplier * qualityEstimate;
  };

  const getTimeMultiplierLabel = () => {
    const multiplier = getTimeMultiplier();
    if (multiplier >= 5.0) return 'First curator: 5x';
    if (multiplier >= 3.0) return 'Within 1h: 3x';
    if (multiplier >= 2.0) return 'Within 6h: 2x';
    if (multiplier >= 1.5) return 'Within 24h: 1.5x';
    return 'After 24h: 1x';
  };

  const handleStake = async () => {
    const amount = parseFloat(stakeAmount);
    
    if (!amount || amount < 10) {
      alert('Minimum curation amount is 10 ORA');
      return;
    }

    setIsProcessing(true);
    
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    setIsProcessing(false);
    setShowSuccess(true);
    
    // Show success for a moment then close
    setTimeout(() => {
      onClose();
      setShowSuccess(false);
      setStakeAmount('');
    }, 3000);
  };

  if (showSuccess) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-aura-card rounded-2xl p-8 max-w-md w-full border border-aura-accent/30 text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-aura-accent/20 to-aura-gold/20 blur-3xl animate-pulse-slow rounded-full" />
            <div className="relative flex items-center justify-center gap-2 text-4xl">
              <Search className="w-12 h-12 text-aura-accent" />
              <Sparkles className="w-8 h-8 text-aura-gold animate-pulse" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-aura-accent mb-4">Curation Started!</h2>
          <p className="text-aura-text mb-2">
            You're now curating <span className="text-aura-accent font-semibold">"{contentTitle}"</span>
          </p>
          <p className="text-aura-text-secondary text-sm mb-4">
            Stake: {parseFloat(stakeAmount).toFixed(0)} ORA | Expected: {calculateExpectedReward().toFixed(2)} ORA
          </p>
          
          <div className="bg-aura-accent/10 border border-aura-accent/30 rounded-xl p-3">
            <p className="text-aura-accent font-semibold text-sm flex items-center justify-center gap-2">
              <Target className="w-4 h-4" />
              Content curation active
            </p>
            <p className="text-aura-accent/70 text-xs mt-1">
              Rewards based on content performance and time weight
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-aura-card rounded-2xl p-6 max-w-lg w-full border border-aura-border max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-aura-text flex items-center gap-2">
            <Search className="w-6 h-6 text-aura-accent" />
            Curate Content
          </h2>
          <button
            onClick={onClose}
            className="text-aura-text-secondary hover:text-aura-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Preview */}
        <div className="bg-aura-surface/20 rounded-xl p-4 mb-6 border border-aura-border/30">
          <div className="flex items-start gap-3">
            <img
              src={contentThumbnail}
              alt=""
              className="w-16 h-16 rounded-xl bg-aura-surface object-cover flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-aura-text mb-1 line-clamp-2">{contentTitle}</h3>
              <p className="text-aura-text-secondary text-sm mb-2">by @{contentAuthor}</p>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-aura-accent">Quality: {mockCurrentSignals.qualityScore}/10</span>
                <Badge
                  variant="outline"
                  className={
                    mockCurrentSignals.trending === 'rising' 
                      ? 'border-green-500/50 text-green-400' 
                      : 'border-aura-gold/50 text-aura-gold'
                  }
                >
                  <TrendingUp className="w-3 h-3 mr-1" />
                  {mockCurrentSignals.trending === 'rising' ? 'Rising' : 'Stable'}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Current Curation Signals */}
        <div className="bg-aura-accent/10 border border-aura-accent/20 rounded-xl p-4 mb-6">
          <h4 className="text-aura-accent font-semibold mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Current Curation Status
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-aura-text">{mockCurrentSignals.totalStaked.toLocaleString()}</div>
              <div className="text-xs text-aura-text-secondary">Total Staked</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-aura-text">{mockCurrentSignals.curators}</div>
              <div className="text-xs text-aura-text-secondary">Curators</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-aura-accent">{getTimeMultiplier().toFixed(1)}x</div>
              <div className="text-xs text-aura-text-secondary">Time Weight</div>
            </div>
          </div>
        </div>

        {/* Time Multiplier Info */}
        <div className="bg-gradient-to-r from-aura-gold/10 to-orange-500/10 border border-aura-gold/20 rounded-xl p-4 mb-6">
          <h4 className="text-aura-gold font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Time Multiplier Bonuses
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-aura-text-secondary">First curator</span>
              <span className="text-green-400 font-bold">5x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-aura-text-secondary">Within 1h</span>
              <span className="text-blue-400 font-bold">3x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-aura-text-secondary">Within 6h</span>
              <span className="text-aura-accent font-bold">2x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-aura-text-secondary">Within 24h</span>
              <span className="text-aura-gold font-bold">1.5x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-aura-text-secondary">After 24h</span>
              <span className="text-aura-text-secondary">1x</span>
            </div>
            <hr className="border-aura-border" />
            <div className="flex justify-between font-semibold">
              <span className="text-aura-gold">Current</span>
              <span className="text-aura-gold">{getTimeMultiplierLabel()}</span>
            </div>
          </div>
        </div>

        {/* Stake Amount Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-aura-text mb-2">Curation Stake (ORA)</label>
          <input
            type="number"
            value={stakeAmount}
            onChange={(e) => setStakeAmount(e.target.value)}
            className="w-full px-4 py-3 bg-aura-surface/30 border border-aura-border rounded-xl text-aura-text focus:outline-none focus:border-aura-accent transition-colors"
            placeholder="Minimum 10 ORA"
            min="10"
            step="1"
          />
          
          <div className="flex gap-2 mt-3">
            {[10, 25, 50, 100].map((amount) => (
              <button
                key={amount}
                onClick={() => setStakeAmount(amount.toString())}
                className="flex-1 py-2 bg-aura-surface/20 border border-aura-border rounded-lg text-sm hover:bg-aura-accent/20 hover:border-aura-accent/50 transition-all text-aura-text"
              >
                {amount}
              </button>
            ))}
          </div>
        </div>

        {/* Expected Reward Calculator */}
        {parseFloat(stakeAmount) >= 10 && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6">
            <h4 className="text-green-400 font-semibold mb-3 flex items-center gap-2">
              <Coins className="w-4 h-4" />
              Expected Reward Calculation
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-aura-text-secondary">Stake Amount</span>
                <span className="text-aura-text">{parseFloat(stakeAmount).toFixed(0)} ORA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-aura-text-secondary">Time Weight</span>
                <span className="text-aura-gold font-bold">{getTimeMultiplier().toFixed(1)}x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-aura-text-secondary">Quality Score</span>
                <span className="text-aura-accent">{mockCurrentSignals.qualityScore}/10</span>
              </div>
              <hr className="border-aura-border" />
              <div className="flex justify-between font-semibold">
                <span className="text-green-400">Expected Monthly</span>
                <span className="text-green-400">{calculateExpectedReward().toFixed(2)} ORA</span>
              </div>
              <div className="text-center text-xs text-aura-text-secondary mt-2">
                * Actual rewards depend on content performance
              </div>
            </div>
          </div>
        )}

        {/* Your Curation History on This Content */}
        {mockCurationHistory.length > 0 && (
          <div className="bg-aura-surface/20 rounded-xl p-4 mb-6 border border-aura-border/30">
            <h4 className="text-aura-text font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Your Curation History
            </h4>
            <div className="space-y-2">
              {mockCurationHistory.map((record, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-aura-accent font-semibold">{record.amount} ORA</span>
                    <span className="text-aura-text-secondary text-xs ml-2">{record.timestamp}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-aura-gold font-semibold">{record.multiplier}x</div>
                    <div className="text-xs text-green-400">+{record.estimatedReward} ORA</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleStake}
            disabled={!stakeAmount || parseFloat(stakeAmount) < 10 || isProcessing}
            className="flex-1 bg-gradient-to-r from-aura-accent to-aura-accent-hover hover:from-aura-accent-hover hover:to-aura-accent relative overflow-hidden group"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white animate-spin rounded-full" />
                Processing...
              </span>
            ) : (
              <>
                <span className="relative z-10 flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Start Curation
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
              </>
            )}
          </Button>
        </div>

        {/* Info Notice */}
        <div className="mt-4 text-xs text-aura-text-secondary text-center">
          💡 Curation rewards based on content performance and time weight
        </div>
      </div>
    </div>
  );
}