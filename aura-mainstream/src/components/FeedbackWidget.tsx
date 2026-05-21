// AURA Feedback widget
// 2026-05-20 — panel for users to report bugs / suggest features / send
// general feedback. Submits to a Feishu webhook via `@/lib/feedback`.
// Auto-captures URL, wallet address, username, browser, and (optionally)
// a viewport screenshot.
//
// 2026-05-21 — trigger moved into the top nav (white-area bar). The widget
// is now externally controlled: pass `open` + `onOpenChange`. If those
// props are omitted it falls back to the legacy floating-bubble trigger.

import { useEffect, useRef, useState } from 'react';
import { MessageSquare, X, Send, Camera, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { submitFeedback, captureViewport, type FeedbackType } from '@/lib/feedback';

type Status = 'idle' | 'sending' | 'sent' | 'error';

const TYPE_OPTIONS: { value: FeedbackType; label: string; emoji: string }[] = [
  { value: 'bug', label: 'Bug', emoji: '🐛' },
  { value: 'feature', label: 'Suggestion', emoji: '✨' },
  { value: 'general', label: 'General', emoji: '💬' },
];

interface FeedbackWidgetProps {
  /** Controlled open state. When provided, the floating trigger is hidden. */
  open?: boolean;
  /** Called when the panel wants to open/close (Esc, close button, send). */
  onOpenChange?: (open: boolean) => void;
}

export default function FeedbackWidget({ open: controlledOpen, onOpenChange }: FeedbackWidgetProps = {}) {
  const auth = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? !!controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };
  const [type, setType] = useState<FeedbackType>('bug');
  const [message, setMessage] = useState('');
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Reset transient state when reopening
  useEffect(() => {
    if (open) {
      setStatus('idle');
      setErrorMsg(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setStatus('sending');
    setErrorMsg(null);

    let screenshot: string | null = null;
    if (includeScreenshot) {
      // Hide the panel before snapping so we don't capture the form itself.
      if (panelRef.current) panelRef.current.style.visibility = 'hidden';
      try {
        // Let the browser repaint without the panel.
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        screenshot = await captureViewport();
      } finally {
        if (panelRef.current) panelRef.current.style.visibility = 'visible';
      }
    }

    const res = await submitFeedback({
      type,
      message: message.trim(),
      walletAddress: auth.walletAddress,
      username: auth.user?.username ?? null,
      screenshot,
    });

    if (res.ok) {
      setStatus('sent');
      setMessage('');
      // Auto-close after a short success delay.
      setTimeout(() => {
        setOpen(false);
      }, 1500);
    } else {
      setStatus('error');
      setErrorMsg(res.reason ?? 'Unknown error');
    }
  };

  return (
    <>
      {/* Floating trigger button — only when widget is uncontrolled (legacy fallback). */}
      {!isControlled && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open feedback"
          className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50 size-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:scale-105 hover:shadow-xl active:scale-95 transition-all flex items-center justify-center"
        >
          <MessageSquare className="size-5" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50 w-[calc(100vw-2rem)] sm:w-96 max-w-sm rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col"
          role="dialog"
          aria-label="Feedback"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-4 text-primary" />
              <h3 className="font-semibold text-sm">Send Feedback</h3>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="size-7 rounded-md hover:bg-secondary flex items-center justify-center"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
            {/* Type pills */}
            <div className="flex gap-2" role="radiogroup" aria-label="Feedback type">
              {TYPE_OPTIONS.map((opt) => {
                const active = type === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setType(opt.value)}
                    className={[
                      'flex-1 px-2 py-2 rounded-lg text-xs font-medium border transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border hover:bg-secondary',
                    ].join(' ')}
                  >
                    <span className="mr-1">{opt.emoji}</span>
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Textarea */}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                type === 'bug'
                  ? 'What went wrong? Steps to reproduce help a lot.'
                  : type === 'feature'
                  ? 'What feature would you like to see?'
                  : 'Anything you want to tell us…'
              }
              rows={5}
              maxLength={2000}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40 resize-none"
              disabled={status === 'sending'}
            />
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeScreenshot}
                  onChange={(e) => setIncludeScreenshot(e.target.checked)}
                  className="rounded border-input"
                  disabled={status === 'sending'}
                />
                <Camera className="size-3.5" />
                Include screenshot
              </label>
              <span>{message.length}/2000</span>
            </div>

            {/* Hidden metadata preview (small text so user knows what's sent) */}
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground">
                What data is sent with this report?
              </summary>
              <div className="mt-2 space-y-1 pl-2 border-l-2 border-border">
                <div>• Current page URL</div>
                {auth.walletAddress && (
                  <div>
                    • Wallet:{' '}
                    <code className="text-[10px]">
                      {auth.walletAddress.slice(0, 6)}…{auth.walletAddress.slice(-4)}
                    </code>
                  </div>
                )}
                {auth.user?.username && <div>• Username: {auth.user.username}</div>}
                <div>• Browser &amp; screen size</div>
                {includeScreenshot && <div>• Viewport screenshot</div>}
              </div>
            </details>

            {/* Status row */}
            {status === 'sent' && (
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 bg-green-500/10 border border-green-500/30 rounded-lg p-2">
                <CheckCircle2 className="size-4" />
                Thanks! We'll take a look.
              </div>
            )}
            {status === 'error' && (
              <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                <AlertCircle className="size-4 mt-0.5 shrink-0" />
                <div>
                  Couldn't send: {errorMsg}
                  <br />
                  <span className="text-[10px] opacity-70">
                    Try again, or ping us on our feedback group (link below).
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-border bg-secondary/30 flex items-center justify-between gap-2">
            <FeedbackGroupLinks />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!message.trim() || status === 'sending' || status === 'sent'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {status === 'sending' ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="size-3.5" />
                  Send
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Small inline link cluster — Discord / Telegram feedback group. */
function FeedbackGroupLinks() {
  const discord = (import.meta.env.VITE_FEEDBACK_DISCORD_URL as string | undefined)?.trim();
  const telegram = (import.meta.env.VITE_FEEDBACK_TG_URL as string | undefined)?.trim();
  if (!discord && !telegram) {
    return <span className="text-[10px] text-muted-foreground">Powered by AURA</span>;
  }
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
      <span>Join us:</span>
      {discord && (
        <a
          href={discord}
          target="_blank"
          rel="noreferrer noopener"
          className="text-primary hover:underline"
        >
          Discord
        </a>
      )}
      {telegram && (
        <a
          href={telegram}
          target="_blank"
          rel="noreferrer noopener"
          className="text-primary hover:underline"
        >
          Telegram
        </a>
      )}
    </div>
  );
}
