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
FOR EACH ROW EXECUTE FUNCTION public.enforce_slot_duration();