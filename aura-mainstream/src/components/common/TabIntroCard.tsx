import type { ReactNode } from 'react';

/**
 * Reusable explainer card placed at the top of a content tab.
 *
 * Establishes a consistent pattern across Marketplace, Curation, and any
 * future tabbed surfaces. Each tab gets its own colour theme via the
 * gradient/border/title/icon-color props so users can locate themselves at
 * a glance, while the typographic rhythm stays uniform.
 *
 * Used by:
 *   • MarketplacePage (Coins / NFT / Content Keys / Bounty / Fractions)
 *   • CurationPage (Dashboard / Pending / History)
 */
export default function TabIntroCard({
  gradient,
  border,
  titleColor,
  iconColor,
  icon,
  title,
  description,
  meta,
}: {
  gradient: string;     // e.g. "from-amber-50 to-yellow-50 dark:from-amber-900/10 dark:to-yellow-900/10"
  border: string;       // e.g. "border-amber-200/50 dark:border-amber-800/50"
  titleColor: string;   // e.g. "text-amber-800 dark:text-amber-200"
  iconColor: string;    // e.g. "text-amber-600"
  icon: ReactNode;
  title: string;
  description: string;
  meta?: ReactNode;     // optional right-aligned slot for chips / stats
}) {
  return (
    <div className={`bg-gradient-to-r ${gradient} rounded-xl p-6 border ${border}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className={iconColor}>{icon}</div>
          <h3 className={`text-lg font-bold ${titleColor}`}>{title}</h3>
        </div>
        {meta}
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}
