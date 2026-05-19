import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useConnection } from '@solana/wallet-adapter-react';
import { useOraContract } from '@/hooks/useOraContract';
import { useStakingContract } from '@/hooks/useStakingContract';
import type { StakeAccountOnChain } from '@/hooks/useStakingContract';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';
import { useChainTxHistory } from '@/hooks/useChainTxHistory';
import { Radio } from 'lucide-react';
import FeeBreakdown from '@/components/common/FeeBreakdown';
import ErrorBoundary from '@/components/ErrorBoundary';
import {
  Wallet,
  Send,
  Download,
  History,
  Eye,
  EyeOff,
  ExternalLink,
  Lock,
  Unlock,
  Gift,
  Copy,
  Check,
  Award,
  Users,
  X,
  Coins,
  Building2,
  TrendingUp,
  Key,
  Layers,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Vote,
  Trophy,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useMockChain } from '@/context/MockChainContext';
import { useI18n } from '@/context/I18nContext';
import { useToast } from '@/context/ToastContext';
import ReceiveModal from '@/components/wallet/ReceiveModal';
import StakingTierSelector, {
  STAKING_TIERS,
  BASE_APY,
  MIN_STAKE,
} from '@/components/wallet/StakingTierSelector';
import CurationEligibilityCard from '@/components/wallet/CurationEligibilityCard';
import { useBuyOra } from '@/context/BuyOraContext';
import type { OwnedKey, OwnedNft, FractionalizedNft, CreatorCoinHolding, StakeEntry } from '@/context/MockChainContext';
import { MIN_PROPOSAL_STAKE } from '@/components/governance/ProposalEligibilityBadge';
import { MIN_NOMINATION_STAKE } from '@/components/governance/electionCycle';

type NetworkKind = 'devnet' | 'testnet' | 'mainnet-beta';

// Optional fields/methods that Subagent B is adding to MockChainContext.
// We read them via a typed extras interface so we never use `any`.
interface MockChainExtras {
  walletAddress?: string;
  network?: NetworkKind;
  stakeOraWithTier?: (amount: number, lockDays: number) => Promise<void>;
  sendCreatorCoin?: (
    coinSymbol: string,
    recipient: string,
    amount: number,
  ) => Promise<{ txHash: string }>;
  // Real shape on MockChainContext is { todayCount, todayOraSpent, totalScore, totalRewards }.
  // We accept either spelling here so old/new persisted state both render.
  curationStats?: {
    todayCount?: number;
    todayOraSpent?: number;
    totalScore?: number;
    totalRewards?: number;
    // legacy aliases that earlier code expected — keep optional for safety
    todaySpent?: number;
    score?: number;
  };
  creatorCoinRedemptions?: Array<{
    coinSymbol: string;
    // Real key is `tierName` / `redeemedAt`; older code wrote `tier` / `timestamp` / `amount`.
    tierName?: string;
    redeemedAt?: number;
    tier?: string;
    amount?: number;
    timestamp?: number;
  }>;
  myCoinHolders?: number;
  stakes?: Array<{
    id: string;
    amount: number;
    lockDays: number;
    multiplier: number;
    startedAt: number;
  }>;
  /** Round 4 (2026-04-30): real pending-curation rows from MockChainContext.
   *  Empty until a real curation pipeline pushes records. */
  pendingCurations?: Array<{
    contentId: string;
    contentTitle: string;
    creatorName: string;
    curatedAt: number;
    expectedScore?: number;
  }>;
}

const TIER_BENEFITS: Array<{ threshold: number; tier: string; perk: string; color: string }> = [
  { threshold: 100, tier: 'Bronze', perk: 'Discord access', color: 'text-amber-700' },
  { threshold: 500, tier: 'Silver', perk: 'Monthly Q&A', color: 'text-slate-400' },
  { threshold: 1000, tier: 'Gold', perk: '1-on-1 call', color: 'text-yellow-500' },
  { threshold: 5000, tier: 'Platinum', perk: 'Co-creation seat', color: 'text-cyan-500' },
];

const shortenAddr = (a: string) => (a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);
const DAY = 86400 * 1000;

