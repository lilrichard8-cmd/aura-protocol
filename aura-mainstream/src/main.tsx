// === DIAG: trace which import is failing ===
;(window as any).__auraTrace = ['main.tsx:0 start']
const trace = (s: string) => { try { (window as any).__auraTrace.push(s); document.getElementById('root')!.innerHTML = '<pre style="padding:20px;font:monospace 14px">' + (window as any).__auraTrace.join('\n') + '</pre>' } catch {} }
trace('main.tsx:1 import polyfills')
import './polyfills'
trace('main.tsx:2 polyfills ok')

// Boot-phase error trap.
// Only active until React has finished its first commit (set in render
// callback below). After that we hand error handling to React's
// ErrorBoundary (TopLevelBoundary + per-page boundaries) and Sentry.
// 2026-05-21 — also render Report / Reload / Home buttons natively so
// the user can ALWAYS recover or report, even when React itself failed
// to boot.
;(window as any).__auraBooted = false

/**
 * Render a vanilla-HTML crash page into #root with three actions:
 *   1. Report   — posts directly to the Feishu webhook (no React deps)
 *   2. Reload   — hard-reload current URL
 *   3. Home     — navigates to /
 *
 * Lives in main.tsx (not a component) on purpose: if React is down, we
 * can't rely on React. This is pure DOM + fetch.
 */
function renderBootCrashPage(opts: {
  kind: 'boot error' | 'boot rejection'
  message: string
  stack?: string
  location?: string
}) {
  const root = document.getElementById('root')
  if (!root) return
  const webhook = (import.meta.env.VITE_FEEDBACK_WEBHOOK_URL as string | undefined) || ''
  const trace = ((window as any).__auraTrace as string[] | undefined)?.join('\n') || ''
  const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]!)
  root.innerHTML = `
    <div style="min-height:100vh;padding:24px;background:#fff;color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;flex-direction:column;gap:16px;max-width:900px;margin:0 auto">
      <div style="display:flex;align-items:center;gap:10px;color:#dc2626;font-weight:600;font-size:18px">
        ⚠️ Something went wrong while loading AURA
      </div>
      <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.5">
        Sorry — the app crashed before it could render. The Sentry monitor was already notified.
        You can also send us a short report below, then reload or go home.
      </p>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        <button id="aura-crash-report" style="padding:10px 16px;border-radius:9999px;background:#14C8A8;color:#fff;border:none;font-weight:600;cursor:pointer">📤 Report this</button>
        <button id="aura-crash-reload" style="padding:10px 16px;border-radius:9999px;background:#f3f4f6;color:#111827;border:1px solid #e5e7eb;font-weight:600;cursor:pointer">🔄 Reload</button>
        <button id="aura-crash-home" style="padding:10px 16px;border-radius:9999px;background:#f3f4f6;color:#111827;border:1px solid #e5e7eb;font-weight:600;cursor:pointer">🏠 Home</button>
        <span id="aura-crash-status" style="align-self:center;font-size:13px;color:#6b7280"></span>
      </div>
      <details style="margin-top:8px">
        <summary style="cursor:pointer;color:#6b7280;font-size:13px">Technical details</summary>
        <pre style="margin-top:8px;padding:12px;background:#fef2f2;color:#991b1b;border-radius:8px;font-family:ui-monospace,monospace;font-size:12px;white-space:pre-wrap;overflow:auto;max-height:300px">[${escape(opts.kind)}] ${escape(opts.message)}
${escape(opts.stack || '')}
${opts.location ? `at ${escape(opts.location)}` : ''}

TRACE:
${escape(trace)}</pre>
      </details>
    </div>
  `
  const status = document.getElementById('aura-crash-status') as HTMLSpanElement | null
  document.getElementById('aura-crash-reload')?.addEventListener('click', () => window.location.reload())
  document.getElementById('aura-crash-home')?.addEventListener('click', () => { window.location.href = '/' })
  document.getElementById('aura-crash-report')?.addEventListener('click', async () => {
    if (!status) return
    if (!webhook) {
      status.textContent = 'No webhook configured — ask the team to set VITE_FEEDBACK_WEBHOOK_URL.'
      return
    }
    status.textContent = 'Sending…'
    try {
      const card = {
        msg_type: 'interactive',
        card: {
          config: { wide_screen_mode: true },
          header: {
            title: { tag: 'plain_text', content: `AURA Crash — ${opts.kind}` },
            template: 'red',
          },
          elements: [
            { tag: 'div', text: { tag: 'lark_md', content: `**Message:** ${opts.message}` } },
            { tag: 'hr' },
            {
              tag: 'div',
              text: {
                tag: 'lark_md',
                content:
                  `**URL:** ${typeof window !== 'undefined' ? window.location.href : '?'}\n` +
                  `**UA:** ${typeof navigator !== 'undefined' ? navigator.userAgent : '?'}\n` +
                  `**Viewport:** ${typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '?'}\n` +
                  `**Stack:**\n\`\`\`\n${(opts.stack || '').slice(0, 1500)}\n\`\`\``,
              },
            },
            {
              tag: 'note',
              elements: [
                { tag: 'plain_text', content: '⏱ Captured by main.tsx boot-trap (pre-React)' },
              ],
            },
          ],
        },
      }
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(card),
      })
      if (res.ok) {
        status.textContent = '✅ Sent. Thank you!'
      } else {
        status.textContent = `⚠️ Failed (${res.status}). Try Reload.`
      }
    } catch (e: any) {
      status.textContent = `⚠️ Network error: ${e?.message || e}`
    }
  })
}

