/**
 * ProposalCard — marketplace-grade governance card.
 *
 * Layout follows the marketplace NFT/Coin/Bounty card so the Active Proposals
 * grid feels like a "shop" of governance items rather than a list:
 *   - Same outer shell: bg-card rounded-xl border, hover:shadow-md,
 *     hover:border-aura/40, flex flex-col, cursor-pointer.
 *   - Same grid breakpoints upstream: 1 / 2 / 3 / 4 cols.
 *   - Square header region replaces the marketplace cover image with a tier
 *     "hero": tinted gradient + committee emoji + tier/status badges.
 *   - Body uses the same density: title (line-clamp-2 with min-h),
 *     metadata row, twin progress bars (the proposal-specific signal),
 *     and a dual-button footer (Details + Vote / View).
 *
 * Honesty notes
 * -------------
 *   - Quorum % uses ELIGIBLE_VOTERS = 100,000 from `proposalHelpers.ts`.
 *     That's a mock until the protocol exposes a real eligible-voter count.
 *   - Vote button's enabled state respects `myVotes[id]` (one-vote-per-wallet)
 *     and `votingPower === 0` (must stake ORA first).
 */

import { useNavigate } from 'react-router-dom';
import { Vote as VoteIcon, Clock, Users as UsersIcon, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/context/I18nContext';
import type { Proposal } from '@/context/MockChainContext';
import {
  computeStats,
  getCommitteeMeta,
  getTierMeta,
  committeeI18nKey,
} from './proposalHelpers';

interface Props {
  proposal: Proposal;
  /** Has this user already voted on this proposal? `undefined` if not. */
  myVote?: 'for' | 'against';
  /** Voting power available to this user (votes, not raw ORA). 0 = locked out. */
  votingPower: number;
  /** Called when the user wants to vote. Receives ('for' | 'against'). */
  onRequestVote: (proposal: Proposal, choice: 'for' | 'against') => void;
}

export default function ProposalCard({ proposal, myVote, votingPower, onRequestVote }: Props) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const tier = getTierMeta(proposal);
  const committee = getCommitteeMeta(proposal.committee);
  const committeeKey = committeeI18nKey(proposal.committee);
  const committeeLabel = committeeKey ? t.governance.committees[committeeKey] : null;
  const stats = computeStats(proposal);

  const goToDetail = () => navigate(`/governance/proposal/${proposal.id}`);

  const statusBadge = (() => {
    switch (proposal.status) {
      case 'passed':
        return <Badge className="bg-green-500/90 text-white text-[10px] font-bold shadow-sm border-0">Passed</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/90 text-white text-[10px] font-bold shadow-sm border-0">Rejected</Badge>;
      default:
        return <Badge className="bg-blue-500/90 text-white text-[10px] font-bold shadow-sm border-0 animate-pulse">Voting</Badge>;
    }
  })();

  const verdictRow = (() => {
    if (proposal.status !== 'voting') return null;
    // Tier I / Tier IV are special: they don't go through community voting.
    if (stats.verdict === 'tier1-immutable') {
      return (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          Immutable invariant — cannot be amended
        </div>
      );
    }
    if (stats.verdict === 'tier4-committee-only') {
      return (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          Committee-only — no community vote
        </div>
      );
    }
    if (stats.verdict === 'pass') {
      return (
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Will pass at deadline
        </div>
      );
    }
    if (stats.verdict === 'approval-pending') {
      return (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          Quorum met — approval still {tier.approval}%
        </div>
      );
    }
    if (stats.verdict === 'quorum-pending') {
      return (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          Approval reached — quorum {tier.quorum}% pending
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <AlertTriangle className="w-3.5 h-3.5" />
        Both thresholds pending
      </div>
    );
  })();

  const tierKey = (proposal.tier ?? 'tier-3');
  const isVotable = tierKey !== 'tier-1' && tierKey !== 'tier-4';
  const canVote = isVotable && proposal.status === 'voting' && !myVote && votingPower > 0;
  const lockedReason = (() => {
    if (tierKey === 'tier-1') return 'Immutable';
    if (tierKey === 'tier-4') return 'Committee-only';
    if (proposal.status !== 'voting') return 'Voting closed';
    if (myVote) return `Voted ${myVote === 'for' ? 'For' : 'Against'}`;
    if (votingPower === 0) return 'Stake ORA to vote';
    return null;
  })();

  return (
    <div
      onClick={goToDetail}
      className="bg-card rounded-xl border overflow-hidden hover:shadow-md hover:border-aura/40 transition-all flex flex-col cursor-pointer group"
    >
      {/* HERO — tier-tinted gradient + committee glyph + badges.
          aspect-square keeps the card aligned with marketplace cards in the same row. */}
      <div className={`relative aspect-square bg-gradient-to-br ${tier.cover} bg-card overflow-hidden`}>
        {/* Faint grid pattern for visual texture (governance ≠ photo, so we lean on geometry) */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Committee emoji — center, scaled. Falls back to ⚖️ if missing. */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-7xl md:text-8xl drop-shadow-sm group-hover:scale-110 transition-transform duration-500">
            {committee?.icon ?? '⚖️'}
          </div>
        </div>

        {/* Top-left: tier */}
        <div className={`absolute top-2 left-2 px-2 py-1 rounded-full border text-[10px] font-bold backdrop-blur-sm ${tier.tone}`}>
          {tier.shortLabel}
        </div>

        {/* Top-right: status */}
        <div className="absolute top-2 right-2">{statusBadge}</div>

        {/* Bottom-left: deadline */}
        <div className="absolute bottom-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-background/80 backdrop-blur text-[10px] font-medium text-foreground/80 border border-border/40">
          <Clock className="w-3 h-3" />
          {proposal.deadline}
        </div>

        {/* Bottom-right: my vote chip if voted */}
        {myVote && (
          <div className={`absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold backdrop-blur ${
            myVote === 'for'
              ? 'bg-emerald-500/90 text-white'
              : 'bg-red-500/90 text-white'
          }`}>
            {myVote === 'for' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            Voted {myVote === 'for' ? 'For' : 'Against'}
          </div>
        )}
      </div>

      {/* BODY — same density as marketplace card */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Committee + proposer line (replaces marketplace's "by @creator") */}
        <p className="text-[11px] text-muted-foreground mb-1 truncate">
          {committeeLabel ? <span>{committeeLabel}</span> : <span className="opacity-60">Committee TBD</span>}
          {proposal.proposer && (
            <>
              <span className="mx-1 opacity-40">·</span>
              <span className="opacity-80">by {proposal.proposer === 'aura-team' ? 'AURA Team' : `${proposal.proposer.slice(0, 4)}…${proposal.proposer.slice(-4)}`}</span>
            </>
          )}
        </p>

        {/* Title — line-clamp-2 + min-h matches marketplace cards */}
        <h3 className="font-semibold text-sm line-clamp-2 mb-3 min-h-[2.5rem]">{proposal.title}</h3>

        {/* Description preview — single line, optional */}
        <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3 min-h-[2rem]">
          {proposal.description}
        </p>

        {/* Twin progress: approval + quorum. The defining "data" of a proposal,
            equivalent to "price" on a marketplace card. */}
        <div className="space-y-2 mb-3">
          <div>
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="uppercase tracking-wide text-muted-foreground font-semibold">
                Approval
                <span className="ml-1 normal-case opacity-70">≥{tier.approval}%</span>
              </span>
              <span className={`font-bold tabular-nums ${stats.approvalMet ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                {stats.approvalPct.toFixed(0)}%
              </span>
            </div>
            <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all ${stats.approvalMet ? 'bg-emerald-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.min(100, stats.approvalPct)}%` }}
              />
              <div className="absolute top-0 bottom-0 w-px bg-foreground/30" style={{ left: `${tier.approval}%` }} />
            </div>
          </div>

          {tier.quorum > 0 && (
            <div>
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="uppercase tracking-wide text-muted-foreground font-semibold">
                  Quorum
                  <span className="ml-1 normal-case opacity-70">≥{tier.quorum}%</span>
                </span>
                <span className={`font-bold tabular-nums ${stats.quorumMet ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                  {stats.quorumPct.toFixed(1)}%
                </span>
              </div>
              <div className="relative h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all ${stats.quorumMet ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                  style={{ width: `${stats.quorumPct}%` }}
                />
                <div className="absolute top-0 bottom-0 w-px bg-foreground/30" style={{ left: `${tier.quorum}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Verdict line — at-a-glance "what's blocking this?" */}
        {verdictRow && <div className="mb-3">{verdictRow}</div>}

        {/* Spacer pushes meta+buttons to bottom */}
        <div className="mt-auto">
          {/* Total votes meta */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-3">
            <span className="inline-flex items-center gap-1">
              <UsersIcon className="w-3 h-3" />
              {stats.totalVotes.toLocaleString()} votes
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="text-emerald-600">{proposal.votesFor.toLocaleString()}</span>
              <span className="opacity-50">/</span>
              <span className="text-red-500">{proposal.votesAgainst.toLocaleString()}</span>
            </span>
          </div>

          {/* Dual-button footer */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={(e) => { e.stopPropagation(); goToDetail(); }}
            >
              Details
            </Button>
            {proposal.status === 'voting' && !myVote ? (
              <Button
                size="sm"
                disabled={!canVote}
                className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50"
                onClick={(e) => {
                  e.stopPropagation();
                  if (canVote) onRequestVote(proposal, 'for');
                  else navigate(`/governance/proposal/${proposal.id}`);
                }}
                title={lockedReason ?? `Vote with ${votingPower.toLocaleString()} votes`}
              >
                <VoteIcon className="w-3.5 h-3.5 mr-1" />
                {canVote ? 'Vote' : lockedReason ?? 'Vote'}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={(e) => { e.stopPropagation(); goToDetail(); }}
              >
                {proposal.status === 'passed' ? 'View result' : proposal.status === 'rejected' ? 'View result' : (myVote ? `Voted ${myVote === 'for' ? 'For' : 'Against'}` : 'View')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
