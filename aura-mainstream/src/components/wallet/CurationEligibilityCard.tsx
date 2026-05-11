import { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Plus,
  ChevronDown,
  ChevronUp,
  Clock,
  Gauge,
  Coins,
  Compass,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/context/I18nContext';

// ────────────────────────────────────────────────────────────────────────────
// 2026-04-30 R4: ALL mock breakdowns removed. The three expandable tiles now
// render only data sourced from MockChainContext (passed in via props):
//   • Today           → real `pendingCurations[]` (defaults [] → empty state)
//   • Curation Score  → formula explainer + real `curationStats.totalScore`
//   • Cumulative      → real curate-related transactions, summed
// No component-local fake arrays. Empty data renders an empty-state.
// ────────────────────────────────────────────────────────────────────────────

export interface PendingCurationItem {
  contentId: string;
  contentTitle: string;
  creatorName: string;
  curatedAt: number; // ms timestamp
  expectedScore?: number;
}

export interface CurationRewardTx {
  id: string;
  type: string;
  amount: number;     // ORA delta (negative for spend, positive for reward payout)
  timestamp: number;
  details: string;
}

interface Props {
  oraBalance: number;
  todayCount: number;
  todaySpent: number;
  curationScore: number;
  totalRewards: number;
  /** Real pending-curation rows from MockChainContext. Empty → empty-state. */
  pendingCurations?: PendingCurationItem[];
  /** Curate-related txs filtered from MockChainContext.transactions. */
  curationTransactions?: CurationRewardTx[];
  onAddOra?: () => void;
  /** CTA in the Today empty-state (e.g. navigate to /explore or /curation). */
  onBrowseToCurate?: () => void;
}

const THRESHOLD = 100;

type ExpandedTab = 0 | 1 | 2 | null;

const RANK_MULTIPLIER_RULES: Array<[string, string]> = [
  ['1st curator', '5×'],
  ['2nd – 10th', '3×'],
  ['11th – 50th', '2×'],
  ['51st – 200th', '1.5×'],
  ['201st – 500th', '1.2×'],
  ['501st and beyond', '1×'],
];

const DISCOVERY_MULTIPLIER_RULES: Array<[string, string]> = [
  ['< 100 followers', '5×'],
  ['100 – 1,000', '3×'],
  ['1,000 – 10,000', '1.5×'],
  ['10,000 – 100,000', '1×'],
  ['> 100,000', '0.5×'],
];

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/**
 * Curation Earnings card.
 * 2026-04-30 R4: every drill-down sources only real chain state. If a field is
 * empty / 0, the panel shows an empty-state — never fabricated data.
 */
export default function CurationEligibilityCard({
  oraBalance,
  todayCount,
  todaySpent,
  curationScore,
  totalRewards,
  pendingCurations = [],
  curationTransactions = [],
  onAddOra,
  onBrowseToCurate,
}: Props) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<ExpandedTab>(null);
  const eligible = oraBalance >= THRESHOLD;
  const needed = Math.max(0, THRESHOLD - oraBalance);

  const wallet = t.wallet as Record<string, unknown>;
  const cur = (wallet.curation as Record<string, string> | undefined) ?? {};
  const title = cur.title ?? 'Curation Access';
  const canCurate = cur.canCurate ?? 'You can curate';
  const cost = cur.cost ?? '1 ORA per action';
  const need = cur.need ?? `Hold ≥${THRESHOLD} ORA to participate`;
  const addOra = cur.addOra ?? 'Add ORA';
  const todayLabel = cur.today ?? 'Today';
  const scoreLabel = cur.score ?? 'Curation Score';
  const earnedLabel = cur.earned ?? 'Cumulative rewards';
  const formula =
    cur.formula ??
    'Rewards = Curator Rank Weight × Discovery Weight × daily pool share';

  const toggle = (idx: 0 | 1 | 2) =>
    setExpanded((prev) => (prev === idx ? null : idx));

  // Aggregate spend / reward across curate-related transactions.
  const totalSpent = curationTransactions
    .filter((tx) => tx.amount < 0)
    .reduce((s, tx) => s + Math.abs(tx.amount), 0);
  const totalRewardsFromTx = curationTransactions
    .filter((tx) => tx.amount > 0)
    .reduce((s, tx) => s + tx.amount, 0);

  return (
    <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-xl border border-emerald-200/50 dark:border-emerald-800/50 overflow-hidden h-full flex flex-col">
      {/* Header — stacks on narrow columns so title and earnings don't overlap */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold leading-tight">🌿 {title}</h3>
              <p className="text-[11px] text-muted-foreground">
                Curate early, earn from the daily pool
              </p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-bold text-green-600 leading-none">
              +{totalRewards.toFixed(2)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">ORA earned</p>
          </div>
        </div>
      </div>

      {/* Eligibility */}
      <div className="px-5">
        {eligible ? (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-600 dark:text-green-400">
                {canCurate}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {oraBalance.toFixed(2)} / {THRESHOLD} ORA · {cost}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 mb-4">
            <div className="flex items-start gap-3 mb-2">
              <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-orange-600 dark:text-orange-400">
                  {need}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {oraBalance.toFixed(2)} / {THRESHOLD} ORA
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => onAddOra?.()}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Plus className="w-3 h-3 mr-1" />
              {addOra} {needed.toFixed(2)} ORA
            </Button>
          </div>
        )}
      </div>

      {/* Three clickable tiles */}
      <div className="px-5 grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => toggle(0)}
          aria-expanded={expanded === 0}
          className={`relative bg-background/60 hover:bg-background/80 rounded-lg p-3 text-center transition-colors ${
            expanded === 0 ? 'ring-2 ring-emerald-400/60' : ''
          }`}
        >
          <p className="text-xs text-muted-foreground">{todayLabel}</p>
          <p className="text-xl font-bold">{todayCount}</p>
          <p className="text-[10px] text-muted-foreground">
            −{todaySpent.toFixed(0)} ORA
          </p>
          {expanded === 0 ? (
            <ChevronUp className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <ChevronDown className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-muted-foreground/60" />
          )}
        </button>

        <button
          type="button"
          onClick={() => toggle(1)}
          aria-expanded={expanded === 1}
          className={`relative bg-background/60 hover:bg-background/80 rounded-lg p-3 text-center transition-colors ${
            expanded === 1 ? 'ring-2 ring-emerald-400/60' : ''
          }`}
        >
          <p className="text-xs text-muted-foreground">{scoreLabel}</p>
          <p className="text-xl font-bold text-emerald-600">
            {curationScore.toFixed(0)}
          </p>
          {expanded === 1 ? (
            <ChevronUp className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <ChevronDown className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-muted-foreground/60" />
          )}
        </button>

        <button
          type="button"
          onClick={() => toggle(2)}
          aria-expanded={expanded === 2}
          className={`relative bg-background/60 hover:bg-background/80 rounded-lg p-3 text-center transition-colors ${
            expanded === 2 ? 'ring-2 ring-emerald-400/60' : ''
          }`}
        >
          <p className="text-xs text-muted-foreground">{earnedLabel}</p>
          <p className="text-xl font-bold text-green-600">
            +{totalRewards.toFixed(2)}
          </p>
          <p className="text-[10px] text-muted-foreground">ORA</p>
          {expanded === 2 ? (
            <ChevronUp className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <ChevronDown className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-muted-foreground/60" />
          )}
        </button>
      </div>

      {/* Per-tile detail panel */}
      <div
        className={`grid transition-all duration-300 ease-out px-5 ${
          expanded !== null ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0 mt-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="bg-background/40 rounded-lg border border-emerald-500/20 p-3">
            {/* ── Today: real pendingCurations ────────────────────────────── */}
            {expanded === 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-emerald-500" />
                  <h4 className="text-sm font-semibold">Pending curations</h4>
                </div>
                <p className="text-[11px] text-muted-foreground mb-2.5">
                  Curated content awaiting trend / engagement results to settle
                  rewards.
                </p>
                {pendingCurations.length === 0 ? (
                  <div className="flex flex-col items-center text-center py-4 gap-2">
                    <Compass className="w-7 h-7 text-emerald-500/70" />
                    <p className="text-xs text-muted-foreground">
                      No pending curations yet.
                    </p>
                    {onBrowseToCurate && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={onBrowseToCurate}
                        className="mt-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                      >
                        Browse content to curate
                      </Button>
                    )}
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {pendingCurations.map((p) => (
                      <li
                        key={p.contentId}
                        className="flex items-center justify-between gap-2 text-xs bg-background/60 rounded px-2.5 py-1.5"
                      >
                        <span className="truncate font-medium">
                          {p.contentTitle}
                        </span>
                        <span className="text-muted-foreground flex-shrink-0">
                          {p.creatorName} · {relativeTime(p.curatedAt)}
                          {typeof p.expectedScore === 'number'
                            ? ` · ~${p.expectedScore}`
                            : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* ── Curation Score: formula + real totalScore ───────────────── */}
            {expanded === 1 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Gauge className="w-4 h-4 text-emerald-500" />
                  <h4 className="text-sm font-semibold">How your score is computed</h4>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
                  <span className="font-mono">
                    Score = Curator Rank Weight × Discovery Weight
                  </span>{' '}
                  applied to each curation action and summed for the day.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                  <div className="bg-background/60 rounded p-2">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <p className="text-[11px] font-semibold">Rank multiplier</p>
                    </div>
                    <ul className="space-y-0.5">
                      {RANK_MULTIPLIER_RULES.map(([when, mult]) => (
                        <li
                          key={when}
                          className="flex justify-between text-[10.5px] text-muted-foreground"
                        >
                          <span>{when}</span>
                          <span className="font-semibold text-amber-600">
                            {mult}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-background/60 rounded p-2">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                      <p className="text-[11px] font-semibold">Discovery multiplier</p>
                    </div>
                    <ul className="space-y-0.5">
                      {DISCOVERY_MULTIPLIER_RULES.map(([who, mult]) => (
                        <li
                          key={who}
                          className="flex justify-between text-[10.5px] text-muted-foreground"
                        >
                          <span>{who}</span>
                          <span className="font-semibold text-cyan-600">
                            {mult}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs bg-emerald-500/10 border border-emerald-500/30 rounded px-2.5 py-2">
                  <p className="font-semibold">Your total score</p>
                  <span className="font-bold text-emerald-600">
                    {curationScore.toFixed(0)}
                  </span>
                </div>
                {curationScore === 0 && (
                  <p className="text-[10.5px] text-muted-foreground italic mt-2 text-center">
                    No curation actions recorded yet.
                  </p>
                )}
              </div>
            )}

            {/* ── Cumulative Rewards: real curate txs ─────────────────────── */}
            {expanded === 2 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="w-4 h-4 text-emerald-500" />
                  <h4 className="text-sm font-semibold">Curation activity</h4>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
                  Rewards distributed daily from the{' '}
                  <span className="font-semibold">10,000 ORA curator pool</span>,
                  proportional to your daily Curation Score.
                </p>

                {curationTransactions.length === 0 ? (
                  <div className="flex flex-col items-center text-center py-4 gap-1">
                    <Coins className="w-7 h-7 text-emerald-500/70" />
                    <p className="text-xs text-muted-foreground">
                      No curation activity yet.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-background/60 rounded p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">Spent</p>
                        <p className="text-sm font-bold text-red-500">
                          −{totalSpent.toFixed(2)} ORA
                        </p>
                      </div>
                      <div className="bg-background/60 rounded p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">Rewards</p>
                        <p className="text-sm font-bold text-green-600">
                          +{totalRewardsFromTx.toFixed(2)} ORA
                        </p>
                      </div>
                    </div>
                    <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                      {curationTransactions.slice(0, 20).map((tx) => (
                        <li
                          key={tx.id}
                          className="flex items-center justify-between gap-2 text-xs bg-background/60 rounded px-2.5 py-1.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{tx.details}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {relativeTime(tx.timestamp)}
                            </p>
                          </div>
                          <span
                            className={`font-bold flex-shrink-0 ${
                              tx.amount > 0 ? 'text-green-600' : 'text-red-500'
                            }`}
                          >
                            {tx.amount > 0 ? '+' : ''}
                            {tx.amount.toFixed(2)} ORA
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Formula footer */}
      <p className="text-[11px] text-muted-foreground italic text-center px-5 py-3 mt-1">
        {formula}
      </p>
    </div>
  );
}
