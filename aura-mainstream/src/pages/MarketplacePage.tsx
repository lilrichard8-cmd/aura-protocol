import { useState } from 'react';
import TransactionSuccess from '@/components/common/TransactionSuccess';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Search, TrendingUp, Clock, DollarSign, Users, Trophy, Gift, Briefcase, Key, Layers, CheckCircle, Plus, Coins } from 'lucide-react';
import CoinCard from '@/components/coin/CoinCard';
import TabIntroCard from '@/components/common/TabIntroCard';
import { NFT_CATALOG } from '@/data/nfts';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { users, iris, posts as allPosts } from '@/data/mock';
import { useUserPosts } from '@/hooks/useUserPosts';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { useToast } from '@/context/ToastContext';
import { useMockChain } from '@/context/MockChainContext';
import { useBuyOra } from '@/context/BuyOraContext';

interface MarketItem {
  id: string;
  type: 'nft' | 'coin' | 'bounty';
  title: string;
  ticker?: string;
  creator: string;
  /** Optional creator profile avatar — distinct from `thumbnail` (the coin's own logo). */
  creatorAvatar?: string;
  price: number;
  /** Coin logo URL. May be undefined to trigger gradient-initial fallback. */
  thumbnail?: string;
  /** Optional one-line tagline shown on coin cards. */
  tagline?: string;
  color: string;
  subtype?: 'auction' | 'fixed' | 'mystery';
  /** Mystery-box specific: pool size + boxes-sold info for the tile. */
  mystery?: { poolSize: number; sold: number; edition: number };
  bids?: number;
  endTime?: string;
  change24h?: number;
  holders?: number;
  circulating?: number;
  reward?: number;
  deadline?: string;
  submissions?: number;
  volume24h?: number;
  isLaunched?: boolean;
  mintedAt?: number;
}

