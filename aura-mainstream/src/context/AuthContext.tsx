import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import type { WalletName } from '@solana/wallet-adapter-base';
import { currentUser } from '@/data/mock';
import { useMockChain, JUDGE_DEMO_STATE, NEW_ACCOUNT_STARTER_STATE } from '@/context/MockChainContext';
import type { User } from '@/types';
import { supabase, SUPABASE_CONFIGURED } from '@/lib/supabase';
import {
  b58encode,
  buildLoginMessage,
  clearSession,
  saveSession,
} from '@/lib/wallet-auth';

// Pre-configured judge account for hackathon evaluators
// Note: hasCreatorCoin starts false — evaluator gets to walk through the mint flow.
const judgeUser: User = {
  id: 'judge',
  username: 'colosseum_judge',
  displayName: 'Colosseum Judge',
  // 2026-05-11 R23: pixel-flame portrait by Søren — the unofficial "burnt-out
  // platform creator" mascot. Lives in /public/judge-avatar.jpg.
  avatar: '/judge-avatar.jpg',
  bio: 'Hackathon evaluator exploring the AURA creator economy.',
  followers: 100, // exactly at threshold — Mint CTA is unlocked
  following: 25,
  isVerified: true,
  // creatorCoin omitted on purpose — minted via Profile page during demo
};

export type WalletProviderName = 'phantom' | 'solflare';

export interface ConnectWalletResult {
  isFirstTime: boolean;
  /** True if we connected to a real Phantom/Solflare extension; false if we fell back to mock. */
  isReal: boolean;
  /** Real or mock public key, base58. */
  address: string;
}

export type ConnectWalletError =
  | 'not_installed'   // user has no extension
  | 'user_rejected'   // user closed Phantom popup / rejected sign
  | 'unknown';        // anything else

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  connectWallet: (provider: WalletProviderName) => Promise<ConnectWalletResult>;
  logout: () => void;
  walletAddress: string | null;
  /** Patch the current user (e.g. from onboarding form). Persists to localStorage. */
  updateProfile: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Custom error so AuthPage can show a helpful message
