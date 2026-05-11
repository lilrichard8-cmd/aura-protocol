/**
 * VotingPowerBadge — clickable pill that opens a modal explaining how
 * voting power is computed.
 *
 * Two pieces in one file (mirrors the LevelBadgeButton + ReputationModal
 * pattern in CurationPage so the design language stays consistent):
 *
 *   <VotingPowerBadge />            ← compact button, used in sticky headers
 *   <VotingPowerModal onClose />    ← the full explainer (private; rendered
 *                                     by the badge when clicked)
 *
 * The modal lives next to the badge so any surface that drops the badge
 * gets the modal for free (no extra wiring per page).
 *
 * Source of truth for all numbers: AURA Whitepaper §15.5 (quadratic voting
 * with 10,000-vote cap) and §19 (proposal tiers).
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  Vote, ChevronRight, X, Wallet, Sparkles, Shield, AlertTriangle,
  Calculator, BookOpen, Sigma,
} from 'lucide-react';
import { useMockChain } from '@/context/MockChainContext';
import { Button } from '@/components/ui/button';
import { TIER_META, ELIGIBLE_VOTERS } from './proposalHelpers';

const VOTE_CAP = 10_000;

/** Public: the clickable pill shown in headers. */
export default function VotingPowerBadge() {
  const [open, setOpen] = useState(false);
  const mockChain = useMockChain();
  const stakedOra = mockChain.stakedOra ?? 0;
  const votingPower = Math.min(VOTE_CAP, Math.floor(Math.sqrt(stakedOra)));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Your voting power. Click for the formula and tier rules."
        aria-label={`Your voting power: ${votingPower.toLocaleString()} votes. Open governance rules.`}
        className="shrink-0 h-8 px-2.5 inline-flex items-center gap-1.5 rounded-2xl text-xs font-semibold transition-all border border-purple-200 dark:border-purple-800/50 bg-gradient-to-r from-purple-400/10 to-indigo-500/10 text-purple-600 dark:text-purple-300 hover:brightness-105 hover:from-purple-400/20 hover:to-indigo-500/20 active:scale-95 shadow-sm"
      >
        <Vote className="w-3.5 h-3.5" />
        <span className="font-bold tabular-nums">{votingPower.toLocaleString()}</span>
        <span className="opacity-80">votes</span>
        <ChevronRight className="w-3 h-3 opacity-70" />
      </button>

      {open && createPortal(
        // Portal'd to <body> so the modal escapes the sticky header's
        // backdrop-filter containing block (otherwise `position:fixed`
        // resolves against the sticky ancestor, not the viewport).
        <VotingPowerModal
          stakedOra={stakedOra}
          votingPower={votingPower}
          onClose={() => setOpen(false)}
        />,
        document.body,
      )}
    </>
  );
}

