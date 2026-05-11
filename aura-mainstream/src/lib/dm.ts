/**
 * Direct-message API — thin wrapper around the Supabase RPCs and tables.
 * All callers go through here so swapping the backend later is a
 * one-file change.
 */
import { supabase, SUPABASE_CONFIGURED } from './supabase';
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
export async function sendMessage(args: {
  fromWallet: string;
  toWallet: string;
  content: string;
  kind?: string;
}): Promise<DmMessage> {
  const sb = ensureConfigured();
  const { data, error } = await sb.rpc('dm_send', {
    from_wallet: args.fromWallet,
    to_wallet: args.toWallet,
    content: args.content,
    kind: args.kind ?? 'text',
  });
  if (error) throw error;
  return data as DmMessage;
}

// ─── Get-or-create thread (used when starting a brand-new conversation)
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
export async function markRead(myWallet: string, peerWallet: string): Promise<number> {
  const sb = ensureConfigured();
  const { data, error } = await sb.rpc('dm_mark_read', {
    viewer_wallet: myWallet,
    peer_wallet: peerWallet,
  });
  if (error) throw error;
  // Broadcast a same-tab event so listeners (e.g. SideNav unread badge)
  // can refresh immediately, without waiting for the Realtime UPDATE
  // round-trip or the polling interval.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('aura:dm:read', {
      detail: { wallet: myWallet, peer: peerWallet, count: data as number },
    }));
  }
  return (data as number) ?? 0;
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