window.addEventListener('error', (e) => {
  if ((window as any).__auraBooted) return
  renderBootCrashPage({
    kind: 'boot error',
    message: e.message,
    stack: e.error?.stack,
    location: `${e.filename}:${e.lineno}`,
  })
})
window.addEventListener('unhandledrejection', (e) => {
  if ((window as any).__auraBooted) return
  renderBootCrashPage({
    kind: 'boot rejection',
    message: e.reason?.message || String(e.reason),
    stack: e.reason?.stack,
  })
})

trace('main.tsx:3 before react imports')
import { StrictMode, useMemo, useState, Component, ReactNode } from 'react'
trace('main.tsx:4 react ok')
import { createRoot } from 'react-dom/client'
trace('main.tsx:5 react-dom ok')
import './index.css'
trace('main.tsx:6 css ok')
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
trace('main.tsx:7 wallet-adapter-react ok')
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
trace('main.tsx:8 wallet-adapter-react-ui ok')
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets'
trace('main.tsx:9 wallet-adapter-wallets ok')
import { clusterApiUrl } from '@solana/web3.js'
trace('main.tsx:10 web3.js ok')
import '@solana/wallet-adapter-react-ui/styles.css'
trace('main.tsx:11 wallet-adapter-styles ok')
import { PrivyProvider } from '@privy-io/react-auth'
trace('main.tsx:12 privy ok')
import App from './App.tsx'
trace('main.tsx:13 App.tsx ok')

// Sentry (optional) — 2026-05-20
// Only initialized when VITE_SENTRY_DSN is set, so dev / preview builds
// without a project stay silent. The dynamic import keeps the bundle
// small when Sentry is disabled.
if (import.meta.env.VITE_SENTRY_DSN) {
  ;(async () => {
    try {
      const Sentry = await import('@sentry/react')
      Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN as string,
        environment: import.meta.env.MODE,
        // Conservative defaults; tune in dashboard once we know real volume.
        tracesSampleRate: 0.1,
        replaysSessionSampleRate: 0.05,
        replaysOnErrorSampleRate: 1.0,
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration({
            // We don't show PII in our UI by default; keep text visible so we
            // can see what the user was looking at when the error fired.
            maskAllText: false,
            blockAllMedia: false,
          }),
        ],
      })
      ;(window as any).__auraSentry = Sentry
      // NOTE: do NOT call trace() here — Sentry init is async and resolves
      // AFTER React has committed to #root. Calling trace() would overwrite
      // the rendered App with debug text. Log to console instead.
      // eslint-disable-next-line no-console
      console.log('[AURA] Sentry init ok')
      ;(window as any).__auraTrace?.push('main.tsx:13b sentry init ok (async)')
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[AURA] Sentry init failed', e)
    }
  })()
} else {
  // Sync branch: safe to call trace() because it runs before React render.
  trace('main.tsx:13b sentry disabled (no DSN)')
}

