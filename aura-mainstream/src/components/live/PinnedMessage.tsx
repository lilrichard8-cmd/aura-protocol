/**
 * PinnedMessage — host-pinned banner shown at the top of the chat.
 * Twitch-like sticky announcement, dismissible.
 *
 * 2026-05-11.
 */
import { useState } from 'react';
import { Pin, X } from 'lucide-react';

export default function PinnedMessage({
  message,
  authorName,
}: {
  message: string;
  authorName: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || !message) return null;
  return (
    <div className="px-4 py-2.5 bg-aura/10 border-b border-aura/30 flex items-start gap-2">
      <Pin className="w-3.5 h-3.5 text-aura shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold text-aura uppercase tracking-wider mb-0.5">
          Pinned by {authorName}
        </div>
        <p className="text-xs text-foreground leading-relaxed">{message}</p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-muted-foreground hover:text-foreground shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
