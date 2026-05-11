-- AURA Direct Messages Schema
-- Created: 2026-05-08
-- Purpose: Wallet-to-wallet PM with Realtime subscriptions and RLS-enforced privacy.

-- =====================================================================
-- 1. Threads — one row per pair of wallets that have ever DM'd each other
-- =====================================================================
create table if not exists public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  -- Sorted array of two wallet addresses (alphabetical) so we can dedupe.
  participants text[] not null,
  last_msg_preview text,
  last_msg_at timestamptz,
  created_at timestamptz not null default now(),
  -- Enforce: exactly two participants, sorted, distinct
  constraint dm_threads_two_participants check (array_length(participants, 1) = 2),
  constraint dm_threads_distinct check (participants[1] <> participants[2]),
  constraint dm_threads_sorted check (participants[1] < participants[2])
);

create unique index if not exists dm_threads_participants_idx
  on public.dm_threads (participants);

create index if not exists dm_threads_last_msg_idx
  on public.dm_threads (last_msg_at desc nulls last);

-- =====================================================================
-- 2. Messages
-- =====================================================================
create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  from_wallet text not null,
  to_wallet text not null,
  content text not null,
  -- 'text' for now; future: 'tip', 'image', 'system'
  kind text not null default 'text',
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint dm_messages_distinct_parties check (from_wallet <> to_wallet),
  constraint dm_messages_content_nonempty check (length(content) > 0 and length(content) <= 4000)
);

create index if not exists dm_messages_thread_idx
  on public.dm_messages (thread_id, created_at desc);

create index if not exists dm_messages_to_unread_idx
  on public.dm_messages (to_wallet, created_at desc) where read_at is null;

-- =====================================================================
-- 3. Trigger: keep dm_threads.last_msg_* in sync
-- =====================================================================
create or replace function public.dm_messages_update_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.dm_threads
     set last_msg_preview = left(new.content, 200),
         last_msg_at = new.created_at
   where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists trg_dm_messages_update_thread on public.dm_messages;
create trigger trg_dm_messages_update_thread
  after insert on public.dm_messages
  for each row execute function public.dm_messages_update_thread();

-- =====================================================================
-- 4. Helper RPC: ensure thread exists between two wallets, return its id
-- =====================================================================
create or replace function public.dm_get_or_create_thread(wallet_a text, wallet_b text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  sorted text[];
  tid uuid;
begin
  if wallet_a is null or wallet_b is null or wallet_a = wallet_b then
    raise exception 'wallets must be distinct and non-null';
  end if;
  -- Sort alphabetically so A↔B and B↔A map to the same row.
  if wallet_a < wallet_b then
    sorted := array[wallet_a, wallet_b];
  else
    sorted := array[wallet_b, wallet_a];
  end if;

  select id into tid from public.dm_threads where participants = sorted;
  if tid is null then
    insert into public.dm_threads (participants) values (sorted) returning id into tid;
  end if;
  return tid;
end;
$$;

-- =====================================================================
-- 5. Helper RPC: send a message + create thread if needed (single round-trip)
-- =====================================================================
create or replace function public.dm_send(
  from_wallet text,
  to_wallet text,
  content text,
  kind text default 'text'
)
returns public.dm_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
  msg public.dm_messages;
begin
  if from_wallet is null or to_wallet is null then
    raise exception 'wallet addresses required';
  end if;
  tid := public.dm_get_or_create_thread(from_wallet, to_wallet);
  insert into public.dm_messages (thread_id, from_wallet, to_wallet, content, kind)
       values (tid, from_wallet, to_wallet, content, coalesce(kind, 'text'))
    returning * into msg;
  return msg;
end;
$$;

-- =====================================================================
-- 6. Helper RPC: mark all messages from a wallet as read
-- =====================================================================
create or replace function public.dm_mark_read(viewer_wallet text, peer_wallet text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  with updated as (
    update public.dm_messages
       set read_at = now()
     where to_wallet = viewer_wallet
       and from_wallet = peer_wallet
       and read_at is null
    returning 1
  )
  select count(*) into updated_count from updated;
  return updated_count;
end;
$$;

-- =====================================================================
-- 7. Row Level Security
-- =====================================================================
-- For the hackathon we use a simple model: anon clients can only insert/select
-- messages for which they prove ownership of the wallet via a separate auth
-- exchange (issued JWT with wallet_address claim). Until that's wired we keep
-- RLS enabled but expose access through SECURITY DEFINER RPCs above, which
-- run with the service role and check the from_wallet matches the
-- authenticated wallet on the application layer.
--
-- This means:
--   • Direct table reads/writes from anon are blocked (RLS deny-all)
--   • Clients call dm_send / dm_mark_read / dm_get_or_create_thread RPCs
--   • Server (Edge Function) verifies wallet ownership before invoking RPCs
--
-- Realtime subscriptions are filtered by a server-issued JWT containing
-- the user's wallet_address so users only see their own threads.

alter table public.dm_threads  enable row level security;
alter table public.dm_messages enable row level security;

-- Default deny-all (no policies = no access for anon/authenticated roles).

-- Realtime selectability: allow authenticated users to read their own rows.
-- We treat the JWT's "wallet" claim as the source of truth.
drop policy if exists dm_threads_read_own  on public.dm_threads;
drop policy if exists dm_messages_read_own on public.dm_messages;

create policy dm_threads_read_own
  on public.dm_threads
  for select
  to authenticated
  using ((auth.jwt() ->> 'wallet') = any(participants));

create policy dm_messages_read_own
  on public.dm_messages
  for select
  to authenticated
  using (
       (auth.jwt() ->> 'wallet') = from_wallet
    or (auth.jwt() ->> 'wallet') = to_wallet
  );

-- =====================================================================
-- 8. Realtime publication
-- =====================================================================
-- Add tables to the supabase_realtime publication so clients can subscribe.
alter publication supabase_realtime add table public.dm_messages;
alter publication supabase_realtime add table public.dm_threads;

-- =====================================================================
-- Done. Test with:
--   select public.dm_send('walletA', 'walletB', 'hello');
--   select * from public.dm_messages order by created_at desc limit 5;
-- =====================================================================
