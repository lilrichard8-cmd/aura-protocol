-- AURA Wallet Follows
-- Cross-wallet follow graph + helper RPCs. Lets one wallet follow
-- another and have that surface as a Realtime notification on the
-- followee's frontend.

-- =====================================================================
-- 1. Follow edges
-- =====================================================================
create table if not exists public.wallet_follows (
  id uuid primary key default gen_random_uuid(),
  follower_wallet text not null,
  followee_wallet text not null,
  /** Optional snapshot of the follower's display name + avatar at the
      moment of the follow, so the followee's frontend can render a nice
      notification without needing a separate profile lookup. */
  follower_display_name text,
  follower_username text,
  follower_avatar text,
  created_at timestamptz not null default now(),
  constraint wallet_follows_distinct check (follower_wallet <> followee_wallet)
);

create unique index if not exists wallet_follows_pair_idx
  on public.wallet_follows (follower_wallet, followee_wallet);

create index if not exists wallet_follows_followee_idx
  on public.wallet_follows (followee_wallet, created_at desc);

create index if not exists wallet_follows_follower_idx
  on public.wallet_follows (follower_wallet, created_at desc);

-- =====================================================================
-- 2. RPC: follow / unfollow
-- =====================================================================
create or replace function public.follow_wallet(
  follower text,
  followee text,
  follower_display_name text default null,
  follower_username text default null,
  follower_avatar text default null
)
returns public.wallet_follows
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.wallet_follows;
begin
  if follower is null or followee is null or follower = followee then
    raise exception 'follower and followee must be distinct, non-null wallets';
  end if;
  insert into public.wallet_follows (
    follower_wallet, followee_wallet,
    follower_display_name, follower_username, follower_avatar
  )
  values (follower, followee, follower_display_name, follower_username, follower_avatar)
  on conflict (follower_wallet, followee_wallet) do update
    set follower_display_name = excluded.follower_display_name,
        follower_username = excluded.follower_username,
        follower_avatar = excluded.follower_avatar
  returning * into row;
  return row;
end;
$$;

create or replace function public.unfollow_wallet(
  follower text,
  followee text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.wallet_follows
   where follower_wallet = follower
     and followee_wallet = followee;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- =====================================================================
-- 3. RPCs: query helpers
-- =====================================================================
create or replace function public.list_followers(target text, lim integer default 200)
returns setof public.wallet_follows
language sql
security definer
set search_path = public
as $$
  select * from public.wallet_follows
   where followee_wallet = target
   order by created_at desc
   limit lim;
$$;

create or replace function public.list_following(source text, lim integer default 500)
returns setof public.wallet_follows
language sql
security definer
set search_path = public
as $$
  select * from public.wallet_follows
   where follower_wallet = source
   order by created_at desc
   limit lim;
$$;

create or replace function public.is_following(source text, target text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.wallet_follows
     where follower_wallet = source and followee_wallet = target
  );
$$;

-- =====================================================================
-- 4. Row Level Security + grants
-- =====================================================================
alter table public.wallet_follows enable row level security;

drop policy if exists wallet_follows_read_own on public.wallet_follows;
create policy wallet_follows_read_own
  on public.wallet_follows
  for select
  to authenticated
  using (
       (auth.jwt() ->> 'wallet') = follower_wallet
    or (auth.jwt() ->> 'wallet') = followee_wallet
  );

grant execute on function public.follow_wallet(text, text, text, text, text) to anon, authenticated;
grant execute on function public.unfollow_wallet(text, text) to anon, authenticated;
grant execute on function public.list_followers(text, integer) to anon, authenticated;
grant execute on function public.list_following(text, integer) to anon, authenticated;
grant execute on function public.is_following(text, text) to anon, authenticated;

-- =====================================================================
-- 5. Realtime publication
-- =====================================================================
alter publication supabase_realtime add table public.wallet_follows;
