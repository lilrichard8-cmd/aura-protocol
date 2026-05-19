// === DIAG: trace which import is failing ===
;(window as any).__auraTrace = ['main.tsx:0 start']
const trace = (s: string) => { try { (window as any).__auraTrace.push(s); document.getElementById('root')!.innerHTML = '<pre style="padding:20px;font:monospace 14px">' + (window as any).__auraTrace.join('\n') + '</pre>' } catch {} }
trace('main.tsx:1 import polyfills')
import './polyfills'
trace('main.tsx:2 polyfills ok')

// Global error trap.
window.addEventListener('error', (e) => {
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML = `<pre style="padding:20px;color:#c00;background:#fee;font-family:monospace;white-space:pre-wrap">[window error] ${e.message}\n${e.error?.stack || ''}\n at ${e.filename}:${e.lineno}\n\nTRACE:\n${(window as any).__auraTrace.join('\n')}</pre>`
  }
})
window.addEventListener('unhandledrejection', (e) => {
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML = `<pre style="padding:20px;color:#c00;background:#fee;font-family:monospace;white-space:pre-wrap">[unhandled promise] ${e.reason?.message || e.reason}\n${e.reason?.stack || ''}\n\nTRACE:\n${(window as any).__auraTrace.join('\n')}</pre>`
  }
})

trace('main.tsx:3 before react imports')
import { StrictMode, useMemo, Component, ReactNode } from 'react'
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

// Error boundary so a child Provider crash surfaces in the DOM.
class TopLevelBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) { return { err } }
  componentDidCatch(err: Error, info: any) {
    console.error('[AURA TopLevelBoundary]', err, info)
  }
  render() {
    if (this.state.err) {
      return (
        <pre style={{ padding: 20, color: '#c00', background: '#fee', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          [react error] {this.state.err.message}{'\n'}{this.state.err.stack}
        </pre>
      )
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
} catch (e: any) {
  document.getElementById('root')!.innerHTML = '<pre style="padding:20px;color:#c00">[render throw] ' + e.message + '\n' + e.stack + '\n\nTRACE:\n' + (window as any).__auraTrace.join('\n') + '</pre>'
}
