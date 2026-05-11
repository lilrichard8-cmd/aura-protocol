import { StrictMode, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import { clusterApiUrl } from '@solana/web3.js'
import '@solana/wallet-adapter-react-ui/styles.css'

// ?reset=1 clears all mock state and redirects to /auth
if (new URLSearchParams(window.location.search).has('reset')) {
  localStorage.removeItem('aura_auth');
  localStorage.removeItem('aura_mock_chain');
  // Also clear seen-address fingerprints so airdrop modal re-triggers
  Object.keys(localStorage)
    .filter(k => k.startsWith('aura_seen:') || k.startsWith('aura_mock_chain'))
    .forEach(k => localStorage.removeItem(k));
  window.location.replace('/auth');
}

function SolanaProviders({ children }: { children: React.ReactNode }) {
  // Devnet RPC for Sign-In flow. We don't actually broadcast transactions —
  // we only ask the wallet to sign an off-chain welcome message — but the
  // ConnectionProvider still needs an endpoint to satisfy wallet-adapter.
  const endpoint = useMemo(() => clusterApiUrl('devnet'), []);
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SolanaProviders>
      <App />
    </SolanaProviders>
  </StrictMode>,
)

// Service worker disabled (no sw.js file)
// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker.register('/sw.js').catch(() => {});
//   });
// }
