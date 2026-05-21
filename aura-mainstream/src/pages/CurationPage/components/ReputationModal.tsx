// Reputation/Level modal — shows EXP, level progress, rules, and ladder.
// Extracted from CurationPage.tsx 2026-05-20 P-1 split.
import { Sparkles, ChevronDown, Crown, Target, TrendingUp, Users, X } from 'lucide-react';
import {
  levelForExp, expForLevel, badgeStyleForLevel, costToAdvance,
  LEVEL_BANDS,
} from '../lib/levels';
import type { ExpRule } from '../types';

const EXP_RULES: ExpRule[] = [
  {
    icon: Target,
    label: 'Successful curation',
    description:
      'When you curate content that later performs well, you earn EXP proportional to your Curation Score. Being an earlier discoverer (lower rank) on a less-known creator scores more — the content’s age does not matter.',
    formula: 'EXP = 10 × rank_weight × discovery_weight',
    example: '1st curator (5×) on a creator with <100 followers (5×) → +250 EXP',
    signColor: 'text-emerald-600 dark:text-emerald-400',
    iconColor: 'text-emerald-500',
  },
  {
    icon: TrendingUp,
    label: 'Weekly taste bonus',
    description:
      'Maintain a curation success rate of 80% or higher over a rolling 7-day window and you’ll receive a flat weekly bonus. Quality over quantity — spamming hurts your rate.',
    formula: 'EXP = +50 / week, if success_rate ≥ 80%',
    signColor: 'text-cyan-600 dark:text-cyan-400',
    iconColor: 'text-cyan-500',
  },
  {
    icon: Sparkles,
    label: 'Discovery streak',
    description:
      'Curate creators with under 100 followers in a row and each one that trends adds a streak bonus. A flop resets the streak — it rewards real taste, not luck.',
    formula: 'EXP += 25 per consecutive trending pick (<100 followers)',
    signColor: 'text-fuchsia-600 dark:text-fuchsia-400',
    iconColor: 'text-fuchsia-500',
  },
  {
    icon: Users,
    label: 'Follower milestones',
    description:
      'Growing your own audience awards a one-time EXP grant at each milestone. Reaching 100 followers also unlocks Creator Coin issuance.',
    table: [
      { when: '100 followers',     reward: '+200 EXP' },
      { when: '1,000 followers',   reward: '+500 EXP' },
      { when: '10,000 followers',  reward: '+2,000 EXP' },
      { when: '100,000 followers', reward: '+10,000 EXP' },
    ],
    signColor: 'text-blue-600 dark:text-blue-400',
    iconColor: 'text-blue-500',
  },
  {
    icon: X,
    label: 'Frivolous remix flag',
    description:
      'If you flag someone’s remix as infringing and the panel rejects the claim, you lose EXP. Per whitepaper §7 — abusing the flag system hurts your on-chain record.',
    example: 'Each rejected flag: −1 strike on your record → -100 EXP',
    signColor: 'text-red-600 dark:text-red-400',
    iconColor: 'text-red-500',
  },
];

