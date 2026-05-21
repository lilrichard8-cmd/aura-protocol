// Creator Coin holdings summary card.
// Extracted from WalletPage.tsx 2026-05-20 P-1 split.
import { Users, Sparkles, ArrowRight } from 'lucide-react';
import type { CreatorCoinHolding } from '@/context/MockChainContext';

export function CreatorCoinHoldingsCard(props: {
  creatorCoins: CreatorCoinHolding[];
  myCoinSymbol: string | null;
  myCoinBalance: number;
  hasCreatorCoin: boolean;
  onSeeAll: () => void;
}) {
  // Show user's minted coin (if any) at the top, then external holdings.
  const externalHoldings = props.creatorCoins.filter(c =>
    c.symbol !== props.myCoinSymbol && c.amount > 0,
  );
  const topHoldings = externalHoldings
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  const totalCoins = props.creatorCoins.filter(c => c.amount > 0).length + (props.hasCreatorCoin ? 1 : 0);

  return (
    <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-xl p-6 border border-emerald-200/50 dark:border-emerald-800/50 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-500" />
          <h3 className="text-lg font-bold">Creator Coins</h3>
        </div>
        <button onClick={props.onSeeAll} className="text-[11px] text-emerald-500 hover:underline inline-flex items-center gap-0.5">
          See all <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg bg-background/50 p-3">
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-bold mb-0.5">Holdings</p>
          <div className="text-lg font-bold tabular-nums">{totalCoins}</div>
          <div className="text-[10px] text-muted-foreground">unique coins</div>
        </div>
        <div className="rounded-lg bg-background/50 p-3">
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-bold mb-0.5">Your coin</p>
          <div className="text-lg font-bold tabular-nums">{props.hasCreatorCoin ? props.myCoinSymbol : '—'}</div>
          <div className="text-[10px] text-muted-foreground">
            {props.hasCreatorCoin ? `${props.myCoinBalance.toFixed(0)} in wallet` : 'not minted'}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {totalCoins === 0 ? (
          <div className="rounded-lg bg-background/30 border border-dashed border-border/50 p-3 text-center">
            <p className="text-[11px] text-muted-foreground">No Creator Coins held.</p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">Mint your own or buy from the marketplace.</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {props.hasCreatorCoin && props.myCoinSymbol && (
              <div className="flex items-center gap-2 rounded-md bg-gradient-to-r from-purple-500/15 to-amber-500/15 px-2 py-1.5 border border-amber-300/30">
                <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                <span className="text-[11px] font-bold flex-1 truncate">{props.myCoinSymbol}</span>
                <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">Yours</span>
                <span className="text-[10px] font-mono">{props.myCoinBalance.toFixed(0)}</span>
              </div>
            )}
            {topHoldings.map(c => (
              <div key={c.symbol} className="flex items-center gap-2 rounded-md bg-background/40 px-2 py-1.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500/30 shrink-0" />
                <span className="text-[11px] font-medium flex-1 truncate">{c.symbol}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{c.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CreatorCoinHoldingsCard;
