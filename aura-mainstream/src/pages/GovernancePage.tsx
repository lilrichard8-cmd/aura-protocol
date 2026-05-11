import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Vote, Clock, Plus, Shield, Upload, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/context/ToastContext';
import { useI18n } from '@/context/I18nContext';
import { useMockChain, type Proposal } from '@/context/MockChainContext';
import ProposalCard from '@/components/governance/ProposalCard';
import VotingPowerBadge from '@/components/governance/VotingPowerBadge';
import CommitteeApplicationButton from '@/components/governance/CommitteeApplicationButton';
import ProposalEligibilityBadge from '@/components/governance/ProposalEligibilityBadge';
import CommitteeFilter, { type CommitteeFilterValue } from '@/components/governance/CommitteeFilter';
import CommitteesView from '@/components/governance/CommitteesView';
import CreateProposalView from '@/components/governance/CreateProposalView';




export default function GovernancePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  // Derive the current sub-page from URL (per 2026-05-09 redesign:
  // each tab is now a real route + sidebar entry, not an in-page Tabs).
  // Map: /governance/active|completed|committees|create — fallback to active.
  // Map URL → active tab. Note `/governance/committee/:id` (singular
  // "committee", legacy detail-page URL) also routes here and should
  // resolve to the committees tab — CommitteesView reads :id from
  // useParams and preselects the matching entry.
  const subPath = location.pathname.replace(/^\/governance\/?/, '') || 'active';
  const tabFromPath: 'active' | 'completed' | 'committees' | 'create' =
    subPath.startsWith('committee/') ? 'committees'
    : (['active', 'completed', 'committees', 'create'] as const).find(s => s === subPath) ?? 'active';
  const activeTab = tabFromPath;

  // Per whitepaper §15.2: every committee has 7 members.
  const committees = [
    {
      id: 'development-committee',
      name: 'Development',
      icon: '🏗️',
      members: 7,
      proposals: 12,
    },
    {
      id: 'content-committee',
      name: 'Content',
      icon: '📝',
      members: 7,
      proposals: 23,
    },
    {
      id: 'operations-committee',
      name: 'Operations',
      icon: '⚙️',
      members: 7,
      proposals: 18,
    },
    {
      id: 'arbitration-committee',
      name: 'Arbitration',
      icon: '⚖️',
      members: 7,
      proposals: 8,
    },
    {
      id: 'tech-committee',
      name: 'Technical',
      icon: '🔧',
      members: 7,
      proposals: 15,
    },
  ];
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [voteChoice, setVoteChoice] = useState<'for' | 'against' | null>(null);

  // Create proposal: state + handlers now live inside CreateProposalView
  // (Studio-style two-column layout). GovernancePage just hosts the route.

  // Committee filter — separate state per tab so toggling Active/Completed
  // doesn't clobber the other tab's selection.
  const [activeFilter, setActiveFilter] = useState<CommitteeFilterValue>('all');
  const [completedFilter, setCompletedFilter] = useState<CommitteeFilterValue>('all');

  const mockChain = useMockChain();

  // Voting power per whitepaper §15.5 / §19.7:
  //   votes = floor(√(staked ORA))
  //   hard cap: 10,000 votes per wallet on any single proposal
  // Examples: 100 ORA → 10 / 10,000 → 100 / 1M → 1,000 / 100M → 10,000 (cap)
  const stakedOra = mockChain.stakedOra ?? 0;
  const votingPower = Math.min(10_000, Math.floor(Math.sqrt(stakedOra)));

  const chainProposals = mockChain.proposals as Proposal[];
  const activeProposals = chainProposals.filter(p => p.status === 'voting');
  const completedProposals = chainProposals.filter(p => p.status === 'passed' || p.status === 'rejected');

  // Committee count helpers — used by the filter chip badges.
  const buildCounts = (list: Proposal[]) => {
    const counts: Record<string, number> = { all: list.length };
    for (const p of list) {
      const key = p.committee || 'unassigned';
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  };
  const activeCounts = buildCounts(activeProposals);
  const completedCounts = buildCounts(completedProposals);

  // Filtered slices for rendering.
  const matchesFilter = (p: Proposal, filter: CommitteeFilterValue) =>
    filter === 'all' || p.committee === filter;
  const filteredActive = activeProposals.filter(p => matchesFilter(p, activeFilter));
  const filteredCompleted = completedProposals.filter(p => matchesFilter(p, completedFilter));

  const handleVote = (proposal: Proposal, choice: 'for' | 'against') => {
    setSelectedProposal(proposal);
    setVoteChoice(choice);
    setShowVoteModal(true);
  };

  const confirmVote = async () => {
    if (!selectedProposal || !voteChoice) return;
    try {
      await mockChain.voteOnProposal(selectedProposal.id, voteChoice);
      showToast(
        'success',
        t.governance.toasts.voteSuccess,
        `Voted ${voteChoice === 'for' ? t.governance.toasts.voteFor : t.governance.toasts.voteAgainst}: ${selectedProposal.title} (${votingPower.toLocaleString()} votes from √${stakedOra.toLocaleString()} staked ORA)`
      );
    } catch (e: any) {
      showToast('error', 'Vote Failed', e.message);
    }
    setShowVoteModal(false);
    setSelectedProposal(null);
    setVoteChoice(null);
  };

  // (Submit logic now inside CreateProposalView — it owns title/description/committee/tier
  // and calls mockChain.createProposal directly.)

  const renderCard = (proposal: Proposal) => (
    <ProposalCard
      key={proposal.id}
      proposal={proposal}
      myVote={mockChain.myVotes[proposal.id]}
      votingPower={votingPower}
      onRequestVote={handleVote}
    />
  );

  // Per-tab title for the sticky header (tabs are now sidebar entries, not Tabs UI)
  const tabTitle: Record<typeof activeTab, string> = {
    active: t.governance.tabs.active,
    completed: t.governance.tabs.completed,
    committees: t.governance.tabs.committees,
    create: t.governance.tabs.create,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header — full-width, no max-w cap so it stretches edge to edge */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/40">
        <div className="flex items-center justify-between gap-4 p-4 px-4 md:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg md:text-xl lg:text-2xl font-bold">{t.governance.title}</h1>
              <span className="text-muted-foreground/40 hidden md:inline">/</span>
              <span className="text-sm md:text-base font-medium text-foreground/80">{tabTitle[activeTab]}</span>
              {activeTab === 'active' && activeProposals.length > 0 && (
                <Badge variant="secondary" className="text-xs">{activeProposals.length}</Badge>
              )}
            </div>
            <p className="text-xs md:text-sm text-muted-foreground truncate">{t.governance.subtitle}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Tab-specific affordance:
               - committees → "Run for committee" entry (election rules + apply form)
               - create     → "Can submit / Stake to submit" eligibility check
               - active/completed → voting power (for actually voting)
            */}
            {activeTab === 'committees' ? <CommitteeApplicationButton />
              : activeTab === 'create' ? <ProposalEligibilityBadge />
              : <VotingPowerBadge />}
          </div>
        </div>
      </div>

      {/* Body — each tab fills the page; no global max-w wrapper, so wide screens use the whole canvas */}
      <div className="px-4 md:px-6 pt-6 pb-12">
        {activeTab === 'active' && (
          activeProposals.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Vote className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No active proposals right now.</p>
              <Button variant="outline" className="mt-4" onClick={() => navigate('/governance/create')}>
                <Plus className="w-4 h-4 mr-1" /> {t.governance.tabs.create}
              </Button>
            </div>
          ) : (
            <>
              <CommitteeFilter
                value={activeFilter}
                onChange={setActiveFilter}
                counts={activeCounts}
                className="mb-4"
              />
              {filteredActive.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">No active proposals in this committee.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setActiveFilter('all')}>Clear filter</Button>
                </div>
              ) : (
                // Marketplace-grade grid: 1 / 2 / 3 / 4 cols, gap-4
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredActive.map(renderCard)}
                </div>
              )}
            </>
          )
        )}

        {activeTab === 'completed' && (
          completedProposals.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No completed proposals yet.</p>
            </div>
          ) : (
            <>
              <CommitteeFilter
                value={completedFilter}
                onChange={setCompletedFilter}
                counts={completedCounts}
                className="mb-4"
              />
              {filteredCompleted.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">No completed proposals in this committee.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setCompletedFilter('all')}>Clear filter</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredCompleted.map(renderCard)}
                </div>
              )}
            </>
          )
        )}

        {activeTab === 'committees' && (
          // Master-detail layout: rail on the left, full detail panel on the right,
          // filling the remaining viewport height.
          <CommitteesView />
        )}

        {activeTab === 'create' && <CreateProposalView />}

        {/* Vote Modal */}
        {showVoteModal && selectedProposal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background rounded-xl p-6 max-w-md w-full mx-4 border">
              <h3 className="text-lg font-bold mb-4">{t.governance.vote.title}</h3>
              
              <div className="mb-4 p-3 bg-secondary rounded-lg">
                <p className="font-medium line-clamp-2">{selectedProposal.title}</p>
                <p className="text-sm text-muted-foreground">
                  {t.governance.vote.yourChoice}: <span className={voteChoice === 'for' ? 'text-green-600' : 'text-red-600'}>
                    {voteChoice === 'for' ? t.governance.toasts.voteFor : t.governance.toasts.voteAgainst}
                  </span>
                </p>
              </div>

              <div className="space-y-4">
                {/* Per whitepaper §15.5 voting power = √(staked ORA),
                    capped at 10,000 votes per wallet on a single proposal.
                    Users don't pick a per-vote amount — every vote uses
                    their full voting power. */}
                <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-200/40 dark:border-purple-800/40 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your voting power</span>
                    <span className="text-2xl font-black text-purple-600 dark:text-purple-400">
                      {votingPower.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    √({stakedOra.toLocaleString()} staked ORA) = {votingPower.toLocaleString()} votes.
                    {votingPower >= 10_000 && <span className="text-amber-600 dark:text-amber-400 font-medium"> (10k cap reached — whales can't dominate.)</span>}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 italic mt-1">
                    Quadratic voting + 10,000-vote cap (whitepaper §15.5 / §19.7).
                  </p>
                </div>

                {votingPower === 0 && (
                  <div className="bg-amber-500/10 border border-amber-200/40 dark:border-amber-800/40 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-300">
                    ⚠️ You need to stake ORA before you can vote. Visit the Wallet → Staking section to lock ORA for governance.
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowVoteModal(false)}
                    className="flex-1"
                  >
                    {t.governance.vote.cancel}
                  </Button>
                  <Button
                    onClick={confirmVote}
                    disabled={votingPower === 0}
                    className={`flex-1 ${
                      voteChoice === 'for'
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-red-600 hover:bg-red-700'
                    } text-white disabled:opacity-50`}
                  >
                    {t.governance.vote.confirm}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}