/**
 * CommitteesView — master-detail layout for the /governance/committees route.
 *
 * Layout
 * ──────
 *   ┌──────────────┬─────────────────────────────────────┐
 *   │ Master rail  │ Detail panel                        │
 *   │  (240–280px) │  (flex-1, fills the rest)           │
 *   │              │                                     │
 *   │  • Dev   ●   │  HERO (gradient + emoji + chips)    │
 *   │  • Ops       │  Mission                            │
 *   │  • Tech      │  Stewards (Søren + Iris in Phase 1) │
 *   │  • Content   │  Active proposals                   │
 *   │  • Arb       │  Election timeline                  │
 *   │              │  Treasury / scope                   │
 *   └──────────────┴─────────────────────────────────────┘
 *
 * The whole thing is `h-[calc(100vh-Npx)]` where N is the sticky header
 * height; both columns own their own scroll so a long detail panel never
 * pushes the rail off-screen.
 *
 * Phase 1 (Foundation, Year 1) per whitepaper §13.1: stewards = core team
 * (Søren + Iris), no community elections yet.
 */

import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Users as UsersIcon, Vote as VoteIcon, ChevronRight, Clock,
  Sparkles, Calendar, FileText, Shield, Wallet, Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import UserAvatar from '@/components/UserAvatar';
import { useI18n } from '@/context/I18nContext';
import { useMockChain } from '@/context/MockChainContext';
import {
  committeeI18nKey,
  computeStats,
  COMMITTEE_META,
  CORE_TEAM,
  CURRENT_GOVERNANCE_PHASE,
  type CommitteeMeta,
  type CoreTeamMember,
} from './proposalHelpers';
import { formatElectionDate, getElectionPhase, MIN_NOMINATION_STAKE } from './electionCycle';

// Stable display order: 4 elected committees first, Arbitration last.
const COMMITTEE_ORDER: string[] = [
  'development-committee',
  'operations-committee',
  'tech-committee',
  'content-committee',
  'arbitration-committee',
];

