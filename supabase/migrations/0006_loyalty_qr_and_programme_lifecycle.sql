-- ============================================================================
-- BONFREE-HUB Migration 0006: Opaque QR Tokens, Multi-Card Sync & Validity Rules
-- ============================================================================

-- 1. Add opaque, non-sensitive QR identifier to customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS qr_token text UNIQUE
    DEFAULT ('BFQR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)));

UPDATE public.customers
SET qr_token = 'BFQR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))
WHERE qr_token IS NULL;

ALTER TABLE public.customers
  ALTER COLUMN qr_token SET NOT NULL;

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS chk_customers_qr_token_format;

ALTER TABLE public.customers
  ADD CONSTRAINT chk_customers_qr_token_format
  CHECK (qr_token ~ '^BFQR-[A-Z0-9]{16,}$');

CREATE INDEX IF NOT EXISTS idx_customers_qr_token ON public.customers (qr_token);

-- Prevent customers from mutating qr_token in addition to membership_id/status
CREATE OR REPLACE FUNCTION public.guard_customer_self_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.has_staff_role(ARRAY['administrator', 'store_manager']) THEN
    IF NEW.id <> OLD.id
      OR NEW.user_id <> OLD.user_id
      OR NEW.membership_id <> OLD.membership_id
      OR NEW.qr_token <> OLD.qr_token
      OR NEW.status <> OLD.status THEN
      RAISE EXCEPTION 'Unauthorized modification of protected customer fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Programme activation/validity window & completed/expired card statuses
ALTER TABLE public.loyalty_programmes
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.loyalty_programmes
  DROP CONSTRAINT IF EXISTS chk_programme_validity_window;

ALTER TABLE public.loyalty_programmes
  ADD CONSTRAINT chk_programme_validity_window
  CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at >= starts_at);

ALTER TABLE public.loyalty_cards
  DROP CONSTRAINT IF EXISTS loyalty_cards_status_check;

ALTER TABLE public.loyalty_cards
  ADD CONSTRAINT loyalty_cards_status_check
  CHECK (status IN ('active', 'completed', 'expired', 'suspended'));

CREATE OR REPLACE FUNCTION public.is_programme_currently_valid(p_prog public.loyalty_programmes)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT p_prog.status = 'active'
    AND (p_prog.starts_at IS NULL OR now() >= p_prog.starts_at)
    AND (p_prog.expires_at IS NULL OR now() <= p_prog.expires_at);
$$;

-- 3. Auto-assign eligible active loyalty cards for a customer (no stamp balance edits)
CREATE OR REPLACE FUNCTION public.sync_my_loyalty_cards()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_customer_id uuid;
  v_inserted integer := 0;
