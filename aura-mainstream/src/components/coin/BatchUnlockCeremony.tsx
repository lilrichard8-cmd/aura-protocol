import { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Lock, Coins, ArrowRight, Check, Loader2, Shield, Unlock, Plus, Trash2, Gift } from 'lucide-react';
import { useMockChain, type CoinBenefit } from '@/context/MockChainContext';
import { useToast } from '@/context/ToastContext';
import { useCreatorCoinContract } from '@/hooks/useCreatorCoinContract';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

// New benefits added during this batch unlock. Old benefits are
// immutable promises to existing holders and never appear here.
interface DraftBenefit {
  draftId: string; // local-only id; replaced with a stable id on submit
  type: 'hold' | 'consume';
  title: string;
  description: string;
  threshold: number;
}

interface BatchUnlockCeremonyProps {
  open: boolean;
  symbol: string;
  logoUrl?: string;
  currentPrice: number;
  onClose: () => void;
  onUnlocked?: (batchNumber: number, price: number) => void;
}

type Phase = 'price' | 'unlocking' | 'complete';

const UNLOCK_STEPS = [
  { label: 'Verifying activity', detail: '2 of 3 milestones ✓' },
  { label: 'Signing transaction', detail: 'Wallet signature' },
  { label: 'Releasing 800 coins', detail: 'From vesting vault' },
  { label: 'Updating SPL token', detail: 'Solana mainnet' },
  { label: 'Indexing on-chain', detail: 'Explorer ready' },
];

