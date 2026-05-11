/**
 * ProposalEligibilityBadge — replaces the Voting Power badge on the
 * /governance/create page. Tells the user at a glance whether they
 * can submit a proposal, and on click opens a modal explaining the
 * three rules + a path to fix any unmet rule.
 *
 * Rules (whitepaper §15 / §19):
 *   1. Connected wallet
 *   2. ≥ 1,000 ORA staked  (the proposal-submission stake floor)
 *   3. Distinct from the candidate-nomination floor (≥ 10K ORA, §15.5)
 *
 * The component is presentation-only; the actual gating happens inside
 * CreateProposalView.tsx, which checks the same numbers. We keep both
 * surfaces in sync via the shared `MIN_PROPOSAL_STAKE` constant exported
 * here.
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  FileSignature, X, ChevronRight, CheckCircle2, AlertTriangle,
  Wallet, Sparkles, BookOpen, Vote as VoteIcon, Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMockChain } from '@/context/MockChainContext';
import { MIN_NOMINATION_STAKE } from './electionCycle';

/** Minimum ORA staked to submit a proposal. Lower than the
 *  10K nomination floor — proposing is a lighter commitment than
 *  running for committee. */
export const MIN_PROPOSAL_STAKE = 1_000;

export default function ProposalEligibilityBadge() {
  const [open, setOpen] = useState(false);
  const mockChain = useMockChain();

  const stakedOra = mockChain.stakedOra ?? 0;
  const connected = !!(mockChain.publicKey || mockChain.walletAddress);
  const stakeMet = stakedOra >= MIN_PROPOSAL_STAKE;
  const eligible = connected && stakeMet;

  // Pill state — switches between green (eligible) and amber (blocked).
  const buttonClasses = eligible
    ? 'border-emerald-200 dark:border-emerald-800/50 bg-gradient-to-r from-emerald-400/10 to-teal-500/10 text-emerald-700 dark:text-emerald-300 hover:from-emerald-400/20 hover:to-teal-500/20'
    : 'border-amber-200 dark:border-amber-800/50 bg-gradient-to-r from-amber-400/10 to-orange-500/10 text-amber-700 dark:text-amber-300 hover:from-amber-400/20 hover:to-orange-500/20';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={eligible
          ? 'You meet the proposal-submission requirements. Click for details.'
          : 'You don\'t meet the proposal-submission requirements yet. Click for details.'}
        aria-label={`Proposal eligibility: ${eligible ? 'eligible' : 'not eligible'}. Open rules and stake link.`}
        className={`shrink-0 h-8 px-2.5 inline-flex items-center gap-1.5 rounded-2xl text-xs font-semibold transition-all border active:scale-95 shadow-sm ${buttonClasses}`}
      >
        {eligible ? (
          <CheckCircle2 className="w-3.5 h-3.5" />
        ) : (
          <AlertTriangle className="w-3.5 h-3.5" />
        )}
        <span className="font-bold">
          {eligible ? 'Can submit' : 'Stake to submit'}
        </span>
        <ChevronRight className="w-3 h-3 opacity-70" />
      </button>

      {open && createPortal(
        <ProposalEligibilityModal
          stakedOra={stakedOra}
          connected={connected}
          stakeMet={stakeMet}
          onClose={() => setOpen(false)}
        />,
        document.body,
      )}
    </>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────
function ProposalEligibilityModal({
  stakedOra,
  connected,
  stakeMet,
  onClose,
}: {
  stakedOra: number;
  connected: boolean;
  stakeMet: boolean;
  onClose: () => void;
}) {
  const eligible = connected && stakeMet;
  const stakePct = Math.min(100, (stakedOra / MIN_PROPOSAL_STAKE) * 100);
  const remainingToStake = Math.max(0, MIN_PROPOSAL_STAKE - stakedOra);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-background rounded-2xl max-w-2xl w-full border shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero — colored by eligibility */}
        <div
          className={`px-6 py-5 border-b relative ${
            eligible
              ? 'bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-cyan-500/10'
              : 'bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-rose-500/10'
          }`}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-background/60 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-background/40 backdrop-blur border shadow-lg ${
              eligible
                ? 'border-emerald-300/40 dark:border-emerald-700/40'
                : 'border-amber-300/40 dark:border-amber-700/40'
            }`}>
              <FileSignature className={`w-7 h-7 ${
                eligible
                  ? 'text-emerald-600 dark:text-emerald-300'
                  : 'text-amber-600 dark:text-amber-300'
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">
                Proposal submission
              </div>
              <div className={`text-2xl font-black ${
                eligible
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-amber-700 dark:text-amber-300'
              }`}>
                {eligible ? "You're eligible to propose" : "Eligibility not yet met"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {eligible
                  ? 'Submit a proposal in the editor on the left.'
                  : 'Resolve the items below to unlock proposal submission.'}
              </div>
            </div>
          </div>

          {/* Stake progress — always shown, even when met (gives a sense of margin) */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="font-bold text-foreground tabular-nums">{stakedOra.toLocaleString()} ORA</span>
              <span className="text-muted-foreground">
                {stakeMet ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">Stake floor met</span>
                ) : (
                  <>
                    <span className="font-bold text-foreground tabular-nums">{remainingToStake.toLocaleString()}</span> more ORA to unlock
                  </>
                )}
              </span>
              <span className="font-bold text-foreground tabular-nums">{MIN_PROPOSAL_STAKE.toLocaleString()} ORA</span>
            </div>
            <div className="h-2 rounded-full bg-background/40 overflow-hidden border border-border/40">
              <div
                className={`h-full transition-all duration-500 ${
                  stakeMet
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500'
                }`}
                style={{ width: `${stakePct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          {/* Rules checklist */}
          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Submission rules
            </h4>
            <ul className="space-y-2">
              <RuleRow
                ok={connected}
                title="Connected wallet"
                detail="Proposers are identified by wallet address — connect first."
              />
              <RuleRow
                ok={stakeMet}
                title={`≥ ${MIN_PROPOSAL_STAKE.toLocaleString()} ORA staked`}
                detail="A small stake makes proposers accountable for low-quality spam without locking out grassroots voices."
                trailing={
                  <span className="text-[11px] font-bold tabular-nums">
                    {stakedOra.toLocaleString()} / {MIN_PROPOSAL_STAKE.toLocaleString()}
                  </span>
                }
              />
              <RuleRow
                ok={true}
                title="Title 8–120 chars · description ≥ 50 chars"
                detail="Voters skim. Clear scope and rationale earn attention; thin proposals get archived."
              />
              <RuleRow
                ok={true}
                title="Committee selected"
                detail="Choose the committee that owns your proposal's domain — they're the ones who review fit and safety."
              />
            </ul>
          </section>

          {/* What happens after submission */}
          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <VoteIcon className="w-3.5 h-3.5" /> What happens next
            </h4>
            <ol className="space-y-1.5 text-[12px] text-muted-foreground list-decimal list-outside ml-5">
              <li><span className="text-foreground font-medium">Committee review</span> — 1 week. Out-of-scope or unsafe proposals are returned with feedback.</li>
              <li><span className="text-foreground font-medium">Public discussion</span> — 3 weeks of community comments before voting opens.</li>
              <li><span className="text-foreground font-medium">Voting window</span> — 1 week. Quadratic voting (√ staked ORA), 10K-vote cap per wallet.</li>
              <li><span className="text-foreground font-medium">Outcome</span> — passes if approval % and quorum % both clear the proposal's tier (whitepaper §19).</li>
            </ol>
          </section>

          {/* Distinction from candidate stake */}
          <section className="rounded-xl border bg-secondary/40 px-4 py-3">
            <div className="flex items-start gap-2 text-[12px]">
              <BookOpen className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-foreground/85 leading-relaxed">
                  <span className="font-semibold">Submitting a proposal</span> requires{' '}
                  <span className="font-bold tabular-nums">{MIN_PROPOSAL_STAKE.toLocaleString()} ORA</span> staked.
                  <span className="text-muted-foreground">{' '}This is separate from{' '}
                    <span className="font-semibold text-foreground/85">running for a committee seat</span>, which requires{' '}
                    <span className="font-bold tabular-nums">{MIN_NOMINATION_STAKE.toLocaleString()} ORA</span> (whitepaper §15.5).
                  </span>
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-secondary/30 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {eligible ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> All checks passed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <Sparkles className="w-3.5 h-3.5" /> Stake more to unlock proposing
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!stakeMet && (
              <Link to="/wallet" onClick={onClose}>
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700"
                >
                  <Wallet className="w-4 h-4 mr-1" />
                  Stake {remainingToStake.toLocaleString()} more
                </Button>
              </Link>
            )}
            <Button size="sm" variant={stakeMet ? 'default' : 'outline'} onClick={onClose}>
              Got it
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Rule row ─────────────────────────────────────────────────────────────
function RuleRow({
  ok,
  title,
  detail,
  trailing,
}: {
  ok: boolean;
  title: string;
  detail: string;
  trailing?: React.ReactNode;
}) {
  return (
    <li className={`flex items-start gap-3 rounded-lg border p-3 ${
      ok
        ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-500/5'
        : 'border-amber-200 dark:border-amber-900/40 bg-amber-500/5'
    }`}>
      <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
        ok
          ? 'bg-emerald-500 text-white'
          : 'bg-amber-500 text-white'
      }`}>
        {ok ? '✓' : '!'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <div className={`text-[13px] font-semibold ${
            ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
          }`}>
            {title}
          </div>
          {trailing && <div className="shrink-0">{trailing}</div>}
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{detail}</p>
      </div>
    </li>
  );
}
