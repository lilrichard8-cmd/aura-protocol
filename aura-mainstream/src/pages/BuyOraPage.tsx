/**
 * BuyOraPage — full-screen ceremony to acquire ORA.
 *
 * Two paths to ORA (mirrors how a real protocol token is acquired):
 *   1. PROTOCOL — fixed-price treasury sale at TGE price ($0.02 / ORA).
 *      No slippage, no fees, always available. Settles in SOL.
 *   2. MARKET   — simulated DEX (Raydium / Jupiter-style). Spot price floats
 *      around the protocol price; size + book depth produce realistic slippage.
 *      Lets evaluators see how a secondary market would behave without us
 *      having to actually wire to a real AMM during the hackathon demo.
 *
 * Visual language echoes MintCeremony:
 *   - Full-page immersive layout (purple/ora gradient on left rail)
 *   - Step pills at top (Source → Amount → Confirm → Complete)
 *   - Big tabular ORA number front-and-center
 *   - "Receipt" final screen with txHash + explorer link
 *
 * 2026-05-11 — added in response to the broken Add ORA CTA from Wallet > Overview
 * (was navigating to /marketplace which is Creator Coin land, not ORA land).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Building2, Check, Coins, Copy, ExternalLink,
  Loader2, Shield, Sparkles, TrendingUp, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMockChain } from '@/context/MockChainContext';
import { useToast } from '@/context/ToastContext';
import ClaimTestOraButton from '@/components/ClaimTestOraButton';

type Step = 'source' | 'amount' | 'confirm' | 'processing' | 'complete';
type Source = 'protocol' | 'market';

const TGE_PRICE_USD = 0.02; // $0.02 per ORA, locked at TGE
const SOL_USD = 150;        // demo-only spot reference for SOL

// Preset bundles — make the most common amounts one-click.
// Numbers chosen so evaluators can quickly try common platform actions:
//   100 ORA  → ~50 curation votes / ~10 tips
//   500 ORA  → enough to buy a few keys + curate
//   2000 ORA → enough for governance actions + Creator Coin buys
const PRESETS = [100, 500, 2000, 10000];

/** Lightweight market depth simulator. Real Raydium pools have curves; we use
 *  a simple linear-impact model: slippage% grows with size relative to a
 *  reference depth of $50k notional. Mid-price floats ±2% around TGE. */
function quoteMarket(oraAmount: number): { effectivePrice: number; slippagePct: number; mid: number } {
  // Deterministic mid based on hour so it doesn't jitter while typing.
  const hour = Math.floor(Date.now() / 3_600_000);
  const jitter = ((hour * 9301 + 49297) % 233280) / 233280; // 0..1
  const mid = TGE_PRICE_USD * (0.98 + jitter * 0.04); // ±2%
  const notional = oraAmount * mid;
  const depthUsd = 50_000;
  const slippagePct = Math.min(8, (notional / depthUsd) * 4); // cap 8%
  const effectivePrice = mid * (1 + slippagePct / 100);
  return { effectivePrice, slippagePct, mid };
}

