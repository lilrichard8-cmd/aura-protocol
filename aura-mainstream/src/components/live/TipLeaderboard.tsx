import { useState } from 'react';
import { ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import type { TipLeaderboardEntry } from '@/data/mockP1';
import UserAvatar from '@/components/UserAvatar';

interface TipLeaderboardProps {
  entries: TipLeaderboardEntry[];
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function TipLeaderboard({ entries }: TipLeaderboardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-secondary/50 hover:bg-secondary transition-colors"
      >
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-ora" />
          <span className="text-sm font-semibold">Top Tippers</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="p-3 space-y-2">
          {entries.slice(0, 5).map((entry, i) => (
            <div key={entry.user.id} className="flex items-center gap-3">
              <span className="text-sm w-6 text-center">{MEDALS[i] ?? `#${i + 1}`}</span>
              <UserAvatar src={entry.user.avatar} displayName={entry.user.displayName} username={entry.user.username} className="w-6 h-6 rounded-full" />
              <span className="text-sm flex-1 truncate">{entry.user.displayName}</span>
              <span className="text-xs text-ora font-semibold">{entry.totalTipped} ORA</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
