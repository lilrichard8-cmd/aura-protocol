-- AURA DM — server-side read RPCs (hackathon)
-- These let the anon-key client read its own threads/messages without
-- needing a wallet-bound JWT (which we don't issue yet). The functions
-- are SECURITY DEFINER and validate participation explicitly.
-- Replace with proper RLS once we wire wallet-signed JWTs.

-- =====================================================================
-- 1. List threads where my_wallet participates, newest activity first
-- =====================================================================
create or replace function public.dm_list_threads(my_wallet text)
returns setof public.dm_threads
language sql
security definer
set search_path = public
as $$
  select *
    from public.dm_threads
   where my_wallet = any(participants)
   order by last_msg_at desc nulls last;
$$;

-- =====================================================================
-- 2. List messages in a thread, only if my_wallet participates
-- =====================================================================
create or replace function public.dm_list_messages(thread uuid, my_wallet text, lim integer default 200)
returns setof public.dm_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  is_member boolean;
begin
  select my_wallet = any(participants) into is_member
    from public.dm_threads
   where id = thread;
  if not coalesce(is_member, false) then
    raise exception 'not a participant of thread %', thread;
  end if;
  return query
    select * from public.dm_messages
     where thread_id = thread
     order by created_at asc
     limit lim;
end;
$$;

-- =====================================================================
-- 3. Count unread messages addressed to my_wallet
-- =====================================================================
create or replace function public.dm_unread_count(my_wallet text)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::int
    from public.dm_messages
   where to_wallet = my_wallet
     and read_at is null;
$$;

-- =====================================================================
-- 4. Grant exec on these RPCs to anon (RLS already protects raw tables)
-- =====================================================================
grant execute on function public.dm_list_threads(text) to anon, authenticated;
grant execute on function public.dm_list_messages(uuid, text, integer) to anon, authenticated;
grant execute on function public.dm_unread_count(text) to anon, authenticated;
grant execute on function public.dm_send(text, text, text, text) to anon, authenticated;
grant execute on function public.dm_mark_read(text, text) to anon, authenticated;
grant execute on function public.dm_get_or_create_thread(text, text) to anon, authenticated;
