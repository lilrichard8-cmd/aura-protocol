/**
 * Shared helpers for the governance UI.
 *
 * Why this file exists
 * --------------------
 * Both the proposal grid card (used on /governance/active and /completed)
 * and the dedicated detail page (/governance/proposal/:id) need to compute
 * exactly the same numbers — tier requirements, approval %, quorum %,
 * "will it pass?" verdict — from the same Proposal struct.
 *
 * Keeping the math in one place means the badge on the card can never
 * disagree with the verdict on the detail page (a bug we shipped twice in
 * earlier iterations because each surface re-implemented the rules).
 *
 * Source of truth: AURA whitepaper §19 (proposal tiers) and §15.5 / §19.7
 * (quadratic voting + 10k vote cap).
 */

import type { Proposal } from '@/context/MockChainContext';

/** Quorum is computed against this assumed eligible-voter count.
 *  Mock value — once the protocol exposes a real `eligibleVoters` field
 *  this constant should be replaced with that value per-proposal. */
export const ELIGIBLE_VOTERS = 100_000;

export type ProposalTier = NonNullable<Proposal['tier']>;

export interface TierMeta {
  /** Display label, e.g. "Tier III · Standard". */
  label: string;
  /** Short label, e.g. "Tier III". */
  shortLabel: string;
  /** One-line plain-English summary of the rule. */
  summary: string;
  /** Required approval %, 0–100. */
  approval: number;
  /** Required quorum % (against ELIGIBLE_VOTERS). 0 means no quorum req. */
  quorum: number;
  /** Tailwind classes for the tier pill. */
  tone: string;
  /** Header gradient for cards / detail hero (background tint). */
  cover: string;
}

/** Whitepaper §19 tier table, kept verbatim so designers can grep. */
export const TIER_META: Record<ProposalTier, TierMeta> = {
  'tier-1': {
    label: 'Tier I · Immutable',
    shortLabel: 'Tier I',
    summary: 'Immutable invariant — cannot be amended by governance.',
    approval: 100,
    quorum: 100,
    tone: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
    cover: 'from-slate-500/20 via-slate-400/10 to-transparent',
  },
  'tier-2': {
    label: 'Tier II · Supermajority',
    shortLabel: 'Tier II',
    summary: 'Requires 75% approval, 50% quorum, and unanimous committee sign-off.',
    approval: 75,
    quorum: 50,
    tone: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
    cover: 'from-purple-500/25 via-fuchsia-400/10 to-transparent',
  },
  'tier-3': {
    label: 'Tier III · Standard',
    shortLabel: 'Tier III',
    summary: 'Requires 50% approval and 50% quorum.',
    approval: 50,
    quorum: 50,
    tone: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    cover: 'from-blue-500/25 via-indigo-400/10 to-transparent',
  },
  'tier-4': {
    label: 'Tier IV · Committee-only',
    shortLabel: 'Tier IV',
    summary: 'Decided by the reviewing committee — no community vote required.',
    approval: 50,
    quorum: 0,
    tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    cover: 'from-amber-500/25 via-orange-400/10 to-transparent',
  },
};

/** Resolve tier metadata, falling back to standard when missing. */
export function getTierMeta(p: Pick<Proposal, 'tier'>): TierMeta {
  return TIER_META[(p.tier ?? 'tier-3') as ProposalTier];
}

export interface ProposalStats {
  totalVotes: number;
  approvalPct: number;
  approvalMet: boolean;
  quorumPct: number;
  quorumMet: boolean;
  /** Will the proposal pass at deadline if no further votes change? */
  willPass: boolean;
  /** Short verdict text used in card + detail. */
  verdict:
    | 'pass'
    | 'approval-pending'
    | 'quorum-pending'
    | 'both-pending'
    | 'final-passed'
    | 'final-rejected'
    /** Tier I — immutable invariant, can never be amended via governance. */
    | 'tier1-immutable'
    /** Tier IV — committee decides, no community vote. */
    | 'tier4-committee-only';
}

