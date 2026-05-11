/**
 * BuyOraDialog — modal version of the Buy ORA ceremony.
 *
 * Same 4-step flow as BuyOraPage (Source → Amount → Confirm → Complete) but
 * rendered inside a centered overlay so the user never leaves their current
 * context. Triggered globally via `useBuyOra().open(suggestedAmount?)`.
 *
 * Design rationale (2026-05-11): Zhuoyu wanted top-up to feel lightweight, like
 * the MintCeremony modal — appears over the page, fills in, dismisses. Going
 * full-page caused users to lose the action they were trying to do (e.g. boost
 * a post → out of ORA → bounce to /buy-ora → forget about the original boost).
 *
 * The dialog is portal-mounted at z-[100] (above SideNav z-50, toasts z-60)
 * and traps focus + closes on Escape. Click on the dimmed backdrop dismisses
 * the dialog unless we're mid-processing (so users can't accidentally abort
 * a settling transaction).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Building2, Check, Coins, Copy, ExternalLink,
  Loader2, Shield, Sparkles, TrendingUp, Zap, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMockChain } from '@/context/MockChainContext';
import { useToast } from '@/context/ToastContext';

type Step = 'source' | 'amount' | 'confirm' | 'processing' | 'complete';
type Source = 'protocol' | 'market';

const TGE_PRICE_USD = 0.02;
const SOL_USD = 150;
const PRESETS = [100, 500, 2000, 10000];

function quoteMarket(oraAmount: number): { effectivePrice: number; slippagePct: number; mid: number } {
  const hour = Math.floor(Date.now() / 3_600_000);
  const jitter = ((hour * 9301 + 49297) % 233280) / 233280;
  const mid = TGE_PRICE_USD * (0.98 + jitter * 0.04);
  const notional = oraAmount * mid;
  const depthUsd = 50_000;
  const slippagePct = Math.min(8, (notional / depthUsd) * 4);
  const effectivePrice = mid * (1 + slippagePct / 100);
  return { effectivePrice, slippagePct, mid };
}

export interface BuyOraDialogProps {
  open: boolean;
  onClose: () => void;
  /** Pre-fill amount field. Useful when triggered from "Need X more ORA" flow. */
  suggestedAmount?: number;
}

