-- ============================================================================
-- BONFREE-HUB Migration 0010: Campaigns, Promotional Safety & Survey Lifecycle
-- ============================================================================

-- 1. Extend campaigns with eligibility rules & storage bucket for campaign assets
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS eligibility_rule text NOT NULL DEFAULT 'All active BONFREE-HUB members',
  ADD COLUMN IF NOT EXISTS eligibility_config jsonb NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campaign-images',
  'campaign-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS campaign_images_public_read ON storage.objects;
CREATE POLICY campaign_images_public_read ON storage.objects
  FOR SELECT USING (bucket_id = 'campaign-images');

DROP POLICY IF EXISTS campaign_images_staff_upload ON storage.objects;
CREATE POLICY campaign_images_staff_upload ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'campaign-images' AND public.has_permission('campaigns.manage')
  );

DROP POLICY IF EXISTS campaign_images_staff_update ON storage.objects;
CREATE POLICY campaign_images_staff_update ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'campaign-images' AND public.has_permission('campaigns.manage')
  )
  WITH CHECK (
    bucket_id = 'campaign-images' AND public.has_permission('campaigns.manage')
  );

-- Helper: true only when campaign is active AND within inclusive start/end validity dates
CREATE OR REPLACE FUNCTION public.is_campaign_currently_valid(p_camp public.campaigns)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT p_camp.status = 'active'
    AND CURRENT_DATE >= p_camp.start_date
    AND CURRENT_DATE <= p_camp.end_date;
$$;

-- Tighten customer read RLS so expired/scheduled/inactive campaigns are hidden from non-staff
DROP POLICY IF EXISTS campaigns_read ON public.campaigns;
CREATE POLICY campaigns_read ON public.campaigns
  FOR SELECT USING (
    (status = 'active' AND CURRENT_DATE >= start_date AND CURRENT_DATE <= end_date)
    OR public.is_active_staff()
  );

-- Audit trigger for campaign creation, updates, activation, and deactivation
CREATE OR REPLACE FUNCTION public.audit_campaign_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_staff_id uuid;
  v_action text;
BEGIN
  SELECT id INTO v_staff_id FROM public.staff WHERE user_id = auth.uid() LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    v_action := 'campaign.created';
  ELSIF NEW.status <> OLD.status THEN
    v_action := 'campaign.' || NEW.status;
  ELSE
    v_action := 'campaign.updated';
  END IF;

  INSERT INTO public.audit_logs (actor_user_id, actor_staff_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(),
    v_staff_id,
    v_action,
    'campaigns',
    NEW.id,
    jsonb_build_object(
      'title', NEW.title,
      'status', NEW.status,
      'programme_id', NEW.programme_id,
      'multiplier', NEW.multiplier,
      'bonus_stamps', NEW.bonus_stamps,
      'start_date', NEW.start_date,
      'end_date', NEW.end_date
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_campaigns_dml ON public.campaigns;
CREATE TRIGGER trg_audit_campaigns_dml
  AFTER INSERT OR UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.audit_campaign_changes();

-- 2. Upgrade fn_award_stamps so active eligible campaign promotions are verified server-side
--    and capped by programme max_stamps_per_tx while preserving duplicate & cooldown guards.
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
  v_camp public.campaigns%ROWTYPE;
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
  v_notes text;
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

  -- Check best currently active, date-valid, eligible campaign for this programme
  SELECT * INTO v_camp
  FROM public.campaigns c
  WHERE public.is_campaign_currently_valid(c)
    AND (c.programme_id IS NULL OR c.programme_id = p_programme_id)
    AND COALESCE((c.eligibility_config ->> 'min_purchase_inr')::numeric, 0) <= p_amount_inr
  ORDER BY c.multiplier DESC, c.bonus_stamps DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_camp.multiplier > 1.00 AND v_prog.calculation_rule <> 'multiplier_2x' THEN
      v_stamps := floor(v_stamps * v_camp.multiplier)::integer;
    END IF;
    v_stamps := v_stamps + COALESCE(v_camp.bonus_stamps, 0);
  END IF;

  -- Programme per-transaction ceiling ALWAYS caps total stamps (including campaign bonuses)
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
  v_notes := CASE
    WHEN v_camp.id IS NOT NULL THEN 'Qualifying purchase ' || v_clean_receipt || ' (Campaign: ' || v_camp.title || ')'
    ELSE 'Qualifying purchase ' || v_clean_receipt
  END;

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
    v_notes, v_expires_at
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
      'campaign_id', v_camp.id,
      'campaign_title', v_camp.title,
      'transaction_code', v_tx_code,
      'status', 'awarded'
    )
  );

  PERFORM public.fn_sync_customer_unlocked_rewards(p_customer_id, v_card.id);

  RETURN QUERY SELECT v_purchase_id, v_tx_id, v_tx_code, v_stamps, v_new_balance, false;