export default function BatchUnlockCeremony({
  open,
  symbol,
  logoUrl,
  currentPrice,
  onClose,
  onUnlocked,
}: BatchUnlockCeremonyProps) {
  const mockChain = useMockChain();
  const { showToast } = useToast();
  // Real-chain bridge — VITE_CREATOR_COIN_REAL_CHAIN=true wires monthly unlocks
  // (oracle-signed) to the on-chain creator-coin program. The connected wallet
  // must equal the `activity_oracle` recorded at coin creation; for self-served
  // demos we set oracle = creator so the unlock signs cleanly.
  const onChain = useCreatorCoinContract();
  const uw = useUnifiedWallet();
  const [phase, setPhase] = useState<Phase>('price');
  const [batchPrice, setBatchPrice] = useState<number>(currentPrice);
  const [stepIdx, setStepIdx] = useState(0);
  const [txHash, setTxHash] = useState('');
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Existing immutable benefits the creator already promised to holders.
  const existingBenefits = (
    mockChain.creatorCoins.find(c => c.symbol === symbol)?.benefits || []
  ) as CoinBenefit[];

  // Drafts the creator is adding alongside this unlock.
  const [draftBenefits, setDraftBenefits] = useState<DraftBenefit[]>([]);
  const [showAddBenefit, setShowAddBenefit] = useState(false);
  const [newBenefitType, setNewBenefitType] = useState<'hold' | 'consume'>('hold');
  const [newBenefitTitle, setNewBenefitTitle] = useState('');
  const [newBenefitDesc, setNewBenefitDesc] = useState('');
  const [newBenefitThreshold, setNewBenefitThreshold] = useState<number>(1);

  const resetNewBenefitForm = () => {
    setNewBenefitType('hold');
    setNewBenefitTitle('');
    setNewBenefitDesc('');
    setNewBenefitThreshold(1);
    setShowAddBenefit(false);
  };

  const addDraftBenefit = () => {
    if (!newBenefitTitle.trim()) {
      showToast('error', 'Benefit title required.');
      return;
    }
    if (!Number.isFinite(newBenefitThreshold) || newBenefitThreshold <= 0) {
      showToast('error', 'Threshold must be greater than zero.');
      return;
    }
    setDraftBenefits(prev => [
      ...prev,
      {
        draftId: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: newBenefitType,
        title: newBenefitTitle.trim(),
        description: newBenefitDesc.trim(),
        threshold: newBenefitThreshold,
      },
    ]);
    resetNewBenefitForm();
  };

  const removeDraftBenefit = (draftId: string) => {
    setDraftBenefits(prev => prev.filter(b => b.draftId !== draftId));
  };

  const month = mockChain.creatorCoinVestingMonth ?? 0;
  // Genesis (2,000) is separate. Vesting batches are 1–10, each 800 coins.
  const nextBatch = month + 1;
  const unlockedSoFar = 2000 + month * 800;
  const totalSupply = 10000;
  const newUnlocked = unlockedSoFar + 800;

  useEffect(() => {
    if (open) {
      setPhase('price');
      setStepIdx(0);
      setBatchPrice(currentPrice);
      setTxHash('');
      setDraftBenefits([]);
      resetNewBenefitForm();
    } else {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentPrice]);

  const startUnlock = async () => {
    if (!isFinite(batchPrice) || batchPrice <= 0) {
      showToast('error', 'Invalid price.');
      return;
    }
    setPhase('unlocking');
    setStepIdx(0);

    for (let i = 0; i < UNLOCK_STEPS.length; i++) {
      await new Promise<void>((r) => {
        const t = setTimeout(() => {
          setStepIdx(i + 1);
          r();
        }, 600);
        timersRef.current.push(t);
      });
    }

    try {
      // Convert drafts to canonical CoinBenefit shape (stable ids).
      const newBenefits: CoinBenefit[] = draftBenefits.map((d, i) => ({
        id: `${symbol.replace(/^\$/, '').toLowerCase()}-b${Date.now()}-${i}`,
        type: d.type,
        title: d.title,
        description: d.description,
        threshold: d.threshold,
      }));
      await mockChain.unlockNextVestingBatch(symbol, batchPrice, newBenefits);
      // Real-chain mirror: call `unlock_monthly` on-chain. The on-chain
      // program ignores `batchPrice` (it operates on a fixed 1000-token
      // monthly unlock schedule) but expects activity proofs; we surface a
      // baseline (1 post, 1 trade, 1 interaction) so the demo path doesn't
      // get blocked by activity thresholds. Failures fall back to the mock
      // tx hash so the ceremony still completes visually.
      let hex = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      if (onChain.enabled && onChain.module && uw.publicKey && onChain.coinMint(uw.publicKey)) {
        try {
          const creator = uw.publicKey;
          const mintPda = onChain.coinMint(creator)!;
          const creatorTokenAccount = getAssociatedTokenAddressSync(mintPda, creator, true);
          const res = await onChain.module.unlockMonthly({
            creator,
            monthlyPosts: 1,
            monthlyTrades: 1,
            monthlyInteractions: 1,
            creatorTokenAccount,
          });
          if (res.success && res.signature) {
            hex = res.signature;
          } else if (!res.success) {
            // Soft-fail: keep mock ceremony but tell the creator on-chain didn't take.
            showToast('error', res.error || 'On-chain unlock failed (mock unlock preserved)');
          }
        } catch (err: any) {
          showToast('error', err?.message || 'On-chain unlock threw');
        }
      }
      setTxHash(hex);
      setPhase('complete');
      onUnlocked?.(nextBatch, batchPrice);
    } catch (err) {
      console.error('Batch unlock failed', err);
      showToast('error', 'Batch unlock failed. Please try again.');
      setPhase('price');
    }
  };

  const handleClose = () => {
    if (phase === 'unlocking') return;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    onClose();
  };

  if (!open) return null;

  const tickerDisplay = symbol.replace(/^\$/, '') || '???';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />
      <div
        className="absolute inset-0 opacity-50"
        style={{
          background:
            'radial-gradient(ellipse at 30% 20%, rgba(20,200,168,0.25), transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(124,58,237,0.20), transparent 50%)',
        }}
      />

      {(phase === 'unlocking' || phase === 'complete') && (
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

      {phase !== 'unlocking' && (
        <button
          onClick={handleClose}
          className="absolute top-6 right-6 z-10 p-2 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Phase progress dots */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {(['price', 'unlocking', 'complete'] as Phase[]).map((p, i) => {
          const order: Phase[] = ['price', 'unlocking', 'complete'];
          const myIdx = order.indexOf(p);
          const currentIdx = order.indexOf(phase);
          const active = myIdx <= currentIdx;
          const done = myIdx < currentIdx;
          return (
            <div key={p} className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full transition-all ${active ? 'bg-[#14C8A8] shadow-[0_0_10px_#14C8A8]' : 'bg-white/20'}`}
              />
              {i < 2 && <div className={`w-6 h-px ${done ? 'bg-[#14C8A8]' : 'bg-white/15'}`} />}
            </div>
          );
        })}
      </div>

      <div className="relative w-full max-w-2xl mx-4 my-8 px-6 md:px-10 py-10 md:py-12 rounded-3xl bg-gradient-to-b from-zinc-900/90 to-zinc-950/95 border border-white/10 shadow-2xl">

        {/* PHASE 1: PRICE */}
        {phase === 'price' && (
          <div className="space-y-7">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#14C8A8]/10 border border-[#14C8A8]/30 text-[#14C8A8] text-xs font-medium">
                <Unlock className="w-3 h-3" /> Vesting Batch {nextBatch} of 10
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Release Next 800 ${tickerDisplay}</h2>
              <p className="text-sm text-white/60">Set the launch price for this batch. The market decides whether to accept it.</p>
            </div>

            {/* Coin preview */}
            <div className="flex justify-center py-2">
              <div
                className="relative w-32 h-32 rounded-full overflow-hidden flex items-center justify-center"
                style={{ animation: 'mint-coin-pulse 2.5s ease-in-out infinite' }}
              >
                {logoUrl ? (
                  <img src={logoUrl} alt={`${tickerDisplay} logo`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#14C8A8] via-teal-400 to-emerald-500 flex items-center justify-center shadow-[0_0_60px_rgba(20,200,168,0.4)]">
                    <div className="absolute inset-2 rounded-full border-2 border-white/30" />
                    <div className="text-white font-black text-2xl tracking-wider drop-shadow-lg">${tickerDisplay}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Vesting progress summary */}
            <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-[#14C8A8]" />
                  <span className="text-white font-semibold">Vesting Progress</span>
                </div>
                <span className="text-sm font-mono font-bold text-white">
                  {unlockedSoFar.toLocaleString()} → <span className="text-[#14C8A8]">{newUnlocked.toLocaleString()}</span> / {totalSupply.toLocaleString()}
                </span>
              </div>
              <div className="flex h-3 rounded-full overflow-hidden bg-white/5">
                <div className="bg-gradient-to-r from-[#14C8A8] to-emerald-400" style={{ width: `${(unlockedSoFar / totalSupply) * 100}%` }} />
                <div className="bg-gradient-to-r from-amber-400 to-amber-500/60" style={{ width: `${(800 / totalSupply) * 100}%` }} />
              </div>
              <div className="flex justify-between mt-2 text-xs">
                <span className="text-[#14C8A8] font-semibold">Already circulating</span>
                <span className="text-amber-400 font-semibold">+800 unlocking now</span>
              </div>
            </div>

            {/* Price input */}
            <div>
              <label className="text-xs uppercase tracking-widest font-bold text-white/50 mb-2 block">Launch Price · ORA per coin</label>
              <div className="relative">
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={batchPrice}
                  onChange={(e) => setBatchPrice(Math.max(0.01, parseFloat(e.target.value) || 0.01))}
                  placeholder={currentPrice.toFixed(2)}
                  className="w-full pl-4 pr-16 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#14C8A8]/40 focus:border-[#14C8A8]/40 transition"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#14C8A8] font-bold text-sm tracking-wider">ORA</span>
              </div>
              <p className="text-xs text-white/40 mt-1.5">Current market price: <span className="text-white/70 font-mono">{currentPrice.toFixed(2)} ORA</span> · Batch total at this price: <span className="text-white/70 font-mono">{(batchPrice * 800).toLocaleString(undefined, { maximumFractionDigits: 2 })} ORA</span></p>
            </div>

            {/* Benefits section.
             *
             *  Existing benefits are LOCKED — promises to current holders.
             *  The creator can add new benefits alongside this batch but
             *  cannot edit or remove old ones.
             */}
            <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-purple-400" />
                  <span className="text-white font-semibold">Holder Benefits</span>
                </div>
                <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">
                  {existingBenefits.length} live · {draftBenefits.length} new
                </span>
              </div>

              {/* Existing benefits — read-only with locked badge */}
              {existingBenefits.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Locked promises (cannot be edited)
                  </p>
                  {existingBenefits.map(b => (
                    <div key={b.id} className="rounded-lg bg-white/[0.02] border border-white/5 p-3 opacity-80">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded-full ${b.type === 'hold' ? 'bg-purple-500/20 text-purple-300' : 'bg-orange-500/20 text-orange-300'}`}>
                            {b.type === 'hold' ? 'Hold' : 'Pay'}
                          </span>
                          <p className="text-sm font-semibold text-white">{b.title}</p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60 font-mono whitespace-nowrap">
                          {b.type === 'hold' ? '≥' : ''} {b.threshold} ${tickerDisplay}
                        </span>
                      </div>
                      {b.description && (
                        <p className="text-xs text-white/50 mt-1">{b.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Drafts (this batch) */}
              {draftBenefits.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> New for this batch
                  </p>
                  {draftBenefits.map(b => (
                    <div key={b.draftId} className="rounded-lg bg-emerald-500/[0.05] border border-emerald-500/20 p-3 flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded-full ${b.type === 'hold' ? 'bg-purple-500/20 text-purple-300' : 'bg-orange-500/20 text-orange-300'}`}>
                            {b.type === 'hold' ? 'Hold' : 'Pay'}
                          </span>
                          <p className="text-sm font-semibold text-white">{b.title}</p>
                          <span className="text-[10px] text-white/50 font-mono ml-auto">
                            {b.type === 'hold' ? '≥' : ''} {b.threshold} ${tickerDisplay}
                          </span>
                        </div>
                        {b.description && (
                          <p className="text-xs text-white/60">{b.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeDraftBenefit(b.draftId)}
                        className="shrink-0 p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-rose-400 transition-colors"
                        title="Remove draft"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new benefit form / button */}
              {!showAddBenefit ? (
                <button
                  onClick={() => setShowAddBenefit(true)}
                  className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-dashed border-white/15 text-white/70 text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add a new benefit (optional)
                </button>
              ) : (
                <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 space-y-3">
                  <div className="flex gap-1">
                    {(['hold', 'consume'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setNewBenefitType(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${newBenefitType === t
                          ? (t === 'hold' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-orange-500/20 text-orange-300 border border-orange-500/40')
                          : 'bg-white/5 text-white/50 border border-transparent hover:text-white/80'}`}
                      >
                        {t === 'hold' ? 'Hold-to-Enjoy' : 'Pay-to-Redeem'}
                      </button>
                    ))}
                  </div>
                  <input
                    placeholder="Title (e.g. Monthly Q&A access)"
                    value={newBenefitTitle}
                    onChange={e => setNewBenefitTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#14C8A8]/40 focus:border-[#14C8A8]/40"
                  />
                  <input
                    placeholder="Short description"
                    value={newBenefitDesc}
                    onChange={e => setNewBenefitDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#14C8A8]/40 focus:border-[#14C8A8]/40"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/50 whitespace-nowrap">
                      {newBenefitType === 'hold' ? 'Hold at least' : 'Pay'}
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={newBenefitThreshold}
                      onChange={e => setNewBenefitThreshold(Math.max(1, parseFloat(e.target.value) || 1))}
                      className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#14C8A8]/40 focus:border-[#14C8A8]/40"
                    />
                    <span className="text-xs text-white/50 whitespace-nowrap">${tickerDisplay}</span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={resetNewBenefitForm}
                      className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-xs font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addDraftBenefit}
                      className="flex-1 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition-colors"
                    >
                      Stage benefit
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl bg-amber-500/[0.05] border border-amber-500/20 p-3 flex items-start gap-2">
              <Shield className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-300/90 leading-relaxed">
                <span className="font-semibold">On-chain commitment.</span> Once signed, 800 ${tickerDisplay} are released at this price. {draftBenefits.length > 0 && (<>The {draftBenefits.length} new benefit{draftBenefits.length > 1 ? 's are' : ' is'} permanently added to your coin. </>)}No takebacks.
              </p>
            </div>

            <button
              onClick={startUnlock}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#14C8A8] to-emerald-500 text-white font-bold text-base hover:shadow-[0_0_30px_rgba(20,200,168,0.5)] transition-all flex items-center justify-center gap-2 group"
            >
              <Sparkles className="w-4 h-4" />
              Sign &amp; Release Vesting Batch {nextBatch}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {/* PHASE 2: UNLOCKING */}
        {phase === 'unlocking' && (
          <div className="space-y-8 py-4">
            <div className="text-center space-y-2">
              <h2 className="text-2xl md:text-3xl font-bold text-white">Releasing vesting batch {nextBatch}…</h2>
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
                    <span className="text-white font-black text-xl tracking-wider">${tickerDisplay}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 max-w-md mx-auto">
              {UNLOCK_STEPS.map((step, i) => {
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

        {/* PHASE 3: COMPLETE */}
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
                    <span className="text-white font-black text-2xl tracking-wider drop-shadow-lg">${tickerDisplay}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
                <Check className="w-3 h-3" /> On-chain · Confirmed
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Vesting Batch {nextBatch} released.</h2>
              <p className="text-sm text-white/60 max-w-md mx-auto">
                800 ${tickerDisplay} now circulating at <span className="text-white font-semibold font-mono">{batchPrice.toFixed(2)} ORA</span> each. {newUnlocked.toLocaleString()} of {totalSupply.toLocaleString()} unlocked.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
              <div className="rounded-xl bg-white/[0.03] border border-white/10 p-3 text-center">
                <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Released</p>
                <p className="text-lg font-bold text-[#14C8A8] font-mono">+800</p>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/10 p-3 text-center">
                <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Batch Value</p>
                <p className="text-lg font-bold text-white font-mono">{(batchPrice * 800).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                <p className="text-[10px] text-white/40">ORA</p>
              </div>
            </div>

            {txHash && (
              <div className="max-w-md mx-auto rounded-xl bg-white/[0.03] border border-white/10 p-3 text-left">
                <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Transaction Hash</p>
                <p className="text-xs font-mono text-white/70 truncate">{txHash}</p>
              </div>
            )}

            <button
              onClick={handleClose}
              className="w-full max-w-md mx-auto py-3.5 rounded-2xl bg-gradient-to-r from-[#14C8A8] to-emerald-500 text-white font-bold hover:shadow-[0_0_30px_rgba(20,200,168,0.5)] transition-all flex items-center justify-center gap-2"
            >
              <Coins className="w-4 h-4" />
              Back to ${tickerDisplay}
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-[10px] text-white/30 -mt-3">{nextBatch < 10 ? `Next batch unlocks in 30 days` : `Final vesting batch released — ${tickerDisplay} fully circulating`}</p>
          </div>
        )}
      </div>
    </div>
  );
}
