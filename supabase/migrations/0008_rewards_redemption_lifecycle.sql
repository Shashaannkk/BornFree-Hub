-- ============================================================================
-- BONFREE-HUB Migration 0008: Complete Rewards & Redemption Lifecycle (Phase 7)
-- ============================================================================

-- 1. Extend rewards table with explicit eligibility rules & config
ALTER TABLE public.rewards
  ADD COLUMN IF NOT EXISTS eligibility_rule text NOT NULL DEFAULT 'All active BONFREE-HUB members',
  ADD COLUMN IF NOT EXISTS eligibility_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Keep reward_type check consistent with Admin UI options
ALTER TABLE public.rewards
  DROP CONSTRAINT IF EXISTS rewards_reward_type_check;

ALTER TABLE public.rewards
  ADD CONSTRAINT rewards_reward_type_check CHECK (
    reward_type IN (
      'Fixed Discount',
      'Percentage Discount',
      'Free Product',
      'Birthday Reward',
      'Exclusive Member Offer',
      'New Collection Offer'
    )
  );

-- Audit all admin reward creations/updates/toggles automatically
CREATE OR REPLACE FUNCTION public.audit_reward_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_staff_id uuid;
  v_action text;
BEGIN
  SELECT id INTO v_staff_id
  FROM public.staff
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    v_action := 'reward.created';
  ELSIF NEW.status <> OLD.status THEN
    v_action := CASE WHEN NEW.status = 'active' THEN 'reward.activated' ELSE 'reward.deactivated' END;
  ELSE
    v_action := 'reward.updated';
  END IF;

  INSERT INTO public.audit_logs (actor_user_id, actor_staff_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(),
    v_staff_id,
    v_action,
    'rewards',
    NEW.id,
    jsonb_build_object(
      'code', NEW.code,
      'title', NEW.title,
      'reward_type', NEW.reward_type,
      'required_stamps', NEW.required_stamps,
      'status', NEW.status,
      'programme_id', NEW.programme_id
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_rewards_dml ON public.rewards;
CREATE TRIGGER trg_audit_rewards_dml
  AFTER INSERT OR UPDATE ON public.rewards
  FOR EACH ROW EXECUTE FUNCTION public.audit_reward_changes();

-- 2. Prevent duplicate unlocked/pending entitlements & duplicate voucher codes
ALTER TABLE public.customer_rewards
  ADD COLUMN IF NOT EXISTS unlocked_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_customer_reward
  ON public.customer_rewards (customer_id, reward_id)
  WHERE status IN ('available', 'pending');

CREATE UNIQUE INDEX IF NOT EXISTS uniq_redemptions_voucher_code
  ON public.redemptions (voucher_code);

-- 3. Secure unique voucher code generator
CREATE OR REPLACE FUNCTION public.fn_generate_unique_voucher_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidate text;
  v_exists boolean;
BEGIN
  LOOP
    v_candidate := 'BFH-' ||
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)) || '-' ||
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

    SELECT EXISTS (
      SELECT 1 FROM public.customer_rewards WHERE voucher_code = v_candidate
      UNION ALL
      SELECT 1 FROM public.redemptions WHERE voucher_code = v_candidate
    ) INTO v_exists;

    EXIT WHEN NOT v_exists;
  END LOOP;

  RETURN v_candidate;
END;
$$;

