import { useI18n } from '@/context/I18nContext';
import { Check } from 'lucide-react';

export interface StakingTier {
  lockDays: number;
  multiplier: number;
  label: string;
  note: string;
  recommended?: boolean;
}

export const STAKING_TIERS: StakingTier[] = [
  { lockDays: 1, multiplier: 1.0, label: '1 day (flexible)', note: 'Unlock anytime' },
  { lockDays: 30, multiplier: 1.0, label: '30 days', note: 'Long-term commitment starter' },
  { lockDays: 90, multiplier: 1.5, label: '90 days', note: 'Recommended', recommended: true },
  { lockDays: 180, multiplier: 2.0, label: '180 days', note: 'Maximum yield' },
];

export const BASE_APY = 8;
export const MIN_STAKE = 1000;

interface Props {
  selected: number;
  onSelect: (lockDays: number) => void;
  amount: number;
}

export default function StakingTierSelector({ selected, onSelect, amount }: Props) {
  const { t } = useI18n();
  const wallet = t.wallet as Record<string, unknown>;
  const tier = (wallet.tier as Record<string, string> | undefined) ?? {};
  const tLock = tier.lock ?? 'Lock';
  const tMult = tier.multiplier ?? 'Multiplier';
  const tVoting = tier.voting ?? 'Voting';
  const tEstYield = tier.estYield ?? 'Est. annual yield';
  const tMin = tier.min ?? `Minimum stake: ${MIN_STAKE.toLocaleString()} ORA`;
  const tVariable = tier.variable ?? 'Variable based on protocol revenue';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {STAKING_TIERS.map((tt) => {
          const active = selected === tt.lockDays;
          const yieldPct = (BASE_APY * tt.multiplier).toFixed(1);
          const estReward = amount > 0 ? ((amount * BASE_APY * tt.multiplier) / 100).toFixed(2) : null;
          return (
            <button
              key={tt.lockDays}
              type="button"
              onClick={() => onSelect(tt.lockDays)}
              className={`text-left p-3 rounded-xl border transition-all relative ${
                active
                  ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30'
                  : 'border-border bg-card hover:border-blue-300/50'
              }`}
            >
              {tt.recommended && (
                <span className="absolute -top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500 text-white">
                  ★
                </span>
              )}
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold">{tt.label}</span>
                {active && <Check className="w-4 h-4 text-blue-500" />}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-1">
                <span>
                  {tMult}: <span className="font-semibold text-foreground">{tt.multiplier}x</span>
                </span>
                <span className="flex items-center gap-1">
                  {tVoting}: <Check className="w-3 h-3 text-green-500" />
                </span>
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                ≈ {yieldPct}% {tEstYield}
                {estReward && ` (~${estReward} ORA)`}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{tt.note}</div>
            </button>
          );
        })}
      </div>
      <div className="text-xs text-muted-foreground space-y-0.5">
        <div>· {tMin}</div>
        <div>· {tVariable}</div>
        <div className="text-[11px]">
          {tLock}: 1d / 30d / 90d / 180d
        </div>
      </div>
    </div>
  );
}
