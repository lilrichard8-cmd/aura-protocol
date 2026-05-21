import { Component, useState, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null; info: ErrorInfo | null }

/**
 * Recovery UI shown when a single page crashes.
 * SideNav + Header remain mounted, so the user can still navigate or use
 * the global Feedback button, but we ALSO give them a one-click recovery
 * path right here in the boundary.
 */
function PageCrashRecovery({
  error,
  info,
  onRetry,
}: {
  error: Error;
  info: ErrorInfo | null;
  onRetry: () => void;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const webhook = (import.meta.env.VITE_FEEDBACK_WEBHOOK_URL as string | undefined) || '';

  const handleReport = async () => {
    if (sending) return;
    if (!webhook) {
      setStatus('No webhook configured.');
      return;
    }
    setSending(true);
    setStatus('Sending…');
    try {
      const card = {
        msg_type: 'interactive',
        card: {
          config: { wide_screen_mode: true },
          header: {
            title: { tag: 'plain_text', content: 'AURA Page Crash' },
            template: 'red',
          },
          elements: [
            { tag: 'div', text: { tag: 'lark_md', content: `**Message:** ${error.message}` } },
            { tag: 'hr' },
            {
              tag: 'div',
              text: {
                tag: 'lark_md',
                content:
                  `**URL:** ${window.location.href}\n` +
                  `**UA:** ${navigator.userAgent}\n` +
                  `**Viewport:** ${window.innerWidth}x${window.innerHeight}\n` +
                  `**Stack:**\n\`\`\`\n${(error.stack || '').slice(0, 1500)}\n\`\`\`` +
                  (info?.componentStack ? `\n**Component stack:**\n\`\`\`\n${info.componentStack.slice(0, 800)}\n\`\`\`` : ''),
              },
            },
            {
              tag: 'note',
              elements: [
                { tag: 'plain_text', content: '⏱ Captured by PageErrorBoundary (single-page crash, SideNav still alive)' },
              ],
            },
          ],
        },
      };
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(card),
      });
      setStatus(res.ok ? '✅ Sent. Thank you!' : `⚠️ Failed (${res.status})`);
    } catch (e: any) {
      setStatus(`⚠️ Network error: ${e?.message || e}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="max-w-2xl w-full bg-card border border-red-500/30 rounded-2xl p-6 shadow-xl">
        <h2 className="text-xl font-bold text-red-500 mb-2">⚠️ This page crashed</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Sorry — the page hit a runtime error. The Sentry monitor was already notified.
          You can also send us a short report below, then retry or go home.
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={handleReport}
            disabled={sending}
            className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition"
          >
            📤 Report this
          </button>
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-full bg-secondary hover:bg-secondary/80 text-sm font-medium transition"
          >
            🔄 Try again
          </button>
          <button
            onClick={() => { window.location.href = '/'; }}
            className="px-4 py-2 rounded-full bg-secondary hover:bg-secondary/80 text-sm font-medium transition"
          >
            🏠 Home
          </button>
          {status && (
            <span className="self-center text-xs text-muted-foreground">{status}</span>
          )}
        </div>
        <details>
          <summary className="cursor-pointer text-xs text-muted-foreground">Technical details</summary>
          <pre className="mt-2 bg-secondary rounded-xl p-4 text-xs overflow-auto max-h-80 whitespace-pre-wrap">
            <strong>{error.name}: {error.message}</strong>
            {'\n\n'}
            {error.stack}
            {info?.componentStack ? '\n\n— Component stack —' + info.componentStack : ''}
          </pre>
        </details>
      </div>
    </div>
  );
}

export default class PageErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to console for inspection
    // eslint-disable-next-line no-console
    console.error('[PageErrorBoundary]', error, info);
    this.setState({ info });

    // Forward to Sentry if it was initialized in main.tsx. We avoid a
    // static import so PageErrorBoundary remains usable in environments
    // (tests, dev without DSN) where Sentry isn't loaded.
    try {
      const Sentry = (window as any).__auraSentry;
      if (Sentry && typeof Sentry.captureException === 'function') {
        Sentry.captureException(error, {
          contexts: {
            react: { componentStack: info.componentStack ?? null },
          },
        });
      }
    } catch {
      /* swallow — reporting must never crash the UI */
    }
  }

  render() {
    if (this.state.error) {
      return (
        <PageCrashRecovery
          error={this.state.error}
          info={this.state.info}
          onRetry={() => this.setState({ error: null, info: null })}
        />
      );
    }
    return this.props.children;
  }
}
