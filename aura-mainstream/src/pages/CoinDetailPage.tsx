import { useState, useEffect } from 'react';
import FeeBreakdown from '@/components/common/FeeBreakdown';
import TransactionSuccess from '@/components/common/TransactionSuccess';
import { useParams, useNavigate } from 'react-router-dom';
import { useGoBack } from '@/hooks/useGoBack';
import UserAvatar from '@/components/UserAvatar';
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Users, BarChart3, ShoppingCart, Image, Clock, Plus, Minus, FileText, Tag, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/context/ToastContext';
import { useOraGuard } from '@/hooks/useOraGuard';
import { useI18n } from '@/context/I18nContext';
import { useMockChain } from '@/context/MockChainContext';
import { useAuth } from '@/context/AuthContext';
import { useUserPosts } from '@/hooks/useUserPosts';
import { useCreatorCoinContract } from '@/hooks/useCreatorCoinContract';
import { useCreatorCoinRedemption } from '@/hooks/useCreatorCoinRedemption';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import BatchUnlockCeremony from '@/components/coin/BatchUnlockCeremony';
import BatchPricingPlan from '@/components/coin/BatchPricingPlan';
import RedeemConfirmDialog from '@/components/coin/RedeemConfirmDialog';
import GiftCoinDialog from '@/components/coin/GiftCoinDialog';
import { users, iris, posts as allPosts } from '@/data/mock';

