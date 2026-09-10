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
