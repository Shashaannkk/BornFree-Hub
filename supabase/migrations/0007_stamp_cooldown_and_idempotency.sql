-- ============================================================================
-- BONFREE-HUB Migration 0007: Cooldowns, Idempotency & Authoritative Stamp RPC
-- ============================================================================

ALTER TABLE public.loyalty_programmes
  ADD COLUMN IF NOT EXISTS cooldown_minutes integer NOT NULL DEFAULT 0 CHECK (cooldown_minutes >= 0),
  ADD COLUMN IF NOT EXISTS max_stamps_per_tx integer CHECK (max_stamps_per_tx IS NULL OR max_stamps_per_tx > 0);

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
  transaction_code text,
  stamps_awarded integer,
  new_balance integer,
  idempotent_replay boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer public.customers%ROWTYPE;
  v_staff public.staff%ROWTYPE;
  v_prog public.loyalty_programmes%ROWTYPE;
  v_card public.loyalty_cards%ROWTYPE;
  v_existing_tx public.stamp_transactions%ROWTYPE;
  v_existing_purchase public.purchases%ROWTYPE;
  v_last_earned_at timestamptz;
  v_purchase_id uuid;
  v_tx_id uuid;
  v_tx_code text;
  v_stamps integer := 0;
  v_new_balance integer := 0;
  v_next_card_status text := 'active';
  v_expires_at timestamptz;
  v_clean_receipt text := trim(COALESCE(p_receipt_no, ''));
BEGIN
  -- 1. Validate staff & customer status server-side
  SELECT * INTO v_staff
  FROM public.staff
  WHERE id = p_staff_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STAFF_NOT_ACTIVE';
  END IF;

  SELECT * INTO v_customer
  FROM public.customers
  WHERE id = p_customer_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CUSTOMER_NOT_ACTIVE';
  END IF;

  IF v_clean_receipt = '' OR char_length(v_clean_receipt) < 3 THEN
    RAISE EXCEPTION 'INVALID_RECEIPT_NUMBER';
  END IF;

  IF p_amount_inr IS NULL OR p_amount_inr <= 0 THEN
    RAISE EXCEPTION 'INVALID_PURCHASE_AMOUNT';
  END IF;

  -- 2. Validate active & currently valid loyalty programme
  SELECT * INTO v_prog
  FROM public.loyalty_programmes
  WHERE id = p_programme_id;
  IF NOT FOUND OR NOT public.is_programme_currently_valid(v_prog) THEN
    RAISE EXCEPTION 'PROGRAMME_EXPIRED_OR_INACTIVE';
  END IF;

  -- 3. Lock loyalty card row FIRST to serialize concurrent requests & prevent cooldown races
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

  -- 4. Idempotency replay protection (safe network retry without duplicate stamps)
  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_tx
    FROM public.stamp_transactions
    WHERE idempotency_key = trim(p_idempotency_key);

    IF FOUND THEN
      SELECT * INTO v_existing_purchase
      FROM public.purchases
      WHERE id = v_existing_tx.purchase_id;

      IF v_existing_tx.customer_id <> p_customer_id
        OR upper(COALESCE(v_existing_purchase.receipt_no, '')) <> upper(v_clean_receipt) THEN
        RAISE EXCEPTION 'IDEMPOTENCY_KEY_CONFLICT';
      END IF;

      RETURN QUERY SELECT
        v_existing_tx.purchase_id,
        v_existing_tx.id,
        v_existing_tx.transaction_code,
        v_existing_tx.stamps_delta,
        v_card.current_stamps,
        true;
      RETURN;
    END IF;
  END IF;

  -- 5. Configurable cooldown check per customer + programme
  IF v_prog.cooldown_minutes > 0 THEN
    SELECT created_at INTO v_last_earned_at
    FROM public.stamp_transactions
    WHERE customer_id = p_customer_id
      AND programme_id = p_programme_id
      AND tx_type = 'earned'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_last_earned_at IS NOT NULL
      AND (now() - v_last_earned_at) < make_interval(mins => v_prog.cooldown_minutes) THEN
      RAISE EXCEPTION 'COOLDOWN_ACTIVE';
    END IF;
  END IF;

  -- 6. Server-side stamp calculation (never trusts frontend stamp counts)
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

  IF v_prog.max_stamps_per_tx IS NOT NULL AND v_stamps > v_prog.max_stamps_per_tx THEN
    v_stamps := v_prog.max_stamps_per_tx;
  END IF;

  IF v_stamps <= 0 THEN
    RAISE EXCEPTION 'ZERO_STAMPS_CALCULATED';
  END IF;

  -- 7. Atomic purchase + ledger + card update + audit log
  INSERT INTO public.purchases (
    store_id, customer_id, programme_id, recorded_by_staff_id,
    receipt_no, items_summary, amount_inr, is_qualifying, stamps_calculated
  )
  VALUES (
    p_store_id, p_customer_id, p_programme_id, p_staff_id,
    v_clean_receipt, COALESCE(p_items_summary, ''), p_amount_inr, true, v_stamps
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
    'earned', v_stamps, v_new_balance, 'awarded', NULLIF(trim(COALESCE(p_idempotency_key, '')), ''),
    'Qualifying purchase ' || v_clean_receipt, v_expires_at
  )
  RETURNING id, public.stamp_transactions.transaction_code INTO v_tx_id, v_tx_code;

  INSERT INTO public.audit_logs (actor_staff_id, action, entity_type, entity_id, metadata)
  VALUES (
    p_staff_id,
    'stamps.awarded',
    'stamp_transactions',
    v_tx_id,
    jsonb_build_object(
      'customer_id', p_customer_id,
      'purchase_id', v_purchase_id,
      'receipt_no', v_clean_receipt,
      'amount_inr', p_amount_inr,
      'stamps_awarded', v_stamps,
      'balance_after', v_new_balance,
      'transaction_code', v_tx_code,
      'status', 'awarded'
    )
  );

  RETURN QUERY SELECT v_purchase_id, v_tx_id, v_tx_code, v_stamps, v_new_balance, false;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_award_stamps(uuid, uuid, uuid, uuid, text, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_award_stamps(uuid, uuid, uuid, uuid, text, numeric, text, text) TO service_role;
