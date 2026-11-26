-- ============================================================================
-- BONFREE-HUB Migration 0004: Security Helpers, Atomic Ledger RPCs & RLS Policies
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Security Helper Functions
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_customer_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM public.customers WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_active_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff s
    WHERE s.user_id = auth.uid()
      AND s.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_staff_role(role_codes text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff s
    JOIN public.roles r ON r.id = s.role_id
    WHERE s.user_id = auth.uid()
      AND s.status = 'active'
      AND r.code = ANY(role_codes)
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(perm_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff s
    JOIN public.permissions p ON p.code = perm_code
    LEFT JOIN public.staff_permissions sp
      ON sp.staff_id = s.id AND sp.permission_id = p.id
    LEFT JOIN public.role_permissions rp
      ON rp.role_id = s.role_id AND rp.permission_id = p.id
    WHERE s.user_id = auth.uid()
      AND s.status = 'active'
      AND COALESCE(sp.granted, rp.permission_id IS NOT NULL, false) = true
  );
$$;

-- ----------------------------------------------------------------------------
-- 2. Atomic Server-Side Business Functions (Service-Role Edge Functions Only)
-- ----------------------------------------------------------------------------
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
  v_expires_at timestamptz;
BEGIN
  SELECT * INTO v_prog
  FROM public.loyalty_programmes
  WHERE id = p_programme_id AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTIVE_PROGRAMME_NOT_FOUND';
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

  IF v_card.status <> 'active' THEN
    RAISE EXCEPTION 'LOYALTY_CARD_SUSPENDED';
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
  v_expires_at := now() + make_interval(months => v_prog.stamp_validity_months);

  UPDATE public.loyalty_cards
  SET current_stamps = v_new_balance,
      lifetime_stamps = lifetime_stamps + v_stamps
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

CREATE OR REPLACE FUNCTION public.fn_request_redemption(
  p_customer_id uuid,
  p_reward_id uuid
)
RETURNS TABLE (
  redemption_id uuid,
  customer_reward_id uuid,
  voucher_code text,
  new_balance integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward public.rewards%ROWTYPE;
  v_card public.loyalty_cards%ROWTYPE;
  v_used_count integer;
  v_new_balance integer;
  v_voucher text;
  v_cr_id uuid;
  v_rdm_id uuid;
BEGIN
  SELECT * INTO v_reward
  FROM public.rewards
  WHERE id = p_reward_id AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTIVE_REWARD_NOT_FOUND';
  END IF;

  SELECT * INTO v_card
  FROM public.loyalty_cards
  WHERE customer_id = p_customer_id
    AND (v_reward.programme_id IS NULL OR programme_id = v_reward.programme_id)
    AND status = 'active'
  ORDER BY current_stamps DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTIVE_LOYALTY_CARD_NOT_FOUND';
  END IF;

  IF v_card.current_stamps < v_reward.required_stamps THEN
    RAISE EXCEPTION 'INSUFFICIENT_STAMPS';
  END IF;

  IF v_reward.redemption_limit_per_member IS NOT NULL THEN
    SELECT count(*) INTO v_used_count
    FROM public.customer_rewards
    WHERE customer_id = p_customer_id
      AND reward_id = p_reward_id
      AND status IN ('pending', 'available', 'redeemed');

    IF v_used_count >= v_reward.redemption_limit_per_member THEN
      RAISE EXCEPTION 'REDEMPTION_LIMIT_REACHED';
    END IF;
  END IF;

  v_new_balance := v_card.current_stamps - v_reward.required_stamps;
  v_voucher := 'BFH-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  UPDATE public.loyalty_cards
  SET current_stamps = v_new_balance
  WHERE id = v_card.id;

  INSERT INTO public.stamp_transactions (
    loyalty_card_id, customer_id, programme_id, tx_type, stamps_delta, balance_after, status, notes
  )
  VALUES (
    v_card.id, p_customer_id, v_card.programme_id, 'redeemed',
    -v_reward.required_stamps, v_new_balance, 'completed', 'Voucher requested: ' || v_voucher
  );

  INSERT INTO public.customer_rewards (
    customer_id, reward_id, loyalty_card_id, voucher_code, stamps_spent, status, expires_at
  )
  VALUES (
    p_customer_id, p_reward_id, v_card.id, v_voucher, v_reward.required_stamps,
    'pending', now() + make_interval(months => v_reward.validity_months)
  )
  RETURNING id INTO v_cr_id;

  INSERT INTO public.redemptions (
    customer_reward_id, customer_id, reward_id, voucher_code, stamps_cost, status
  )
  VALUES (
    v_cr_id, p_customer_id, p_reward_id, v_voucher, v_reward.required_stamps, 'pending'
  )
  RETURNING id INTO v_rdm_id;

  INSERT INTO public.audit_logs (action, entity_type, entity_id, metadata)
  VALUES (
    'redemption.requested',
    'redemptions',
    v_rdm_id,
    jsonb_build_object('customer_id', p_customer_id, 'reward_id', p_reward_id, 'voucher_code', v_voucher)
  );

  RETURN QUERY SELECT v_rdm_id, v_cr_id, v_voucher, v_new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_process_redemption(
  p_redemption_id uuid,
  p_staff_id uuid,
  p_store_id uuid,
  p_action text,
  p_rejection_reason text DEFAULT NULL
)
RETURNS public.redemptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rdm public.redemptions%ROWTYPE;
  v_cr public.customer_rewards%ROWTYPE;
  v_card public.loyalty_cards%ROWTYPE;
  v_refunded_balance integer;
BEGIN
  IF p_action NOT IN ('confirm', 'reject') THEN
    RAISE EXCEPTION 'INVALID_REDEMPTION_ACTION';
  END IF;

  SELECT * INTO v_rdm
  FROM public.redemptions
  WHERE id = p_redemption_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REDEMPTION_NOT_FOUND';
  END IF;

  IF v_rdm.status <> 'pending' THEN
    RAISE EXCEPTION 'REDEMPTION_ALREADY_PROCESSED';
  END IF;

  SELECT * INTO v_cr
  FROM public.customer_rewards
  WHERE id = v_rdm.customer_reward_id
  FOR UPDATE;

  IF p_action = 'confirm' AND v_cr.expires_at < now() THEN
    UPDATE public.customer_rewards SET status = 'expired' WHERE id = v_cr.id;
    UPDATE public.redemptions
    SET status = 'expired', processed_at = now(), verified_by_staff_id = p_staff_id
    WHERE id = v_rdm.id
    RETURNING * INTO v_rdm;
    RETURN v_rdm;
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
      'Redemption rejected: ' || COALESCE(p_rejection_reason, 'Rejected by staff')
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
  END IF;

  INSERT INTO public.audit_logs (actor_staff_id, action, entity_type, entity_id, metadata)
  VALUES (
    p_staff_id,
    'redemption.' || p_action,
    'redemptions',
    v_rdm.id,
    jsonb_build_object('voucher_code', v_rdm.voucher_code, 'status', v_rdm.status)
  );

  RETURN v_rdm;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_award_stamps(uuid, uuid, uuid, uuid, text, numeric, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_request_redemption(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_process_redemption(uuid, uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_award_stamps(uuid, uuid, uuid, uuid, text, numeric, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_request_redemption(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_process_redemption(uuid, uuid, uuid, text, text) TO service_role;

-- ----------------------------------------------------------------------------
-- 3. Enable Row Level Security on ALL Exposed Tables
-- ----------------------------------------------------------------------------
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_programme_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stamp_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Prevent customers from mutating restricted columns even on own customer row.
CREATE OR REPLACE FUNCTION public.guard_customer_self_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.has_staff_role(ARRAY['administrator', 'store_manager']) THEN
    IF NEW.id <> OLD.id OR NEW.user_id <> OLD.user_id OR NEW.membership_id <> OLD.membership_id OR NEW.status <> OLD.status THEN
      RAISE EXCEPTION 'Unauthorized modification of protected customer fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_customer_self_update
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.guard_customer_self_update();

-- ----------------------------------------------------------------------------
-- 4. Granular RLS Policies
-- ----------------------------------------------------------------------------

-- Stores
CREATE POLICY stores_public_read ON public.stores
  FOR SELECT USING (is_active = true OR public.is_active_staff());

CREATE POLICY stores_admin_manage ON public.stores
  FOR ALL USING (public.has_staff_role(ARRAY['administrator']))
  WITH CHECK (public.has_staff_role(ARRAY['administrator']));

-- Profiles
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT USING (
    id = auth.uid() OR public.has_permission('customers.read') OR public.has_staff_role(ARRAY['administrator'])
  );

CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Roles, Permissions & Role Permissions (Staff Read, Admin Manage)
CREATE POLICY roles_staff_read ON public.roles
  FOR SELECT USING (public.is_active_staff());

CREATE POLICY permissions_staff_read ON public.permissions
  FOR SELECT USING (public.is_active_staff());

CREATE POLICY role_permissions_staff_read ON public.role_permissions
  FOR SELECT USING (public.is_active_staff());

-- Staff & Staff Permissions
CREATE POLICY staff_select ON public.staff
  FOR SELECT USING (
    user_id = auth.uid() OR public.has_permission('staff.manage') OR public.has_staff_role(ARRAY['administrator', 'store_manager'])
  );

CREATE POLICY staff_admin_manage ON public.staff
  FOR ALL USING (public.has_staff_role(ARRAY['administrator']))
  WITH CHECK (public.has_staff_role(ARRAY['administrator']));

CREATE POLICY staff_permissions_select ON public.staff_permissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.staff s WHERE s.id = staff_id AND s.user_id = auth.uid())
    OR public.has_staff_role(ARRAY['administrator'])
  );

CREATE POLICY staff_permissions_admin_manage ON public.staff_permissions
  FOR ALL USING (public.has_staff_role(ARRAY['administrator']))
  WITH CHECK (public.has_staff_role(ARRAY['administrator']));

-- Customers (Customer reads/updates own preferences only; staff read with permission)
CREATE POLICY customers_select ON public.customers
  FOR SELECT USING (
    user_id = auth.uid() OR public.has_permission('customers.read')
  );

CREATE POLICY customers_self_update ON public.customers
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY customers_staff_manage ON public.customers
  FOR UPDATE USING (public.has_staff_role(ARRAY['administrator', 'store_manager']))
  WITH CHECK (public.has_staff_role(ARRAY['administrator', 'store_manager']));

-- Loyalty Programmes & Tiers
CREATE POLICY programmes_read ON public.loyalty_programmes
  FOR SELECT USING (status = 'active' OR public.is_active_staff());

CREATE POLICY programmes_admin_manage ON public.loyalty_programmes
  FOR ALL USING (public.has_permission('programmes.manage'))
  WITH CHECK (public.has_permission('programmes.manage'));

CREATE POLICY programme_tiers_read ON public.loyalty_programme_tiers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.loyalty_programmes lp
      WHERE lp.id = programme_id AND (lp.status = 'active' OR public.is_active_staff())
    )
  );

CREATE POLICY programme_tiers_admin_manage ON public.loyalty_programme_tiers
  FOR ALL USING (public.has_permission('programmes.manage'))
  WITH CHECK (public.has_permission('programmes.manage'));

-- Loyalty Cards (Strictly read-only via RLS; mutations via fn_award_stamps / fn_request_redemption)
CREATE POLICY loyalty_cards_select ON public.loyalty_cards
  FOR SELECT USING (
    customer_id = public.current_customer_id() OR public.has_permission('customers.read')
  );

-- Purchases (Customer reads own; Staff reads with permission; mutations via Edge Function)
CREATE POLICY purchases_select ON public.purchases
  FOR SELECT USING (
    customer_id = public.current_customer_id() OR public.has_permission('purchases.read')
  );

-- Stamp Transactions (Immutable; Customer reads own; Staff reads with permission)
CREATE POLICY stamp_tx_select ON public.stamp_transactions
  FOR SELECT USING (
    customer_id = public.current_customer_id() OR public.has_permission('stamps.read')
  );

-- Rewards Catalogue
CREATE POLICY rewards_read ON public.rewards
  FOR SELECT USING (status = 'active' OR public.is_active_staff());

CREATE POLICY rewards_manage ON public.rewards
  FOR ALL USING (public.has_permission('rewards.manage'))
  WITH CHECK (public.has_permission('rewards.manage'));

-- Customer Rewards & Redemptions (Customer reads own; Staff reads with permission; mutations via Edge Function)
CREATE POLICY customer_rewards_select ON public.customer_rewards
  FOR SELECT USING (
    customer_id = public.current_customer_id() OR public.has_permission('redemptions.verify')
  );

CREATE POLICY redemptions_select ON public.redemptions
  FOR SELECT USING (
    customer_id = public.current_customer_id() OR public.has_permission('redemptions.verify')
  );

-- Campaigns
CREATE POLICY campaigns_read ON public.campaigns
  FOR SELECT USING (status = 'active' OR public.is_active_staff());

CREATE POLICY campaigns_manage ON public.campaigns
  FOR ALL USING (public.has_permission('campaigns.manage'))
  WITH CHECK (public.has_permission('campaigns.manage'));

-- Surveys & Questions
CREATE POLICY surveys_read ON public.surveys
  FOR SELECT USING (status = 'published' OR public.is_active_staff());

CREATE POLICY surveys_manage ON public.surveys
  FOR ALL USING (public.has_permission('surveys.manage'))
  WITH CHECK (public.has_permission('surveys.manage'));

CREATE POLICY survey_questions_read ON public.survey_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.surveys sv
      WHERE sv.id = survey_id AND (sv.status = 'published' OR public.is_active_staff())
    )
  );

CREATE POLICY survey_questions_manage ON public.survey_questions
  FOR ALL USING (public.has_permission('surveys.manage'))
  WITH CHECK (public.has_permission('surveys.manage'));

-- Survey Responses (Customers insert/read own; staff with surveys.manage read all)
CREATE POLICY survey_responses_select ON public.survey_responses
  FOR SELECT USING (
    customer_id = public.current_customer_id() OR public.has_permission('surveys.manage')
  );

CREATE POLICY survey_responses_insert ON public.survey_responses
  FOR INSERT WITH CHECK (
    customer_id IS NULL OR customer_id = public.current_customer_id()
  );

-- Contact Messages (Admin/Manager read; public inserts go via submit-contact Edge Function)
CREATE POLICY contact_messages_staff_read ON public.contact_messages
  FOR SELECT USING (public.has_staff_role(ARRAY['administrator', 'store_manager']));

CREATE POLICY contact_messages_staff_update ON public.contact_messages
  FOR UPDATE USING (public.has_staff_role(ARRAY['administrator', 'store_manager']))
  WITH CHECK (public.has_staff_role(ARRAY['administrator', 'store_manager']));

-- Brand Settings
CREATE POLICY brand_settings_read ON public.brand_settings
  FOR SELECT USING (true);

CREATE POLICY brand_settings_admin_update ON public.brand_settings
  FOR UPDATE USING (public.has_staff_role(ARRAY['administrator']))
  WITH CHECK (public.has_staff_role(ARRAY['administrator']));

-- Audit Logs (Read-only for Administrators & Store Managers)
CREATE POLICY audit_logs_admin_read ON public.audit_logs
  FOR SELECT USING (public.has_staff_role(ARRAY['administrator', 'store_manager']));
