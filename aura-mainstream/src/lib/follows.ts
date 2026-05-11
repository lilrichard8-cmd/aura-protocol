/**
 * Wallet follow graph — Supabase-backed cross-wallet follows.
 *
 * Each follow is an edge stored in `wallet_follows`. We surface them
 * via the dedicated RPCs (`follow_wallet` / `list_followers` / etc.) so
 * the anon-key client can act without a wallet-bound JWT — RLS allows
 * SELECT only when the requesting JWT carries one of the involved
 * wallets, which we'll plug in once the wallet auth flow lands.
 */
import { supabase, SUPABASE_CONFIGURED } from './supabase';
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

export async function followWallet(args: {
  follower: string;
  followee: string;
  followerDisplayName?: string;
  followerUsername?: string;
  followerAvatar?: string;
}): Promise<WalletFollow> {
  const sb = ensureConfigured();
  const { data, error } = await sb.rpc('follow_wallet', {
    follower: args.follower,
    followee: args.followee,
    follower_display_name: args.followerDisplayName ?? null,
    follower_username: args.followerUsername ?? null,
    follower_avatar: args.followerAvatar ?? null,
  });
  if (error) throw error;
  return data as WalletFollow;
}

export async function unfollowWallet(follower: string, followee: string): Promise<number> {
  const sb = ensureConfigured();
  const { data, error } = await sb.rpc('unfollow_wallet', { follower, followee });
  if (error) throw error;
  return (data as number) ?? 0;
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
