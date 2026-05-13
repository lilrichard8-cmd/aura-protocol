-- AURA Wallet Auth Sessions + RPC lockdown
-- Created: 2026-05-13
-- Purpose: Move all write operations behind a wallet-signed session
--          token. The Supabase anon key is public, so SECURITY DEFINER
--          RPCs that trust client-supplied wallet parameters were
--          letting anyone forge DMs and follows on anyone's behalf.
--
-- After this migration:
--   • wallet_sessions table holds short-lived tokens.
--   • wallet_auth_nonces guarantees one-shot signature nonces.
--   • Write RPCs (dm_send, dm_mark_read, follow_wallet, unfollow_wallet)
--     are REVOKEd from anon/authenticated — only service_role (used by
--     the Edge Functions) can call them.
--   • Read RPCs stay open: DM history is hackathon-scope and follow
--     graph is public anyway.
--
-- Rollback plan: see 004_rollback.sql.

-- =====================================================================
-- 1. wallet_sessions — opaque 1h tokens issued by the wallet-auth fn
-- =====================================================================
create table if not exists public.wallet_sessions (
  token text primary key,
  wallet text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists wallet_sessions_wallet_idx
  on public.wallet_sessions (wallet);
create index if not exists wallet_sessions_expires_idx
  on public.wallet_sessions (expires_at);

alter table public.wallet_sessions enable row level security;
-- No policies => anon/authenticated cannot read or write. Only the
-- Edge Functions (service_role) touch this table.

-- =====================================================================
-- 2. wallet_auth_nonces — one-shot nonces for login signatures
-- =====================================================================
create table if not exists public.wallet_auth_nonces (
  nonce text primary key,
  consumed_at timestamptz not null default now()
);

create index if not exists wallet_auth_nonces_consumed_idx
  on public.wallet_auth_nonces (consumed_at);

alter table public.wallet_auth_nonces enable row level security;
-- Service-role only.

-- =====================================================================
-- 3. Periodic cleanup helper (call from a cron or once a day)
-- =====================================================================
create or replace function public.wallet_auth_sweep()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.wallet_sessions     where expires_at < now() - interval '1 hour';
  delete from public.wallet_auth_nonces  where consumed_at < now() - interval '24 hours';
$$;
revoke all on function public.wallet_auth_sweep() from public;
grant execute on function public.wallet_auth_sweep() to service_role;

-- =====================================================================
-- 4. Lock down write RPCs — only service_role may call them.
--    Edge Functions (dm-send, dm-mark-read, follow, unfollow) use the
--    service-role key after verifying the caller's wallet signature.
-- =====================================================================
revoke execute on function public.dm_send(text, text, text, text)             from anon, authenticated;
revoke execute on function public.dm_mark_read(text, text)                    from anon, authenticated;
revoke execute on function public.follow_wallet(text, text, text, text, text) from anon, authenticated;
revoke execute on function public.unfollow_wallet(text, text)                 from anon, authenticated;

grant execute on function public.dm_send(text, text, text, text)             to service_role;
grant execute on function public.dm_mark_read(text, text)                    to service_role;
grant execute on function public.dm_get_or_create_thread(text, text)         to service_role;
grant execute on function public.follow_wallet(text, text, text, text, text) to service_role;
grant execute on function public.unfollow_wallet(text, text)                 to service_role;

-- dm_get_or_create_thread stays callable by anon for now: it only
-- creates an empty thread shell (no message content) and the existing
-- frontend depends on it for the "start a new chat" UX. Worst case an
-- attacker can spam empty thread rows for arbitrary wallet pairs; track
-- that in TODO and harden in migration 005.

-- Read RPCs remain open to anon — they leak only metadata we accept
-- as public for hackathon scope. Production wallet-JWT migration
-- (planned: 005_wallet_jwt.sql) will replace `my_wallet` parameter
-- with `auth.jwt() ->> 'wallet'` everywhere.

comment on table public.wallet_sessions is
  'Edge-Function-managed wallet session tokens. service_role only.';
comment on table public.wallet_auth_nonces is
  'One-shot nonces for wallet-auth signatures. service_role only.';
