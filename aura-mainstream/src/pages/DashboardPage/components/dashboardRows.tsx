// Dashboard small row/tile helpers (KpiTile, BarChart, PostRow, Metric,
// BountyRow, TxRow, SnapshotRow, QuickAction, formatRelative, CoinTradeRow,
// HolderRow, RedemptionRow, StakeRow, ProposalRow).
// Extracted from DashboardPage.tsx 2026-05-20 P-1 split.
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Eye, Coins, CheckCircle,
  FileText, Trophy, ArrowUpRight, ArrowDownRight,
  Heart, MessageCircle, Sparkles, ImageIcon, Music, Video,
  Clock, ExternalLink, Pin, Zap,
  Lock, Gift,
} from 'lucide-react';
import {
  computeStats, getCommitteeMeta, TIER_META, type ProposalTier,
} from '@/components/governance/proposalHelpers';
import { type Proposal } from '@/context/MockChainContext';

export function KpiTile({
  icon, label, value, unit, tone, changeUp,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  tone: 'emerald' | 'purple' | 'amber' | 'aura' | 'rose';
  changeUp?: boolean;
}) {
  const toneClasses: Record<typeof tone, string> = {
    emerald: 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent',
    purple: 'border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-transparent',
    amber: 'border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent',
    aura: 'border-aura/30 bg-gradient-to-br from-aura/5 to-transparent',
    rose: 'border-rose-500/30 bg-gradient-to-br from-rose-500/5 to-transparent',
  };
  const valueColor: Record<typeof tone, string> = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    purple: 'text-purple-600 dark:text-purple-400',
    amber: 'text-amber-600 dark:text-amber-400',
    aura: 'text-aura',
    rose: 'text-rose-600 dark:text-rose-400',
  };
  return (
    <div className={`rounded-xl border p-4 ${toneClasses[tone]}`}>
      <div className="flex items-center gap-1.5 mb-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-bold">{label}</span>
      </div>
      <p className={`text-2xl md:text-3xl font-black tabular-nums leading-none ${valueColor[tone]}`}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground mt-1.5 inline-flex items-center gap-1">
        {typeof changeUp === 'boolean' && (
          changeUp ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-rose-500" />
        )}
        {unit}
      </p>
    </div>
  );
}

