-- 005_force_lockdown.sql — be paranoid about migration 004.
-- The previous REVOKE silently succeeded but a curl test against
-- dm_send via the anon key still inserted. Suspected cause: PUBLIC
-- still has EXECUTE (functions default to PUBLIC EXECUTE in Postgres).
-- This migration drops PUBLIC privilege too, then re-grants only to
-- service_role.

revoke execute on function public.dm_send(text, text, text, text)             from public, anon, authenticated;
revoke execute on function public.dm_mark_read(text, text)                    from public, anon, authenticated;
revoke execute on function public.follow_wallet(text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.unfollow_wallet(text, text)                 from public, anon, authenticated;

grant execute on function public.dm_send(text, text, text, text)             to service_role;
grant execute on function public.dm_mark_read(text, text)                    to service_role;
grant execute on function public.follow_wallet(text, text, text, text, text) to service_role;
grant execute on function public.unfollow_wallet(text, text)                 to service_role;

-- Quick verification block. Will raise if any test fails.
do $$
declare
  v_anon_dm_send bool;
  v_anon_follow bool;
begin
  v_anon_dm_send := has_function_privilege('anon', 'public.dm_send(text,text,text,text)', 'EXECUTE');
  v_anon_follow  := has_function_privilege('anon', 'public.follow_wallet(text,text,text,text,text)', 'EXECUTE');
  if v_anon_dm_send then
    raise exception 'lockdown failed: anon still has EXECUTE on dm_send';
  end if;
  if v_anon_follow then
    raise exception 'lockdown failed: anon still has EXECUTE on follow_wallet';
  end if;
end
$$;
