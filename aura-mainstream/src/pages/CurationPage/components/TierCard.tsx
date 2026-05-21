// Curation tier explanation card (5x/3x/2x/1x weight).
// Extracted from CurationPage.tsx 2026-05-20 P-1 split.

export function TierCard({
  tier, gradient, label, sub,
}: {
  tier: string;
  gradient: string;
  label: string;
  sub: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <div className={`bg-gradient-to-br ${gradient} px-3 py-2 text-white font-black text-2xl text-center`}>
        {tier}
      </div>
      <div className="p-2 text-center bg-card">
        <div className="text-[11px] font-bold text-foreground">{label}</div>
        <div className="text-[10px] text-muted-foreground">{sub}</div>
      </div>
    </div>
  );
}

export default TierCard;
