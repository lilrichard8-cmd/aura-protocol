import { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Lock, Coins, Flame, TrendingUp, Shield, ArrowRight, Check, Loader2, Upload, Gift, Zap, Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import { useMockChain, type CoinBenefit } from '@/context/MockChainContext';
import { useToast } from '@/context/ToastContext';

interface MintCeremonyProps {
  open: boolean;
  defaultSymbol?: string;
  defaultName?: string;
  onClose: () => void;
  onMinted: (symbol: string) => void;
}

type Phase = 'identity' | 'benefits' | 'terms' | 'minting' | 'complete';

const MINT_STEPS = [
  { label: 'Verifying eligibility', detail: '100 followers ✓' },
  { label: 'Signing transaction', detail: 'Wallet signature' },
  { label: 'Deploying SPL token', detail: 'Solana mainnet' },
  { label: 'Minting 10,000 supply', detail: '2,000 released · 8,000 locked' },
  { label: 'Indexing on-chain', detail: 'Explorer ready' },
];

const PHASE_ORDER: Phase[] = ['identity', 'benefits', 'terms', 'minting', 'complete'];

export default function MintCeremony({ open, defaultSymbol = 'JUDGE', defaultName = 'Judge Coin', onClose, onMinted }: MintCeremonyProps) {
  const mockChain = useMockChain();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('identity');
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [name, setName] = useState(defaultName);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [initialPrice, setInitialPrice] = useState<number>(1.00);
  const [holdBenefits, setHoldBenefits] = useState<CoinBenefit[]>([
    { id: crypto.randomUUID(), type: 'hold', title: '', description: '', threshold: 100 },
  ]);
  const [consumeBenefits, setConsumeBenefits] = useState<CoinBenefit[]>([
    { id: crypto.randomUUID(), type: 'consume', title: '', description: '', threshold: 50 },
  ]);
  const [stepIdx, setStepIdx] = useState(0);
  const [txHash, setTxHash] = useState('');
  const [mintedSymbol, setMintedSymbol] = useState('');
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!open) {
      setPhase('identity');
      setStepIdx(0);
      setSymbol(defaultSymbol);
      setName(defaultName);
      setLogoUrl('');
      setInitialPrice(1.00);
      setHoldBenefits([{ id: crypto.randomUUID(), type: 'hold', title: '', description: '', threshold: 100 }]);
      setConsumeBenefits([{ id: crypto.randomUUID(), type: 'consume', title: '', description: '', threshold: 50 }]);
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    }
  }, [open, defaultSymbol, defaultName]);

  const symbolValid = symbol.length >= 3 && symbol.length <= 6;
  const nameValid = name.trim().length >= 2;

  const handleLogoUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('error', 'Please upload an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('error', 'Image must be smaller than 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setLogoUrl(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const addBenefit = (type: 'hold' | 'consume') => {
    const newBenefit: CoinBenefit = {
      id: crypto.randomUUID(),
      type,
      title: '',
      description: '',
      threshold: type === 'hold' ? 100 : 50,
    };
    if (type === 'hold') setHoldBenefits(prev => [...prev, newBenefit]);
    else setConsumeBenefits(prev => [...prev, newBenefit]);
  };

  const removeBenefit = (type: 'hold' | 'consume', id: string) => {
    if (type === 'hold') setHoldBenefits(prev => prev.filter(b => b.id !== id));
    else setConsumeBenefits(prev => prev.filter(b => b.id !== id));
  };

  const updateBenefit = (type: 'hold' | 'consume', id: string, patch: Partial<CoinBenefit>) => {
    const upd = (list: CoinBenefit[]) => list.map(b => b.id === id ? { ...b, ...patch } : b);
    if (type === 'hold') setHoldBenefits(upd);
    else setConsumeBenefits(upd);
  };

  const startMint = async () => {
    setPhase('minting');
    setStepIdx(0);

    for (let i = 0; i < MINT_STEPS.length; i++) {
      await new Promise<void>(r => {
        const t = setTimeout(() => {
          setStepIdx(i + 1);
          r();
        }, 600);
        timersRef.current.push(t);
      });
    }

    try {
      // Strip empty benefits before persisting.
      const cleanBenefits = [
        ...holdBenefits.filter(b => b.title.trim() && b.description.trim()),
        ...consumeBenefits.filter(b => b.title.trim() && b.description.trim()),
      ];
      const result = await mockChain.mintCreatorCoin(symbol, name, {
        logoUrl: logoUrl || undefined,
        benefits: cleanBenefits.length > 0 ? cleanBenefits : undefined,
        initialPrice,
      });
      const hex = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      setTxHash(hex);
      setMintedSymbol(result.symbol);
      setPhase('complete');
      // Iris auto-buy is triggered by CoinDetailPage when the creator lands there.
    } catch (err) {
      console.error('Mint failed', err);
      setPhase('terms');
    }
  };

  const handleClose = () => {
    if (phase === 'minting') return;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (phase === 'complete' && mintedSymbol) {
      onMinted(mintedSymbol);
    } else {
      onClose();
    }
  };

  if (!open) return null;

  const tickerDisplay = symbol || '???';
  const currentIdx = PHASE_ORDER.indexOf(phase);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto">
      {/* Backdrop with animated gradient */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />
      <div
        className="absolute inset-0 opacity-50"
        style={{
          background:
            'radial-gradient(ellipse at 30% 20%, rgba(20,200,168,0.25), transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(124,58,237,0.20), transparent 50%)',
        }}
      />

      {(phase === 'minting' || phase === 'complete') && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                background: i % 2 === 0 ? '#14C8A8' : '#fbbf24',
                opacity: 0.6,
                animation: `mint-float ${3 + Math.random() * 4}s ease-in-out ${Math.random() * 2}s infinite`,
                boxShadow: i % 2 === 0 ? '0 0 6px #14C8A8' : '0 0 6px #fbbf24',
              }}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes mint-float { 0%,100%{transform:translate(0,0);opacity:.3} 50%{transform:translate(20px,-30px);opacity:.9} }
        @keyframes mint-coin-spin { 0%{transform:rotateY(0)} 100%{transform:rotateY(360deg)} }
        @keyframes mint-coin-pulse { 0%,100%{transform:scale(1);box-shadow:0 0 60px rgba(20,200,168,.4)} 50%{transform:scale(1.05);box-shadow:0 0 100px rgba(20,200,168,.7)} }
        @keyframes mint-burst { 0%{transform:scale(.5);opacity:0} 50%{opacity:1} 100%{transform:scale(1.2);opacity:0} }
      `}</style>

      {phase !== 'minting' && (
        <button
          onClick={handleClose}
          className="absolute top-6 right-6 z-10 p-2 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Phase progress dots */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {(['identity', 'benefits', 'terms', 'minting'] as Phase[]).map((p, i) => {
          const myIdx = PHASE_ORDER.indexOf(p);
          const active = myIdx <= currentIdx;
          const done = myIdx < currentIdx;
          return (
            <div key={p} className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full transition-all ${active ? 'bg-[#14C8A8] shadow-[0_0_10px_#14C8A8]' : 'bg-white/20'}`}
              />
              {i < 3 && <div className={`w-6 h-px ${done ? 'bg-[#14C8A8]' : 'bg-white/15'}`} />}
            </div>
          );
        })}
      </div>

      <div className="relative w-full max-w-2xl mx-4 my-8 px-6 md:px-10 py-10 md:py-12 rounded-3xl bg-gradient-to-b from-zinc-900/90 to-zinc-950/95 border border-white/10 shadow-2xl">

        {/* PHASE 1: IDENTITY */}
        {phase === 'identity' && (
          <div className="space-y-7">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#14C8A8]/10 border border-[#14C8A8]/30 text-[#14C8A8] text-xs font-medium">
                <Sparkles className="w-3 h-3" /> Step 1 of 4 · Identity
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Forge Your Creator Coin</h2>
              <p className="text-sm text-white/60">Every creator is a sovereign micro-economy. This is yours.</p>
            </div>

            {/* Coin preview with logo */}
            <div className="flex justify-center py-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="relative w-32 h-32 rounded-full overflow-hidden group cursor-pointer"
                style={{ animation: 'mint-coin-pulse 2.5s ease-in-out infinite' }}
              >
                {logoUrl ? (
                  <>
                    <img src={logoUrl} alt="Coin logo" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Upload className="w-7 h-7 text-white" />
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#14C8A8] via-teal-400 to-emerald-500 flex items-center justify-center shadow-[0_0_60px_rgba(20,200,168,0.4)]">
                    <div className="absolute inset-2 rounded-full border-2 border-white/30" />
                    <div className="text-white font-black text-2xl tracking-wider drop-shadow-lg">${tickerDisplay}</div>
                    <div className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center group-hover:bg-black/60 transition-colors">
                      <ImageIcon className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }}
                className="hidden"
              />
            </div>
            <p className="text-center text-xs text-white/40 -mt-3">
              {logoUrl ? 'Click image to change' : 'Click coin to upload custom logo · PNG/JPG · max 2MB'}
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-widest font-bold text-white/50 mb-2 block">Coin Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  maxLength={32}
                  placeholder="e.g. Maya's Lens Coin"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-lg focus:outline-none focus:ring-2 focus:ring-[#14C8A8]/40 focus:border-[#14C8A8]/40 transition"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest font-bold text-white/50 mb-2 block">Ticker Symbol · 3–6 chars</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-2xl font-bold">$</span>
                  <input
                    type="text"
                    value={symbol}
                    onChange={e => setSymbol(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6))}
                    maxLength={6}
                    placeholder="JUDGE"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-2xl font-black tracking-[0.2em] uppercase focus:outline-none focus:ring-2 focus:ring-[#14C8A8]/40 focus:border-[#14C8A8]/40 transition"
                  />
                </div>
                <p className="text-xs text-white/40 mt-1.5">Cannot be changed after minting · uniqueness checked on-chain</p>
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest font-bold text-white/50 mb-2 block">Initial Price · ORA per coin</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={initialPrice}
                    onChange={e => setInitialPrice(Math.max(0.01, parseFloat(e.target.value) || 0.01))}
                    placeholder="1.00"
                    className="w-full pl-4 pr-16 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#14C8A8]/40 focus:border-[#14C8A8]/40 transition"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#14C8A8] font-bold text-sm tracking-wider">ORA</span>
                </div>
                <p className="text-xs text-white/40 mt-1.5">You set the price for your first 2,000 unlocked coins. Whether buyers accept it is their call.</p>
              </div>
            </div>

            <button
              onClick={() => setPhase('benefits')}
              disabled={!symbolValid || !nameValid}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#14C8A8] to-emerald-500 text-white font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_30px_rgba(20,200,168,0.5)] transition-all flex items-center justify-center gap-2 group"
            >
              Design Holder Benefits
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {/* PHASE 2: BENEFITS */}
        {phase === 'benefits' && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#14C8A8]/10 border border-[#14C8A8]/30 text-[#14C8A8] text-xs font-medium">
                <Gift className="w-3 h-3" /> Step 2 of 4 · Benefits
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white">What do holders get?</h2>
              <p className="text-sm text-white/60 max-w-md mx-auto">You decide. Holders unlock perks just by holding. Or they pay coins back to you to redeem something special.</p>
              <p className="text-xs text-amber-400/80 max-w-md mx-auto pt-1">At least one benefit — in either category — is required so your coin has clear utility.</p>
            </div>

            {/* HOLD-TO-ENJOY */}
            <div className="rounded-2xl bg-purple-500/[0.05] border border-purple-500/20 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-purple-400" />
                  <span className="text-white font-semibold">Hold-to-Enjoy</span>
                  <span className="text-xs text-white/40">· transfer or sell → access lost</span>
                </div>
                <button onClick={() => addBenefit('hold')} disabled={holdBenefits.length >= 5} className="text-xs text-purple-400 hover:text-purple-300 disabled:opacity-30 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              <div className="space-y-2.5">
                {holdBenefits.map((b) => (
                  <BenefitRow
                    key={b.id}
                    benefit={b}
                    accent="purple"
                    placeholderTitle="Benefit title"
                    placeholderDesc="Describe what holders unlock…"
                    onChange={(patch) => updateBenefit('hold', b.id, patch)}
                    onRemove={holdBenefits.length > 1 ? () => removeBenefit('hold', b.id) : undefined}
                    thresholdLabel="Min hold"
                  />
                ))}
              </div>
            </div>

            {/* PAY-TO-REDEEM (coins flow back to creator, NOT burned) */}
            <div className="rounded-2xl bg-orange-500/[0.05] border border-orange-500/20 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-orange-400" />
                  <span className="text-white font-semibold">Pay-to-Redeem</span>
                  <span className="text-xs text-white/40">· coins return to your wallet</span>
                </div>
                <button onClick={() => addBenefit('consume')} disabled={consumeBenefits.length >= 5} className="text-xs text-orange-400 hover:text-orange-300 disabled:opacity-30 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              <div className="space-y-2.5">
                {consumeBenefits.map((b) => (
                  <BenefitRow
                    key={b.id}
                    benefit={b}
                    accent="orange"
                    placeholderTitle="Redemption title"
                    placeholderDesc="What does the holder get when they redeem?"
                    onChange={(patch) => updateBenefit('consume', b.id, patch)}
                    onRemove={consumeBenefits.length > 1 ? () => removeBenefit('consume', b.id) : undefined}
                    thresholdLabel="Pay"
                  />
                ))}
              </div>
            </div>

            <p className="text-xs text-white/40 text-center">
              Empty rows are skipped. You can always add or edit benefits later from your Coin page.
            </p>
            <div className="rounded-xl bg-amber-500/[0.05] border border-amber-500/20 p-3 flex items-start gap-2">
              <Shield className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-300/90 leading-relaxed">
                <span className="font-semibold">On-chain commitment.</span> Once recorded, your benefits become an immutable promise to holders. Refusing to honor them is the only condition that triggers community arbitration.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setPhase('identity')}
                className="px-6 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 font-medium transition-colors"
              >
                Back
              </button>
              {(() => {
                const validHold = holdBenefits.filter(b => b.title.trim() && b.description.trim()).length;
                const validPay = consumeBenefits.filter(b => b.title.trim() && b.description.trim()).length;
                const hasAtLeastOne = validHold + validPay >= 1;
                return (
                  <button
                    onClick={() => setPhase('terms')}
                    disabled={!hasAtLeastOne}
                    className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-[#14C8A8] to-emerald-500 text-white font-bold hover:shadow-[0_0_30px_rgba(20,200,168,0.5)] transition-all flex items-center justify-center gap-2 group disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
                  >
                    {hasAtLeastOne ? 'Continue to Tokenomics' : 'Add at least one benefit'}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                );
              })()}
            </div>
          </div>
        )}

        {/* PHASE 3: TERMS */}
        {phase === 'terms' && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#14C8A8]/10 border border-[#14C8A8]/30 text-[#14C8A8] text-xs font-medium">
                <Shield className="w-3 h-3" /> Step 3 of 4 · Tokenomics
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white">${symbol}'s On-Chain Constitution</h2>
              <p className="text-sm text-white/60">These parameters are immutable. Review carefully.</p>
            </div>

            <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-[#14C8A8]" />
                  <span className="text-white font-semibold">Total Supply</span>
                </div>
                <span className="text-2xl font-black text-white font-mono">10,000</span>
              </div>
              <div className="flex h-3 rounded-full overflow-hidden bg-white/5">
                <div className="bg-gradient-to-r from-[#14C8A8] to-emerald-400" style={{ width: '20%' }} />
                <div className="bg-gradient-to-r from-amber-500 to-orange-400" style={{ width: '80%' }} />
              </div>
              <div className="flex justify-between mt-2 text-xs">
                <span className="text-[#14C8A8] font-semibold">2,000 unlocked at TGE</span>
                <span className="text-amber-400 font-semibold">8,000 vesting · 800/month × 10mo</span>
              </div>
              <div className="mt-3 pt-3 border-t border-white/5">
                <p className="text-[10px] uppercase tracking-widest text-amber-400/80 font-bold mb-1.5">Monthly unlock requires activity</p>
                <p className="text-xs text-white/60 leading-relaxed">
                  Each 800-coin unlock releases only if you complete <span className="text-white font-semibold">any 2 of 3</span>: publish 5 posts · make 1 trade · receive 20 interactions.
                </p>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-white/40">
                <span>No royalties</span>
                <span>•</span>
                <span>No trade cooldown</span>
                <span>•</span>
                <span>Initial price {initialPrice.toFixed(2)} ORA</span>
              </div>
            </div>

            <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-[#14C8A8]" />
                <span className="text-white font-semibold">Trade Fee · Flat 5%</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Burn', value: '2.0%', icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
                  { label: 'Staking', value: '2.0%', icon: Lock, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
                  { label: 'Gas Reserve', value: '0.5%', icon: Coins, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
                  { label: 'Protocol Ops', value: '0.5%', icon: Shield, color: 'text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/20' },
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className={`p-3 rounded-xl border ${item.bg} flex items-center justify-between`}>
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${item.color}`} />
                        <span className="text-xs text-white/70">{item.label}</span>
                      </div>
                      <span className={`text-sm font-bold font-mono ${item.color}`}>{item.value}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-white/40 mt-3 leading-relaxed">95% of every trade flows back to the ecosystem. Zero royalty on creator → fan transfers.</p>
            </div>

            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <Check className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-300">Free to mint · No ORA required</p>
                <p className="text-xs text-white/50">Network fee paid by AURA Protocol launch incentive program.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setPhase('benefits')}
                className="px-6 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 font-medium transition-colors"
              >
                Back
              </button>
              <button
                onClick={startMint}
                className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-[#14C8A8] to-emerald-500 text-white font-bold hover:shadow-[0_0_30px_rgba(20,200,168,0.5)] transition-all flex items-center justify-center gap-2 group"
              >
                <Sparkles className="w-4 h-4" />
                Sign &amp; Mint ${symbol}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        )}

        {/* PHASE 4: MINTING */}
        {phase === 'minting' && (
          <div className="space-y-8 py-4">
            <div className="text-center space-y-2">
              <h2 className="text-2xl md:text-3xl font-bold text-white">Forging ${symbol}…</h2>
              <p className="text-sm text-white/60">Do not close this window.</p>
            </div>

            <div className="flex justify-center py-2">
              <div
                className="relative w-28 h-28 rounded-full overflow-hidden flex items-center justify-center shadow-[0_0_80px_rgba(20,200,168,0.6)]"
                style={{ animation: 'mint-coin-spin 2s linear infinite', transformStyle: 'preserve-3d' }}
              >
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#14C8A8] via-teal-400 to-emerald-500 flex items-center justify-center">
                    <div className="absolute inset-2 rounded-full border-2 border-white/30" />
                    <span className="text-white font-black text-xl tracking-wider">${symbol}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 max-w-md mx-auto">
              {MINT_STEPS.map((step, i) => {
                const done = i < stepIdx;
                const active = i === stepIdx;
                return (
                  <div
                    key={step.label}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      done ? 'border-[#14C8A8]/30 bg-[#14C8A8]/5' : active ? 'border-white/20 bg-white/[0.03]' : 'border-white/5 bg-transparent opacity-40'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                      {done ? (
                        <div className="w-8 h-8 rounded-full bg-[#14C8A8]/20 border border-[#14C8A8]/40 flex items-center justify-center">
                          <Check className="w-4 h-4 text-[#14C8A8]" />
                        </div>
                      ) : active ? (
                        <Loader2 className="w-5 h-5 text-white/80 animate-spin" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-white/20" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${done ? 'text-[#14C8A8]' : active ? 'text-white' : 'text-white/40'}`}>{step.label}</p>
                      <p className="text-xs text-white/40 truncate">{step.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PHASE 5: COMPLETE */}
        {phase === 'complete' && (
          <div className="space-y-7 py-4 text-center">
            <div className="relative flex justify-center">
              <div
                className="absolute w-48 h-48 rounded-full bg-[#14C8A8]/30 blur-3xl"
                style={{ animation: 'mint-burst 1.4s ease-out' }}
              />
              <div
                className="relative w-32 h-32 rounded-full overflow-hidden flex items-center justify-center shadow-[0_0_100px_rgba(20,200,168,0.7)]"
                style={{ animation: 'mint-coin-pulse 2.5s ease-in-out infinite' }}
              >
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#14C8A8] via-teal-400 to-emerald-500 flex items-center justify-center">
                    <div className="absolute inset-2 rounded-full border-2 border-white/40" />
                    <span className="text-white font-black text-2xl tracking-wider drop-shadow-lg">${mintedSymbol.replace(/^\$/, '')}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
                <Check className="w-3 h-3" /> On-chain · Confirmed
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">{mintedSymbol} is alive.</h2>
              <p className="text-sm text-white/60 max-w-md mx-auto">
                10,000 supply forged. 2,000 ready to trade. Welcome to your sovereign micro-economy.
              </p>
            </div>

            {txHash && (
              <div className="max-w-md mx-auto rounded-xl bg-white/[0.03] border border-white/10 p-3 text-left">
                <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Transaction Hash</p>
                <p className="text-xs font-mono text-white/70 truncate">{txHash}</p>
              </div>
            )}

            <div className="flex gap-3 max-w-md mx-auto">
              <button
                onClick={handleClose}
                className="flex-1 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleClose}
                className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-[#14C8A8] to-emerald-500 text-white font-bold hover:shadow-[0_0_30px_rgba(20,200,168,0.5)] transition-all flex items-center justify-center gap-2"
              >
                Trade {mintedSymbol}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface BenefitRowProps {
  benefit: CoinBenefit;
  accent: 'purple' | 'orange';
  placeholderTitle: string;
  placeholderDesc: string;
  thresholdLabel: string;
  onChange: (patch: Partial<CoinBenefit>) => void;
  onRemove?: () => void;
}

function BenefitRow({ benefit, accent, placeholderTitle, placeholderDesc, thresholdLabel, onChange, onRemove }: BenefitRowProps) {
  const ringColor = accent === 'purple' ? 'focus:ring-purple-500/40' : 'focus:ring-orange-500/40';
  return (
    <div className="rounded-xl bg-black/30 border border-white/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={benefit.title}
          onChange={(e) => onChange({ title: e.target.value })}
          maxLength={48}
          placeholder={placeholderTitle}
          className={`flex-1 px-2 py-1.5 rounded-lg bg-transparent border-0 text-white text-sm font-semibold focus:outline-none focus:ring-2 ${ringColor}`}
        />
        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.04] border border-white/10">
          <span className="text-[10px] uppercase tracking-wider text-white/40">{thresholdLabel}</span>
          <input
            type="number"
            min={1}
            value={benefit.threshold}
            onChange={(e) => onChange({ threshold: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-14 bg-transparent border-0 text-white text-sm font-mono font-semibold text-right focus:outline-none"
          />
        </div>
        {onRemove && (
          <button onClick={onRemove} className="p-1 text-white/30 hover:text-red-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <textarea
        value={benefit.description}
        onChange={(e) => onChange({ description: e.target.value })}
        maxLength={140}
        rows={1}
        placeholder={placeholderDesc}
        className={`w-full px-2 py-1 rounded-lg bg-transparent border-0 text-white/80 text-xs resize-none focus:outline-none focus:ring-2 ${ringColor}`}
      />
    </div>
  );
}