export function BarChart({ data, color, label }: { data: number[]; color: string; label: string }) {
  const max = Math.max(...data, 1);
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  // 7-col grid; each column: top number + flex-1 bar slot + bottom letter.
  // The flex-1 slot is the bar canvas: bars are absolutely sized via percentage
  // OR explicit pixel height (max bar height = 64px). This reliably fills the
  // parent's vertical space without depending on flex height inheritance, which
  // is fragile when a column flex container has multiple non-flex children.
  const BAR_PX = 60;
  return (
    <div>
      <p className="text-[11px] font-semibold mb-2 text-muted-foreground">{label}</p>
      <div className="grid grid-cols-7 gap-1.5">
        {data.map((v, i) => {
          const h = Math.max(2, Math.round((v / max) * BAR_PX));
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-[9px] text-muted-foreground tabular-nums leading-none">{v}</span>
              <div className="w-full flex items-end justify-center" style={{ height: BAR_PX }}>
                <div
                  className={`w-full rounded-t-md ${color} transition-all duration-500`}
                  style={{ height: h }}
                />
              </div>
              <span className="text-[9px] text-muted-foreground leading-none">{days[i]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PostRow({ m, rank, showRank = true }: { m: { post: any; views: number | null; likes: number; comments: number; curations: number | null; earned: number | null; isPinned?: boolean; isBoosted?: boolean }; rank: number; showRank?: boolean }) {
  const TypeIcon = m.post.mode === 'photo' ? ImageIcon
    : m.post.mode === 'audio' ? Music
    : m.post.mode === 'video' ? Video
    : FileText;

  return (
    <div className="px-4 py-3 hover:bg-secondary/30 transition-colors">
      <div className="flex items-center gap-3">
        {showRank && (
          <span className={`text-[10px] font-black tabular-nums shrink-0 w-5 ${
            rank === 1 ? 'text-amber-500' : rank === 2 ? 'text-slate-400' : rank === 3 ? 'text-orange-500' : 'text-muted-foreground'
          }`}>
            #{rank}
          </span>
        )}
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-aura/20 to-purple-500/20 flex items-center justify-center shrink-0">
          <TypeIcon className="w-4 h-4 text-aura" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold truncate">{m.post.title || (m.post.content?.slice(0, 50) ?? 'Untitled')}</p>
            {m.isPinned && (
              <span className="inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded-full bg-aura/15 text-aura">
                <Pin className="w-2.5 h-2.5" />
                Pinned
              </span>
            )}
            {m.isBoosted && (
              <span className="inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Zap className="w-2.5 h-2.5" />
                Boosted
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground inline-flex items-center gap-2 mt-0.5">
            <span className="uppercase tracking-wider font-bold">{m.post.mode}</span>
            <span>·</span>
            <span>{formatRelative(m.post.createdAt)}</span>
          </p>
        </div>
        {/* Inline metrics — — placeholder when not yet tracked on-chain */}
        <div className="hidden sm:flex items-center gap-4 text-xs tabular-nums">
          <Metric icon={<Eye className="w-3 h-3" />} value={m.views == null ? '—' : m.views.toLocaleString()} />
          <Metric icon={<Heart className="w-3 h-3" />} value={m.likes.toLocaleString()} />
          <Metric icon={<MessageCircle className="w-3 h-3" />} value={m.comments.toLocaleString()} />
          <Metric icon={<Sparkles className="w-3 h-3" />} value={m.curations == null ? '—' : m.curations.toString()} />
        </div>
        <div className="text-right shrink-0">
          {m.earned == null ? (
            <div className="text-xs text-muted-foreground tabular-nums">— ORA</div>
          ) : (
            <>
              <div className="text-sm font-bold tabular-nums text-aura">+{m.earned.toFixed(2)}</div>
              <div className="text-[9px] uppercase text-muted-foreground font-bold tracking-wider">ORA</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function Metric({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      {icon}
      {value}
    </span>
  );
}

export function BountyRow({ bounty, role, navigate }: { bounty: any; role: 'poster' | 'submitter'; navigate: ReturnType<typeof useNavigate> }) {
  const deadlineDate = new Date(bounty.deadline);
  const daysLeft = Math.max(0, Math.floor((deadlineDate.getTime() - Date.now()) / 86400000));
  const isExpiring = bounty.status === 'active' && daysLeft <= 2;

  const statusMeta = {
    active: { label: 'Active', tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
    completed: { label: 'Awarded', tone: 'bg-aura/15 text-aura' },
    expired: { label: 'Expired', tone: 'bg-muted text-muted-foreground' },
  }[bounty.status as 'active' | 'completed' | 'expired'];

  return (
    <div
      className="px-4 py-3 hover:bg-secondary/30 transition-colors cursor-pointer"
      onClick={() => navigate(`/bounty/${bounty.id}`)}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center shrink-0">
          <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-sm font-semibold truncate">{bounty.title}</p>
            <span className={`text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded-full ${statusMeta.tone}`}>
              {statusMeta.label}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground line-clamp-1 mb-1">{bounty.description}</p>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {bounty.status === 'active' ? `${daysLeft}d left` : new Date(bounty.deadline).toLocaleDateString()}
              {isExpiring && <span className="text-rose-500 font-bold">!</span>}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="w-3 h-3" />
              {bounty.submissionCount} submission{bounty.submissionCount !== 1 ? 's' : ''}
            </span>
            {role === 'submitter' && (
              <span className="inline-flex items-center gap-1 text-aura">
                <CheckCircle className="w-3 h-3" />
                You submitted
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400">{bounty.reward.toLocaleString()}</div>
          <div className="text-[9px] uppercase text-muted-foreground font-bold tracking-wider">ORA</div>
        </div>
      </div>
    </div>
  );
}

export function TxRow({ tx }: { tx: any }) {
  const isCredit = ['airdrop', 'reward', 'sell_coin', 'unstake'].includes(tx.type);
  const isDebit = ['buy_coin', 'buy_key', 'send', 'stake', 'mint_coin', 'curate', 'redeem_cc'].includes(tx.type);
  const ArrowIcon = isCredit ? ArrowDownRight : isDebit ? ArrowUpRight : Coins;

  const typeLabels: Record<string, string> = {
    airdrop: 'Airdrop', publish: 'Publish', reward: 'Reward', mint_coin: 'Mint coin',
    buy_coin: 'Buy coin', sell_coin: 'Sell coin', curate: 'Curate', buy_key: 'Buy key',
    send: 'Send', stake: 'Stake', unstake: 'Unstake', send_cc: 'Send CC', redeem_cc: 'Redeem CC',
  };

  return (
    <div className="px-4 py-2.5 flex items-center gap-3 hover:bg-secondary/30 transition-colors">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
        isCredit ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : isDebit ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'bg-muted text-muted-foreground'
      }`}>
        <ArrowIcon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold">{typeLabels[tx.type] || tx.type}</p>
        <p className="text-[10px] text-muted-foreground truncate">{tx.details}</p>
      </div>
      <div className="text-right shrink-0">
        {tx.amount !== 0 && (
          <div className={`text-xs font-bold tabular-nums ${isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
            {isCredit ? '+' : isDebit ? '-' : ''}{Math.abs(tx.amount).toFixed(2)}
          </div>
        )}
        <div className="text-[9px] text-muted-foreground tabular-nums">{formatRelative(tx.timestamp)}</div>
      </div>
    </div>
  );
}

export function SnapshotRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-sm font-bold tabular-nums">{value}</span>
    </div>
  );
}

export function QuickAction({ label, sub, onClick }: { label: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-3 rounded-lg border border-border/40 bg-secondary/20 hover:bg-secondary/40 hover:border-aura/40 transition-all text-left group"
    >
      <div>
        <p className="text-xs font-bold">{label}</p>
        <p className="text-[10px] text-muted-foreground">{sub}</p>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-aura transition-colors" />
    </button>
  );
}

export function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

// ─── Earnings sub-components ───────────────────────────────────────────

export function CoinTradeRow({ t }: { t: any }) {
  const isBuy = t.type === 'buy';
  return (
    <div className="px-4 py-2.5 flex items-center gap-3 hover:bg-secondary/30 transition-colors">
      <UserAvatar src={t.userAvatar} displayName={t.userName} username={t.userUsername} className="w-8 h-8 rounded-full shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">
          {t.userName} <span className="text-muted-foreground font-normal">{isBuy ? 'bought' : 'sold'}</span>
        </p>
        <p className="text-[10px] text-muted-foreground">@{t.userUsername} · {formatRelative(t.timestamp)}</p>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-xs font-bold tabular-nums ${isBuy ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
          {isBuy ? '+' : '-'}{t.amount.toLocaleString()} CC
        </div>
        <div className="text-[9px] text-muted-foreground tabular-nums">{t.total.toFixed(2)} ORA @ {t.price.toFixed(3)}</div>
      </div>
    </div>
  );
}

export function HolderRow({ h, rank, symbol }: { h: any; rank: number; symbol: string | null }) {
  return (
    <div className="px-4 py-2.5 flex items-center gap-3 hover:bg-secondary/30 transition-colors">
      <span className={`text-[10px] font-black tabular-nums shrink-0 w-5 ${
        rank === 1 ? 'text-amber-500' : rank === 2 ? 'text-slate-400' : rank === 3 ? 'text-orange-500' : 'text-muted-foreground'
      }`}>
        #{rank}
      </span>
      <UserAvatar src={h.avatar} displayName={h.name} username={h.username} className="w-8 h-8 rounded-full shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">{h.name}</p>
        <p className="text-[10px] text-muted-foreground truncate">@{h.username}</p>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs font-bold tabular-nums text-aura">{h.amount.toLocaleString()}</div>
        <div className="text-[9px] uppercase text-muted-foreground font-bold tracking-wider">{symbol ?? 'CC'}</div>
      </div>
    </div>
  );
}

export function RedemptionRow({ r }: { r: any }) {
  const statusMeta: Record<string, { label: string; tone: string }> = {
    pending_delivery: { label: 'Awaiting delivery', tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
    delivered: { label: 'Delivered', tone: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
    confirmed: { label: 'Confirmed', tone: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
    disputed: { label: 'Disputed', tone: 'bg-rose-500/15 text-rose-700 dark:text-rose-400' },
  };
  const meta = statusMeta[r.status] ?? statusMeta.pending_delivery;
  return (
    <div className="px-4 py-2.5 flex items-start gap-3 hover:bg-secondary/30 transition-colors">
      {r.buyerAvatar ? (
        <UserAvatar src={r.buyerAvatar} displayName={r.buyerName} className="w-8 h-8 rounded-full shrink-0 mt-0.5" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
          <Gift className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          <p className="text-xs font-semibold truncate">{r.buyerName}</p>
          <span className={`text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded-full ${meta.tone}`}>
            {meta.label}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground line-clamp-1">{r.benefitTitle}</p>
        <p className="text-[10px] text-muted-foreground">{formatRelative(r.createdAt)}</p>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs font-bold tabular-nums text-aura">{r.cost.toLocaleString()}</div>
        <div className="text-[9px] uppercase text-muted-foreground font-bold tracking-wider">{r.symbol}</div>
      </div>
    </div>
  );
}

export function StakeRow({ s }: { s: any }) {
  const remainingMs = Math.max(0, s.unlocksAt - Date.now());
  const remainingDays = Math.ceil(remainingMs / 86400000);
  const isUnlocked = remainingMs <= 0;
  return (
    <div className="px-4 py-2.5 flex items-center gap-3 hover:bg-secondary/30 transition-colors">
      <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0">
        <Lock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold">
          {s.amount.toLocaleString()} ORA <span className="text-muted-foreground font-normal">· {s.lockDays}-day lock</span>
        </p>
        <p className="text-[10px] text-muted-foreground">
          Multiplier {s.multiplier}× · Started {formatRelative(s.startedAt)}
        </p>
      </div>
      <div className="text-right shrink-0">
        {isUnlocked ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="w-3 h-3" />
            Unlocked
          </span>
        ) : (
          <span className="text-[10px] font-bold tabular-nums text-muted-foreground">{remainingDays}d left</span>
        )}
      </div>
    </div>
  );
}

// ─── Governance sub-components ─────────────────────────────────────────

export function ProposalRow({
  p, navigate, myVote, showMyVote = false,
}: {
  p: Proposal;
  navigate: ReturnType<typeof useNavigate>;
  myVote?: 'for' | 'against';
  showMyVote?: boolean;
}) {
  const stats = computeStats(p);
  const tier = (p.tier ?? 'tier-3') as ProposalTier;
  const tierMeta = TIER_META[tier];
  const committeeMeta = getCommitteeMeta(p.committee);

  const statusMeta: Record<Proposal['status'], { label: string; tone: string }> = {
    voting: { label: 'Voting', tone: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
    passed: { label: 'Passed', tone: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
    rejected: { label: 'Rejected', tone: 'bg-rose-500/15 text-rose-700 dark:text-rose-400' },
  };
  const sm = statusMeta[p.status];

  return (
    <div
      className="px-4 py-3 hover:bg-secondary/30 transition-colors cursor-pointer"
      onClick={() => navigate(`/governance/proposal/${p.id}`)}
    >
      <div className="flex items-start gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-aura/15 flex items-center justify-center shrink-0 text-lg">
          {committeeMeta?.icon ?? '🏛️'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <p className="text-sm font-semibold truncate">{p.title}</p>
            <span className={`text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded-full ${sm.tone}`}>
              {sm.label}
            </span>
            <span className={`text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded-full ${tierMeta.tone}`}>
              {tierMeta.shortLabel}
            </span>
            {showMyVote && myVote && (
              <span className={`text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded-full ${
                myVote === 'for'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
              }`}>
                You voted {myVote}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground line-clamp-1 mb-1">{p.description}</p>
          <p className="text-[10px] text-muted-foreground">
            {committeeMeta?.name ?? 'Unassigned'} committee
            <span className="mx-1.5">·</span>
            Deadline {p.deadline}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold tabular-nums text-aura">{stats.totalVotes.toLocaleString()}</div>
          <div className="text-[9px] uppercase text-muted-foreground font-bold tracking-wider">votes</div>
        </div>
      </div>

      {/* Approval + quorum twin progress */}
      <div className="grid grid-cols-2 gap-3 pl-12">
        <div>
          <div className="flex items-center justify-between text-[9px] uppercase tracking-wider font-bold text-muted-foreground mb-0.5">
            <span>Approval</span>
            <span className={stats.approvalMet ? 'text-emerald-600 dark:text-emerald-400' : ''}>
              {stats.approvalPct.toFixed(0)}% / {tierMeta.approval}%
            </span>
          </div>
          <div className="relative h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 ${stats.approvalMet ? 'bg-emerald-500' : 'bg-aura'}`}
              style={{ width: `${Math.min(100, stats.approvalPct)}%` }}
            />
            <div
              className="absolute inset-y-0 w-px bg-foreground/30"
              style={{ left: `${tierMeta.approval}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-[9px] uppercase tracking-wider font-bold text-muted-foreground mb-0.5">
            <span>Quorum</span>
            <span className={stats.quorumMet ? 'text-emerald-600 dark:text-emerald-400' : ''}>
              {stats.quorumPct.toFixed(1)}% / {tierMeta.quorum}%
            </span>
          </div>
          <div className="relative h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 ${stats.quorumMet ? 'bg-emerald-500' : 'bg-purple-500'}`}
              style={{ width: `${Math.min(100, stats.quorumPct)}%` }}
            />
            {tierMeta.quorum > 0 && (
              <div
                className="absolute inset-y-0 w-px bg-foreground/30"
                style={{ left: `${tierMeta.quorum}%` }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