-- 4. Server-side eligibility evaluation (stamp balance, programme, birthday, lifetime spend, limits)
CREATE OR REPLACE FUNCTION public.fn_customer_meets_reward_eligibility(
  p_customer public.customers,
  p_reward public.rewards,
  p_card public.loyalty_cards
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prog public.loyalty_programmes%ROWTYPE;
  v_used_count integer := 0;
  v_bday_only boolean := false;
  v_min_lifetime integer := 0;
BEGIN
  IF p_customer.status <> 'active' OR p_reward.status <> 'active' THEN
    RETURN false;
  END IF;

  IF p_card.status NOT IN ('active', 'completed') THEN
    RETURN false;
  END IF;

  IF p_reward.programme_id IS NOT NULL AND p_reward.programme_id <> p_card.programme_id THEN
    RETURN false;
  END IF;

  SELECT * INTO v_prog
  FROM public.loyalty_programmes
  WHERE id = p_card.programme_id;

  IF NOT FOUND OR NOT public.is_programme_currently_valid(v_prog) THEN
    RETURN false;
  END IF;

  IF p_card.current_stamps < p_reward.required_stamps THEN
    RETURN false;
  END IF;

  v_bday_only := (p_reward.reward_type = 'Birthday Reward')
    OR COALESCE((p_reward.eligibility_config ->> 'birthday_month_only')::boolean, false);
  IF v_bday_only THEN
    IF p_customer.birth_month IS NULL
       OR p_customer.birth_month <> EXTRACT(MONTH FROM now())::smallint THEN
      RETURN false;
    END IF;
  END IF;

  v_min_lifetime := COALESCE((p_reward.eligibility_config ->> 'min_lifetime_stamps')::integer, 0);
  IF v_min_lifetime > 0 AND p_card.lifetime_stamps < v_min_lifetime THEN
    RETURN false;
  END IF;

  IF p_reward.redemption_limit_per_member IS NOT NULL THEN
    SELECT count(*) INTO v_used_count
    FROM public.customer_rewards
    WHERE customer_id = p_customer.id
      AND reward_id = p_reward.id
      AND status IN ('pending', 'redeemed');

    IF v_used_count >= p_reward.redemption_limit_per_member THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$;

-- 5. Automatic reward unlocking when stamps & eligibility requirements are met
--    Enforces explicit stamp/entitlement boundary: same stamps cannot create duplicate unlocks.
CREATE OR REPLACE FUNCTION public.fn_sync_customer_unlocked_rewards(
  p_customer_id uuid,
  p_card_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer public.customers%ROWTYPE;
  v_card public.loyalty_cards%ROWTYPE;
  v_reward public.rewards%ROWTYPE;
  v_unlocked_count integer := 0;
  v_hold_code text;
  v_cr_id uuid;
BEGIN
  SELECT * INTO v_customer
  FROM public.customers
  WHERE id = p_customer_id;

  IF NOT FOUND OR v_customer.status <> 'active' THEN
    RETURN 0;
  END IF;

  -- Mark overdue pending vouchers as expired cleanly
  UPDATE public.customer_rewards
  SET status = 'expired'
  WHERE customer_id = p_customer_id
    AND status = 'pending'
    AND expires_at < now();

  UPDATE public.redemptions r
  SET status = 'expired',
      processed_at = COALESCE(r.processed_at, now()),
      notes = CASE WHEN r.notes = '' THEN 'Expired automatically after validity window.' ELSE r.notes END
  FROM public.customer_rewards cr
  WHERE r.customer_reward_id = cr.id
    AND cr.customer_id = p_customer_id
    AND cr.status = 'expired'
    AND r.status = 'pending';

  -- Remove unrequested 'available' holds that no longer satisfy current balance or active reward status
  DELETE FROM public.customer_rewards cr
  USING public.rewards rw, public.loyalty_cards lc
  WHERE cr.reward_id = rw.id
    AND cr.loyalty_card_id = lc.id
    AND cr.customer_id = p_customer_id
    AND cr.status = 'available'
    AND (
      rw.status <> 'active'
      OR lc.current_stamps < rw.required_stamps
      OR cr.expires_at < now()
    );

  FOR v_card IN
    SELECT *
    FROM public.loyalty_cards
    WHERE customer_id = p_customer_id
      AND (p_card_id IS NULL OR id = p_card_id)
      AND status IN ('active', 'completed')
  LOOP
    FOR v_reward IN
      SELECT *
      FROM public.rewards
      WHERE status = 'active'
        AND (programme_id IS NULL OR programme_id = v_card.programme_id)
      ORDER BY required_stamps ASC
    LOOP
      IF public.fn_customer_meets_reward_eligibility(v_customer, v_reward, v_card) THEN
        v_hold_code := 'BFH-UNLK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

        INSERT INTO public.customer_rewards (
          customer_id, reward_id, loyalty_card_id, voucher_code, stamps_spent, status, expires_at, unlocked_at
        )
        VALUES (
          v_customer.id,
          v_reward.id,
          v_card.id,
          v_hold_code,
          v_reward.required_stamps,
          'available',
          now() + make_interval(months => v_reward.validity_months),
          now()
        )
        ON CONFLICT (customer_id, reward_id) WHERE status IN ('available', 'pending')
        DO NOTHING
        RETURNING id INTO v_cr_id;

        IF v_cr_id IS NOT NULL THEN
          v_unlocked_count := v_unlocked_count + 1;
          INSERT INTO public.audit_logs (action, entity_type, entity_id, metadata)
          VALUES (
            'reward.unlocked',
            'customer_rewards',
            v_cr_id,
            jsonb_build_object(
              'customer_id', v_customer.id,
              'reward_id', v_reward.id,
              'reward_title', v_reward.title,
              'required_stamps', v_reward.required_stamps,
              'card_stamps', v_card.current_stamps
            )
          );
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_unlocked_count;
END;
$$;

-- 6. Trigger automatic reward unlocking during stamp award & customer card sync
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
  SELECT * INTO v_staff FROM public.staff WHERE id = p_staff_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'STAFF_NOT_ACTIVE'; END IF;

  SELECT * INTO v_customer FROM public.customers WHERE id = p_customer_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'CUSTOMER_NOT_ACTIVE'; END IF;

  IF v_clean_receipt = '' OR char_length(v_clean_receipt) < 3 THEN
    RAISE EXCEPTION 'INVALID_RECEIPT_NUMBER';
  END IF;

  IF p_amount_inr IS NULL OR p_amount_inr <= 0 THEN
    RAISE EXCEPTION 'INVALID_PURCHASE_AMOUNT';
  END IF;

  SELECT * INTO v_prog FROM public.loyalty_programmes WHERE id = p_programme_id;
  IF NOT FOUND OR NOT public.is_programme_currently_valid(v_prog) THEN
    RAISE EXCEPTION 'PROGRAMME_EXPIRED_OR_INACTIVE';
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

  -- Auto-unlock eligible rewards inside the same atomic transaction
  PERFORM public.fn_sync_customer_unlocked_rewards(p_customer_id, v_card.id);

  RETURN QUERY SELECT v_purchase_id, v_tx_id, v_tx_code, v_stamps, v_new_balance, false;
END;
$$;

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

  PERFORM public.fn_sync_customer_unlocked_rewards(v_customer_id, NULL);
  RETURN v_inserted;
END;
$$;

-- 7. Atomic customer redemption request with stamp consumption & single-use voucher generation
DROP FUNCTION IF EXISTS public.fn_request_redemption(uuid, uuid);

CREATE OR REPLACE FUNCTION public.fn_request_redemption(
  p_customer_id uuid,
  p_reward_id uuid,
  p_idempotency_key text DEFAULT NULL
)
RETURNS TABLE (
  redemption_id uuid,
  customer_reward_id uuid,
  voucher_code text,
  new_balance integer,
  expires_at timestamptz,
  idempotent_replay boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer public.customers%ROWTYPE;
  v_reward public.rewards%ROWTYPE;
  v_prog public.loyalty_programmes%ROWTYPE;
  v_card public.loyalty_cards%ROWTYPE;
  v_existing_tx public.stamp_transactions%ROWTYPE;
  v_existing_cr public.customer_rewards%ROWTYPE;
  v_existing_rdm public.redemptions%ROWTYPE;
  v_new_balance integer;
  v_next_card_status text;
  v_voucher text;
  v_expires_at timestamptz;
  v_cr_id uuid;
  v_rdm_id uuid;
BEGIN
  SELECT * INTO v_customer FROM public.customers WHERE id = p_customer_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'CUSTOMER_NOT_ACTIVE'; END IF;

  SELECT * INTO v_reward FROM public.rewards WHERE id = p_reward_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_REWARD_NOT_FOUND'; END IF;

  -- Lock eligible loyalty card first to prevent concurrent double spending of the same stamps
  SELECT * INTO v_card
  FROM public.loyalty_cards
  WHERE customer_id = p_customer_id
    AND (v_reward.programme_id IS NULL OR programme_id = v_reward.programme_id)
    AND status IN ('active', 'completed')
  ORDER BY current_stamps DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTIVE_LOYALTY_CARD_NOT_FOUND';
  END IF;

  -- Safe idempotent network retry check
  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_tx
    FROM public.stamp_transactions
    WHERE idempotency_key = trim(p_idempotency_key);

    IF FOUND THEN
      SELECT * INTO v_existing_cr
      FROM public.customer_rewards
      WHERE customer_id = p_customer_id
        AND reward_id = p_reward_id
        AND status IN ('pending', 'redeemed')
      ORDER BY created_at DESC
      LIMIT 1;

      SELECT * INTO v_existing_rdm
      FROM public.redemptions
      WHERE customer_reward_id = v_existing_cr.id;

      IF v_existing_rdm.id IS NOT NULL THEN
        RETURN QUERY SELECT
          v_existing_rdm.id,
          v_existing_cr.id,
          v_existing_cr.voucher_code,
          v_card.current_stamps,
          v_existing_cr.expires_at,
          true;
        RETURN;
      END IF;
    END IF;
  END IF;

  -- Prevent duplicate open pending redemption for the exact same reward
  SELECT * INTO v_existing_cr
  FROM public.customer_rewards
  WHERE customer_id = p_customer_id
    AND reward_id = p_reward_id
    AND status = 'pending'
  FOR UPDATE;

  IF FOUND THEN
    RAISE EXCEPTION 'REDEMPTION_ALREADY_PENDING';
  END IF;

  IF NOT public.fn_customer_meets_reward_eligibility(v_customer, v_reward, v_card) THEN
    IF v_card.current_stamps < v_reward.required_stamps THEN
      RAISE EXCEPTION 'INSUFFICIENT_STAMPS';
    END IF;
    RAISE EXCEPTION 'REWARD_ELIGIBILITY_NOT_MET';
  END IF;

  SELECT * INTO v_prog FROM public.loyalty_programmes WHERE id = v_card.programme_id;

  v_new_balance := v_card.current_stamps - v_reward.required_stamps;
  v_next_card_status := CASE
    WHEN v_prog.id IS NOT NULL AND v_new_balance >= v_prog.stamp_goal THEN 'completed'
    ELSE 'active'
  END;
  v_voucher := public.fn_generate_unique_voucher_code();
  v_expires_at := now() + make_interval(months => v_reward.validity_months);

  UPDATE public.loyalty_cards
  SET current_stamps = v_new_balance,
      status = v_next_card_status
  WHERE id = v_card.id;

  INSERT INTO public.stamp_transactions (
    loyalty_card_id, customer_id, programme_id, tx_type, stamps_delta, balance_after,
    status, idempotency_key, notes
  )
  VALUES (
    v_card.id, p_customer_id, v_card.programme_id, 'redeemed',
    -v_reward.required_stamps, v_new_balance, 'completed',
    NULLIF(trim(COALESCE(p_idempotency_key, '')), ''),
    'Voucher requested (' || v_reward.title || '): ' || v_voucher
  );

  -- Upgrade any existing 'available' unlocked entitlement row to 'pending', or insert a new one
  SELECT * INTO v_existing_cr
  FROM public.customer_rewards
  WHERE customer_id = p_customer_id
    AND reward_id = p_reward_id
    AND status = 'available'
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.customer_rewards
    SET loyalty_card_id = v_card.id,
        voucher_code = v_voucher,
        stamps_spent = v_reward.required_stamps,
        status = 'pending',
        expires_at = v_expires_at
    WHERE id = v_existing_cr.id
    RETURNING id INTO v_cr_id;
  ELSE
    INSERT INTO public.customer_rewards (
      customer_id, reward_id, loyalty_card_id, voucher_code, stamps_spent, status, expires_at
    )
    VALUES (
      p_customer_id, p_reward_id, v_card.id, v_voucher, v_reward.required_stamps, 'pending', v_expires_at
    )
    RETURNING id INTO v_cr_id;
  END IF;

  INSERT INTO public.redemptions (
    customer_reward_id, customer_id, reward_id, voucher_code, stamps_cost, status, notes
  )
  VALUES (
    v_cr_id, p_customer_id, p_reward_id, v_voucher, v_reward.required_stamps, 'pending',
    'Customer requested voucher code ' || v_voucher || ' for ' || v_reward.title
  )
  RETURNING id INTO v_rdm_id;

  -- Prune unrequested 'available' unlocks that are no longer supported by remaining stamp balance
  PERFORM public.fn_sync_customer_unlocked_rewards(p_customer_id, v_card.id);

  INSERT INTO public.audit_logs (action, entity_type, entity_id, metadata)
  VALUES (
    'redemption.requested',
    'redemptions',
    v_rdm_id,
    jsonb_build_object(
      'customer_id', p_customer_id,
      'reward_id', p_reward_id,
      'voucher_code', v_voucher,
      'stamps_spent', v_reward.required_stamps,
      'new_balance', v_new_balance,
      'expires_at', v_expires_at
    )
  );

  RETURN QUERY SELECT v_rdm_id, v_cr_id, v_voucher, v_new_balance, v_expires_at, false;
END;
$$;

-- 8. Staff Voucher Lookup & Atomic Redemption Processing
CREATE OR REPLACE FUNCTION public.fn_verify_voucher(p_voucher_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean text := upper(trim(COALESCE(p_voucher_code, '')));
  v_rdm public.redemptions%ROWTYPE;
  v_cr public.customer_rewards%ROWTYPE;
  v_rw public.rewards%ROWTYPE;
  v_cust public.customers%ROWTYPE;
  v_prof public.profiles%ROWTYPE;
BEGIN
  IF v_clean = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'VOUCHER_CODE_REQUIRED');
  END IF;

  SELECT * INTO v_rdm
  FROM public.redemptions
  WHERE upper(voucher_code) = v_clean
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'VOUCHER_NOT_FOUND');
  END IF;

  SELECT * INTO v_cr FROM public.customer_rewards WHERE id = v_rdm.customer_reward_id;
  SELECT * INTO v_rw FROM public.rewards WHERE id = v_rdm.reward_id;
  SELECT * INTO v_cust FROM public.customers WHERE id = v_rdm.customer_id;
  SELECT * INTO v_prof FROM public.profiles WHERE id = v_cust.user_id;

  IF v_rdm.status = 'pending' AND v_cr.expires_at < now() THEN
    UPDATE public.customer_rewards SET status = 'expired' WHERE id = v_cr.id;
    UPDATE public.redemptions SET status = 'expired', processed_at = now() WHERE id = v_rdm.id RETURNING * INTO v_rdm;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'redemption_id', v_rdm.id,
    'voucher_code', v_rdm.voucher_code,
    'status', v_rdm.status,
    'stamps_cost', v_rdm.stamps_cost,
    'expires_at', v_cr.expires_at,
    'requested_at', v_rdm.requested_at,
    'processed_at', v_rdm.processed_at,
    'reward_title', v_rw.title,
    'reward_type', v_rw.reward_type,
    'value_label', v_rw.value_label,
    'customer_id', v_cust.membership_id,
    'customer_name', COALESCE(v_prof.full_name, 'Member'),
    'customer_phone', COALESCE(v_prof.phone, ''),
    'notes', v_rdm.notes
  );
END;
$$;

DROP FUNCTION IF EXISTS public.fn_process_redemption(uuid, uuid, uuid, text, text);

CREATE OR REPLACE FUNCTION public.fn_process_redemption(
  p_redemption_id uuid,
  p_staff_id uuid,
  p_store_id uuid,
  p_action text,
  p_rejection_reason text DEFAULT NULL,
  p_voucher_code text DEFAULT NULL
)
RETURNS public.redemptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff public.staff%ROWTYPE;
  v_customer public.customers%ROWTYPE;
  v_rdm public.redemptions%ROWTYPE;
  v_cr public.customer_rewards%ROWTYPE;
  v_card public.loyalty_cards%ROWTYPE;
  v_refunded_balance integer;
BEGIN
  IF p_action NOT IN ('confirm', 'reject') THEN
    RAISE EXCEPTION 'INVALID_REDEMPTION_ACTION';
  END IF;

  SELECT * INTO v_staff FROM public.staff WHERE id = p_staff_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STAFF_NOT_ACTIVE';
  END IF;

  IF p_redemption_id IS NOT NULL THEN
    SELECT * INTO v_rdm
    FROM public.redemptions
    WHERE id = p_redemption_id
    FOR UPDATE;
  ELSIF p_voucher_code IS NOT NULL AND trim(p_voucher_code) <> '' THEN
    SELECT * INTO v_rdm
    FROM public.redemptions
    WHERE upper(voucher_code) = upper(trim(p_voucher_code))
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REDEMPTION_NOT_FOUND';
  END IF;

  IF v_rdm.status = 'completed' THEN
    RAISE EXCEPTION 'VOUCHER_ALREADY_REDEEMED';
  ELSIF v_rdm.status = 'expired' THEN
    RAISE EXCEPTION 'VOUCHER_EXPIRED';
  ELSIF v_rdm.status <> 'pending' THEN
    RAISE EXCEPTION 'REDEMPTION_ALREADY_PROCESSED';
  END IF;

  SELECT * INTO v_cr
  FROM public.customer_rewards
  WHERE id = v_rdm.customer_reward_id
  FOR UPDATE;

  SELECT * INTO v_customer FROM public.customers WHERE id = v_rdm.customer_id;

  IF p_action = 'confirm' AND v_customer.status <> 'active' THEN
    RAISE EXCEPTION 'CUSTOMER_NOT_ACTIVE';
  END IF;

  IF p_action = 'confirm' AND v_cr.expires_at < now() THEN
    UPDATE public.customer_rewards SET status = 'expired' WHERE id = v_cr.id;
    UPDATE public.redemptions
    SET status = 'expired',
        processed_at = now(),
        verified_by_staff_id = p_staff_id
    WHERE id = v_rdm.id
    RETURNING * INTO v_rdm;

    INSERT INTO public.audit_logs (actor_staff_id, action, entity_type, entity_id, metadata)
    VALUES (
      p_staff_id,
      'redemption.expired',
      'redemptions',
      v_rdm.id,
      jsonb_build_object('voucher_code', v_rdm.voucher_code, 'expires_at', v_cr.expires_at)
    );

    RAISE EXCEPTION 'VOUCHER_EXPIRED';
  END IF;

  IF p_action = 'confirm' THEN
    UPDATE public.customer_rewards
    SET status = 'redeemed', redeemed_at = now()
    WHERE id = v_cr.id;

    UPDATE public.redemptions
    SET status = 'completed',
        store_id = COALESCE(p_store_id, store_id),
        verified_by_staff_id = p_staff_id,
        processed_at = now()
    WHERE id = v_rdm.id
    RETURNING * INTO v_rdm;
  ELSE
    SELECT * INTO v_card
    FROM public.loyalty_cards
    WHERE id = v_cr.loyalty_card_id
    FOR UPDATE;

    v_refunded_balance := v_card.current_stamps + v_cr.stamps_spent;

    UPDATE public.loyalty_cards
    SET current_stamps = v_refunded_balance
    WHERE id = v_card.id;

    INSERT INTO public.stamp_transactions (
      loyalty_card_id, customer_id, programme_id, staff_id, tx_type,
      stamps_delta, balance_after, status, notes
    )
    VALUES (
      v_card.id, v_rdm.customer_id, v_card.programme_id, p_staff_id, 'reversed',
      v_cr.stamps_spent, v_refunded_balance, 'reversed',
      'Redemption rejected (' || v_rdm.voucher_code || '): ' || COALESCE(NULLIF(trim(p_rejection_reason), ''), 'Rejected by staff')
    );

    UPDATE public.customer_rewards SET status = 'rejected' WHERE id = v_cr.id;

    UPDATE public.redemptions
    SET status = 'rejected',
        store_id = COALESCE(p_store_id, store_id),
        verified_by_staff_id = p_staff_id,
        rejection_reason = NULLIF(trim(p_rejection_reason), ''),
        processed_at = now()
    WHERE id = v_rdm.id
    RETURNING * INTO v_rdm;

    PERFORM public.fn_sync_customer_unlocked_rewards(v_rdm.customer_id, v_card.id);
  END IF;

  INSERT INTO public.audit_logs (actor_staff_id, action, entity_type, entity_id, metadata)
  VALUES (
    p_staff_id,
    'redemption.' || p_action,
    'redemptions',
    v_rdm.id,
    jsonb_build_object(
      'voucher_code', v_rdm.voucher_code,
      'customer_id', v_rdm.customer_id,
      'reward_id', v_rdm.reward_id,
      'store_id', v_rdm.store_id,
      'stamps_cost', v_rdm.stamps_cost,
      'status', v_rdm.status,
      'rejection_reason', v_rdm.rejection_reason
    )
  );

  RETURN v_rdm;
END;
$$;

-- Strict RPC permissions: service_role only for sensitive mutations
REVOKE ALL ON FUNCTION public.fn_generate_unique_voucher_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_customer_meets_reward_eligibility(public.customers, public.rewards, public.loyalty_cards) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_sync_customer_unlocked_rewards(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_award_stamps(uuid, uuid, uuid, uuid, text, numeric, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_request_redemption(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_verify_voucher(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_process_redemption(uuid, uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_generate_unique_voucher_code() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_customer_meets_reward_eligibility(public.customers, public.rewards, public.loyalty_cards) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_sync_customer_unlocked_rewards(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_award_stamps(uuid, uuid, uuid, uuid, text, numeric, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_request_redemption(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_verify_voucher(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_process_redemption(uuid, uuid, uuid, text, text, text) TO service_role;