function timeAgo(ts: number): string {
  const sec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

interface PricePoint {
  time: string;
  price: number;
  volume: number;
}

interface Holder {
  id: string;
  name: string;
  avatar: string;
  username: string;
  amount: number;
  percentage: number;
}

interface Transaction {
  id: string;
  type: 'buy' | 'sell';
  user: {
    name: string;
    avatar: string;
    username: string;
  };
  amount: number;
  price: number;
  total: number;
  time: string;
}

interface CreatorContent {
  id: string;
  title: string;
  thumbnail: string;
  type: 'photo' | 'video';
  likes: number;
  createdAt: string;
}

interface CoinData {
  id: string;
  name: string;
  symbol: string;
  creator: {
    name: string;
    avatar: string;
    username: string;
    followers: number;
    bio: string;
  };
  currentPrice: number;
  change24h: number;
  circulating: number;
  totalSupply: number;
  volume24h: number;
  holders: Holder[];
  transactions: Transaction[];
  recentContent: CreatorContent[];
  priceHistory: PricePoint[];
}

export default function CoinDetailPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const goBack = useGoBack('/marketplace');
  const { showToast } = useToast();
  const mockChain = useMockChain();
  const oraGuard = useOraGuard();
  const { user: authUser } = useAuth();
  // Real-chain bridge — only fires when VITE_CREATOR_COIN_REAL_CHAIN=true.
  // When disabled, `onChain.enabled` is false and all real-chain branches
  // are skipped; mock chain remains authoritative for the UI.
  const onChain = useCreatorCoinContract();
  // 2026-05-19 — dedicated redemption facade. Same feature flag as
  // useCreatorCoinContract so they enable/disable in lockstep.
  const redemptionChain = useCreatorCoinRedemption();
  const { publicKey: walletPublicKey } = useWallet();
  // 2026-05-11: Own-coin detail page needs to surface the user's freshly-
  // published posts. CreatePage writes to localStorage `aura_user_posts`,
  // and `useUserPosts` hydrates that stream into canonical Post objects.
  const myUserPosts = useUserPosts(authUser);
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [isTrading, setIsTrading] = useState(false);
  const [showFeeConfirm, setShowFeeConfirm] = useState(false);
  // Top Holders “Show all” toggle. Default = collapsed (top 5 only).
  const [showAllHolders, setShowAllHolders] = useState(false);
  const [showTradeSuccess, setShowTradeSuccess] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showBatchUnlock, setShowBatchUnlock] = useState(false);
  const [showBatchPlan, setShowBatchPlan] = useState(false);
  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false);
  const [redeemTarget, setRedeemTarget] = useState<{ id: string; title: string; description: string; threshold: number } | null>(null);
  const [giftDialogOpen, setGiftDialogOpen] = useState(false);
  const [orderType, setOrderType] = useState<'sell' | 'buy'>('sell');
  const [orderAmount, setOrderAmount] = useState('');
  const [orderPrice, setOrderPrice] = useState('');
  const [orderDesc, setOrderDesc] = useState('');

  interface OrderPost {
    id: string;
    type: 'sell' | 'buy';
    user: { name: string; avatar: string; username: string };
    amount: number;
    price: number;
    description: string;
    time: string;
    // On-chain order PDA + signer pubkeys. Populated when the order was
    // placed via the real-chain path so cancel/fill can call the SDK.
    onChainOrder?: string;
    onChainCreator?: string;
    onChainMaker?: string;
  }

  // Pre-seeded mock orders only for legacy demo coins; user's own freshly-minted coin starts empty.
  const ownSymbolUpperInit = (mockChain.creatorCoinSymbol || '').replace(/^\$/, '').toUpperCase();
  const isOwnCoinInit = !!ownSymbolUpperInit && (id?.toUpperCase() === ownSymbolUpperInit);
  const [orders, setOrders] = useState<OrderPost[]>(() => {
    if (isOwnCoinInit) return [];
    // Iris's coin gets a curated order book scaled to her current price (~4.20 ORA).
    // Order book is the secondary market between holders.
    // Primary issuance (direct from creator) is handled by the Buy form above.
    return [];
  });

  const handlePostOrder = async () => {
    if (!orderAmount || !orderPrice) {
      showToast('error', t.orders.fillRequired);
      return;
    }
    const amt = parseFloat(orderAmount);
    const px = parseFloat(orderPrice);
    if (!Number.isFinite(amt) || amt <= 0 || !Number.isFinite(px) || px <= 0) {
      showToast('error', 'Amount and price must be positive numbers.');
      return;
    }
    // Validate against real protocol balances — you can't list what you don't have.
    if (orderType === 'sell') {
      const heldAmount = isOwnCoin
        ? (mockChain.creatorCoinBalance ?? 0)
        : (mockChain.creatorCoins.find(c => c.symbol === '$' + coinData.symbol || c.symbol === coinData.symbol)?.amount ?? 0);
      if (amt > heldAmount) {
        showToast('error', `You only hold ${heldAmount.toFixed(2)} ${coinData.symbol} — can't list ${amt} for sale.`);
        return;
      }
    } else {
      // Buy order: ORA must back the full notional (price × amount).
      // Funneled through oraGuard so the user gets a Buy ORA CTA when short.
      const totalOra = amt * px;
      if (!oraGuard.ensure(totalOra, `Buy ${coinData.symbol}`)) return;
    }
    // Lock CC into escrow when listing a sell order — you can't double-spend.
    const fullSym = '$' + coinData.symbol;
    if (orderType === 'sell') {
      try {
        mockChain.reserveSellOrder(fullSym, amt);
      } catch (err: any) {
        showToast('error', err.message || 'Failed to escrow coins');
        return;
      }
    }
    // Real-chain mirror: best-effort. The page state still tracks the
    // mock book; the on-chain order id surfaces via the toast for now.
    let placedOrderPda: string | undefined;
    let placedOrderCreator: string | undefined;
    let placedOrderMaker: string | undefined;
    if (onChain.enabled && onChain.module && walletPublicKey) {
      try {
        const creatorPk = resolveCreatorPubkey();
        if (creatorPk) {
          if (orderType === 'sell') {
            const res = await onChain.placeSellOrder({ creator: creatorPk, amount: amt, pricePerCoin: px });
            if (res.success && res.order) {
              placedOrderPda = res.order.toBase58();
              placedOrderCreator = creatorPk.toBase58();
              placedOrderMaker = walletPublicKey.toBase58();
            } else if (!res.success) {
              showToast('error', res.error || 'On-chain sell order failed');
            }
          }
          // Buy-side orders are not modeled as on-chain orders in the
          // creator-coin program — they're handled off-chain via the order
          // book UI. So we deliberately skip the chain call here.
        }
      } catch (err: any) {
        showToast('error', err.message || 'On-chain order error');
      }
    }
    const newOrder: OrderPost = {
      id: `o${Date.now()}`,
      type: orderType,
      user: {
        name: authUser?.displayName || 'You',
        avatar: authUser?.avatar || '/judge-avatar.jpg',
        username: authUser?.username || 'me',
      },
      amount: amt,
      price: px,
      description: orderDesc || (orderType === 'sell' ? t.orders.sell : t.orders.buy),
      time: t.coin.justNow,
      onChainOrder: placedOrderPda,
      onChainCreator: placedOrderCreator,
      onChainMaker: placedOrderMaker,
    };
    setOrders(prev => [newOrder, ...prev]);
    setOrderAmount('');
    setOrderPrice('');
    setOrderDesc('');
    setShowOrderForm(false);
    showToast('success', orderType === 'sell' ? `🔒 ${amt} ${coinData.symbol} escrowed — sell order live` : t.orders.postSuccess);

    // 2026-05-11 R15: removed the four hard-coded fake user names
    // ('Akira Tanaka', 'Lila Roman', 'Marcus Chen', 'Sophie Wang' with
    // unsplash avatars) that simulated the order-book counterparty.
    // Now the auto-fill counterparty is an explicit "Anonymous trader"
    // (no fabricated identity / avatar) so users aren't misled into
    // thinking real people are trading their coin.
    if (isOwnCoin) {
      const matcher = {
        id: 'anon-' + Math.random().toString(36).slice(2, 8),
        name: 'Anonymous trader',
        username: 'anon',
        avatar: '', // forces UserAvatar gradient fallback
      };
      const fillAmount = newOrder.amount;
      const fillPrice = newOrder.price;
      setTimeout(() => {
        if (newOrder.type === 'sell') {
          // CC was already deducted at list time — only settle ORA proceeds.
          mockChain.fillExternalSellOrder(fullSym, fillAmount, fillPrice, matcher);
          showToast('success', `💰 ${matcher.name} filled your sell order — ${fillAmount} ${coinData.symbol} sold!`);
        } else {
          mockChain.simulateExternalCoinSellToMe(coinData.symbol, fillAmount, fillPrice, matcher);
          showToast('success', `📦 ${matcher.name} filled your buy order — you bought ${fillAmount} ${coinData.symbol}!`);
        }
        setOrders(prev => prev.filter(o => o.id !== newOrder.id));
      }, 3500);
    }
  };

  const handleCancelOrder = async (order: OrderPost) => {
    if (order.type === 'sell') {
      mockChain.releaseSellOrder('$' + coinData.symbol, order.amount);
      showToast('success', `↩️ Cancelled — ${order.amount} ${coinData.symbol} returned to your wallet.`);
    } else {
      showToast('success', 'Buy order cancelled.');
    }
    setOrders(prev => prev.filter(o => o.id !== order.id));
    // Real-chain mirror — fires only when we recorded the PDA at placement.
    if (onChain.enabled && onChain.module && order.type === 'sell' && order.onChainOrder && order.onChainCreator) {
      try {
        const res = await onChain.cancelOrder({
          creator: new PublicKey(order.onChainCreator),
          order: new PublicKey(order.onChainOrder),
        });
        if (!res.success) {
          showToast('error', res.error || 'On-chain cancel failed');
        } else {
          showToast('success', `Chain cancel: ${res.signature.slice(0, 8)}…`);
        }
      } catch (err: any) {
        showToast('error', err.message || 'On-chain cancel threw');
      }
    }
  };

  const handleTakeOrder = async (order: OrderPost) => {
    const action = order.type === 'sell' ? t.orders.buy : t.orders.sell;
    showToast('success', `${t.orders.orderTaken} ${action} ${order.amount} ${coinData.symbol} @ ${order.price} ORA`);
    setOrders(prev => prev.filter(o => o.id !== order.id));
    // Real-chain mirror — fires when the order was placed via the chain and
    // we have both the order PDA and the seller (maker) wallet recorded.
    if (onChain.enabled && onChain.module && order.type === 'sell'
        && order.onChainOrder && order.onChainCreator && order.onChainMaker) {
      try {
        const res = await onChain.fillOrder({
          creator: new PublicKey(order.onChainCreator),
          order: new PublicKey(order.onChainOrder),
          seller: new PublicKey(order.onChainMaker),
          fillAmount: order.amount,
        });
        if (!res.success) {
          showToast('error', res.error || 'On-chain fill failed');
        } else {
          showToast('success', `Chain fill: ${res.signature.slice(0, 8)}…`);
        }
      } catch (err: any) {
        showToast('error', err.message || 'On-chain fill threw');
      }
    }
  };

  // Resolve the creator's Solana pubkey for chain calls. For the user's own
  // coin this is the connected wallet; for foreign coins we look it up from
  // matchedUser.walletAddress (when populated). Returns null when unknown,
  // which causes the real-chain branch to silently skip.
  const resolveCreatorPubkey = (): PublicKey | null => {
    try {
      if (isOwnCoinInit) return walletPublicKey ?? null;
      const addr = (matchedUser as any)?.walletAddress as string | undefined;
      if (addr) return new PublicKey(addr);
      return null;
    } catch {
      return null;
    }
  };

  // Mock data - in real app this would be fetched
  // Detect if this URL points to the current user's own minted coin.
  // /marketplace/coin/judge → matches mockChain.creatorCoinSymbol = '$JUDGE'
  const ownSymbolUpper = ownSymbolUpperInit;
  const isOwnCoin = isOwnCoinInit;
  const ownCoinName = mockChain.creatorCoins.find(c => c.symbol === mockChain.creatorCoinSymbol)?.name || 'My Creator Coin';

  // Iris auto-buy: triggers when the creator first lands on their own coin detail page.
  // The natural guard is `ownCoinHolders` — once Iris is in there, the effect won't fire again.
  // Note: don't use useRef as a fire-once guard — React 18 StrictMode mounts the effect twice
  // and ref state survives the unmount, which would trap the timer.
  useEffect(() => {
    if (!isOwnCoin) return;
    const symbol = mockChain.creatorCoinSymbol || '';
    if (!symbol) return;
    const alreadyBought = mockChain.ownCoinHolders.some(h => h.id === 'iris');
    if (alreadyBought) return;
    const myCoin = mockChain.creatorCoins.find(c => c.symbol === symbol);
    const price = myCoin?.initialPrice ?? 1.00;
    const amount = 50;
    const timer = setTimeout(() => {
      mockChain.simulateExternalCoinBuy(symbol, amount, price, {
        id: 'iris',
        name: 'Iris 🌸',
        username: 'iris',
        avatar: '/iris-avatar.jpg',
      });
      showToast('success', `🌸 Iris just bought ${amount} ${symbol} — your first holder!`);
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwnCoin, mockChain.creatorCoinSymbol, mockChain.ownCoinHolders.length]);

  // For non-own coins, look up the matching user (Iris or any mock creator) by URL id.
  // Falls back to a Maya Chen placeholder if no match.
  const matchedUser = !isOwnCoin
    ? [iris, ...users].find(u => u.id === id || u.username === id || u.creatorCoin?.symbol.replace(/^\$/, '').toLowerCase() === (id || '').toLowerCase())
    : null;

  const coinData: CoinData = {
    id: id || 'creator-1',
    name: isOwnCoin ? ownCoinName : (matchedUser?.displayName || 'Maya Chen'),
    symbol: isOwnCoin
      ? ownSymbolUpper
      : (matchedUser?.creatorCoin?.symbol.replace(/^\$/, '') || 'MAYA'),
    creator: isOwnCoin ? {
      name: ownCoinName,
      avatar: authUser?.avatar || '/judge-avatar.jpg',
      username: 'colosseum_judge',
      followers: 100,
      bio: 'Your freshly minted Creator Coin — 100% utility, 0% securities. Welcome to AURA.'
    } : {
      name: matchedUser?.displayName || 'Unknown Creator',
      avatar: matchedUser?.avatar || '',
      username: matchedUser?.username || 'unknown',
      followers: matchedUser?.followers || 0,
      bio: matchedUser?.bio || '',
    },
    currentPrice: isOwnCoin ? (() => {
      const lastTrade = mockChain.ownCoinTrades[0];
      if (lastTrade) return lastTrade.price;
      return mockChain.creatorCoins.find(c => c.symbol === mockChain.creatorCoinSymbol)?.initialPrice ?? 1.00;
    })() : (matchedUser?.creatorCoin?.initialPrice ?? 1.0),
    change24h: isOwnCoin ? (() => {
      const initial = mockChain.creatorCoins.find(c => c.symbol === mockChain.creatorCoinSymbol)?.initialPrice ?? 1.00;
      const last = mockChain.ownCoinTrades[0]?.price ?? initial;
      return initial > 0 ? parseFloat((((last - initial) / initial) * 100).toFixed(2)) : 0;
    })() : 0, // no historical price tracking for foreign coins yet
    circulating: isOwnCoin
      ? ((mockChain.creatorCoinBalance || 2000) + mockChain.ownCoinHolders.reduce((s, h) => s + h.amount, 0))
      : (() => {
          // Foreign coin: circulating (in wallets) = creator's remaining + local user's holdings
          // (including any CC currently locked in open sell orders).
          // Vesting-locked tokens (8,000) are NOT counted.
          const sym = matchedUser?.creatorCoin?.symbol;
          if (!sym) return 0;
          const remaining = mockChain.foreignCoinPrimaryRemaining[sym] ?? 0;
          const userHold = mockChain.creatorCoins.find(c => c.symbol === sym);
          const localTotal = (userHold?.amount ?? 0) + (userHold?.reservedAmount ?? 0);
          return remaining + localTotal;
        })(),
    totalSupply: 10000,
    volume24h: isOwnCoin
      ? (() => {
          const cutoff = Date.now() - 24 * 60 * 60 * 1000;
          return mockChain.ownCoinTrades
            .filter(t => (t.timestamp ?? 0) >= cutoff)
            .reduce((s, t) => s + (t.amount || 0), 0);
        })()
      : 0,
    holders: isOwnCoin ? (() => {
      const selfAmount = mockChain.creatorCoinBalance || 2000;
      const externalTotal = mockChain.ownCoinHolders.reduce((s, h) => s + h.amount, 0);
      const total = selfAmount + externalTotal || 1;
      const myCoin = mockChain.creatorCoins.find(c => c.symbol === mockChain.creatorCoinSymbol);
      const self = {
        id: 'creator-self',
        name: ownCoinName,
        avatar: myCoin?.logoUrl || authUser?.avatar || '/judge-avatar.jpg',
        username: 'colosseum_judge',
        amount: selfAmount,
        percentage: parseFloat(((selfAmount / total) * 100).toFixed(2)),
      };
      const others = mockChain.ownCoinHolders.map(h => ({
        id: h.id,
        name: h.name,
        avatar: h.avatar,
        username: h.username,
        amount: h.amount,
        percentage: parseFloat(((h.amount / total) * 100).toFixed(2)),
      }));
      return [self, ...others];
    })() : (() => {
      // Non-own coin: derive from real protocol state (no mock 10,000-judgeHolding fiction).
      // Creator's actual wallet balance = remaining in her initial unlocked batch (2,000 − sold).
      // Local user's total ownership includes both spendable and escrowed (reserved) amounts.
      if (!matchedUser) return [];
      const sym = matchedUser.creatorCoin?.symbol || ('$' + (id || '').toUpperCase());
      const userHold = mockChain.creatorCoins.find(c => c.symbol.toUpperCase() === sym.toUpperCase());
      const judgeHolding = (userHold?.amount ?? 0) + (userHold?.reservedAmount ?? 0);
      const creatorBalance = mockChain.foreignCoinPrimaryRemaining[sym] ?? 0;
      const total = creatorBalance + judgeHolding || 1;
      const list = [
        {
          id: matchedUser.id,
          name: matchedUser.displayName,
          avatar: matchedUser.avatar,
          username: matchedUser.username,
          amount: creatorBalance,
          percentage: parseFloat(((creatorBalance / total) * 100).toFixed(2)),
        },
      ];
      if (judgeHolding > 0) {
        list.push({
          id: 'judge-self',
          name: 'You (Colosseum Judge)',
          avatar: authUser?.avatar || '/judge-avatar.jpg',
          username: 'colosseum_judge',
          amount: judgeHolding,
          percentage: parseFloat(((judgeHolding / total) * 100).toFixed(2)),
        });
      }
      return list;
    })(),
    transactions: isOwnCoin ? mockChain.ownCoinTrades.map(t => ({
      id: t.id,
      type: t.type,
      user: { name: t.userName, avatar: t.userAvatar, username: t.userUsername },
      amount: t.amount,
      price: t.price,
      total: t.total,
      time: timeAgo(t.timestamp),
    })) : [],
    recentContent: isOwnCoin
      ? myUserPosts.slice(0, 6).map((p, idx) => ({
          id: p.id || String(idx),
          title: p.title || (p.content ? String(p.content).slice(0, 36) + '…' : 'Untitled'),
          thumbnail: p.coverImage || (p.images && p.images[0]) || authUser?.avatar || '/judge-avatar.jpg',
          type: p.type === 'video' ? 'video' : 'photo' as 'photo' | 'video',
          likes: p.likes || 0,
          createdAt: p.createdAt || '',
        }))
      : (matchedUser ? allPosts
      .filter(p => p.author?.id === matchedUser.id)
      .slice(0, 6)
      .map((p, idx) => ({
        id: p.id || String(idx),
        title: p.title || (p.content ? String(p.content).slice(0, 36) + '…' : 'Untitled'),
        thumbnail: p.coverImage || matchedUser.avatar,
        type: p.type === 'video' ? 'video' : 'photo' as 'photo' | 'video',
        likes: p.likes || 0,
        createdAt: p.createdAt || '',
      })) : [
      {
        id: '1',
        title: 'New AI-Generated Artwork',
        thumbnail: 'https://images.unsplash.com/photo-1635372722656-389f87a941b7?w=200&h=200&fit=crop&crop=center',
        type: 'photo',
        likes: 1280,
        createdAt: '2024-03-15'
      },
      {
        id: '2',
        title: 'Behind the Creation',
        thumbnail: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=200&h=200&fit=crop&crop=center',
        type: 'video',
        likes: 892,
        createdAt: '2024-03-14'
      },
      {
        id: '3',
        title: 'Abstract Geometric Art',
        thumbnail: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=200&h=200&fit=crop&crop=center',
        type: 'photo',
        likes: 2156,
        createdAt: '2024-03-13'
      },
      {
        id: '4',
        title: 'Color Experiment Series',
        thumbnail: 'https://images.unsplash.com/photo-1549298916-acc8271b6f94?w=200&h=200&fit=crop&crop=center',
        type: 'photo',
        likes: 976,
        createdAt: '2024-03-12'
      },
      {
        id: '5',
        title: 'NFT Design Inspiration',
        thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&h=200&fit=crop&crop=center',
        type: 'photo',
        likes: 1543,
        createdAt: '2024-03-11'
      },
      {
        id: '6',
        title: 'Digital Sculpture',
        thumbnail: 'https://images.unsplash.com/photo-1633409361618-c73427e4e206?w=200&h=200&fit=crop&crop=center',
        type: 'photo',
        likes: 1089,
        createdAt: '2024-03-10'
      }
    ]),
    priceHistory: isOwnCoin
      ? (() => {
          const myCoin = mockChain.creatorCoins.find(c => c.symbol === mockChain.creatorCoinSymbol);
          const initial = myCoin?.initialPrice ?? 1.00;
          // Pull executed trades chronologically (oldest first).
          const trades = [...mockChain.ownCoinTrades].reverse();
          const points: { time: string; price: number; volume: number }[] = [
            { time: 'Mint', price: initial, volume: 0 },
          ];
          trades.forEach(t => {
            points.push({ time: timeAgo(t.timestamp), price: t.price, volume: t.total });
          });
          if (points.length === 1) {
            points.push({ time: 'Now', price: initial, volume: 0 });
          }
          return points;
        })()
      : (() => {
          // Non-own coin: anchor at listing price + any judge trades against this coin.
          const listed = matchedUser?.creatorCoin?.initialPrice ?? 1.0;
          const sym = '$' + (matchedUser?.creatorCoin?.symbol.replace(/^\$/, '') || (id || '')).toUpperCase();
          const judgeTrades = (mockChain.transactions || [])
            .filter(t => (t.type === 'buy_coin' || t.type === 'sell_coin') && (t.details || '').toUpperCase().includes(sym))
            .sort((a, b) => a.timestamp - b.timestamp);
          const points: { time: string; price: number; volume: number }[] = [
            { time: 'Listed', price: listed, volume: 0 },
          ];
          // We don't store per-trade unit price for cross-coin buys; assume listed price for now.
          judgeTrades.forEach(t => {
            points.push({ time: timeAgo(t.timestamp), price: listed, volume: t.amount || 0 });
          });
          if (points.length === 1) points.push({ time: 'Now', price: listed, volume: 0 });
          return points;
        })()
  };

  const calculateTotal = () => {
    // Gross trade size in ORA. The 5% protocol fee is deducted FROM
    // this number (the buyer pays exactly this), not added on top.
    const numAmount = parseFloat(amount) || 0;
    return (numAmount * coinData.currentPrice).toFixed(4);
  };

  const handleTrade = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      showToast('error', t.coin.invalidAmount);
      return;
    }
    // Show fee confirmation first
    setShowFeeConfirm(true);
  };

  // Real holding from mock chain
  const heldCoin = mockChain.creatorCoins.find(c => c.symbol === '$' + coinData.symbol || c.symbol === coinData.symbol);
  const heldAmount = heldCoin?.amount ?? 0;

  const confirmTrade = async () => {
    setShowFeeConfirm(false);
    setIsTrading(true);
    try {
      const numAmount = parseFloat(amount);
      if (tradeType === 'buy') {
        await mockChain.buyCreatorCoin('$' + coinData.symbol, numAmount);
        // Real-chain mirror: primary_buy from creator's vault.
        // Mock chain remains authoritative for display; we surface tx hash
        // via toast when chain mode is on.
        if (onChain.enabled && onChain.module && walletPublicKey) {
          const creatorPk = resolveCreatorPubkey();
          if (creatorPk) {
            const res = await onChain.primaryBuy({ creator: creatorPk, amount: numAmount });
            if (res.success && res.signature) {
              showToast('success', `On-chain primary buy: ${res.signature.slice(0, 8)}…`);
            } else if (!res.success) {
              showToast('error', res.error || 'On-chain buy failed');
            }
          }
        }
      } else {
        if (numAmount > heldAmount) {
          throw new Error(`You only hold ${heldAmount.toFixed(2)} ${coinData.symbol}`);
        }
        await mockChain.sellCreatorCoin('$' + coinData.symbol, numAmount, coinData.currentPrice);
        // Real-chain sells go through createSellOrder (not a direct sell);
        // the user can post a sell order via the Order Book to mirror this.
      }
      setIsTrading(false);
      setShowTradeSuccess(true);
      setTimeout(() => { setShowTradeSuccess(false); setAmount(''); }, 2500);
    } catch (err: any) {
      setIsTrading(false);
      showToast('error', err.message || 'Transaction failed');
    }
  };

  // Protocol fee is 5% of GROSS (amount × price), deducted from gross.
  const feeAmount = ((parseFloat(amount) || 0) * coinData.currentPrice) * 0.05;

  // 2026-05-20 — friendly empty state for unknown coin URLs.
  //
  // Background: `/marketplace/coin/:id` resolves the URL `id` either to the
  // current user's own minted coin (when `id.toUpperCase() === mockChain.
  // creatorCoinSymbol.replace('$','').toUpperCase()`), or to a known mock
  // creator by id/username/coin-symbol. If neither matches we used to
  // silently fall back to a Maya Chen placeholder, which is confusing
  // (e.g. judge demo user hits /marketplace/coin/JUDGE before they've
  // minted → sees Maya Chen).
  //
  // Now: render a dedicated empty state pointing them to /creator-coin to
  // mint, with a back-to-marketplace escape hatch. Only triggers when the
  // URL is a non-empty id that resolves to nothing on either side.
  const coinNotFound = !isOwnCoin && !matchedUser && !!id;
  if (coinNotFound) {
    const symLabel = (id || '').toUpperCase();
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/40">
          <div className="flex items-center gap-4 p-4 max-w-7xl mx-auto">
            <Button variant="ghost" size="sm" onClick={goBack} className="shrink-0">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-base font-semibold">Creator coin</h1>
          </div>
        </div>
        <div className="max-w-2xl mx-auto p-8">
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">🪙</div>
            <h2 className="text-xl font-bold mb-2">
              Creator coin <span className="font-mono">${symLabel}</span> doesn't exist yet
            </h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Either no creator has minted this symbol, or you arrived via a stale
              link. If <span className="font-mono">${symLabel}</span> is supposed to be
              <em>your</em> coin, mint it from the Creator Coin page first.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button onClick={() => navigate('/creator-coin')} className="bg-[#14C8A8] hover:bg-[#0DA1A8] text-white">
                Mint my Creator Coin
              </Button>
              <Button variant="outline" onClick={() => navigate('/marketplace')}>
                Browse Marketplace
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/40">
        <div className="flex items-center justify-between p-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={goBack}
              className="shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-3">
              {(() => {
                const ownLogo = isOwnCoin ? mockChain.creatorCoins.find(c => c.symbol === mockChain.creatorCoinSymbol)?.logoUrl : undefined;
                if (ownLogo) {
                  return <img src={ownLogo} alt={coinData.symbol} className="w-10 h-10 rounded-full object-cover ring-2 ring-[#14C8A8]/40" />;
                }
                return <UserAvatar src={coinData.creator.avatar} displayName={coinData.creator.name} username={coinData.creator.username} className="w-10 h-10 rounded-full" />;
              })()}
              <div>
                <h1 className="text-lg font-semibold">{coinData.name} ({coinData.symbol})</h1>
                <p className="text-sm text-muted-foreground">@{coinData.creator.username}</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{coinData.currentPrice.toFixed(2)} <span className="text-sm text-muted-foreground font-medium">ORA</span></div>
            <div className={`text-sm flex items-center gap-1 ${
              coinData.change24h >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              {coinData.change24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {coinData.change24h >= 0 ? '+' : ''}{coinData.change24h.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6 pb-12 md:pb-16">
        {/* Desktop Layout: Left 60%, Right 40% */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6">
          {/* Left: Chart & Trading (60% = 3/5) */}
          <div className="lg:col-span-3 space-y-6">
            {/* Key Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-card rounded-xl p-4 border">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{t.marketplace.coins.circulating}</span>
                </div>
                <p className="text-xl font-bold">{coinData.circulating.toLocaleString()} <span className="text-xs text-muted-foreground font-medium">/ {coinData.totalSupply.toLocaleString()}</span></p>
              </div>
              <div className="bg-card rounded-xl p-4 border">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{t.marketplace.coins.volume}</span>
                </div>
                <p className="text-xl font-bold">{coinData.volume24h.toLocaleString()} <span className="text-xs text-muted-foreground font-medium">coins / 24h</span></p>
              </div>
              <div className="bg-card rounded-xl p-4 border">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{t.marketplace.coins.holders}</span>
                </div>
                <p className="text-xl font-bold">{coinData.holders.length}+</p>
              </div>
              <div className="bg-card rounded-xl p-4 border">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Vesting Locked</span>
                </div>
                <p className="text-xl font-bold">{Math.max(0, coinData.totalSupply - coinData.circulating).toLocaleString()} <span className="text-xs text-muted-foreground font-medium">/ {coinData.totalSupply.toLocaleString()}</span></p>
              </div>
            </div>

            {/* Vesting progress — read-only for everyone (creator + fans).
             *  Active controls ("Release Next Batch" / "Simulate Next Batch
             *  Unlock") moved to the creator's Creator Coin dashboard so fans never see them. */}
            {(() => {
              const month = isOwnCoin ? (mockChain.creatorCoinVestingMonth ?? 0) : 0;
              const unlocked = 2000 + month * 800;
              const total = 10000;
              const pct = (unlocked / total) * 100;
              const remaining = Math.max(0, total - unlocked);
              return (
                <div className="bg-card rounded-xl p-5 border">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="text-sm font-semibold">Vesting Progress</h4>
                      <p className="text-xs text-muted-foreground">Month {month} of 10 · 800 coins / batch</p>
                    </div>
                    <span className="text-sm font-mono font-bold">{unlocked.toLocaleString()} / {total.toLocaleString()}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-secondary overflow-hidden mb-3">
                    <div className="h-full bg-gradient-to-r from-[#14C8A8] to-emerald-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {remaining > 0 ? `${remaining.toLocaleString()} still vesting` : 'Fully unlocked'}
                    </span>
                    {isOwnCoin && !matchedUser && (
                      <button
                        onClick={() => navigate('/creator-coin')}
                        className="px-3 py-1 rounded-lg bg-aura/10 hover:bg-aura/20 text-aura text-xs font-semibold transition-colors"
                      >
                        Manage your Creator Coin →
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Holder Benefits — visible to everyone, redeem available to non-creators with sufficient balance */}
            {(() => {
              const myCoinForBenefits = isOwnCoin
                ? mockChain.creatorCoins.find(c => c.symbol === mockChain.creatorCoinSymbol)
                : mockChain.creatorCoins.find(c => c.symbol.toUpperCase() === ('$' + (id || '').toUpperCase()));
              // For non-own coins, fall back to creator's published benefits even if the judge holds 0.
              // "consume" type benefits used to be called burn benefits, but
              // per whitepaper §6.4 the redeemed CC transfers to the creator
              // (not burned). We keep the legacy 'consume' enum value for
              // schema stability — only the UI wording is updated.
              const benefits = (myCoinForBenefits?.benefits || matchedUser?.creatorCoin?.benefits || []) as { id: string; type: 'hold' | 'consume'; threshold: number; title: string; description: string }[];
              if (benefits.length === 0) return null;
              const myHoldingSymbol = myCoinForBenefits?.symbol || matchedUser?.creatorCoin?.symbol;
              const myHoldingAmount = myCoinForBenefits?.amount ?? 0;
              const holdBenefits = benefits.filter(b => b.type === 'hold');
              const burnBenefits = benefits.filter(b => b.type === 'consume');
              const handleRedeem = (b: typeof benefits[0]) => {
                if (isOwnCoin) {
                  showToast('error', "You can't redeem your own coin's benefits.");
                  return;
                }
                if (!myHoldingSymbol) {
                  showToast('error', `You don't hold any ${coinData.symbol}.`);
                  return;
                }
                if (myHoldingAmount < b.threshold) {
                  showToast('error', `Need ${b.threshold} ${coinData.symbol}. You hold ${myHoldingAmount.toFixed(2)}.`);
                  return;
                }
                setRedeemTarget(b);
                setRedeemDialogOpen(true);
              };
              return (
                <div className="bg-card rounded-xl p-6 border">
                  <h3 className="text-lg font-semibold mb-1">Holder Benefits</h3>
                  <p className="text-xs text-muted-foreground mb-4">Perks designed by the creator. Hold to enjoy, or pay coins back to redeem something special.</p>
                  {!isOwnCoin && myHoldingSymbol && (
                    <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                      <span>You hold:</span>
                      <span className="font-mono font-semibold text-foreground">{myHoldingAmount.toFixed(2)} {coinData.symbol}</span>
                    </div>
                  )}
                  {holdBenefits.length > 0 && (
                    <div className="mb-5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs uppercase tracking-widest font-bold text-purple-500">Hold-to-Enjoy</span>
                      </div>
                      <div className="space-y-2">
                        {holdBenefits.map(b => {
                          const unlocked = !isOwnCoin && myHoldingAmount >= b.threshold;
                          return (
                            <div key={b.id} className={`rounded-xl border p-3 transition-colors ${unlocked ? 'bg-purple-500/[0.10] border-purple-500/40' : 'bg-purple-500/[0.05] border-purple-500/20'}`}>
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold">{b.title}</p>
                                  {unlocked && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500 text-white font-bold">UNLOCKED</span>}
                                </div>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-500 font-mono whitespace-nowrap">≥ {b.threshold} {coinData.symbol}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">{b.description}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {burnBenefits.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs uppercase tracking-widest font-bold text-orange-500">Pay-to-Redeem</span>
                        <span className="text-[10px] text-muted-foreground italic">CC goes to {coinData.creator.name} — not burned</span>
                      </div>
                      <div className="space-y-2">
                        {burnBenefits.map(b => {
                          const canAfford = !isOwnCoin && myHoldingAmount >= b.threshold;
                          return (
                            <div key={b.id} className="rounded-xl bg-orange-500/[0.05] border border-orange-500/20 p-3">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <p className="text-sm font-semibold">{b.title}</p>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-500 font-mono whitespace-nowrap">Pay {b.threshold} {coinData.symbol}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mb-2">{b.description}</p>
                              {!isOwnCoin && (
                                <button
                                  onClick={() => handleRedeem(b)}
                                  disabled={!canAfford}
                                  className="w-full py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/30 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
                                >
                                  {canAfford ? `Pay ${b.threshold} ${coinData.symbol} to ${coinData.creator.name}` : `Need ${b.threshold} ${coinData.symbol}`}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Creator's Recent Content */}
            <div className="bg-card rounded-xl p-6 border">
              <div className="flex items-center gap-2 mb-4">
                <Image className="w-5 h-5" />
                <h3 className="text-lg font-semibold">Creator's Recent Content</h3>
              </div>
              {coinData.recentContent.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {isOwnCoin ? 'No published works yet. Head to /create to publish your first piece.' : 'This creator hasn’t published anything yet.'}
                </div>
              ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {coinData.recentContent.map((content) => (
                  <div key={content.id} className="group cursor-pointer">
                    <div className="relative aspect-square rounded-xl overflow-hidden mb-2">
                      <img
                        src={content.thumbnail}
                        alt={content.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      {content.type === 'video' && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                            <svg className="w-4 h-4 text-white ml-0.5" fill="white" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                    <h4 className="font-medium text-sm line-clamp-2 mb-1">{content.title}</h4>
                    <p className="text-xs text-muted-foreground">{content.likes} likes • {content.createdAt}</p>
                  </div>
                ))}
              </div>
              )}
            </div>
          </div>

          {/* Fee Confirmation Modal */}
          {showFeeConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-background rounded-2xl p-6 max-w-md w-full mx-4 border shadow-xl">
                <h3 className="text-lg font-bold mb-4">{tradeType === 'buy' ? 'Buy' : 'Sell'} {coinData.symbol} — Fee Breakdown</h3>
                <div className="bg-secondary rounded-xl p-4 mb-4">
                  {/* Show full math: amount × price = gross, fee = 5% of gross,
                      net to creator = gross − fee. Buyer pays exactly gross. */}
                  {(() => {
                    const amt = parseFloat(amount) || 0;
                    const gross = amt * coinData.currentPrice;
                    const net = gross - feeAmount;
                    return (
                      <div className="text-xs space-y-1.5 mb-3 pb-3 border-b">
                        <div className="flex justify-between"><span className="text-muted-foreground">Amount × Price</span><span className="font-mono">{amt.toFixed(4)} × {coinData.currentPrice.toFixed(4)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Gross (you pay)</span><span className="font-mono font-bold">{gross.toFixed(4)} ORA</span></div>
                        <div className="flex justify-between text-rose-600 dark:text-rose-400"><span>− Protocol fee (5%)</span><span className="font-mono">{feeAmount.toFixed(4)} ORA</span></div>
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400 pt-1 border-t"><span>Net to creator</span><span className="font-mono font-bold">{net.toFixed(4)} ORA</span></div>
                      </div>
                    );
                  })()}
                  <div className="flex justify-between text-sm font-medium mb-3">
                    <span>Protocol fee allocation</span>
                    <span className="font-mono">{feeAmount.toFixed(4)} ORA</span>
                  </div>
                  <FeeBreakdown totalAmount={(parseFloat(amount) || 0) * coinData.currentPrice} feeAmount={feeAmount} />
                  <div className="mt-3 pt-2 border-t text-xs text-muted-foreground">No royalty — Creator Coins are royalty-free</div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setShowFeeConfirm(false)} className="flex-1">Cancel</Button>
                  <Button onClick={confirmTrade} className="flex-1 bg-gradient-to-r from-[#7C3AED] to-[#F59E0B] text-white">Confirm</Button>
                </div>
              </div>
            </div>
          )}

          {/* Trade Success Animation */}
          {showTradeSuccess && (
            <TransactionSuccess
              amount={parseFloat(amount) || 0}
              label={`${tradeType === 'buy' ? 'Purchase' : 'Sale'} Complete!`}
              onClose={() => { setShowTradeSuccess(false); setAmount(''); }}
              autoDismissMs={3000}
            />
          )}

          {/* Batch Unlock Ceremony */}
          {isOwnCoin && (() => {
            const ownCoin = mockChain.creatorCoins.find(c => c.symbol === mockChain.creatorCoinSymbol);
            const monthIdx = mockChain.creatorCoinVestingMonth ?? 0;
            const plannedPrice = ownCoin?.batchPrices?.[monthIdx];
            return (
              <>
                <BatchUnlockCeremony
                  open={showBatchUnlock}
                  symbol={mockChain.creatorCoinSymbol || coinData.symbol}
                  logoUrl={ownCoin?.logoUrl}
                  currentPrice={plannedPrice ?? coinData.currentPrice}
                  onClose={() => setShowBatchUnlock(false)}
                  onUnlocked={(batch, price) => {
                    showToast('success', `🌸 Vesting Batch ${batch} unlocked: 800 ${coinData.symbol} @ ${price.toFixed(2)} ORA each`);
                  }}
                />
                <BatchPricingPlan
                  open={showBatchPlan}
                  symbol={mockChain.creatorCoinSymbol || coinData.symbol}
                  currentPrice={coinData.currentPrice}
                  onClose={() => setShowBatchPlan(false)}
                />
              </>
            );
          })()}

          {/* Gift dialog — send CC directly to another user */}
          <GiftCoinDialog
            open={giftDialogOpen}
            onOpenChange={setGiftDialogOpen}
            symbol={'$' + coinData.symbol}
            available={isOwnCoin
              ? (mockChain.creatorCoinBalance ?? 0)
              : (mockChain.creatorCoins.find(c => c.symbol === '$' + coinData.symbol)?.amount ?? 0)
            }
          />

          {/* Redeem confirmation dialog — escrow flow */}
          <RedeemConfirmDialog
            open={redeemDialogOpen}
            onOpenChange={setRedeemDialogOpen}
            benefit={redeemTarget}
            symbol={coinData.symbol}
            creatorName={coinData.creator.name}
            chainMode={
              redemptionChain.enabled &&
              !!resolveCreatorPubkey() &&
              !!onChain.coinMint(resolveCreatorPubkey()!)
            }
            onConfirm={async () => {
              if (!redeemTarget) return;
              // coinData.symbol is bare ticker (e.g. "IRIS"); chain storage uses "$IRIS".
              const fullSymbol = '$' + coinData.symbol;
              // ── 1. Mock-chain bookkeeping (always runs) ────────────────
              try {
                await mockChain.initiateRedemption(fullSymbol, redeemTarget, {
                  creatorName: coinData.creator.name,
                  creatorAvatar: coinData.creator.avatar,
                });
              } catch (err: any) {
                showToast('error', err.message || 'Redeem failed');
                return;
              }
              showToast('success', `🔒 ${redeemTarget.threshold} ${fullSymbol} held in escrow — awaiting delivery from ${coinData.creator.name}.`);

              // ── 2. Real-chain dispatch (best-effort, never blocks UI) ──
              const creatorPk = resolveCreatorPubkey();
              const mint = creatorPk ? onChain.coinMint(creatorPk) : null;
              if (redemptionChain.enabled && creatorPk && mint) {
                try {
                  // Threshold is in human-readable CC; on-chain cost is in
                  // base units (9 decimals).
                  const cost = BigInt(Math.round(redeemTarget.threshold * 1e9));
                  const r = await redemptionChain.initiateRedemption({
                    coinMint: mint,
                    creator: creatorPk,
                    benefitId: Number(redeemTarget.id) || 0,
                    cost,
                  });
                  if (!r.success) {
                    console.warn('[CoinDetailPage] on-chain initiateRedemption failed:', r.error);
                    showToast('info', `On-chain redemption skipped: ${r.error}`);
                  } else {
                    console.log('[CoinDetailPage] on-chain redemption tx:', r.signature);
                  }
                } catch (e: any) {
                  console.warn('[CoinDetailPage] real-chain redemption threw:', e);
                }
              }
            }}
          />

          {/* Right: Holders & Transactions (40% = 2/5) — sticky, no scroll */}
          <div className="lg:col-span-2 space-y-6 lg:sticky lg:top-24 lg:self-start lg:max-h-none lg:overflow-visible">
            {/* Creator Info */}
            <div className="bg-card rounded-xl p-6 border">
              <div className="flex items-center gap-4 mb-4">
                <UserAvatar
                  src={coinData.creator.avatar}
                  displayName={coinData.creator.name}
                  username={coinData.creator.username}
                  className="w-16 h-16 rounded-full"
                />
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">{coinData.creator.name}</h3>
                  <p className="text-sm text-muted-foreground">@{coinData.creator.username}</p>
                  <p className="text-sm text-muted-foreground">{coinData.creator.followers.toLocaleString()} followers</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {coinData.creator.bio}
              </p>
            </div>

            {/* Top Holders — Top 5 + click to expand the rest */}
            <div className="bg-card rounded-xl p-6 border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Top Holders</h3>
                <span className="text-[11px] text-muted-foreground font-mono">{coinData.holders.length} total</span>
              </div>
              <div className="space-y-3">
                {(showAllHolders ? coinData.holders : coinData.holders.slice(0, 5)).map((holder, index) => (
                  <div key={holder.id} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </div>
                    <UserAvatar
                      src={holder.avatar}
                      displayName={holder.name}
                      username={holder.username}
                      className="w-8 h-8 rounded-full"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{holder.name}</p>
                      <p className="text-xs text-muted-foreground">@{holder.username}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm tabular-nums">{holder.amount.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{holder.percentage.toFixed(2)}%</p>
                    </div>
                  </div>
                ))}
              </div>
              {coinData.holders.length > 5 && (
                <button
                  onClick={() => setShowAllHolders(s => !s)}
                  className="mt-4 w-full py-2 rounded-lg bg-secondary/40 hover:bg-secondary/60 text-xs font-semibold transition-colors inline-flex items-center justify-center gap-1"
                >
                  {showAllHolders ? (
                    <>Show top 5 only</>
                  ) : (
                    <>Show all {coinData.holders.length} holders</>
                  )}
                </button>
              )}
            </div>

            {/* Primary Issuance — fans buy directly from creator's remaining supply. Hidden for the creator's own page. */}
            {!isOwnCoin && (
              <div className="bg-card rounded-xl p-6 border">
                <h3 className="text-xl font-semibold mb-4">Buy {coinData.symbol} from {coinData.creator.name}</h3>
                <div className="space-y-4">
                  {(() => {
                    const sym = '$' + (coinData.symbol).toUpperCase();
                    const remain = mockChain.foreignCoinPrimaryRemaining[sym];
                    const soldOut = remain !== undefined && remain <= 0;
                    return (
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs uppercase tracking-widest font-bold text-green-600">Primary Issuance</span>
                          <span className="text-xs text-muted-foreground">· directly from creator</span>
                        </div>
                        {remain !== undefined && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${soldOut ? 'bg-red-500/15 text-red-500' : 'bg-green-500/15 text-green-600'}`}>
                            {soldOut ? 'SOLD OUT' : `${remain.toLocaleString()} left in creator's vault`}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Buy Amount</label>
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="pr-16"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        {coinData.symbol}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Current Price:</span>
                    <span className="font-medium">{coinData.currentPrice.toFixed(2)} ORA</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-bold text-lg">{calculateTotal()} ORA</span>
                  </div>

                  <div className="flex gap-2">
                    {[25, 50, 75, 100].map((percent) => (
                      <Button
                        key={percent}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          // Fee deducted FROM gross, so buyer pays price × amount.
                          const price = Math.max(0.0001, coinData.currentPrice);
                          const maxByOra = mockChain.oraBalance / price;
                          const vaultRemaining = !isOwnCoin
                            ? (mockChain.foreignCoinPrimaryRemaining['$' + coinData.symbol] ?? Infinity)
                            : Infinity;
                          const maxBuy = Math.max(0, Math.min(maxByOra, vaultRemaining));
                          setAmount((maxBuy * percent / 100).toFixed(2));
                        }}
                      >
                        {percent}%
                      </Button>
                    ))}
                  </div>

                  {(() => {
                    const sym = '$' + (coinData.symbol).toUpperCase();
                    const remain = mockChain.foreignCoinPrimaryRemaining[sym];
                    const soldOut = remain !== undefined && remain <= 0;
                    return (
                      <Button
                        onClick={() => { setTradeType('buy'); handleTrade(); }}
                        disabled={isTrading || !amount || soldOut}
                        className={`w-full text-white ${soldOut
                          ? 'bg-muted-foreground/40 hover:bg-muted-foreground/40 cursor-not-allowed'
                          : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'}`}
                      >
                        {isTrading ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Buying...
                          </div>
                        ) : soldOut ? (
                          <>🔒 Primary issuance sold out</>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-2" />
                            Buy {coinData.symbol}
                          </>
                        )}
                      </Button>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Order Book — secondary market between holders */}
            <div className="bg-card rounded-xl p-6 border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  <h3 className="text-lg font-semibold">Order Book</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setGiftDialogOpen(true)} className="text-pink-600 border-pink-200 hover:bg-pink-50 dark:hover:bg-pink-950/30">
                    <Gift className="w-4 h-4 mr-1" />
                    Gift
                  </Button>
                  <Button size="sm" onClick={() => setShowOrderForm(!showOrderForm)} className="bg-gradient-to-r from-aura to-ora text-white">
                    <Tag className="w-4 h-4 mr-1" />
                    Post Order
                  </Button>
                </div>
              </div>

              {showOrderForm && (
                <div className="mb-4 p-4 bg-secondary rounded-xl space-y-3">
                  <div className="flex gap-2">
                    <Button size="sm" variant={orderType === 'sell' ? 'default' : 'outline'} onClick={() => setOrderType('sell')} className={orderType === 'sell' ? 'bg-red-500 text-white' : ''}>Sell</Button>
                    <Button size="sm" variant={orderType === 'buy' ? 'default' : 'outline'} onClick={() => setOrderType('buy')} className={orderType === 'buy' ? 'bg-green-500 text-white' : ''}>Buy</Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="number" placeholder="Amount" value={orderAmount} onChange={e => setOrderAmount(e.target.value)} />
                    <Input type="number" placeholder="Unit Price (ORA)" value={orderPrice} onChange={e => setOrderPrice(e.target.value)} />
                  </div>
                  <Input placeholder="Description (optional)" value={orderDesc} onChange={e => setOrderDesc(e.target.value)} />
                  <Button onClick={handlePostOrder} className="w-full bg-gradient-to-r from-aura to-ora text-white">Post Order</Button>
                </div>
              )}

              {/* Buy/Sell order columns — split so a buyer skimming the book
               *  never confuses BID and ASK rows. */}
              {orders.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No orders yet</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(['buy', 'sell'] as const).map(side => {
                    const subset = orders.filter(o => o.type === side);
                    return (
                      <div key={side} className="space-y-2">
                        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-bold pb-1 border-b">
                          <span className={side === 'buy' ? 'text-green-600' : 'text-red-500'}>
                            {side === 'buy' ? '🟢 Buy orders' : '🔴 Sell orders'}
                          </span>
                          <span className="text-muted-foreground">{subset.length}</span>
                        </div>
                        {subset.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground py-2">No {side} orders</p>
                        ) : subset.map(order => (
                          <div key={order.id} className="flex items-start gap-3 p-3 bg-secondary/50 rounded-xl">
                            <UserAvatar src={order.user.avatar} displayName={order.user.name} username={order.user.username} className="w-8 h-8 rounded-full mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">{order.amount} {coinData.symbol}</span>
                                <span className="text-sm text-muted-foreground">@ {order.price.toFixed(4)} ORA</span>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-1">{order.description}</p>
                              <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                                <span>@{order.user.username}</span>
                                <span>•</span>
                                <span>{order.time}</span>
                              </div>
                            </div>
                            {order.user.username === (authUser?.username || 'me') ? (
                              <Button size="sm" variant="outline" onClick={() => handleCancelOrder(order)} className="shrink-0 text-muted-foreground border-muted hover:bg-secondary">
                                Cancel
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => handleTakeOrder(order)} className="shrink-0 text-aura border-aura/30 hover:bg-aura/10">
                                Fill
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {/* Recent Transactions */}
            <div className="bg-card rounded-xl p-6 border">
              <h3 className="text-lg font-semibold mb-4">Recent Trades</h3>
              <div className="space-y-3">
                {coinData.transactions.slice(0, 10).map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 py-2">
                    <UserAvatar
                      src={tx.user.avatar}
                      displayName={tx.user.name}
                      username={tx.user.username}
                      className="w-6 h-6 rounded-full"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={tx.type === 'buy' ? 'default' : 'destructive'} 
                          className={`text-xs ${
                            tx.type === 'buy' 
                              ? 'bg-green-100 text-green-700 border-green-200' 
                              : 'bg-red-100 text-red-700 border-red-200'
                          }`}
                        >
                          {tx.type === 'buy' ? 'Buy' : 'Sell'}
                        </Badge>
                        <span className="font-medium text-sm">{tx.amount} {coinData.symbol}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>@{tx.user.username}</span>
                        <span>•</span>
                        <Clock className="w-3 h-3" />
                        <span>{tx.time}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">{tx.price.toFixed(2)} ORA</p>
                      <p className="text-xs text-muted-foreground">{tx.total.toFixed(2)} ORA</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}