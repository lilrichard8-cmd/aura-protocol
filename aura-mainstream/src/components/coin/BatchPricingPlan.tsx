import { useEffect, useState } from 'react';
import { X, Check, Coins, History, Lock, Save, Edit3 } from 'lucide-react';
import { useMockChain } from '@/context/MockChainContext';
import { useToast } from '@/context/ToastContext';

interface BatchPricingPlanProps {
  open: boolean;
  symbol: string;
  currentPrice: number;
  onClose: () => void;
}

interface RowDraft {
  price: string;
}

export default function BatchPricingPlan({ open, symbol, currentPrice, onClose }: BatchPricingPlanProps) {
  const mockChain = useMockChain();
  const { showToast } = useToast();
  const month = mockChain.creatorCoinVestingMonth ?? 0;
  const coin = mockChain.creatorCoins.find(c => c.symbol === symbol);
  const realized = coin?.unlockedBatchPrices || [];
  const planned = coin?.batchPrices || [];
  const tgePrice = coin?.initialPrice ?? currentPrice;

  const buildDraft = (): { tge: string; batches: string[] } => ({
    tge: tgePrice > 0 ? tgePrice.toFixed(2) : '',
    batches: Array.from({ length: 10 }, (_, i) => {
      if (i < month) {
        const r = realized[i];
        return r !== undefined && r > 0 ? r.toFixed(2) : '';
      }
      const p = planned[i];
      return p !== undefined && p > 0 ? p.toFixed(2) : '';
    }),
  });

  const [draft, setDraft] = useState(buildDraft);

  useEffect(() => {
    if (open) setDraft(buildDraft());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, symbol, month]);

  if (!open) return null;

  const tickerDisplay = symbol.replace(/^\$/, '');

  const handleSave = () => {
    let updates = 0;

    // TGE
    const tgeNum = parseFloat(draft.tge);
    if (isFinite(tgeNum) && tgeNum > 0 && tgeNum !== tgePrice) {
      mockChain.setCreatorCoinTgePrice(symbol, tgeNum);
      updates++;
    }

    // Batches
    for (let i = 0; i < 10; i++) {
      const v = parseFloat(draft.batches[i]);
      if (!isFinite(v) || v <= 0) continue;
      if (i < month) {
        // Realized — update history
        if (realized[i] !== v) {
          mockChain.setCreatorCoinRealizedBatchPrice(symbol, i, v);
          updates++;
        }
      } else {
        // Planned — pre-set future price
        if (planned[i] !== v) {
          mockChain.setCreatorCoinBatchPrice(symbol, i, v);
          updates++;
        }
      }
    }

    if (updates === 0) {
      showToast('success', 'No changes to save.');
    } else {
      showToast('success', `🌸 Updated ${updates} price${updates === 1 ? '' : 's'}`);
    }
    onClose();
  };

  const updateRow = (idx: number, val: string) => {
    setDraft(prev => ({ ...prev, batches: prev.batches.map((p, i) => (i === idx ? val : p)) }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-xl mx-4 my-8 px-6 md:px-8 py-8 rounded-3xl bg-gradient-to-b from-zinc-900/95 to-zinc-950/98 border border-white/10 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 z-10 p-2 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#14C8A8]/10 border border-[#14C8A8]/30 text-[#14C8A8] text-xs font-medium">
            <History className="w-3 h-3" /> Released Batches
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white">${tickerDisplay} Vesting History</h2>
          <p className="text-sm text-white/60">Genesis + {month} of 10 vesting batches released on-chain. Tap any value to edit.</p>
        </div>

        <div className="flex items-center justify-end mb-2">
          <button
            onClick={() => {
              const refIdx = Math.min(month, 9);
              const refVal = draft.batches[refIdx] || draft.tge || String(currentPrice);
              setDraft(prev => ({
                ...prev,
                batches: prev.batches.map((p, i) => (i >= month ? refVal : p)),
              }));
              showToast('success', `Applied ${refVal} ORA to all upcoming batches`);
            }}
            className="text-xs text-[#14C8A8] hover:text-[#14C8A8]/80 transition-colors flex items-center gap-1"
          >
            <Coins className="w-3 h-3" />
            Apply current to all upcoming
          </button>
        </div>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {/* Genesis (TGE) row */}
          <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-400/30 bg-amber-500/[0.06]">
            <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
              <Coins className="w-4 h-4 text-amber-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-amber-300">Genesis</span>
                <span className="text-[10px] text-white/40">2,000 ${tickerDisplay}</span>
                <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">TGE</span>
              </div>
              <p className="text-[10px] text-white/40 mt-0.5">Total {(parseFloat(draft.tge) > 0 ? parseFloat(draft.tge) * 2000 : 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} ORA</p>
            </div>
            <div className="relative w-32 shrink-0">
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={draft.tge}
                onChange={(e) => setDraft(prev => ({ ...prev, tge: e.target.value }))}
                placeholder="0.00"
                className="w-full pl-3 pr-12 py-2 rounded-lg bg-white/5 border border-amber-400/30 text-white text-right font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/60 transition"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/40 font-bold">ORA</span>
            </div>
          </div>

          {/* 10 vesting batches */}
          {Array.from({ length: 10 }, (_, i) => {
            const batchNum = i + 1;
            const isReleased = i < month;
            const isNext = i === month;
            const value = draft.batches[i];
            return (
              <div
                key={i}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  isReleased
                    ? 'border-[#14C8A8]/20 bg-[#14C8A8]/[0.04]'
                    : isNext
                    ? 'border-amber-400/20 bg-amber-500/[0.03]'
                    : 'border-white/10 bg-white/[0.02]'
                }`}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0">
                  {isReleased ? (
                    <div className="w-9 h-9 rounded-full bg-[#14C8A8]/20 border border-[#14C8A8]/40 flex items-center justify-center">
                      <Check className="w-4 h-4 text-[#14C8A8]" />
                    </div>
                  ) : isNext ? (
                    <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center">
                      <Edit3 className="w-3.5 h-3.5 text-amber-300" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                      <Lock className="w-3.5 h-3.5 text-white/40" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${isReleased ? 'text-[#14C8A8]' : isNext ? 'text-amber-300' : 'text-white'}`}>
                      Batch {batchNum}
                    </span>
                    <span className="text-[10px] text-white/40">800 ${tickerDisplay}</span>
                    {isReleased && <span className="text-[10px] uppercase tracking-wider text-[#14C8A8]/80 font-bold">Released</span>}
                    {isNext && <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">Up next</span>}
                    {!isReleased && !isNext && <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Planned</span>}
                  </div>
                  <p className="text-[10px] text-white/40 mt-0.5">
                    Total {(parseFloat(value) > 0 ? parseFloat(value) * 800 : 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} ORA
                  </p>
                </div>

                <div className="relative w-32 shrink-0">
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={value}
                    onChange={(e) => updateRow(i, e.target.value)}
                    placeholder="0.00"
                    className={`w-full pl-3 pr-12 py-2 rounded-lg bg-white/5 border text-white text-right font-mono text-sm focus:outline-none focus:ring-2 transition ${
                      isReleased
                        ? 'border-[#14C8A8]/30 focus:ring-[#14C8A8]/40 focus:border-[#14C8A8]/60'
                        : 'border-white/10 focus:ring-[#14C8A8]/40 focus:border-[#14C8A8]/40'
                    }`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/40 font-bold">ORA</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-[#14C8A8] to-emerald-500 text-white font-bold hover:shadow-[0_0_30px_rgba(20,200,168,0.5)] transition-all flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
