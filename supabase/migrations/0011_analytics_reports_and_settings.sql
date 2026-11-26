-- ============================================================================
-- BONFREE-HUB Migration 0011: Analytics Aggregation, Indexes & Real Settings
-- ============================================================================

-- 1. Performance Indexes for Analytics & Reports Date-Range Filtering
CREATE INDEX IF NOT EXISTS idx_customers_joined_at
  ON public.customers (joined_at DESC);

CREATE INDEX IF NOT EXISTS idx_customers_status_joined
  ON public.customers (status, joined_at DESC);

CREATE INDEX IF NOT EXISTS idx_stamp_tx_type_created
  ON public.stamp_transactions (tx_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_purchases_qualifying_date
  ON public.purchases (is_qualifying, purchased_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_rewards_status_unlocked
  ON public.customer_rewards (status, unlocked_at DESC);

CREATE INDEX IF NOT EXISTS idx_redemptions_status_processed
  ON public.redemptions (status, processed_at DESC);

-- 2. Honest Security Settings Defaults & Staff Account Preferences
ALTER TABLE public.brand_settings
  ALTER COLUMN two_factor_required SET DEFAULT false,
  ALTER COLUMN login_alerts_enabled SET DEFAULT false,
  ALTER COLUMN high_value_redemption_alerts SET DEFAULT false;

-- Do not report unconfigured TOTP 2FA or email webhook features as enabled by default
UPDATE public.brand_settings
SET two_factor_required = false,
    login_alerts_enabled = false,
    high_value_redemption_alerts = false
WHERE id = true;

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT jsonb_build_object(
    'dailySummaryView', true,
    'compactTables', false
  );

CREATE OR REPLACE FUNCTION public.guard_staff_self_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.has_permission('staff.manage') THEN
    IF NEW.id <> OLD.id
      OR NEW.user_id <> OLD.user_id
      OR NEW.staff_code <> OLD.staff_code
      OR NEW.role_id <> OLD.role_id
      OR COALESCE(NEW.store_id::text, '') <> COALESCE(OLD.store_id::text, '')
      OR NEW.department <> OLD.department
      OR NEW.status <> OLD.status THEN
      RAISE EXCEPTION 'Unauthorized modification of protected staff fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_staff_self_update ON public.staff;
CREATE TRIGGER trg_guard_staff_self_update
  BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.guard_staff_self_update();

DROP POLICY IF EXISTS staff_self_preferences_update ON public.staff;
CREATE POLICY staff_self_preferences_update ON public.staff
  FOR UPDATE USING (user_id = auth.uid() AND status = 'active')
  WITH CHECK (user_id = auth.uid() AND status = 'active');

-- Allow settings.manage holders to update primary store contact details too
DROP POLICY IF EXISTS stores_admin_manage ON public.stores;
CREATE POLICY stores_admin_manage ON public.stores
  FOR ALL USING (public.has_permission('settings.manage') OR public.has_staff_role(ARRAY['administrator']))
  WITH CHECK (public.has_permission('settings.manage') OR public.has_staff_role(ARRAY['administrator']));

-- 3. Server-Side Analytics Aggregation RPC (Real DB metrics, zero placeholder values)
CREATE OR REPLACE FUNCTION public.fn_analytics_summary(
  p_start_date date DEFAULT (CURRENT_DATE - 30),
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_start date := COALESCE(p_start_date, CURRENT_DATE - 30);
  v_end date := GREATEST(COALESCE(p_end_date, CURRENT_DATE), COALESCE(p_start_date, CURRENT_DATE - 30));
  v_start_ts timestamptz := v_start::timestamptz;
  v_end_ts timestamptz := (v_end + 1)::timestamptz - interval '1 microsecond';
  v_total_members bigint := 0;
  v_active_members bigint := 0;
  v_new_reg_in_range bigint := 0;
  v_total_cards bigint := 0;
  v_stamps_awarded bigint := 0;
  v_rewards_unlocked bigint := 0;
  v_rewards_redeemed bigint := 0;
  v_qualifying_purchases bigint := 0;
  v_qualifying_revenue numeric := 0;
  v_distinct_buyers bigint := 0;
  v_avg_frequency numeric := 0;
  v_daily_reg jsonb := '[]'::jsonb;
  v_monthly_growth jsonb := '[]'::jsonb;
  v_stamp_bars jsonb := '[]'::jsonb;
  v_active_customers jsonb := '[]'::jsonb;
  v_prog_perf jsonb := '[]'::jsonb;
  v_staff_act jsonb := '[]'::jsonb;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE status = 'active')
  INTO v_total_members, v_active_members
  FROM public.customers;

  SELECT count(*) INTO v_new_reg_in_range
  FROM public.customers
  WHERE joined_at BETWEEN v_start_ts AND v_end_ts;

  SELECT count(*) INTO v_total_cards
  FROM public.loyalty_cards;

  SELECT COALESCE(sum(stamps_delta), 0) INTO v_stamps_awarded
  FROM public.stamp_transactions
  WHERE tx_type = 'earned'
    AND created_at BETWEEN v_start_ts AND v_end_ts;

  SELECT count(*) INTO v_rewards_unlocked
  FROM public.customer_rewards
  WHERE unlocked_at BETWEEN v_start_ts AND v_end_ts;

  SELECT count(*) INTO v_rewards_redeemed
  FROM public.redemptions
  WHERE status = 'completed'
    AND processed_at BETWEEN v_start_ts AND v_end_ts;

  SELECT count(*), COALESCE(sum(amount_inr), 0), count(DISTINCT customer_id)
  INTO v_qualifying_purchases, v_qualifying_revenue, v_distinct_buyers
  FROM public.purchases
  WHERE is_qualifying = true
    AND purchased_at BETWEEN v_start_ts AND v_end_ts;

  IF v_distinct_buyers > 0 THEN
    v_avg_frequency := round(v_qualifying_purchases::numeric / v_distinct_buyers::numeric, 2);
  END IF;

  -- Daily registrations across range (up to recent 14 active days)
  SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.day), '[]'::jsonb)
  INTO v_daily_reg
  FROM (
    SELECT
      to_char(date_trunc('day', joined_at), 'DD Mon') AS label,
      to_char(date_trunc('day', joined_at), 'YYYY-MM-DD') AS day,
      count(*)::integer AS count
    FROM public.customers
    WHERE joined_at BETWEEN v_start_ts AND v_end_ts
    GROUP BY 1, 2
    ORDER BY 2 DESC
    LIMIT 14
  ) d;

  -- Monthly cumulative customer growth (last 6 months ending at v_end)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'label', to_char(m.month_start, 'Mon'),
    'month', to_char(m.month_start, 'YYYY-MM'),
    'registrations', (
      SELECT count(*)::integer FROM public.customers c
      WHERE date_trunc('month', c.joined_at) = m.month_start
    ),
    'total', (
      SELECT count(*)::integer FROM public.customers c
      WHERE c.joined_at < (m.month_start + interval '1 month')
    )
  ) ORDER BY m.month_start), '[]'::jsonb)
  INTO v_monthly_growth
  FROM generate_series(
    date_trunc('month', v_end::timestamp) - interval '5 months',
    date_trunc('month', v_end::timestamp),
    interval '1 month'
  ) AS m(month_start);

  -- Stamp issuance bars bucketed across range
  IF (v_end - v_start) <= 14 THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'label', to_char(d.day, 'DD Mon'),
      'value', COALESCE((
        SELECT sum(st.stamps_delta)::integer
        FROM public.stamp_transactions st
        WHERE st.tx_type = 'earned'
          AND st.created_at::date = d.day::date
      ), 0)
    ) ORDER BY d.day), '[]'::jsonb)
    INTO v_stamp_bars
    FROM generate_series(GREATEST(v_start, v_end - 6)::timestamp, v_end::timestamp, interval '1 day') AS d(day);
  ELSE
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'label', 'Wk ' || row_number() OVER (ORDER BY w.wk_start),
      'value', COALESCE((
        SELECT sum(st.stamps_delta)::integer
        FROM public.stamp_transactions st
        WHERE st.tx_type = 'earned'
          AND st.created_at >= GREATEST(w.wk_start, v_start_ts)
          AND st.created_at <= LEAST(w.wk_start + interval '7 days' - interval '1 microsecond', v_end_ts)
      ), 0)
    ) ORDER BY w.wk_start), '[]'::jsonb)
    INTO v_stamp_bars
    FROM generate_series(date_trunc('week', v_start::timestamp), date_trunc('week', v_end::timestamp), interval '1 week') AS w(wk_start);
  END IF;

  -- Most active customers
  SELECT COALESCE(jsonb_agg(row_to_json(ac)), '[]'::jsonb)
  INTO v_active_customers
  FROM (
    SELECT
      row_number() OVER (ORDER BY COALESCE(sp.spend, 0) DESC, c.created_at ASC)::integer AS rank,
      p.full_name AS name,
      c.membership_id AS "memberId",
      COALESCE(st.earned_stamps, 0)::integer AS "stampsEarned",
      COALESCE(rd.redeemed_count, 0)::integer AS "rewardsRedeemed",
      COALESCE(sp.spend, 0)::numeric AS "totalSpendInr"
    FROM public.customers c
    JOIN public.profiles p ON p.id = c.user_id
    LEFT JOIN (
      SELECT customer_id, sum(stamps_delta) AS earned_stamps
      FROM public.stamp_transactions
      WHERE tx_type = 'earned' AND created_at BETWEEN v_start_ts AND v_end_ts
      GROUP BY customer_id
    ) st ON st.customer_id = c.id
    LEFT JOIN (
      SELECT customer_id, count(*) AS redeemed_count
      FROM public.redemptions
      WHERE status = 'completed' AND processed_at BETWEEN v_start_ts AND v_end_ts
      GROUP BY customer_id
    ) rd ON rd.customer_id = c.id
    LEFT JOIN (
      SELECT customer_id, sum(amount_inr) AS spend
      FROM public.purchases
      WHERE is_qualifying = true AND purchased_at BETWEEN v_start_ts AND v_end_ts
      GROUP BY customer_id
    ) sp ON sp.customer_id = c.id
    WHERE COALESCE(sp.spend, 0) > 0 OR COALESCE(st.earned_stamps, 0) > 0
    ORDER BY COALESCE(sp.spend, 0) DESC, COALESCE(st.earned_stamps, 0) DESC
    LIMIT 10
  ) ac;

  -- Loyalty programme performance
  SELECT COALESCE(jsonb_agg(row_to_json(pp)), '[]'::jsonb)
  INTO v_prog_perf
  FROM (
    SELECT
      lp.name,
      count(DISTINCT lc.customer_id)::integer AS members,
      COALESCE(st.stamps_sum, 0)::integer AS stamps,
      COALESCE(rd.redemptions_cnt, 0)::integer AS "rewardsRedeemed",
      CASE
        WHEN count(DISTINCT lc.customer_id) > 0
          THEN round((COALESCE(rd.redemptions_cnt, 0)::numeric / count(DISTINCT lc.customer_id)::numeric) * 100, 1)::text || '%'
        ELSE '0.0%'
      END AS "redemptionRate"
    FROM public.loyalty_programmes lp
    LEFT JOIN public.loyalty_cards lc ON lc.programme_id = lp.id
    LEFT JOIN (
      SELECT programme_id, sum(stamps_delta) AS stamps_sum
      FROM public.stamp_transactions
      WHERE tx_type = 'earned' AND created_at BETWEEN v_start_ts AND v_end_ts
      GROUP BY programme_id
    ) st ON st.programme_id = lp.id
    LEFT JOIN (
      SELECT rw.programme_id, count(*) AS redemptions_cnt
      FROM public.redemptions r
      JOIN public.rewards rw ON rw.id = r.reward_id
      WHERE r.status = 'completed' AND r.processed_at BETWEEN v_start_ts AND v_end_ts
      GROUP BY rw.programme_id
    ) rd ON rd.programme_id = lp.id
    GROUP BY lp.id, lp.name, st.stamps_sum, rd.redemptions_cnt
    ORDER BY stamps DESC, members DESC
  ) pp;

  -- Staff operational activity
  SELECT COALESCE(jsonb_agg(row_to_json(sa)), '[]'::jsonb)
  INTO v_staff_act
  FROM (
    SELECT
      s.staff_code AS id,
      COALESCE(p.full_name, s.staff_code) AS name,
      rl.name AS role,
      COALESCE(st.stamps_cnt, 0)::integer AS "stampsIssuedCount",
      COALESCE(rd.rdm_cnt, 0)::integer AS "redemptionsVerifiedCount"
    FROM public.staff s
    JOIN public.roles rl ON rl.id = s.role_id
    LEFT JOIN public.profiles p ON p.id = s.user_id
    LEFT JOIN (
      SELECT staff_id, sum(stamps_delta) AS stamps_cnt
      FROM public.stamp_transactions
      WHERE tx_type = 'earned' AND created_at BETWEEN v_start_ts AND v_end_ts
      GROUP BY staff_id
    ) st ON st.staff_id = s.id
    LEFT JOIN (
      SELECT verified_by_staff_id, count(*) AS rdm_cnt
      FROM public.redemptions
      WHERE verified_by_staff_id IS NOT NULL AND processed_at BETWEEN v_start_ts AND v_end_ts
      GROUP BY verified_by_staff_id
    ) rd ON rd.verified_by_staff_id = s.id
    ORDER BY COALESCE(st.stamps_cnt, 0) + COALESCE(rd.rdm_cnt, 0) DESC, s.staff_code
  ) sa;

  RETURN jsonb_build_object(
    'startDate', v_start,
    'endDate', v_end,
    'totalMembers', v_total_members,
    'activeMembers', v_active_members,
    'newRegistrations', v_new_reg_in_range,
    'totalLoyaltyCards', v_total_cards,
    'stampsAwarded', v_stamps_awarded,
    'rewardsUnlocked', v_rewards_unlocked,
    'rewardsRedeemed', v_rewards_redeemed,
    'qualifyingPurchases', v_qualifying_purchases,
    'qualifyingRevenueInr', v_qualifying_revenue,
    'avgPurchaseFrequency', v_avg_frequency,
    'dailyRegistrations', v_daily_reg,
    'monthlyGrowth', v_monthly_growth,
    'stampBars', v_stamp_bars,
    'mostActiveCustomers', v_active_customers,
    'programmePerformance', v_prog_perf,
    'staffActivity', v_staff_act
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_analytics_summary(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_analytics_summary(date, date) TO service_role;
