/**
 * RecommendedChannels — left-side rail of other live creators, very
 * Twitch-y. On collapse just shows avatars; expanded shows name +
 * category + viewer count.
 *
 * 2026-05-11.
 */
import { useNavigate } from 'react-router-dom';
import UserAvatar from '@/components/UserAvatar';
import { Eye } from 'lucide-react';
import type { LiveStream } from '@/data/mockP1';

interface Props {
  streams: LiveStream[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function RecommendedChannels({ streams, collapsed }: Props) {
  const navigate = useNavigate();
  if (streams.length === 0) return null;
  const visible = streams.slice(0, 8);

  return (
    <aside
      className={`hidden lg:flex flex-col bg-card border-r border-border/40 transition-all duration-200 ${
        collapsed ? 'w-14' : 'w-60'
      }`}
    >
      <div className="px-3 py-3 border-b border-border/40">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {collapsed ? 'Live' : 'Recommended channels'}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {visible.map(s => (
          <button
            key={s.id}
            onClick={() => navigate(`/live/${s.id}`)}
            className="w-full text-left px-3 py-2 hover:bg-secondary/40 transition-colors flex items-center gap-2"
          >
            <div className="relative shrink-0">
              <UserAvatar
                src={s.host.avatar}
                displayName={s.host.displayName}
                username={s.host.username}
                className={`rounded-full ${collapsed ? 'w-8 h-8' : 'w-9 h-9'}`}
              />
              {s.isLive && (
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-card" />
              )}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate flex items-center gap-1">
                  {s.host.displayName}
                  {s.host.isVerified && <span className="text-aura text-[10px]">✓</span>}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">{s.category}</p>
                {s.isLive && (
                  <p className="text-[10px] text-rose-500 inline-flex items-center gap-0.5 tabular-nums">
                    <Eye className="w-2.5 h-2.5" />
                    {s.viewerCount.toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </button>
        ))}
      </div>
    </aside>
  );
}
