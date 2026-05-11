/**
 * CommitteeApplicationButton — replaces the Voting Power badge on the
 * /governance/committees page. Clicking it opens a modal that:
 *   1. Idle phase   → shows the next election countdown + 4-step timeline
 *      and a "Get notified" CTA. Users can already prepare a draft statement.
 *   2. Nomination   → opens the application form. Requires ≥ 10,000 ORA staked.
 *      Lets users edit/withdraw an already-submitted statement.
 *   3. Q&A          → form is locked; shows "Editing window closed".
 *   4. Voting       → shows "Voting in progress, redirect to candidate vote".
 *
 * Whitepaper anchor: §15. We honor the 6-month cycle, T-21 nomination, T-14
 * close, T-7 vote opens, and the 10K-ORA stake floor.
 *
 * The modal is rendered via `createPortal(..., document.body)` to escape
 * any sticky/backdrop-filter ancestor (same fix we applied to VotingPowerBadge).
 */

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  UserPlus, X, Calendar, Clock, AlertTriangle, CheckCircle2,
  Wallet, Sparkles, Vote as VoteIcon, MessageCircle, FileText,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useMockChain, type ElectionApplication } from '@/context/MockChainContext';
import { useToast } from '@/context/ToastContext';
import { useI18n } from '@/context/I18nContext';
import {
  ELECTED_COMMITTEES, MIN_NOMINATION_STAKE,
  formatElectionDate, getElectionPhase, type ElectionPhase,
} from './electionCycle';
import { committeeI18nKey } from './proposalHelpers';

const DEFAULT_COMMITTEES: Array<{ id: string; icon: string }> = [
  { id: 'development-committee', icon: '🏗️' },
  { id: 'content-committee',     icon: '📝' },
  { id: 'operations-committee',  icon: '⚙️' },
  { id: 'tech-committee',        icon: '🔧' },
];

interface Props {
  /** Optional preselected committee. When present the button reflects
   *  that committee's specific phase (e.g. on a CommitteeDetailPage badge). */
  defaultCommitteeId?: string;
}