export default function MarketplacePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  // Stamp every detail-page navigation with where we came from so the detail
  // page's smart-back hook can return to the exact tab we left from. We bake
  // the URL search (?tab=nft) into the from path so the active tab survives.
  const fromPath = location.pathname + location.search;
  const goToCoin = (id: string) =>
    navigate(`/marketplace/coin/${id}`, { state: { from: fromPath } });
  const goToNft = (id: string) =>
    navigate(`/marketplace/nft/${id}`, { state: { from: fromPath } });
  const mockChain = useMockChain();
  const buyOra = useBuyOra();
  const { showToast } = useToast();
  // Active tab lives in the URL (`?tab=nft`) so back-navigation from detail
  // pages restores the exact tab the user was on. "coins" stays parameter-free
  // for clean URLs and backwards compatibility with old links to /marketplace.
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs = ['coins', 'nft', 'keys', 'bounty', 'fractions'] as const;
  const tabParam = searchParams.get('tab');
  const activeTab = (validTabs.includes((tabParam ?? 'coins') as any) ? (tabParam ?? 'coins') : 'coins') as typeof validTabs[number];
  const setActiveTab = (tab: typeof validTabs[number]) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (tab === 'coins') next.delete('tab');
      else next.set('tab', tab);
      return next;
    }, { replace: true });
  };
  // Fragment buy/sell controls moved to FractionDetailPage — the marketplace
  // tile is browse-only and routes into the dedicated trade panel.
  // Bounty creation moved to Studio (CreatePage) — marketplace is for browsing
  // and participating in existing bounties only.
  const [listKeyId, setListKeyId] = useState<string | null>(null);
  const [keyPurchaseAmount, setKeyPurchaseAmount] = useState<number | null>(null);
  const [listPrice, setListPrice] = useState('');
  const [coinSubTab, setCoinSubTab] = useState<'hot' | 'newmints'>('hot');
  const [searchQuery, setSearchQuery] = useState('');

  // Real creator coins on the platform: Iris (AI Co-founder) + the judge's own minted coin.
  // All other creators are users on the platform but have not minted their Creator Coin yet.
  const judgeCoin = mockChain.hasCreatorCoin && mockChain.creatorCoinSymbol ? (() => {
    const myCoin = mockChain.creatorCoins.find(c => c.symbol === mockChain.creatorCoinSymbol);
    const initialPrice = myCoin?.initialPrice ?? 1.0;
    const lastTrade = mockChain.ownCoinTrades[0];
    const currentPrice = lastTrade?.price ?? initialPrice;
    const selfAmount = mockChain.creatorCoinBalance || 2000;
    const externalTotal = mockChain.ownCoinHolders.reduce((s, h) => s + h.amount, 0);
    const circulating = selfAmount + externalTotal;
    const tickerLower = mockChain.creatorCoinSymbol.replace(/^\$/, '').toLowerCase();
    return {
      id: tickerLower,
      type: 'coin' as const,
      title: myCoin?.name || `${mockChain.creatorCoinSymbol} Coin`,
      ticker: mockChain.creatorCoinSymbol,
      creator: 'you',
      price: currentPrice,
      // Coin logo is independent from creator avatar; undefined → fallback
      // gradient "ticker letter" badge in CoinLogo.
      thumbnail: myCoin?.logoUrl,
      creatorAvatar: undefined,
      color: 'from-amber-500 to-orange-500',
      change24h: initialPrice > 0 ? parseFloat((((currentPrice - initialPrice) / initialPrice) * 100).toFixed(2)) : 0,
      holders: 1 + mockChain.ownCoinHolders.length,
      circulating: circulating,
      volume24h: (() => {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        return mockChain.ownCoinTrades
          .filter(t => (t.timestamp ?? 0) >= cutoff)
          .reduce((s, t) => s + (t.amount || 0), 0);
      })(),
      isLaunched: true,
      mintedAt: myCoin?.mintedAt,
    };
  })() : null;

  // Derive foreign-coin (e.g. Iris) stats from real protocol state — no hardcoded mock numbers.
  // AURA tokenomics: 2,000 initial unlocked + 8,000 locked in vesting (releases 800/month).
  const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
  const allCreatorCoins = [
    ...(judgeCoin ? [judgeCoin] : []),
    ...[iris].filter(u => u.creatorCoin).map(user => {
      const symbol = user.creatorCoin!.symbol;
      const price = user.creatorCoin!.initialPrice ?? 1.0;
      // "remaining" = how many of Iris's initial 2,000 unlocked batch she still holds (unsold).
      const remaining = mockChain.foreignCoinPrimaryRemaining[symbol] ?? 0;
      const localHoldAmount = mockChain.creatorCoins.find(c => c.symbol === symbol)?.amount ?? 0;
      // circulating (in any user wallet) = creator's wallet + other holders' wallets.
      // Vesting-locked tokens (8,000) are NOT circulating.
      const circulating = remaining + localHoldAmount;
      // holders count = creator (always 1 if she still holds any) + local user (if holds any).
      const holders = (remaining > 0 ? 1 : 0) + (localHoldAmount > 0 ? 1 : 0);
      const volume24h = mockChain.transactions
        .filter(tx => (tx.timestamp ?? 0) >= cutoff24h && (tx.details || '').includes(symbol) && (tx.type === 'buy_coin' || tx.type === 'sell_coin'))
        .reduce((sum, tx) => {
          // Extract "Bought N $IRIS" / "Sold N $IRIS" amount from details string.
          const m = (tx.details || '').match(/(?:Bought|Sold)\s+(\d+(?:\.\d+)?)/i);
          return sum + (m ? parseFloat(m[1]) : 0);
        }, 0);
      return {
        id: user.id,
        type: 'coin' as const,
        title: user.displayName,
        ticker: symbol,
        creator: user.username,
        price,
        // Coin logo (separate from creator avatar) so creators can design and
        // upload their own coin artwork. Falls back to a gradient initial badge.
        thumbnail: user.creatorCoin!.logoUrl,
        creatorAvatar: user.avatar,
        tagline: user.creatorCoin!.tagline,
        color: 'from-purple-500 to-indigo-500',
        change24h: 0, // no historical price tracking yet for foreign coins
        holders,
        circulating,
        volume24h: Math.round(volume24h),
        isLaunched: true,
        mintedAt: undefined,
      };
    }),
  ];


  // NFT marketplace tiles — derived from the canonical NFT_CATALOG so the
  // grid and detail page can never drift apart. Auctions render a live
  // countdown derived from `auctionEnd`; mystery boxes show a pool-size badge.
  const nftItems: MarketItem[] = NFT_CATALOG.map(nft => {
    let endTime: string | undefined;
    if (nft.listingType === 'auction' && nft.auctionEnd) {
      const ms = new Date(nft.auctionEnd).getTime() - Date.now();
      if (ms > 0) {
        const totalMin = Math.floor(ms / 60_000);
        const days = Math.floor(totalMin / (60 * 24));
        const hours = Math.floor((totalMin / 60) % 24);
        endTime = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
      } else {
        endTime = 'ended';
      }
    }
    return {
      id: nft.id,
      type: 'nft' as const,
      title: nft.name,
      creator: nft.creator.username,
      price: nft.price,
      thumbnail: nft.image,
      color: 'from-pink-500 to-purple-500',
      subtype: nft.listingType,
      bids: nft.listingType === 'auction' ? nft.bidHistory.length : undefined,
      endTime,
      mystery: nft.listingType === 'mystery' && nft.mysteryBox
        ? { poolSize: nft.mysteryBox.pool.length, sold: nft.mysteryBox.sold, edition: nft.mysteryBox.edition }
        : undefined,
    };
  });

  // Mock Bounty data
  // eslint-disable-next-line @typescript-eslint/no-unused-vars

  const getFilteredCoins = (tab: string) => {
    let coins = allCreatorCoins;
    
    if (searchQuery) {
      coins = coins.filter(coin => 
        coin.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        coin.creator.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    switch (tab) {
      case 'hot':
        return coins.filter(c => c.isLaunched).sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
      case 'newmints': {
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        return coins
          .filter(c => (c.mintedAt ?? 0) >= cutoff)
          .sort((a, b) => (b.mintedAt ?? 0) - (a.mintedAt ?? 0));
      }
      default:
        return coins;
    }
  };

  const getFilteredItems = (items: MarketItem[]) => {
    if (!searchQuery) return items;
    return items.filter(item => 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.creator.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const formatPrice = (price: number) => price.toLocaleString();
  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  };

  const formatTimeAgo = (ts?: number) => {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const CoinsGrid = () => (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/10 dark:to-indigo-900/10 rounded-xl p-6 border border-purple-200/50 dark:border-purple-800/50">
        <div className="flex items-center gap-3 mb-4">
          <Trophy className="w-6 h-6 text-purple-600" />
          <h3 className="text-lg font-bold text-purple-800 dark:text-purple-200">{t.marketplace.coins.title}</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {t.marketplace.coins.desc}
        </p>
      </div>

      {/* Tabs — Hot Trading + New Mints. Top Gainers/Losers were removed:
          they relied on synthetic 24h change values that didn't reflect real
          protocol state, so we keep only the two honest cuts. */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {[
          { id: 'hot', label: t.marketplace.coins.subtabs.hot, icon: '🔥' },
          { id: 'newmints', label: t.marketplace.coins.subtabs.newmints, icon: '🆕' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCoinSubTab(tab.id as any)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-all ${
              coinSubTab === tab.id
                ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 border-2 border-purple-300 dark:border-purple-700'
                : 'bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Hot Trading Tab — larger, richer Creator Coin cards. */}
      {coinSubTab === 'hot' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {getFilteredCoins('hot').slice(0, 9).map(coin => (
            <CoinCard
              key={coin.id}
              coin={coin}
              variant="hot"
              onPreview={() => goToCoin(coin.id)}
              onPrimary={() => goToCoin(coin.id)}
              t={t}
              formatPrice={formatPrice}
              formatChange={formatChange}
            />
          ))}
        </div>
      )}

      {/* New Mints Tab — same big-card layout with a NEW MINT badge. */}
      {coinSubTab === 'newmints' && (
        <>
          {getFilteredCoins('newmints').length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {t.marketplace.coins.newmints.empty}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {getFilteredCoins('newmints').map(coin => (
                <CoinCard
                  key={coin.id}
                  coin={coin}
                  variant="new"
                  onPreview={() => goToCoin(coin.id)}
                  onPrimary={() => goToCoin(coin.id)}
                  t={t}
                  formatPrice={formatPrice}
                  formatChange={formatChange}
                  formatTimeAgo={formatTimeAgo}
                />
              ))}
            </div>
          )}
        </>
      )}

    </div>
  );

  const NFTGrid = () => (
    // Grid matches the Content Keys tab exactly: 1 / 2 / 3 / 4 columns at
    // md / lg / xl breakpoints. Each card is bigger than before and now
    // mirrors the PrimaryKeyCard density: cover → title/by → price + meta →
    // dual-button footer (Preview + primary action).
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {getFilteredItems(nftItems).map(item => {
        const primaryLabel =
          item.subtype === 'auction' ? t.marketplace.nft.bid
            : item.subtype === 'mystery' ? 'Open Box'
            : t.marketplace.nft.buy;
        const priceLabel =
          item.subtype === 'auction' ? t.marketplace.nft.currentBid
            : item.subtype === 'mystery' ? 'Box price'
            : t.marketplace.nft.price;
        return (
          <div
            key={item.id}
            className="bg-card rounded-xl border overflow-hidden hover:shadow-md hover:border-aura/40 transition-all flex flex-col cursor-pointer group"
            onClick={() => goToNft(item.id)}
          >
            {/* Cover — aspect-square so cards align horizontally. */}
            <div className="relative aspect-square bg-muted overflow-hidden">
              <img
                src={item.thumbnail}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />

              {/* Listing-type badge */}
              {item.subtype === 'auction' && (
                <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500 text-xs font-bold text-white animate-pulse shadow-sm">
                  <Clock className="w-3 h-3" /> {t.marketplace.nft.auction}
                </div>
              )}
              {item.subtype === 'fixed' && (
                <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-emerald-500 text-xs font-bold text-white shadow-sm">
                  Buy Now
                </div>
              )}
              {item.subtype === 'mystery' && (
                <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-600 text-xs font-bold text-white shadow-sm">
                  ✨ Mystery
                </div>
              )}
              <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-black/60 backdrop-blur text-white text-[10px] font-semibold">
                NFT
              </div>

              {/* Mystery box overlay — visually "sealed" */}
              {item.subtype === 'mystery' && (
                <>
                  <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" />
                  <div className="absolute inset-0 flex items-center justify-center text-6xl font-black text-white/90 drop-shadow-lg select-none pointer-events-none">
                    ?
                  </div>
                </>
              )}
            </div>

            {/* Body — mirrors PrimaryKeyCard density. */}
            <div className="p-4 flex-1 flex flex-col">
              <h3 className="font-semibold text-sm line-clamp-2 mb-1 min-h-[2.5rem]">{item.title}</h3>
              <p className="text-[11px] text-muted-foreground mb-3">by @{item.creator}</p>

              <div className="flex items-center justify-between mb-3 mt-auto">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{priceLabel}</div>
                  <div className="text-lg font-bold">{formatPrice(item.price)} ORA</div>
                </div>
                {item.subtype === 'auction' && (
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground">{item.bids ?? 0}{t.marketplace.nft.bids}</div>
                    <div className="text-[11px] font-medium text-red-500">{item.endTime}{t.marketplace.nft.endTime}</div>
                  </div>
                )}
                {item.subtype === 'mystery' && item.mystery && (
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground">1 of {item.mystery.poolSize}</div>
                    <div className="text-[11px] font-medium text-fuchsia-500">{item.mystery.sold}/{item.mystery.edition} sold</div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={(e) => { e.stopPropagation(); goToNft(item.id); }}
                >
                  Preview
                </Button>
                <Button
                  size="sm"
                  className={`flex-1 text-white ${
                    item.subtype === 'auction'
                      ? 'bg-gradient-to-r from-red-500 to-pink-500'
                      : item.subtype === 'mystery'
                      ? 'bg-gradient-to-r from-fuchsia-500 to-purple-600'
                      : 'bg-gradient-to-r from-emerald-500 to-blue-500'
                  }`}
                  onClick={(e) => { e.stopPropagation(); goToNft(item.id); }}
                >
                  {primaryLabel}
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const FractionalizedGrid = () => (
    // Unified card layout matching NFT / Content Keys / Bounty: 1/2/3/4 cols.
    // Buy / Sell / Claim controls have moved to the dedicated detail page.
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {mockChain.fractionalizedNfts.map(nft => {
        const pct = Math.round((nft.soldFragments / nft.totalFragments) * 100);
        const available = nft.totalFragments - nft.soldFragments;
        const goToFraction = () =>
          navigate(`/marketplace/fraction/${nft.id}`, { state: { from: fromPath } });
        const owns = nft.ownedFragments > 0;
        return (
          <div
            key={nft.id}
            className="bg-card rounded-xl border overflow-hidden hover:shadow-md hover:border-indigo-400/40 transition-all flex flex-col cursor-pointer group"
            onClick={goToFraction}
          >
            {/* Cover — indigo gradient + emoji as the visual identity. */}
            <div className="relative aspect-square bg-gradient-to-br from-indigo-500/20 via-blue-500/15 to-purple-500/20 overflow-hidden flex flex-col items-center justify-center p-4">
              <div className="text-7xl mb-2 group-hover:scale-105 transition-transform duration-500">
                {nft.coverEmoji}
              </div>
              <div className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">
                Fractional
              </div>

              {/* Status badge */}
              <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-[10px] font-bold shadow-sm">
                <Layers className="w-3 h-3" /> Shared
              </div>
              <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-black/60 backdrop-blur text-white text-[10px] font-semibold">
                NFT
              </div>
              {owns && (
                <div className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow-sm">
                  You own {nft.ownedFragments}
                </div>
              )}
            </div>

            {/* Body */}
            <div className="p-4 flex-1 flex flex-col">
              <h3 className="font-semibold text-sm line-clamp-2 mb-1 min-h-[2.5rem]">{nft.title}</h3>
              <p className="text-[11px] text-muted-foreground mb-3">by {nft.creator}</p>

              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Price / Fragment</div>
                  <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{nft.pricePerFragment} ORA</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground">Available</div>
                  <div className="text-[11px] font-medium">{available.toLocaleString()}/{nft.totalFragments.toLocaleString()}</div>
                </div>
              </div>

              {/* Sold progress bar */}
              <div className="mb-3 mt-auto">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>{pct}% sold</span>
                  <span>Pool: {nft.revenue.toLocaleString()} ORA</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={(e) => { e.stopPropagation(); goToFraction(); }}
                >
                  Preview
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-blue-500 text-white hover:from-indigo-600 hover:to-blue-600"
                  onClick={(e) => { e.stopPropagation(); goToFraction(); }}
                >
                  {available <= 0 ? 'Sold out' : 'Trade'}
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const getDeadlineStr = (iso: string) => {
    const diff = new Date(iso).getTime() - Date.now();
    if (diff <= 0) return 'Closed';
    const days = Math.floor(diff / 86400000);
    return days > 0 ? `${days}d left` : 'Today';
  };

  const BountyGrid = () => (
    // Bounty browse grid — unified card layout matching NFT + Content Keys
    // tabs (1/2/3/4 columns). Bounties have no cover image, so the cover
    // area uses an emerald gradient + briefcase icon as a "job brief" badge.
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {mockChain.bounties.map(item => {
        const isCompleted = item.status === 'completed';
        const goToBounty = () => navigate(`/marketplace/bounty/${item.id}`, { state: { from: fromPath } });
        return (
          <div
            key={item.id}
            className="bg-card rounded-xl border overflow-hidden hover:shadow-md hover:border-emerald-400/40 transition-all flex flex-col cursor-pointer group"
            onClick={goToBounty}
          >
            {/* Cover — no image, gradient + icon stands in. Aspect-square keeps
                the card aligned horizontally with NFT / Content Key tiles. */}
            <div className="relative aspect-square bg-gradient-to-br from-emerald-500/20 via-green-500/15 to-teal-500/20 overflow-hidden flex flex-col items-center justify-center p-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-500">
                <Briefcase className="w-10 h-10 text-white" />
              </div>
              <div className="mt-3 text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
                Bounty Mission
              </div>

              {/* Status badge */}
              <div className="absolute top-2 left-2">
                {isCompleted ? (
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500 text-white text-[10px] font-bold shadow-sm">
                    <CheckCircle className="w-3 h-3" /> Completed
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow-sm animate-pulse">
                    <Clock className="w-3 h-3" /> Open
                  </div>
                )}
              </div>
              <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-black/60 backdrop-blur text-white text-[10px] font-semibold">
                Bounty
              </div>
            </div>

            {/* Body — mirrors PrimaryKeyCard / NFT card density. */}
            <div className="p-4 flex-1 flex flex-col">
              <h3 className="font-semibold text-sm line-clamp-2 mb-1 min-h-[2.5rem]">{item.title}</h3>
              <p className="text-[11px] text-muted-foreground mb-2">
                {t.marketplace.bounty.publisher} @{item.creator}
              </p>
              <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3 leading-snug">
                {item.description}
              </p>

              <div className="flex items-center justify-between mb-3 mt-auto">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                    {t.marketplace.bounty.reward}
                  </div>
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {item.reward.toLocaleString()} ORA
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-flex items-center gap-1 text-[10px] text-muted-foreground justify-end">
                    <Users className="w-3 h-3" />
                    {item.submissionCount} submission{item.submissionCount === 1 ? '' : 's'}
                  </div>
                  <div className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 justify-end">
                    <Clock className="w-3 h-3" />
                    {getDeadlineStr(item.deadline)}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={(e) => { e.stopPropagation(); goToBounty(); }}
                >
                  Preview
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600"
                  onClick={(e) => { e.stopPropagation(); goToBounty(); }}
                >
                  {isCompleted ? 'View Results' : t.marketplace.bounty.participate}
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    // Outer shell mirrors ExplorePage: pt-[60px] for the floating mobile header,
    // full-width (no max-w cap), generous bottom padding so content can breathe.
    <div className="pt-[60px] md:pt-2 pb-24 md:pb-4 min-h-screen">
      {/* Sticky top bar — the page title + subtitle were removed (felt redundant
         with the sidebar nav). Search is now the primary affordance, paired
         with the Market Active health badge. */}
      <div className="sticky top-[60px] md:top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/40">
        <div className="flex items-center gap-3 p-4 px-4 md:px-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t.marketplace.searchPlaceholder}
              className="pl-9 h-10 rounded-2xl bg-secondary/50 border-transparent focus:bg-background focus:border-aura/30 transition-all text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {/* Buy ORA CTA (2026-05-11) — replaced the old "Market Active" pure-decorative
             badge. The marketplace is where users spend ORA the most (Creator Coin buys,
             NFT purchases, keys, bounties), so surfacing a one-click top-up here removes
             the most common dead-end in the flow. Shows current balance inline so the
             user knows how much they have before deciding to buy. */}
          <button
            type="button"
            onClick={() => buyOra.open()}
            className="flex-shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white text-xs font-semibold shadow-sm hover:shadow-md transition-all whitespace-nowrap group"
            title={`Buy ORA (you have ${mockChain.oraBalance.toFixed(2)} ORA)`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Buy ORA</span>
            <span className="sm:hidden">ORA</span>
            <span className="font-mono tabular-nums text-[10px] bg-white/20 px-1.5 py-0.5 rounded">
              {mockChain.oraBalance.toFixed(2)}
            </span>
            <Plus className="w-3 h-3 opacity-80 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>
      </div>

      {/* Body — left-aligned flush against the sidebar like ExplorePage. */}
      <div className="px-4 md:px-6 pt-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="coins" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              {t.marketplace.tabs.coins}
            </TabsTrigger>
            <TabsTrigger value="nft" className="flex items-center gap-2">
              <Gift className="w-4 h-4" />
              {t.marketplace.tabs.nft}
            </TabsTrigger>
            <TabsTrigger value="keys" className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              Content Keys
            </TabsTrigger>
            <TabsTrigger value="bounty" className="flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              {t.marketplace.tabs.bounty}
            </TabsTrigger>
            <TabsTrigger value="fractions" className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Fractions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="coins" className="mt-6">
            <CoinsGrid />
          </TabsContent>

          <TabsContent value="nft" className="mt-6 space-y-4">
            <TabIntroCard
              gradient="from-pink-50 to-rose-50 dark:from-pink-900/10 dark:to-rose-900/10"
              border="border-pink-200/50 dark:border-pink-800/50"
              titleColor="text-pink-800 dark:text-pink-200"
              iconColor="text-pink-600"
              icon={<Gift className="w-6 h-6" />}
              title="NFT Collection"
              description="1-of-1 artworks and limited editions minted by creators. Auctions settle on-chain when the timer ends; fixed-price drops can be claimed instantly. Every purchase routes royalties back to the creator."
            />
            <NFTGrid />
          </TabsContent>

          <TabsContent value="keys" className="mt-6">
            <ContentKeysTab
              navigate={navigate}
              fromPath={fromPath}
              setKeyPurchaseAmount={setKeyPurchaseAmount}
            />
          </TabsContent>

          <TabsContent value="bounty" className="mt-6 space-y-4">
            <TabIntroCard
              gradient="from-emerald-50 to-green-50 dark:from-emerald-900/10 dark:to-green-900/10"
              border="border-emerald-200/50 dark:border-emerald-800/50"
              titleColor="text-emerald-800 dark:text-emerald-200"
              iconColor="text-emerald-600"
              icon={<Briefcase className="w-6 h-6" />}
              title="Bounty Missions"
              description="Open creator briefs with ORA rewards. Submit your work, the creator picks a winner, and the protocol releases payment automatically. A clean way to commission art, code, music, or research from the AURA community."
            />
            <BountyGrid />
          </TabsContent>
          <TabsContent value="fractions" className="mt-6 space-y-4">
            <TabIntroCard
              gradient="from-indigo-50 to-blue-50 dark:from-indigo-900/10 dark:to-blue-900/10"
              border="border-indigo-200/50 dark:border-indigo-800/50"
              titleColor="text-indigo-800 dark:text-indigo-200"
              iconColor="text-indigo-600"
              icon={<Layers className="w-6 h-6" />}
              title="Fractional Ownership"
              description="Co-own a high-value NFT in fractional shares. Buy a fraction, vote on sales, earn yield when the underlying piece appreciates. Lower the floor to participate in works that would otherwise be out of reach."
            />
            <FractionalizedGrid />
          </TabsContent>
        </Tabs>
      </div>

      {keyPurchaseAmount !== null && (
        <TransactionSuccess
          amount={keyPurchaseAmount}
          label="NFT Key Purchased!"
          onClose={() => setKeyPurchaseAmount(null)}
          autoDismissMs={3000}
        />
      )}
    </div>
  );
}

/**
 * Content Keys tab — marketplace for premium creator content access.
 *
 * Sourced from real Iris posts marked `isPremium: true` in mock.ts. Each
 * card represents a unique on-chain key that unlocks the post forever.
 *
 * Includes both:
 *   • Primary listings: keys minted by creators (Iris's premium posts)
 *   • Resale market: keys re-listed by holders (`mockChain.listedKeys`)
 *
 * Removed: "Your Content Keys" — the marketplace is for trading, not for
 * showing the user's own holdings. Owned keys live in the wallet/profile.
 */
function ContentKeysTab({
  navigate, fromPath, setKeyPurchaseAmount,
}: {
  navigate: ReturnType<typeof useNavigate>;
  fromPath: string;
  setKeyPurchaseAmount: (n: number) => void;
}) {
  const mockChain = useMockChain();
  const { showToast } = useToast();
  const { user: me } = useAuth();
  // 2026-05-11 R17: also surface the current user's premium posts in the
  // Content Keys tab — previously the filter only included Iris's seed
  // posts so user-published premium content was invisible in the
  // marketplace.
  const myPosts = useUserPosts(me as any);

  // Primary keys = every premium post on the protocol that has a price.
  // Today the seed corpus is just Iris; once users publish gated content
  // it shows up here automatically.
  const primaryKeys = [...myPosts, ...allPosts].filter(
    p => p.isPremium && p.premiumPrice,
  );

  const buyPrimary = async (postId: string, price: number) => {
    try {
      await mockChain.buyContentKey(postId, price);
      setKeyPurchaseAmount(price);
    } catch (e: any) {
      showToast('error', e?.message || 'Purchase failed');
    }
  };

  const goToContent = (postId: string) =>
    navigate(`/premium/${postId}`, { state: { from: fromPath } });

  const totalListings = primaryKeys.length + mockChain.listedKeys.length;

  return (
    <div className="space-y-6">
      <TabIntroCard
        gradient="from-amber-50 to-yellow-50 dark:from-amber-900/10 dark:to-yellow-900/10"
        border="border-amber-200/50 dark:border-amber-800/50"
        titleColor="text-amber-800 dark:text-amber-200"
        iconColor="text-amber-600"
        icon={<Key className="w-6 h-6" />}
        title="Content Keys"
        description="Premium content (long-form essays, gated tracks, exclusive videos) is unlocked by holding the right key. Buy a key once, access the post forever — and resell on the secondary market when you're done."
      />

      {totalListings === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-4xl mb-3">🔑</div>
          <p className="font-medium">No Content Keys listed yet</p>
          <p className="text-sm mt-1">When creators mark posts as premium, their keys appear here.</p>
        </div>
      ) : (
        <>
          {/* Primary listings — creator-minted keys */}
          {primaryKeys.length > 0 && (
            <section>
              <div className="mb-3 flex items-baseline justify-between">
                <h3 className="text-base font-bold">From creators</h3>
                <span className="text-[11px] text-muted-foreground">
                  {primaryKeys.length} key{primaryKeys.length === 1 ? '' : 's'} · minted by the artist
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {primaryKeys.map(post => {
                  // 2026-05-11 R18: don't ask the creator to buy their own
                  // post, and don't ask repeat-customers to re-buy.
                  const isOwner = !!(me && post.author?.id === me.id);
                  const alreadyOwned = (mockChain.ownedKeys || []).some(k => k.contentId === post.id);
                  return (
                    <PrimaryKeyCard
                      key={post.id}
                      post={post}
                      isOwner={isOwner}
                      alreadyOwned={alreadyOwned}
                      onBuy={() => buyPrimary(post.id, post.premiumPrice!)}
                      onPreview={() => goToContent(post.id)}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {/* Secondary listings — resale */}
          {mockChain.listedKeys.length > 0 && (
            <section>
              <div className="mb-3 flex items-baseline justify-between">
                <h3 className="text-base font-bold">Secondary market</h3>
                <span className="text-[11px] text-muted-foreground">
                  {mockChain.listedKeys.length} resale listing{mockChain.listedKeys.length === 1 ? '' : 's'} · 5% royalty to creator
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {mockChain.listedKeys.map(key => (
                  <div key={key.keyId} className="bg-card rounded-xl p-4 border hover:border-amber-400/40 hover:shadow-md transition-all">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#F59E0B]/20 to-orange-500/20 flex items-center justify-center text-xl flex-shrink-0">🔑</div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold truncate text-sm">{key.title}</h4>
                        <p className="text-[11px] text-muted-foreground truncate">
                          Reseller: {key.seller.slice(0, 8)}…
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-lg font-bold text-[#F59E0B] tabular-nums">{key.askPrice.toFixed(4)} ORA</span>
                      <Badge variant="secondary" className="text-[10px]">Sell order</Badge>
                    </div>
                    <Button
                      size="sm"
                      onClick={async () => {
                        try { await mockChain.buyListedKey(key.keyId); setKeyPurchaseAmount(key.askPrice); }
                        catch (e: any) { showToast('error', e?.message || 'Purchase failed'); }
                      }}
                      className="w-full bg-gradient-to-r from-[#F59E0B] to-orange-500 text-white"
                    >
                      Take sell order — {key.askPrice.toFixed(4)} ORA
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Card for a primary content key listing. Shows the post's cover (or a key
 * gradient placeholder for plain text essays), the title + content type,
 * price, and Buy/Preview actions.
 */
function PrimaryKeyCard({
  post, onBuy, onPreview, isOwner = false, alreadyOwned = false,
}: {
  post: import('@/types').Post;
  onBuy: () => void;
  onPreview: () => void;
  /** 2026-05-11 R18: viewer authored this post — hide Buy CTA. */
  isOwner?: boolean;
  /** 2026-05-11 R18: viewer already holds a Content Key for this post. */
  alreadyOwned?: boolean;
}) {
  const cover = post.coverImage || post.images?.[0];
  const typeLabel: Record<string, { label: string; emoji: string }> = {
    audio: { label: 'Track',   emoji: '🎵' },
    photo: { label: 'Photo',   emoji: '📷' },
    text:  { label: 'Essay',   emoji: '✍️' },
    video: { label: 'Video',   emoji: '🎬' },
    live:  { label: 'Live',    emoji: '🔴' },
  };
  const meta = typeLabel[post.type] || { label: 'Post', emoji: '🔑' };

  return (
    // Whole card is clickable → jumps to preview. Buy button stops propagation
    // so it triggers a purchase instead of a navigation.
    <div
      onClick={onPreview}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPreview(); } }}
      className="bg-card rounded-xl border overflow-hidden hover:border-amber-400/40 hover:shadow-md transition-all flex flex-col cursor-pointer group"
    >
      {/* Cover — image when present, gradient + emoji fallback for essays */}
      <div className="relative aspect-square bg-muted overflow-hidden">
        {cover ? (
          <img src={cover} alt={post.title || ''} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-400/30 via-orange-500/20 to-pink-500/20 flex flex-col items-center justify-center p-4">
            <span className="text-5xl mb-2">{meta.emoji}</span>
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wide">{meta.label}</span>
          </div>
        )}
        {/* Gated overlay */}
        <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500 text-white text-[10px] font-bold shadow-sm">
          <Key className="w-3 h-3" /> Gated
        </div>
        <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-black/60 backdrop-blur text-white text-[10px] font-semibold">
          {meta.label}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col">
        <h4 className="font-semibold text-sm line-clamp-2 mb-1 min-h-[2.5rem]">
          {post.title || (post.content ? post.content.slice(0, 60) : 'Untitled')}
        </h4>
        <p className="text-[11px] text-muted-foreground mb-3">by @{post.author.username}</p>

        <div className="flex items-center justify-between mb-3 mt-auto">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Key price</div>
            <div className="text-lg font-bold text-[#F59E0B]">{post.premiumPrice} ORA</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground">{post.likes.toLocaleString()} likes</div>
            <div className="text-[10px] text-muted-foreground">{post.comments.toLocaleString()} comments</div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={(e) => { e.stopPropagation(); onPreview(); }}
          >
            {isOwner || alreadyOwned ? 'View' : 'Preview'}
          </Button>
          {isOwner ? (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-aura/40 text-aura"
              disabled
            >
              Your post
            </Button>
          ) : alreadyOwned ? (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
              disabled
            >
              Owned
            </Button>
          ) : (
            <Button
              size="sm"
              className="flex-1 bg-gradient-to-r from-[#F59E0B] to-orange-500 text-white"
              onClick={(e) => { e.stopPropagation(); onBuy(); }}
            >
              Buy Key
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// TabIntroCard now lives in src/components/common/TabIntroCard.tsx so the
// Curation page — and any future tabbed surface — can reuse the same shape.