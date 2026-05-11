/**
 * ProposalDetailPage — full read-only + voting surface for a single proposal.
 *
 * URL: /governance/proposal/:id
 *
 * Sections (top → bottom):
 *   1. Hero strip: tier-tinted gradient with committee glyph + status + tier
 *      + deadline pill. Mirrors the card hero so users feel at home.
 *   2. Title + meta row (proposer, committee, created date).
 *   3. Vote panel (sticky on lg+):
 *        - User's voting power (√staked ORA, 10k cap)
 *        - For/Against split
 *        - Approval and Quorum progress with threshold ticks
 *        - Verdict ("Will pass at deadline" / "Quorum pending" / etc.)
 *        - Vote buttons (For / Against) or "Voted X" lock state
 *   4. Description (markdown-style preformatted text — for now whitespace-pre-wrap;
 *      can swap to a real markdown renderer later).
 *   5. Tier rules box: which whitepaper section, what's required, why.
 *   6. Timeline: created → voting opens → deadline → outcome.
 *
 * Honesty notes
 * -------------
 *   - Description is rendered with `whitespace-pre-wrap` so newlines from
 *     the create form are preserved. There's no markdown parser yet.
 *   - The "Discussion" section is intentionally omitted until on-chain
 *     comments exist. Pretending we have a discussion forum would mislead.
 */

import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Vote as VoteIcon, CheckCircle2, XCircle, Clock,
  Users as UsersIcon, FileText, AlertTriangle, ExternalLink, Hash,
  Calendar, Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/context/ToastContext';
import { useMockChain } from '@/context/MockChainContext';
import {
  computeStats,
  getCommitteeMeta,
  getTierMeta,
  ELIGIBLE_VOTERS,
  committeeI18nKey,
} from '@/components/governance/proposalHelpers';
import { useI18n } from '@/context/I18nContext';
import VotingPowerBadge from '@/components/governance/VotingPowerBadge';