export default function BuyOraDialog({ open, onClose, suggestedAmount }: BuyOraDialogProps) {
  const { showToast } = useToast();
  const mockChain = useMockChain();
  const [step, setStep] = useState<Step>('source');
  const [source, setSource] = useState<Source>('protocol');
  const [amount, setAmount] = useState<number>(suggestedAmount ?? 500);
  const [txHash, setTxHash] = useState<string>('');
  const [solSpent, setSolSpent] = useState<number>(0);
  const [filledPrice, setFilledPrice] = useState<number>(TGE_PRICE_USD);
  const [copied, setCopied] = useState(false);

  // Reset state every time dialog reopens. We don't reset on close so that a
  // post-purchase "complete" state survives any accidental remounts.
  useEffect(() => {
    if (open) {
      setStep('source');
      setSource('protocol');
      setAmount(suggestedAmount ?? 500);
      setTxHash('');
      setSolSpent(0);
      setCopied(false);
    }
  }, [open, suggestedAmount]);

  // Escape closes (unless processing). We block close-during-processing to
  // avoid the user thinking they aborted while the tx is settling.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 'processing') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, step, onClose]);

  const quote = useMemo(() => {
    if (source === 'protocol') {
      return { effectivePrice: TGE_PRICE_USD, slippagePct: 0, mid: TGE_PRICE_USD };
    }
    return quoteMarket(amount || 0);
  }, [source, amount]);

  const usdCost = amount * quote.effectivePrice;
  const solCost = usdCost / SOL_USD;
  const insufficient = mockChain.solBalance < solCost;

  if (!open) return null;

  const handleConfirm = async () => {
    setStep('processing');
    try {
      const result = await mockChain.buyOra(amount, source, {
        effectivePrice: quote.effectivePrice,
        slippagePct: quote.slippagePct,
      });
      setTxHash(result.txHash);
      setSolSpent(result.solSpent);
      setFilledPrice(result.effectivePrice);
      setStep('complete');
      showToast('success', `+${amount.toFixed(2)} ORA credited`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Buy failed');
      setStep('confirm');
    }
  };

  const handleCopyTx = () => {
    navigator.clipboard.writeText(txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // ───── Step renderers (compact dialog versions, less vertical chrome than the page) ─────

  const renderSource = () => (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground mb-3">
        Both routes settle on Solana. Protocol is fixed-price &amp; instant; market is open-book.
      </p>

      <button
        type="button"
        onClick={() => setSource('protocol')}
        className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
          source === 'protocol'
            ? 'border-purple-500 bg-gradient-to-br from-purple-500/10 to-pink-500/10'
            : 'border-border/40 hover:border-purple-500/40'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <h3 className="font-bold text-sm">Buy from AURA Protocol</h3>
              <span className="text-[9px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-500 px-1.5 py-0.5 rounded">
                Recommended
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-1.5">
              Treasury at fixed TGE price. No slippage, no fees.
            </p>
            <div className="flex flex-wrap gap-2 text-[10px] text-purple-500">
              <span className="inline-flex items-center gap-1"><Shield className="w-2.5 h-2.5" /> Treasury</span>
              <span className="inline-flex items-center gap-1"><Zap className="w-2.5 h-2.5" /> Instant</span>
              <span className="inline-flex items-center gap-1"><Coins className="w-2.5 h-2.5" /> ${TGE_PRICE_USD.toFixed(4)}/ORA</span>
            </div>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => setSource('market')}
        className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
          source === 'market'
            ? 'border-teal-500 bg-gradient-to-br from-teal-500/10 to-cyan-500/10'
            : 'border-border/40 hover:border-teal-500/40'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm mb-0.5">Secondary market</h3>
            <p className="text-xs text-muted-foreground mb-1.5">
              ORA/SOL AMM. Price floats; large orders may slip.
            </p>
            <div className="flex flex-wrap gap-2 text-[10px] text-teal-500">
              <span className="inline-flex items-center gap-1"><TrendingUp className="w-2.5 h-2.5" /> Mid ${quote.mid.toFixed(4)}</span>
              <span className="inline-flex items-center gap-1"><Sparkles className="w-2.5 h-2.5" /> Order-book</span>
            </div>
          </div>
        </div>
      </button>

      <Button
        onClick={() => setStep('amount')}
        className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600"
      >
        Continue
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );

  const renderAmount = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Selected source</span>
        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
          source === 'protocol' ? 'bg-purple-500/15 text-purple-500' : 'bg-teal-500/15 text-teal-500'
        }`}>
          {source === 'protocol' ? 'Protocol · fixed' : 'Market · spot'}
        </span>
      </div>

      <div className="rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-200/50 dark:border-purple-800/50 p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">You receive</p>
        <div className="flex items-baseline gap-2">
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
            className="flex-1 bg-transparent text-4xl font-black tabular-nums focus:outline-none w-full"
          />
          <span className="text-lg font-bold text-muted-foreground">ORA</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          ≈ ${usdCost.toFixed(2)} USD · {solCost.toFixed(4)} SOL
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {PRESETS.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => setAmount(p)}
            className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              amount === p
                ? 'border-purple-500 bg-purple-500/10 text-purple-500'
                : 'border-border/40 hover:bg-secondary'
            }`}
          >
            {p.toLocaleString()}
          </button>
        ))}
      </div>

      <div className="rounded-lg bg-secondary/40 border border-border/40 p-3 space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{source === 'protocol' ? 'Price (TGE)' : 'Mid price'}</span>
          <span className="font-mono">${quote.mid.toFixed(4)}/ORA</span>
        </div>
        {source === 'market' && (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fill price</span>
              <span className="font-mono">${quote.effectivePrice.toFixed(4)}/ORA</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Slippage</span>
              <span className={`font-mono ${quote.slippagePct > 3 ? 'text-orange-500' : ''}`}>
                {quote.slippagePct.toFixed(2)}%
              </span>
            </div>
          </>
        )}
        <div className="border-t border-border/40 pt-1.5 flex justify-between font-medium">
          <span>Total cost</span>
          <span className="font-mono">{solCost.toFixed(4)} SOL</span>
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Your SOL</span>
          <span className={`font-mono ${insufficient ? 'text-red-500' : ''}`}>
            {mockChain.solBalance.toFixed(4)} {insufficient && '(low)'}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep('source')} className="flex-1">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <Button
          onClick={() => setStep('confirm')}
          disabled={amount <= 0 || insufficient}
          className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50"
        >
          Review
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );

  const renderConfirm = () => (
    <div className="space-y-3">
      <div className="rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-200/50 dark:border-purple-800/50 p-4 space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-muted-foreground">You pay</span>
          <span className="text-xl font-black tabular-nums">{solCost.toFixed(4)} <span className="text-xs text-muted-foreground">SOL</span></span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-muted-foreground">You receive</span>
          <span className="text-xl font-black tabular-nums text-purple-500">{amount.toFixed(2)} <span className="text-xs text-muted-foreground">ORA</span></span>
        </div>
      </div>

      <div className="rounded-lg bg-secondary/40 border border-border/40 p-3 space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Source</span>
          <span className="font-medium">{source === 'protocol' ? 'AURA Treasury' : 'Market'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Fill price</span>
          <span className="font-mono">${quote.effectivePrice.toFixed(4)}/ORA</span>
        </div>
        {source === 'market' && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Slippage</span>
            <span className="font-mono">{quote.slippagePct.toFixed(2)}%</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Gas</span>
          <span className="font-mono text-green-500">Sponsored</span>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground italic">
        {source === 'protocol'
          ? 'Treasury honours TGE price. No fee. No slippage.'
          : 'Open ORA/SOL pool. Price may move between quote and fill.'}
      </p>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep('amount')} className="flex-1">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <Button
          onClick={handleConfirm}
          className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600"
        >
          Confirm
          <Check className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );

  const renderProcessing = () => (
    <div className="flex flex-col items-center justify-center py-10 space-y-3">
      <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
      <p className="text-sm font-bold">Signing transaction…</p>
      <p className="text-xs text-muted-foreground text-center max-w-xs">
        {source === 'protocol' ? 'Settling with AURA treasury…' : 'Routing through ORA/SOL pool…'}
      </p>
    </div>
  );

  const renderComplete = () => (
    <div className="space-y-3">
      <div className="flex flex-col items-center text-center pt-2 pb-1">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg mb-2">
          <Check className="w-7 h-7 text-white" strokeWidth={3} />
        </div>
        <h3 className="text-lg font-bold">Purchase complete 🎉</h3>
        <p className="text-xs text-muted-foreground">
          {amount.toFixed(2)} ORA is now in your wallet.
        </p>
      </div>

      <div className="rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-200/50 dark:border-green-800/50 p-3 space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">ORA received</span>
          <span className="font-mono font-bold text-green-500">+{amount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">SOL spent</span>
          <span className="font-mono">-{solSpent.toFixed(4)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Filled @</span>
          <span className="font-mono">${filledPrice.toFixed(4)}/ORA</span>
        </div>
        <div className="border-t border-border/40 pt-1.5">
          <p className="text-[10px] text-muted-foreground mb-0.5">Tx hash</p>
          <div className="flex items-center gap-1">
            <code className="flex-1 font-mono text-[10px] bg-background/60 rounded px-1.5 py-1 truncate">{txHash}</code>
            <button type="button" onClick={handleCopyTx} className="p-1 rounded hover:bg-secondary" title="Copy">
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            </button>
            <a
              href={`https://explorer.solana.com/tx/${txHash}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded hover:bg-secondary"
              title="Open in explorer"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setStep('source');
            setAmount(500);
            setTxHash('');
          }}
          className="flex-1"
        >
          Buy more
        </Button>
        <Button
          onClick={onClose}
          className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600"
        >
          Done
        </Button>
      </div>
    </div>
  );

  const STEP_ORDER: Step[] = ['source', 'amount', 'confirm', 'complete'];
  const visibleStep: Step = step === 'processing' ? 'confirm' : step;
  const stepIndex = STEP_ORDER.indexOf(visibleStep);

  const stepTitle =
    step === 'source' ? 'Buy ORA — choose source'
    : step === 'amount' ? 'Buy ORA — how much?'
    : step === 'confirm' ? 'Review &amp; confirm'
    : step === 'processing' ? 'Processing…'
    : 'Done';

  return (
    // Full-viewport overlay. z-[100] sits above SideNav (z-50) and toast layer (z-60).
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="buy-ora-title"
    >
      {/* Backdrop — clicking dismisses, but only when not mid-flight. */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          if (step !== 'processing') onClose();
        }}
      />

      {/* Card */}
      <div className="relative w-full max-w-md bg-card border border-border/40 rounded-2xl shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-purple-500" />
            <h2 id="buy-ora-title" className="text-sm font-bold">{stepTitle}</h2>
          </div>
          <button
            type="button"
            onClick={() => { if (step !== 'processing') onClose(); }}
            disabled={step === 'processing'}
            className="p-1 rounded hover:bg-secondary disabled:opacity-30 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step pills */}
        <div className="px-5 pt-3">
          <div className="flex items-center gap-1.5 mb-3">
            {STEP_ORDER.map((s, i) => (
              <div key={s} className="flex items-center gap-1.5 flex-1">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                  i < stepIndex
                    ? 'bg-green-500 text-white'
                    : i === stepIndex
                      ? 'bg-purple-500 text-white'
                      : 'bg-secondary text-muted-foreground'
                }`}>
                  {i < stepIndex ? <Check className="w-2.5 h-2.5" /> : i + 1}
                </div>
                {i < STEP_ORDER.length - 1 && (
                  <div className={`flex-1 h-px ${i < stepIndex ? 'bg-green-500' : 'bg-border/40'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-5 pb-4">
          {step === 'source' && renderSource()}
          {step === 'amount' && renderAmount()}
          {step === 'confirm' && renderConfirm()}
          {step === 'processing' && renderProcessing()}
          {step === 'complete' && renderComplete()}
        </div>

        {/* Footer balance row */}
        <div className="px-5 py-2.5 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground bg-secondary/20">
          <span>Current balance</span>
          <span className="font-mono">
            <span className="text-foreground font-bold">{mockChain.oraBalance.toFixed(2)}</span> ORA · {mockChain.solBalance.toFixed(4)} SOL
          </span>
        </div>
      </div>
    </div>
  );
}
