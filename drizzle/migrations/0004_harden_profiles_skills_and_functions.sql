-- 1. Public-safe peer directory view (no balances, plan, or weekly usage)
create or replace view public.peer_directory
with (security_invoker = off) as
select
  p.id,
  p.first_name,
  p.last_name,
  p.bio,
  p.avatar_url,
  p.is_active,
  p.is_demo,
  p.created_at,
  coalesce((select array_agg(s.skill order by s.skill) from public.user_skills s where s.user_id = p.id and s.kind = 'teach'), '{}'::text[]) as teach,
  coalesce((select array_agg(s.skill order by s.skill) from public.user_skills s where s.user_id = p.id and s.kind = 'learn'), '{}'::text[]) as learn
from public.profiles p;

revoke all on public.peer_directory from anon;
grant select on public.peer_directory to authenticated;
grant all on public.peer_directory to service_role;

-- 2. Restrict raw table reads to the owner (and admins)
drop policy if exists "profiles readable by authenticated" on public.profiles;
create policy "read own profile or admin"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "skills readable by authenticated" on public.user_skills;
create policy "read own skills or admin"
  on public.user_skills for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- 3. Fix mutable search_path
alter function public.weekly_allowance_for(text) set search_path = public;

-- 4. Restrict SECURITY DEFINER function execution to the roles that need it
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
revoke all on function public.refresh_weekly_points(uuid) from public, anon;
revoke all on function public.spend_peerpoint() from public, anon;
revoke all on function public.complete_session(uuid) from public, anon;
revoke all on function public.weekly_allowance_for(text) from public, anon;

grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.refresh_weekly_points(uuid) to authenticated;
grant execute on function public.spend_peerpoint() to authenticated;
grant execute on function public.complete_session(uuid) to authenticated;
grant execute on function public.weekly_allowance_for(text) to authenticated;