// Error boundary so a child Provider crash surfaces in the DOM.
// 2026-05-21 — used to render a bare red <pre>. Now shows a recovery UI
// with Report / Reload / Home buttons. The buttons live INSIDE React but
// the boundary itself can't crash again from its own render, so they're
// safe. (For boot-time failures BEFORE React mounts, see the
// renderBootCrashPage() helper above which uses pure DOM + fetch.)
function CrashScreen({ err }: { err: Error }) {
  const [status, setStatus] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const webhook = (import.meta.env.VITE_FEEDBACK_WEBHOOK_URL as string | undefined) || ''

  const handleReport = async () => {
    if (sending) return
    if (!webhook) {
      setStatus('No webhook configured — ask the team to set VITE_FEEDBACK_WEBHOOK_URL.')
      return
    }
    setSending(true)
    setStatus('Sending…')
    try {
      const card = {
        msg_type: 'interactive',
        card: {
          config: { wide_screen_mode: true },
          header: {
            title: { tag: 'plain_text', content: 'AURA Crash — react error' },
            template: 'red',
          },
          elements: [
            { tag: 'div', text: { tag: 'lark_md', content: `**Message:** ${err.message}` } },
            { tag: 'hr' },
            {
              tag: 'div',
              text: {
                tag: 'lark_md',
                content:
                  `**URL:** ${window.location.href}\n` +
                  `**UA:** ${navigator.userAgent}\n` +
                  `**Viewport:** ${window.innerWidth}x${window.innerHeight}\n` +
                  `**Stack:**\n\`\`\`\n${(err.stack || '').slice(0, 1500)}\n\`\`\``,
              },
            },
            {
              tag: 'note',
              elements: [
                { tag: 'plain_text', content: '⏱ Captured by TopLevelBoundary (React)' },
              ],
            },
          ],
        },
      }
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(card),
      })
      setStatus(res.ok ? '✅ Sent. Thank you!' : `⚠️ Failed (${res.status}). Try Reload.`)
    } catch (e: any) {
      setStatus(`⚠️ Network error: ${e?.message || e}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', padding: 24, background: '#fff', color: '#111827', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#dc2626', fontWeight: 600, fontSize: 18 }}>
        ⚠️ Something went wrong
      </div>
      <p style={{ margin: 0, color: '#6b7280', fontSize: 14, lineHeight: 1.5 }}>
        Sorry — AURA hit an unexpected error and this page can't continue. The Sentry monitor was already
        notified. You can also send us a short report below, then reload or go home.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          onClick={handleReport}
          disabled={sending}
          style={{ padding: '10px 16px', borderRadius: 9999, background: '#14C8A8', color: '#fff', border: 'none', fontWeight: 600, cursor: sending ? 'wait' : 'pointer', opacity: sending ? 0.7 : 1 }}
        >
          📤 Report this
        </button>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: '10px 16px', borderRadius: 9999, background: '#f3f4f6', color: '#111827', border: '1px solid #e5e7eb', fontWeight: 600, cursor: 'pointer' }}
        >
          🔄 Reload
        </button>
        <button
          onClick={() => { window.location.href = '/' }}
          style={{ padding: '10px 16px', borderRadius: 9999, background: '#f3f4f6', color: '#111827', border: '1px solid #e5e7eb', fontWeight: 600, cursor: 'pointer' }}
        >
          🏠 Home
        </button>
        {status && (
          <span style={{ alignSelf: 'center', fontSize: 13, color: '#6b7280' }}>{status}</span>
        )}
      </div>
      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: 'pointer', color: '#6b7280', fontSize: 13 }}>Technical details</summary>
        <pre style={{ marginTop: 8, padding: 12, background: '#fef2f2', color: '#991b1b', borderRadius: 8, fontFamily: 'ui-monospace,monospace', fontSize: 12, whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: 300 }}>
          [react error] {err.message}{'\n'}{err.stack}
        </pre>
      </details>
    </div>
  )
}

class TopLevelBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) { return { err } }
  componentDidCatch(err: Error, info: any) {
    console.error('[AURA TopLevelBoundary]', err, info)
  }
  render() {
    if (this.state.err) {
      return <CrashScreen err={this.state.err} />
    }
    return this.props.children
  }
}

// ?reset=1 clears all mock state and redirects to /auth
if (new URLSearchParams(window.location.search).has('reset')) {
  localStorage.removeItem('aura_auth');
  localStorage.removeItem('aura_mock_chain');
  Object.keys(localStorage)
    .filter(k => k.startsWith('aura_seen:') || k.startsWith('aura_mock_chain'))
    .forEach(k => localStorage.removeItem(k));
  window.location.replace('/auth');
}

function SolanaProviders({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => {
    const override = import.meta.env.VITE_RPC_URL as string | undefined;
    if (override && override.trim().length > 0) return override;
    return clusterApiUrl('devnet');
  }, []);
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

const PRIVY_APP_ID = (import.meta.env.VITE_PRIVY_APP_ID as string | undefined) || '';

function PrivyOrPassthrough({ children }: { children: React.ReactNode }) {
  if (!PRIVY_APP_ID) {
    console.warn('[AURA] VITE_PRIVY_APP_ID is missing — Privy email login disabled.');
    return <>{children}</>;
  }
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // Only enable methods that are turned on in the Privy Dashboard.
        // Currently only `email` is enabled there.
        loginMethods: ['email'],
        appearance: {
          theme: 'light',
          accentColor: '#14C8A8',
          walletChainType: 'solana-only',
        },
        embeddedWallets: {
          solana: { createOnLogin: 'users-without-wallets' },
          ethereum: { createOnLogin: 'off' },
          showWalletUIs: true,
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}

trace('main.tsx:14 about to render')
try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <TopLevelBoundary>
        <PrivyOrPassthrough>
          <SolanaProviders>
            <App />
          </SolanaProviders>
        </PrivyOrPassthrough>
      </TopLevelBoundary>
    </StrictMode>,
  )
  trace('main.tsx:15 render() returned')
  // Flip the boot flag on the next animation frame, after React has
  // committed. Subsequent uncaught errors go through Sentry + React
  // boundaries instead of replacing #root with the red debug pre.
  requestAnimationFrame(() => {
    ;(window as any).__auraBooted = true
  })
} catch (e: any) {
  document.getElementById('root')!.innerHTML = '<pre style="padding:20px;color:#c00">[render throw] ' + e.message + '\n' + e.stack + '\n\nTRACE:\n' + (window as any).__auraTrace.join('\n') + '</pre>'
}
