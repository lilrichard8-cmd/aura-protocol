// Session token store backed by Postgres.
//
// `wallet_sessions` rows are created by `wallet-auth` and validated by
// every write Edge Function. We deliberately keep the table small and
// purge expired rows on lookup (lazy GC); a cron can sweep older rows
// if needed.

import { createClient } from 'jsr:@supabase/supabase-js@2';

export interface SessionRow {
  token: string;
  wallet: string;
  expires_at: string; // ISO
  created_at: string; // ISO
}

let _admin: ReturnType<typeof createClient> | null = null;
export function adminClient() {
  if (_admin) return _admin;
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}

/** Look up a session by token. Returns null if expired or missing. */
export async function verifySession(token: string): Promise<{ wallet: string } | null> {
  if (!token || typeof token !== 'string' || token.length < 16) return null;
  const sb = adminClient();
  const { data, error } = await sb
    .from('wallet_sessions')
    .select('wallet, expires_at')
    .eq('token', token)
    .maybeSingle();
  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    // lazy cleanup
    await sb.from('wallet_sessions').delete().eq('token', token);
    return null;
  }
  return { wallet: data.wallet };
}

/** Insert a new session. Returns the row. */
export async function createSession(wallet: string, ttlMs: number): Promise<SessionRow> {
  const token = crypto.randomUUID() + crypto.randomUUID(); // 72 chars opaque
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const sb = adminClient();
  const { data, error } = await sb
    .from('wallet_sessions')
    .insert({ token, wallet, expires_at: expiresAt })
    .select('token, wallet, expires_at, created_at')
    .single();
  if (error || !data) throw new Error(`createSession failed: ${error?.message ?? 'unknown'}`);
  return data as SessionRow;
}

/** Record a nonce as used so it can't be replayed. Returns true if fresh. */
export async function consumeNonce(nonce: string): Promise<boolean> {
  const sb = adminClient();
  const { error } = await sb.from('wallet_auth_nonces').insert({ nonce });
  if (error) {
    // Unique violation = already used.
    if ((error as { code?: string }).code === '23505') return false;
    throw new Error(`nonce insert failed: ${error.message}`);
  }
  return true;
}
