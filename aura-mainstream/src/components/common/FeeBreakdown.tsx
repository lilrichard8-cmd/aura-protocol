import { useEffect, useState } from 'react';

interface FeeBreakdownProps {
  totalAmount: number;
  feeAmount?: number; // defaults to totalAmount * 0.05
  /** For Boost: different split (90% burn, 5% staking, 5% ops) */
  variant?: 'default' | 'boost';
  /** Show compact version without individual amounts */
  compact?: boolean;
}

const DEFAULT_ITEMS = [
  { key: 'burn',    icon: '🔥', label: 'Burn',        pct: 2.0,  sharePct: 40, color: '#EF4444', bg: 'bg-[#EF4444]' },
  { key: 'staking', icon: '📈', label: 'Staking',     pct: 2.0,  sharePct: 40, color: '#14C8A8', bg: 'bg-[#14C8A8]' },
  { key: 'gas',     icon: '⛽', label: 'Gas Reserve', pct: 0.5,  sharePct: 10, color: '#38BDF8', bg: 'bg-[#38BDF8]' },
  { key: 'ops',     icon: '🏢', label: 'Operations',  pct: 0.5,  sharePct: 10, color: '#94A3B8', bg: 'bg-[#94A3B8]' },
];

const BOOST_ITEMS = [
  { key: 'burn',    icon: '🔥', label: 'Burn',     pct: 90, sharePct: 90, color: '#EF4444', bg: 'bg-[#EF4444]' },
  { key: 'staking', icon: '📈', label: 'Staking',  pct: 5,  sharePct: 5,  color: '#14C8A8', bg: 'bg-[#14C8A8]' },
  { key: 'ops',     icon: '🏢', label: 'Ops',      pct: 5,  sharePct: 5,  color: '#94A3B8', bg: 'bg-[#94A3B8]' },
];

export default function FeeBreakdown({ totalAmount, feeAmount, variant = 'default', compact = false }: FeeBreakdownProps) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 50);
    return () => clearTimeout(t);
  }, []);

  const items = variant === 'boost' ? BOOST_ITEMS : DEFAULT_ITEMS;
  const fee = feeAmount ?? totalAmount * 0.05;

  return (
    <div className="space-y-3">
      {/* Segmented bar */}
      <div className="flex h-6 rounded-lg overflow-hidden gap-px bg-black/20">
        {items.map(item => (
          <div
            key={item.key}
            className={`${item.bg} transition-all duration-500 ease-out`}
            style={{ width: animated ? `${item.sharePct}%` : '0%' }}
          />
        ))}
      </div>

      {/* Legend rows */}
      <div className="space-y-1.5">
        {items.map(item => {
          const amount = variant === 'boost'
            ? totalAmount * (item.pct / 100)
            : fee * (item.sharePct / 100);
          return (
            <div key={item.key} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-muted-foreground">
                  {item.icon} {item.label}
                </span>
                <span className="text-xs text-muted-foreground/60">({item.pct}%)</span>
              </div>
              {!compact && (
                <span className="font-mono text-xs font-medium" style={{ color: item.color }}>
                  {amount.toFixed(4)} ORA
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
