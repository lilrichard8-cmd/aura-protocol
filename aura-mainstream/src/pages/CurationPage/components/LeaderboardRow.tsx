// Curation leaderboard table row (rank 4+).
// Extracted from CurationPage.tsx 2026-05-20 P-1 split.
import { Users } from 'lucide-react';
import type { LeaderboardEntry } from '../types';

export function LeaderboardRow({ rank, row, onClick }: { rank: number; row: LeaderboardEntry; onClick: () => void }) {
  const cover = row.post.coverImage || row.post.images?.[0];
  const fallbackEmoji =
    row.post.type === 'audio' ? '🎵' :
    row.post.type === 'video' ? '🎬' :
    row.post.type === 'photo' ? '📷' :
    row.post.type === 'live'  ? '🔴' : '✍️';
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="bg-card rounded-xl p-3 border hover:border-amber-400/40 hover:shadow-md transition-all cursor-pointer flex items-center gap-3 md:gap-4"
    >
      {/* Rank number */}
      <div className="w-8 text-center text-base font-black text-muted-foreground flex-shrink-0">
        #{rank}
      </div>

      {/* Cover thumbnail */}
      <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0 relative">
        {cover ? (
          <img src={cover} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl">{fallbackEmoji}</div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-medium line-clamp-1 text-sm mb-1">
          {row.post.title || row.post.content?.slice(0, 60) || 'Untitled'}
        </h4>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <span>by @{row.post.author.username}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <Users className="w-3 h-3" /> {row.curatorCount} curators
          </span>
          <span>·</span>
          <span>{row.totalStaked} ORA curated</span>
          <span className="hidden sm:inline">·</span>
          <span className={`hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r ${row.tier.gradient} text-white text-[9px] font-bold`}>
            {row.tier.label}
          </span>
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Pool share</div>
        <div className="text-sm font-bold text-amber-600 dark:text-amber-400">
          {(row.shareOfPool * 100).toFixed(2)}%
        </div>
        <div className="text-[10px] text-muted-foreground">
          ~{row.curatorReward.toFixed(0)} ORA / curators
        </div>
      </div>
    </div>
  );
}

export default LeaderboardRow;