export function computeStats(p: Proposal): ProposalStats {
  const tier = getTierMeta(p);
  const totalVotes = p.votesFor + p.votesAgainst;
  const approvalPct = totalVotes > 0 ? (p.votesFor / totalVotes) * 100 : 0;
  const quorumPct = Math.min(100, (totalVotes / ELIGIBLE_VOTERS) * 100);
  const approvalMet = approvalPct >= tier.approval;
  // Tier IV is committee-only → quorum trivially "met".
  const quorumMet = tier.quorum === 0 ? true : quorumPct >= tier.quorum;
  const willPass = approvalMet && quorumMet;

  const t = (p.tier ?? 'tier-3') as ProposalTier;
  let verdict: ProposalStats['verdict'];
  if (p.status === 'passed') verdict = 'final-passed';
  else if (p.status === 'rejected') verdict = 'final-rejected';
  else if (t === 'tier-1') verdict = 'tier1-immutable';
  else if (t === 'tier-4') verdict = 'tier4-committee-only';
  else if (willPass) verdict = 'pass';
  else if (!approvalMet && !quorumMet) verdict = 'both-pending';
  else if (!approvalMet) verdict = 'approval-pending';
  else verdict = 'quorum-pending';

  return { totalVotes, approvalPct, approvalMet, quorumPct, quorumMet, willPass, verdict };
}

/**
 * Full committee metadata, drawn from whitepaper §13.2 / §15.
 *
 * Each entry carries everything the committee card needs:
 *   - identity (name / icon / accent color)
 *   - one-line mission summary (English; UI passes through i18n for the name)
 *   - selection mechanism + treasury source
 *   - governance phase (Year 1 / 2-3 / 3+) so the card can show the current
 *     seat composition (4 team + 3 elected, vs. all elected)
 *
 * Kept as a typed map so callers get autocomplete on `meta.treasury` etc.
 */
/**
 * Governance phase per whitepaper §13.1.
 *
 * Phase 1 (Foundation / Year 1):
 *   - All committees managed by core team
 *   - No elected seats yet
 *   - Community proposals accepted but team has final decision authority
 *
 * Phase 2 (Shared Governance / Year 2-3):
 *   - 4 team-appointed + 3 community-elected seats per committee
 *   - Tech / Content stay 0 team + 7 elected (per §13.3)
 *
 * Phase 3 (Full DAO / Year 3+):
 *   - All 7 seats community-elected
 *   - Core team holds no reserved seats
 */
export type GovernancePhase = 1 | 2 | 3;

/** Hard-coded for the demo. Phase 1 = Year 1 (current). */
export const CURRENT_GOVERNANCE_PHASE: GovernancePhase = 1;

/**
 * Core team — the two founders who run all 5 committees in Phase 1.
 *
 * Søren is the human co-founder (AURA + ORA architect).
 * Iris is the AI co-founder (also the first creator on the protocol;
 * `iris` in src/data/mock.ts holds her full User profile).
 *
 * In Phase 2 (Year 2-3) the team-appointed seats reduce; in Phase 3
 * (Year 3+) every seat is community-elected and this list becomes
 * irrelevant for governance display purposes.
 */
export interface CoreTeamMember {
  name: string;
  username: string;
  /** Optional avatar URL. When omitted the card renders an initial badge. */
  avatar?: string;
  /** Short role label ("Co-founder", "AI co-founder"). */
  role: string;
}

export const CORE_TEAM: CoreTeamMember[] = [
  {
    name: 'Søren',
    username: 'soren',
    role: 'Co-founder',
    // No avatar URL on file yet — the card falls back to an initial badge.
  },
  {
    name: 'Iris',
    username: 'iris_aura',
    role: 'AI co-founder',
    // Same avatar Iris uses across the platform (src/data/mock.ts).
    avatar: '/iris-avatar.jpg',
  },
];

export interface CommitteeMeta {
  /** Stable id, e.g. 'development-committee'. */
  id: string;
  /** English short name. */
  name: string;
  /** Emoji glyph (single character). */
  icon: string;
  /** Tailwind gradient classes for hero strip. */
  cover: string;
  /** Tailwind border + text accent for badges. */
  accent: string;
  /** One-line mission. */
  mission: string;
  /** Total seats per whitepaper §13.2. */
  totalSeats: number;
  /** Treasury source description (one-time vs shared pool). */
  treasury: string;
  /** Short treasury label, used as the big number on stat tiles. */
  treasuryShort: string;
  /** Treasury sub-label (sits under the big number). */
  treasurySub: string;
  /** How seats are filled — 'election' (4 elected) or 'random' (Arbitration). */
  selection: 'election' | 'random-selection';
  /** Year-2-3 phase: team-appointed seats. Year-3+: 0. */
  teamSeats: number;
  /** Year-2-3 phase: elected seats. Year-3+: totalSeats. */
  electedSeats: number;
  /** Optional examples of in-scope work (chips on the card). */
  scopeChips: string[];
}