// ── Internal modal ───────────────────────────────────────────────────────
function VotingPowerModal({
  stakedOra,
  votingPower,
  onClose,
}: {
  stakedOra: number;
  votingPower: number;
  onClose: () => void;
}) {
  const capPct = (votingPower / VOTE_CAP) * 100;
  const remainingToCap = Math.max(0, VOTE_CAP - votingPower);

  // Sample table for the formula explainer — fixed examples, not derived
  // from user state, so the math is always present at full range.
  const samples: Array<{ staked: number; votes: number; note?: string }> = [
    { staked: 0, votes: 0, note: 'No vote' },
    { staked: 100, votes: 10 },
    { staked: 10_000, votes: 100 },
    { staked: 1_000_000, votes: 1_000 },
    { staked: 100_000_000, votes: VOTE_CAP, note: 'Cap reached' },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-background rounded-2xl max-w-3xl w-full border shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero header — purple/indigo gradient to match the badge */}
        <div className="bg-gradient-to-br from-purple-500/20 via-indigo-500/15 to-fuchsia-500/10 px-6 py-5 border-b relative">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-background/60 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl bg-background/40 backdrop-blur border border-purple-300/40 dark:border-purple-700/40 shadow-lg">
              <Vote className="w-7 h-7 text-purple-600 dark:text-purple-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Your governance power</div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-3xl font-black text-purple-600 dark:text-purple-300 tabular-nums">{votingPower.toLocaleString()}</span>
                <span className="text-sm font-semibold text-muted-foreground">votes</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 font-mono tabular-nums">
                √({stakedOra.toLocaleString()} staked ORA){votingPower >= VOTE_CAP ? ' — cap' : ''}
              </div>
            </div>
          </div>

          {/* Progress to 10k cap */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="font-bold text-foreground">0</span>
              <span className="text-muted-foreground">
                {votingPower >= VOTE_CAP ? (
                  <span className="text-amber-600 dark:text-amber-400 font-bold">Whale-cap reached</span>
                ) : (
                  <>
                    <span className="font-bold text-foreground tabular-nums">{remainingToCap.toLocaleString()}</span> votes to 10k cap
                  </>
                )}
              </span>
              <span className="font-bold text-foreground">{VOTE_CAP.toLocaleString()}</span>
            </div>
            <div className="h-2 rounded-full bg-background/40 overflow-hidden border border-border/40">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
                style={{ width: `${Math.min(100, capPct)}%` }}
              />
            </div>
          </div>

          {votingPower === 0 && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                You haven't staked any ORA yet. Stake in{' '}
                <Link to="/wallet" onClick={onClose} className="underline font-semibold">Wallet → Staking</Link>{' '}
                to unlock voting power. Even a small stake (e.g. 100 ORA → 10 votes) lets you participate.
              </span>
            </div>
          )}
        </div>

        {/* Body — two columns on desktop: formula | tiers */}
        <div className="overflow-y-auto px-6 py-5 grid grid-cols-1 md:grid-cols-2 md:gap-x-6 gap-y-5">
          {/* LEFT — How power is computed */}
          <section className="min-w-0 flex flex-col">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5" /> How power is calculated
            </h4>

            {/* Formula card */}
            <div className="rounded-xl border bg-secondary/40 px-4 py-3 mb-3">
              <div className="flex items-center justify-center gap-2 text-base font-bold font-mono">
                <span className="text-muted-foreground">votes =</span>
                <span className="text-purple-600 dark:text-purple-400">⌊√(staked ORA)⌋</span>
              </div>
              <div className="text-[11px] text-muted-foreground text-center mt-1">
                capped at <span className="font-bold tabular-nums">{VOTE_CAP.toLocaleString()}</span> votes per wallet
              </div>
            </div>

            {/* Why */}
            <div className="text-[12px] text-muted-foreground leading-relaxed mb-3 space-y-2">
              <p>
                <strong className="text-foreground">Quadratic voting</strong> means the marginal cost of each
                additional vote grows. You need 4× the stake to double your votes. This protects the protocol
                from whale capture without locking out small holders.
              </p>
              <p>
                The <strong className="text-foreground">10,000-vote cap</strong> is the second guardrail — even
                a 100M-ORA whale can never out-vote a coalition of 10,000 small holders on a single proposal.
              </p>
            </div>

            {/* Sample table */}
            <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
              <Sigma className="w-3 h-3" /> Examples
            </h5>
            <div className="space-y-1 text-[11px]">
              {samples.map((s) => {
                const isMine = stakedOra >= s.staked && stakedOra < (samples[samples.indexOf(s) + 1]?.staked ?? Infinity);
                return (
                  <div
                    key={s.staked}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border ${
                      isMine
                        ? 'border-aura bg-aura/10 ring-1 ring-aura/40'
                        : 'border-border/40 bg-background/40'
                    }`}
                  >
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {s.staked.toLocaleString()} ORA
                    </span>
                    <span className="font-mono tabular-nums text-foreground/60 text-[10px]">→</span>
                    <span className="font-bold tabular-nums">
                      {s.votes.toLocaleString()} votes
                    </span>
                    {s.note && (
                      <span className={`text-[9px] uppercase tracking-wider font-bold ${
                        s.note === 'Cap reached'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-muted-foreground/60'
                      }`}>
                        {s.note}
                      </span>
                    )}
                    {!s.note && isMine && (
                      <span className="text-[9px] uppercase tracking-wider font-bold text-aura">You</span>
                    )}
                    {!s.note && !isMine && <span />}
                  </div>
                );
              })}
            </div>
          </section>

          {/* RIGHT — Tier rules */}
          <section className="min-w-0 flex flex-col">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Proposal tiers (§19)
            </h4>
            <div className="space-y-2">
              {(['tier-1', 'tier-2', 'tier-3', 'tier-4'] as const).map(t => {
                const meta = TIER_META[t];
                return (
                  <div
                    key={t}
                    className={`rounded-lg border px-3 py-2 ${meta.tone}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-bold">{meta.label}</span>
                    </div>
                    <p className="text-[11px] opacity-80 leading-snug mb-2">{meta.summary}</p>
                    <div className="flex items-center gap-3 text-[10px] font-mono">
                      <span className="inline-flex items-center gap-1">
                        <span className="opacity-60 uppercase">Approval</span>
                        <span className="font-bold tabular-nums">≥{meta.approval}%</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="opacity-60 uppercase">Quorum</span>
                        <span className="font-bold tabular-nums">{meta.quorum > 0 ? `≥${meta.quorum}%` : '—'}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 text-[10px] text-muted-foreground/80 leading-relaxed flex items-start gap-1.5 italic">
              <BookOpen className="w-3 h-3 mt-0.5 shrink-0" />
              <span>
                Quorum % is computed against {ELIGIBLE_VOTERS.toLocaleString()} eligible voters
                (assumed); future versions will read this number on-chain.
              </span>
            </div>
          </section>
        </div>

        {/* Footer — single CTA + close */}
        <div className="px-6 py-4 border-t bg-secondary/30 flex items-center justify-between gap-3">
          <div className="text-[11px] text-muted-foreground italic flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" />
            One vote per wallet · cannot be changed once cast
          </div>
          <div className="flex items-center gap-2">
            <Link to="/wallet" onClick={onClose}>
              <Button variant="outline" size="sm">
                <Wallet className="w-4 h-4 mr-1" />
                {stakedOra === 0 ? 'Stake ORA' : 'Stake more'}
              </Button>
            </Link>
            <Button size="sm" onClick={onClose}>Got it</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