function networkBadge(net: NetworkKind) {
  if (net === 'mainnet-beta')
    return { label: 'MAINNET', cls: 'bg-green-500/15 text-green-600 border-green-500/30' };
  if (net === 'testnet')
    return { label: 'TESTNET', cls: 'bg-orange-500/15 text-orange-600 border-orange-500/30' };
  return { label: 'DEVNET', cls: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30' };
}

function explorerUrl(hash: string, net: NetworkKind) {
  if (net === 'mainnet-beta') return `https://explorer.solana.com/tx/${hash}`;
  // 2026-05-19 Tier 2: when running against localnet, explorer.solana.com
  // cannot resolve the tx (validator is on 127.0.0.1) — surface the
  // signature in a `custom RPC` view that at least gives users a copyable
  // link they can open against any indexer they have running.
  const cluster = (import.meta as any).env?.VITE_SOLANA_CLUSTER as string | undefined;
  if (cluster === 'localnet') {
    return `https://explorer.solana.com/tx/${hash}?cluster=custom&customUrl=http%3A%2F%2F127.0.0.1%3A8899`;
  }
  return `https://explorer.solana.com/tx/${hash}?cluster=${net}`;
}

export default function WalletPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const mockChain = useMockChain();
  const buyOra = useBuyOra();
  const extras = mockChain as unknown as MockChainExtras;

  // ── Real-chain wiring (2026-05-19 Tier-1) ──
  // We prefer the *unified wallet* (Privy embedded > Phantom) for the
  // canonical wallet address whenever real-chain mode is on. The previous
  // codepath read `extras.walletAddress` (a mock-chain string) which never
  // matched the user's actual Solana address.
  const onChain = useOraContract();
  const staking = useStakingContract();
  const uw = useUnifiedWallet();
  const { connection } = useConnection();
  // 2026-05-19 Tier 2 — best-effort on-chain tx history poll. Returns
  // `{ txs: [], loading:false }` when real-chain mode is off, so we can
  // unconditionally spread it into the History tab.
  const chainHistory = useChainTxHistory();
  const realChainEnabled = onChain.enabled && uw.publicKey !== null;
  const liveChain = realChainEnabled;
  const [chainOraBalance, setChainOraBalance] = useState<number | null>(null);
  const [chainSolBalance, setChainSolBalance] = useState<number | null>(null);
  const [chainBalanceErr, setChainBalanceErr] = useState<string | null>(null);

  // Live on-chain stakes (real-chain mode). Each entry is a stake PDA + its
  // parsed account state. We store the PDAs locally per user (localStorage)
  // so we can re-hydrate them across reloads — the on-chain program doesn't
  // expose a getProgramAccounts index, so callers must remember their PDAs.
  const [chainStakes, setChainStakes] = useState<StakeAccountOnChain[]>([]);
  const stakingLiveChain = staking.enabled && uw.publicKey !== null;
  const stakeStorageKey = uw.publicKey ? `aura_chain_stakes:${uw.publicKey.toBase58()}` : null;

  // walletAddress: prefer real on-chain pubkey when available; else fall back
  // to the mock-chain string or the placeholder for fully-mock builds.
  const walletAddress =
    uw.publicKey?.toBase58()
    ?? extras.walletAddress
    ?? 'AURAxxxxxxxxxxxxxxxxxxxxxxxx1234';
  const network: NetworkKind = extras.network ?? 'devnet';
  const netBadge = networkBadge(network);

  // Poll the live SPL+SOL balances whenever the on-chain wiring is active.
  // 10s cadence is enough for a wallet view; we don't subscribe to the
  // SPL token account because that would require a websocket subscription
  // and isn't worth the complexity for a Tier-1 wire-up.
  useEffect(() => {
    if (!liveChain || !uw.publicKey) {
      setChainOraBalance(null);
      setChainSolBalance(null);
      setChainBalanceErr(null);
      return;
    }
    let cancelled = false;
    const owner = uw.publicKey;
    const tick = async () => {
      try {
        const [oraRaw, lamports] = await Promise.all([
          onChain.getBalance(owner),
          connection.getBalance(owner),
        ]);
        if (cancelled) return;
        setChainOraBalance(Number(oraRaw) / Math.pow(10, onChain.decimals));
        setChainSolBalance(lamports / LAMPORTS_PER_SOL);
        setChainBalanceErr(null);
      } catch (e) {
        if (cancelled) return;
        setChainBalanceErr(e instanceof Error ? e.message : String(e));
      }
    };
    tick();
    const id = window.setInterval(tick, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [liveChain, uw.publicKey, onChain, connection]);

  // ── Real-chain stake polling ──
  // Reads tracked stake PDAs from localStorage and refreshes every 15s.
  useEffect(() => {
    if (!stakingLiveChain || !stakeStorageKey) {
      setChainStakes([]);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      const raw = window.localStorage.getItem(stakeStorageKey);
      if (!raw) {
        if (!cancelled) setChainStakes([]);
        return;
      }
      let pdas: string[];
      try {
        pdas = JSON.parse(raw);
        if (!Array.isArray(pdas)) pdas = [];
      } catch {
        pdas = [];
      }
      const results: StakeAccountOnChain[] = [];
      for (const s of pdas) {
        try {
          const acc = await staking.fetchStake(new PublicKey(s));
          if (acc) results.push(acc);
        } catch {
          /* stale PDA — drop silently */
        }
      }
      if (!cancelled) setChainStakes(results);
    };
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [stakingLiveChain, stakeStorageKey, staking]);

  // Sum of staked ORA from live chain (UI units).
  const chainStakedOraTotal = useMemo(() => {
    if (!stakingLiveChain) return null;
    const sum = chainStakes.reduce((acc, s) => acc + s.amount, 0n);
    return Number(sum) / 1e9;
  }, [stakingLiveChain, chainStakes]);

  // Effective balances: prefer live on-chain values when available,
  // otherwise fall back to MockChainContext.
  const displayedOraBalance =
    liveChain && chainOraBalance != null ? chainOraBalance : mockChain.oraBalance;
  const displayedSolBalance =
    liveChain && chainSolBalance != null ? chainSolBalance : mockChain.solBalance;

  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'staking' | 'coins' | 'inventory' | 'history'>('overview');
  const [showBalance, setShowBalance] = useState(true);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [addrCopied, setAddrCopied] = useState(false);
  const [sendForm, setSendForm] = useState<{ recipient: string; amount: string; token: string }>({
    recipient: '',
    amount: '',
    token: 'ORA',
  });
  const [showStakeModal, setShowStakeModal] = useState<'stake' | 'unstake' | null>(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [stakeTier, setStakeTier] = useState<number>(90);
  const [stakingLoading, setStakingLoading] = useState(false);
  const [stakeError, setStakeError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendLoading, setSendLoading] = useState(false);

  // R4 (2026-04-30): History tab filters
  type DateRangePreset = 'all' | 'today' | '7d' | '30d' | 'custom';
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>('all');
  const [historyDatePreset, setHistoryDatePreset] = useState<DateRangePreset>('all');
  const [historyDateFrom, setHistoryDateFrom] = useState<string>('');
  const [historyDateTo, setHistoryDateTo] = useState<string>('');
  // Expanded transaction id — click a row to toggle full breakdown
  // (fees deducted, gross/net, tx hash, explorer link).
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  // i18n helpers with safe fallbacks
  const w = t.wallet as Record<string, unknown>;
  const labels = (w.labels as Record<string, string> | undefined) ?? {};
  const lAvailable = labels.available ?? 'Available';
  const lLocked = labels.locked ?? 'Locked';
  const lPending = labels.pendingRewards ?? 'Pending Rewards';
  const lStakedOra = labels.stakedOra ?? 'Staked ORA';
  const lAvailableOra = labels.availableOra ?? 'Available ORA';
  const lStake = labels.stake ?? 'Stake';
  const lUnstake = labels.unstake ?? 'Unstake';
  const lClaim = labels.claim ?? 'Claim';
  const lFeeQ = labels.feeQuestion ?? 'Where does the 5% go?';
  const lFeeDesc = labels.feeDesc ?? 'Every ORA transaction splits the protocol fee as follows';
  const lTotalBurned = labels.totalBurned ?? 'Total Burned';
  const lTotalStaked = labels.totalStaked ?? 'Total Staked';
  const lCumBurned = labels.cumulativeBurned ?? 'Cumulative Burned';
  const lCumStaked = labels.cumulativeStaked ?? 'Cumulative Staked';
  const lTodayCreations = labels.todayCreations ?? "Today's Creations";
  const lFeeBreakdownTitle = labels.feeBreakdownTitle ?? '5% Transaction Fee Breakdown';
  const lFeeBreakdownDesc =
    labels.feeBreakdownDesc ??
    'Every Creator Coin transaction includes a 5% fee distributed as follows:';
  const lOraStaking = labels.oraStaking ?? 'ORA Staking';
  const lConnected = labels.connected ?? 'Connected';
  const lDisconnected = labels.disconnected ?? 'Disconnected';
  const lMyStakes = labels.myStakes ?? 'My Stakes';
  const lUnlocksIn = labels.unlocksIn ?? 'Unlocks in';
  const lDays = labels.days ?? 'days';
  const lUnlockDate = labels.unlockDate ?? 'Unlock';
  const lNoStakes = labels.noStakes ?? 'No active stakes';
  const lSelectTier = labels.selectTier ?? 'Select lock period';
  const lAmount = labels.amount ?? 'Amount';
  const lToken = labels.token ?? 'Token';
  const lYouHold = labels.youHold ?? 'You hold';
  const lCoins = labels.coins ?? 'coins';
  const lTierBenefits = labels.tierBenefits ?? 'Tier benefits';
  const lRedeemed = labels.redeemed ?? 'Redeemed';
  const lNoRedemptions = labels.noRedemptions ?? 'No redemptions yet';
  const lHoldersCount = labels.holdersCount ?? 'fans hold this coin';
  const lFeeFooter1 =
    labels.feeFooter1 ?? '95% of every transaction goes directly to the creator';
  const lFeeFooter2 = labels.feeFooter2 ?? "The protocol takes 5%. That's it.";

  // 2026-04-30: Send is a peer-to-peer transfer. NO 5% protocol fee — only gas (paid by protocol).
  // Per Zhuoyu: "Send theoretically only has gas, no protocol fee. Only ORA *transactions*
  // (tips/purchases/marketplace) get the 5%."
  const sendBalanceInfo = useMemo(() => {
    const isCC = sendForm.token !== 'ORA';
    if (!isCC) return { available: mockChain.oraBalance, label: 'ORA' };
    const cc = mockChain.creatorCoins.find((c) => c.symbol === sendForm.token);
    return { available: cc?.amount ?? 0, label: sendForm.token };
  }, [sendForm.token, mockChain.oraBalance, mockChain.creatorCoins]);

  const sendAmountNum = parseFloat(sendForm.amount);
  const sendOverBalance =
    Number.isFinite(sendAmountNum) && sendAmountNum > 0 && sendAmountNum > sendBalanceInfo.available;

  const stakeAmountNum = parseFloat(stakeAmount);
  const stakedOraEffective =
    stakingLiveChain && chainStakedOraTotal != null ? chainStakedOraTotal : mockChain.stakedOra;
  const stakeAvailable =
    showStakeModal === 'stake' ? displayedOraBalance : stakedOraEffective;
  const stakeOverBalance =
    Number.isFinite(stakeAmountNum) && stakeAmountNum > 0 && stakeAmountNum > stakeAvailable;
  const stakeBelowMin =
    showStakeModal === 'stake' &&
    Number.isFinite(stakeAmountNum) &&
    stakeAmountNum > 0 &&
    stakeAmountNum < MIN_STAKE;

  const handleStake = async () => {
    setStakeError(null);
    const amount = parseFloat(stakeAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setStakeError('Enter a valid amount');
      return;
    }
    if (showStakeModal === 'stake' && amount < MIN_STAKE) {
      setStakeError(`Minimum stake is ${MIN_STAKE} ORA`);
      return;
    }
    if (showStakeModal === 'stake' && amount > displayedOraBalance) {
      setStakeError(
        `Insufficient balance (you have ${displayedOraBalance.toFixed(4)} ORA)`,
      );
      return;
    }
    if (showStakeModal === 'unstake' && amount > stakedOraEffective) {
      setStakeError(
        `Cannot unstake more than staked (${stakedOraEffective.toFixed(4)} ORA)`,
      );
      return;
    }
    setStakingLoading(true);
    try {
      if (showStakeModal === 'stake') {
        if (stakingLiveChain) {
          const res = await staking.stakeOra({ amount, lockDays: stakeTier });
          if (!res.success) throw new Error(res.error || 'on-chain stake failed');
          // Persist the new stake PDA so we can poll it later.
          if (res.stake && stakeStorageKey) {
            const cur = window.localStorage.getItem(stakeStorageKey);
            let arr: string[] = [];
            try { arr = cur ? JSON.parse(cur) : []; } catch { arr = []; }
            arr.push(res.stake.toBase58());
            window.localStorage.setItem(stakeStorageKey, JSON.stringify(arr));
          }
        } else if (typeof extras.stakeOraWithTier === 'function') {
          await extras.stakeOraWithTier(amount, stakeTier);
        } else {
          await mockChain.stakeOra(amount);
        }
        showToast('success', 'Stake submitted', `Staked ${amount} ORA for ${stakeTier} day(s)`);
      } else {
        if (stakingLiveChain) {
          // On-chain unstake works per stake PDA. Pick the oldest stake whose
          // amount covers the requested amount (UI doesn't currently support
          // multi-PDA unstake — full-amount unstake of one PDA at a time).
          const targetRaw = BigInt(Math.round(amount * 1e9));
          const candidate = chainStakes
            .slice()
            .sort((a, b) => a.stakedAt - b.stakedAt)
            .find((s) => s.amount >= targetRaw);
          if (!candidate) {
            throw new Error('No single stake covers that amount on-chain. Try a smaller amount or unstake individual entries.');
          }
          const res = await staking.unstakeOra({ stakeNonce: candidate.stakeNonce });
          if (!res.success) throw new Error(res.error || 'on-chain unstake failed');
          // Drop the closed PDA from local tracking.
          if (stakeStorageKey) {
            const cur = window.localStorage.getItem(stakeStorageKey);
            try {
              const arr: string[] = cur ? JSON.parse(cur) : [];
              window.localStorage.setItem(
                stakeStorageKey,
                JSON.stringify(arr.filter((s) => s !== candidate.address.toBase58())),
              );
            } catch {
              /* ignore */
            }
          }
        } else {
          await mockChain.unstakeOra(amount);
        }
        showToast('success', 'Unstake submitted', `${amount} ORA returning to your wallet`);
      }
      setShowStakeModal(null);
      setStakeAmount('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStakeError(msg);
      showToast('error', 'Transaction failed', msg);
    } finally {
      setStakingLoading(false);
    }
  };

  const handleClaimReward = async () => {
    try {
      if (stakingLiveChain) {
        if (chainStakes.length === 0) {
          throw new Error('No on-chain stakes to claim from');
        }
        // Claim from each tracked stake. Best-effort — if one fails, surface
        // the error but continue trying the rest.
        let claimed = 0;
        const errors: string[] = [];
        for (const s of chainStakes) {
          const res = await staking.claimReward({ stakeNonce: s.stakeNonce });
          if (res.success) claimed += 1;
          else errors.push(res.error || 'unknown');
        }
        if (claimed === 0) {
          throw new Error(`All claims failed: ${errors.join('; ')}`);
        }
        showToast('success', `Claimed from ${claimed} stake(s)`);
      } else {
        await mockChain.claimStakingReward();
        showToast('success', 'Rewards claimed');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast('error', 'Claim failed', msg);
    }
  };

  const handleSend = async () => {
    setSendError(null);
    if (!sendForm.recipient || sendForm.recipient.trim().length === 0) {
      setSendError('Recipient required');
      return;
    }
    const amt = parseFloat(sendForm.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setSendError('Enter a valid amount');
      return;
    }
    if (amt > sendBalanceInfo.available) {
      setSendError(
        `Insufficient ${sendBalanceInfo.label} (you have ${sendBalanceInfo.available.toLocaleString(undefined, { maximumFractionDigits: 4 })})`,
      );
      return;
    }
    setSendLoading(true);
    try {
      if (sendForm.token === 'ORA') {
        // Real on-chain SPL transfer when wired up, otherwise mock chain.
        if (liveChain) {
          let to: PublicKey;
          try {
            to = new PublicKey(sendForm.recipient.trim());
          } catch {
            throw new Error('Recipient must be a valid Solana address');
          }
          const raw = BigInt(Math.round(amt * Math.pow(10, onChain.decimals)));
          const res = await onChain.transfer({ to, amount: raw });
          if (!res.success) throw new Error(res.error || 'on-chain transfer failed');
          // Also push a mock-chain tx so the History tab reflects it locally.
          // We don't await this — the on-chain tx already succeeded.
          try {
            await mockChain.sendOra(sendForm.recipient, amt);
          } catch {
            /* mock-side error is non-fatal */
          }
        } else {
          await mockChain.sendOra(sendForm.recipient, amt);
        }
      } else if (typeof extras.sendCreatorCoin === 'function') {
        await extras.sendCreatorCoin(sendForm.token, sendForm.recipient, amt);
      } else {
        throw new Error('sendCreatorCoin not available');
      }
      const recipShort = sendForm.recipient.length > 14
        ? `${sendForm.recipient.slice(0, 6)}…${sendForm.recipient.slice(-4)}`
        : sendForm.recipient;
      showToast(
        'success',
        'Transaction sent',
        `Sent ${amt} ${sendForm.token} to ${recipShort}`,
      );
      setShowSendModal(false);
      setSendForm({ recipient: '', amount: '', token: 'ORA' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSendError(msg);
      showToast('error', 'Send failed', msg);
    } finally {
      setSendLoading(false);
    }
  };

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setAddrCopied(true);
      showToast('success', 'Address copied', shortenAddr(walletAddress), 1500);
      setTimeout(() => setAddrCopied(false), 1500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast('error', 'Copy failed', msg);
    }
  };

  const formatBalance = (balance: number) =>
    showBalance ? balance.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '****';

  const getTransactionIcon = (type: string) => {
    const map: Record<string, { bg: string; text: string; icon: string }> = {
      airdrop: { bg: 'bg-yellow-100', text: 'text-yellow-600', icon: '🎁' },
      publish: { bg: 'bg-blue-100', text: 'text-blue-600', icon: '📝' },
      reward: { bg: 'bg-green-100', text: 'text-green-600', icon: '⭐' },
      mint_coin: { bg: 'bg-purple-100', text: 'text-purple-600', icon: '🪙' },
      buy_coin: { bg: 'bg-indigo-100', text: 'text-indigo-600', icon: '💰' },
      curate: { bg: 'bg-orange-100', text: 'text-orange-600', icon: '✨' },
      buy_key: { bg: 'bg-pink-100', text: 'text-pink-600', icon: '🔑' },
    };
    const m = map[type] || { bg: 'bg-gray-100', text: 'text-gray-600', icon: '?' };
    return (
      <div className={`w-8 h-8 ${m.bg} ${m.text} rounded-full flex items-center justify-center`}>
        {m.icon}
      </div>
    );
  };

  // 2026-05-11: feeData removed — the static percent bar that consumed it was a duplicate of
  // <FeeBreakdown>. Splits + colors now live solely in src/components/common/FeeBreakdown.tsx.

  // CC the user holds (excluding their own minted coin) for Send modal token picker
  const heldCCs = mockChain.creatorCoins.filter(
    (c) => c.symbol !== mockChain.creatorCoinSymbol && c.amount > 0,
  );

  // Curation stats with safe fallbacks. Note: the real MockChainContext uses
  // todayOraSpent / totalScore — we normalise to the names this page renders
  // and guard every numeric so a missing field can never crash .toFixed().
  const rawCurStats = extras.curationStats ?? {};
  const curStats = {
    todayCount: Number(rawCurStats.todayCount ?? 0) || 0,
    todaySpent: Number(rawCurStats.todayOraSpent ?? rawCurStats.todaySpent ?? 0) || 0,
    score: Number(rawCurStats.totalScore ?? rawCurStats.score ?? 0) || 0,
    totalRewards: Number(rawCurStats.totalRewards ?? 0) || 0,
  };

  // R4 (2026-04-30): real curate-related transactions sourced from chain state.
  // Includes the spend tx (`curate`) AND any future reward payout types
  // (`curation_reward` / `reward` whose details mention curat*). No fakes.
  const curationTxs = useMemo(() => {
    return mockChain.transactions.filter((tx) => {
      if (tx.type === 'curate') return true;
      // Forward-compat: future curation_reward type or reward txs tagged for curation.
      if ((tx.type as string) === 'curation_reward') return true;
      if (tx.type === 'reward' && /curat/i.test(tx.details || '')) return true;
      return false;
    });
  }, [mockChain.transactions]);

  // ── History tab: derive distinct types + filtered list ────────────────────
  const historyTypeOptions = useMemo(() => {
    return Array.from(new Set(mockChain.transactions.map((t) => t.type)));
  }, [mockChain.transactions]);

  /** Resolve [fromMs, toMs] (inclusive) from preset + custom inputs. */
  const historyRangeMs = useMemo<{ from: number | null; to: number | null }>(() => {
    if (historyDatePreset === 'all' && !historyDateFrom && !historyDateTo) {
      return { from: null, to: null };
    }
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    let from: number | null = null;
    let to: number | null = null;

    switch (historyDatePreset) {
      case 'today':
        from = startOfToday.getTime();
        to = now;
        break;
      case '7d':
        from = now - 7 * 86400_000;
        to = now;
        break;
      case '30d':
        from = now - 30 * 86400_000;
        to = now;
        break;
      default:
        // 'custom' or 'all' fall through to honour explicit inputs
        break;
    }

    if (historyDateFrom) {
      const f = new Date(historyDateFrom);
      if (!Number.isNaN(f.getTime())) {
        f.setHours(0, 0, 0, 0);
        from = f.getTime();
      }
    }
    if (historyDateTo) {
      const tt = new Date(historyDateTo);
      if (!Number.isNaN(tt.getTime())) {
        // include the entire end day (23:59:59.999)
        tt.setHours(23, 59, 59, 999);
        to = tt.getTime();
      }
    }
    return { from, to };
  }, [historyDatePreset, historyDateFrom, historyDateTo]);

  // 2026-05-19 Tier 2 — merge mock-chain history with real on-chain
  // signatures discovered via getSignaturesForAddress. We dedupe by
  // txHash so a Send that lives in both lists (we push to mockChain.sendOra
  // after a successful on-chain transfer) shows up once with the mock's
  // richer breakdown winning.
  const filteredTransactions = useMemo(() => {
    const { from, to } = historyRangeMs;
    const mockSeenHashes = new Set(mockChain.transactions.map((t) => t.txHash));
    // Coerce chain rows to the mock Transaction shape. The fields we don't
    // know stay zero / 'on-chain' and the History tab handles those defaults.
    const chainRows = chainHistory.txs
      .filter((c) => !mockSeenHashes.has(c.txHash))
      .map((c) => ({
        id: c.id,
        // We type chain.type as the union's catch-all 'send' so the rows
        // pass through the filter dropdown without breaking the enum.
        type: 'send' as const,
        amount: c.amount,
        timestamp: c.timestamp,
        txHash: c.txHash,
        details: c.details,
      }));
    const all = [...mockChain.transactions, ...chainRows];
    return all
      .filter((tx) => (historyTypeFilter === 'all' ? true : tx.type === historyTypeFilter))
      .filter((tx) => {
        if (from !== null && tx.timestamp < from) return false;
        if (to !== null && tx.timestamp > to) return false;
        return true;
      })
      .slice() // copy before sort
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [mockChain.transactions, chainHistory.txs, historyTypeFilter, historyRangeMs]);

  const isHistoryFiltered =
    historyTypeFilter !== 'all' ||
    historyDatePreset !== 'all' ||
    !!historyDateFrom ||
    !!historyDateTo;

  const clearHistoryFilters = () => {
    setHistoryTypeFilter('all');
    setHistoryDatePreset('all');
    setHistoryDateFrom('');
    setHistoryDateTo('');
  };

  // Pretty-print the raw tx type enum (e.g., 'buy_coin' → 'Buy Coin').
  const formatTxType = (type: string) =>
    type
      .split('_')
      .map((s) => (s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s))
      .join(' ');

  // Stakes list (synthesize from stakedOra if no stakes[] yet)
  // 2026-05-19 Tier 1.5: when real-chain staking is on, render live stakes
  // from the on-chain program instead of mock state. The shape is preserved
  // so the StakingTab component doesn't need to know which source rendered.
  const stakesList: Array<{
    id: string;
    amount: number;
    lockDays: number;
    multiplier: number;
    startedAt: number;
  }> = stakingLiveChain && chainStakes.length > 0
    ? chainStakes.map((s) => ({
        id: s.address.toBase58(),
        amount: Number(s.amount) / 1e9,
        lockDays: Math.max(1, Math.round((s.unlockAt - s.stakedAt) / 86400)),
        multiplier: s.multiplierBps / 10000,
        startedAt: s.stakedAt * 1000,
      }))
    : (extras.stakes && extras.stakes.length > 0
      ? extras.stakes
      : mockChain.stakedOra > 0
        ? [
            {
              id: 'legacy',
              amount: mockChain.stakedOra,
              lockDays: 30,
              multiplier: 1.0,
              startedAt: Date.now() - 5 * DAY,
            },
          ]
        : []);

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-background pb-32 md:pb-16">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/40">
        <div className="flex items-center justify-between p-4 px-4 md:px-6 lg:px-8">
          <div>
            <h1 className="text-lg md:text-xl lg:text-2xl font-bold">{t.wallet.title}</h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              Manage your ORA & Creator Coins
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-[10px] font-bold ${netBadge.cls}`}>
              {netBadge.label}
            </Badge>
            <Badge
              variant="secondary"
              className={`${
                mockChain.connected
                  ? 'bg-gradient-to-r from-green-400/10 to-blue-500/10 text-blue-600 border-blue-200'
                  : 'bg-red-100 text-red-600'
              }`}
            >
              <Wallet className="w-3 h-3 mr-1" />
              {mockChain.connected ? lConnected : lDisconnected}
            </Badge>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 lg:px-8">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="staking">
              Staking
              {mockChain.stakedOra > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">{mockChain.stakedOra.toFixed(0)}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="coins">
              Creator Coins
              <Badge variant="secondary" className="ml-2 text-xs">
                {mockChain.creatorCoins.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="inventory">
              Inventory
              <Badge variant="secondary" className="ml-2 text-xs">
                {mockChain.ownedKeys.length + mockChain.ownedNfts.length + mockChain.fractionalizedNfts.filter(n => n.ownedFragments > 0).length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="mt-6">
            {liveChain && (
              <div className="mb-4 px-4 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <span className="font-bold uppercase tracking-wider text-[10px] bg-amber-200 dark:bg-amber-800 px-1.5 py-0.5 rounded">Demo</span>
                <span>
                  Only the <b>Portfolio</b> card above is live on-chain. Staking, NFTs, Creator Coins, and transaction history below are still demo data and will be wired in v0.2.
                </span>
              </div>
            )}
            {/* 2026-05-11 R2 — 3×2 grid of equal-height cards. Staking moved
               to its own tab; this position now shows a lighter "Roles & Stake
               Summary" card. Min row height bumped per Zhuoyu so the cards
               breathe (was feeling cramped at h-auto).
               Row 1: Portfolio · Buy ORA · Roles
               Row 2: Fee · NFTs & Keys · Creator Coin Holdings */}
            {/* 2026-05-11 R4: grid fills the viewport vertically. We compute the
               available height as (viewport - top bar - tabs - bottom margin)
               and let `grid-rows-2` + `auto-rows-fr` divide it evenly between
               the two rows. Each card already uses `h-full flex flex-col` so
               internal content stretches to match. Falls back to a sensible
               min-height on smaller viewports so cards don't get crushed. */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 grid-rows-[auto] lg:grid-rows-2 gap-5 mb-6 auto-rows-fr [@media(min-width:1024px)]:min-h-[calc(100vh-220px)] min-h-[480px]">
              <PortfolioCard
                walletAddress={walletAddress}
                addrCopied={addrCopied}
                handleCopyAddress={handleCopyAddress}
                showBalance={showBalance}
                setShowBalance={setShowBalance}
                oraBalance={displayedOraBalance}
                solBalance={displayedSolBalance}
                ccCount={mockChain.creatorCoins.length}
                txCount={mockChain.transactions.length}
                onSend={() => setShowSendModal(true)}
                onReceive={() => setShowReceive(true)}
                liveChain={liveChain}
                chainBalanceErr={chainBalanceErr}
              />

              <BuyOraInlineCard />

              <RolesSummaryCard
                stakedOra={mockChain.stakedOra}
                availableOra={mockChain.oraBalance}
                stakingRewards={mockChain.stakingRewards}
                onManage={() => setActiveTab('staking')}
              />

              {/* Row 2 order (2026-05-11 R3): NFTs / CC / Fee — Fee moved to the last
                 slot since it's the most reference-y card (read once, then ignore).
                 The active-asset cards (NFTs + Creator Coins) deserve the more
                 prominent left positions in row 2. */}
              <NftKeyHoldingsCard
                ownedKeys={mockChain.ownedKeys}
                ownedNfts={mockChain.ownedNfts}
                fractionalizedNfts={mockChain.fractionalizedNfts}
                onSeeAll={() => setActiveTab('inventory')}
              />

              <CreatorCoinHoldingsCard
                creatorCoins={mockChain.creatorCoins}
                myCoinSymbol={mockChain.creatorCoinSymbol}
                myCoinBalance={mockChain.creatorCoinBalance}
                hasCreatorCoin={mockChain.hasCreatorCoin}
                onSeeAll={() => setActiveTab('coins')}
              />

              <FeeStructureCard />
            </div>

          </TabsContent>

          {/* Staking — dedicated tab (split out from Overview 2026-05-11)
             so the Overview grid stays scannable while Staking gets the room
             it needs (tier selector + my stakes list + role progression). */}
          <TabsContent value="staking" className="mt-6">
            <StakingTab
              stakedOra={stakedOraEffective}
              stakingRewards={mockChain.stakingRewards}
              availableOra={displayedOraBalance}
              stakes={stakesList}
              showStakeModal={showStakeModal}
              setShowStakeModal={setShowStakeModal}
              stakeAmount={stakeAmount}
              setStakeAmount={setStakeAmount}
              stakeTier={stakeTier}
              setStakeTier={setStakeTier}
              stakeError={stakeError}
              setStakeError={setStakeError}
              stakeOverBalance={stakeOverBalance}
              stakeBelowMin={stakeBelowMin}
              stakeAmountNum={stakeAmountNum}
              stakingLoading={stakingLoading}
              handleStake={handleStake}
              handleClaim={handleClaimReward}
              lStake={lStake}
              lUnstake={lUnstake}
              lClaim={lClaim}
              lStakedOra={lStakedOra}
              lPending={lPending}
              lAvailableOra={lAvailableOra}
            />
          </TabsContent>

          {/* Creator Coins — utility view */}
          <TabsContent value="coins" className="mt-6">
            {/* 2026-05-09 R2 — single grid wall (no more own/held split-screen).
                Own coin is visually distinguished by a "Creator" ribbon and
                always sorted to the front. Top summary bar gives portfolio-
                level stats so the page feels dense, not empty. */}
            {(() => {
              const allCoins = mockChain.creatorCoins;
              const ownSym = mockChain.creatorCoinSymbol;
              const sortedCoins = [...allCoins].sort((a, b) => {
                if (a.symbol === ownSym) return -1;
                if (b.symbol === ownSym) return 1;
                return b.amount - a.amount;
              });

              return (
                <div className="space-y-4">
                  {/* Empty / list */}
                  {sortedCoins.length === 0 ? (
                    <div className="rounded-xl border-2 border-dashed border-border/50 bg-secondary/20 p-10 text-center">
                      <div className="text-3xl mb-2">🪙</div>
                      <p className="font-medium text-sm mb-1">No Creator Coins yet</p>
                      <p className="text-xs text-muted-foreground mb-3">
                        Mint your own from Profile, or buy a creator&apos;s coin in Marketplace.
                      </p>
                      <div className="flex items-center justify-center gap-2 text-xs">
                        <button onClick={() => navigate('/profile')} className="font-semibold text-[#7C3AED] hover:underline">Mint yours →</button>
                        <span className="text-muted-foreground/50">·</span>
                        <button onClick={() => navigate('/marketplace')} className="font-semibold text-[#14C8A8] hover:underline">Browse marketplace →</button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {sortedCoins.map(coin => {
                        const isOwn = coin.symbol === ownSym;
                        const reachedTier = [...TIER_BENEFITS]
                          .reverse()
                          .find(tt => coin.amount >= tt.threshold);
                        const redemptions = (extras.creatorCoinRedemptions ?? []).filter(r => r.coinSymbol === coin.symbol);
                        return (
                          <PortfolioCoinCard
                            key={coin.symbol}
                            isOwn={isOwn}
                            symbol={coin.symbol}
                            name={coin.name}
                            logoUrl={coin.logoUrl}
                            amount={coin.amount}
                            price={coin.initialPrice ?? 1}
                            // Own coin: show holders + vesting summary; held coin: show tiers + redeem.
                            ownStats={isOwn ? {
                              holders: extras.myCoinHolders ?? 0,
                              vestingMonth: mockChain.creatorCoinVestingMonth,
                              locked: mockChain.creatorCoinLocked,
                            } : undefined}
                            tiers={!isOwn ? TIER_BENEFITS.map(tt => ({
                              tier: tt.tier,
                              threshold: tt.threshold,
                              perk: tt.perk,
                              color: tt.color,
                              reached: coin.amount >= tt.threshold,
                              isCurrent: reachedTier?.threshold === tt.threshold,
                              redeemed: redemptions.some(r => (r.tierName ?? r.tier) === tt.tier),
                            })) : undefined}
                            onRedeem={!isOwn ? async (tierName) => {
                              try {
                                const tier = TIER_BENEFITS.find(t => t.tier === tierName);
                                await mockChain.redeemCreatorCoinTier(coin.symbol, tierName);
                                showToast('success', 'Redeemed!',
                                  `${tierName} perk on ${coin.symbol}${tier ? ': ' + tier.perk : ''}`);
                              } catch (err: any) {
                                showToast('error', 'Redeem failed', err?.message || 'Unknown error');
                              }
                            } : undefined}
                            onPrimary={() => isOwn
                              ? navigate('/creator-coin')
                              : navigate(`/marketplace/coin/${coin.symbol.replace(/^\$/, '').toLowerCase()}`)}
                            primaryLabel={isOwn ? 'Open Studio' : 'Trade'}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </TabsContent>

          {/* Inventory — NFTs you own + content keys + fractional NFT holdings.
             Moved from StudioHubPage → Wallet (2026-05-11) per Zhuoyu so all
             owned digital assets live next to the wallet balance. */}
          <TabsContent value="inventory" className="mt-6">
            <InventoryTab
              ownedKeys={mockChain.ownedKeys}
              ownedNfts={mockChain.ownedNfts}
              fractionalizedNfts={mockChain.fractionalizedNfts}
              onMintFnft={() => navigate('/studio?tab=inventory&action=mint-fnft')}
            />
          </TabsContent>

          {/* Transaction History */}
          <TabsContent value="history" className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Transaction History</h3>
              <Badge variant="secondary">{mockChain.transactions.length} txns</Badge>
            </div>

            {/* 2/3 list + 1/3 search/filter rail. On mobile they stack. */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* LEFT 2/3 — transactions list. Each row clicks open
                  to reveal the full fee/amount breakdown inline. */}
              <div className="lg:col-span-2">
                {mockChain.transactions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground bg-card border rounded-lg">
                    <History className="w-8 h-8 mx-auto mb-2" />
                    <p>No transactions yet</p>
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground bg-card border rounded-lg">
                    <History className="w-8 h-8 mx-auto mb-2" />
                    <p>No transactions match your filters</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={clearHistoryFilters}
                      className="mt-3"
                    >
                      Clear filters
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredTransactions.map((tx) => {
                      const isOpen = expandedTxId === tx.id;
                      // Prefer the structured breakdown attached to the tx.
                      // Fall back to legacy regex parsing only when missing.
                      const bd = tx.breakdown;
                      const fallbackFee = !bd ? (tx.details?.match(/fee:\s*([\d.]+)\s*ORA/i)?.[1] ?? null) : null;
                      const fallbackGross = !bd ? (tx.details?.match(/for\s*([\d.]+)\s*ORA/i)?.[1] ?? null) : null;
                      return (
                        <div key={tx.id} className="bg-card rounded-lg border overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setExpandedTxId(isOpen ? null : tx.id)}
                            className="w-full text-left p-4 hover:bg-secondary/30 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 min-w-0">
                                {getTransactionIcon(tx.type)}
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">{tx.details}</p>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>{new Date(tx.timestamp).toLocaleString()}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p
                                  className={`font-bold tabular-nums ${
                                    tx.amount > 0
                                      ? 'text-green-600'
                                      : tx.amount < 0
                                        ? 'text-red-600'
                                        : 'text-muted-foreground'
                                  }`}
                                >
                                  {tx.amount > 0 ? '+' : ''}
                                  {tx.amount !== 0 ? tx.amount.toFixed(4) : '—'}{' '}
                                  {tx.amount !== 0 ? 'ORA' : ''}
                                </p>
                              </div>
                            </div>
                          </button>

                          {/* Expanded breakdown panel */}
                          {isOpen && (
                            <div className="px-4 pb-4 pt-2 space-y-3 text-xs border-t bg-secondary/20">
                              <div className="grid grid-cols-2 gap-2 pt-1">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Type</span>
                                  <span className="font-mono">{formatTxType(tx.type)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">When</span>
                                  <span className="font-mono text-[10px]">{new Date(tx.timestamp).toLocaleString()}</span>
                                </div>
                              </div>

                              {/* Structured breakdown items — the canonical source */}
                              {bd && bd.items.length > 0 && (
                                <div className="space-y-1.5 pt-2 border-t">
                                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Line items</p>
                                  {bd.items.map((it, i) => {
                                    const tone = it.tone === 'positive' ? 'text-green-600 dark:text-green-400'
                                      : it.tone === 'negative' ? 'text-rose-600 dark:text-rose-400'
                                      : it.tone === 'muted' ? 'text-muted-foreground'
                                      : 'text-foreground';
                                    return (
                                      <div key={i} className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <p className="font-medium">{it.label}</p>
                                          {it.sub && <p className="text-[10px] text-muted-foreground/80">{it.sub}</p>}
                                        </div>
                                        <span className={`font-mono tabular-nums shrink-0 ${tone}`}>
                                          {it.amount === 0 ? '—' : `${it.amount > 0 ? '+' : ''}${it.amount.toFixed(4)}`}
                                          {it.amount !== 0 && <span className="ml-1 text-[10px] text-muted-foreground">ORA</span>}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Protocol fee 4-way split */}
                              {bd?.fee && (
                                <div className="pt-2 border-t space-y-1.5">
                                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Protocol fee allocation</p>
                                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                    {bd.fee.burn != null && (
                                      <div className="flex justify-between"><span className="text-muted-foreground">🔥 Burn (40%)</span><span className="font-mono">{bd.fee.burn.toFixed(4)} ORA</span></div>
                                    )}
                                    {bd.fee.staking != null && (
                                      <div className="flex justify-between"><span className="text-muted-foreground">📈 Stakers (40%)</span><span className="font-mono">{bd.fee.staking.toFixed(4)} ORA</span></div>
                                    )}
                                    {bd.fee.gasReserve != null && (
                                      <div className="flex justify-between"><span className="text-muted-foreground">⛽ Gas (10%)</span><span className="font-mono">{bd.fee.gasReserve.toFixed(4)} ORA</span></div>
                                    )}
                                    {bd.fee.ops != null && (
                                      <div className="flex justify-between"><span className="text-muted-foreground">🏢 Ops (10%)</span><span className="font-mono">{bd.fee.ops.toFixed(4)} ORA</span></div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Settlement summary */}
                              {bd?.settlement && (
                                <div className="pt-2 border-t flex justify-between font-bold">
                                  <span>{bd.settlement.label}</span>
                                  <span className={`font-mono tabular-nums ${
                                    bd.settlement.tone === 'positive' ? 'text-green-600 dark:text-green-400'
                                    : bd.settlement.tone === 'negative' ? 'text-rose-600 dark:text-rose-400'
                                    : bd.settlement.tone === 'muted' ? 'text-muted-foreground'
                                    : 'text-foreground'
                                  }`}>
                                    {bd.settlement.amount > 0 ? '+' : ''}{bd.settlement.amount.toFixed(4)} ORA
                                  </span>
                                </div>
                              )}

                              {/* Free-form note */}
                              {bd?.note && (
                                <p className="pt-2 border-t text-[11px] text-muted-foreground italic leading-relaxed">
                                  {bd.note}
                                </p>
                              )}

                              {/* Legacy fallback when no structured data */}
                              {!bd && (fallbackGross || fallbackFee) && (
                                <div className="pt-2 border-t space-y-1">
                                  {fallbackGross && (
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Gross</span>
                                      <span className="font-mono">{parseFloat(fallbackGross).toFixed(4)} ORA</span>
                                    </div>
                                  )}
                                  {fallbackFee && (
                                    <div className="flex justify-between text-rose-600 dark:text-rose-400">
                                      <span>− Protocol fee</span>
                                      <span className="font-mono">{parseFloat(fallbackFee).toFixed(4)} ORA</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Always: net + tx hash */}
                              {!bd?.settlement && (
                                <div className="pt-2 border-t flex justify-between font-bold">
                                  <span>Net amount</span>
                                  <span className={`font-mono ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(4)} ORA
                                  </span>
                                </div>
                              )}
                              <div className="pt-2 border-t flex items-center justify-between">
                                <span className="text-muted-foreground">TX hash</span>
                                <a
                                  href={explorerUrl(tx.txHash, network)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono inline-flex items-center gap-1 hover:text-foreground text-aura"
                                >
                                  {tx.txHash.slice(0, 16)}…
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* RIGHT 1/3 — search + filters. Sticky on lg+ so the
                  filters stay visible while scrolling the list. */}
              <aside className="lg:sticky lg:top-24 lg:self-start space-y-3">
                <div className="bg-card border rounded-lg p-3 space-y-3">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Search & filter
                  </div>

                  {/* Type filter */}
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Type
                    </label>
                    <select
                      value={historyTypeFilter}
                      onChange={(e) => setHistoryTypeFilter(e.target.value)}
                      className="mt-1 w-full px-3 py-2 rounded-md border bg-background text-sm"
                    >
                      <option value="all">All types</option>
                      {historyTypeOptions.map((tp) => (
                        <option key={tp} value={tp}>
                          {formatTxType(tp)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date preset */}
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Date range
                    </label>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {([
                        ['all', 'All time'],
                        ['today', 'Today'],
                        ['7d', 'Last 7d'],
                        ['30d', 'Last 30d'],
                        ['custom', 'Custom'],
                      ] as const).map(([key, label]) => (
                        <Button
                          key={key}
                          type="button"
                          size="sm"
                          variant={historyDatePreset === key ? 'default' : 'outline'}
                          onClick={() => {
                            setHistoryDatePreset(key);
                            if (key !== 'custom') {
                              setHistoryDateFrom('');
                              setHistoryDateTo('');
                            }
                          }}
                          className="h-7 px-2.5 text-xs"
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {historyDatePreset === 'custom' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                          From
                        </label>
                        <input
                          type="date"
                          value={historyDateFrom}
                          onChange={(e) => setHistoryDateFrom(e.target.value)}
                          className="mt-1 w-full px-2 py-1.5 rounded-md border bg-background text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                          To
                        </label>
                        <input
                          type="date"
                          value={historyDateTo}
                          onChange={(e) => setHistoryDateTo(e.target.value)}
                          className="mt-1 w-full px-2 py-1.5 rounded-md border bg-background text-xs"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                    <span>
                      <span className="font-semibold text-foreground tabular-nums">{filteredTransactions.length}</span>
                      {' '}of {mockChain.transactions.length}
                    </span>
                    {isHistoryFiltered && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={clearHistoryFilters}
                        className="h-7 text-xs"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </aside>
            </div>
          </TabsContent>
        </Tabs>

        {/* Send Modal */}
        {showSendModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm"
            onClick={() => setShowSendModal(false)}
          >
            <div
              className="bg-background rounded-xl p-6 max-w-md w-full mx-4 border"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-4">Send</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">{lToken}</label>
                  <select
                    value={sendForm.token}
                    onChange={(e) => setSendForm({ ...sendForm, token: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border bg-background"
                  >
                    <option value="ORA">ORA ({mockChain.oraBalance.toFixed(2)})</option>
                    {heldCCs.map((c) => (
                      <option key={c.symbol} value={c.symbol}>
                        {c.symbol} ({c.amount.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Recipient</label>
                  <Input
                    placeholder="Wallet address or @username"
                    value={sendForm.recipient}
                    onChange={(e) => setSendForm({ ...sendForm, recipient: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{lAmount}</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={sendForm.amount}
                    onChange={(e) => {
                      setSendForm({ ...sendForm, amount: e.target.value });
                      setSendError(null);
                    }}
                    className={sendOverBalance ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {(sendError || sendOverBalance) && (
                    <p className="text-xs text-red-500 mt-1">
                      {sendError
                        ? sendError
                        : `Insufficient ${sendBalanceInfo.label} (you have ${sendBalanceInfo.available.toLocaleString(undefined, { maximumFractionDigits: 4 })})`}
                    </p>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {lAvailable}:{' '}
                  {sendForm.token === 'ORA'
                    ? `${mockChain.oraBalance.toFixed(4)} ORA`
                    : `${heldCCs.find((c) => c.symbol === sendForm.token)?.amount.toLocaleString() ?? 0} ${sendForm.token}`}
                </div>

                {/* 2026-04-30: Send is a peer-to-peer transfer. No protocol fee. */}
                <div className="text-xs p-3 rounded-lg border bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400">
                  This is a peer-to-peer transfer.{' '}
                  <span className="font-semibold">No protocol fee</span> — only network gas
                  (paid by the protocol).
                  <div className="text-[10px] text-muted-foreground mt-1">
                    The 5% protocol fee only applies to ORA transactions (tips, purchases,
                    marketplace).
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowSendModal(false);
                      setSendError(null);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSend}
                    disabled={
                      sendLoading ||
                      sendOverBalance ||
                      !Number.isFinite(sendAmountNum) ||
                      sendAmountNum <= 0 ||
                      !sendForm.recipient.trim()
                    }
                    className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 text-white disabled:opacity-50"
                  >
                    {sendLoading ? 'Sending…' : 'Send'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Receive Modal */}
        <ReceiveModal
          address={walletAddress}
          open={showReceive}
          onClose={() => setShowReceive(false)}
        />
      </div>
    </div>
    </ErrorBoundary>
  );
}


// ── PortfolioCoinCard (rebuilt 2026-05-09 R3) ──────────────────────────────
// Marketplace-product style — same dimensions and density as the
// `CoinCard` used on /marketplace (aspect-square cover, big logo, p-4 body,
// price+meta row, progress bar, dual button footer). Layout matrix:
// `grid-cols-1 md:2 lg:3 xl:4 gap-4`.
//
// Two visual variants:
//   - `isOwn=true`  → purple/orange gradient cover, "✨ YOURS" ribbon,
//                     Studio button. Body shows holders / vesting / locked.
//   - `isOwn=false` → cyan/teal gradient cover, "Coin" tag, Trade button.
//                     Body shows tier badges + claimable redeem rows.

interface PortfolioCoinCardProps {
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

function PortfolioCoinCard({
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

// Tiny stat tile inside an own-coin card.
function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary/40 px-2 py-1">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground font-bold">{label}</div>
      <div className="text-xs font-bold tabular-nums">{value}</div>
    </div>
  );
}

// ============================================================================
// Wallet Overview Cards (2026-05-11 rewrite)
//
// All six cards live in the same file as WalletPage so they share lucide imports
// + the existing labels/state plumbing without prop-drilling everything through
// a separate file. Each card is self-contained: identical h-full container,
// gradient accent, header, body. Heights stay aligned thanks to the parent
// grid's `auto-rows-fr`.
// (imports for these helpers are at the top of the file.)
// ============================================================================

// ─── 1. Portfolio ──────────────────────────────────────────────────────────
function PortfolioCard(props: {
  walletAddress: string;
  addrCopied: boolean;
  handleCopyAddress: () => void;
  showBalance: boolean;
  setShowBalance: (v: boolean) => void;
  oraBalance: number;
  solBalance: number;
  ccCount: number;
  txCount: number;
  onSend: () => void;
  onReceive: () => void;
  liveChain?: boolean;
  chainBalanceErr?: string | null;
}) {
  const shortenAddr = (addr: string) => addr ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : '—';
  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-xl p-6 border border-purple-200/50 dark:border-purple-800/50 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/40">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm">🌸</div>
        <span className="text-xs font-mono text-muted-foreground flex-1 truncate">{shortenAddr(props.walletAddress)}</span>
        <button onClick={props.handleCopyAddress} className="p-1 rounded hover:bg-secondary transition-colors" aria-label="Copy address">
          {props.addrCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold">Portfolio</h3>
          {props.liveChain && (
            <span
              title={
                props.chainBalanceErr
                  ? `Live chain (last error: ${props.chainBalanceErr})`
                  : 'Live balance — sourced from the ORA SPL token account on-chain'
              }
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                props.chainBalanceErr
                  ? 'bg-orange-500/10 text-orange-600 border-orange-500/30'
                  : 'bg-green-500/10 text-green-600 border-green-500/30'
              }`}
            >
              <Radio className="w-2.5 h-2.5" />
              {props.chainBalanceErr ? 'LIVE (err)' : 'LIVE'}
            </span>
          )}
        </div>
        <button onClick={() => props.setShowBalance(!props.showBalance)} className="p-1.5 hover:bg-white/10 rounded-full">
          {props.showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      </div>
      <div className="mb-2">
        <div className="text-4xl font-black tabular-nums leading-tight">
          {props.showBalance ? props.oraBalance.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '••••••'} <span className="text-base font-normal text-muted-foreground">ORA</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          ≈ ${props.showBalance ? (props.oraBalance * 0.02).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '••••'} USD
        </div>
      </div>
      <div className="text-xs text-muted-foreground mb-4">
        {props.showBalance ? `${props.solBalance.toFixed(4)} SOL` : '•••• SOL'}
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg bg-background/50 px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground font-bold">CC</div>
          <div className="text-sm font-bold tabular-nums">{props.ccCount}</div>
        </div>
        <div className="rounded-lg bg-background/50 px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground font-bold">Txs</div>
          <div className="text-sm font-bold tabular-nums">{props.txCount}</div>
        </div>
      </div>
      <div className="flex gap-2 mt-auto">
        <Button onClick={props.onSend} className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 text-xs">
          <Send className="w-3.5 h-3.5 mr-1.5" /> Send
        </Button>
        <Button variant="outline" className="flex-1 text-xs" onClick={props.onReceive}>
          <Download className="w-3.5 h-3.5 mr-1.5" /> Receive
        </Button>
      </div>
      {props.liveChain && props.walletAddress && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(props.walletAddress) && (
        <a
          href={`https://explorer.solana.com/address/${props.walletAddress}?cluster=custom&customUrl=${encodeURIComponent('http://127.0.0.1:8899')}`}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2 inline-flex items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          <ExternalLink className="w-3 h-3" /> View on Solana Explorer (localnet)
        </a>
      )}
    </div>
  );
}

// ─── 2. Buy ORA (inline, one-step) ──────────────────────────────────────────
function BuyOraInlineCard() {
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

// ─── 3. Staking (collapsed stakes drawer + role badges) ────────────────────

function RolesSummaryCard(props: {
  stakedOra: number;
  availableOra: number;
  stakingRewards: number;
  onManage: () => void;
}) {
  // Three role tiers gated by stake/hold. The Curator threshold is satisfied by
  // either holding OR staking >= 100 ORA — the rest are stake-only.
  const isCurator = props.availableOra >= 100 || props.stakedOra >= 100;
  const TIERS = [
    { name: 'Curator',   threshold: 100,                  icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/15', desc: 'Curate posts & earn rewards', met: isCurator },
    { name: 'Proposer',  threshold: MIN_PROPOSAL_STAKE,   icon: Vote,        color: 'text-blue-500',    bg: 'bg-blue-500/15',    desc: 'Submit governance proposals', met: props.stakedOra >= MIN_PROPOSAL_STAKE },
    { name: 'Committee', threshold: MIN_NOMINATION_STAKE, icon: Trophy,      color: 'text-amber-500',   bg: 'bg-amber-500/15',   desc: 'Self-nominate to committee', met: props.stakedOra >= MIN_NOMINATION_STAKE },
  ];
  const unlockedCount = TIERS.filter(t => t.met).length;

  return (
    <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl p-6 border border-blue-200/50 dark:border-blue-800/50 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-bold">Roles & Stake</h3>
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">{unlockedCount}/3 unlocked</span>
      </div>

      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-0.5">Total staked</p>
        <div className="text-4xl font-black tabular-nums leading-none">
          {props.stakedOra.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          <span className="text-base font-normal text-muted-foreground ml-1">ORA</span>
        </div>
        {props.stakingRewards > 0 && (
          <p className="text-xs text-green-500 mt-1">+{props.stakingRewards.toFixed(4)} ORA pending</p>
        )}
      </div>

      <div className="space-y-2 mb-4 flex-1">
        {TIERS.map(role => {
          const Icon = role.icon;
          return (
            <div
              key={role.name}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${role.met ? role.bg : 'bg-secondary/30 opacity-70'}`}
              title={role.desc}
            >
              <Icon className={`w-4 h-4 shrink-0 ${role.met ? role.color : 'text-muted-foreground/50'}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold ${role.met ? '' : 'text-muted-foreground'}`}>{role.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{role.desc}</p>
              </div>
              <span className={`text-[10px] font-mono shrink-0 ${role.met ? role.color : 'text-muted-foreground/60'}`}>
                {role.met ? '✓' : `≥ ${role.threshold.toLocaleString()}`}
              </span>
            </div>
          );
        })}
      </div>

      <Button onClick={props.onManage} className="w-full bg-blue-500 hover:bg-blue-600 text-white">
        Manage staking <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
      </Button>
    </div>
  );
}

// Staking Tab (full controls: stake / unstake / claim / my stakes)
function StakingTab(props: {
  stakedOra: number;
  stakingRewards: number;
  availableOra: number;
  stakes: StakeEntry[];
  showStakeModal: 'stake' | 'unstake' | null;
  setShowStakeModal: (v: 'stake' | 'unstake' | null) => void;
  stakeAmount: string;
  setStakeAmount: (v: string) => void;
  stakeTier: number;
  setStakeTier: (v: number) => void;
  stakeError: string | null;
  setStakeError: (v: string | null) => void;
  stakeOverBalance: boolean;
  stakeBelowMin: boolean;
  stakeAmountNum: number;
  stakingLoading: boolean;
  handleStake: () => Promise<void> | void;
  handleClaim: () => Promise<void> | void;
  lStake: string; lUnstake: string; lClaim: string;
  lStakedOra: string; lPending: string; lAvailableOra: string;
}) {
  const isCurator = props.availableOra >= 100 || props.stakedOra >= 100;
  const TIERS = [
    { name: 'Curator',   threshold: 100,                  icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/10', perk: 'Curate posts and earn curation rewards every 24h', met: isCurator },
    { name: 'Proposer',  threshold: MIN_PROPOSAL_STAKE,   icon: Vote,        color: 'text-blue-500',    bg: 'bg-blue-500/10',    perk: 'Submit governance proposals (any committee track)', met: props.stakedOra >= MIN_PROPOSAL_STAKE },
    { name: 'Committee', threshold: MIN_NOMINATION_STAKE, icon: Trophy,      color: 'text-amber-500',   bg: 'bg-amber-500/10',   perk: 'Self-nominate for elected committees (6-month term)', met: props.stakedOra >= MIN_NOMINATION_STAKE },
  ];

  return (
    <div className="space-y-6">
      {/* Top: 3 stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-200/50 dark:border-blue-800/50 p-5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">{props.lStakedOra}</p>
          <div className="text-3xl font-black tabular-nums">{props.stakedOra.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          <p className="text-xs text-muted-foreground mt-1">{BASE_APY}% base APY × lock multiplier</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-200/50 dark:border-green-800/50 p-5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">{props.lPending}</p>
          <div className="text-3xl font-black tabular-nums text-green-500">{props.stakingRewards.toFixed(4)}</div>
          <p className="text-xs text-muted-foreground mt-1">Pending rewards — claim anytime</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-200/50 dark:border-purple-800/50 p-5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">{props.lAvailableOra}</p>
          <div className="text-3xl font-black tabular-nums">{props.availableOra.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          <p className="text-xs text-muted-foreground mt-1">Spendable ORA in your wallet</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => { props.setShowStakeModal('stake'); props.setStakeAmount(''); props.setStakeTier(90); }}
          className="bg-blue-500 hover:bg-blue-600 text-white"
        >
          <Lock className="w-4 h-4 mr-2" /> {props.lStake} ORA
        </Button>
        <Button
          onClick={() => { props.setShowStakeModal('unstake'); props.setStakeAmount(''); }}
          variant="outline"
        >
          <Unlock className="w-4 h-4 mr-2" /> {props.lUnstake} ORA
        </Button>
        <Button
          onClick={() => props.handleClaim()}
          disabled={props.stakingRewards <= 0}
          className="bg-green-500 hover:bg-green-600 text-white disabled:opacity-50"
        >
          <Gift className="w-4 h-4 mr-2" /> {props.lClaim}
        </Button>
      </div>

      {/* Inline stake/unstake form */}
      {props.showStakeModal && (
        <div className="bg-card rounded-xl p-5 border border-border/40">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold">
              {props.showStakeModal === 'stake' ? `${props.lStake} ORA` : `${props.lUnstake} ORA`}
            </h3>
            <button
              onClick={() => { props.setShowStakeModal(null); props.setStakeError(null); }}
              className="p-1 hover:bg-secondary rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {props.showStakeModal === 'stake' && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2">Choose lock period</p>
              <StakingTierSelector value={props.stakeTier} onChange={props.setStakeTier} />
            </div>
          )}
          <Input
            type="number"
            placeholder={props.showStakeModal === 'stake' ? `Min ${MIN_STAKE} ORA` : 'Amount'}
            value={props.stakeAmount}
            onChange={(e) => { props.setStakeAmount(e.target.value); props.setStakeError(null); }}
            className={`mb-1 ${props.stakeOverBalance || props.stakeBelowMin ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
          />
          {(props.stakeError || props.stakeOverBalance || props.stakeBelowMin) && (
            <p className="text-xs text-red-500 mb-3">
              {props.stakeError
                ? props.stakeError
                : props.stakeBelowMin
                  ? `Minimum stake is ${MIN_STAKE} ORA`
                  : props.showStakeModal === 'stake'
                    ? `Insufficient balance (you have ${props.availableOra.toFixed(4)} ORA)`
                    : `Cannot unstake more than staked (${props.stakedOra.toFixed(4)} ORA)`}
            </p>
          )}
          {!props.stakeError && !props.stakeOverBalance && !props.stakeBelowMin && <div className="mb-3" />}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { props.setShowStakeModal(null); props.setStakeError(null); }} className="flex-1">Cancel</Button>
            <Button
              onClick={() => props.handleStake()}
              disabled={props.stakingLoading || props.stakeOverBalance || props.stakeBelowMin || !Number.isFinite(props.stakeAmountNum) || props.stakeAmountNum <= 0}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50"
            >
              {props.stakingLoading ? 'Processing...' : props.showStakeModal === 'stake' ? props.lStake : props.lUnstake}
            </Button>
          </div>
        </div>
      )}

      {/* Role progression */}
      <section>
        <h2 className="text-base font-bold inline-flex items-center gap-2 mb-3">
          <Award className="w-4 h-4 text-amber-500" />
          Role progression
        </h2>
        <div className="space-y-3">
          {TIERS.map(role => {
            const Icon = role.icon;
            const progress = Math.min(100, (props.stakedOra / role.threshold) * 100);
            return (
              <div key={role.name} className="rounded-xl border bg-card p-4 border-border/40">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${role.bg}`}>
                    <Icon className={`w-5 h-5 ${role.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm">{role.name}</h3>
                      {role.met && (
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${role.color} ${role.bg} px-1.5 py-0.5 rounded`}>Unlocked</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{role.perk}</p>
                  </div>
                  <span className="text-xs font-mono tabular-nums shrink-0 text-muted-foreground">
                    {props.stakedOra.toLocaleString(undefined, { maximumFractionDigits: 0 })} / {role.threshold.toLocaleString()}
                  </span>
                </div>
                {!role.met && (
                  <div className="w-full h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                    <div className={`h-full transition-all ${role.color.replace('text-', 'bg-')}`} style={{ width: `${progress}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* My stakes */}
      <section>
        <h2 className="text-base font-bold inline-flex items-center gap-2 mb-3">
          <Lock className="w-4 h-4 text-blue-500" />
          My stakes ({props.stakes.length})
        </h2>
        {props.stakes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/40 bg-secondary/20 p-6 text-center">
            <Lock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No stakes yet.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Stake ORA above to unlock roles and earn rewards.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {props.stakes.map(s => {
              const locked = Date.now() < s.unlocksAt;
              const remaining = Math.max(0, s.unlocksAt - Date.now());
              const days = Math.ceil(remaining / 86400000);
              const elapsed = Math.max(0, Date.now() - s.startedAt);
              const totalDuration = s.unlocksAt - s.startedAt;
              const pct = totalDuration > 0 ? Math.min(100, (elapsed / totalDuration) * 100) : 100;
              return (
                <div key={s.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-xl font-black tabular-nums">{s.amount.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">ORA</span></span>
                    <span className={`text-xs font-bold ${locked ? 'text-orange-500' : 'text-green-500'}`}>
                      {locked ? `${days}d left` : 'Unlocked ✓'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2">
                    <span>{s.lockDays}-day lock</span>
                    <span>·</span>
                    <span>{s.multiplier}× multiplier</span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-secondary/60 overflow-hidden">
                    <div className={`h-full ${locked ? 'bg-orange-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── 4. Protocol fee structure ──────────────────────────────────────────────
function FeeStructureCard() {
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

// ─── 5. NFT + Content key holdings summary ─────────────────────────────────
function NftKeyHoldingsCard(props: {
  ownedKeys: OwnedKey[];
  ownedNfts: OwnedNft[];
  fractionalizedNfts: FractionalizedNft[];
  onSeeAll: () => void;
}) {
  const ownedFnfts = props.fractionalizedNfts.filter(f => f.ownedFragments > 0);
  const totalFragments = ownedFnfts.reduce((s, f) => s + f.ownedFragments, 0);
  const totalKeysValue = props.ownedKeys.reduce((s, k) => s + k.price, 0);
  const totalNftSpend = props.ownedNfts.reduce((s, n) => s + n.pricePaid, 0);

  return (
    <div className="bg-gradient-to-br from-indigo-500/10 to-violet-500/10 rounded-xl p-6 border border-indigo-200/50 dark:border-indigo-800/50 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-500" />
          <h3 className="text-lg font-bold">Owned Assets</h3>
        </div>
        <button onClick={props.onSeeAll} className="text-[11px] text-indigo-500 hover:underline inline-flex items-center gap-0.5">
          See all <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg bg-background/50 p-3">
          <div className="flex items-center gap-1 mb-0.5">
            <Sparkles className="w-3 h-3 text-pink-500" />
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-bold">NFTs</p>
          </div>
          <div className="text-xl font-bold tabular-nums">{props.ownedNfts.length}</div>
          <div className="text-[10px] text-muted-foreground">{totalNftSpend.toFixed(0)} ORA</div>
        </div>
        <div className="rounded-lg bg-background/50 p-3">
          <div className="flex items-center gap-1 mb-0.5">
            <Key className="w-3 h-3 text-indigo-500" />
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-bold">Keys</p>
          </div>
          <div className="text-xl font-bold tabular-nums">{props.ownedKeys.length}</div>
          <div className="text-[10px] text-muted-foreground">{totalKeysValue.toFixed(0)} ORA</div>
        </div>
        <div className="rounded-lg bg-background/50 p-3">
          <div className="flex items-center gap-1 mb-0.5">
            <Layers className="w-3 h-3 text-violet-500" />
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-bold">Fragments</p>
          </div>
          <div className="text-xl font-bold tabular-nums">{totalFragments}</div>
          <div className="text-[10px] text-muted-foreground">{ownedFnfts.length} NFT{ownedFnfts.length === 1 ? '' : 's'}</div>
        </div>
      </div>

      {/* Recent holdings preview — unified list across the 3 asset types */}
      <div className="flex-1 min-h-0">
        {props.ownedKeys.length === 0 && ownedFnfts.length === 0 && props.ownedNfts.length === 0 ? (
          <div className="rounded-lg bg-background/30 border border-dashed border-border/50 p-4 text-center">
            <Sparkles className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No NFTs, keys, or fragments yet.</p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">Buy on the marketplace to fill this up.</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {props.ownedNfts.slice(0, 4).map(n => (
              <div key={n.nftId} className="flex items-center gap-2 rounded-md bg-background/40 px-2.5 py-2">
                <Sparkles className="w-3 h-3 text-pink-500 shrink-0" />
                <span className="text-[11px] font-medium flex-1 truncate">{n.name}</span>
                <span className="text-[9px] uppercase text-muted-foreground/70 font-mono">{n.acquisitionType}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{n.pricePaid.toFixed(0)} ORA</span>
              </div>
            ))}
            {props.ownedKeys.slice(0, 3).map(k => (
              <div key={k.keyId} className="flex items-center gap-2 rounded-md bg-background/40 px-2.5 py-2">
                <Key className="w-3 h-3 text-indigo-500 shrink-0" />
                <span className="text-[11px] font-medium flex-1 truncate">{k.title}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{k.price.toFixed(2)}</span>
              </div>
            ))}
            {ownedFnfts.slice(0, 3).map(f => (
              <div key={f.id} className="flex items-center gap-2 rounded-md bg-background/40 px-2.5 py-2">
                <Layers className="w-3 h-3 text-violet-500 shrink-0" />
                <span className="text-[11px] font-medium flex-1 truncate">{f.title}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{f.ownedFragments}f</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 6. Creator Coin holdings summary ───────────────────────────────────────
function CreatorCoinHoldingsCard(props: {
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

// ─── Inventory Tab (moved from StudioHubPage) ──────────────────────────────
function InventoryTab(props: {
  ownedKeys: OwnedKey[];
  ownedNfts: OwnedNft[];
  fractionalizedNfts: FractionalizedNft[];
  onMintFnft: () => void;
}) {
  const navigate = useNavigate();
  const ownedFnfts = props.fractionalizedNfts.filter(f => f.ownedFragments > 0);
  // Friendly label per acquisition type for the NFT cards.
  const ACQ_LABEL: Record<OwnedNft['acquisitionType'], string> = {
    auction: 'Auction win',
    fixed: 'Direct buy',
    mystery: 'Mystery box',
  };
  const ACQ_COLOR: Record<OwnedNft['acquisitionType'], string> = {
    auction: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    fixed: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    mystery: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  };

  return (
    <div className="space-y-6">
      {/* Section 0: Full NFTs (auction wins / fixed buys / mystery reveals).
         These are the non-fractional NFTs minted on-chain to the user. */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold inline-flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-pink-500" />
            NFTs
            <span className="text-xs text-muted-foreground font-normal">({props.ownedNfts.length})</span>
          </h2>
        </div>
        {props.ownedNfts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/40 bg-secondary/20 p-6 text-center">
            <Sparkles className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No NFTs owned yet.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Win at auction, buy on fixed price, or open a mystery box on the marketplace.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {props.ownedNfts.map(n => (
              <button
                key={n.nftId}
                onClick={() => navigate(`/marketplace/nft/${n.nftId}`)}
                className="text-left rounded-xl border bg-card hover:border-pink-500/40 hover:shadow-sm transition-all overflow-hidden"
              >
                <div className="aspect-square bg-gradient-to-br from-pink-500/15 to-purple-500/15 flex items-center justify-center text-5xl relative overflow-hidden">
                  {n.coverImage ? (
                    <img src={n.coverImage} alt={n.name} className="w-full h-full object-cover" />
                  ) : (
                    <span>{n.coverEmoji ?? '🎨'}</span>
                  )}
                  <span className={`absolute top-2 left-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${ACQ_COLOR[n.acquisitionType]}`}>
                    {ACQ_LABEL[n.acquisitionType]}
                  </span>
                </div>
                <div className="p-3 space-y-1">
                  <p className="text-sm font-semibold truncate">{n.name}</p>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Paid</span>
                    <span className="font-mono font-bold">{n.pricePaid.toFixed(2)} ORA</span>
                  </div>
                  <p className="text-[9px] text-muted-foreground">
                    {new Date(n.acquiredAt).toLocaleDateString()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Section 1: Content Keys */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold inline-flex items-center gap-2">
            <Key className="w-4 h-4 text-indigo-500" />
            Content Keys
            <span className="text-xs text-muted-foreground font-normal">({props.ownedKeys.length})</span>
          </h2>
        </div>
        {props.ownedKeys.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/40 bg-secondary/20 p-6 text-center">
            <Key className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No content keys purchased yet.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Buy keys to unlock premium content from creators.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {props.ownedKeys.map(k => (
              <button
                key={k.keyId}
                onClick={() => navigate(`/post/${k.contentId}`)}
                className="text-left rounded-xl border bg-card hover:border-indigo-500/40 hover:shadow-sm transition-all p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Key className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-mono text-muted-foreground truncate">{k.keyId.slice(0, 8)}…</span>
                </div>
                <p className="font-semibold text-sm truncate mb-2">{k.title}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="font-mono font-bold">{k.price.toFixed(2)} ORA</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Fractional NFTs */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold inline-flex items-center gap-2">
            <Layers className="w-4 h-4 text-violet-500" />
            Fractional NFTs
            <span className="text-xs text-muted-foreground font-normal">({ownedFnfts.length} owned / {props.fractionalizedNfts.length} total on platform)</span>
          </h2>
          <button onClick={props.onMintFnft} className="text-xs text-aura font-semibold hover:underline">
            Mint new →
          </button>
        </div>
        {ownedFnfts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/40 bg-secondary/20 p-6 text-center">
            <Layers className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">You don't own any NFT fragments yet.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Buy fragments on the marketplace or mint your own NFT.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {ownedFnfts.map(f => {
              const sold = f.totalFragments - f.ownedFragments;
              const ownPct = f.totalFragments > 0 ? (f.ownedFragments / f.totalFragments) * 100 : 0;
              return (
                <button
                  key={f.id}
                  onClick={() => navigate(`/marketplace/fraction/${f.id}`)}
                  className="text-left rounded-xl border bg-card hover:border-violet-500/40 hover:shadow-sm transition-all overflow-hidden"
                >
                  <div className="aspect-square bg-gradient-to-br from-violet-500/15 to-indigo-500/15 flex items-center justify-center text-5xl">
                    {f.coverImage ? <img src={f.coverImage} alt={f.title} className="w-full h-full object-cover" /> : <span>{f.coverEmoji}</span>}
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="text-sm font-semibold truncate">{f.title}</p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{f.ownedFragments} of {f.totalFragments}</span>
                      <span className="text-violet-500 font-bold">{ownPct.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-1 rounded-full bg-secondary/60 overflow-hidden">
                      <div className="h-full bg-violet-500" style={{ width: `${ownPct}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Value ≈ <span className="font-mono">{(f.ownedFragments * f.pricePerFragment).toFixed(2)} ORA</span>
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <p className="text-[11px] text-muted-foreground italic px-1">
        More inventory types — sponsored ad slots, remix licenses, subscription NFTs — land in v0.9.
      </p>
    </div>
  );
}
