import { useState, useEffect } from 'react';
import { Eye, Heart, Clock } from 'lucide-react';

interface StreamStatsProps {
  initialViewers: number;
  initialLikes: number;
  totalTips: number;
  isLive: boolean;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function StreamStats({ initialViewers, initialLikes, totalTips, isLive }: StreamStatsProps) {
  const [viewers, setViewers] = useState(initialViewers);
  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isLive) return;
    const iv = setInterval(() => {
      setViewers(v => v + Math.floor(Math.random() * 3) - 1);
    }, 5000);
    return () => clearInterval(iv);
  }, [isLive]);

  useEffect(() => {
    if (!isLive) return;
    const iv = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(iv);
  }, [isLive]);

  const handleLike = () => {
    if (!liked) {
      setLikes(l => l + 1);
      setLiked(true);
    }
  };

  return (
    <div className="flex items-center gap-4 flex-wrap px-4 py-3 bg-secondary/30 rounded-xl text-sm">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Eye className="w-4 h-4" />
        <span>{Math.max(0, viewers).toLocaleString()}</span>
      </div>
      <button onClick={handleLike} className="flex items-center gap-1.5 transition-colors hover:text-red-500">
        <Heart className={`w-4 h-4 ${liked ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
        <span className={liked ? 'text-red-500' : 'text-muted-foreground'}>{likes.toLocaleString()}</span>
      </button>
      <div className="flex items-center gap-1.5 text-ora">
        <span className="text-xs">💰</span>
        <span>{totalTips.toLocaleString()} ORA</span>
      </div>
      {isLive && (
        <div className="flex items-center gap-1.5 text-muted-foreground ml-auto">
          <Clock className="w-4 h-4" />
          <span className="font-mono">{formatDuration(elapsed)}</span>
        </div>
      )}
    </div>
  );
}
