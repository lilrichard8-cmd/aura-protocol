/**
 * NotificationsPage — Bilibili-style "message center" with a vertical
 * left-side category nav and a single content panel on the right.
 *
 * Categories:
 *   • Direct Messages (default) — wallet-to-wallet PMs (MessagesPage)
 *   • Replies / Comments — comment notifications
 *   • Likes — heart reactions
 *   • New followers — incoming follow events
 *   • Curation Rewards — redemption + curation pool events
 *   • Coin Activity — your Creator Coin trades
 *   • Governance — proposal alerts
 *
 * Each category shows its own unread badge and renders into the right
 * pane. The list of categories is fixed; counts live-update from the
 * mockChain notification streams.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Heart, MessageCircle, UserPlus, Gift, Coins, Vote, Check, Bell,
  MessageSquare, Sparkles, X, ArrowRight,
} from 'lucide-react';
import {
  type Notification,
  type NotificationType,
} from '@/data/mockP1';
import { useI18n } from '@/context/I18nContext';
import { useMockChain, type InAppNotification, type CoinTradeNotification } from '@/context/MockChainContext';
import { useDmUnread } from '@/hooks/useDmUnread';
import UserAvatar from '@/components/UserAvatar';
import MessagesPage from './MessagesPage';

type CategoryKey =
  | 'messages'
  | 'replies'
  | 'likes'
  | 'follows'
  | 'curation'
  | 'coins'
  | 'governance';

interface CategoryDef {
  key: CategoryKey;
  label: string;
  icon: typeof Heart;
  iconColor: string;
  iconBg: string;
  match?: (n: Notification) => boolean;
}

const CATEGORIES: CategoryDef[] = [
  { key: 'messages',  label: 'Direct messages',  icon: MessageSquare, iconColor: 'text-aura',          iconBg: 'bg-aura/10' },
  { key: 'replies',   label: 'Replies',          icon: MessageCircle, iconColor: 'text-blue-500',      iconBg: 'bg-blue-500/10', match: n => n.type === 'comment' },
  { key: 'likes',     label: 'Likes',            icon: Heart,         iconColor: 'text-red-500',       iconBg: 'bg-red-500/10', match: n => n.type === 'like' },
  { key: 'follows',   label: 'New followers',    icon: UserPlus,      iconColor: 'text-emerald-500',   iconBg: 'bg-emerald-500/10', match: n => n.type === 'follow' },
  { key: 'curation',  label: 'Curation rewards', icon: Gift,          iconColor: 'text-ora',           iconBg: 'bg-ora/10', match: n => n.type === 'curation_reward' },
  { key: 'coins',     label: 'Coin activity',    icon: Coins,         iconColor: 'text-purple-500',    iconBg: 'bg-purple-500/10', match: n => n.type === 'coin_trade' },
  { key: 'governance',label: 'Governance',       icon: Vote,          iconColor: 'text-fuchsia-500',   iconBg: 'bg-fuchsia-500/10', match: n => n.type === 'governance' },
];

function tradeTimeAgo(ts: number): string {
  const sec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

// Map URL slug → internal CategoryKey. The slugs are kept short and
// stable so the SideNav can link to them directly.
const CATEGORY_BY_SLUG: Record<string, CategoryKey> = {
  messages:   'messages',
  replies:    'replies',
  likes:      'likes',
  follows:    'follows',
  curation:   'curation',
  coins:      'coins',
  governance: 'governance',
};
const SLUG_BY_CATEGORY: Record<CategoryKey, string> = {
  messages:   'messages',
  replies:    'replies',
  likes:      'likes',
  follows:    'follows',
  curation:   'curation',
  coins:      'coins',
  governance: 'governance',
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const mockChain = useMockChain();

  // Active category is derived from the URL: /notifications/:slug.
  // Falls back to 'messages' for the bare /notifications path.
  const slug = location.pathname.replace(/^\/notifications\/?/, '').split('/')[0];
  const active: CategoryKey = (CATEGORY_BY_SLUG[slug] ?? 'messages');
  const setActive = (next: CategoryKey) => {
    navigate(`/notifications/${SLUG_BY_CATEGORY[next]}`);
  };
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const myWallet = mockChain.connected
    ? (mockChain.publicKey || mockChain.walletAddress || '')
    : null;
  const dmUnread = useDmUnread(myWallet);

  // ─── Derived feeds ────────────────────────────────────────────────
  const coinNotifs: Notification[] = useMemo(() => mockChain.coinTradeNotifications.map(n => ({
    id: `coin-${n.id}`,
    type: 'coin_trade' as NotificationType,
    user: {
      id: n.buyerUsername,
      username: n.buyerUsername,
      displayName: n.buyerName,
      avatar: n.buyerAvatar,
      bio: '',
      followers: 0,
      following: 0,
      isVerified: true,
    },
    message: n.marketType === 'primary' ? `bought your ${n.symbol} from primary issuance` : `filled your ${n.symbol} marketplace order`,
    detail: `${n.amount} ${n.symbol} @ ${n.price.toFixed(2)} ORA · you received ${n.proceeds.toFixed(2)} ORA`,
    isRead: n.isRead,
    createdAt: tradeTimeAgo(n.timestamp),
    coinTradeId: n.id,
  })), [mockChain.coinTradeNotifications]);

  const redemptionLabel = (k: string) => {
    switch (k) {
      case 'initiated': return 'wants to redeem';
      case 'delivered': return 'marked delivered';
      case 'confirmed': return 'confirmed receipt';
      case 'auto_confirmed': return 'auto-confirmed (timeout)';
      case 'disputed': return 'disputed delivery';
      default: return 'updated';
    }
  };
  const redemptionNotifs: Notification[] = useMemo(() => (mockChain.redemptionNotifications || []).map(n => ({
    id: `redeem-${n.id}`,
    type: 'curation_reward' as NotificationType,
    user: {
      id: n.who,
      username: n.who,
      displayName: n.who,
      avatar: n.whoAvatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80',
      bio: '',
      followers: 0,
      following: 0,
      isVerified: true,
    },
    message: `${redemptionLabel(n.kind)}: ${n.benefitTitle}`,
    detail: `${n.cost} ${n.symbol} · ${n.audience === 'creator' ? 'incoming' : 'outgoing'}`,
    isRead: n.isRead,
    createdAt: tradeTimeAgo(n.timestamp),
  })), [mockChain.redemptionNotifications]);

  // Adapt InAppNotification → Notification shape for unified rendering.
  const inAppNotifs: Notification[] = useMemo(
    () => mockChain.inAppNotifications.map((n: InAppNotification) => ({
      id: n.id,
      type: n.type as NotificationType,
      user: {
        id: n.actorUsername || n.actorName,
        username: n.actorUsername || n.actorName,
        displayName: n.actorName,
        avatar: n.actorAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${n.actorName}`,
        bio: '',
        followers: 0,
        following: 0,
        isVerified: false,
      },
      message: n.message,
      detail: n.detail,
      isRead: n.isRead,
      createdAt: tradeTimeAgo(n.timestamp),
      postId: n.postId,
      proposalId: n.proposalId,
    })),
    [mockChain.inAppNotifications],
  );

  const allNotifs: Notification[] = useMemo(
    () => [...redemptionNotifs, ...coinNotifs, ...inAppNotifs],
    [redemptionNotifs, coinNotifs, inAppNotifs],
  );

  // Per-category unread counts (used for the left-rail badges).
  const unreadByCategory = useMemo(() => {
    const out: Record<CategoryKey, number> = {
      messages: dmUnread,
      replies: 0,
      likes: 0,
      follows: 0,
      curation: 0,
      coins: 0,
      governance: 0,
    };
    for (const n of allNotifs) {
      if (n.isRead) continue;
      const cat = CATEGORIES.find(c => c.match?.(n));
      if (cat) out[cat.key] += 1;
    }
    return out;
  }, [allNotifs, dmUnread]);

  const totalUnread = Object.values(unreadByCategory).reduce((a, b) => a + b, 0);

  // Trade-detail modal state
  const [tradeDetail, setTradeDetail] = useState<CoinTradeNotification | null>(null);

  // ─── Mark-as-read helpers ────────────────────────────────────────
  const markRead = (id: string) => {
    mockChain.markInAppNotificationRead?.(id);
  };

  const markAllRead = () => {
    mockChain.markInAppNotificationsRead?.();
    mockChain.markCoinNotificationsRead?.();
    mockChain.markRedemptionNotificationsRead?.();
  };

  // Auto-mark all unread items in the active category as read whenever
  // the user lands on (or switches into) that category. Simply opening
  // the second-level nav clears the red badge — the user does not have
  // to click each individual row.
  useEffect(() => {
    if (active === 'messages') return;
    if (active === 'coins') {
      if (mockChain.coinTradeNotifications.some(n => !n.isRead)) {
        mockChain.markCoinNotificationsRead?.();
      }
      return;
    }
    if (active === 'curation') {
      if ((mockChain.redemptionNotifications || []).some(n => !n.isRead)) {
        mockChain.markRedemptionNotificationsRead?.();
      }
      mockChain.inAppNotifications
        .filter(n => n.type === 'curation_reward' && !n.isRead)
        .forEach(n => mockChain.markInAppNotificationRead?.(n.id));
      return;
    }
    // replies / likes / follows / governance → inAppNotifications stream
    const typeMap: Record<string, InAppNotification['type']> = {
      replies: 'comment',
      likes: 'like',
      follows: 'follow',
      governance: 'governance',
    };
    const wantType = typeMap[active];
    if (!wantType) return;
    mockChain.inAppNotifications
      .filter(n => n.type === wantType && !n.isRead)
      .forEach(n => mockChain.markInAppNotificationRead?.(n.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, mockChain.coinTradeNotifications, mockChain.redemptionNotifications, mockChain.inAppNotifications]);

  const handleClick = (n: Notification) => {
    markRead(n.id);
    // Click-through priority order:
    //   1. Coin trade        → open detail modal (amount/price/fee/proceeds)
    //   2. Governance         → proposal detail page
    //   3. Follow             → the follower's marketplace coin page (their hub)
    //   4. Post comment/like  → post detail page
    if (n.type === 'coin_trade' && n.coinTradeId) {
      const raw = mockChain.coinTradeNotifications.find(c => c.id === n.coinTradeId);
      if (raw) {
        setTradeDetail(raw);
        return;
      }
    }
    if (n.proposalId) {
      navigate(`/governance/proposal/${n.proposalId}`);
      return;
    }
    if (n.type === 'follow' && n.user?.username) {
      // Public profile page by username (set up in App.tsx).
      navigate(`/u/${n.user.username}`);
      return;
    }
    if (n.postId) navigate(`/post/${n.postId}`);
  };

  // ─── Right-pane content ──────────────────────────────────────────
  const activeCategory = CATEGORIES.find(c => c.key === active)!;

  const categoryNotifs = useMemo(() => {
    if (active === 'messages') return [];
    const matched = allNotifs.filter(n => activeCategory.match?.(n));
    return filter === 'unread' ? matched.filter(n => !n.isRead) : matched;
  }, [active, allNotifs, activeCategory, filter]);

  const renderRightPane = () => {
    if (active === 'messages') {
      return <MessagesPage />;
    }
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/40">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg ${activeCategory.iconBg} flex items-center justify-center`}>
                <activeCategory.icon className={`w-4 h-4 ${activeCategory.iconColor}`} />
              </div>
              <h2 className="text-lg font-bold">{activeCategory.label}</h2>
              {unreadByCategory[active] > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold">
                  {unreadByCategory[active]}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-secondary rounded-full p-0.5">
                {(['all', 'unread'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      filter === f ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {f === 'all' ? (t.notifications?.all ?? 'All') : (t.notifications?.unread ?? 'Unread')}
                  </button>
                ))}
              </div>
              {unreadByCategory[active] > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-aura hover:bg-aura/10 transition-colors"
                  title={t.notifications?.markAllRead ?? 'Mark all read'}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.notifications?.markAllRead ?? 'Mark all read'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {categoryNotifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <div className={`w-14 h-14 rounded-2xl ${activeCategory.iconBg} flex items-center justify-center mb-4 opacity-60`}>
                <activeCategory.icon className={`w-7 h-7 ${activeCategory.iconColor}`} />
              </div>
              <p className="text-sm">
                {filter === 'unread' ? `No unread ${activeCategory.label.toLowerCase()}` : `No ${activeCategory.label.toLowerCase()} yet`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {categoryNotifs.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full flex items-start gap-3 px-6 py-4 hover:bg-secondary/30 transition-colors text-left ${
                    !n.isRead ? 'bg-aura/[0.03]' : ''
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${activeCategory.iconBg}`}>
                    <activeCategory.icon className={`w-5 h-5 ${activeCategory.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <UserAvatar src={n.user.avatar} displayName={n.user.displayName} username={n.user.username} className="w-6 h-6 rounded-full" />
                      <span className="text-sm font-semibold truncate">{n.user.displayName}</span>
                      <span className="text-sm text-muted-foreground">{n.message}</span>
                    </div>
                    {n.detail && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">{n.detail}</p>
                    )}
                    <span className="text-xs text-muted-foreground/60 mt-1 block">{n.createdAt}</span>
                  </div>
                  {!n.isRead && (
                    <div className="w-2.5 h-2.5 rounded-full bg-aura shrink-0 mt-2" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // 2026-05-09: removed the desktop left-rail ("Notification center")
  // because the SideNav now hosts the same 7 category links one level
  // up. The in-page rail was duplicate navigation. Mobile keeps a
  // horizontal chip rail since the SideNav is collapsed on small screens.

  // Mobile horizontal rail of categories
  const MobileCategoryRail = (
    <div className="md:hidden sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border/40">
      <div className="flex gap-2 overflow-x-auto px-4 py-3 no-scrollbar">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const isActive = active === cat.key;
          const unread = unreadByCategory[cat.key];
          return (
            <button
              key={cat.key}
              onClick={() => setActive(cat.key)}
              className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isActive ? 'bg-aura text-white' : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
              {unread > 0 && (
                <span className={`px-1.5 py-0 rounded-full text-[9px] font-bold ${isActive ? 'bg-white/20' : 'bg-red-500 text-white'}`}>
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
    <div className="min-h-screen flex flex-col">
      {MobileCategoryRail}

      <div className="hidden md:flex flex-1 min-h-0">
        {/* Single-pane on desktop — the SideNav already exposes all 7
            notification categories; an in-page rail would duplicate them. */}
        <main className="flex-1 flex flex-col min-w-0">
          {renderRightPane()}
        </main>
      </div>

      <div className="md:hidden flex-1 flex flex-col min-h-0">
        {renderRightPane()}
      </div>
    </div>

    {/* Coin trade detail modal — opens when a coin_trade notification is clicked */}
    {tradeDetail && (
      <CoinTradeDetailModal
        trade={tradeDetail}
        onClose={() => setTradeDetail(null)}
        onViewMarket={() => {
          const slug = tradeDetail.symbol.replace(/^\$/, '').toLowerCase();
          setTradeDetail(null);
          navigate(`/marketplace/coin/${slug}`);
        }}
      />
    )}
    </>
  );
}

