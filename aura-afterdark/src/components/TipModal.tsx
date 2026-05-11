import { useState } from 'react';
import { X, Coins, MessageSquare, Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TipModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorName: string;
  creatorAvatar: string;
}

export default function TipModal({
  isOpen,
  onClose,
  creatorName,
  creatorAvatar
}: TipModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const presetAmounts = [1, 5, 10, 50, 100];

  if (!isOpen) return null;

  const handleTip = async () => {
    const amount = selectedAmount || parseFloat(customAmount);
    
    if (!amount || amount <= 0) {
      alert('Please select or enter a tip amount');
      return;
    }

    setIsProcessing(true);
    
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsProcessing(false);
    setShowSuccess(true);
    
    // Show success animation
    setTimeout(() => {
      onClose();
      setShowSuccess(false);
      setSelectedAmount(null);
      setCustomAmount('');
      setMessage('');
    }, 3000);
  };

  const getFinalAmount = () => {
    return selectedAmount || parseFloat(customAmount) || 0;
  };

  const getCreatorAmount = () => {
    return getFinalAmount() * 0.95;
  };

  const getPlatformFee = () => {
    return getFinalAmount() * 0.05;
  };

  const isSupperTip = getFinalAmount() > 50;

  if (showSuccess) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-aura-card rounded-2xl p-8 max-w-md w-full border border-aura-accent/30 text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-aura-accent/20 to-aura-gold/20 blur-3xl animate-pulse-slow rounded-full" />
            <div className="relative text-6xl">✨</div>
          </div>
          <h2 className="text-2xl font-bold text-aura-accent mb-2">Tip Sent!</h2>
          <p className="text-aura-text mb-4">
            You tipped <span className="text-aura-accent font-semibold">@{creatorName}</span>{' '}
            <span className="text-aura-gold font-bold">{getFinalAmount()} ORA</span>
          </p>
          
          {isSupperTip && (
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-gradient-to-r from-aura-gold/20 to-orange-500/20 blur-xl animate-pulse-slow rounded-xl" />
              <div className="relative bg-gradient-to-r from-aura-gold/10 to-orange-500/10 border border-aura-gold/30 rounded-xl p-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Sparkles className="w-6 h-6 text-aura-gold animate-pulse" />
                  <span className="text-aura-gold font-bold">SUPER TIP!</span>
                  <Sparkles className="w-6 h-6 text-aura-gold animate-pulse" />
                </div>
                <p className="text-aura-gold/80 text-sm">
                  Your generous support makes this creator shine!
                </p>
              </div>
            </div>
          )}
          
          <div className="text-sm text-aura-text-secondary">
            Closing automatically...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-aura-card rounded-2xl p-6 max-w-md w-full border border-aura-border max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-aura-text flex items-center gap-2">
            <Coins className="w-6 h-6 text-aura-gold" />
            Send Tip
          </h2>
          <button
            onClick={onClose}
            className="text-aura-text-secondary hover:text-aura-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Creator Info */}
        <div className="bg-aura-surface/20 rounded-xl p-4 mb-6 border border-aura-border/30">
          <div className="flex items-center gap-3">
            <img
              src={creatorAvatar}
              alt=""
              className="w-12 h-12 rounded-full bg-aura-surface object-cover"
            />
            <div>
              <h3 className="font-bold text-aura-text">@{creatorName}</h3>
              <p className="text-aura-text-secondary text-sm">Content Creator</p>
            </div>
          </div>
        </div>

        {/* Preset Amounts */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-aura-text mb-3">Select Amount (ORA)</label>
          <div className="grid grid-cols-5 gap-2">
            {presetAmounts.map((amount) => (
              <button
                key={amount}
                onClick={() => {
                  setSelectedAmount(amount);
                  setCustomAmount('');
                }}
                className={`py-3 px-2 rounded-xl text-sm font-semibold transition-all ${
                  selectedAmount === amount
                    ? 'bg-gradient-to-r from-aura-accent to-aura-accent-hover text-white scale-105 shadow-lg shadow-aura-accent/25'
                    : 'bg-aura-surface/30 border border-aura-border text-aura-text hover:bg-aura-accent/20 hover:border-aura-accent/50'
                }`}
              >
                {amount}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Amount */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-aura-text mb-2">Custom Amount</label>
          <input
            type="number"
            value={customAmount}
            onChange={(e) => {
              setCustomAmount(e.target.value);
              setSelectedAmount(null);
            }}
            className="w-full px-4 py-3 bg-aura-surface/30 border border-aura-border rounded-xl text-aura-text focus:outline-none focus:border-aura-accent transition-colors"
            placeholder="Enter custom amount..."
            min="1"
            step="1"
          />
        </div>

        {/* Message */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-aura-text mb-2 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Message (Optional)
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full px-4 py-3 bg-aura-surface/30 border border-aura-border rounded-xl text-aura-text focus:outline-none focus:border-aura-accent transition-colors resize-none"
            placeholder="Leave a message for the creator..."
            rows={3}
            maxLength={200}
          />
          <div className="text-right text-xs text-aura-text-secondary mt-1">
            {message.length}/200
          </div>
        </div>

        {/* Fee Breakdown */}
        {getFinalAmount() > 0 && (
          <div className="bg-aura-accent/10 border border-aura-accent/20 rounded-xl p-4 mb-6">
            <h4 className="text-aura-accent font-semibold mb-3 flex items-center gap-2">
              <Coins className="w-4 h-4" />
              Fee Breakdown
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-aura-text-secondary">Creator receives (95%)</span>
                <span className="text-green-400 font-bold">{getCreatorAmount().toFixed(2)} ORA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-aura-text-secondary">Platform fee (5%)</span>
                <span className="text-aura-text-secondary">{getPlatformFee().toFixed(2)} ORA</span>
              </div>
              <hr className="border-aura-border" />
              <div className="flex justify-between font-semibold">
                <span className="text-aura-text">Total</span>
                <span className="text-aura-accent">{getFinalAmount().toFixed(2)} ORA</span>
              </div>
            </div>
          </div>
        )}

        {/* Super Tip Notice */}
        {isSupperTip && (
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-aura-gold/10 to-orange-500/10 blur-xl animate-pulse-slow rounded-xl" />
            <div className="relative bg-gradient-to-r from-aura-gold/5 to-orange-500/5 border border-aura-gold/30 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-aura-gold animate-pulse" />
                <h4 className="text-aura-gold font-bold">Super Tip!</h4>
                <Sparkles className="w-5 h-5 text-aura-gold animate-pulse" />
              </div>
              <p className="text-aura-gold/80 text-sm">
                Your generous tip will be highlighted with special effects!
              </p>
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
            onClick={handleTip}
            disabled={getFinalAmount() <= 0 || isProcessing}
            className="flex-1 bg-gradient-to-r from-aura-accent to-aura-accent-hover hover:from-aura-accent-hover hover:to-aura-accent relative overflow-hidden group"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white animate-spin rounded-full" />
                Processing...
              </span>
            ) : (
              <>
                <span className="relative z-10">Send {getFinalAmount().toFixed(0)} ORA</span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
              </>
            )}
          </Button>
        </div>

        {/* Platform Info */}
        <div className="mt-4 text-xs text-aura-text-secondary text-center">
          💡 95% goes directly to creators, 5% supports platform development
        </div>
      </div>
    </div>
  );
}