/**
 * Direct-message API.
 *
 * Reads (list threads, list messages, unread count, get-or-create
 * thread) still go through the SECURITY DEFINER Postgres RPCs from
 * `001_dm_schema.sql` / `002_dm_read_rpcs.sql`. These accept a
 * `my_wallet` parameter and trust it — that's a known weakness for
 * reads but information leakage is limited to "who chatted with whom".
 * Production fix is migration `004_dm_security.sql` which makes the
 * RPCs require an `auth.jwt() -> 'wallet'` claim.
 *
 * Writes (send, mark-read) now go through Edge Functions which require
 * a wallet session token (see lib/wallet-auth.ts). The Edge Function
 * verifies the token's wallet matches the wallet being written as.
 *
 * Realtime subscriptions still use the anon key directly; RLS policies
 * filter by JWT (which we'll wire when Supabase auth.signInWithCustomToken
 * is set up against the wallet-auth function output).
 */
import { supabase, SUPABASE_CONFIGURED } from './supabase';
import { loadSession } from './wallet-auth';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Types (mirror the SQL schema) ──────────────────────────────────
export interface DmMessage {
  id: string;
  thread_id: string;
  from_wallet: string;
  to_wallet: string;
  content: string;
  kind: 'text' | string;
  created_at: string;
  read_at: string | null;
}

export interface DmThread {
  id: string;
  participants: [string, string];
  last_msg_preview: string | null;
  last_msg_at: string | null;
  created_at: string;
}

// ─── Helpers ────────────────────────────────────────────────────────
function ensureConfigured() {
  if (!SUPABASE_CONFIGURED || !supabase) {
    throw new Error('Supabase not configured — check VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
  }
  return supabase;
}

function requireSession(expectedWallet: string) {
  const s = loadSession();
  if (!s) {
    throw new Error('WALLET_SESSION_REQUIRED');
  }
  if (s.wallet !== expectedWallet) {
    throw new Error(`Session wallet ${s.wallet} does not match requested ${expectedWallet}`);
  }
  return s;
}

/** Find the *peer* wallet (the one that isn't `me`) inside a thread. */
export function peerOf(thread: DmThread, me: string): string {
  return thread.participants[0] === me ? thread.participants[1] : thread.participants[0];
}

// ─── List threads for a wallet ──────────────────────────────────────
export async function listThreads(myWallet: string): Promise<DmThread[]> {
  const sb = ensureConfigured();
  const { data, error } = await sb.rpc('dm_list_threads', { my_wallet: myWallet });
  if (error) throw error;
  return (data ?? []) as DmThread[];
}

// ─── List messages in a thread ──────────────────────────────────────
export async function listMessages(threadId: string, myWallet: string, limit = 200): Promise<DmMessage[]> {
  const sb = ensureConfigured();
  const { data, error } = await sb.rpc('dm_list_messages', {
    thread: threadId,
    my_wallet: myWallet,
    lim: limit,
  });
  if (error) throw error;
  return (data ?? []) as DmMessage[];
}

// ─── Unread count for the bell badge ────────────────────────────────
export async function unreadCount(myWallet: string): Promise<number> {
  const sb = ensureConfigured();
  const { data, error } = await sb.rpc('dm_unread_count', { my_wallet: myWallet });
  if (error) throw error;
  return (data as number) ?? 0;
}

// ─── Send a message ─────────────────────────────────────────────────
// Now routed through the dm-send Edge Function which requires a valid
// wallet session token. The function re-issues the dm_send RPC using
// service_role credentials after verifying the caller.
export async function sendMessage(args: {
  fromWallet: string;
  toWallet: string;
  content: string;
  kind?: string;
}): Promise<DmMessage> {
  const sb = ensureConfigured();
  const session = requireSession(args.fromWallet);
  const { data, error } = await sb.functions.invoke('dm-send', {
    body: {
      sessionToken: session.token,
      toWallet: args.toWallet,
      content: args.content,
      kind: args.kind ?? 'text',
    },
  });
  if (error) throw error;
  const msg = (data as { message?: DmMessage } | null)?.message;
  if (!msg) throw new Error('dm-send returned no message');
  return msg;
}

// ─── Get-or-create thread (used when starting a brand-new conversation)
// Read-style helper — still uses the public RPC. The thread row leaks no
// content, only participation, and we accept that for hackathon scope.
export async function getOrCreateThread(myWallet: string, peerWallet: string): Promise<string> {
  const sb = ensureConfigured();
  const { data, error } = await sb.rpc('dm_get_or_create_thread', {
    wallet_a: myWallet,
    wallet_b: peerWallet,
  });
  if (error) throw error;
  return data as string;
}

// ─── Mark all messages from a peer as read ──────────────────────────
// Routed through the dm-mark-read Edge Function which validates the
// caller. Without the session token the read receipts could be forged
// to manipulate UI badges across the platform.
export async function markRead(myWallet: string, peerWallet: string): Promise<number> {
  const sb = ensureConfigured();
  const session = requireSession(myWallet);
  const { data, error } = await sb.functions.invoke('dm-mark-read', {
    body: {
      sessionToken: session.token,
      peerWallet,
    },
  });
  if (error) throw error;
  const count = (data as { count?: number } | null)?.count ?? 0;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('aura:dm:read', {
      detail: { wallet: myWallet, peer: peerWallet, count },
    }));
  }
  return count;
}

// ─── Realtime subscription ──────────────────────────────────────────
/**
 * Subscribe to every DM event addressed to (or sent by) `myWallet`.
 * Each call creates a fresh channel with a unique nonce so React 19 /
 * StrictMode double-effect remounts can't collide on the same channel
 * name (which would otherwise raise "cannot add postgres_changes
 * callbacks ... after subscribe()").
 *
 * The .on() listener MUST be registered before .subscribe() — once a
 * channel is subscribed, you cannot add more callbacks to it.
 */
let channelNonce = 0;
export function subscribeMessages(
  myWallet: string,
  onInsert: (msg: DmMessage) => void,
): () => void {
  if (!SUPABASE_CONFIGURED || !supabase) {
    return () => {};
  }
  const sb = supabase;
  const channels: RealtimeChannel[] = [];
  const id = ++channelNonce;

  for (const col of ['to_wallet', 'from_wallet'] as const) {
    const channel = sb.channel(`dm-${col}-${myWallet}-${id}`);
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'dm_messages',
        filter: `${col}=eq.${myWallet}`,
      },
      (payload) => {
        onInsert(payload.new as DmMessage);
      },
    );
    channel.subscribe();
    channels.push(channel);
  }
  return () => {
    for (const ch of channels) {
      try { sb.removeChannel(ch); } catch { /* noop */ }
    }
  };
}
