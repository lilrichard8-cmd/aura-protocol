import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useGoBack } from '@/hooks/useGoBack';
import {
  ArrowLeft, Heart, Share2, Clock, Tag, User as UserIcon, Activity, Eye,
  ExternalLink, Coins, Compass, ShieldCheck, Sparkles, Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import UserAvatar from '@/components/UserAvatar';
import { useToast } from '@/context/ToastContext';
import { useOraGuard } from '@/hooks/useOraGuard';
import { useMockChain } from '@/context/MockChainContext';
import { getNftById, NFT_CATALOG, type NftRecord } from '@/data/nfts';

/**
 * NFT detail page.
 *
 * Wired to the canonical `NFT_CATALOG` (src/data/nfts.ts), not hardcoded
 * mocks. All amounts are denominated in ORA — the AURA protocol's native
 * Solana token. Empty bid history is shown honestly instead of being padded
 * with fake bidders.
 */
export default function NftDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  // Smart back: returns to wherever the user navigated in from (passed via
  // location.state.from), falling back to /marketplace if entry has no state
  // OR there's no browser history (direct URL load / refresh / new tab).
  const goBack = useGoBack('/marketplace');
  const { showToast } = useToast();
  const oraGuard = useOraGuard();
  const mockChain = useMockChain();
  const [bidAmount, setBidAmount] = useState('');
  const [isBidding, setIsBidding] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  // Mystery-box reveal state: id of the NFT the box revealed (after purchase).
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [isOpeningBox, setIsOpeningBox] = useState(false);

  const nftData: NftRecord | undefined = getNftById(id);

  // ── Not-found state ──────────────────────────────────────────────────────
  if (!nftData) {
    return (
      <div className="pt-[60px] md:pt-2 pb-24 md:pb-4 min-h-screen">
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-aura/20 to-cyan-400/20 flex items-center justify-center mb-4">
            <Compass className="w-7 h-7 text-aura" />
          </div>
          <h1 className="text-lg font-bold mb-2">NFT not found</h1>
          <p className="text-sm text-muted-foreground max-w-xs mb-6">
            The NFT id <code className="font-mono">{id}</code> isn't in the catalog yet. Browse what's live in the marketplace.
          </p>
          <Link
            to="/marketplace"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-aura text-white text-sm font-bold hover:opacity-90 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getTimeRemaining = () => {
    if (!nftData.auctionEnd) return null;
    const now = Date.now();
    const end = new Date(nftData.auctionEnd).getTime();
    const ms = end - now;
    if (ms <= 0) return { expired: true, days: 0, hours: 0, minutes: 0 };
    const totalMin = Math.floor(ms / 60_000);
    const days = Math.floor(totalMin / (60 * 24));
    const hours = Math.floor((totalMin / 60) % 24);
    const minutes = totalMin % 60;
    return { expired: false, days, hours, minutes };
  };

  const handleBid = async () => {
    const amount = parseFloat(bidAmount);
    const minBid = (nftData.highestBid ?? nftData.price) + 0.1;
    if (!amount || amount < minBid) {
      showToast('error', `Bid must be at least ${minBid.toFixed(1)} ORA`);
      return;
    }
    if (!oraGuard.ensure(amount, 'NFT bid')) return;
    setIsBidding(true);
    // Simulated chain confirmation; real flow lives in MockChainContext later.
    await new Promise(r => setTimeout(r, 1500));
    setIsBidding(false);
    setBidAmount('');
    showToast('success', `Bid placed! Your bid: ${amount} ORA`);
  };

  const handlePurchase = async () => {
    if (!oraGuard.ensure(nftData.price, 'NFT purchase')) return;
    setIsPurchasing(true);
    try {
      await mockChain.acquireNft({
        nftId: nftData.id,
        name: nftData.name,
        price: nftData.price,
        acquisitionType: 'fixed',
        coverImage: nftData.image,
      });
      showToast('success', `Purchased ${nftData.name} for ${nftData.price} ORA`);
    } catch (e: any) {
      if (/insufficient/i.test(e?.message ?? '')) {
        oraGuard.ensure(nftData.price, 'NFT purchase');
      } else {
        showToast('error', e?.message || 'Purchase failed');
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  /**
   * Mystery box — simulate sealed-pull reveal. Picks a random pool member,
   * resolves the actual NFT record (so we can show its real artwork), and
   * displays the reveal panel. "unreleased" pool entries that don't exist in
   * NFT_CATALOG are surfaced as a generic "Unreleased" card.
   */
  const handleOpenBox = async () => {
    if (!nftData.mysteryBox) return;
    if (!oraGuard.ensure(nftData.price, 'Mystery box')) return;
    setIsOpeningBox(true);
    try {
      await new Promise(r => setTimeout(r, 1800));
      const pool = nftData.mysteryBox.pool;
      const pickId = pool[Math.floor(Math.random() * pool.length)];
      const revealedNft = getNftById(pickId);
      // Record the reveal so the user actually owns the revealed NFT.
      // If the pick is an "unreleased" placeholder (no catalog entry yet), record
      // it under its id with a generic name so it still shows up in inventory.
      await mockChain.acquireNft({
        nftId: pickId,
        name: revealedNft?.name ?? `Unreleased #${pickId.slice(-4)}`,
        price: nftData.price,
        acquisitionType: 'mystery',
        coverImage: revealedNft?.image,
      });
      setRevealedId(pickId);
      showToast('success', `Box opened for ${nftData.price} ORA`);
    } catch (e: any) {
      if (/insufficient/i.test(e?.message ?? '')) {
        oraGuard.ensure(nftData.price, 'Mystery box');
      } else {
        showToast('error', e?.message || 'Box failed');
      }
    } finally {
      setIsOpeningBox(false);
    }
  };

  const handleLike = () => {
    setLiked(!liked);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);
  };

  /** Friendly relative time, e.g. "5m ago", "3h ago", "2d ago", "Apr 15". */
  const formatRelative = (iso: string) => {
    const t = new Date(iso).getTime();
    const ms = Date.now() - t;
    if (ms < 60_000) return 'just now';
    if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
    if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
    if (ms < 7 * 86_400_000) return `${Math.floor(ms / 86_400_000)}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const shortAddress = (addr: string) =>
    addr.length <= 12 ? addr : `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  const timeRemaining = getTimeRemaining();
  const minBid = ((nftData.highestBid ?? nftData.price) + 0.1).toFixed(1);

  return (
    // Outer shell mirrors ExplorePage / MarketplacePage: full-width, edge-to-edge,
    // no max-w cap, with bottom padding for breathing room.
    <div className="pt-[60px] md:pt-2 pb-24 md:pb-4 min-h-screen">
      {/* Header — sticky, full-width. */}
      <div className="sticky top-[60px] md:top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/40">
        <div className="flex items-center justify-between p-4 px-4 md:px-6">
          <div className="flex items-center gap-4 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={goBack}
              className="shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold truncate">{nftData.name}</h1>
              <p className="text-sm text-muted-foreground truncate">{nftData.collection.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleLike}>
              <Heart className={`w-4 h-4 ${liked ? 'fill-red-500 text-red-500' : ''}`} />
              <span className="ml-1">{likeCount + nftData.likes}</span>
            </Button>
            <Button variant="ghost" size="sm">
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Body — left-aligned flush against the sidebar. */}
      <div className="px-4 md:px-6 pt-6">
        {/* Desktop: 50/50 layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left: image + collection + attributes */}
          <div className="space-y-4">
            <div className="aspect-square bg-muted rounded-xl overflow-hidden">
              <img
                src={nftData.image}
                alt={nftData.name}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Collection */}
            <div className="bg-card rounded-xl p-4 border">
              <h3 className="font-semibold mb-3">{nftData.collection.name}</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold">{nftData.collection.floorPrice} ORA</div>
                  <div className="text-sm text-muted-foreground">Floor Price</div>
                </div>
                <div>
                  <div className="text-lg font-bold">{nftData.collection.totalSupply}</div>
                  <div className="text-sm text-muted-foreground">Total Supply</div>
                </div>
                <div>
                  <div className="text-lg font-bold">{nftData.collection.items}</div>
                  <div className="text-sm text-muted-foreground">Minted</div>
                </div>
              </div>
            </div>

            {/* Attributes */}
            <div className="bg-card rounded-xl p-4 border">
              <h3 className="font-semibold mb-3">Attributes</h3>
              <div className="grid grid-cols-2 gap-3">
                {nftData.attributes.map((attr, index) => (
                  <div key={index} className="border rounded-lg p-3 text-center">
                    <div className="text-xs text-muted-foreground mb-1">{attr.trait_type}</div>
                    <div className="font-medium">{attr.value}</div>
                    {attr.rarity && (
                      <div className="text-xs text-aura mt-1">{attr.rarity}% rarity</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: details + purchase + tabs */}
          <div className="space-y-6">
            {/* Title + meta */}
            <div className="space-y-4">
              <div>
                <h1 className="text-3xl font-bold mb-2">{nftData.name}</h1>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    <span>{nftData.views.toLocaleString()} views</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Heart className="w-4 h-4" />
                    <span>{nftData.likes + likeCount} saves</span>
                  </div>
                </div>
                <p className="text-muted-foreground leading-relaxed">{nftData.description}</p>
              </div>

              {/* Creator & Owner */}
              <div className="grid grid-cols-2 gap-4">
                <UserBadgeCard
                  label="Creator"
                  user={nftData.creator}
                  onClick={() => nftData.creator.username && navigate(`/u/${nftData.creator.username}`)}
                />
                <UserBadgeCard
                  label="Current Owner"
                  user={nftData.owner}
                  onClick={() => nftData.owner.username && navigate(`/u/${nftData.owner.username}`)}
                />
              </div>
            </div>

            {/* Price + Action — three modes: auction / fixed / mystery box. */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-xl p-6 border border-purple-200/50 dark:border-purple-800/50">
              {nftData.listingType === 'mystery' && nftData.mysteryBox ? (
                <MysteryBoxPanel
                  nft={nftData}
                  isOpening={isOpeningBox}
                  revealedId={revealedId}
                  onOpen={handleOpenBox}
                  onResetReveal={() => setRevealedId(null)}
                  onViewRevealed={(id) => navigate(`/marketplace/nft/${id}`, { state: { from: '/marketplace?tab=nft' } })}
                />
              ) : nftData.listingType === 'auction' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold">Auction Live</h3>
                    <Badge className="bg-red-500 text-white animate-pulse">
                      <Clock className="w-3 h-3 mr-1" />
                      Auction
                    </Badge>
                  </div>

                  {timeRemaining && !timeRemaining.expired && (
                    <div className="text-center mb-4">
                      <div className="text-sm text-muted-foreground mb-1">Auction Ends</div>
                      <div className="flex justify-center gap-2 text-lg font-bold">
                        <span>{timeRemaining.days}d</span>
                        <span>{timeRemaining.hours}h</span>
                        <span>{timeRemaining.minutes}m</span>
                      </div>
                    </div>
                  )}
                  {timeRemaining?.expired && (
                    <div className="text-center mb-4 text-sm text-muted-foreground">
                      Auction ended
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex justify-between items-baseline">
                      <span className="text-muted-foreground">
                        {nftData.highestBid ? 'Highest Bid' : 'Reserve Price'}
                      </span>
                      <span className="text-2xl font-bold">
                        {(nftData.highestBid ?? nftData.price)} ORA
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder={`Min ${minBid} ORA`}
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        className="flex-1"
                        disabled={timeRemaining?.expired}
                      />
                      <Button
                        onClick={handleBid}
                        disabled={isBidding || timeRemaining?.expired}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
                      >
                        {isBidding ? 'Placing Bid…' : 'Place Bid'}
                      </Button>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Min bid: {minBid} ORA · {nftData.royalty}% creator royalty on each sale
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Fixed Price</h3>
                    <Badge variant="secondary">Buy Now</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Price</span>
                    <span className="text-3xl font-bold">{nftData.price} ORA</span>
                  </div>

                  <Button
                    onClick={handlePurchase}
                    disabled={isPurchasing}
                    className="w-full bg-gradient-to-r from-green-500 to-blue-500 text-white hover:from-green-600 hover:to-blue-600"
                    size="lg"
                  >
                    {isPurchasing ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Purchasing…
                      </div>
                    ) : (
                      <>
                        <Coins className="w-4 h-4 mr-2" />
                        Buy for {nftData.price} ORA
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Additional Info — same row regardless of listing mode. */}
              <div className="mt-4 pt-4 border-t border-border/50 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Royalty</span>
                  <span>{nftData.royalty}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Blockchain</span>
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-aura" /> {nftData.blockchain}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Token ID</span>
                  <span className="font-mono">{nftData.tokenId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mint Address</span>
                  <span className="font-mono text-xs" title={nftData.mintAddress}>
                    {shortAddress(nftData.mintAddress)}
                  </span>
                </div>
              </div>
            </div>

            {/* Activity Tabs — hide "Bid History" for non-auction listings. */}
            <div className="bg-card rounded-xl border">
              <Tabs defaultValue={nftData.listingType === 'auction' ? 'bids' : 'history'} className="w-full">
                <TabsList className={`grid w-full ${nftData.listingType === 'auction' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {nftData.listingType === 'auction' && (
                    <TabsTrigger value="bids">Bid History</TabsTrigger>
                  )}
                  <TabsTrigger value="history">Trade History</TabsTrigger>
                </TabsList>

                <TabsContent value="bids" className="p-6 space-y-4">
                  {nftData.bidHistory.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <Activity className="w-8 h-8 mx-auto mb-2 opacity-60" />
                      <p className="font-medium">No bids yet</p>
                      <p className="text-xs mt-1">Be the first to bid on this piece.</p>
                    </div>
                  ) : (
                    nftData.bidHistory.map((bid) => (
                      <div key={bid.id} className="flex items-center gap-3 p-3 border rounded-lg">
                        <UserAvatar
                          src={bid.bidder.avatar}
                          displayName={bid.bidder.displayName}
                          username={bid.bidder.username}
                          className="w-8 h-8 rounded-full"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{bid.bidder.displayName}</span>
                            <Badge
                              variant={bid.status === 'active' ? 'default' : 'secondary'}
                              className={bid.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' : ''}
                            >
                              {bid.status === 'active' ? 'Highest Bid' : 'Outbid'}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            @{bid.bidder.username} · {formatRelative(bid.timestamp)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{bid.amount} ORA</div>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="history" className="p-6 space-y-4">
                  {nftData.saleHistory.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <Activity className="w-8 h-8 mx-auto mb-2 opacity-60" />
                      <p className="font-medium">No on-chain history yet</p>
                    </div>
                  ) : (
                    nftData.saleHistory.map((event) => (
                      <div key={event.id} className="flex items-center gap-3 p-3 border rounded-lg">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          event.type === 'sale'      ? 'bg-green-100'
                            : event.type === 'transfer' ? 'bg-blue-100'
                            : event.type === 'list'     ? 'bg-orange-100'
                            : event.type === 'bid'      ? 'bg-pink-100'
                            : 'bg-purple-100'
                        }`}>
                          {event.type === 'sale'     && <Coins className="w-4 h-4 text-green-600" />}
                          {event.type === 'transfer' && <UserIcon className="w-4 h-4 text-blue-600" />}
                          {event.type === 'list'     && <Tag className="w-4 h-4 text-orange-600" />}
                          {event.type === 'bid'      && <Activity className="w-4 h-4 text-pink-600" />}
                          {event.type === 'mint'     && <Tag className="w-4 h-4 text-purple-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium capitalize">{event.type}</div>
                          <div className="text-sm text-muted-foreground truncate">
                            {event.from && `from @${event.from.username} `}
                            {event.to && (event.from ? 'to ' : '')}
                            {event.to && `@${event.to.username}`}
                            {' · '}
                            {formatRelative(event.timestamp)}
                          </div>
                        </div>
                        <div className="text-right">
                          {event.price !== undefined && (
                            <div className="font-bold">{event.price} ORA</div>
                          )}
                          {event.txHash && (
                            <Button variant="ghost" size="sm" className="h-6 px-2" title={event.txHash}>
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Small reused user-card used for both Creator and Owner blocks.
 */
/**
 * Mystery box panel — buy-to-reveal UX.
 *
 * Three states:
 *   1. Sealed (no purchase yet): pool preview (blurred thumbnails + ?) + Open Box CTA
 *   2. Opening: spinner with "Sealing the box…" copy
 *   3. Revealed: hero card showing the won NFT + view-piece + buy-another CTAs
 */
function MysteryBoxPanel({
  nft, isOpening, revealedId, onOpen, onResetReveal, onViewRevealed,
}: {
  nft: NftRecord;
  isOpening: boolean;
  revealedId: string | null;
  onOpen: () => void;
  onResetReveal: () => void;
  onViewRevealed: (id: string) => void;
}) {
  const config = nft.mysteryBox!;
  const remaining = config.edition - config.sold;
  const revealed = revealedId ? NFT_CATALOG.find(n => n.id === revealedId) : null;

  if (revealedId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold inline-flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-fuchsia-500" /> Box Opened!
          </h3>
          <Badge className="bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white">
            <Package className="w-3 h-3 mr-1" /> Mystery Box
          </Badge>
        </div>

        <div className="rounded-2xl border border-fuchsia-200/60 dark:border-fuchsia-900/50 bg-card overflow-hidden">
          {revealed ? (
            <>
              <div className="aspect-video bg-muted overflow-hidden">
                <img
                  src={revealed.image}
                  alt={revealed.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4">
                <div className="text-[11px] uppercase tracking-wide text-fuchsia-600 dark:text-fuchsia-400 font-bold mb-1">
                  You revealed
                </div>
                <div className="text-base font-bold">{revealed.name}</div>
                <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {revealed.description}
                </div>
                <Button
                  className="w-full mt-3 bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white"
                  onClick={() => onViewRevealed(revealed.id)}
                >
                  View piece
                </Button>
              </div>
            </>
          ) : (
            // Pool entry not (yet) in the catalog — show as "Unreleased".
            <div className="p-6 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-fuchsia-500/30 to-purple-500/30 flex items-center justify-center text-3xl mb-3">
                🎁
              </div>
              <div className="text-base font-bold mb-1">Unreleased Piece</div>
              <div className="text-xs text-muted-foreground">
                You pulled an unreleased work from Iris’s vault. It’ll appear in your wallet once the artist lifts the embargo.
              </div>
            </div>
          )}
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={onResetReveal}
        >
          Open another box
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold inline-flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-fuchsia-500" /> Mystery Box
        </h3>
        <Badge className="bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white">
          <Package className="w-3 h-3 mr-1" /> Sealed
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">
        {config.summary}
      </p>

      {/* Pool preview — blurred thumbnails so users see the universe of pulls. */}
      <div>
        <div className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground mb-2">
          Possible pulls ({config.pool.length})
        </div>
        <div className="grid grid-cols-5 gap-2">
          {config.pool.map(pid => {
            const piece = NFT_CATALOG.find(n => n.id === pid);
            return (
              <div
                key={pid}
                className="relative aspect-square rounded-lg overflow-hidden border border-border/60 bg-muted"
                title={piece?.name ?? 'Unreleased piece'}
              >
                {piece ? (
                  <img
                    src={piece.image}
                    alt={piece.name}
                    className="w-full h-full object-cover blur-sm scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-fuchsia-500/20 to-purple-500/20" />
                )}
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <span className="text-white text-xl font-black drop-shadow">?</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Boxes left: <strong className="text-foreground">{remaining}/{config.edition}</strong></span>
        <span>{nft.royalty}% royalty on resale</span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Box price</span>
        <span className="text-3xl font-bold">{nft.price} ORA</span>
      </div>

      <Button
        onClick={onOpen}
        disabled={isOpening || remaining <= 0}
        size="lg"
        className="w-full bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white hover:from-fuchsia-600 hover:to-purple-700"
      >
        {isOpening ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Sealing the box…
          </div>
        ) : remaining <= 0 ? (
          'Sold out'
        ) : (
          <>
            <Package className="w-4 h-4 mr-2" /> Buy &amp; reveal
          </>
        )}
      </Button>

      <div className="text-[11px] text-muted-foreground text-center">
        Each pull is independent. Two boxes can reveal the same piece.
      </div>
    </div>
  );
}

function UserBadgeCard({
  label,
  user,
  onClick,
}: {
  label: string;
  user: { displayName: string; username: string; avatar: string; isVerified: boolean };
  onClick?: () => void;
}) {
  return (
    <div
      className="bg-card rounded-xl p-4 border hover:border-aura/40 transition-colors cursor-pointer"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <div className="text-sm text-muted-foreground mb-2">{label}</div>
      <div className="flex items-center gap-3">
        <img
          src={user.avatar}
          alt={user.displayName}
          className="w-10 h-10 rounded-full object-cover"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-medium truncate">{user.displayName}</span>
            {user.isVerified && (
              <div className="w-4 h-4 bg-aura rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                </svg>
              </div>
            )}
          </div>
          <div className="text-sm text-muted-foreground truncate">@{user.username}</div>
        </div>
      </div>
    </div>
  );
}