export default function ProposalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const mockChain = useMockChain();

  const proposal = mockChain.proposals.find(p => p.id === id);
  const [voting, setVoting] = useState(false);
  const [pendingChoice, setPendingChoice] = useState<'for' | 'against' | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Voting power per whitepaper §15.5 / §19.7
  const stakedOra = mockChain.stakedOra ?? 0;
  const votingPower = Math.min(10_000, Math.floor(Math.sqrt(stakedOra)));

  if (!proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Proposal not found</h1>
          <p className="text-muted-foreground mb-6">The proposal id <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{id}</code> doesn't exist on chain.</p>
          <Button onClick={() => navigate('/governance/active')}>Back to active proposals</Button>
        </div>
      </div>
    );
  }

  const tier = getTierMeta(proposal);
  const committee = getCommitteeMeta(proposal.committee);
  const committeeKey = committeeI18nKey(proposal.committee);
  const { t } = useI18n();
  const committeeLabel = committeeKey ? t.governance.committees[committeeKey] : null;
  const stats = computeStats(proposal);
  const myVote = mockChain.myVotes[proposal.id];

  const handleVote = (choice: 'for' | 'against') => {
    if (proposal.status !== 'voting') return;
    if (myVote) return;
    if (votingPower === 0) {
      showToast('error', 'Stake required', 'Stake ORA in Wallet → Staking first.');
      return;
    }
    setPendingChoice(choice);
    setShowConfirm(true);
  };

  const confirmVote = async () => {
    if (!pendingChoice) return;
    setVoting(true);
    try {
      await mockChain.voteOnProposal(proposal.id, pendingChoice);
      showToast(
        'success',
        'Vote cast',
        `Voted ${pendingChoice === 'for' ? 'For' : 'Against'} with ${votingPower.toLocaleString()} votes (√${stakedOra.toLocaleString()} staked).`,
      );
      setShowConfirm(false);
      setPendingChoice(null);
    } catch (e: any) {
      showToast('error', 'Vote failed', e?.message ?? 'Unknown error');
    } finally {
      setVoting(false);
    }
  };

  const createdDate = proposal.createdAt
    ? new Date(proposal.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky compact header (matches Governance hub style) */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/40">
        <div className="flex items-center justify-between gap-4 p-4 px-4 md:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="shrink-0"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <div className="text-xs md:text-sm text-muted-foreground truncate">
              <Link to="/governance/active" className="hover:text-foreground">DAO Governance</Link>
              <span className="mx-1.5 opacity-40">/</span>
              <span className="text-foreground/80">Proposal</span>
              <span className="mx-1.5 opacity-40">/</span>
              <span className="font-mono opacity-60">#{proposal.id}</span>
            </div>
          </div>
          <VotingPowerBadge />
        </div>
      </div>

      <div className="px-4 md:px-6 py-6 max-w-7xl mx-auto">
        {/* HERO ─ tier-tinted cover with committee glyph */}
        <div className={`relative rounded-2xl border bg-gradient-to-br ${tier.cover} bg-card overflow-hidden mb-6`}>
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
          <div className="relative flex flex-col md:flex-row gap-6 p-6 md:p-8">
            {/* Committee glyph */}
            <div className="shrink-0 w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-background/60 backdrop-blur border border-border/50 flex items-center justify-center text-6xl md:text-7xl shadow-sm">
              {committee?.icon ?? '⚖️'}
            </div>
            {/* Title block */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <Badge className={`text-[11px] font-bold border ${tier.tone}`}>{tier.label}</Badge>
                {proposal.status === 'voting' && (
                  <Badge className="bg-blue-500/90 text-white text-[11px] font-bold border-0 animate-pulse">Voting</Badge>
                )}
                {proposal.status === 'passed' && (
                  <Badge className="bg-green-500/90 text-white text-[11px] font-bold border-0">Passed</Badge>
                )}
                {proposal.status === 'rejected' && (
                  <Badge className="bg-red-500/90 text-white text-[11px] font-bold border-0">Rejected</Badge>
                )}
                {committee && committeeLabel && (
                  <Badge variant="outline" className="text-[11px]">
                    <span className="mr-1">{committee.icon}</span>{committeeLabel}
                  </Badge>
                )}
                {myVote && (
                  <Badge className={`text-[11px] font-bold border-0 ${myVote === 'for' ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
                    {myVote === 'for' ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                    Voted {myVote === 'for' ? 'For' : 'Against'}
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold mb-3 leading-tight">{proposal.title}</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5" />
                  <code className="font-mono text-xs">{proposal.id}</code>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> {createdDate}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {proposal.deadline}
                </span>
                {proposal.proposer && (
                  <span className="inline-flex items-center gap-1">
                    <span className="opacity-50">by</span>
                    <span className="font-medium text-foreground/80">
                      {proposal.proposer === 'aura-team'
                        ? 'AURA Team'
                        : `${proposal.proposer.slice(0, 6)}…${proposal.proposer.slice(-4)}`}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* MAIN GRID — left = description+rules+timeline / right = sticky vote panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <section className="bg-card rounded-2xl border p-6">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Description
              </h2>
              <div className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">
                {proposal.description || <span className="opacity-60 italic">No description provided.</span>}
              </div>
            </section>

            {/* Tier rules */}
            <section className="bg-card rounded-2xl border p-6">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4" /> {tier.shortLabel} requirements
              </h2>
              <p className="text-sm text-muted-foreground mb-4">{tier.summary}</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border bg-secondary/30 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Approval</div>
                  <div className="text-2xl font-bold tabular-nums">{tier.approval}%</div>
                  <div className="text-[11px] text-muted-foreground mt-1">of For-vs-Against votes</div>
                </div>
                <div className="rounded-xl border bg-secondary/30 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Quorum</div>
                  <div className="text-2xl font-bold tabular-nums">{tier.quorum > 0 ? `${tier.quorum}%` : '—'}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">{tier.quorum > 0 ? 'of eligible voters' : 'committee-only'}</div>
                </div>
              </div>
              <div className="mt-3 text-[11px] text-muted-foreground italic">
                Source: AURA Whitepaper §19 (proposal tiers).
              </div>
            </section>

            {/* Timeline */}
            <section className="bg-card rounded-2xl border p-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Timeline
              </h2>
              <div className="space-y-4">
                <TimelineRow
                  done
                  label="Proposal created"
                  detail={createdDate}
                  icon={<FileText className="w-3.5 h-3.5" />}
                />
                <TimelineRow
                  done
                  label="Voting opened"
                  detail={proposal.status === 'voting' ? 'In progress' : 'Closed'}
                  icon={<VoteIcon className="w-3.5 h-3.5" />}
                />
                <TimelineRow
                  done={proposal.status !== 'voting'}
                  active={proposal.status === 'voting'}
                  label={proposal.status === 'voting' ? 'Deadline' : 'Voting closed'}
                  detail={proposal.deadline}
                  icon={<Clock className="w-3.5 h-3.5" />}
                />
                <TimelineRow
                  done={proposal.status === 'passed' || proposal.status === 'rejected'}
                  label="Outcome"
                  detail={
                    proposal.status === 'passed' ? '✅ Passed and queued for execution'
                      : proposal.status === 'rejected' ? '❌ Rejected'
                      : stats.willPass ? '✅ Will pass if vote stays the same'
                      : '⏳ Pending — needs more support or quorum'
                  }
                  icon={
                    proposal.status === 'passed' ? <CheckCircle2 className="w-3.5 h-3.5" />
                    : proposal.status === 'rejected' ? <XCircle className="w-3.5 h-3.5" />
                    : <AlertTriangle className="w-3.5 h-3.5" />
                  }
                />
              </div>
            </section>

            {/* Committee link */}
            {committee && (
              <Link
                to={`/governance/committee/${proposal.committee}`}
                className="block bg-card rounded-2xl border p-4 hover:border-aura/40 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{committee.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{committeeLabel ?? committee.name}</div>
                    <div className="text-xs text-muted-foreground">7 members</div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </div>
              </Link>
            )}
          </div>

          {/* Right column — sticky vote panel */}
          <div className="lg:col-span-1">
            <div className="bg-card rounded-2xl border p-5 lg:sticky lg:top-24 space-y-5">
              {/* Title */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  {proposal.status === 'voting' ? 'Cast your vote' : 'Final result'}
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {stats.totalVotes.toLocaleString()}{' '}
                  <span className="text-sm font-normal text-muted-foreground">votes</span>
                </div>
              </div>

              {/* For / Against split */}
              <div className="space-y-2.5">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> For
                    </span>
                    <span className="font-bold tabular-nums">{proposal.votesFor.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${stats.totalVotes > 0 ? (proposal.votesFor / stats.totalVotes) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-red-500 inline-flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> Against
                    </span>
                    <span className="font-bold tabular-nums">{proposal.votesAgainst.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full transition-all"
                      style={{ width: `${stats.totalVotes > 0 ? (proposal.votesAgainst / stats.totalVotes) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Approval threshold */}
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-muted-foreground font-semibold uppercase tracking-wide">
                    Approval rate
                    <span className="ml-1 normal-case opacity-70">(needs ≥ {tier.approval}%)</span>
                  </span>
                  <span className={`font-bold tabular-nums ${stats.approvalMet ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                    {stats.approvalPct.toFixed(1)}% {stats.approvalMet && '✓'}
                  </span>
                </div>
                <div className="relative">
                  <Progress value={stats.approvalPct} className="h-2" />
                  <div className="absolute top-0 h-2 w-px bg-foreground/40" style={{ left: `${tier.approval}%` }} />
                </div>
              </div>

              {/* Quorum threshold */}
              {tier.quorum > 0 && (
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-muted-foreground font-semibold uppercase tracking-wide">
                      Quorum
                      <span className="ml-1 normal-case opacity-70">(needs ≥ {tier.quorum}%)</span>
                    </span>
                    <span className={`font-bold tabular-nums ${stats.quorumMet ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                      {stats.quorumPct.toFixed(2)}% {stats.quorumMet && '✓'}
                    </span>
                  </div>
                  <div className="relative">
                    <Progress value={stats.quorumPct} className="h-1.5" />
                    <div className="absolute top-0 h-1.5 w-px bg-foreground/40" style={{ left: `${tier.quorum}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground/70 italic mt-1">
                    {stats.totalVotes.toLocaleString()} / {ELIGIBLE_VOTERS.toLocaleString()} eligible
                  </div>
                </div>
              )}

              {/* Verdict line */}
              <div className={`rounded-lg p-3 text-xs leading-relaxed ${
                stats.verdict === 'pass' || stats.verdict === 'final-passed'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                  : stats.verdict === 'final-rejected'
                  ? 'bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400'
                  : stats.verdict === 'tier1-immutable'
                  ? 'bg-slate-500/10 border border-slate-500/30 text-slate-700 dark:text-slate-300'
                  : 'bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400'
              }`}>
                {stats.verdict === 'pass' && <>✅ <strong>Will pass</strong> at deadline if the vote holds.</>}
                {stats.verdict === 'final-passed' && <>✅ <strong>Passed.</strong> Queued for execution.</>}
                {stats.verdict === 'final-rejected' && <>❌ <strong>Rejected.</strong> Did not meet thresholds.</>}
                {stats.verdict === 'approval-pending' && <>⏳ Quorum reached, but approval is below {tier.approval}%.</>}
                {stats.verdict === 'quorum-pending' && <>⏳ Approval reached, but quorum is below {tier.quorum}%.</>}
                {stats.verdict === 'both-pending' && <>⏳ Both approval and quorum thresholds are unmet.</>}
                {stats.verdict === 'tier1-immutable' && <>🔒 <strong>Immutable invariant.</strong> Tier I rules (e.g. 95% creator share, max supply) cannot be amended through governance — they're enforced by the protocol itself (whitepaper §19.1).</>}
                {stats.verdict === 'tier4-committee-only' && <>🏛 <strong>Committee-only.</strong> Decided by the {tier.shortLabel.toLowerCase()} committee panel (§19.4) — no community vote required.</>}
              </div>

              {/* Vote actions — only available for Tier II / Tier III. */}
              {proposal.status === 'voting' && (proposal.tier === 'tier-1' || proposal.tier === 'tier-4') && (
                <div className="rounded-lg bg-secondary/40 border border-border/60 p-3 text-[11px] text-muted-foreground leading-relaxed">
                  {proposal.tier === 'tier-1'
                    ? 'No vote is taken on Tier I proposals — they reflect immutable protocol invariants. This entry is informational.'
                    : 'Tier IV decisions are made by the reviewing committee. Watch the committee\'s page for the panel\'s ruling.'}
                </div>
              )}
              {proposal.status === 'voting' && proposal.tier !== 'tier-1' && proposal.tier !== 'tier-4' && !myVote && (
                <>
                  <div className="rounded-lg bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-200/40 dark:border-purple-800/40 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Your power</span>
                      <span className="text-2xl font-black text-purple-600 dark:text-purple-400 tabular-nums">{votingPower.toLocaleString()}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/80 mt-0.5 leading-snug">
                      √({stakedOra.toLocaleString()} staked ORA) — quadratic, 10k cap (§15.5)
                    </p>
                  </div>

                  {votingPower === 0 ? (
                    <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 leading-relaxed">
                      ⚠️ You need to stake ORA before you can vote. Visit{' '}
                      <Link to="/wallet" className="underline font-medium">Wallet → Staking</Link>.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30"
                        onClick={() => handleVote('against')}
                      >
                        <XCircle className="w-4 h-4 mr-1" /> Against
                      </Button>
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleVote('for')}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" /> For
                      </Button>
                    </div>
                  )}
                </>
              )}

              {proposal.status === 'voting' && myVote && (
                <div className={`rounded-lg p-3 text-sm ${
                  myVote === 'for'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400'
                }`}>
                  <div className="flex items-center gap-2 font-semibold">
                    {myVote === 'for' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    You voted {myVote === 'for' ? 'For' : 'Against'}
                  </div>
                  <p className="text-[11px] mt-1 opacity-80">
                    Cast with {votingPower.toLocaleString()} votes. One vote per wallet (§15.5).
                  </p>
                </div>
              )}

              {/* Eligibility info */}
              <div className="text-[10px] text-muted-foreground/70 leading-relaxed pt-3 border-t border-border/40">
                <p>
                  <UsersIcon className="inline w-3 h-3 mr-0.5" />
                  Eligible: any wallet with staked ORA. One vote per wallet.
                </p>
                <p className="mt-1">
                  Voting power = √(staked ORA), capped at 10,000 votes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm modal — same shape as the original GovernancePage modal so users
          who clicked "Vote" from the card see the familiar confirmation step. */}
      {showConfirm && pendingChoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-xl p-6 max-w-md w-full border">
            <h3 className="text-lg font-bold mb-2">Confirm your vote</h3>
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{proposal.title}</p>

            <div className={`rounded-lg p-3 mb-4 text-sm ${
              pendingChoice === 'for'
                ? 'bg-emerald-500/10 border border-emerald-500/30'
                : 'bg-red-500/10 border border-red-500/30'
            }`}>
              <div className="flex items-center gap-2 font-semibold">
                {pendingChoice === 'for'
                  ? <><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span className="text-emerald-700 dark:text-emerald-400">Voting For</span></>
                  : <><XCircle className="w-4 h-4 text-red-600" /><span className="text-red-700 dark:text-red-400">Voting Against</span></>}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                With {votingPower.toLocaleString()} votes (√{stakedOra.toLocaleString()} staked ORA).
                {votingPower >= 10_000 && <span className="text-amber-600 dark:text-amber-400 font-medium"> 10k cap reached.</span>}
              </p>
            </div>

            <p className="text-[11px] text-muted-foreground mb-4 italic">
              ⚠️ Votes can't be changed once cast (one vote per wallet, whitepaper §15.5).
            </p>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setShowConfirm(false); setPendingChoice(null); }} disabled={voting} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={confirmVote}
                disabled={voting}
                className={`flex-1 text-white ${pendingChoice === 'for' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {voting ? 'Casting…' : 'Confirm vote'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Internal: timeline row ───────────────────────────────────────────────
function TimelineRow({
  done = false,
  active = false,
  label,
  detail,
  icon,
}: {
  done?: boolean;
  active?: boolean;
  label: string;
  detail?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center border-2 ${
        done
          ? 'bg-emerald-500 border-emerald-500 text-white'
          : active
          ? 'border-blue-500 text-blue-500 bg-blue-500/10'
          : 'border-border bg-muted text-muted-foreground'
      }`}>
        {icon}
      </div>
      <div className="flex-1 pt-0.5">
        <div className={`text-sm font-semibold ${done ? '' : active ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`}>
          {label}
        </div>
        {detail && <div className="text-xs text-muted-foreground mt-0.5">{detail}</div>}
      </div>
    </div>
  );
}
