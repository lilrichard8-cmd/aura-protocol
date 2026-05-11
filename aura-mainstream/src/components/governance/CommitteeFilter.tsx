/**
 * CommitteeFilter — horizontal chip row for filtering proposals by committee.
 *
 * Used on /governance/active and /governance/completed. Mirrors the Marketplace
 * sub-tab chip style (px-4 py-2 rounded-lg whitespace-nowrap, scrollable on
 * narrow screens) so the design language stays consistent.
 *
 * Props
 * -----
 *   value      — currently selected committee id, or 'all'
 *   onChange   — fires with the new selection
 *   counts     — proposal count per committee id, used to populate the badge
 *                next to each chip. Pass `{ all: 12, 'development-committee': 4, ... }`.
 *                The 'all' key is required; missing committee keys render as 0.
 *
 * The component itself doesn't filter anything — the parent owns the filtered
 * list. This keeps the chip row a pure presentation concern and lets the
 * parent decide whether to filter `activeProposals`, `completedProposals`,
 * or both.
 */

import { useMemo } from 'react';
import { useI18n } from '@/context/I18nContext';

export type CommitteeFilterValue = 'all' | string;

interface Props {
  value: CommitteeFilterValue;
  onChange: (next: CommitteeFilterValue) => void;
  /** Proposal count per committee id, plus 'all' total. */
  counts: Record<string, number>;
  /** Optional total label, defaults to "All". */
  allLabel?: string;
  /** Optional class to override the wrapper. */
  className?: string;
}

interface ChipDef {
  id: CommitteeFilterValue;
  icon: string;
  label: string;
}

export default function CommitteeFilter({ value, onChange, counts, allLabel, className }: Props) {
  const { t } = useI18n();

  // i18n-driven labels. Keys mirror COMMITTEE_META ids and
  // t.governance.committees.{development|content|operations|arbitration|technical}.
  const chips = useMemo<ChipDef[]>(() => [
    { id: 'all' as const,           icon: '🗳️', label: allLabel ?? t.governance.committees.all ?? 'All' },
    { id: 'development-committee',  icon: '🏗️', label: t.governance.committees.development },
    { id: 'content-committee',      icon: '📝', label: t.governance.committees.content },
    { id: 'operations-committee',   icon: '⚙️', label: t.governance.committees.operations },
    { id: 'arbitration-committee',  icon: '⚖️', label: t.governance.committees.arbitration },
    { id: 'tech-committee',         icon: '🔧', label: t.governance.committees.technical },
  ], [t, allLabel]);

  // Hide a chip with zero proposals to keep the row clean. Always show
  // the 'all' chip and the currently selected chip even when count = 0,
  // so the user sees their selection and can switch back.
  const visible = chips.filter(c => c.id === 'all' || c.id === value || (counts[c.id] ?? 0) > 0);

  return (
    <div className={`flex gap-2 overflow-x-auto pb-2 no-scrollbar ${className ?? ''}`}>
      {visible.map(chip => {
        const count = counts[chip.id] ?? 0;
        const active = value === chip.id;
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onChange(chip.id)}
            aria-pressed={active}
            className={`shrink-0 px-3.5 py-2 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium transition-all border ${
              active
                ? 'bg-aura/10 text-aura border-aura/40 ring-1 ring-aura/20'
                : 'bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground border-transparent'
            }`}
          >
            <span className="text-base leading-none">{chip.icon}</span>
            <span>{chip.label}</span>
            <span className={`ml-0.5 text-[10px] tabular-nums px-1.5 py-0.5 rounded-full font-bold ${
              active ? 'bg-aura/20 text-aura' : 'bg-background/60 text-muted-foreground'
            }`}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