// ── Coin trade detail modal ──────────────────────────────
// Renders the full breakdown for a Creator-Coin trade so the seller (you)
// can see exactly what happened on-chain: amount, unit price, gross,
// protocol fee (5%), net proceeds, market type, and timestamp.
//
// Per AURA whitepaper:
//   gross    = amount × unit_price
//   fee      = 5% of gross  (split: 2% burn + 2% staker reward + 1% treasury)
//   proceeds = gross − fee  (creator receives this in their vault)
function CoinTradeDetailModal({
  trade, onClose, onViewMarket,
}: {
  trade: CoinTradeNotification;
  onClose: () => void;
  onViewMarket: () => void;
}) {
  const fee = trade.total - trade.proceeds;
  const feePct = trade.total > 0 ? (fee / trade.total) * 100 : 0;
  const when = new Date(trade.timestamp);
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-br from-aura/15 via-purple-500/10 to-transparent border-b flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-aura to-purple-500 flex items-center justify-center shrink-0 shadow">
            <Coins className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <p className="text-sm font-bold">${trade.symbol} trade</p>
              <span className={`text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded-full ${
                trade.marketType === 'primary'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                  : 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
              }`}>
                {trade.marketType === 'primary' ? 'Primary issuance' : 'Secondary market'}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {when.toLocaleString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors -mt-1 -mr-1"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Buyer */}
        <div className="px-5 py-3 border-b flex items-center gap-3">
          <UserAvatar src={trade.buyerAvatar} displayName={trade.buyerName} username={trade.buyerUsername} className="w-9 h-9 rounded-full shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{trade.buyerName}</p>
            <p className="text-[11px] text-muted-foreground truncate">@{trade.buyerUsername} · buyer</p>
          </div>
        </div>

        {/* Numeric breakdown */}
        <div className="px-5 py-4 space-y-2.5">
          <DetailRow
            label="Amount"
            value={`${trade.amount.toLocaleString()} ${trade.symbol}`}
          />
          <DetailRow
            label="Unit price"
            value={`${trade.price.toFixed(4)} ORA / ${trade.symbol}`}
          />
          <DetailRow
            label="Gross total"
            value={`${trade.total.toFixed(4)} ORA`}
            tone="muted"
          />
          <DetailRow
            label={`Protocol fee (${feePct.toFixed(1)}%)`}
            value={`− ${fee.toFixed(4)} ORA`}
            tone="rose"
            sub="2% burn · 2% stakers · 1% treasury"
          />
          <div className="pt-2 border-t">
            <DetailRow
              label="You received"
              value={`+ ${trade.proceeds.toFixed(4)} ORA`}
              tone="emerald"
              big
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t bg-secondary/20 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
            Settled on-chain
          </span>
          <button
            onClick={onViewMarket}
            className="inline-flex items-center gap-1 text-xs font-bold text-aura hover:underline"
          >
            View ${trade.symbol} market <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label, value, sub, tone = 'default', big = false,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'muted' | 'rose' | 'emerald';
  big?: boolean;
}) {
  const valueClass =
    tone === 'rose' ? 'text-rose-600 dark:text-rose-400'
    : tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'muted' ? 'text-muted-foreground'
    : 'text-foreground';
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/80 mt-0.5">{sub}</p>}
      </div>
      <p className={`tabular-nums shrink-0 ${big ? 'text-base font-black' : 'text-sm font-bold'} ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}
