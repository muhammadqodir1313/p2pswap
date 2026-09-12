ALTER TABLE public.profiles
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
$$;