// Tiny stat tile inside an own-coin card.
// Extracted from WalletPage.tsx 2026-05-20 P-1 split.
export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary/40 px-2 py-1">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground font-bold">{label}</div>
      <div className="text-xs font-bold tabular-nums">{value}</div>
    </div>
  );
}

export default MiniStat;
