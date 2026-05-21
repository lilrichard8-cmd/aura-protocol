// Top-3 leaderboard podium card.
// Extracted from CurationPage.tsx 2026-05-20 P-1 split.
import { Coins, Users } from 'lucide-react';
import type { LeaderboardEntry } from '../types';
import { RANK_STYLE } from '../types';

export function PodiumCard({ rank, row, onClick }: { rank: number; row: LeaderboardEntry; onClick: () => void }) {
  const cover = row.post.coverImage || row.post.images?.[0];
  const style = RANK_STYLE[rank];
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
      className={`bg-card rounded-xl border ring-2 ${style.ring} overflow-hidden hover:shadow-lg transition-all flex flex-col cursor-pointer group relative`}
    >
      {/* Tinted top stripe */}
      <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${style.bgGlow} pointer-events-none`} />
      <div className="relative aspect-square bg-muted overflow-hidden">
        {cover ? (
          <img src={cover} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-400/30 via-orange-500/20 to-pink-500/20 flex items-center justify-center text-6xl">
            {fallbackEmoji}
          </div>
        )}
        <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/65 backdrop-blur text-white text-xs font-bold shadow-sm">
          <span className="text-base leading-none">{style.medal}</span> #{rank}
        </div>
        <div className={`absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r ${row.tier.gradient} text-white text-[10px] font-bold shadow-sm`}>
          {row.tier.label}
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <h4 className="font-semibold text-sm line-clamp-2 mb-1 min-h-[2.5rem]">
          {row.post.title || row.post.content?.slice(0, 60) || 'Untitled'}
        </h4>
        <p className="text-[11px] text-muted-foreground mb-3">by @{row.post.author.username}</p>

        {/* Stake score + pool share */}
        <div className="grid grid-cols-2 gap-3 mb-3 mt-auto text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Curators</div>
            <div className="text-base font-bold inline-flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-amber-500" />
              {row.curatorCount.toLocaleString()}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Pool share</div>
            <div className="text-base font-bold text-amber-600 dark:text-amber-400">
              {(row.shareOfPool * 100).toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Projected rewards */}
        <div className="bg-amber-500/10 rounded-lg p-3 space-y-1.5">
          <div className="text-[10px] uppercase tracking-wide font-bold text-amber-700 dark:text-amber-300">
            Projected payout (today)
          </div>
          <div className="flex justify-between text-xs">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Users className="w-3 h-3" /> Curators share
            </span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {row.curatorReward.toFixed(0)} ORA
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Coins className="w-3 h-3" /> Creator share
            </span>
            <span className="font-bold text-amber-600 dark:text-amber-400">
              {row.creatorReward.toFixed(0)} ORA
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PodiumCard;
