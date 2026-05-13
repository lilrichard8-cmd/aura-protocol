/**
 * Wallet-authenticated session for AURA.
 *
 * Threat model: the Supabase anon key is public. Without proof of
 * wallet ownership anyone could call dm_send / follow_wallet / etc.
 * on someone else's behalf.
 *
 * Design (single signature, hour-long session — not per-action prompts):
 *
 *   1. User connects wallet. Frontend asks wallet to sign a
 *      domain-bound login message once. The wallet sees a SIWS-style
 *      payload (domain=aura.li, statement, nonce, issuedAt).
 *
 *   2. Frontend POSTs {wallet, signature, nonce, issuedAt} to the
 *      `wallet-auth` Edge Function. The function verifies the Ed25519
 *      signature, checks issuedAt within ±5 min, makes sure nonce
 *      hasn't been used (one-shot replay defence), and returns:
 *
 *        { token: <opaque>, wallet, expiresAt }
 *
 *   3. Frontend stores {token, wallet, expiresAt} in localStorage
 *      under `aura_wallet_session`. All write Edge Functions
 *      (dm-send, dm-mark-read, follow, unfollow) require a valid
 *      session token and check token.wallet matches the wallet being
 *      acted upon.
 *
 *   4. Session expires after 1 h. When the token returns expired the
 *      frontend transparently asks the wallet to re-sign.
 *
 * For tier-A protection (admin / large value moves) the Edge Function
 * should also reverify a fresh per-action signature. DM/follow are
 * tier-B so a session token is the right trade-off.
 */
import { useWallet } from '@solana/wallet-adapter-react';
import { useCallback, useMemo } from 'react';
import { supabase, SUPABASE_CONFIGURED } from './supabase';

export const SESSION_STORAGE_KEY = 'aura_wallet_session_v1';
export const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface WalletSession {
  /** Opaque token returned by the wallet-auth Edge Function. */
  token: string;
  /** Wallet address this session is bound to (base58). */
  wallet: string;
  /** Millisecond epoch when the session expires. */
  expiresAt: number;
}

/** Build the canonical SIWS-style login message. Server reproduces this byte-for-byte. */
export function buildLoginMessage(opts: {
  domain: string;
  wallet: string;
  nonce: string;
  issuedAt: string;
}): string {
  return [
    `${opts.domain} wants you to sign in with your Solana account:`,
    opts.wallet,
    '',
    'Welcome to AURA. This signature proves you control this wallet.',
    'No on-chain transaction, no gas. Token expires in 1 hour.',
    '',
    `URI: https://${opts.domain}`,
    'Version: 1',
    'Chain ID: solana:mainnet',
    `Nonce: ${opts.nonce}`,
    `Issued At: ${opts.issuedAt}`,
  ].join('\n');
}

/** Base58 encoder used for signature serialization. */
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function b58encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let out = '';
  for (let i = 0; i < zeros; i++) out += '1';
  for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]];
  return out;
}

// ─── Local session storage ──────────────────────────────────────────
export function loadSession(): WalletSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as WalletSession;
    if (!s.token || !s.wallet || !s.expiresAt) return null;
    if (Date.now() >= s.expiresAt - 30_000 /* skew */) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveSession(s: WalletSession): void {
  try { localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function clearSession(): void {
  try { localStorage.removeItem(SESSION_STORAGE_KEY); } catch { /* ignore */ }
}

// ─── React hook ─────────────────────────────────────────────────────
export interface WalletSessionApi {
  /** Returns the active session, refreshing it if expired and a wallet is connected. */
  ensureSession: () => Promise<WalletSession>;
  /** Force a fresh signature prompt (e.g. on explicit "re-auth" click). */
  refresh: () => Promise<WalletSession>;
  /** Drop the local token. Use on logout / wallet disconnect. */
  clear: () => void;
}

export function useWalletSession(): WalletSessionApi {
  const wallet = useWallet();

  const refresh = useCallback(async (): Promise<WalletSession> => {
    if (!SUPABASE_CONFIGURED || !supabase) {
      throw new Error('Supabase not configured');
    }
    const pk = wallet.publicKey?.toBase58();
    if (!pk) throw new Error('Wallet not connected');
    const signFn = wallet.signMessage;
    if (!signFn) throw new Error('Wallet adapter does not support signMessage');

    const domain = typeof window !== 'undefined' ? window.location.host : 'aura.li';
    const nonce = crypto.randomUUID();
    const issuedAt = new Date().toISOString();
    const message = buildLoginMessage({ domain, wallet: pk, nonce, issuedAt });

    const sigBytes = await signFn(new TextEncoder().encode(message));
    const signature = b58encode(sigBytes);

    const { data, error } = await supabase.functions.invoke('wallet-auth', {
      body: { wallet: pk, signature, nonce, issuedAt, domain },
    });
    if (error) throw error;
    const token = (data as { token?: string } | null)?.token;
    const expiresAt = (data as { expiresAt?: number } | null)?.expiresAt;
    if (!token || !expiresAt) throw new Error('Auth server returned no token');

    const session: WalletSession = { token, wallet: pk, expiresAt };
    saveSession(session);
    return session;
  }, [wallet]);

  const ensureSession = useCallback(async (): Promise<WalletSession> => {
    const existing = loadSession();
    const pk = wallet.publicKey?.toBase58();
    if (existing && pk && existing.wallet === pk) return existing;
    if (existing && pk && existing.wallet !== pk) clearSession();
    return refresh();
  }, [wallet, refresh]);

  return useMemo(() => ({ ensureSession, refresh, clear: clearSession }), [ensureSession, refresh]);
}
