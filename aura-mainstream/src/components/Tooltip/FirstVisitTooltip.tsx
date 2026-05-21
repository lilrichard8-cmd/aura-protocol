import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * One-shot onboarding tooltip.
 *
 * Targets a DOM node by selector (typically `[data-tour-id="..."]`) and shows
 * an arrowed bubble pointing at it. Persistence: writes
 * `localStorage["aura_tour_<id>_seen"] = "1"` after the user dismisses (or
 * the auto-dismiss timeout fires). Re-mounting with the same id is a no-op.
 *
 * Designed to be drop-in: just put one of these high in a page tree.
 * If the target is missing on first mount, the tooltip silently does nothing —
 * we don't want a stale tour pointing at a button that was renamed.
 *
 * To reset the tour (e.g. from a Help menu "Replay tour" button), clear the
 * matching localStorage keys.
 */

export interface FirstVisitTooltipProps {
  /** Stable id. Determines the localStorage key and dedupes across re-mounts. */
  id: string;
  /** CSS selector for the target element (preferably `[data-tour-id="…"]`). */
  target: string;
  /** Headline text shown in bold. */
  title: string;
  /** Body copy under the title. Plain text only. */
  body: string;
  /**
   * Where the bubble should sit relative to the target. Default 'bottom'.
   * Tooltip auto-flips if it would go off-screen on the chosen edge.
   */
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /** Optional gating predicate (return false to suppress one-shot). */
  shouldShow?: () => boolean;
  /** Auto-dismiss after N ms. 0 = never. Default 0 (manual dismiss only). */
  autoDismissMs?: number;
  /** Delay before initial render, ms (lets the target mount first). Default 600. */
  showAfterMs?: number;
}

const SEEN_PREFIX = 'aura_tour_';
const SEEN_SUFFIX = '_seen';
const storageKey = (id: string) => `${SEEN_PREFIX}${id}${SEEN_SUFFIX}`;

export function clearAllTours() {
  try {
    const keys = Object.keys(localStorage);
    for (const k of keys) {
      if (k.startsWith(SEEN_PREFIX) && k.endsWith(SEEN_SUFFIX)) {
        localStorage.removeItem(k);
      }
    }
  } catch { /* ignore */ }
}

export default function FirstVisitTooltip({
  id,
  target,
  title,
  body,
  placement = 'bottom',
  shouldShow,
  autoDismissMs = 0,
  showAfterMs = 600,
}: FirstVisitTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  // One-shot gate.
  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey(id)) === '1') return;
    } catch { return; }
    if (shouldShow && !shouldShow()) return;

    let raf = 0;
    const t = setTimeout(() => {
      const el = document.querySelector(target);
      if (!el) return; // target missing — silently skip
      setRect((el as HTMLElement).getBoundingClientRect());
      setVisible(true);
      const tick = () => {
        const e = document.querySelector(target);
        if (e) setRect((e as HTMLElement).getBoundingClientRect());
        raf = window.requestAnimationFrame(tick);
      };
      raf = window.requestAnimationFrame(tick);
    }, showAfterMs);

    return () => {
      clearTimeout(t);
      if (raf) window.cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, target, showAfterMs]);

  // Auto-dismiss.
  useEffect(() => {
    if (!visible || !autoDismissMs) return;
    const t = setTimeout(() => dismiss(), autoDismissMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, autoDismissMs]);

  // Reposition on resize / scroll.
  useLayoutEffect(() => {
    if (!visible) return;
    const handler = () => {
      const el = document.querySelector(target);
      if (el) setRect((el as HTMLElement).getBoundingClientRect());
    };
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [visible, target]);

  function dismiss() {
    try { localStorage.setItem(storageKey(id), '1'); } catch { /* ignore */ }
    setVisible(false);
  }

  if (!visible || !rect) return null;

  // Compute bubble position. Default placement; flip if not enough room.
  const margin = 12;
  const bubbleW = 280;
  const bubbleH = 120;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let effective = placement;
  if (placement === 'bottom' && rect.bottom + margin + bubbleH > vh) effective = 'top';
  if (placement === 'top' && rect.top - margin - bubbleH < 0) effective = 'bottom';
  if (placement === 'right' && rect.right + margin + bubbleW > vw) effective = 'left';
  if (placement === 'left' && rect.left - margin - bubbleW < 0) effective = 'right';

  let top = 0, left = 0;
  if (effective === 'bottom') {
    top = rect.bottom + margin;
    left = rect.left + rect.width / 2 - bubbleW / 2;
  } else if (effective === 'top') {
    top = rect.top - margin - bubbleH;
    left = rect.left + rect.width / 2 - bubbleW / 2;
  } else if (effective === 'right') {
    top = rect.top + rect.height / 2 - bubbleH / 2;
    left = rect.right + margin;
  } else { // left
    top = rect.top + rect.height / 2 - bubbleH / 2;
    left = rect.left - margin - bubbleW;
  }
  // Clamp horizontally so it stays inside the viewport.
  left = Math.max(8, Math.min(vw - bubbleW - 8, left));
  top = Math.max(8, Math.min(vh - bubbleH - 8, top));

  return createPortal(
    <>
      {/* Soft halo around the target */}
      <div
        style={{
          position: 'fixed',
          top: rect.top - 6,
          left: rect.left - 6,
          width: rect.width + 12,
          height: rect.height + 12,
          borderRadius: 12,
          boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.18)',
          pointerEvents: 'none',
          transition: 'all 200ms ease-out',
          zIndex: 9998,
        }}
      />
      <div
        ref={bubbleRef}
        role="dialog"
        aria-label={title}
        className={cn(
          'fixed z-[9999] bg-card border border-aura/40 shadow-xl rounded-xl',
          'p-4 text-sm animate-in fade-in zoom-in-95 duration-200',
        )}
        style={{ top, left, width: bubbleW }}
      >
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute top-2 right-2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <div className="font-semibold text-foreground pr-5 mb-1">{title}</div>
        <p className="text-muted-foreground leading-relaxed">{body}</p>
        <div className="mt-3 flex items-center justify-end">
          <button
            onClick={dismiss}
            className="text-xs font-medium px-3 py-1.5 rounded-md bg-gradient-to-r from-aura to-ora text-white hover:opacity-90 transition-opacity"
          >
            Got it
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
