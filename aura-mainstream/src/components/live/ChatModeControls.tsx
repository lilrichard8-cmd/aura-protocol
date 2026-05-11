/**
 * ChatModeControls — chat-bottom mode bar showing the current chat
 * policy (slow mode / followers-only / sub-only) + a discrete theatre-
 * mode toggle for the viewer.
 *
 * 2026-05-11.
 */
import { Maximize2, Minimize2 } from 'lucide-react';

interface Props {
  slowModeSeconds: number | null;     // 0 / null = off
  followersOnly?: boolean;
  subscribersOnly?: boolean;
  isTheatreMode: boolean;
  onToggleTheatreMode: () => void;
}

export default function ChatModeControls(props: Props) {
  const tags: string[] = [];
  if (props.slowModeSeconds && props.slowModeSeconds > 0) {
    tags.push(`Slow ${props.slowModeSeconds}s`);
  }
  if (props.followersOnly)     tags.push('Followers-only');
  if (props.subscribersOnly)   tags.push('Sub-only');

  return (
    <div className="px-3 py-1.5 border-t border-border/40 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
      <div className="flex items-center gap-1.5 flex-wrap">
        {tags.length === 0 ? (
          <span>Open chat</span>
        ) : (
          tags.map(t => (
            <span key={t} className="px-1.5 py-0.5 rounded bg-secondary/60">
              {t}
            </span>
          ))
        )}
      </div>
      <button
        onClick={props.onToggleTheatreMode}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        title={props.isTheatreMode ? 'Exit theatre mode' : 'Theatre mode'}
      >
        {props.isTheatreMode ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
        {props.isTheatreMode ? 'Exit' : 'Theatre'}
      </button>
    </div>
  );
}
