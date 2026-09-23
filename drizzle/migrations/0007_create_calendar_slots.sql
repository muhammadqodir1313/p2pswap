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
