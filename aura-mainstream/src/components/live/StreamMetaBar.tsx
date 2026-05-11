/**
 * StreamMetaBar — Twitch-style metadata strip below the player.
 *
 * Shows: host avatar + title + category chip + tag chips + uptime +
 * viewer count + Follow / Sub / Share buttons. Sticky-ish so the
 * key actions stay visible even as chat scrolls.
 *
 * 2026-05-11: pulled out of LiveStreamPage to its own component so it
 * can be reused across the Iris welcome stream and any future live
 * pages without re-wiring all the props.
 */
import { Eye, Share2, Clock, Star, Heart } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';

interface Props {
  host: { displayName: string; username: string; avatar?: string; isVerified?: boolean };
  title: string;
  category: string;
  tags: string[];
  viewerCount: number;
  uptimeMs: number; // duration since stream started
  followed: boolean;
  isSubscribed: boolean;
  subscribePrice: number;
  onFollow: () => void;
  onSubscribe: () => void;
  onShare: () => void;
}

const formatUptime = (ms: number): string => {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default function StreamMetaBar(props: Props) {
  return (
    <div className="bg-card border-b border-border/40 px-4 py-3">
      <div className="flex flex-wrap items-start gap-3">
        <UserAvatar src={props.host.avatar} displayName={props.host.displayName} username={props.host.username} className="w-12 h-12 rounded-full ring-2 ring-red-500" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="font-bold text-sm">{props.host.displayName}</span>
            {props.host.isVerified && <span className="text-aura text-xs">✓</span>}
          </div>
          <p className="font-semibold text-base truncate">{props.title}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-aura/10 text-aura border border-aura/30">
              {props.category}
            </span>
            {props.tags.map(tag => (
              <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-secondary/60 text-muted-foreground hover:bg-secondary cursor-pointer">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          {/* Top row: live stats */}
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 text-rose-500 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              <Eye className="w-3 h-3" />
              {props.viewerCount.toLocaleString()}
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground tabular-nums">
              <Clock className="w-3 h-3" />
              {formatUptime(props.uptimeMs)}
            </span>
          </div>
          {/* Bottom row: actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={props.onFollow}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                props.followed
                  ? 'bg-secondary text-muted-foreground hover:bg-secondary/70'
                  : 'bg-rose-500 text-white hover:bg-rose-600'
              }`}
            >
              <Heart className={`w-3 h-3 ${props.followed ? 'fill-current' : ''}`} />
              {props.followed ? 'Following' : 'Follow'}
            </button>
            <button
              onClick={props.onSubscribe}
              disabled={props.isSubscribed}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                props.isSubscribed
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-gradient-to-r from-purple-500 to-cyan-500 text-white hover:opacity-90'
              }`}
            >
              <Star className="w-3 h-3" />
              {props.isSubscribed ? 'Subscribed' : `Sub · ${props.subscribePrice} ORA/mo`}
            </button>
            <button
              onClick={props.onShare}
              className="w-7 h-7 rounded-md bg-secondary hover:bg-secondary/70 flex items-center justify-center text-muted-foreground"
              aria-label="Share"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
