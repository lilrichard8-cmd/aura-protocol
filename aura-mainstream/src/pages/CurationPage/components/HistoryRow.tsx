// Curation history record row.
// Extracted from CurationPage.tsx 2026-05-20 P-1 split.
import type { CurationRecord } from '../types';

export function HistoryRow({
  record, onClick, formatTime,
}: {
  record: CurationRecord;
  onClick: () => void;
  formatTime: (ts: number) => string;
}) {
  const statusStyle: Record<CurationRecord['status'], string> = {
    active:  'bg-blue-500/15  text-blue-600  dark:text-blue-400',
    claimed: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    pending: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
  };
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="bg-card rounded-xl p-4 border hover:border-amber-400/40 hover:shadow-md transition-all cursor-pointer flex items-center gap-4"
    >
      <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
        {record.contentCover ? (
          <img src={record.contentCover} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl">📄</div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-medium line-clamp-1 mb-1">{record.contentTitle}</h4>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>Staked {record.stakeAmount} ORA</span>
          <span>·</span>
          <span>{formatTime(record.stakeTime)}</span>
          <span>·</span>
          <span>{record.timeWeight}× weight</span>
          <span>·</span>
          <span>{record.performanceCoeff.toFixed(2)} performance</span>
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold mb-1 ${statusStyle[record.status]}`}>
          {record.status === 'active' ? 'Active' : record.status === 'claimed' ? 'Claimed' : 'Pending'}
        </span>
        <div className="font-bold">
          {record.status === 'claimed'
            ? <span className="text-emerald-600 dark:text-emerald-400">+{record.rewards.toFixed(2)} ORA</span>
            : <span className="text-muted-foreground">~{record.rewards.toFixed(2)} ORA</span>}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {record.status === 'active'  && 'Earning'}
          {record.status === 'claimed' && 'Deposited'}
          {record.status === 'pending' && 'Pending settlement'}
        </div>
      </div>
    </div>
  );
}

export default HistoryRow;