export default function CommitteeApplicationButton({ defaultCommitteeId }: Props) {
  const [open, setOpen] = useState(false);
  const mockChain = useMockChain();
  const { t } = useI18n();

  // Use the user-selected committee if any; otherwise the first elected one.
  // Phase is recomputed every minute so a long-open page advances if a
  // boundary is crossed.
  const [tickNow, setTickNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setTickNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const targetCommittee = defaultCommitteeId && ELECTED_COMMITTEES.has(defaultCommitteeId)
    ? defaultCommitteeId
    : 'development-committee';
  const phase = getElectionPhase(targetCommittee, tickNow);

  // Compact label on the button — phase-driven, with a soft chevron suffix
  // matching the VotingPowerBadge style.
  const buttonLabel = (() => {
    switch (phase.kind) {
      case 'idle':       return `Next election in ${phase.daysToNomination}d`;
      case 'nomination': return `Apply · ${phase.daysLeft}d left`;
      case 'qna':        return `Q&A · ${phase.daysLeft}d to vote`;
      case 'voting':     return `Voting · ${phase.daysLeft}d`;
      case 'random-selection': return 'Apply';
    }
  })();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Apply to join a committee"
        aria-label={`Committee elections: ${buttonLabel}. Open application form.`}
        className="shrink-0 h-8 px-2.5 inline-flex items-center gap-1.5 rounded-2xl text-xs font-semibold transition-all border border-emerald-200 dark:border-emerald-800/50 bg-gradient-to-r from-emerald-400/10 to-teal-500/10 text-emerald-700 dark:text-emerald-300 hover:brightness-105 hover:from-emerald-400/20 hover:to-teal-500/20 active:scale-95 shadow-sm"
      >
        <UserPlus className="w-3.5 h-3.5" />
        <span className="font-bold">{buttonLabel}</span>
        <ChevronRight className="w-3 h-3 opacity-70" />
      </button>

      {open && createPortal(
        <CommitteeApplicationModal
          mockChain={mockChain}
          t={t}
          phase={phase}
          defaultCommitteeId={targetCommittee}
          onClose={() => setOpen(false)}
        />,
        document.body,
      )}
    </>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────
function CommitteeApplicationModal({
  mockChain,
  t,
  phase,
  defaultCommitteeId,
  onClose,
}: {
  mockChain: ReturnType<typeof useMockChain>;
  t: ReturnType<typeof useI18n>['t'];
  phase: ElectionPhase;
  defaultCommitteeId: string;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [selectedCommittee, setSelectedCommittee] = useState(defaultCommitteeId);
  const stakedOra = mockChain.stakedOra ?? 0;
  const stakeMet = stakedOra >= MIN_NOMINATION_STAKE;
  const myWallet = mockChain.publicKey || mockChain.walletAddress;

  // Phase changes when the timer ticks while the modal is open. We pin
  // the phase passed in for the badge, but for the modal body we use the
  // selected committee + always-current phase.
  const liveCommitteePhase = getElectionPhase(selectedCommittee, Date.now());

  // Look up an existing application for this (wallet, committee, cycleId).
  const cycleId = liveCommitteePhase.kind === 'idle'
    ? liveCommitteePhase.cycleId
    : (liveCommitteePhase as Extract<ElectionPhase, { cycleId: string }>).cycleId ?? '—';
  const existing: ElectionApplication | undefined = useMemo(() => (
    myWallet ? mockChain.electionApplications.find(
      a => a.applicantWallet === myWallet
        && a.committee === selectedCommittee
        && a.electionCycleId === cycleId
        && !a.withdrawn,
    ) : undefined
  ), [mockChain.electionApplications, myWallet, selectedCommittee, cycleId]);

  const [goals, setGoals] = useState(existing?.goals ?? '');
  const [qualifications, setQualifications] = useState(existing?.qualifications ?? '');
  const [tagline, setTagline] = useState(existing?.tagline ?? '');
  const [submitting, setSubmitting] = useState(false);

  // Resync form fields when committee is changed mid-session (the existing
  // application might be different).
  useEffect(() => {
    setGoals(existing?.goals ?? '');
    setQualifications(existing?.qualifications ?? '');
    setTagline(existing?.tagline ?? '');
  }, [selectedCommittee, existing?.id]);

  const canEdit = liveCommitteePhase.kind === 'nomination';
  const isElected = liveCommitteePhase.kind !== 'random-selection';

  const handleSubmit = async () => {
    if (!stakeMet) {
      showToast('error', 'Stake too low', `You need ≥ ${MIN_NOMINATION_STAKE.toLocaleString()} ORA staked to self-nominate.`);
      return;
    }
    if (!goals.trim() || !qualifications.trim()) {
      showToast('error', 'Statement required', 'Please fill in goals and qualifications.');
      return;
    }
    setSubmitting(true);
    try {
      await mockChain.submitElectionApplication({
        committee: selectedCommittee,
        electionCycleId: cycleId,
        goals: goals.trim(),
        qualifications: qualifications.trim(),
        tagline: tagline.trim() || undefined,
      });
      showToast('success', existing ? 'Statement updated' : 'Application submitted', 'Voters can now read your statement.');
      onClose();
    } catch (e: any) {
      showToast('error', 'Submit failed', e?.message ?? 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    setSubmitting(true);
    try {
      await mockChain.withdrawElectionApplication(selectedCommittee, cycleId);
      showToast('success', 'Withdrawn', 'Your candidacy has been withdrawn for this cycle.');
      onClose();
    } catch (e: any) {
      showToast('error', 'Withdraw failed', e?.message ?? 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-background rounded-2xl max-w-3xl w-full border shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero */}
        <div className="bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-cyan-500/10 px-6 py-5 border-b relative">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-background/60 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-background/40 backdrop-blur border border-emerald-300/40 dark:border-emerald-700/40 shadow-lg">
              <UserPlus className="w-7 h-7 text-emerald-600 dark:text-emerald-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Run for committee</div>
              <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                {phaseHeading(liveCommitteePhase)}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {phaseSubheading(liveCommitteePhase)}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          {/* Committee picker */}
          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Committee
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {DEFAULT_COMMITTEES.map(c => {
                const key = committeeI18nKey(c.id);
                const label = key ? t.governance.committees[key] : c.id;
                const active = selectedCommittee === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCommittee(c.id)}
                    className={`px-3 py-2.5 rounded-xl border text-left transition-all ${
                      active
                        ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-400/40'
                        : 'border-border bg-secondary/30 hover:bg-secondary/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{c.icon}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">{label}</div>
                        <div className="text-[10px] text-muted-foreground truncate">7 seats</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 italic">
              Arbitration Committee is filled by ARS-weighted random selection (whitepaper §15.6) — there is no election to apply for.
            </p>
          </section>

          {/* Phase-specific body */}
          {!isElected ? (
            <RandomSelectionNotice />
          ) : liveCommitteePhase.kind === 'idle' ? (
            <IdlePhasePanel phase={liveCommitteePhase} />
          ) : liveCommitteePhase.kind === 'voting' ? (
            <VotingPhasePanel phase={liveCommitteePhase} />
          ) : (
            <NominationOrQnaPanel
              phase={liveCommitteePhase}
              canEdit={canEdit}
              existing={existing}
              stakedOra={stakedOra}
              stakeMet={stakeMet}
              tagline={tagline}
              setTagline={setTagline}
              goals={goals}
              setGoals={setGoals}
              qualifications={qualifications}
              setQualifications={setQualifications}
            />
          )}

          {/* Eligibility footer (always shown) */}
          <section className="rounded-xl border bg-secondary/30 p-3 text-[11px] text-muted-foreground space-y-1">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              <span className="font-bold uppercase tracking-wide">Eligibility (whitepaper §15)</span>
            </div>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>Self-nomination requires <span className="font-bold tabular-nums">≥ {MIN_NOMINATION_STAKE.toLocaleString()} ORA</span> staked.</li>
              <li>Term length: 6 months. Re-election allowed.</li>
              <li>You may hold seats on multiple committees (except Arbitration).</li>
              <li>One vote per voter per candidate; voters may vote for up to 7 candidates per committee.</li>
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-secondary/30 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {stakeMet ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Staked: {stakedOra.toLocaleString()} ORA
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" /> Staked: {stakedOra.toLocaleString()} / {MIN_NOMINATION_STAKE.toLocaleString()} ORA
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!stakeMet && (
              <Link to="/wallet" onClick={onClose}>
                <Button variant="outline" size="sm">
                  <Wallet className="w-4 h-4 mr-1" /> Stake more
                </Button>
              </Link>
            )}
            {existing && canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleWithdraw}
                disabled={submitting}
                className="border-red-200 text-red-600 hover:bg-red-50"
              >
                Withdraw
              </Button>
            )}
            {canEdit ? (
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!stakeMet || submitting}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700"
              >
                {submitting ? 'Submitting…' : existing ? 'Update statement' : 'Submit application'}
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Phase headings ───────────────────────────────────────────────────────
function phaseHeading(phase: ElectionPhase): string {
  switch (phase.kind) {
    case 'idle':       return `Next election in ${phase.daysToNomination} day${phase.daysToNomination === 1 ? '' : 's'}`;
    case 'nomination': return `Nomination open · ${phase.daysLeft}d to apply`;
    case 'qna':        return `Q&A period · ${phase.daysLeft}d until vote`;
    case 'voting':     return `Voting in progress · ${phase.daysLeft}d left`;
    case 'random-selection': return 'Arbitration Committee';
  }
}
function phaseSubheading(phase: ElectionPhase): string {
  switch (phase.kind) {
    case 'idle':       return `Nomination opens ${formatElectionDate(phase.nextElectionStart)}.`;
    case 'nomination': return `Nominations close ${formatElectionDate(phase.nominationCloses)}. Submit your statement now.`;
    case 'qna':        return `Voting opens ${formatElectionDate(phase.votingOpens)}. Statements are locked but visible to voters.`;
    case 'voting':     return `Results announced ${formatElectionDate(phase.resultsAt)}.`;
    case 'random-selection': return 'Filled by ARS-weighted random selection (whitepaper §15.6).';
  }
}

// ── Phase-specific panels ────────────────────────────────────────────────
function IdlePhasePanel({ phase }: { phase: Extract<ElectionPhase, { kind: 'idle' }> }) {
  return (
    <section className="space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Election timeline
      </h4>
      <div className="rounded-xl border bg-secondary/30 p-4 space-y-2.5 text-sm">
        <TimelineRow icon={<Calendar className="w-3.5 h-3.5" />} label={`Nomination opens · ${formatElectionDate(phase.nextElectionStart)}`} muted />
        <TimelineRow icon={<FileText className="w-3.5 h-3.5" />} label="Submit goals + qualifications · 7-day window" muted />
        <TimelineRow icon={<MessageCircle className="w-3.5 h-3.5" />} label="Community Q&A · 7 days" muted />
        <TimelineRow icon={<VoteIcon className="w-3.5 h-3.5" />} label="Voting · 7 days · top 7 candidates win seats" muted />
      </div>
      <p className="text-[11px] text-muted-foreground italic">
        Want to be notified when nominations open? You're already on-chain — once your wallet has ≥ {MIN_NOMINATION_STAKE.toLocaleString()} ORA staked, an in-app notification will fire on T-21.
      </p>
    </section>
  );
}

function VotingPhasePanel({ phase }: { phase: Extract<ElectionPhase, { kind: 'voting' }> }) {
  return (
    <section className="rounded-xl border bg-blue-500/5 border-blue-500/30 p-4 space-y-2 text-sm">
      <div className="flex items-center gap-2 font-semibold text-blue-700 dark:text-blue-300">
        <VoteIcon className="w-4 h-4" /> Voting is live
      </div>
      <p className="text-muted-foreground text-[12px] leading-relaxed">
        Nominations and statement edits are closed for this cycle. Your job now is to <span className="font-semibold">read the candidates and vote</span>. Top 7 by vote count are seated. Voting closes {formatElectionDate(phase.resultsAt)}.
      </p>
      <p className="text-[11px] text-muted-foreground italic">
        Candidate vote UI lives on each committee's detail page (Coming soon — beyond this badge).
      </p>
    </section>
  );
}

function NominationOrQnaPanel({
  phase, canEdit, existing, stakedOra, stakeMet,
  tagline, setTagline, goals, setGoals, qualifications, setQualifications,
}: {
  phase: Extract<ElectionPhase, { kind: 'nomination' | 'qna' }>;
  canEdit: boolean;
  existing: ElectionApplication | undefined;
  stakedOra: number;
  stakeMet: boolean;
  tagline: string; setTagline: (v: string) => void;
  goals: string; setGoals: (v: string) => void;
  qualifications: string; setQualifications: (v: string) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {existing ? 'Your candidate statement' : 'Submit your candidate statement'}
        </h4>
        {existing && (
          <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
            Submitted
          </span>
        )}
      </div>

      {!canEdit && (
        <div className="rounded-lg p-3 text-[11px] bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 leading-relaxed flex items-start gap-2">
          <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            Editing window is closed (Q&A in progress). Voters can still see your submitted statement; you cannot change it. Use the governance forum to respond to questions.
          </span>
        </div>
      )}

      {!stakeMet && canEdit && (
        <div className="rounded-lg p-3 text-[11px] bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 leading-relaxed flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            You currently have <span className="font-bold tabular-nums">{stakedOra.toLocaleString()} ORA</span> staked. Self-nomination requires <span className="font-bold tabular-nums">{MIN_NOMINATION_STAKE.toLocaleString()} ORA</span>.
            You can still draft your statement — submit will unlock once you stake.
          </span>
        </div>
      )}

      <div>
        <label className="block text-[11px] font-medium text-muted-foreground mb-1">
          Tagline <span className="opacity-60">(optional · 1 line)</span>
        </label>
        <Input
          placeholder="One-line pitch shown on candidate cards"
          value={tagline}
          onChange={(e) => setTagline(e.target.value.slice(0, 120))}
          disabled={!canEdit}
          maxLength={120}
        />
        <div className="text-[10px] text-right text-muted-foreground/60 mt-0.5 tabular-nums">
          {tagline.length}/120
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-medium text-muted-foreground mb-1">
          Goals <span className="text-red-500">*</span>
        </label>
        <Textarea
          placeholder="What will you do if elected? Concrete priorities + first 90 days."
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          disabled={!canEdit}
          rows={5}
          className="text-sm"
        />
      </div>

      <div>
        <label className="block text-[11px] font-medium text-muted-foreground mb-1">
          Qualifications <span className="text-red-500">*</span>
        </label>
        <Textarea
          placeholder="Why are you the right person for this committee? Domain experience, prior contributions, relevant background."
          value={qualifications}
          onChange={(e) => setQualifications(e.target.value)}
          disabled={!canEdit}
          rows={5}
          className="text-sm"
        />
      </div>

      {phase.kind === 'nomination' && existing && (
        <div className="text-[10px] text-muted-foreground italic">
          Last updated {new Date(existing.updatedAt).toLocaleString()}. You may edit until {formatElectionDate(phase.nominationCloses)}.
        </div>
      )}
    </section>
  );
}

function RandomSelectionNotice() {
  return (
    <section className="rounded-xl border bg-secondary/30 p-4 space-y-2 text-sm">
      <div className="flex items-center gap-2 font-semibold">
        🎲 Arbitration Committee — random selection
      </div>
      <p className="text-muted-foreground text-[12px] leading-relaxed">
        Arbitration members are not elected. They're randomly selected (ARS-weighted via on-chain VRF) for each case from the candidate pool of users with sufficient reputation. To enter the pool, raise your <span className="font-semibold">ARS</span> by participating honestly in curation and disputes (whitepaper §15.6).
      </p>
    </section>
  );
}

// ── Tiny helpers ─────────────────────────────────────────────────────────
function TimelineRow({ icon, label, muted = false }: { icon: React.ReactNode; label: string; muted?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${muted ? 'text-muted-foreground' : ''}`}>
      <div className="w-6 h-6 rounded-md bg-background/60 border border-border/60 flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <span className="text-[12px]">{label}</span>
    </div>
  );
}
