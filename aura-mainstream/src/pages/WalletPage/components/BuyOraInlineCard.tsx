// Buy ORA inline card (Protocol / Market source toggle).
// Extracted from WalletPage.tsx 2026-05-20 P-1 split.
import { useState } from 'react';
import { Coins, Building2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMockChain } from '@/context/MockChainContext';
import { useToast } from '@/context/ToastContext';
import { useBuyOra } from '@/context/BuyOraContext';

export function BuyOraInlineCard() {
  const mockChain = useMockChain();
  const { showToast } = useToast();
  const buyOra = useBuyOra(); // fallback to full modal for "advanced" path
  const [source, setSource] = useState<'protocol' | 'market'>('protocol');
  const [amount, setAmount] = useState<number>(500);
  const [busy, setBusy] = useState(false);
  const TGE = 0.02;
  const SOL_USD = 150;
  const PRESETS = [100, 500, 2000];

  // Hour-keyed deterministic mid for market simulation.
  const hour = Math.floor(Date.now() / 3_600_000);
  const jitter = ((hour * 9301 + 49297) % 233280) / 233280;
  const marketMid = TGE * (0.98 + jitter * 0.04);

  const marketSlip = Math.min(8, ((amount * marketMid) / 50_000) * 4);
  const effPrice = source === 'protocol' ? TGE : marketMid * (1 + marketSlip / 100);
  const solCost = (amount * effPrice) / SOL_USD;
  const insufficient = mockChain.solBalance < solCost;

  const handleBuy = async () => {
    if (amount <= 0 || insufficient) return;
    setBusy(true);
    try {
      await mockChain.buyOra(amount, source, {
        effectivePrice: effPrice,
        slippagePct: source === 'market' ? marketSlip : 0,
      });
      showToast('success', `+${amount.toFixed(2)} ORA credited`, `via ${source === 'protocol' ? 'AURA Treasury' : 'Secondary market'}`);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Buy failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-pink-500/10 to-purple-500/10 rounded-xl p-6 border border-pink-200/50 dark:border-pink-800/50 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-pink-500" />
          <h3 className="text-lg font-bold">Buy ORA</h3>
        </div>
        <button
          onClick={() => buyOra.open(amount)}
          className="text-[10px] text-pink-500 hover:underline"
          title="Open full Buy ORA flow with more options"
        >
          Advanced ↗
        </button>
      </div>

      {/* Source toggle */}
      <div className="grid grid-cols-2 gap-1 mb-3 p-1 rounded-lg bg-background/40">
        <button
          onClick={() => setSource('protocol')}
          className={`py-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
            source === 'protocol' ? 'bg-purple-500 text-white shadow' : 'text-muted-foreground hover:bg-secondary/50'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" /> Protocol
        </button>
        <button
          onClick={() => setSource('market')}
          className={`py-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
            source === 'market' ? 'bg-teal-500 text-white shadow' : 'text-muted-foreground hover:bg-secondary/50'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" /> Market
        </button>
      </div>

      {/* Amount */}
      <div className="rounded-lg bg-background/50 px-3 py-3 mb-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-0.5">You receive</p>
        <div className="flex items-baseline gap-1">
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
            className="flex-1 bg-transparent text-3xl font-black tabular-nums focus:outline-none w-full"
          />
          <span className="text-sm text-muted-foreground font-bold">ORA</span>
        </div>
      </div>

      {/* Presets */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {PRESETS.map(p => (
          <button
            key={p}
            onClick={() => setAmount(p)}
            className={`py-1.5 rounded text-xs font-medium border transition-colors ${
              amount === p ? 'border-pink-500 bg-pink-500/10 text-pink-500' : 'border-border/40 hover:bg-secondary'
            }`}
          >
            {p.toLocaleString()}
          </button>
        ))}
      </div>

      {/* Quote */}
      <div className="text-xs space-y-1 mb-4 px-1 flex-1">
        <div className="flex justify-between"><span className="text-muted-foreground">@</span><span className="font-mono">${effPrice.toFixed(4)}/ORA</span></div>
        {source === 'market' && marketSlip > 0 && (
          <div className="flex justify-between"><span className="text-muted-foreground">Slippage</span><span className={`font-mono ${marketSlip > 3 ? 'text-orange-500' : ''}`}>{marketSlip.toFixed(2)}%</span></div>
        )}
        <div className="flex justify-between font-medium"><span>Cost</span><span className={`font-mono ${insufficient ? 'text-red-500' : ''}`}>{solCost.toFixed(4)} SOL</span></div>
      </div>

      <Button
        onClick={handleBuy}
        disabled={amount <= 0 || insufficient || busy}
        className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:from-pink-600 hover:to-purple-600 disabled:opacity-50 mt-auto"
      >
        {busy ? 'Processing…' : insufficient ? `Need ${(solCost - mockChain.solBalance).toFixed(4)} more SOL` : `Buy ${amount.toFixed(0)} ORA`}
      </Button>
    </div>
  );
}

export default BuyOraInlineCard;
