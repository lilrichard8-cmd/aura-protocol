// Protocol fee structure card.
// Extracted from WalletPage.tsx 2026-05-20 P-1 split.
import { Sparkles } from 'lucide-react';
import FeeBreakdown from '@/components/common/FeeBreakdown';

export function FeeStructureCard() {
  return (
    <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-xl p-6 border border-orange-200/50 dark:border-orange-800/50 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-orange-500" />
        <h3 className="text-lg font-bold">5% Protocol Fee</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Every ORA transfer pays a flat 5% protocol fee, split four ways. Only swapping ORA for another asset (SOL, etc.) is fee-free at the AMM layer.
      </p>


      <FeeBreakdown totalAmount={100} feeAmount={5} />

      <div className="mt-3 pt-3 border-t border-border/50 space-y-1.5 text-[10px] text-muted-foreground flex-1">
        <p className="text-foreground font-medium">
          5% fee applies to <span className="font-semibold">all</span> ORA transfers — tips, purchases, marketplace, peer-to-peer sends, gifts.
        </p>
        <p>The only fee-free path is converting ORA into another currency on a DEX (no on-chain ORA transfer happens — the AMM swaps liquidity).</p>
        <p className="font-medium text-foreground">95% of every fee-bearing transfer goes to creators or token holders.</p>
      </div>
    </div>
  );
}

export default FeeStructureCard;
