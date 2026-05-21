// Portfolio coin card (own + held variants).
// Extracted from WalletPage.tsx 2026-05-20 P-1 split.
import { MiniStat } from './MiniStat';

export interface PortfolioCoinCardProps {
  isOwn?: boolean;
  symbol: string;
  name: string;
  logoUrl?: string;
  amount: number;
  price: number;
  ownStats?: { holders: number; vestingMonth: number; locked: number };
  tiers?: Array<{
    tier: string;
    threshold: number;
    perk: string;
    color: string;
    reached: boolean;
    isCurrent: boolean;
    redeemed: boolean;
  }>;
  onRedeem?: (tierName: string) => void;
  onPrimary: () => void;
  primaryLabel: string;
}

export function PortfolioCoinCard({
  isOwn = false, symbol, name, logoUrl, amount, price,
  ownStats, tiers, onRedeem, onPrimary, primaryLabel,
}: PortfolioCoinCardProps) {
  const value = amount * price;
  const claimable = tiers ? tiers.filter(t => t.reached && !t.redeemed) : [];
  const redeemedTiers = tiers ? tiers.filter(t => t.redeemed) : [];
  const reachedCount = tiers ? tiers.filter(t => t.reached).length : 0;

  const coverGradient = isOwn
    ? 'from-[#7C3AED]/25 via-[#A855F7]/15 to-[#F59E0B]/20'
    : 'from-cyan-500/20 via-teal-500/15 to-emerald-500/20';

  return (
    <div
      className={`bg-card rounded-xl border overflow-hidden hover:shadow-md transition-all flex flex-col ${
        isOwn ? 'border-[#7C3AED]/40 hover:border-[#7C3AED]/60' : 'border-border hover:border-aura/40'
      }`}
    >
      {/* Cover — aspect-square, gradient + centered coin logo + ticker label */}
      <div className={`relative aspect-square bg-gradient-to-br ${coverGradient} overflow-hidden flex flex-col items-center justify-center p-4`}>
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={symbol}
            className="w-24 h-24 rounded-3xl object-cover shadow-md ring-2 ring-white/40"
          />
        ) : (
          <div className={`w-24 h-24 rounded-3xl flex items-center justify-center text-white text-3xl font-black shadow-md ${
            isOwn
              ? 'bg-gradient-to-br from-[#7C3AED] to-[#F59E0B]'
              : 'bg-gradient-to-br from-cyan-500 to-emerald-500'
          }`}>
            {symbol.replace('$', '').slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="mt-3 text-base font-bold text-foreground">{symbol}</div>
        <div className="text-[10px] text-muted-foreground line-clamp-1 max-w-[90%] text-center mt-0.5">
          {name}
        </div>

        {/* Top-left ribbon: own variant only */}
        {isOwn && (
          <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#F59E0B] text-white text-[10px] font-bold shadow-sm">
            ✨ Yours
          </div>
        )}

        {/* Top-right type tag */}
        <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-black/60 backdrop-blur text-white text-[10px] font-semibold">
          Coin
        </div>

        {/* Bottom-right: claimable badge for held coins */}
        {!isOwn && claimable.length > 0 && (
          <div className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow-sm">
            ✓ {claimable.length} claimable
          </div>
        )}
      </div>

      {/* Body — mirrors marketplace CoinCard density */}
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-semibold text-sm line-clamp-1 mb-1">{name}</h3>
        <p className="text-[11px] text-muted-foreground mb-3 font-mono">{symbol}</p>

        {/* Price + holding row */}
        <div className="flex items-center justify-between mb-3 mt-auto">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              You hold
            </div>
            <div className={`text-lg font-bold tabular-nums ${isOwn ? 'text-[#7C3AED]' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {amount.toLocaleString()}
            </div>
            <div className="text-[10px] text-muted-foreground">≈ {value.toLocaleString(undefined, { maximumFractionDigits: 0 })} ORA</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground">Price</div>
            <div className="text-[11px] font-medium tabular-nums">{price.toFixed(2)} ORA</div>
          </div>
        </div>

        {/* Own stats OR tier section */}
        {isOwn && ownStats ? (
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            <MiniStat label="Holders" value={ownStats.holders.toLocaleString()} />
            <MiniStat label="Vesting" value={`${ownStats.vestingMonth}/10`} />
            <MiniStat label="Locked" value={ownStats.locked.toLocaleString()} />
          </div>
        ) : tiers && tiers.length > 0 ? (
          <div className="space-y-1.5 mb-3">
            {/* Tier progress badges */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {tiers.map(t => (
                  <div
                    key={t.tier}
                    title={`${t.tier} (${t.threshold}+) · ${t.perk}${t.redeemed ? ' · ✓ Redeemed' : t.reached ? ' · Available' : ' · Locked'}`}
                    className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black ${
                      t.redeemed
                        ? 'bg-emerald-500 text-white'
                        : t.reached
                        ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm'
                        : 'bg-muted text-muted-foreground/50'
                    }`}
                  >
                    {t.tier[0]}
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-muted-foreground tabular-nums">
                {reachedCount}/{tiers.length} reached
              </div>
            </div>

            {/* Claimable rows */}
            {claimable.length > 0 && onRedeem && (
              <div className="space-y-1 pt-0.5">
                {claimable.map(t => (
                  <button
                    key={t.tier}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRedeem(t.tier); }}
                    className="w-full flex items-center justify-between gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors text-[11px]"
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className={`font-bold ${t.color} shrink-0`}>{t.tier}</span>
                      <span className="text-muted-foreground truncate">{t.perk}</span>
                    </span>
                    <span className="shrink-0 text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Redeem
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Already-redeemed footnote */}
            {redeemedTiers.length > 0 && (
              <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
                ✓ {redeemedTiers.map(t => t.tier).join(', ')} redeemed
              </div>
            )}
          </div>
        ) : null}

        {/* Footer button */}
        <button
          type="button"
          onClick={onPrimary}
          className={`w-full px-3 py-2 rounded-lg text-[12px] font-bold transition-all ${
            isOwn
              ? 'bg-gradient-to-r from-[#7C3AED] to-[#F59E0B] text-white hover:opacity-95'
              : 'bg-aura hover:bg-aura-dark text-white'
          }`}
        >
          {primaryLabel} →
        </button>
      </div>
    </div>
  );
}

export default PortfolioCoinCard;
