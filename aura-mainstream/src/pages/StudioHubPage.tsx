/**
 * StudioHubPage v3 — 5-tab creator workshop.
 *
 * Tabs (per Zhuoyu 2026-05-10 R3 spec):
 *   1. Content       — At-a-glance stats (link to Dashboard→Content), drafts,
 *                       scheduled posts, recent posts, plus a small “your
 *                       Creator Coin lives in /profile” nudge card so we don't
 *                       duplicate the coin manage panel that already lives there.
 *   2. Bounties      — Two sub-views: “I posted” / “I submitted”.
 *   3. Redemptions   — Pending redemption requests where the local user is
 *                       the creator. One-tap mark-delivered (with optional
 *                       proof URL/note).
 *   4. Inventory     — Fractional NFTs minted, premium content keys, etc.
 *                       (creator-side asset inventory).
 *   5. Governance    — Draft proposal, run for committee.
 *
 * The Composer (“Create”) lives as a sticky CTA in the top hero, NOT a tab,
 * so it's always one click away regardless of which tab is active.
 */

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMockChain, type RedemptionRequest } from '@/context/MockChainContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useUserPosts } from '@/hooks/useUserPosts';
import type { Post } from '@/types';
import { useOraGuard } from '@/hooks/useOraGuard';
import {
  Sparkles, ImageIcon, Music, Video, FileText, Radio, Lock, Layers,
  Coins, Trophy, Vote, Award, Package, Inbox, FileEdit,
  ArrowRight, Plus, X, ExternalLink, Clock, CheckCircle2, Edit3,
  Heart, MessageCircle, Share2, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MintCeremony from '@/components/coin/MintCeremony';

// 2026-05-11 R4 spec:
//   - Tab order: Content → Bounties → Governance → Redemptions → Drafts
//   - 'inventory' renamed to 'drafts' (draft posts saved via CreatePage's Save).
//     The old Inventory (fractional NFT mints) moved to Wallet → Inventory tab.
type TabId = 'content' | 'bounties' | 'governance' | 'redemptions' | 'drafts';

const TABS: { id: TabId; label: string; icon: typeof Sparkles }[] = [
  { id: 'content',     label: 'Content',     icon: FileEdit },
  { id: 'bounties',    label: 'Bounties',    icon: Trophy },
  { id: 'governance',  label: 'Governance',  icon: Vote },
  { id: 'redemptions', label: 'Redemptions', icon: Inbox },
  { id: 'drafts',      label: 'Drafts',      icon: Package },
];

export default function StudioHubPage() {
  const navigate = useNavigate();
  const mockChain = useMockChain();
  const { user } = useAuth();
  const { showToast } = useToast();
  const oraGuard = useOraGuard();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Tab state syncs with ?tab=... so deep links and refresh stay put.
  const initialTab = (searchParams.get('tab') as TabId | null);
  const [activeTab, setActiveTab] = useState<TabId>(
    TABS.some(t => t.id === initialTab) ? (initialTab as TabId) : 'content'
  );
  const switchTab = useCallback((id: TabId) => {
    setActiveTab(id);
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // ── Modal state ───────────────────────────────────
  // 2026-05-11 R13: Bounty flow moved to a dedicated /studio/create-bounty
  // page. The Mint Coin ceremony stays as an in-page modal because it's a
  // short single-action flow.
  const [showMintModal, setShowMintModal] = useState(false);

  // ── Live data feeds ────────────────────────────────────────────
  const myPosts = useUserPosts(user as any);
  const myProposalCount = useMemo(
    () => mockChain.proposals.filter(p =>
      p.proposer === mockChain.walletAddress || p.proposer === 'You'
    ).length,
    [mockChain.proposals, mockChain.walletAddress],
  );
  const myBounties = useMemo(
    () => mockChain.bounties.filter(b =>
      b.creator === 'You' || (mockChain.publicKey && b.creator.startsWith(mockChain.publicKey.slice(0, 6)))
    ),
    [mockChain.bounties, mockChain.publicKey],
  );
  const myFnfts = useMemo(
    () => mockChain.fractionalizedNfts.filter(f =>
      f.creator === 'You' || f.creator === mockChain.walletAddress
    ),
    [mockChain.fractionalizedNfts, mockChain.walletAddress],
  );
  const incomingRedemptions = useMemo(
    () => mockChain.redemptions.filter(r => r.perspective === 'me_as_creator'),
    [mockChain.redemptions],
  );
  const pendingRedemptionsCount = useMemo(
    () => incomingRedemptions.filter(r => r.status === 'awaiting_delivery').length,
    [incomingRedemptions],
  );

  // ── Mint preconditions ────────────────────────────────────────
  const hasMintedCoin = mockChain.hasCreatorCoin && !!mockChain.creatorCoinSymbol;
  const followerCount = (user as any)?.followers || 0;
  const canMintNow = followerCount >= 100 && !hasMintedCoin;
  const defaultMintSymbol = ((user?.username || 'MYCOIN')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 6)) || 'MYCOIN';
  const defaultMintName = `${user?.displayName || user?.username || 'My'} Coin`;

  // 2026-05-11 R4: simplified hero per Zhuoyu. The format chips row was deleted
  // (CreatePage has its own mode switcher — having both was redundant). The
  // Studio hero now has a single "+ Create" button that goes straight to the
  // composer, no Studio-side mode picker.
  const openComposer = () => navigate('/create');

  return (
    <>
      <div className="min-h-screen pb-20 md:pb-8">
        {/* ── Hero: title + composer ─────────────────────────────────── */}
        <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/40">
          <div className="px-4 md:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-aura" />
                <h1 className="text-xl md:text-2xl font-black">Studio</h1>
                <span className="text-xs text-muted-foreground hidden md:inline">Your workshop on AURA</span>
              </div>
              <button
                onClick={() => openComposer()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-aura via-purple-500 to-pink-500 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all hover:scale-[1.02]"
              >
                <Sparkles className="w-4 h-4" />
                + Create
              </button>
            </div>
            {/* Format chips row removed 2026-05-11 — CreatePage already has its own
                mode switcher; one-step entry through "+ Create" keeps the hero clean. */}
          </div>
          {/* Tab bar */}
          <div className="px-4 md:px-6 lg:px-8 flex gap-1 overflow-x-auto no-scrollbar border-t border-border/40">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              const badge = t.id === 'redemptions' && pendingRedemptionsCount > 0
                ? pendingRedemptionsCount
                : null;
              return (
                <button
                  key={t.id}
                  onClick={() => switchTab(t.id)}
                  className={`relative inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                    active
                      ? 'border-aura text-aura'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                  {badge !== null && (
                    <span className="min-w-[18px] h-4.5 px-1.5 rounded-full bg-aura text-white text-[10px] font-bold flex items-center justify-center">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 md:px-6 lg:px-8 py-6">
          {activeTab === 'content' && (
            <ContentTab
              myPosts={myPosts}
              myPostsCount={myPosts.length}
              hasMintedCoin={hasMintedCoin}
              creatorCoinSymbol={mockChain.creatorCoinSymbol}
              ownCoinHoldersCount={mockChain.ownCoinHolders.length}
              canMintNow={canMintNow}
              followerCount={followerCount}
              onOpenMint={() => setShowMintModal(true)}
              onOpenComposer={() => openComposer()}
            />
          )}
          {activeTab === 'bounties' && (
            <BountiesTab
              myBounties={myBounties}
              mySubmissions={mockChain.mySubmissions}
              onPostBounty={() => navigate('/studio/create-bounty')}
            />
          )}
          {activeTab === 'redemptions' && (
            <RedemptionsTab
              incoming={incomingRedemptions}
            />
          )}
          {activeTab === 'drafts' && (
            <DraftsTab />
          )}

          {activeTab === 'governance' && (
            <GovernanceTab
              myProposalCount={myProposalCount}
            />
          )}
        </div>
      </div>

      {/* 2026-05-11 R13: Bounty modal removed in favour of full page
          at /studio/create-bounty (mirrors /governance/create layout). */}

      {/* ── Mint Coin ceremony ──────────────────────────────────── */}
      <MintCeremony
        open={showMintModal}
        defaultSymbol={defaultMintSymbol}
        defaultName={defaultMintName}
        onClose={() => setShowMintModal(false)}
        onMinted={(mintedSymbol) => {
          setShowMintModal(false);
          showToast('success', `🎉 Minted ${mintedSymbol} — your Creator Coin dashboard is unlocked.`);
          navigate('/creator-coin');
        }}
      />
    </>
  );
}

// ────────────────────────────────────────────────────────────────
// CONTENT TAB
// ────────────────────────────────────────────────────────────────

function ContentTab(props: {
  myPosts: Post[];
  myPostsCount: number;
  hasMintedCoin: boolean;
  creatorCoinSymbol: string;
  ownCoinHoldersCount: number;
  canMintNow: boolean;
  followerCount: number;
  onOpenMint: () => void;
  onOpenComposer: () => void;
}) {
  const navigate = useNavigate();
  const mockChain = useMockChain();

  // 2026-05-11 R4: Drafts moved to its own tab. Content tab now focuses on
  // published posts — stats overview + a card matrix of every published post
  // with engagement (likes/comments/shares) and revenue (sum of curation +
  // tip + key sale + boost ORA attributed to that post) summarised.

  // Compute per-post revenue (sum of ORA flowing into that post). Since we
  // don't have a per-post earnings ledger yet, we approximate from transactions:
  //   - buy_key txs that match this post id
  //   - tips routed to this post (`details` contains post id when present)
  //   - boost spend stays in the protocol pool, not the creator's revenue, so skipped.
  const revenueByPost = new Map<string, number>();
  for (const tx of mockChain.transactions || []) {
    // We only count INCOMING ORA (positive amount), and only for the creator.
    if (tx.amount <= 0) continue;
    if (tx.type !== 'buy_key' && tx.type !== 'reward' && tx.type !== 'curate') continue;
    const details = tx.details || '';
    // Try to extract a post id (`p4`, `p12`, etc.) from the details string.
    const match = details.match(/post[_\s]+([a-zA-Z0-9-]+)|content[_\s]+([a-zA-Z0-9-]+)|\bp(\d+)\b/);
    const pid = match ? (match[1] || match[2] || `p${match[3]}`) : null;
    if (pid) {
      revenueByPost.set(pid, (revenueByPost.get(pid) || 0) + tx.amount);
    }
  }

  return (
    <div className="space-y-6">
      {/* At-a-glance — click anywhere to deep-link Dashboard→Content */}
      <button
        onClick={() => navigate('/dashboard?tab=content')}
        className="w-full text-left rounded-2xl border bg-card hover:border-aura/40 hover:shadow-md transition-all p-5 group"
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">At a glance</p>
            <h2 className="text-base font-bold">Your content performance</h2>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-aura font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
            Open Dashboard <ArrowRight className="w-3 h-3" />
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCell label="Posts published" value={props.myPostsCount} />
          <StatCell label="Total likes" value={props.myPosts.reduce((s, p) => s + (p.likes || 0), 0)} />
          <StatCell label="Followers" value={props.followerCount} />
          <StatCell label={props.hasMintedCoin ? `${props.creatorCoinSymbol} holders` : 'Coin holders'} value={props.ownCoinHoldersCount} />
        </div>
      </button>

      {/* Creator Coin nudge — small reminder. Full management lives in /profile + /creator-coin. */}
      <div className="rounded-2xl border bg-gradient-to-br from-aura/5 via-purple-500/5 to-pink-500/5 p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          props.hasMintedCoin ? 'bg-aura text-white' : 'bg-aura/10 text-aura'
        }`}>
          <Coins className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          {props.hasMintedCoin ? (
            <>
              <p className="text-sm font-bold">{props.creatorCoinSymbol} · {props.ownCoinHoldersCount} holder{props.ownCoinHoldersCount === 1 ? '' : 's'}</p>
              <p className="text-[11px] text-muted-foreground">Manage holders, vesting, redemptions in your Creator Coin dashboard — the full panel lives in your Profile.</p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold">Mint your Creator Coin</p>
              <p className="text-[11px] text-muted-foreground">
                {props.canMintNow
                  ? '100 followers reached — you can mint now.'
                  : `Need 100 followers (${props.followerCount}/100). Keep publishing to unlock.`}
              </p>
            </>
          )}
        </div>
        {props.hasMintedCoin ? (
          <Button size="sm" variant="outline" onClick={() => navigate('/profile')} className="shrink-0">
            Open <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        ) : props.canMintNow ? (
          <Button size="sm" onClick={props.onOpenMint} className="shrink-0 bg-aura text-white">
            Mint <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled className="shrink-0 opacity-50">
            Locked
          </Button>
        )}
      </div>

      {/* 2026-05-11 R4: Published posts matrix replaces the Drafts inline list.
         Drafts now live on their own tab. Each card shows cover + title +
         engagement summary (likes / comments / shares) + revenue earned. */}
      <SectionHeader
        title={`Published posts (${props.myPostsCount})`}
        right={
          <button onClick={props.onOpenComposer} className="text-xs text-aura font-semibold hover:underline inline-flex items-center gap-1">
            New post <Plus className="w-3 h-3" />
          </button>
        }
      />
      {props.myPosts.length === 0 ? (
        <EmptyState
          icon={FileEdit}
          title="No posts published yet"
          desc="Create your first piece — once published, it'll show up here with engagement and revenue analytics."
          cta={{ label: '+ Create', onClick: props.onOpenComposer }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {props.myPosts.map(post => {
            const revenue = revenueByPost.get(post.id) || 0;
            return (
              <button
                key={post.id}
                onClick={() => navigate(`/post/${post.id}`)}
                className="text-left rounded-xl border bg-card hover:border-aura/40 hover:shadow-md transition-all overflow-hidden group"
              >
                {/* Cover */}
                <div className="aspect-[16/9] bg-secondary/40 relative overflow-hidden">
                  {post.coverImage ? (
                    <img src={post.coverImage} alt={post.title || 'Post'} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileEdit className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                  )}
                  <span className="absolute top-2 left-2 text-[9px] font-bold uppercase tracking-wider bg-black/60 text-white px-1.5 py-0.5 rounded">
                    {post.type}
                  </span>
                  {post.isPremium && (
                    <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider bg-purple-500/90 text-white px-1.5 py-0.5 rounded inline-flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" /> {post.premiumPrice} ORA
                    </span>
                  )}
                </div>
                {/* Body */}
                <div className="p-3 space-y-2">
                  <p className="text-sm font-semibold line-clamp-1">{post.title || (post.content ? post.content.slice(0, 60) : 'Untitled')}</p>
                  <p className="text-[10px] text-muted-foreground">{post.createdAt}</p>
                  {/* Engagement row */}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground tabular-nums">
                    <span className="inline-flex items-center gap-0.5" title="Likes"><Heart className="w-3 h-3" /> {post.likes ?? 0}</span>
                    <span className="inline-flex items-center gap-0.5" title="Comments"><MessageCircle className="w-3 h-3" /> {post.comments ?? 0}</span>
                    <span className="inline-flex items-center gap-0.5" title="Shares"><Share2 className="w-3 h-3" /> {post.shares ?? 0}</span>
                  </div>
                  {/* Revenue row */}
                  <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Revenue</span>
                    <span className={`text-sm font-bold tabular-nums ${revenue > 0 ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {revenue.toFixed(2)} ORA
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// BOUNTIES TAB
// ────────────────────────────────────────────────────────────────

function BountiesTab(props: {
  myBounties: ReturnType<typeof useMockChain>['bounties'];
  mySubmissions: ReturnType<typeof useMockChain>['mySubmissions'];
  onPostBounty: () => void;
}) {
  const navigate = useNavigate();
  const [sub, setSub] = useState<'posted' | 'submitted'>('posted');

  return (
    <div className="space-y-5">
      {/* Sub-nav + post-bounty CTA */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex bg-secondary/40 rounded-lg p-1 gap-0.5">
          {([
            { id: 'posted'    as const, label: 'I posted',    count: props.myBounties.length },
            { id: 'submitted' as const, label: 'I submitted', count: props.mySubmissions.length },
          ]).map(s => (
            <button
              key={s.id}
              onClick={() => setSub(s.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                sub === s.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s.label} <span className="text-muted-foreground">({s.count})</span>
            </button>
          ))}
        </div>
        <Button onClick={props.onPostBounty} size="sm" className="bg-green-500 hover:bg-green-600 text-white">
          <Plus className="w-3.5 h-3.5 mr-1" /> Post bounty
        </Button>
      </div>

      {sub === 'posted' && (
        props.myBounties.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No bounties posted yet"
            desc="Crowdsource design, code, music, or research — ORA is escrowed until you award a winner."
            cta={{ label: 'Post your first bounty', onClick: props.onPostBounty }}
          />
        ) : (
          <div className="space-y-2">
            {props.myBounties.map(b => (
              <button
                key={b.id}
                onClick={() => navigate(`/marketplace/bounty/${b.id}`)}
                className="w-full text-left rounded-xl border bg-card hover:border-amber-500/40 hover:shadow-sm transition-all p-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                  <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{b.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {b.submissionCount} submission{b.submissionCount === 1 ? '' : 's'} ·
                    {' '}{b.status === 'active' ? `Closes ${new Date(b.deadline).toLocaleDateString()}` : b.status}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold tabular-nums">{b.reward.toLocaleString()} ORA</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{b.status}</p>
                </div>
              </button>
            ))}
          </div>
        )
      )}

      {sub === 'submitted' && (
        props.mySubmissions.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No submissions yet"
            desc="Browse open bounties and submit work to earn the escrowed ORA reward."
            cta={{ label: 'Browse bounties', onClick: () => navigate('/marketplace?tab=bounties') }}
          />
        ) : (
          <div className="space-y-2">
            {props.mySubmissions.map(s => (
              <button
                key={s.id}
                onClick={() => navigate(`/marketplace/bounty/${s.bountyId}`)}
                className="w-full text-left rounded-xl border bg-card hover:border-amber-500/40 hover:shadow-sm transition-all p-4 flex items-center gap-3"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  s.status === 'won' ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                    : s.status === 'lost' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                }`}>
                  {s.status === 'won' ? <CheckCircle2 className="w-4 h-4" />
                   : s.status === 'lost' ? <X className="w-4 h-4" />
                   : <Clock className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{s.bountyTitle}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Submitted {new Date(s.submittedAt).toLocaleDateString()} · <span className="truncate inline-block max-w-[200px] align-bottom">{s.workUrl}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold tabular-nums">{s.rewardSnapshot.toLocaleString()} ORA</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.status}</p>
                </div>
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// REDEMPTIONS TAB
// ────────────────────────────────────────────────────────────────

function RedemptionsTab(props: { incoming: RedemptionRequest[] }) {
  const mockChain = useMockChain();
  const { showToast } = useToast();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [proofUrl, setProofUrl] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const pending  = props.incoming.filter(r => r.status === 'awaiting_delivery');
  const settled  = props.incoming.filter(r => r.status !== 'awaiting_delivery');

  const closeModal = () => { setActiveId(null); setProofUrl(''); setNote(''); };
  const activeRequest = activeId ? props.incoming.find(r => r.id === activeId) || null : null;

  const markDelivered = async (asProof: boolean) => {
    if (!activeId) return;
    if (asProof && !proofUrl.trim() && !note.trim()) {
      showToast('error', 'Add a proof URL or note before confirming delivery.');
      return;
    }
    setBusy(true);
    try {
      const composedNote = [proofUrl.trim(), note.trim()].filter(Boolean).join(' — ');
      await mockChain.markRedemptionDelivered(activeId, composedNote || undefined);
      showToast('success', 'Marked as delivered. The buyer has been notified.');
      closeModal();
    } catch (e: any) {
      showToast('error', e?.message || 'Failed to mark delivered.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-aura/30 bg-aura/5 p-4 flex items-start gap-3">
        <Inbox className="w-5 h-5 text-aura mt-0.5 shrink-0" />
        <div className="flex-1 text-xs">
          <p className="font-bold text-foreground mb-1">How redemptions work</p>
          <p className="text-muted-foreground">
            When a coin holder redeems a benefit, their CC is escrowed in protocol. Mark the perk as delivered
            (with a link or note as proof) and the CC releases to you once the buyer confirms receipt. Disputed
            cases pause the escrow and route to a committee.
          </p>
        </div>
      </div>

      <SectionHeader title={`Pending (${pending.length})`} />
      {pending.length === 0 ? (
        <EmptyState icon={Inbox} title="All caught up" desc="No coin holders waiting for delivery right now." />
      ) : (
        <div className="space-y-2">
          {pending.map(r => (
            <RedemptionRow key={r.id} req={r} onAction={() => setActiveId(r.id)} />
          ))}
        </div>
      )}

      {settled.length > 0 && (
        <>
          <SectionHeader title={`History (${settled.length})`} />
          <div className="space-y-2 opacity-80">
            {settled.map(r => <RedemptionRow key={r.id} req={r} onAction={() => undefined} />)}
          </div>
        </>
      )}

      {/* Mark delivered modal */}
      {activeRequest && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center px-4" onClick={closeModal}>
          <div className="w-full max-w-md bg-card rounded-2xl border shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="text-base font-bold">Confirm delivery</h3>
              <button onClick={closeModal} className="text-muted-foreground hover:text-foreground" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="rounded-lg bg-secondary/40 p-3 text-xs">
                <p className="font-bold mb-0.5">{activeRequest.benefitTitle}</p>
                <p className="text-muted-foreground">For {activeRequest.buyerName} · {activeRequest.cost.toFixed(4)} {activeRequest.symbol}</p>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-1 block">Proof URL <span className="normal-case font-normal">(optional)</span></label>
                <Input
                  placeholder="https://drive.google.com/... or shipping tracking link"
                  value={proofUrl}
                  onChange={e => setProofUrl(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-1 block">Note to buyer</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Shipped via FedEx, ETA Tue. Tracking 12345."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border bg-background text-sm resize-none"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Either field is fine. The buyer can dispute within 7 days; otherwise the {activeRequest.symbol} escrow releases to you automatically.</p>
            </div>
            <div className="px-5 py-3 border-t bg-secondary/30 flex gap-2">
              <Button variant="outline" onClick={closeModal} className="flex-1" disabled={busy}>Cancel</Button>
              <Button onClick={() => markDelivered(true)} disabled={busy} className="flex-1 bg-aura text-white">
                {busy ? 'Confirming…' : <><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Confirm delivery</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RedemptionRow({ req, onAction }: { req: RedemptionRequest; onAction: () => void }) {
  const isPending = req.status === 'awaiting_delivery';
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
      {req.buyerAvatar ? (
        <img src={req.buyerAvatar} alt="" className="w-10 h-10 rounded-full shrink-0 object-cover" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-secondary/60 flex items-center justify-center shrink-0 text-sm font-bold">
          {req.buyerName.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">
          {req.buyerName} <span className="font-normal text-muted-foreground">redeemed</span> {req.benefitTitle}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {req.cost.toFixed(4)} {req.symbol} · {new Date(req.createdAt).toLocaleDateString()}
          {req.deliveredAt && <> · Delivered {new Date(req.deliveredAt).toLocaleDateString()}</>}
        </p>
      </div>
      {isPending ? (
        <Button size="sm" onClick={onAction} className="shrink-0 bg-aura text-white">
          Mark delivered
        </Button>
      ) : (
        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full shrink-0 ${
          req.status === 'completed' ? 'bg-green-500/15 text-green-600 dark:text-green-400'
          : req.status === 'disputed' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
          : 'bg-secondary/60 text-muted-foreground'
        }`}>
          {req.status.replace(/_/g, ' ')}
        </span>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// DRAFTS TAB (2026-05-11 R4) — replaces old Inventory in Studio.
// Reads drafts from localStorage ('aura_drafts' key, written by CreatePage's
// Save Draft button). Lets the user resume editing or delete drafts.
// ────────────────────────────────────────────────────────────────

interface DraftRecord {
  id?: string;
  title?: string;
  content?: string;
  mode?: 'photo' | 'video' | 'text' | 'audio' | 'live';
  savedAt?: number;
  coverImage?: string;
  isPremium?: boolean;
  premiumPrice?: number;
  tags?: string[];
}

function DraftsTab() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);

  const reload = useCallback(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('aura_drafts') || '[]');
      setDrafts(Array.isArray(raw) ? raw : []);
    } catch { setDrafts([]); }
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener('focus', reload);
    return () => window.removeEventListener('focus', reload);
  }, [reload]);

  const deleteDraft = (idx: number) => {
    const next = drafts.filter((_, i) => i !== idx);
    localStorage.setItem('aura_drafts', JSON.stringify(next));
    setDrafts(next);
  };

  const resumeDraft = (d: DraftRecord) => {
    // 2026-05-11 R8: pass the draft id so CreatePage can rehydrate the full
    // draft (title, content, images, tags, premium, fractionalize, etc.) —
    // previously we only forwarded the mode, losing all the user's input.
    const mode = d.mode || 'photo';
    const params = new URLSearchParams({ mode });
    if (d.id) params.set('draftId', d.id);
    navigate(`/create?${params.toString()}`);
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title={`Drafts (${drafts.length})`}
        right={
          <button onClick={() => navigate('/create')} className="text-xs text-aura font-semibold hover:underline inline-flex items-center gap-1">
            New post <Plus className="w-3 h-3" />
          </button>
        }
      />
      {drafts.length === 0 ? (
        <EmptyState
          icon={Edit3}
          title="No drafts saved"
          desc="Press the Save Draft button in the composer to keep work-in-progress here."
          cta={{ label: '+ Create', onClick: () => navigate('/create') }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {drafts.map((d, i) => (
            <div
              key={i}
              className="rounded-xl border bg-card hover:border-aura/40 hover:shadow-sm transition-all overflow-hidden group"
            >
              {d.coverImage && (
                <div className="aspect-[16/9] bg-secondary/40 overflow-hidden">
                  <img src={d.coverImage} alt={d.title || 'Draft cover'} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <FileEdit className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{d.title || 'Untitled draft'}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                      {d.mode || 'photo'} · {d.savedAt ? new Date(d.savedAt).toLocaleString() : 'Just now'}
                    </p>
                  </div>
                </div>
                {d.content && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{d.content}</p>
                )}
                {d.isPremium && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-500 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" /> Premium {d.premiumPrice ? `${d.premiumPrice} ORA` : ''}
                  </span>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => resumeDraft(d)}
                    className="flex-1 bg-aura hover:bg-aura-dark text-white"
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1" /> Resume
                  </Button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this draft? This cannot be undone.')) deleteDraft(i);
                    }}
                    className="p-2 rounded-lg hover:bg-red-500/10 hover:text-red-500 text-muted-foreground transition-colors"
                    title="Delete draft"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// INVENTORY TAB
// ────────────────────────────────────────────────────────────────

function InventoryTab(props: {
  fnfts: ReturnType<typeof useMockChain>['fractionalizedNfts'];
  myPostsCount: number;
  onMintFnft: () => void;
}) {
  const navigate = useNavigate();

  return (
    <div className="space-y-5">
      <SectionHeader
        title={`Fractional NFTs (${props.fnfts.length})`}
        right={
          <button onClick={props.onMintFnft} className="text-xs text-aura font-semibold hover:underline inline-flex items-center gap-1">
            Mint new <Plus className="w-3 h-3" />
          </button>
        }
      />
      {props.fnfts.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No fractional NFTs minted yet"
          desc="Wrap any post into a fractional NFT during publish, or split an existing work into ORA-priced fragments."
          cta={{ label: 'Mint fractional NFT', onClick: props.onMintFnft }}
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {props.fnfts.map(f => {
            const sold = f.totalFragments - f.ownedFragments;
            const soldPct = f.totalFragments > 0 ? Math.min(100, (sold / f.totalFragments) * 100) : 0;
            return (
              <button
                key={f.id}
                onClick={() => navigate(`/marketplace/fraction/${f.id}`)}
                className="text-left rounded-xl border bg-card hover:border-indigo-500/40 hover:shadow-sm transition-all overflow-hidden group"
              >
                <div className="aspect-square bg-gradient-to-br from-indigo-500/15 to-violet-500/15 flex items-center justify-center text-5xl relative overflow-hidden">
                  {f.coverImage ? (
                    <img src={f.coverImage} alt={f.title} className="w-full h-full object-cover" />
                  ) : (
                    <span>{f.coverEmoji}</span>
                  )}
                </div>
                <div className="p-3 space-y-2">
                  <p className="text-sm font-semibold truncate">{f.title}</p>
                  <div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                      <span>{sold}/{f.totalFragments} sold</span>
                      <span>{f.pricePerFragment.toFixed(4)} ORA</span>
                    </div>
                    <div className="w-full h-1 rounded-full bg-secondary/60 overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${soldPct}%` }} />
                    </div>
                  </div>
                  {f.revenue > 0 && (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">+{f.revenue.toFixed(4)} ORA revenue</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Future: premium content keys, sponsored ads, etc. */}
      <div className="rounded-xl border bg-secondary/30 p-4 text-center">
        <p className="text-[11px] text-muted-foreground">
          More inventory — premium content keys, sponsored ad slots, remix licenses — lands in v0.9.
        </p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// GOVERNANCE TAB
// ────────────────────────────────────────────────────────────────

function GovernanceTab(props: { myProposalCount: number }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ActionTile
          icon={Vote}
          title="Draft DAO proposal"
          desc={props.myProposalCount > 0
            ? `You have ${props.myProposalCount} active proposal${props.myProposalCount === 1 ? '' : 's'}. Add another to push protocol changes.`
            : 'Propose changes to reward params, partnerships, technical upgrades.'}
          pill="Page"
          onClick={() => navigate('/governance/create')}
        />
        <ActionTile
          icon={Award}
          title="Run for committee"
          desc="Stake ORA to be a candidate in the next election cycle. Committees adjudicate disputes & emergency motions."
          pill="Page"
          onClick={() => navigate('/governance/committees')}
        />
      </div>
      <div className="rounded-xl border bg-card p-4">
        <SectionHeader
          title="Quick links"
          right={null}
        />
        <div className="flex flex-wrap gap-2 mt-2">
          <QuickLink icon={Vote}    label="Active proposals"    onClick={() => navigate('/governance/active')} />
          <QuickLink icon={Award}   label="Committees"          onClick={() => navigate('/governance/committees')} />
          <QuickLink icon={FileText} label="Completed votes"    onClick={() => navigate('/governance/completed')} />
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// shared helpers
// ────────────────────────────────────────────────────────────────

function StatCell({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div>
      <p className="text-xl md:text-2xl font-black tabular-nums">{value.toLocaleString()}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      {hint && <p className="text-[10px] text-aura font-semibold mt-0.5">{hint}</p>}
    </div>
  );
}

function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between mb-2">
      <h2 className="text-sm font-bold text-foreground">{title}</h2>
      {right}
    </div>
  );
}

function EmptyState({ icon: Icon, title, desc, cta }: { icon: typeof Sparkles; title: string; desc: string; cta?: { label: string; onClick: () => void } }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card p-8 text-center">
      <div className="inline-flex w-12 h-12 rounded-2xl bg-secondary/60 items-center justify-center text-muted-foreground mb-3">
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-sm font-bold mb-1">{title}</p>
      <p className="text-xs text-muted-foreground max-w-sm mx-auto">{desc}</p>
      {cta && (
        <Button size="sm" onClick={cta.onClick} className="mt-4 bg-aura text-white">
          {cta.label} <ArrowRight className="w-3 h-3 ml-1" />
        </Button>
      )}
    </div>
  );
}

interface ActionTileProps {
  icon: typeof Coins;
  title: string;
  desc: string;
  pill: string;
  onClick: () => void;
}

function ActionTile({ icon: Icon, title, desc, pill, onClick }: ActionTileProps) {
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-2xl border p-5 transition-all bg-card hover:border-aura/40 hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors bg-aura/10 text-aura group-hover:bg-aura group-hover:text-white">
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full bg-secondary/60 text-muted-foreground">{pill}</span>
      </div>
      <p className="text-sm font-bold mb-0.5">{title}</p>
      <p className="text-[11px] text-muted-foreground line-clamp-2">{desc}</p>
      <div className="flex items-center gap-1 text-[11px] text-aura font-semibold mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        Open <ArrowRight className="w-3 h-3" />
      </div>
    </button>
  );
}

function QuickLink({ icon: Icon, label, onClick }: { icon: typeof Vote; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-secondary/60 text-muted-foreground hover:bg-aura/10 hover:text-aura transition-colors"
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
      <ExternalLink className="w-3 h-3 opacity-50" />
    </button>
  );
}