export default function CommitteesView() {
  // Optional `:id` from /governance/committee/:id (legacy detail-page URL,
  // now redirected here). When present and valid, that committee is
  // preselected; otherwise we open the first one.
  const params = useParams<{ id?: string }>();
  const initial = params.id && COMMITTEE_META[params.id] ? params.id : COMMITTEE_ORDER[0];
  const [selectedId, setSelectedId] = useState<string>(initial);

  // Keep state in sync if the user lands on /governance/committee/:id
  // after the component is already mounted (e.g. from a deep-link).
  useEffect(() => {
    if (params.id && COMMITTEE_META[params.id] && params.id !== selectedId) {
      setSelectedId(params.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const selected = COMMITTEE_META[selectedId];

  return (
    // Fill remaining vertical space below the sticky header (header is ~73px;
    // a small buffer keeps the rounded card edges visible).
    <div className="flex h-[calc(100vh-73px)] -mx-4 md:-mx-6 -mt-6 -mb-12 border-t border-border/40">
      {/* MASTER RAIL */}
      <aside className="shrink-0 w-[230px] md:w-[260px] border-r border-border/40 bg-secondary/20 overflow-y-auto">
        <ul className="p-3 space-y-1.5">
          {COMMITTEE_ORDER.map(id => (
            <li key={id}>
              <CommitteeRailItem
                committee={COMMITTEE_META[id]}
                active={selectedId === id}
                onSelect={() => setSelectedId(id)}
              />
            </li>
          ))}
        </ul>
      </aside>

      {/* DETAIL PANEL */}
      <section className="flex-1 overflow-y-auto">
        <CommitteeDetailPanel committee={selected} />
      </section>
    </div>
  );
}

// ── Master rail item ─────────────────────────────────────────────────────
function CommitteeRailItem({
  committee, active, onSelect,
}: {
  committee: CommitteeMeta;
  active: boolean;
  onSelect: () => void;
}) {
  const { t } = useI18n();
  const mockChain = useMockChain();
  const i18nKey = committeeI18nKey(committee.id);
  const localizedName = i18nKey ? t.governance.committees[i18nKey] : committee.name;

  const activeCount = useMemo(
    () => mockChain.proposals.filter(p => p.committee === committee.id && p.status === 'voting').length,
    [mockChain.proposals, committee.id],
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'true' : undefined}
      className={`group w-full text-left rounded-xl border px-3 py-2.5 transition-all ${
        active
          ? 'border-aura/50 bg-gradient-to-br from-aura/10 to-ora/5 ring-1 ring-aura/30 shadow-sm'
          : 'border-transparent bg-card hover:bg-secondary/50 hover:border-border/50'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div className={`shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br ${committee.cover} bg-card border border-border/40 flex items-center justify-center text-xl`}>
          {committee.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-[13px] font-bold leading-tight truncate ${active ? 'text-aura' : ''}`}>
            {localizedName}
          </div>
          <div className="text-[10px] text-muted-foreground/80 truncate">
            {committee.selection === 'random-selection'
              ? 'Random'
              : `${committee.totalSeats} seats`}
          </div>
        </div>
        {activeCount > 0 && (
          <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </div>
    </button>
  );
}

// ── Detail panel ─────────────────────────────────────────────────────────
function CommitteeDetailPanel({ committee }: { committee: CommitteeMeta }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const mockChain = useMockChain();

  const i18nKey = committeeI18nKey(committee.id);
  const localizedName = i18nKey ? t.governance.committees[i18nKey] : committee.name;

  const proposalsForCommittee = useMemo(
    () => mockChain.proposals.filter(p => p.committee === committee.id),
    [mockChain.proposals, committee.id],
  );
  const activeProposals = proposalsForCommittee.filter(p => p.status === 'voting');

  const phase = getElectionPhase(committee.id);
  const isElected = committee.selection === 'election';
  const isPhase1 = CURRENT_GOVERNANCE_PHASE === 1;

  return (
    // Detail panel: fills the entire right pane width. We don't cap with
    // max-w because that's exactly what made the previous layout look
    // empty on wide screens. Instead the inner two-column grid keeps the
    // text columns readable.
    <div className="px-6 lg:px-8 xl:px-10 py-6">
      {/* HERO ─────────────────────────────────────────────────────── */}
      <div className={`relative rounded-2xl border bg-gradient-to-br ${committee.cover} bg-card overflow-hidden mb-6`}>
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative flex items-start gap-5 p-6 md:p-7">
          <div className="shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-background/60 backdrop-blur border border-border/50 flex items-center justify-center text-5xl md:text-6xl shadow-sm">
            {committee.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {isElected ? (
                <Badge variant="outline" className={`text-[11px] font-bold uppercase tracking-wider ${committee.accent}`}>
                  <VoteIcon className="w-3 h-3 mr-1" /> Elected · {committee.totalSeats} seats
                </Badge>
              ) : (
                <Badge variant="outline" className={`text-[11px] font-bold uppercase tracking-wider ${committee.accent}`}>
                  <Sparkles className="w-3 h-3 mr-1" /> Random selection
                </Badge>
              )}
              {isPhase1 && (
                <Badge variant="outline" className="text-[11px] font-bold uppercase tracking-wider border-amber-500/40 text-amber-700 dark:text-amber-300">
                  <Shield className="w-3 h-3 mr-1" /> Phase 1 · Foundation
                </Badge>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-1 leading-tight">{localizedName}</h1>
            <div className="text-sm text-muted-foreground mb-3">{committee.name} Committee</div>
            <p className="text-sm text-foreground/85 leading-relaxed max-w-3xl">
              {committee.mission}
            </p>
          </div>
        </div>
      </div>

      {/* TWO-COLUMN BODY: stewards/proposals on the left, election/treasury on the right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LEFT — wide */}
        <div className="lg:col-span-2 space-y-5">
          {/* STEWARDS / MEMBERS */}
          <Section title={isPhase1 && isElected ? 'Stewards' : 'Members'} icon={<UsersIcon className="w-4 h-4" />}>
            {!isElected ? (
              <p className="text-sm text-muted-foreground italic leading-relaxed">
                7-member panel selected at random per case (ARS-weighted, on-chain VRF, whitepaper §15.6).
              </p>
            ) : isPhase1 ? (
              <div>
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                  Managed by the core team. Community elections begin in Year 2.
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {CORE_TEAM.map(member => (
                    <CoreMemberRow key={member.username} member={member} />
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Member roster reads from on-chain election results (not yet seeded).
              </p>
            )}
          </Section>

          {/* ACTIVE PROPOSALS */}
          <Section
            title={`Active proposals (${activeProposals.length})`}
            icon={<VoteIcon className="w-4 h-4" />}
            action={
              activeProposals.length === 0 ? (
                <Button size="sm" variant="outline" onClick={() => navigate('/governance/create')}>
                  Create proposal
                </Button>
              ) : undefined
            }
          >
            {activeProposals.length > 0 ? (
              <ul className="space-y-2">
                {activeProposals.map(p => (
                  <li
                    key={p.id}
                    onClick={() => navigate(`/governance/proposal/${p.id}`)}
                    className="rounded-xl border bg-card hover:border-aura/40 hover:shadow-sm transition-all p-3.5 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h4 className="font-semibold text-sm leading-snug line-clamp-2">{p.title}</h4>
                      <Badge variant="outline" className="text-[10px] font-bold shrink-0">{(p.tier ?? 'tier-3').replace('tier-', 'Tier ').toUpperCase()}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2.5">{p.description}</p>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-[10px] mb-1">
                          <span className="text-muted-foreground font-medium">Approval</span>
                          <span className="tabular-nums font-bold">{computeStats(p).approvalPct.toFixed(0)}%</span>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full"
                            style={{ width: `${Math.min(100, computeStats(p).approvalPct)}%` }}
                          />
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                        <Clock className="w-3 h-3" /> {p.deadline}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-border/60 px-4 py-8 text-center">
                <FileText className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {isPhase1 ? 'Phase 1 — community proposals open, no submissions yet.' : 'No active proposals.'}
                </p>
              </div>
            )}
          </Section>

          {/* SCOPE */}
          <Section title="In scope" icon={<Tag className="w-4 h-4" />}>
            <div className="flex flex-wrap gap-2">
              {committee.scopeChips.map(chip => (
                <span
                  key={chip}
                  className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-medium bg-secondary text-foreground/80 border border-border/40"
                >
                  {chip}
                </span>
              ))}
            </div>
          </Section>
        </div>

        {/* RIGHT — narrow column */}
        <div className="lg:col-span-1 space-y-5">
          {/* NEXT ELECTION */}
          <Section title="Next election" icon={<Calendar className="w-4 h-4" />} compact>
            {phase.kind === 'random-selection' ? (
              <div>
                <div className="text-base font-bold text-purple-600 dark:text-purple-400 mb-1">Random per case</div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  No election. 7 arbitrators are randomly selected (ARS-weighted, on-chain VRF) for each case.
                </p>
              </div>
            ) : phase.kind === 'idle' ? (
              <div>
                <div className="text-3xl font-black tabular-nums leading-none mb-1">{phase.daysToNomination}d</div>
                <div className="text-xs text-muted-foreground mb-3">until nominations open</div>
                <ul className="text-[11px] space-y-1.5 text-muted-foreground">
                  <li className="flex items-start gap-1.5"><span className="opacity-50">→</span> Nominations open <span className="font-semibold text-foreground">{formatElectionDate(phase.nextElectionStart)}</span></li>
                  <li className="flex items-start gap-1.5"><span className="opacity-50">→</span> 7-day nomination window</li>
                  <li className="flex items-start gap-1.5"><span className="opacity-50">→</span> 7-day Q&amp;A period</li>
                  <li className="flex items-start gap-1.5"><span className="opacity-50">→</span> 7-day voting window</li>
                </ul>
              </div>
            ) : phase.kind === 'nomination' ? (
              <div>
                <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mb-1">Nominations open</div>
                <div className="text-xs text-muted-foreground">{phase.daysLeft}d left · closes {formatElectionDate(phase.nominationCloses)}</div>
              </div>
            ) : phase.kind === 'qna' ? (
              <div>
                <div className="text-base font-bold text-amber-600 dark:text-amber-400 mb-1">Community Q&amp;A</div>
                <div className="text-xs text-muted-foreground">{phase.daysLeft}d to vote · opens {formatElectionDate(phase.votingOpens)}</div>
              </div>
            ) : (
              <div>
                <div className="text-base font-bold text-blue-600 dark:text-blue-400 mb-1">Voting live</div>
                <div className="text-xs text-muted-foreground">{phase.daysLeft}d left · results {formatElectionDate(phase.resultsAt)}</div>
              </div>
            )}
            {isElected && phase.kind !== 'random-selection' && (
              <div className="mt-3 pt-3 border-t border-border/40 text-[10px] text-muted-foreground/80 leading-relaxed">
                Self-nomination requires <span className="font-bold text-foreground tabular-nums">≥ {MIN_NOMINATION_STAKE.toLocaleString()} ORA</span> staked. 6-month term · re-election allowed.
              </div>
            )}
          </Section>

          {/* TREASURY */}
          <Section title="Treasury" icon={<Wallet className="w-4 h-4" />} compact>
            <div className="text-2xl font-bold tabular-nums leading-none mb-1">{committee.treasuryShort}</div>
            <div className="text-xs text-muted-foreground mb-2">{committee.treasurySub}</div>
            <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
              {committee.treasury}
            </p>
          </Section>

          {/* SEAT BREAKDOWN */}
          {isElected && (
            <Section title="Seat composition" icon={<UsersIcon className="w-4 h-4" />} compact>
              {committee.teamSeats > 0 ? (
                <div className="space-y-2 text-xs">
                  <SeatRow label="Team-appointed" count={committee.teamSeats} total={committee.totalSeats} tone="amber" />
                  <SeatRow label="Community-elected" count={committee.electedSeats} total={committee.totalSeats} tone="emerald" />
                </div>
              ) : (
                <SeatRow label="Community-elected" count={committee.electedSeats} total={committee.totalSeats} tone="emerald" />
              )}
              <p className="text-[10px] text-muted-foreground/70 italic mt-2 leading-relaxed">
                {committee.teamSeats > 0
                  ? 'Year 2-3 transition: team-appointed seats reduce to 0 in Year 3+.'
                  : 'All seats community-elected from launch.'}
              </p>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────
function Section({
  title, icon, action, children, compact = false,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`bg-card rounded-2xl border ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          {icon}
          {title}
        </h3>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}

function CoreMemberRow({ member }: { member: CoreTeamMember }) {
  const navigate = useNavigate();
  return (
    <li className="flex items-center gap-2.5 rounded-lg border bg-secondary/30 px-3 py-2 min-w-0">
      {member.avatar ? (
        <UserAvatar
          src={member.avatar}
          displayName={member.name}
          username={member.username}
          className="w-8 h-8 rounded-full shrink-0"
        />
      ) : (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); navigate(`/u/${member.username}`); }}
          title={`View ${member.name}'s profile`}
          className="w-8 h-8 rounded-full bg-gradient-to-br from-aura/30 to-ora/30 flex items-center justify-center text-xs font-bold shrink-0 cursor-pointer hover:ring-2 hover:ring-aura/50"
        >
          {member.name.slice(0, 1).toUpperCase()}
        </button>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold leading-tight truncate">{member.name}</div>
        <div className="text-[11px] text-muted-foreground truncate">{member.role}</div>
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
    </li>
  );
}

function SeatRow({ label, count, total, tone }: { label: string; count: number; total: number; tone: 'amber' | 'emerald' }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const colorClass = tone === 'amber' ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-bold">{count} / {total}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${colorClass} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
