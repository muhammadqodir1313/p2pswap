ALTER TABLE public.profiles
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
$$;