export const COMMITTEE_META: Record<string, CommitteeMeta> = {
  'development-committee': {
    id: 'development-committee',
    name: 'Development',
    icon: '🏗️',
    cover: 'from-indigo-500/25 via-blue-400/10 to-transparent',
    accent: 'border-indigo-500/40 text-indigo-700 dark:text-indigo-300',
    mission: 'External growth: partnerships, ecosystem grants, BD, marketing, major creator onboarding.',
    totalSeats: 7,
    treasury: '50M ORA initial budget · refills from Shared Pool',
    treasuryShort: '50M',
    treasurySub: 'ORA budget',
    selection: 'election',
    teamSeats: 4,
    electedSeats: 3,
    scopeChips: ['Ecosystem grants', 'Partnerships', 'Marketing', 'Creator onboarding'],
  },
  'operations-committee': {
    id: 'operations-committee',
    name: 'Operations',
    icon: '⚙️',
    cover: 'from-amber-500/25 via-orange-400/10 to-transparent',
    accent: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
    mission: 'Internal mechanics: reward parameters, engagement features, daily caps, MAU-driven emission approval.',
    totalSeats: 7,
    treasury: '50M ORA initial budget · refills from Shared Pool',
    treasuryShort: '50M',
    treasurySub: 'ORA budget',
    selection: 'election',
    teamSeats: 4,
    electedSeats: 3,
    scopeChips: ['Reward tuning', 'Daily caps', 'Engagement', 'Emission approvals'],
  },
  'tech-committee': {
    id: 'tech-committee',
    name: 'Technical',
    icon: '🔧',
    cover: 'from-slate-500/25 via-zinc-400/10 to-transparent',
    accent: 'border-slate-500/40 text-slate-700 dark:text-slate-300',
    mission: 'Protocol upgrades, smart-contract audits, security response, SDK + Frontend Registry maintenance.',
    totalSeats: 7,
    treasury: 'Shared Pool · 20% of annual emission',
    treasuryShort: 'Shared',
    treasurySub: '20% of emission',
    selection: 'election',
    teamSeats: 0,
    electedSeats: 7,
    scopeChips: ['Protocol upgrades', 'Audits', 'Security', 'SDK / API'],
  },
  'content-committee': {
    id: 'content-committee',
    name: 'Content',
    icon: '📝',
    cover: 'from-pink-500/25 via-rose-400/10 to-transparent',
    accent: 'border-pink-500/40 text-pink-700 dark:text-pink-300',
    mission: 'Content classification (Tier 0–3), tagging standards, frontend display rules, frontend admission criteria.',
    totalSeats: 7,
    treasury: 'Shared Pool · 20% of annual emission',
    treasuryShort: 'Shared',
    treasurySub: '20% of emission',
    selection: 'election',
    teamSeats: 0,
    electedSeats: 7,
    scopeChips: ['Tier 0 filters', 'Tagging standards', 'Frontend display rules', 'Sponsored content labels'],
  },
  'arbitration-committee': {
    id: 'arbitration-committee',
    name: 'Arbitration',
    icon: '⚖️',
    cover: 'from-purple-500/25 via-fuchsia-400/10 to-transparent',
    accent: 'border-purple-500/40 text-purple-700 dark:text-purple-300',
    mission: 'Two-trial dispute resolution: creator disputes, remix conflicts, frontend bond slashing & enforcement.',
    totalSeats: 7,
    treasury: 'Shared Pool · per-case stipend (20–50 ORA)',
    treasuryShort: 'Per-case',
    treasurySub: '20–50 ORA',
    selection: 'random-selection',
    teamSeats: 0,
    electedSeats: 0,
    scopeChips: ['Creator disputes', 'Remix conflicts', 'Frontend slashing', 'Two-trial system'],
  },
};

export function getCommitteeMeta(committeeId?: string) {
  if (!committeeId) return null;
  return COMMITTEE_META[committeeId] ?? null;
}

/** Maps a committee id to the i18n key under `t.governance.committees.*`.
 *  Returns null for unknown / missing ids so callers can fall back to a
 *  "Committee TBD" placeholder. */
export function committeeI18nKey(
  committeeId?: string,
): 'development' | 'content' | 'operations' | 'arbitration' | 'technical' | null {
  switch (committeeId) {
    case 'development-committee': return 'development';
    case 'content-committee':     return 'content';
    case 'operations-committee':  return 'operations';
    case 'arbitration-committee': return 'arbitration';
    case 'tech-committee':        return 'technical';
    default: return null;
  }
}
