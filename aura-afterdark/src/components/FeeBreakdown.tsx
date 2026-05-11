import { FC, useEffect, useState } from 'react';

export interface FeeBreakdownData {
  total: number;
  creator: number;   // 95%
  burn: number;      // 2.5%
  staking: number;   // 2%
  ops: number;       // 0.5%
}

interface FeeBreakdownProps {
  isOpen: boolean;
  onClose: () => void;
  data: FeeBreakdownData;
  creatorName: string;
}

export const FeeBreakdown: FC<FeeBreakdownProps> = ({
  isOpen,
  onClose,
  data,
  creatorName,
}) => {
  const [animationStep, setAnimationStep] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setAnimationStep(0);
      const timer = setInterval(() => {
        setAnimationStep(prev => {
          if (prev >= 4) {
            clearInterval(timer);
            return prev;
          }
          return prev + 1;
        });
      }, 800);
      return () => clearInterval(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatAmount = (amount: number) => amount.toFixed(2);

  return (
    <div className="fixed inset-0 bg-aura-bg/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-aura-card rounded-2xl p-8 max-w-lg w-full border border-aura-border relative overflow-hidden">
        {/* Background animation */}
        <div className="absolute inset-0 bg-gradient-to-br from-aura-accent/5 via-aura-gold/5 to-aura-accent/5 animate-pulse"></div>
        
        <div className="relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-aura-text">💰 费用分解</h3>
            <button 
              onClick={onClose}
              className="text-aura-text-secondary hover:text-aura-text transition-colors text-2xl"
            >
              ✕
            </button>
          </div>

          {/* Total */}
          <div className="text-center mb-8">
            <div className="text-4xl font-bold text-aura-text mb-2">
              ${formatAmount(data.total)}
            </div>
            <div className="text-aura-text-secondary">
              支付给 <span className="text-aura-accent font-semibold">{creatorName}</span>
            </div>
          </div>

          {/* Breakdown Items */}
          <div className="space-y-4 mb-8">
            {/* Creator (95%) */}
            <div className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-500 ${
              animationStep >= 1 ? 'bg-aura-accent/10 border-aura-accent/30' : 'bg-aura-surface border-aura-border'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-aura-accent/20 flex items-center justify-center">
                  👤
                </div>
                <div>
                  <div className="font-semibold text-aura-text">{creatorName}</div>
                  <div className="text-sm text-aura-text-secondary">创作者收益</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-aura-accent">${formatAmount(data.creator)}</div>
                <div className="text-xs text-aura-text-secondary">95%</div>
              </div>
            </div>

            {/* Burn (2.5%) */}
            <div className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-500 ${
              animationStep >= 2 ? 'bg-orange-500/10 border-orange-500/30' : 'bg-aura-surface border-aura-border'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                  🔥
                </div>
                <div>
                  <div className="font-semibold text-aura-text">ORA 销毁</div>
                  <div className="text-sm text-aura-text-secondary">通缩机制</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-orange-400">${formatAmount(data.burn)}</div>
                <div className="text-xs text-aura-text-secondary">2.5%</div>
              </div>
            </div>

            {/* Staking (2%) */}
            <div className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-500 ${
              animationStep >= 3 ? 'bg-aura-gold/10 border-aura-gold/30' : 'bg-aura-surface border-aura-border'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-aura-gold/20 flex items-center justify-center">
                  💎
                </div>
                <div>
                  <div className="font-semibold text-aura-text">质押奖励</div>
                  <div className="text-sm text-aura-text-secondary">分配给质押者</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-aura-gold">${formatAmount(data.staking)}</div>
                <div className="text-xs text-aura-text-secondary">2%</div>
              </div>
            </div>

            {/* Operations (0.5%) */}
            <div className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-500 ${
              animationStep >= 4 ? 'bg-blue-500/10 border-blue-500/30' : 'bg-aura-surface border-aura-border'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  ⚙️
                </div>
                <div>
                  <div className="font-semibold text-aura-text">运营费用</div>
                  <div className="text-sm text-aura-text-secondary">平台维护</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-blue-400">${formatAmount(data.ops)}</div>
                <div className="text-xs text-aura-text-secondary">0.5%</div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="text-center text-sm text-aura-text-secondary">
            💡 AURA After Dark 保持业界最低费用率，95% 收益归创作者所有
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full mt-6 py-3 bg-gradient-to-r from-aura-accent to-aura-accent-hover text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            明白了
          </button>
        </div>
      </div>
    </div>
  );
};