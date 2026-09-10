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

grant execute on function public.complete_session(uuid) to authenticated;