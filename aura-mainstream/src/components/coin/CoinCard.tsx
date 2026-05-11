import { ArrowDownRight, ArrowUpRight, Sparkles, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Creator-Coin marketplace card — unified style.
 *
 * Aligned with NFT / Content Keys / Bounty / Fractions tabs:
 *   • aspect-square cover area on top (no artwork — gradient + big coin logo
 *     since coins don't have a hero image)
 *   • body with title / by creator / price + meta / progress bar / dual
 *     button footer (Preview + Trade)
 *   • grid: 1 / 2 / 3 / 4 columns at md / lg / xl breakpoints
 *
 * Coin logo is independent from the creator's profile avatar — creators can
 * design + upload their own coin artwork. When `coin.thumbnail` (logoUrl) is
 * empty, we render a gradient "ticker letter" badge fallback so the cover
 * never looks broken.
 */

export interface CoinCardData {
  id: string;
  title: string;
  ticker?: string;
  creator: string;
  creatorAvatar?: string;
  thumbnail?: string;        // coin logo (independent from creator avatar)
  tagline?: string;
  price: number;
  change24h?: number;
  holders?: number;
  circulating?: number;
  volume24h?: number;
  mintedAt?: number;
  color?: string;
}

interface CoinCardProps {
  coin: CoinCardData;
  variant: 'hot' | 'new';
  onPreview: () => void;
  onPrimary: () => void;
  // Translation + formatter dependencies (keeps the component pure / portable).
  t: any;
  formatPrice: (n: number) => string;
  formatChange: (n: number) => string;
  formatTimeAgo?: (ts?: number) => string;
}

const TOTAL_SUPPLY = 10000;

export default function CoinCard({
  coin, variant, onPreview, onPrimary, t, formatPrice, formatChange, formatTimeAgo,
}: CoinCardProps) {
  const change = coin.change24h ?? 0;
  const isUp = change >= 0;
  const ChangeIcon = isUp ? ArrowUpRight : ArrowDownRight;

  const circulating = coin.circulating ?? 0;
  const supplyPct = Math.min(100, (circulating / TOTAL_SUPPLY) * 100);

  const coverGradient = variant === 'new'
    ? 'from-cyan-500/20 via-blue-500/15 to-indigo-500/20'
    : 'from-amber-500/20 via-orange-500/15 to-pink-500/20';

  return (
    <div
      onClick={onPrimary}
      className="bg-card rounded-xl border overflow-hidden hover:shadow-md hover:border-aura/40 transition-all flex flex-col cursor-pointer group"
    >
      {/* Cover — aspect-square, gradient + centered coin logo. */}
      <div className={`relative aspect-square bg-gradient-to-br ${coverGradient} overflow-hidden flex flex-col items-center justify-center p-4`}>
        <CoinLogo
          logoUrl={coin.thumbnail}
          ticker={coin.ticker}
          variant={variant}
          size={96}
        />
        <div className="mt-3 text-base font-bold text-foreground">
          {coin.ticker || coin.title}
        </div>
        {coin.tagline && (
          <div className="text-[10px] text-muted-foreground line-clamp-1 max-w-[90%] text-center mt-0.5">
            {coin.tagline}
          </div>
        )}

        {/* Status badge — top-left */}
        <div className="absolute top-2 left-2">
          {variant === 'new' ? (
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-[10px] font-bold shadow-sm">
              <Sparkles className="w-3 h-3" /> New Mint
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold shadow-sm">
              <Flame className="w-3 h-3" /> Hot
            </div>
          )}
        </div>

        {/* Type tag — top-right (matches NFT/Bounty/Fractional tag slot) */}
        <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-black/60 backdrop-blur text-white text-[10px] font-semibold">
          Coin
        </div>

        {/* 24h change badge — bottom-right (only for Hot tab) */}
        {variant === 'hot' && (
          <div
            className={`absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm ${
              isUp
                ? 'bg-emerald-500 text-white'
                : 'bg-red-500 text-white'
            }`}
          >
            <ChangeIcon className="w-3 h-3" />
            {formatChange(change)}
          </div>
        )}
        {variant === 'new' && coin.mintedAt && formatTimeAgo && (
          <div className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500 text-white text-[10px] font-bold shadow-sm">
            {formatTimeAgo(coin.mintedAt)}
          </div>
        )}
      </div>

      {/* Body — mirrors NFT / Content Key / Bounty / Fraction body density. */}
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-semibold text-sm line-clamp-2 mb-1 min-h-[2.5rem]">{coin.title}</h3>
        <p className="text-[11px] text-muted-foreground mb-3">by @{coin.creator}</p>

        {/* Price + meta row */}
        <div className="flex items-center justify-between mb-3 mt-auto">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              {t.marketplace.coins.price}
            </div>
            <div className={`text-lg font-bold ${variant === 'new' ? 'text-cyan-600 dark:text-cyan-400' : 'text-amber-600 dark:text-amber-400'}`}>
              ${formatPrice(coin.price)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground">{t.marketplace.coins.holders}</div>
            <div className="text-[11px] font-medium">
              {(coin.holders ?? 0).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Circulating progress bar — same shape as Fractional's */}
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>{supplyPct.toFixed(1)}% in circulation</span>
            <span>Vol {(coin.volume24h ?? 0).toLocaleString()}</span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r transition-all ${
                variant === 'new' ? 'from-cyan-400 to-blue-500' : 'from-amber-400 to-orange-500'
              }`}
              style={{ width: `${supplyPct}%` }}
            />
          </div>
        </div>

        {/* Footer actions — Preview + Trade pair (same slot pattern as NFT/Bounty) */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={(e) => { e.stopPropagation(); onPreview(); }}
          >
            Preview
          </Button>
          <Button
            size="sm"
            className={`flex-1 text-white ${
              variant === 'new'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
            }`}
            onClick={(e) => { e.stopPropagation(); onPrimary(); }}
          >
            Trade
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Coin logo with two rendering modes:
 *   1. Custom uploaded logoUrl (creator-designed)
 *   2. Gradient + initial-letter fallback so creators get a placeholder
 *      until they upload their own design.
 *
 * Square-rounded (rounded-2xl) instead of circle to differentiate from
 * profile avatars at a glance.
 */
function CoinLogo({
  logoUrl, ticker, variant, size = 72,
}: { logoUrl?: string; ticker?: string; variant: 'hot' | 'new'; size?: number }) {
  const initial = (ticker?.replace(/^\$/, '').charAt(0) || '?').toUpperCase();
  const dim = { width: size, height: size };
  if (logoUrl) {
    return (
      <div className="relative" style={dim}>
        <img
          src={logoUrl}
          alt={ticker ?? 'Coin'}
          className="w-full h-full rounded-2xl object-cover ring-1 ring-border/60 shadow-sm"
        />
        <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-sm font-bold text-white border-2 border-card shadow-sm">
          $
        </div>
      </div>
    );
  }
  // Fallback: gradient + initial. Color rotates on variant.
  const gradient = variant === 'new'
    ? 'from-cyan-400 via-blue-500 to-indigo-600'
    : 'from-amber-400 via-orange-500 to-pink-500';
  return (
    <div className="relative" style={dim}>
      <div
        className={`w-full h-full rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-black tracking-tight ring-1 ring-border/60 shadow-sm select-none`}
        style={{ fontSize: size * 0.45 }}
        title="Default coin badge — creator can upload a custom logo"
      >
        {initial}
      </div>
      <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-sm font-bold text-white border-2 border-card shadow-sm">
        $
      </div>
    </div>
  );
}