export default function BuyOraPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const mockChain = useMockChain();
  const [step, setStep] = useState<Step>('source');
  const [source, setSource] = useState<Source>('protocol');
  // Honour an `?amount=` query param when present (set by useOraGuard so the
  // suggested top-up is pre-filled when arriving from an insufficient-balance toast).
  const initialAmount = (() => {
    const q = Number(searchParams.get('amount'));
    return Number.isFinite(q) && q > 0 ? q : 500;
  })();
  const [amount, setAmount] = useState<number>(initialAmount);
  const [txHash, setTxHash] = useState<string>('');
  const [solSpent, setSolSpent] = useState<number>(0);
  const [filledPrice, setFilledPrice] = useState<number>(TGE_PRICE_USD);
  const [copied, setCopied] = useState(false);

  // Live quote — re-quotes whenever amount/source changes.
  const quote = useMemo(() => {
    if (source === 'protocol') {
      return { effectivePrice: TGE_PRICE_USD, slippagePct: 0, mid: TGE_PRICE_USD };
    }
    return quoteMarket(amount || 0);
  }, [source, amount]);

  const usdCost = amount * quote.effectivePrice;
  const solCost = usdCost / SOL_USD;
  const insufficient = mockChain.solBalance < solCost;

  // Reset on unmount (no leaking processing state if user navigates away).
  useEffect(() => () => {
    setStep('source');
  }, []);

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

  // -------- Step renderers --------
  const renderSource = () => (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-1">How would you like to buy?</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Both routes settle on Solana. Protocol is fixed-price &amp; instant; market is open-book.
      </p>

      <button
        type="button"
        onClick={() => setSource('protocol')}
        className={`w-full text-left rounded-2xl border-2 p-5 transition-all ${
          source === 'protocol'
            ? 'border-purple-500 bg-gradient-to-br from-purple-500/10 to-pink-500/10 shadow-lg'
            : 'border-border/40 hover:border-purple-500/40'
        }`}
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold">Buy from AURA Protocol</h3>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-500 px-2 py-0.5 rounded">
                Recommended
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              Buy directly from the AURA treasury at the fixed TGE price.
              Always available, no slippage, no fees.
            </p>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-1 text-purple-500"><Shield className="w-3 h-3" /> Treasury-backed</span>
              <span className="inline-flex items-center gap-1 text-purple-500"><Zap className="w-3 h-3" /> Instant fill</span>
              <span className="inline-flex items-center gap-1 text-purple-500"><Coins className="w-3 h-3" /> ${TGE_PRICE_USD.toFixed(4)} / ORA</span>
            </div>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => setSource('market')}
        className={`w-full text-left rounded-2xl border-2 p-5 transition-all ${
          source === 'market'
            ? 'border-teal-500 bg-gradient-to-br from-teal-500/10 to-cyan-500/10 shadow-lg'
            : 'border-border/40 hover:border-teal-500/40'
        }`}
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold mb-1">Buy on the secondary market</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Routes through the ORA / SOL pool on Raydium-style AMM. Spot price floats; large orders may slip.
            </p>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-1 text-teal-500"><TrendingUp className="w-3 h-3" /> Mid ≈ ${quote.mid.toFixed(4)}</span>
              <span className="inline-flex items-center gap-1 text-teal-500"><Sparkles className="w-3 h-3" /> Order-book filled</span>
            </div>
          </div>
        </div>
      </button>

      <Button
        onClick={() => setStep('amount')}
        className="w-full mt-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600"
      >
        Continue
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );

  const renderAmount = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">How much ORA?</h2>
        <span className={`text-xs px-2 py-1 rounded font-medium ${
          source === 'protocol' ? 'bg-purple-500/15 text-purple-500' : 'bg-teal-500/15 text-teal-500'
        }`}>
          {source === 'protocol' ? 'Protocol · fixed price' : 'Market · spot price'}
        </span>
      </div>

      {/* Big editable number */}
      <div className="rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-200/50 dark:border-purple-800/50 p-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-2">You receive</p>
        <div className="flex items-baseline gap-2">
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
            className="flex-1 bg-transparent text-5xl font-black tabular-nums focus:outline-none w-full"
          />
          <span className="text-xl font-bold text-muted-foreground">ORA</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          ≈ ${usdCost.toFixed(2)} USD · {solCost.toFixed(4)} SOL
        </p>
      </div>

      {/* Presets */}
      <div className="grid grid-cols-4 gap-2">
        {PRESETS.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => setAmount(p)}
            className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
              amount === p
                ? 'border-purple-500 bg-purple-500/10 text-purple-500'
                : 'border-border/40 hover:bg-secondary'
            }`}
          >
            {p.toLocaleString()}
          </button>
        ))}
      </div>

      {/* Quote breakdown */}
      <div className="rounded-xl bg-secondary/40 border border-border/40 p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{source === 'protocol' ? 'Price (TGE)' : 'Mid price'}</span>
          <span className="font-mono">${quote.mid.toFixed(4)} / ORA</span>
        </div>
        {source === 'market' && (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Effective fill price</span>
              <span className="font-mono">${quote.effectivePrice.toFixed(4)} / ORA</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Slippage</span>
              <span className={`font-mono ${quote.slippagePct > 3 ? 'text-orange-500' : 'text-foreground'}`}>
                {quote.slippagePct.toFixed(2)}%
              </span>
            </div>
          </>
        )}
        <div className="border-t border-border/40 pt-2 flex justify-between font-medium">
          <span>Total cost</span>
          <span className="font-mono">{solCost.toFixed(4)} SOL</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Your SOL balance</span>
          <span className={`font-mono ${insufficient ? 'text-red-500' : ''}`}>
            {mockChain.solBalance.toFixed(4)} SOL {insufficient && '(insufficient)'}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep('source')} className="flex-1">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={() => setStep('confirm')}
          disabled={amount <= 0 || insufficient}
          className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50"
        >
          Review order
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderConfirm = () => (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold">Review &amp; confirm</h2>

      <div className="rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-200/50 dark:border-purple-800/50 p-5 space-y-3">
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-muted-foreground">You pay</span>
          <span className="text-2xl font-black tabular-nums">{solCost.toFixed(4)} <span className="text-sm text-muted-foreground">SOL</span></span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-muted-foreground">You receive</span>
          <span className="text-2xl font-black tabular-nums text-purple-500">{amount.toFixed(2)} <span className="text-sm text-muted-foreground">ORA</span></span>
        </div>
      </div>

      <div className="rounded-xl bg-secondary/40 border border-border/40 p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Source</span>
          <span className="font-medium">{source === 'protocol' ? 'AURA Protocol Treasury' : 'Secondary market (ORA/SOL)'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Fill price</span>
          <span className="font-mono">${quote.effectivePrice.toFixed(4)} / ORA</span>
        </div>
        {source === 'market' && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Slippage tolerance</span>
            <span className="font-mono">{quote.slippagePct.toFixed(2)}%</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Network fee (gas)</span>
          <span className="font-mono text-green-500">Sponsored</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground italic">
        {source === 'protocol'
          ? 'The protocol always honours TGE price for new buyers. No fee. No slippage.'
          : 'Market orders fill against the open ORA/SOL pool. Price may move between quote and fill.'}
      </p>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep('amount')} className="flex-1">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={handleConfirm}
          className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600"
        >
          Confirm purchase
          <Check className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderProcessing = () => (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
      <p className="text-lg font-bold">Signing transaction…</p>
      <p className="text-sm text-muted-foreground text-center max-w-xs">
        {source === 'protocol'
          ? 'Settling with the AURA treasury at fixed TGE price.'
          : 'Routing through the ORA/SOL liquidity pool…'}
      </p>
    </div>
  );

  const renderComplete = () => (
    <div className="space-y-5">
      <div className="flex flex-col items-center text-center py-4">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-xl mb-4">
          <Check className="w-10 h-10 text-white" strokeWidth={3} />
        </div>
        <h2 className="text-2xl font-bold mb-1">Purchase complete 🎉</h2>
        <p className="text-sm text-muted-foreground">
          {amount.toFixed(2)} ORA is now in your wallet.
        </p>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-200/50 dark:border-green-800/50 p-5 space-y-3">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">ORA received</span>
          <span className="font-mono font-bold text-green-500">+{amount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">SOL spent</span>
          <span className="font-mono">-{solSpent.toFixed(4)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Filled @</span>
          <span className="font-mono">${filledPrice.toFixed(4)} / ORA</span>
        </div>
        <div className="border-t border-border/40 pt-3">
          <p className="text-xs text-muted-foreground mb-1">Transaction hash</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-xs bg-background/60 rounded px-2 py-1.5 truncate">{txHash}</code>
            <button
              type="button"
              onClick={handleCopyTx}
              className="p-1.5 rounded hover:bg-secondary transition-colors"
              title="Copy"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
            <a
              href={`https://explorer.solana.com/tx/${txHash}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded hover:bg-secondary transition-colors"
              title="Open in explorer"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => {
            // Reset state so user can immediately do another purchase.
            setStep('source');
            setAmount(500);
            setTxHash('');
          }}
          className="flex-1"
        >
          Buy more
        </Button>
        <Button
          onClick={() => navigate('/wallet')}
          className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600"
        >
          Back to wallet
        </Button>
      </div>
    </div>
  );

  // -------- Step pills (header) --------
  const STEP_ORDER: Step[] = ['source', 'amount', 'confirm', 'complete'];
  const visibleStep: Step = step === 'processing' ? 'confirm' : step;
  const stepIndex = STEP_ORDER.indexOf(visibleStep);

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b border-border/40 bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/wallet')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Wallet
          </button>
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-purple-500" />
            <h1 className="text-lg font-bold">Buy ORA</h1>
          </div>
          <div className="w-[60px]" />
        </div>
      </div>

      {/* Step pills */}
      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-5 pb-2">
        <div className="flex items-center gap-2 mb-6">
          {STEP_ORDER.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center gap-2 ${i <= stepIndex ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  i < stepIndex
                    ? 'bg-green-500 text-white'
                    : i === stepIndex
                      ? 'bg-purple-500 text-white'
                      : 'bg-secondary text-muted-foreground'
                }`}>
                  {i < stepIndex ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                <span className="text-xs font-medium capitalize hidden sm:inline">{s}</span>
              </div>
              {i < STEP_ORDER.length - 1 && (
                <div className={`flex-1 h-px ${i < stepIndex ? 'bg-green-500' : 'bg-border/40'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-3xl mx-auto px-4 md:px-6 pb-12">
        {/* Faucet — devnet-only. Auto-hides on localnet/mainnet. */}
        <ClaimTestOraButton variant="card" className="mb-6" />
        <div className="rounded-2xl border border-border/40 bg-card p-6 md:p-8 shadow-sm">
          {step === 'source' && renderSource()}
          {step === 'amount' && renderAmount()}
          {step === 'confirm' && renderConfirm()}
          {step === 'processing' && renderProcessing()}
          {step === 'complete' && renderComplete()}
        </div>

        {/* Current ORA balance — always visible footer */}
        <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
          <span>Current balance</span>
          <span className="font-mono">
            <span className="text-foreground font-bold">{mockChain.oraBalance.toFixed(2)}</span> ORA · {mockChain.solBalance.toFixed(4)} SOL
          </span>
        </div>
      </div>
    </div>
  );
}