export class WalletConnectError extends Error {
  reason: ConnectWalletError;
  constructor(reason: ConnectWalletError, message?: string) {
    super(message || reason);
    this.name = 'WalletConnectError';
    this.reason = reason;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const mockChain = useMockChain();
  const solWallet = useWallet();
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('aura_auth');
    return saved ? JSON.parse(saved) : null;
  });

  const login = useCallback(async (email: string, password: string) => {
    await new Promise(r => setTimeout(r, 800));
    // Judge quick-access: username "123" + password "321"
    if (email === '123' && password === '321') {
      localStorage.setItem('aura_auth', JSON.stringify(judgeUser));
      // Use the same versioned storage key as MockChainContext (v3) to ensure consistent reads
      localStorage.setItem('aura_mock_chain_v9', JSON.stringify(JUDGE_DEMO_STATE));
      localStorage.removeItem('aura_mock_chain');
      localStorage.removeItem('aura_mock_chain_v2');
      localStorage.removeItem('aura_mock_chain_v3');
      localStorage.removeItem('aura_mock_chain_v4');
      localStorage.removeItem('aura_mock_chain_v5');
      localStorage.removeItem('aura_mock_chain_v6');
      localStorage.removeItem('aura_mock_chain_v7');
      localStorage.removeItem('aura_mock_chain_v8');
      setUser(judgeUser);
      // Force MockChain to reload from localStorage
      mockChain.reloadState?.();
      return;
    }
    const mockUser = { ...currentUser };
    localStorage.setItem('aura_auth', JSON.stringify(mockUser));
    setUser(mockUser);
  }, [mockChain]);

  const register = useCallback(async (email: string, _password: string, username: string) => {
    await new Promise(r => setTimeout(r, 800));
    // 2026-05-11 R20: build a fully fresh User object instead of spreading
    // `currentUser` (which carries leftover demo avatar / verified badge /
    // 12.4K followers / $AURA creator-coin). Spread caused all new accounts
    // to inherit those mock details until each field was individually
    // overwritten, which was fragile.
    const newUser: User = {
      id: `user_${Date.now().toString(36)}`,
      username,
      displayName: username,
      avatar: '', // forces UserAvatar's gradient/initial fallback
      bio: '',
      followers: 0,
      following: 0,
      isVerified: false,
      creatorCoin: undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(email ? { email } as any : {}),
    };
    // Wipe any prior mock chain state (judge demo, previous account, legacy versions),
    // then seed the new-account starter state (10 ORA welcome airdrop, not connected, empty wallet).
    const KEYS_TO_CLEAR = [
      'aura_mock_chain',
      'aura_mock_chain_v2',
      'aura_mock_chain_v3',
      'aura_mock_chain_v4',
      'aura_mock_chain_v5',
      'aura_mock_chain_v6',
      'aura_mock_chain_v7',
      'aura_mock_chain_v8',
      'aura_mock_chain_v9',
      'aura_user_posts',
      'aura_user_likes',
      'aura_user_comments',
    ];
    KEYS_TO_CLEAR.forEach(k => localStorage.removeItem(k));
    // Seed the welcome-airdrop state under the active storage key.
    // We refresh the timestamp/txHash so each new signup gets a unique-looking record.
    const starter = {
      ...NEW_ACCOUNT_STARTER_STATE,
      transactions: NEW_ACCOUNT_STARTER_STATE.transactions.map(t => ({
        ...t,
        timestamp: Date.now(),
        txHash: 'welcome' + Math.random().toString(36).slice(2, 10),
      })),
    };
    localStorage.setItem('aura_mock_chain_v9', JSON.stringify(starter));
    localStorage.setItem('aura_auth', JSON.stringify(newUser));
    setUser(newUser);
    // Force MockChainContext to re-read its (now empty) storage on next render.
    // A full reload is the cleanest way to drop the in-memory JUDGE_DEMO_STATE
    // since MockChainProvider only reads storage at mount time.
    window.location.reload();
  }, []);

  /**
   * Real wallet connect flow:
   *   1. Detect installed wallet on `window.{phantom|solflare}`
   *   2. select() the adapter and connect() — pops native extension UI
   *   3. signMessage('Welcome to AURA at <ts>') — off-chain proof of ownership
   *   4. Use the real publicKey as the user's identity
   *   5. Tell MockChain to airdrop assets to that address (only first time)
   *
   * On any failure (no extension / user rejects / sign fails), throws a
   * WalletConnectError so AuthPage can show a helpful message. We do NOT
   * silently fall back to a fake address — that would defeat the whole
   * point of "real wallet integration".
   */
  const connectWallet = useCallback(async (provider: WalletProviderName): Promise<ConnectWalletResult> => {
    // Step 1: detect extension
    const w = window as any;
    const detected =
      provider === 'phantom'
        ? !!w.phantom?.solana || !!w.solana?.isPhantom
        : !!w.solflare?.isSolflare;
    if (!detected) {
      throw new WalletConnectError('not_installed', `${provider} extension not detected`);
    }

    const walletName: WalletName = (provider === 'phantom' ? 'Phantom' : 'Solflare') as WalletName;

    try {
      // Step 2: connect to the wallet adapter directly (bypass the React-
      // state-driven select() → connect() flow which races on first click and
      // throws WalletNotSelectedError).
      const entry = solWallet.wallets.find(w => w.adapter.name === walletName);
      const adapter = entry?.adapter;
      if (!adapter) {
        throw new WalletConnectError('not_installed', `${walletName} adapter not registered`);
      }
      // Mirror selection into the React layer so downstream hooks reflect it,
      // but don't depend on the resulting state for the connect call below.
      try { solWallet.select(walletName); } catch { /* non-fatal */ }
      if (!adapter.connected) {
        await adapter.connect();
      }

      // Wait for publicKey to populate. NOTE: solWallet.publicKey is a React
      // state captured by this useCallback closure — it never updates inside
      // this function. Read the underlying adapter instance directly (mutable).
      const getPk = () =>
        adapter.publicKey ??
        solWallet.wallet?.adapter?.publicKey ??
        solWallet.publicKey ??
        (window as any).phantom?.solana?.publicKey ??
        (window as any).solflare?.publicKey ??
        null;

      let pk = getPk();
      for (let i = 0; i < 30 && !pk; i++) {
        await new Promise(r => setTimeout(r, 100));
        pk = getPk();
      }
      if (!pk) {
        throw new WalletConnectError('unknown', 'Failed to read public key after connect');
      }

      const realAddress = typeof pk === 'string' ? pk : pk.toBase58();

      // Step 3: SIWS-style sign-in. The signature both proves wallet
      // ownership AND establishes a 1-hour session token used by the DM
      // and follow Edge Functions. Without this no write to Supabase is
      // authenticated and anyone could forge messages on behalf of any
      // wallet (the public anon key is enough). If Supabase isn't
      // configured at all (pure-demo build) we fall back to a no-op
      // signature so the connect flow doesn't break.
      const signMessageFn = (adapter as any).signMessage?.bind(adapter)
        ?? solWallet.signMessage;
      if (signMessageFn) {
        try {
          if (SUPABASE_CONFIGURED && supabase) {
            const domain = typeof window !== 'undefined' ? window.location.host : 'aura.li';
            const nonce = crypto.randomUUID();
            const issuedAt = new Date().toISOString();
            const message = buildLoginMessage({ domain, wallet: realAddress, nonce, issuedAt });
            const sigBytes = await signMessageFn(new TextEncoder().encode(message));
            const signature = b58encode(sigBytes);
            const { data, error } = await supabase.functions.invoke('wallet-auth', {
              body: { wallet: realAddress, signature, nonce, issuedAt, domain },
            });
            if (error) throw error;
            const token = (data as { token?: string } | null)?.token;
            const expiresAt = (data as { expiresAt?: number } | null)?.expiresAt;
            if (token && expiresAt) {
              saveSession({ token, wallet: realAddress, expiresAt });
            } else {
              throw new Error('wallet-auth returned no token');
            }
          } else {
            // Demo build without Supabase — still prove wallet control so
            // the UX matches production.
            const msg = `Welcome to AURA\nSign this message to verify your wallet ownership.\nNo transaction, no gas.\nTimestamp: ${Date.now()}`;
            await signMessageFn(new TextEncoder().encode(msg));
          }
        } catch (signErr) {
          // User rejected the sign request — disconnect and bail
          try { await adapter.disconnect(); } catch {}
          clearSession();
          // eslint-disable-next-line no-console
          console.warn('[connectWallet] sign-in failed', signErr);
          throw new WalletConnectError('user_rejected', 'Sign-in signature declined or failed');
        }
      }

      // Step 4 + 5: airdrop into MockChain keyed by real address
      const result = await mockChain.connectWallet(realAddress);

      // Step 6: build a TRULY NEW user object — no mock followers, no mock
      // posts, no creatorCoin, no verified badge. The user goes through
      // /onboarding next to pick a username and bio.
      const truncated = `${realAddress.slice(0, 4)}...${realAddress.slice(-4)}`;
      const newUser: User = {
        id: `wallet:${realAddress}`,
        username: truncated,
        displayName: truncated,
        avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${realAddress}`,
        bio: '',
        followers: 0,
        following: 0,
        isVerified: false,
        isNewWallet: result.isFirstTime,
        walletAddress: realAddress,
      };
      localStorage.setItem('aura_auth', JSON.stringify(newUser));
      setUser(newUser);

      return {
        isFirstTime: result.isFirstTime,
        isReal: true,
        address: realAddress,
      };
    } catch (err) {
      if (err instanceof WalletConnectError) throw err;
      const e: any = err;
      // wallet-adapter throws WalletNotReadyError when extension is missing
      if (e?.name === 'WalletNotReadyError') {
        throw new WalletConnectError('not_installed', 'Wallet extension not ready');
      }
      // Phantom returns code 4001 when user clicks X on popup
      if (e?.code === 4001 || /reject/i.test(e?.message || '')) {
        throw new WalletConnectError('user_rejected', e?.message);
      }
      throw new WalletConnectError('unknown', e?.message || String(err));
    }
  }, [mockChain, solWallet]);

  const updateProfile = useCallback((patch: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      // localStorage has a ~5MB total quota and avatars uploaded as data URLs
      // can easily exceed that on their own (a 4MB JPEG ≈ 5.3MB base64).
      // We try the write, then on failure (QuotaExceededError) we strip large
      // fields one at a time so the rest of the profile still persists.
      const trySave = (toSave: User): boolean => {
        try {
          localStorage.setItem('aura_auth', JSON.stringify(toSave));
          return true;
        } catch (err) {
          return false;
        }
      };
      if (!trySave(next)) {
        // First fallback: drop the avatar (most likely culprit), keep everything else.
        // Surface a console warning so users notice their avatar didn't persist.
        // eslint-disable-next-line no-console
        console.warn('[updateProfile] localStorage quota exceeded — avatar dropped from persisted state. Use a smaller image (<2MB recommended).');
        const fallback = { ...next, avatar: prev.avatar }; // revert avatar to last persisted
        if (trySave(fallback)) {
          return fallback;
        }
        // Last resort: don't persist this update, return prev so we don't lose existing state.
        return prev;
      }
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('aura_auth');
    mockChain.disconnectWallet();
    // Wipe all on-chain mock state so the next signup/login starts genuinely fresh.
    // (disconnectWallet only resets in-memory connection — the persisted JUDGE_DEMO_STATE
    // would still rehydrate without this clear, leaking 10000 ORA into new accounts.)
    const KEYS_TO_CLEAR = [
      'aura_mock_chain',
      'aura_mock_chain_v2',
      'aura_mock_chain_v3',
      'aura_mock_chain_v4',
      'aura_mock_chain_v5',
      'aura_mock_chain_v6',
      'aura_mock_chain_v7',
      'aura_mock_chain_v8',
      'aura_mock_chain_v9',
      'aura_user_posts',
      'aura_user_likes',
      'aura_user_comments',
    ];
    KEYS_TO_CLEAR.forEach(k => localStorage.removeItem(k));
    // Wallet session token must not survive logout — otherwise the next
    // user on the same browser inherits write access to the previous wallet.
    clearSession();
    // Best-effort wallet disconnect (don't await — UX should not block on this)
    try { void solWallet.disconnect?.(); } catch {}
    setUser(null);
  }, [mockChain, solWallet]);

  return (
    <AuthContext.Provider value={{
      updateProfile,
      user,
      isAuthenticated: !!user,
      login,
      register,
      connectWallet,
      logout,
      walletAddress: solWallet.publicKey?.toBase58() ?? (mockChain.connected ? mockChain.publicKey : null),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