export function ReputationModal({ exp, onClose }: { exp: number; onClose: () => void }) {
  const level = levelForExp(exp);
  const style = badgeStyleForLevel(level);
  const currExpFloor = expForLevel(level);
  const nextExpFloor = expForLevel(level + 1);
  const inLevelExp = exp - currExpFloor;
  const levelSpan = nextExpFloor - currExpFloor;
  const progressPct = levelSpan > 0 ? Math.min(100, Math.round((inLevelExp / levelSpan) * 100)) : 100;
  const remaining = Math.max(0, nextExpFloor - exp);

  // EXP-rule expand state — each rule starts collapsed; click reveals formula/example/table.
  const [expandedRule, setExpandedRule] = useState<number | null>(null);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-background rounded-2xl max-w-3xl w-full border shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero header — single close affordance lives in the footer button */}
        <div className={`bg-gradient-to-br ${style.gradient} px-6 py-5 border-b`}>
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl bg-background/40 backdrop-blur border ${style.ring} ${style.glow ?? ''} shadow-lg`}>
              {style.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Curator level</div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className={`text-3xl font-black ${style.text}`}>Lv.{level}</span>
                <span className="text-sm font-semibold text-muted-foreground">{style.name}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 font-mono tabular-nums">
                {exp.toLocaleString()} EXP
              </div>
            </div>
          </div>

          {/* Progress bar to next level */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="font-bold text-foreground">Lv.{level}</span>
              <span className="text-muted-foreground">
                <span className="font-bold text-foreground tabular-nums">{remaining.toLocaleString()}</span> EXP to Lv.{level + 1}
              </span>
              <span className="font-bold text-foreground">Lv.{level + 1}</span>
            </div>
            <div className="h-2.5 rounded-full bg-background/40 overflow-hidden border border-border/40">
              <div
                className={`h-full bg-gradient-to-r ${style.gradient.replace(/\/\d+/g, '')} transition-all duration-500`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1 font-mono tabular-nums">
              <span>{currExpFloor.toLocaleString()}</span>
              <span>{progressPct}%</span>
              <span>{nextExpFloor.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Body — two columns on desktop (ladder | rules), balanced visual weight */}
        <div className="overflow-y-auto px-6 py-5 grid grid-cols-1 md:grid-cols-2 md:gap-x-6 gap-y-5">
          {/* LEFT — Level band ladder + next-badge teaser to balance the right column */}
          <section className="min-w-0 flex flex-col">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5" /> Level bands
            </h4>
            <div className="space-y-1">
              {LEVEL_BANDS.map((band) => {
                const sampleStyle = badgeStyleForLevel(band.from);
                const isCurrent = level >= band.from && level <= band.to;
                const range = band.to >= 999 ? `Lv.${band.from}+` : `Lv.${band.from}–${band.to}`;
                const expRange = band.to >= 999
                  ? `≥ ${expForLevel(band.from).toLocaleString()}`
                  : `${expForLevel(band.from).toLocaleString()}–${(expForLevel(band.to + 1) - 1).toLocaleString()}`;
                return (
                  <div
                    key={band.from}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border transition-all ${
                      isCurrent
                        ? 'border-aura bg-aura/10 ring-2 ring-aura/40'
                        : `${sampleStyle.ring} bg-gradient-to-r ${sampleStyle.gradient}`
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 bg-gradient-to-br ${sampleStyle.gradient} border ${sampleStyle.ring} ${sampleStyle.glow ?? ''}`}>
                      {sampleStyle.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[13px] font-bold leading-tight ${sampleStyle.text}`}>{sampleStyle.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{range}</span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 rounded-full bg-aura text-white text-[9px] font-bold uppercase tracking-wider">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono tabular-nums leading-tight">
                        {expRange} EXP
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-[10px] text-muted-foreground mt-3 italic leading-relaxed">
              Levels are uncapped and cosmetic. Curators are ranked on-chain by success rate (§3.4); reward multipliers come from curator-rank weight × discovery, not level.
            </p>
          </section>

          {/* RIGHT — How EXP is earned. Each rule collapsed by default; click for details. */}
          <section className="min-w-0 flex flex-col">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> How EXP is earned
              <span className="ml-auto text-[10px] font-medium text-muted-foreground/70 normal-case tracking-normal">
                tap to expand
              </span>
            </h4>
            <div className="space-y-1.5">
              {EXP_RULES.map((r, i) => {
                const Icon = r.icon;
                const isOpen = expandedRule === i;
                const hasDetails = !!(r.formula || r.example || r.table);
                return (
                  <div
                    key={i}
                    className="rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedRule(isOpen ? null : i)}
                      disabled={!hasDetails}
                      aria-expanded={isOpen}
                      className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left disabled:cursor-default"
                    >
                      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${r.iconColor}`} />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="text-sm font-semibold leading-snug">{r.label}</div>
                        <p className="text-[12px] text-muted-foreground leading-relaxed">
                          {r.description}
                        </p>
                      </div>
                      {hasDetails && (
                        <ChevronDown
                          className={`w-4 h-4 shrink-0 mt-0.5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        />
                      )}
                    </button>
                    {isOpen && hasDetails && (
                      <div className="px-3 pb-3 pl-[34px] space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                        {r.formula && (
                          <p className={`text-[12px] leading-relaxed ${r.signColor}`}>
                            <span className="font-semibold">Formula:</span> {r.formula}
                          </p>
                        )}
                        {r.example && (
                          <p className="text-[12px] text-muted-foreground/80 italic leading-relaxed">
                            — {r.example}
                          </p>
                        )}
                        {r.table && (
                          <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[12px] mt-1">
                            {r.table.map((row, j) => (
                              <li key={j} className="flex items-center justify-between tabular-nums">
                                <span className="text-muted-foreground">{row.when}</span>
                                <span className={`font-semibold ${r.signColor}`}>{row.reward}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 italic leading-relaxed">
              EXP never decays. Per-level costs are hand-tuned — gentle through Lv.20, steeper after Veteran (Lv.21).
            </p>
          </section>
        </div>

        {/* Footer — single dismiss action */}
        <div className="px-6 py-3 border-t bg-secondary/30">
          <Button onClick={onClose} className="w-full">
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
export default ReputationModal;
