-- ============================================================================
-- BONFREE-HUB Migration 0005: Profile Self-Update Guard & Auto Default Card
-- ============================================================================

-- Guard profiles against client-side email or ID tampering via PostgREST
CREATE OR REPLACE FUNCTION public.guard_profile_self_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.has_staff_role(ARRAY['administrator']) THEN
    IF NEW.id <> OLD.id OR lower(NEW.email) <> lower(OLD.email) THEN
      RAISE EXCEPTION 'Unauthorized modification of protected profile identity fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_self_update ON public.profiles;
CREATE TRIGGER trg_guard_profile_self_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_self_update();

-- Auto-enroll new customer into default active Classic Stamps programme if present
CREATE OR REPLACE FUNCTION public.enroll_default_loyalty_card()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default_prog_id uuid;
BEGIN
  SELECT id INTO v_default_prog_id
  FROM public.loyalty_programmes
  WHERE code = 'PROG-CLASSIC' AND status = 'active'
  LIMIT 1;

  IF v_default_prog_id IS NOT NULL THEN
    INSERT INTO public.loyalty_cards (customer_id, programme_id, current_stamps, lifetime_stamps, status)
    VALUES (NEW.id, v_default_prog_id, 0, 0, 'active')
    ON CONFLICT (customer_id, programme_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enroll_default_loyalty_card ON public.customers;
CREATE TRIGGER trg_enroll_default_loyalty_card
  AFTER INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.enroll_default_loyalty_card();
