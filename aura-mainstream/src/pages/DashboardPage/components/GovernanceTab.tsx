// Dashboard Governance tab — your proposals + voting activity.
// Extracted from DashboardPage.tsx 2026-05-20 P-1 split.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, ArrowUpRight, Award, CheckCircle,
  Plus, Target, Vote,
} from 'lucide-react';
import { useMockChain, type Proposal } from '@/context/MockChainContext';
import { getCommitteeMeta } from '@/components/governance/proposalHelpers';
import { KpiTile, ProposalRow, formatRelative } from './dashboardRows';

export function GovernanceTab({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const mockChain = useMockChain();
  const myProposals = useMemo(
    () => mockChain.proposals.filter(p =>
      p.proposer === mockChain.walletAddress
      || p.proposer === 'You'
      || (mockChain.publicKey ? p.proposer === mockChain.publicKey : false),
    ),
    [mockChain.proposals, mockChain.walletAddress, mockChain.publicKey],
  );
  const votedProposals = useMemo(() => {
    return Object.entries(mockChain.myVotes)
      .map(([id, vote]) => ({
        proposal: mockChain.proposals.find(p => p.id === id),
        vote: vote as 'for' | 'against',
      }))
      .filter((x): x is { proposal: Proposal; vote: 'for' | 'against' } => x.proposal !== undefined);
  }, [mockChain.myVotes, mockChain.proposals]);

  const myApplications = useMemo(
    () => mockChain.electionApplications.filter(a => a.applicantWallet === mockChain.walletAddress && !a.withdrawn),
    [mockChain.electionApplications, mockChain.walletAddress],
  );

  const passedCount = myProposals.filter(p => p.status === 'passed').length;
  const activeCount = myProposals.filter(p => p.status === 'voting').length;
  const totalSupportCast = votedProposals.length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile icon={<Vote className="w-4 h-4" />} label="Proposals authored" value={myProposals.length.toString()} unit="on-chain" tone="aura" />
        <KpiTile icon={<Activity className="w-4 h-4" />} label="Active" value={activeCount.toString()} unit="in voting" tone="purple" />
        <KpiTile icon={<CheckCircle className="w-4 h-4" />} label="Passed" value={passedCount.toString()} unit="approved" tone="emerald" />
        <KpiTile icon={<Target className="w-4 h-4" />} label="Votes cast" value={totalSupportCast.toString()} unit="on others" tone="amber" />
      </div>

      <section className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b bg-secondary/30 flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Vote className="w-4 h-4 text-aura" />
            Proposals you authored ({myProposals.length})
          </h2>
          <button
            onClick={() => navigate('/governance/create')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-aura text-white text-xs font-bold hover:bg-aura-dark transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New proposal
          </button>
        </div>
        {myProposals.length === 0 ? (
          <div className="p-10 text-center">
            <Vote className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm font-medium mb-1">No proposals yet</p>
            <p className="text-xs text-muted-foreground mb-4">
              Propose changes to the protocol — reward params, partnerships, technical upgrades.
            </p>
            <button
              onClick={() => navigate('/governance/create')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-aura text-white text-xs font-bold hover:bg-aura-dark transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Create your first proposal
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {myProposals.map(p => (
              <ProposalRow key={p.id} p={p} navigate={navigate} myVote={mockChain.myVotes[p.id]} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b bg-secondary/30">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-aura" />
            Votes you cast ({votedProposals.length})
          </h2>
        </div>
        {votedProposals.length === 0 ? (
          <div className="p-10 text-center">
            <CheckCircle className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm font-medium mb-1">No votes cast yet</p>
            <p className="text-xs text-muted-foreground mb-3">
              Make your voice heard — vote on active community proposals.
            </p>
            <button
              onClick={() => navigate('/governance/active')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-bold hover:bg-secondary/70 transition-colors"
            >
              Browse active proposals
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {votedProposals.map(({ proposal, vote }) => (
              <ProposalRow key={proposal.id} p={proposal} navigate={navigate} myVote={vote} showMyVote />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b bg-secondary/30">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Award className="w-4 h-4 text-aura" />
            Committee applications ({myApplications.length})
          </h2>
        </div>
        {myApplications.length === 0 ? (
          <div className="p-10 text-center">
            <Award className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm font-medium mb-1">No active applications</p>
            <p className="text-xs text-muted-foreground mb-3">
              Run for a seat on Development, Operations, Technical, or Content committees.
            </p>
            <button
              onClick={() => navigate('/governance/committees')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-bold hover:bg-secondary/70 transition-colors"
            >
              View committees
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {myApplications.map(a => {
              const meta = getCommitteeMeta(a.committee);
              return (
                <div key={a.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-aura/15 flex items-center justify-center shrink-0 text-lg">
                    {meta?.icon ?? '🏛️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-semibold">{meta?.name ?? a.committee} committee</p>
                      <span className="text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded-full bg-aura/15 text-aura">
                        Cycle {a.electionCycleId}
                      </span>
                    </div>
                    {a.tagline && (
                      <p className="text-[11px] text-muted-foreground italic mb-1 line-clamp-1">“{a.tagline}”</p>
                    )}
                    <p className="text-[10px] text-muted-foreground line-clamp-2">{a.goals}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Staked at submit: <span className="font-bold">{a.stakedAtSubmit.toLocaleString()} ORA</span>
                      <span className="mx-1.5">·</span>
                      Submitted {formatRelative(a.submittedAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/governance/committee/${a.committee}`)}
                    className="text-[10px] text-aura font-bold hover:underline shrink-0"
                  >
                    View →
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Shared sub-components
// ═══════════════════════════════════════════════════════════════════════
export default GovernanceTab;
