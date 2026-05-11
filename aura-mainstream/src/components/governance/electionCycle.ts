/**
 * Election cycle helpers — pure functions, no React, no state.
 *
 * Whitepaper §15 election timeline (every 6 months):
 *   T-21 days  → Nomination opens
 *   T-14 days  → Nomination closes; candidate list published
 *   T-14 → T-7 → Community Q&A
 *   T-7  → T-0 → Voting period (7 days)
 *   T-0        → Results announced; new term starts
 *
 * Cycle base: arbitrarily anchored to 2026-01-01 so demos are deterministic.
 * Real protocol would read this from the on-chain governance program.
 *
 * "Tier IV" / Arbitration Committee uses ARS-weighted random selection
 * rather than elections (whitepaper §15.6) — for those, getElectionPhase
 * returns { kind: 'random-selection' } so the UI can show a different message.
 */

/** Anchor for cycle math. Pick a date that puts the next nomination
 *  ~30 days out so the demo always shows a "T-30 days" countdown rather
 *  than landing inside an active phase by default. */
const CYCLE_ANCHOR = new Date('2026-01-01T00:00:00Z').getTime();
const CYCLE_LENGTH_MS = 182 * 24 * 60 * 60 * 1000; // ~6 months
const NOMINATION_OPEN_T_MINUS_DAYS = 21;
const NOMINATION_CLOSE_T_MINUS_DAYS = 14;
const VOTING_OPEN_T_MINUS_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ElectionPhase =
  | { kind: 'idle';        nextElectionStart: Date; daysToNomination: number; cycleId: string }
  | { kind: 'nomination';  cycleEnd: Date; cycleId: string; daysLeft: number; nominationCloses: Date }
  | { kind: 'qna';         cycleEnd: Date; cycleId: string; daysLeft: number; votingOpens: Date }
  | { kind: 'voting';      cycleEnd: Date; cycleId: string; daysLeft: number; resultsAt: Date }
  | { kind: 'random-selection' /* arbitration only */ };

/** Committees that use elections (whitepaper §15.5).
 *  Arbitration uses ARS-weighted random selection (§15.6). */
export const ELECTED_COMMITTEES = new Set<string>([
  'development-committee',
  'content-committee',
  'operations-committee',
  'tech-committee',
]);

/** Cycle id = ISO date of the cycle's election day (T-0). */
export function cycleIdFor(electionDayMs: number): string {
  return new Date(electionDayMs).toISOString().slice(0, 10);
}

/**
 * Compute the current election phase for the given committee.
 *
 * `now` is injected for testability (defaults to Date.now()).
 */
export function getElectionPhase(committeeId: string, now: number = Date.now()): ElectionPhase {
  if (!ELECTED_COMMITTEES.has(committeeId)) {
    return { kind: 'random-selection' };
  }

  // Find the next election day at or after `now`.
  const elapsed = now - CYCLE_ANCHOR;
  const cyclesElapsed = Math.floor(elapsed / CYCLE_LENGTH_MS);
  const lastElectionDay = CYCLE_ANCHOR + cyclesElapsed * CYCLE_LENGTH_MS;
  const nextElectionDay = lastElectionDay + CYCLE_LENGTH_MS;

  // Phase boundaries for the next election.
  const nominationOpens = nextElectionDay - NOMINATION_OPEN_T_MINUS_DAYS * DAY_MS;
  const nominationCloses = nextElectionDay - NOMINATION_CLOSE_T_MINUS_DAYS * DAY_MS;
  const votingOpens = nextElectionDay - VOTING_OPEN_T_MINUS_DAYS * DAY_MS;
  const cycleId = cycleIdFor(nextElectionDay);

  if (now < nominationOpens) {
    return {
      kind: 'idle',
      nextElectionStart: new Date(nominationOpens),
      daysToNomination: Math.ceil((nominationOpens - now) / DAY_MS),
      cycleId,
    };
  }
  if (now < nominationCloses) {
    return {
      kind: 'nomination',
      cycleEnd: new Date(nextElectionDay),
      cycleId,
      daysLeft: Math.ceil((nominationCloses - now) / DAY_MS),
      nominationCloses: new Date(nominationCloses),
    };
  }
  if (now < votingOpens) {
    return {
      kind: 'qna',
      cycleEnd: new Date(nextElectionDay),
      cycleId,
      daysLeft: Math.ceil((votingOpens - now) / DAY_MS),
      votingOpens: new Date(votingOpens),
    };
  }
  if (now < nextElectionDay) {
    return {
      kind: 'voting',
      cycleEnd: new Date(nextElectionDay),
      cycleId,
      daysLeft: Math.ceil((nextElectionDay - now) / DAY_MS),
      resultsAt: new Date(nextElectionDay),
    };
  }
  // Shouldn't happen — `now < nextElectionDay` always holds by construction.
  return {
    kind: 'idle',
    nextElectionStart: new Date(nominationOpens + CYCLE_LENGTH_MS),
    daysToNomination: 999,
    cycleId,
  };
}

/** Pretty-print a Date without bringing in dayjs/date-fns.
 *
 *  Hard-locked to en-US so the governance UI stays consistent regardless of
 *  the user's browser locale (we had a bug where Chinese systems were
 *  rendering "June 11, 2026" inside otherwise-English copy). The full
 *  app i18n switch belongs to the I18nContext; this helper only formats
 *  English-side strings. */
export function formatElectionDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Whitepaper §15: minimum stake required to self-nominate. */
export const MIN_NOMINATION_STAKE = 10_000;
