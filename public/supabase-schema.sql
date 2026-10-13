-- roles
create type public.app_role as enum ('admin','user');

create table public.profiles (
  id uuid primary key,
  first_name text not null default '',
  last_name text not null default '',
  bio text not null default '',
  avatar_url text,
  peercoins integer not null default 0,
  is_active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create table public.user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  skill text not null,
  kind text not null check (kind in ('teach','learn')),
  created_at timestamptz not null default now(),
  unique (user_id, skill, kind)
);
grant select, insert, delete on public.user_skills to authenticated;
grant all on public.user_skills to service_role;
alter table public.user_skills enable row level security;

create table public.swap_sessions (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  partner_id uuid not null references public.profiles(id) on delete cascade,
  requester_teaches text not null default '',
  partner_teaches text not null default '',
  status text not null default 'pending' check (status in ('pending','accepted','completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
grant select, insert, update on public.swap_sessions to authenticated;
grant all on public.swap_sessions to service_role;
alter table public.swap_sessions enable row level security;

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.swap_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  unique (session_id, user_id)
);
grant select, insert on public.feedback to authenticated;
grant all on public.feedback to service_role;
alter table public.feedback enable row level security;

create table public.peercoin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert on public.peercoin_transactions to authenticated;
grant all on public.peercoin_transactions to service_role;
alter table public.peercoin_transactions enable row level security;

-- policies
create policy "profiles readable by authenticated" on public.profiles for select to authenticated using (true);
create policy "insert own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "admins update any profile" on public.profiles for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create policy "skills readable by authenticated" on public.user_skills for select to authenticated using (true);
create policy "insert own skills" on public.user_skills for insert to authenticated with check (user_id = auth.uid());
create policy "delete own skills" on public.user_skills for delete to authenticated using (user_id = auth.uid());

create policy "read own sessions" on public.swap_sessions for select to authenticated
  using (requester_id = auth.uid() or partner_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "create sessions as requester" on public.swap_sessions for insert to authenticated with check (requester_id = auth.uid());
create policy "update involved sessions" on public.swap_sessions for update to authenticated
  using (requester_id = auth.uid() or partner_id = auth.uid()) with check (requester_id = auth.uid() or partner_id = auth.uid());

create policy "read own feedback" on public.feedback for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "insert own feedback" on public.feedback for insert to authenticated with check (user_id = auth.uid());

create policy "read own coins" on public.peercoin_transactions for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "insert own coins" on public.peercoin_transactions for insert to authenticated with check (user_id = auth.uid());

-- new user handling
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, last_name, peercoins)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name',''),
    coalesce(new.raw_user_meta_data ->> 'last_name',''),
    20
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, case when new.email = 'admin@peerswap.demo' then 'admin'::public.app_role else 'user'::public.app_role end)
  on conflict do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- demo data
insert into public.profiles (id, first_name, last_name, bio, peercoins, is_demo) values
  ('11111111-1111-4111-8111-111111111111','Muhammadqodir','Rustamov','Frontend enthusiast building clean interfaces.',120,true),
  ('22222222-2222-4222-8222-222222222222','Ali','Karimov','Backend developer who loves databases.',80,true),
  ('33333333-3333-4333-8333-333333333333','Sardor','Yusupov','Product designer focused on simple UX.',60,true),
  ('44444444-4444-4444-8444-444444444444','Aziza','Nazarova','English teacher and IELTS coach.',40,true),
  ('55555555-5555-4555-8555-555555555555','Bekzod','Tursunov','Data analyst turning numbers into stories.',90,true);

insert into public.user_skills (user_id, skill, kind) values
  ('11111111-1111-4111-8111-111111111111','HTML','teach'),
  ('11111111-1111-4111-8111-111111111111','CSS','teach'),
  ('11111111-1111-4111-8111-111111111111','React','teach'),
  ('11111111-1111-4111-8111-111111111111','SQL','learn'),
  ('11111111-1111-4111-8111-111111111111','Python','learn'),
  ('22222222-2222-4222-8222-222222222222','SQL','teach'),
  ('22222222-2222-4222-8222-222222222222','Python','teach'),
  ('22222222-2222-4222-8222-222222222222','HTML','learn'),
  ('22222222-2222-4222-8222-222222222222','React','learn'),
  ('33333333-3333-4333-8333-333333333333','UI/UX','teach'),
  ('33333333-3333-4333-8333-333333333333','Figma','teach'),
  ('33333333-3333-4333-8333-333333333333','React','learn'),
  ('44444444-4444-4444-8444-444444444444','English','teach'),
  ('44444444-4444-4444-8444-444444444444','IELTS','teach'),
  ('44444444-4444-4444-8444-444444444444','Python','learn'),
  ('55555555-5555-4555-8555-555555555555','Python','teach'),
  ('55555555-5555-4555-8555-555555555555','Data Analysis','teach'),
  ('55555555-5555-4555-8555-555555555555','UI/UX','learn');
create or replace function public.complete_session(_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.swap_sessions%rowtype;
begin
  select * into s from public.swap_sessions where id = _session_id;
  if not found then
    raise exception 'Session not found';
  end if;
  if auth.uid() is null or (auth.uid() <> s.requester_id and auth.uid() <> s.partner_id) then
    raise exception 'Not allowed';
  end if;
  if s.status = 'completed' then
    return;
  end if;

  update public.swap_sessions
    set status = 'completed', completed_at = now()
    where id = _session_id;

  update public.profiles set peercoins = peercoins + 10 where id in (s.requester_id, s.partner_id);

  insert into public.peercoin_transactions (user_id, amount, reason)
  values (s.requester_id, 10, 'Completed teaching session'),
         (s.partner_id, 10, 'Completed teaching session');
end;
$$;

grant execute on function public.complete_session(uuid) to authenticated;ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS week_start date NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS weekly_points_used integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles ALTER COLUMN peercoins SET DEFAULT 0;

CREATE OR REPLACE FUNCTION public.refresh_weekly_points(_user_id uuid)
RETURNS TABLE(week_start date, used integer, allowance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  p public.profiles%rowtype;
  periods integer;
begin
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
  allowance := 3;
  return next;
end;
$$;

CREATE OR REPLACE FUNCTION public.spend_peerpoint()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  uid uuid := auth.uid();
  cur record;
  remaining integer;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into cur from public.refresh_weekly_points(uid);

  if cur.used >= cur.allowance then
    raise exception 'Weekly PeerPoint limit reached';
  end if;

  update public.profiles
    set weekly_points_used = weekly_points_used + 1
    where id = uid
    returning (3 - weekly_points_used) into remaining;

  insert into public.peercoin_transactions (user_id, amount, reason)
  values (uid, -1, 'Swap request');

  return remaining;
end;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  values (new.id, case when new.email = 'admin@peerswap.demo' then 'admin'::public.app_role else 'user'::public.app_role end)
  on conflict do nothing;

  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.complete_session(_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  s public.swap_sessions%rowtype;
begin
  select * into s from public.swap_sessions where id = _session_id;
  if not found then
    raise exception 'Session not found';
  end if;
  if auth.uid() is null or (auth.uid() <> s.requester_id and auth.uid() <> s.partner_id) then
    raise exception 'Not allowed';
  end if;
  if s.status = 'completed' then
    return;
  end if;

  update public.swap_sessions
    set status = 'completed', completed_at = now()
    where id = _session_id;
end;
$$;ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('free', 'premium', 'pro')) NOT VALID;

-- Weekly allowance per plan. NULL allowance = unlimited (pro).
CREATE OR REPLACE FUNCTION public.weekly_allowance_for(_plan text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  select case _plan
    when 'premium' then 15
    when 'pro' then null
    else 3
  end
$$;

DROP FUNCTION IF EXISTS public.refresh_weekly_points(uuid);

CREATE FUNCTION public.refresh_weekly_points(_user_id uuid)
RETURNS TABLE(week_start date, used integer, allowance integer, plan text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  p public.profiles%rowtype;
  periods integer;
begin
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
$$;

CREATE OR REPLACE FUNCTION public.spend_peerpoint()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  uid uuid := auth.uid();
  cur record;
  new_used integer;
  remaining integer;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into cur from public.refresh_weekly_points(uid);

  -- NULL allowance means the plan is unlimited (pro): never block.
  if cur.allowance is not null and cur.used >= cur.allowance then
    raise exception 'Weekly PeerPoint limit reached';
  end if;

  update public.profiles
    set weekly_points_used = weekly_points_used + 1
    where id = uid
    returning weekly_points_used into new_used;

  remaining := case when cur.allowance is null then -1 else cur.allowance - new_used end;

  insert into public.peercoin_transactions (user_id, amount, reason)
  values (uid, -1, 'Swap request');

  return remaining;
end;
$$;-- 1. Public-safe peer directory view (no balances, plan, or weekly usage)
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
grant execute on function public.weekly_allowance_for(text) to authenticated;-- 1. No admin role from public signup
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
alter view public.peer_directory set (security_invoker = on);CREATE TABLE public.ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  need text NOT NULL,
  quality text NOT NULL DEFAULT 'balanced',
  note text NOT NULL DEFAULT '',
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_recommendations_created_at_idx ON public.ai_recommendations (created_at DESC);
CREATE INDEX ai_recommendations_user_id_idx ON public.ai_recommendations (user_id);

GRANT SELECT, INSERT ON public.ai_recommendations TO authenticated;
GRANT ALL ON public.ai_recommendations TO service_role;

ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insert own ai recommendations" ON public.ai_recommendations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "read own ai recommendations or admin" ON public.ai_recommendations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TABLE public.calendar_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'teach',
  skill text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  is_online boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open',
  peerpoint_cost integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_slots_kind_check CHECK (kind IN ('teach','learn','personal')),
  CONSTRAINT calendar_slots_status_check CHECK (status IN ('open','requested','confirmed','in_progress','completed','cancelled'))
);

CREATE INDEX calendar_slots_starts_at_idx ON public.calendar_slots (starts_at);
CREATE INDEX calendar_slots_owner_idx ON public.calendar_slots (owner_id);
CREATE INDEX calendar_slots_partner_idx ON public.calendar_slots (partner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_slots TO authenticated;
GRANT ALL ON public.calendar_slots TO service_role;

ALTER TABLE public.calendar_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read shared calendar" ON public.calendar_slots
  FOR SELECT TO authenticated
  USING (kind <> 'personal' OR owner_id = auth.uid());

CREATE POLICY "insert own slots" ON public.calendar_slots
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "update own slots" ON public.calendar_slots
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "delete own slots" ON public.calendar_slots
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() AND status IN ('open','cancelled'));

CREATE OR REPLACE FUNCTION public.join_calendar_slot(_slot_id uuid)
RETURNS public.calendar_slots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _slot public.calendar_slots;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _slot FROM public.calendar_slots WHERE id = _slot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Slot not found'; END IF;
  IF _slot.kind = 'personal' THEN RAISE EXCEPTION 'Personal slot cannot be joined'; END IF;
  IF _slot.status <> 'open' OR _slot.partner_id IS NOT NULL THEN RAISE EXCEPTION 'Slot is not open'; END IF;
  IF _slot.owner_id = _uid THEN RAISE EXCEPTION 'Cannot join your own slot'; END IF;

  UPDATE public.calendar_slots
     SET partner_id = _uid, status = 'confirmed'
   WHERE id = _slot_id
  RETURNING * INTO _slot;

  RETURN _slot;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_calendar_slot_status(_slot_id uuid, _status text)
RETURNS public.calendar_slots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _slot public.calendar_slots;
  _teacher uuid;
  _learner uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _status NOT IN ('open','requested','confirmed','in_progress','completed','cancelled') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT * INTO _slot FROM public.calendar_slots WHERE id = _slot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Slot not found'; END IF;
  IF _uid <> _slot.owner_id AND (_slot.partner_id IS NULL OR _uid <> _slot.partner_id) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF _slot.status = 'completed' THEN RAISE EXCEPTION 'Session already completed'; END IF;

  IF _status = 'completed' AND _slot.kind <> 'personal' AND _slot.partner_id IS NOT NULL THEN
    IF _slot.kind = 'teach' THEN
      _teacher := _slot.owner_id; _learner := _slot.partner_id;
    ELSE
      _teacher := _slot.partner_id; _learner := _slot.owner_id;
    END IF;

    UPDATE public.profiles SET peercoins = peercoins - _slot.peerpoint_cost WHERE id = _learner;
    UPDATE public.profiles SET peercoins = peercoins + _slot.peerpoint_cost WHERE id = _teacher;

    INSERT INTO public.peercoin_transactions (user_id, amount, reason)
    VALUES (_learner, -_slot.peerpoint_cost, 'Calendar session: ' || _slot.skill),
           (_teacher, _slot.peerpoint_cost, 'Calendar session: ' || _slot.skill);
  END IF;

  UPDATE public.calendar_slots SET status = _status WHERE id = _slot_id RETURNING * INTO _slot;
  RETURN _slot;
END;
$$;

REVOKE ALL ON FUNCTION public.join_calendar_slot(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_calendar_slot_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_calendar_slot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_calendar_slot_status(uuid, text) TO authenticated;
CREATE OR REPLACE FUNCTION public.enforce_slot_duration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _plan text; _mins int;
BEGIN
  IF NEW.kind = 'personal' THEN RETURN NEW; END IF;
  _mins := round(extract(epoch FROM (NEW.ends_at - NEW.starts_at)) / 60);
  SELECT plan INTO _plan FROM public.profiles WHERE id = NEW.owner_id;
  IF coalesce(_plan, 'free') = 'free' AND _mins > 30 THEN
    RAISE EXCEPTION 'Bepul tarifda faqat 30 daqiqalik mashg‘ulotlar mavjud. 45 va 60 daqiqa uchun obuna bo‘ling.';
  END IF;
  IF _mins > 60 THEN
    RAISE EXCEPTION 'Mashg‘ulot 60 daqiqadan oshmasligi kerak.';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enforce_slot_duration() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER calendar_slots_duration_check
BEFORE INSERT OR UPDATE OF starts_at, ends_at, kind ON public.calendar_slots
FOR EACH ROW EXECUTE FUNCTION public.enforce_slot_duration();ALTER TABLE public.calendar_slots
  ADD COLUMN IF NOT EXISTS owner_done boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS partner_done boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "update own slots" ON public.calendar_slots;
CREATE POLICY "update own open slots" ON public.calendar_slots
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND status = 'open' AND partner_id IS NULL)
  WITH CHECK (owner_id = auth.uid() AND status = 'open' AND partner_id IS NULL);

CREATE OR REPLACE FUNCTION public.set_calendar_slot_status(_slot_id uuid, _status text)
 RETURNS calendar_slots LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _slot public.calendar_slots;
  _teacher uuid; _learner uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _status NOT IN ('in_progress','completed','cancelled') THEN
    RAISE EXCEPTION 'Bu holatni qo‘lda o‘rnatib bo‘lmaydi';
  END IF;
  SELECT * INTO _slot FROM public.calendar_slots WHERE id = _slot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Slot topilmadi'; END IF;
  IF _uid <> _slot.owner_id AND (_slot.partner_id IS NULL OR _uid <> _slot.partner_id) THEN
    RAISE EXCEPTION 'Ruxsat yo‘q';
  END IF;
  IF _slot.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'Mashg‘ulot allaqachon yopilgan'; END IF;

  IF _status = 'cancelled' THEN
    IF now() >= _slot.starts_at THEN RAISE EXCEPTION 'Boshlangan mashg‘ulotni bekor qilib bo‘lmaydi'; END IF;
    UPDATE public.calendar_slots SET status = 'cancelled' WHERE id = _slot_id RETURNING * INTO _slot;
    RETURN _slot;
  END IF;

  IF _slot.kind = 'personal' THEN
    UPDATE public.calendar_slots SET status = _status WHERE id = _slot_id RETURNING * INTO _slot;
    RETURN _slot;
  END IF;

  IF _slot.partner_id IS NULL THEN RAISE EXCEPTION 'Hali hech kim qo‘shilmagan'; END IF;
  IF now() < _slot.starts_at THEN RAISE EXCEPTION 'Mashg‘ulot hali boshlanmagan'; END IF;

  IF _status = 'in_progress' THEN
    UPDATE public.calendar_slots SET status = 'in_progress' WHERE id = _slot_id RETURNING * INTO _slot;
    RETURN _slot;
  END IF;

  -- completed: each participant confirms; coins move only when both confirmed
  IF _uid = _slot.owner_id THEN
    UPDATE public.calendar_slots SET owner_done = true, status = 'in_progress' WHERE id = _slot_id RETURNING * INTO _slot;
  ELSE
    UPDATE public.calendar_slots SET partner_done = true, status = 'in_progress' WHERE id = _slot_id RETURNING * INTO _slot;
  END IF;

  IF _slot.owner_done AND _slot.partner_done THEN
    IF _slot.kind = 'teach' THEN _teacher := _slot.owner_id; _learner := _slot.partner_id;
    ELSE _teacher := _slot.partner_id; _learner := _slot.owner_id; END IF;
    UPDATE public.profiles SET peercoins = peercoins - _slot.peerpoint_cost WHERE id = _learner;
    UPDATE public.profiles SET peercoins = peercoins + _slot.peerpoint_cost WHERE id = _teacher;
    INSERT INTO public.peercoin_transactions (user_id, amount, reason)
    VALUES (_learner, -_slot.peerpoint_cost, 'Calendar session: ' || _slot.skill),
           (_teacher, _slot.peerpoint_cost, 'Calendar session: ' || _slot.skill);
    UPDATE public.calendar_slots SET status = 'completed' WHERE id = _slot_id RETURNING * INTO _slot;
  END IF;
  RETURN _slot;
END;
$function$;