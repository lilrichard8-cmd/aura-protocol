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
import FirstVisitTooltip from '@/components/Tooltip/FirstVisitTooltip';
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

// 2026-05-20 P-1 split: subcomponents extracted out of this file.
import PortfolioCard from './components/PortfolioCard';
import BuyOraInlineCard from './components/BuyOraInlineCard';
import RolesSummaryCard from './components/RolesSummaryCard';
import StakingTab from './components/StakingTab';
import FeeStructureCard from './components/FeeStructureCard';
import NftKeyHoldingsCard from './components/NftKeyHoldingsCard';
import CreatorCoinHoldingsCard from './components/CreatorCoinHoldingsCard';
import InventoryTab from './components/InventoryTab';
import PortfolioCoinCard from './components/PortfolioCoinCard';

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
      <FirstVisitTooltip
        id="wallet-staking"
        target='[data-tour-id="wallet-staking-tab"]'
        title="质押 ORA 赚收益"
        body="锁仓 30-365 天换动态 APY，仓越长 APY 越高。同时获得反平台治理权。"
        placement="bottom"
        showAfterMs={700}
      />
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
            <TabsTrigger value="staking" data-tour-id="wallet-staking-tab">
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