END;
$$;

-- 3. Surveys Lifecycle: publish, close, eligibility & anti-duplicate member submissions
ALTER TABLE public.surveys
  DROP CONSTRAINT IF EXISTS surveys_status_check;

ALTER TABLE public.surveys
  ADD CONSTRAINT surveys_status_check
  CHECK (status IN ('draft', 'published', 'closed', 'archived'));

ALTER TABLE public.surveys
  ADD COLUMN IF NOT EXISTS eligible_programme_id uuid REFERENCES public.loyalty_programmes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

CREATE OR REPLACE FUNCTION public.audit_survey_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_staff_id uuid;
  v_action text;
BEGIN
  SELECT id INTO v_staff_id FROM public.staff WHERE user_id = auth.uid() LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    v_action := 'survey.created';
  ELSIF NEW.status <> OLD.status THEN
    v_action := 'survey.' || NEW.status;
  ELSE
    v_action := 'survey.updated';
  END IF;

  INSERT INTO public.audit_logs (actor_user_id, actor_staff_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(),
    v_staff_id,
    v_action,
    'surveys',
    NEW.id,
    jsonb_build_object('title', NEW.title, 'status', NEW.status, 'eligible_programme_id', NEW.eligible_programme_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_surveys_dml ON public.surveys;
CREATE TRIGGER trg_audit_surveys_dml
  AFTER INSERT OR UPDATE ON public.surveys
  FOR EACH ROW EXECUTE FUNCTION public.audit_survey_changes();

-- Prevent anonymous or duplicate/closed survey response inserts via direct REST
DROP POLICY IF EXISTS survey_responses_insert ON public.survey_responses;
CREATE POLICY survey_responses_insert ON public.survey_responses
  FOR INSERT WITH CHECK (
    customer_id IS NOT NULL
    AND customer_id = public.current_customer_id()
    AND EXISTS (
      SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.status = 'active'
    )
    AND EXISTS (
      SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.status = 'published'
    )
  );

-- Authoritative member survey submission RPC (prevents duplicates & verifies eligibility)
CREATE OR REPLACE FUNCTION public.fn_submit_survey_response(
  p_survey_id uuid,
  p_overall_rating smallint DEFAULT NULL,
  p_answers jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_customer public.customers%ROWTYPE;
  v_survey public.surveys%ROWTYPE;
  v_response_id uuid;
  v_eligible_card boolean;
BEGIN
  SELECT * INTO v_customer
  FROM public.customers
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CUSTOMER_NOT_ACTIVE';
  END IF;

  SELECT * INTO v_survey
  FROM public.surveys
  WHERE id = p_survey_id;

  IF NOT FOUND OR v_survey.status <> 'published' THEN
    RAISE EXCEPTION 'SURVEY_NOT_OPEN';
  END IF;

  IF v_survey.eligible_programme_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.loyalty_cards
      WHERE customer_id = v_customer.id
        AND programme_id = v_survey.eligible_programme_id
        AND status IN ('active', 'completed')
    ) INTO v_eligible_card;

    IF NOT v_eligible_card THEN
      RAISE EXCEPTION 'SURVEY_ELIGIBILITY_NOT_MET';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.survey_responses
    WHERE survey_id = p_survey_id AND customer_id = v_customer.id
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_SURVEY_SUBMISSION';
  END IF;

  INSERT INTO public.survey_responses (survey_id, customer_id, overall_rating, answers)
  VALUES (p_survey_id, v_customer.id, p_overall_rating, COALESCE(p_answers, '{}'::jsonb))
  RETURNING id INTO v_response_id;

  INSERT INTO public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(),
    'survey.response_submitted',
    'survey_responses',
    v_response_id,
    jsonb_build_object('survey_id', p_survey_id, 'customer_id', v_customer.id, 'overall_rating', p_overall_rating)
  );

  RETURN v_response_id;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_campaign_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_survey_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_submit_survey_response(uuid, smallint, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_submit_survey_response(uuid, smallint, jsonb) TO authenticated, service_role;
