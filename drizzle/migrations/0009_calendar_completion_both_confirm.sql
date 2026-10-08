ALTER TABLE public.calendar_slots
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