BEGIN
  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.loyalty_cards (customer_id, programme_id, current_stamps, lifetime_stamps, status)
  SELECT v_customer_id, lp.id, 0, 0, 'active'
  FROM public.loyalty_programmes lp
  WHERE public.is_programme_currently_valid(lp)
  ON CONFLICT (customer_id, programme_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_my_loyalty_cards() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_my_loyalty_cards() TO authenticated;

-- Update auto-enrollment trigger to assign all currently valid active programmes
CREATE OR REPLACE FUNCTION public.enroll_default_loyalty_card()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.loyalty_cards (customer_id, programme_id, current_stamps, lifetime_stamps, status)
  SELECT NEW.id, lp.id, 0, 0, 'active'
  FROM public.loyalty_programmes lp
  WHERE public.is_programme_currently_valid(lp)
  ON CONFLICT (customer_id, programme_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 4. Update fn_award_stamps to enforce programme validity window and completed card state
CREATE OR REPLACE FUNCTION public.fn_award_stamps(
  p_customer_id uuid,
  p_programme_id uuid,
  p_store_id uuid,
  p_staff_id uuid,
  p_receipt_no text,
  p_amount_inr numeric,
  p_items_summary text DEFAULT '',
  p_idempotency_key text DEFAULT NULL
)
RETURNS TABLE (
  purchase_id uuid,
  transaction_id uuid,
  stamps_awarded integer,
  new_balance integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prog public.loyalty_programmes%ROWTYPE;
  v_card public.loyalty_cards%ROWTYPE;
  v_purchase_id uuid;
  v_tx_id uuid;
  v_stamps integer := 0;
  v_new_balance integer := 0;
  v_next_card_status text := 'active';
  v_expires_at timestamptz;
BEGIN
  SELECT * INTO v_prog
  FROM public.loyalty_programmes
  WHERE id = p_programme_id;

  IF NOT FOUND OR NOT public.is_programme_currently_valid(v_prog) THEN
    RAISE EXCEPTION 'PROGRAMME_EXPIRED_OR_INACTIVE';
  END IF;

  IF p_amount_inr < v_prog.qualifying_amount_inr THEN
    RAISE EXCEPTION 'PURCHASE_BELOW_THRESHOLD';
  END IF;

  IF v_prog.calculation_rule = 'per_transaction' THEN
    v_stamps := 1;
  ELSIF v_prog.calculation_rule = 'multiplier_2x' THEN
    v_stamps := floor(p_amount_inr / v_prog.qualifying_amount_inr)::integer * 2;
  ELSE
    v_stamps := floor(p_amount_inr / v_prog.qualifying_amount_inr)::integer;
  END IF;

  IF v_stamps <= 0 THEN
    RAISE EXCEPTION 'ZERO_STAMPS_CALCULATED';
  END IF;

  INSERT INTO public.loyalty_cards (customer_id, programme_id)
  VALUES (p_customer_id, p_programme_id)
  ON CONFLICT (customer_id, programme_id) DO NOTHING;

  SELECT * INTO v_card
  FROM public.loyalty_cards
  WHERE customer_id = p_customer_id AND programme_id = p_programme_id
  FOR UPDATE;

  IF v_card.status IN ('suspended', 'expired') THEN
    RAISE EXCEPTION 'LOYALTY_CARD_NOT_ELIGIBLE';
  END IF;

  INSERT INTO public.purchases (
    store_id, customer_id, programme_id, recorded_by_staff_id,
    receipt_no, items_summary, amount_inr, is_qualifying, stamps_calculated
  )
  VALUES (
    p_store_id, p_customer_id, p_programme_id, p_staff_id,
    trim(p_receipt_no), COALESCE(p_items_summary, ''), p_amount_inr, true, v_stamps
  )
  RETURNING id INTO v_purchase_id;

  v_new_balance := v_card.current_stamps + v_stamps;
  v_next_card_status := CASE WHEN v_new_balance >= v_prog.stamp_goal THEN 'completed' ELSE 'active' END;
  v_expires_at := now() + make_interval(months => v_prog.stamp_validity_months);

  UPDATE public.loyalty_cards
  SET current_stamps = v_new_balance,
      lifetime_stamps = lifetime_stamps + v_stamps,
      status = v_next_card_status
  WHERE id = v_card.id;

  INSERT INTO public.stamp_transactions (
    loyalty_card_id, customer_id, programme_id, purchase_id, staff_id,
    tx_type, stamps_delta, balance_after, status, idempotency_key, notes, expires_at
  )
  VALUES (
    v_card.id, p_customer_id, p_programme_id, v_purchase_id, p_staff_id,
    'earned', v_stamps, v_new_balance, 'awarded', p_idempotency_key,
    'Qualifying purchase ' || trim(p_receipt_no), v_expires_at
  )
  RETURNING id INTO v_tx_id;

  INSERT INTO public.audit_logs (actor_staff_id, action, entity_type, entity_id, metadata)
  VALUES (
    p_staff_id,
    'stamps.awarded',
    'stamp_transactions',
    v_tx_id,
    jsonb_build_object(
      'customer_id', p_customer_id,
      'purchase_id', v_purchase_id,
      'receipt_no', trim(p_receipt_no),
      'stamps_awarded', v_stamps,
      'balance_after', v_new_balance
    )
  );

  RETURN QUERY SELECT v_purchase_id, v_tx_id, v_stamps, v_new_balance;
END;
$$;

-- 5. Staff-only member identification lookup by opaque QR token, membership ID, email, or phone
--    Strictly identifies membership; never authorizes stamp awards or redemptions by itself.
CREATE OR REPLACE FUNCTION public.fn_lookup_member_by_qr_or_query(p_query text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text := trim(COALESCE(p_query, ''));
  v_customer record;
  v_cards jsonb;
BEGIN
  IF NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'STAFF_AUTHORIZATION_REQUIRED';
  END IF;

  IF v_q = '' THEN
    RETURN NULL;
  END IF;

  SELECT c.id, c.membership_id, c.qr_token, c.status, p.full_name, p.email, p.phone
  INTO v_customer
  FROM public.customers c
  JOIN public.profiles p ON p.id = c.user_id
  WHERE c.qr_token = v_q
     OR upper(c.membership_id) = upper(v_q)
     OR lower(p.email) = lower(v_q)
     OR replace(COALESCE(p.phone, ''), ' ', '') = replace(v_q, ' ', '')
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'card_id', lc.id,
    'programme_id', lp.id,
    'programme_name', lp.name,
    'programme_status', lp.status,
    'is_programme_valid', public.is_programme_currently_valid(lp),
    'stamp_goal', lp.stamp_goal,
    'qualifying_amount_inr', lp.qualifying_amount_inr,
    'calculation_rule', lp.calculation_rule,
    'current_stamps', lc.current_stamps,
    'card_status', lc.status
  ) ORDER BY lc.current_stamps DESC), '[]'::jsonb)
  INTO v_cards
  FROM public.loyalty_cards lc
  JOIN public.loyalty_programmes lp ON lp.id = lc.programme_id
  WHERE lc.customer_id = v_customer.id;

  RETURN jsonb_build_object(
    'customer_id', v_customer.id,
    'membership_id', v_customer.membership_id,
    'qr_token', v_customer.qr_token,
    'status', v_customer.status,
    'full_name', v_customer.full_name,
    'email', v_customer.email,
    'phone', v_customer.phone,
    'cards', v_cards
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_lookup_member_by_qr_or_query(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_lookup_member_by_qr_or_query(text) TO authenticated, service_role;
