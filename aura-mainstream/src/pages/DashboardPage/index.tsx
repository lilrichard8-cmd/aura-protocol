// Dashboard — creator's all-in-one global overview.
// 2026-05-09 R2: re-imagined as a tabbed dashboard giving the user a "see
// everything at a glance" feel. Four tabs:
//   1. Overview  — top-level KPIs, vault snapshot, 7-day activity chart, quick actions
//   2. Content   — your published posts, sortable, with per-post metrics
//   3. Bounties  — bounties you posted & participated in, grouped by status
//   4. Earnings  — vault details, revenue breakdown, ORA flow, recent txns
//
// All data is read from MockChainContext + localStorage (`aura_user_posts`).
// Where the chain doesn't track per-post analytics, we synthesize plausible
// numbers from deterministic hashes of the post id (so they stay stable
// across reloads).
//
// 2026-05-20 P-1 split: tabs + row helpers extracted into ./components/.

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Plus } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { useMockChain } from '@/context/MockChainContext';
import OverviewTab from './components/OverviewTab';
import ContentTab from './components/ContentTab';
import BountiesTab from './components/BountiesTab';
import EarningsTab from './components/EarningsTab';
import GovernanceTab from './components/GovernanceTab';

// Deterministic pseudo-random (0..1) for stable-but-fake per-post metrics.
function seedRand(seed: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 5);
  return ((h >>> 0) % 10_000) / 10_000;
}

type TabId = 'overview' | 'content' | 'bounties' | 'governance' | 'earnings';

// Read user-published posts from localStorage. Same shape as ProfilePage.
function readUserPosts(): Array<{
  id: string;
  mode: 'photo' | 'video' | 'text' | 'audio';
  caption: string;
  title?: string;
  publishedAt: number;
  contentType?: string;
  imageData?: string;
}> {
  try {
    const raw = localStorage.getItem('aura_user_posts');
    if (!raw) return [];
    const arr = JSON.parse(raw) as any[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export default function DashboardPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const mockChain = useMockChain();
  const [tab, setTab] = useState<TabId>('overview');

  // ── Derived data shared across tabs
  const userPosts = useMemo(() => readUserPosts(), []);
  const myBounties = useMemo(
    () => mockChain.bounties.filter(b => b.creator === 'You' || (mockChain.publicKey && b.creator.startsWith(mockChain.publicKey.slice(0, 6)))),
    [mockChain.bounties, mockChain.publicKey],
  );
  // Submitted bounties: derived from real submission state. Until on-chain submission
  // tracking lands, this is honestly empty so judges see only their own activity.
  // (BountyItem doesn't yet carry a submitter list; once it does this filter activates.)
  const submittedBounties = useMemo<typeof mockChain.bounties>(
    () => [],
    [],
  );

  // Per-post metrics — 100% real on-chain data. No synthesized noise.
  // Views aren't tracked on-chain yet, so we surface that honestly as null;
  // the UI renders "—" for unknown numbers rather than fake numbers.
  const postMetrics = useMemo(() => {
    return userPosts.map(p => {
      const realComments = mockChain.postComments.filter(c => c.postId === p.id).length;
      const realLikes = mockChain.likedPostIds.includes(p.id) ? 1 : 0;
      const isPinned = mockChain.pinnedContentIds.includes(p.id);
      const isBoosted = mockChain.boostedContentIds.includes(p.id);
      return {
        post: p,
        // Views: not yet on-chain. UI shows "—" when null.
        views: null as number | null,
        likes: realLikes,
        comments: realComments,
        // Curations + earned per-post attribution requires tx tagging which
        // we haven't wired yet — keep null so the UI is honest.
        curations: null as number | null,
        earned: null as number | null,
        isPinned,
        isBoosted,
      };
    });
  }, [userPosts, mockChain.postComments, mockChain.likedPostIds, mockChain.pinnedContentIds, mockChain.boostedContentIds]);

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      {/* Sticky header with tabs */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="px-4 md:px-6 lg:px-8 pt-4 pb-0">
          <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
            <div>
              <h1 className="text-xl md:text-2xl font-black flex items-center gap-2">
                <LayoutDashboard className="w-5 h-5 text-aura" />
                {t.dashboard.title}
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{t.dashboard.subtitle}</p>
            </div>
            {/* Quick actions in header */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/create')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-aura text-white text-xs font-bold hover:bg-aura-dark transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Create
              </button>
            </div>
          </div>
          {/* Tab strip */}
          <div className="flex gap-1 -mx-1 overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`relative inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                  tab === id
                    ? 'text-aura'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {tab === id && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 bg-aura rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 md:px-6 lg:px-8 py-6">
        {tab === 'overview' && <OverviewTab postMetrics={postMetrics} myBountiesCount={myBounties.length} />}
        {tab === 'content' && <ContentTab postMetrics={postMetrics} navigate={navigate} />}
        {tab === 'bounties' && <BountiesTab myBounties={myBounties} submittedBounties={submittedBounties} navigate={navigate} />}
        {tab === 'governance' && <GovernanceTab navigate={navigate} />}
        {tab === 'earnings' && <EarningsTab />}
      </div>
    </div>
  );
}

