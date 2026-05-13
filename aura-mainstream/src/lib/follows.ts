/**
 * Wallet follow graph — Supabase-backed cross-wallet follows.
 *
 * Reads (list_followers / list_following / is_following) stay on the
 * SECURITY DEFINER Postgres RPCs because follow relationships are
 * intentionally public on a social platform.
 *
 * Writes (follow / unfollow) now go through Edge Functions which
 * require a wallet session token (see lib/wallet-auth.ts). Without
 * this, the public anon key would let anyone forge follow edges from
 * any wallet to any wallet.
 */
import { supabase, SUPABASE_CONFIGURED } from './supabase';
import { loadSession } from './wallet-auth';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface WalletFollow {
  id: string;
  follower_wallet: string;
  followee_wallet: string;
  follower_display_name: string | null;
  follower_username: string | null;
  follower_avatar: string | null;
  created_at: string;
}

function ensureConfigured() {
  if (!SUPABASE_CONFIGURED || !supabase) {
    throw new Error('Supabase not configured for follow graph');
  }
  return supabase;
}

function requireSession(expectedWallet: string) {
  const s = loadSession();
  if (!s) throw new Error('WALLET_SESSION_REQUIRED');
  if (s.wallet !== expectedWallet) {
    throw new Error(`Session wallet ${s.wallet} does not match requested ${expectedWallet}`);
  }
  return s;
}

export async function followWallet(args: {
  follower: string;
  followee: string;
  followerDisplayName?: string;
  followerUsername?: string;
  followerAvatar?: string;
}): Promise<WalletFollow> {
  const sb = ensureConfigured();
  const session = requireSession(args.follower);
  const { data, error } = await sb.functions.invoke('follow', {
    body: {
      sessionToken: session.token,
      followee: args.followee,
      followerDisplayName: args.followerDisplayName ?? null,
      followerUsername: args.followerUsername ?? null,
      followerAvatar: args.followerAvatar ?? null,
    },
  });
  if (error) throw error;
  const row = (data as { row?: WalletFollow } | null)?.row;
  if (!row) throw new Error('follow returned no row');
  return row;
}

export async function unfollowWallet(follower: string, followee: string): Promise<number> {
  const sb = ensureConfigured();
  const session = requireSession(follower);
  const { data, error } = await sb.functions.invoke('unfollow', {
    body: { sessionToken: session.token, followee },
  });
  if (error) throw error;
  return (data as { removed?: number } | null)?.removed ?? 0;
}

export async function listFollowers(target: string, limit = 200): Promise<WalletFollow[]> {
  const sb = ensureConfigured();
  const { data, error } = await sb.rpc('list_followers', { target, lim: limit });
  if (error) throw error;
  return (data ?? []) as WalletFollow[];
}

export async function listFollowing(source: string, limit = 500): Promise<WalletFollow[]> {
  const sb = ensureConfigured();
  const { data, error } = await sb.rpc('list_following', { source, lim: limit });
  if (error) throw error;
  return (data ?? []) as WalletFollow[];
}

export async function isFollowing(source: string, target: string): Promise<boolean> {
  const sb = ensureConfigured();
  const { data, error } = await sb.rpc('is_following', { source, target });
  if (error) throw error;
  return Boolean(data);
}

/**
 * Subscribe to new followers for `myWallet`. Calls `onFollow` whenever
 * another wallet follows yours. Returns an unsubscribe function.
 */
let followChannelNonce = 0;
export function subscribeNewFollowers(
  myWallet: string,
  onFollow: (row: WalletFollow) => void,
): () => void {
  if (!SUPABASE_CONFIGURED || !supabase) return () => {};
  const sb = supabase;
  const id = ++followChannelNonce;
  const channel = sb.channel(`follow-${myWallet}-${id}`);
  channel.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'wallet_follows',
      filter: `followee_wallet=eq.${myWallet}`,
    },
    (payload) => onFollow(payload.new as WalletFollow),
  );
  channel.subscribe();
  return () => {
    try { sb.removeChannel(channel); } catch { /* noop */ }
  };
}
