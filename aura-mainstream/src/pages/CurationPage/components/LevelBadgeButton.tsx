// Level badge button for the curation sticky header.
// Extracted from CurationPage.tsx 2026-05-20 P-1 split.
import { ChevronRight } from 'lucide-react';
import { levelForExp, badgeStyleForLevel } from '../lib/levels';

/**
 * Level badge button — mirrors the Explore page "Discover" button shape
 * (h-10 rounded-2xl, secondary surface) but tinted with the current
 * level's gradient. Tier emoji + Lv.N + EXP read at a glance.
 */
export function LevelBadgeButton({ exp, onClick }: { exp: number; onClick: () => void }) {
  const level = levelForExp(exp);
  const style = badgeStyleForLevel(level);
  return (
    <button
      onClick={onClick}
      title="View level rules & EXP progress"
      aria-label={`Curator level ${level} — ${exp.toLocaleString()} EXP. Open level details.`}
      className={`flex-shrink-0 h-10 px-3 inline-flex items-center gap-1.5 rounded-2xl text-xs font-semibold transition-all border bg-gradient-to-r ${style.gradient} ${style.text} ${style.ring} hover:brightness-105 active:scale-95 shadow-sm ${style.glow ?? ''}`}
    >
      <span className="text-[13px] leading-none">{style.emoji}</span>
      <span className="hidden sm:inline">Lv.{level}</span>
      <span className="sm:hidden">L{level}</span>
      <span className="opacity-70 font-mono text-[10px] tabular-nums hidden md:inline">
        {exp.toLocaleString()} EXP
      </span>
      <ChevronRight className="w-3.5 h-3.5 opacity-70" />
    </button>
  );
}

export default LevelBadgeButton;
