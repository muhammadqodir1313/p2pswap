-- 1. No admin role from public signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, first_name, last_name, peercoins, week_start, weekly_points_used)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name',''),
    coalesce(new.raw_user_meta_data ->> 'last_name',''),
    0,
    current_date,
    0
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user'::public.app_role)
  on conflict do nothing;

  return new;
end;
$function$;

-- 2. refresh_weekly_points may only target the caller (or an admin's audit read)
create or replace function public.refresh_weekly_points(_user_id uuid)
returns table(week_start date, used integer, allowance integer, plan text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  p public.profiles%rowtype;
  periods integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if _user_id <> auth.uid() and not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Not allowed';
  end if;

  select * into p from public.profiles where id = _user_id;
  if not found then
    raise exception 'Profile not found';
  end if;

  periods := floor((current_date - p.week_start) / 7);
  if periods > 0 then
    update public.profiles
      set week_start = p.week_start + (periods * 7),
          weekly_points_used = 0
      where id = _user_id
      returning * into p;
  end if;

  week_start := p.week_start;
  used := p.weekly_points_used;
  allowance := public.weekly_allowance_for(p.plan);
  plan := p.plan;
  return next;
end;
$function$;

-- 3. Admin-only activation toggle (replaces direct is_active writes)
create or replace function public.set_profile_active(_user_id uuid, _active boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Not allowed';
  end if;
  update public.profiles set is_active = _active where id = _user_id;
end;
$function$;

revoke all on function public.set_profile_active(uuid, boolean) from public, anon;
grant execute on function public.set_profile_active(uuid, boolean) to authenticated;

-- 4. Column-level privileges: users may only read directory columns and write safe ones
revoke select, update on public.profiles from authenticated;
grant select (id, first_name, last_name, bio, avatar_url, is_active, is_demo, created_at)
  on public.profiles to authenticated;
grant update (first_name, last_name, bio, avatar_url, plan)
  on public.profiles to authenticated;
grant insert on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- 5. Directory visibility (column grants keep sensitive fields out of reach)
drop policy if exists "read directory profiles" on public.profiles;
create policy "read directory profiles" on public.profiles
  for select to authenticated using (true);

drop policy if exists "read skills for directory" on public.user_skills;
create policy "read skills for directory" on public.user_skills
  for select to authenticated using (true);

-- 6. View runs with the querying user's permissions and RLS
alter view public.peer_directory set (security_invoker = on);