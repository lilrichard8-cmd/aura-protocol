// Curation history stat card.
// Extracted from CurationPage.tsx 2026-05-20 P-1 split.
import React from 'react';

export function StatCard({
  icon, label, value, unit, gradient, border, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  gradient: string;
  border: string;
  accent: string;
}) {
  return (
    <div className={`bg-gradient-to-br ${gradient} rounded-xl p-4 border ${border}`}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className={`text-sm font-medium line-clamp-1 ${accent}`}>{label}</h3>
        {icon}
      </div>
      <p className="text-2xl font-bold leading-tight">{value}</p>
      {unit && <p className="text-xs text-muted-foreground mt-0.5">{unit}</p>}
    </div>
  );
}

export default StatCard;
