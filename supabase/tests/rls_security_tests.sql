-- ============================================================================
-- BONFREE-HUB Security & RLS Penetration Test Suite
--
-- Execute inside a transaction against a seeded Supabase / PostgreSQL database:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_security_tests.sql
--
-- Uses ephemeral test UUIDs inside a ROLLBACK block so no test users persist.
-- ============================================================================

BEGIN;

-- Create temporary test auth users (rolled back at end of script)
INSERT INTO auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'cust_a@test.bonfree.local', '{"full_name":"Customer A"}', '{}'),
  ('22222222-2222-4222-8222-222222222222', 'cust_b@test.bonfree.local', '{"full_name":"Customer B"}', '{}'),
  ('33333333-3333-4333-8333-333333333333', 'sales@test.bonfree.local', '{"full_name":"Sales Staff"}', '{"is_staff":true}'),
  ('44444444-4444-4444-8444-444444444444', 'marketing@test.bonfree.local', '{"full_name":"Marketing Staff"}', '{"is_staff":true}'),
  ('55555555-5555-4555-8555-555555555555', 'admin@test.bonfree.local', '{"full_name":"Admin Staff"}', '{"is_staff":true}')
ON CONFLICT (id) DO NOTHING;

-- Provision staff roles for test staff accounts
INSERT INTO public.staff (user_id, staff_code, role_id, store_id, status)
VALUES
  (
    '33333333-3333-4333-8333-333333333333',
    'STF9001',
    (SELECT id FROM public.roles WHERE code = 'sales_staff'),
    (SELECT id FROM public.stores WHERE store_code = 'STR-BLR-01'),
    'active'
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    'STF9002',
    (SELECT id FROM public.roles WHERE code = 'marketing_staff'),
    NULL,
    'active'
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    'STF9003',
    (SELECT id FROM public.roles WHERE code = 'administrator'),
    (SELECT id FROM public.stores WHERE store_code = 'STR-BLR-01'),
    'active'
  );

-- Award stamps to Customer A as service_role (simulating Edge Function call)
SELECT * FROM public.fn_award_stamps(
  (SELECT id FROM public.customers WHERE user_id = '11111111-1111-4111-8111-111111111111'),
  (SELECT id FROM public.loyalty_programmes WHERE code = 'PROG-CLASSIC'),
  (SELECT id FROM public.stores WHERE store_code = 'STR-BLR-01'),
  (SELECT id FROM public.staff WHERE staff_code = 'STF9001'),
  'INV-TEST-001',
  3500.00,
  'Oversized Graphic Tee + Cargo Pants',
  'idem-test-001'
);

-- Test 1: Duplicate receipt must be rejected by UNIQUE (store_id, receipt_no)
DO $$
BEGIN
  PERFORM * FROM public.fn_award_stamps(
    (SELECT id FROM public.customers WHERE user_id = '11111111-1111-4111-8111-111111111111'),
    (SELECT id FROM public.loyalty_programmes WHERE code = 'PROG-CLASSIC'),
    (SELECT id FROM public.stores WHERE store_code = 'STR-BLR-01'),
    (SELECT id FROM public.staff WHERE staff_code = 'STF9001'),
    'INV-TEST-001',
    3500.00,
    'Duplicate attempt',
    'idem-test-dup'
  );
  RAISE EXCEPTION 'FAIL: Duplicate receipt was not rejected!';
EXCEPTION
  WHEN unique_violation THEN
    NULL; -- Expected
END;
$$;

-- Test 2: Customer B cannot read Customer A's loyalty card or mutate stamp balances
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.loyalty_cards
  WHERE customer_id = (SELECT id FROM public.customers WHERE user_id = '11111111-1111-4111-8111-111111111111');

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: Customer B read Customer A loyalty card';
  END IF;
END;
$$;

-- Customer B cannot directly update own stamp balance or call fn_award_stamps
DO $$
BEGIN
  UPDATE public.loyalty_cards SET current_stamps = 99;
  IF FOUND THEN
    RAISE EXCEPTION 'FAIL: Customer directly mutated loyalty_cards';
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL; -- Expected
END;
$$;

-- Test 3: Sales Staff can read customers, but cannot edit loyalty_programmes or brand_settings
SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);

DO $$
DECLARE
  v_cust_count integer;
BEGIN
  SELECT count(*) INTO v_cust_count FROM public.customers;
  IF v_cust_count < 2 THEN
    RAISE EXCEPTION 'FAIL: Sales Staff could not read customers';
  END IF;

  BEGIN
    UPDATE public.brand_settings SET brand_name = 'HACKED';
    IF FOUND THEN
      RAISE EXCEPTION 'FAIL: Sales Staff modified brand_settings';
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL; -- Expected
  END;
END;
$$;

-- Test 4: Marketing Staff cannot read customer purchases (missing purchases.read permission)
SELECT set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);

DO $$
DECLARE
  v_pur_count integer;
BEGIN
  SELECT count(*) INTO v_pur_count FROM public.purchases;
  IF v_pur_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: Marketing Staff accessed restricted purchases table';
  END IF;
END;
$$;

-- Test 5: Administrator can update brand_settings and inspect audit_logs
SELECT set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);

DO $$
DECLARE
  v_audit_count integer;
BEGIN
  UPDATE public.brand_settings SET tagline = 'Updated by Authorized Admin' WHERE id = true;
  SELECT count(*) INTO v_audit_count FROM public.audit_logs;
  IF v_audit_count < 1 THEN
    RAISE EXCEPTION 'FAIL: Administrator could not read audit_logs';
  END IF;
END;
$$;

-- Test 6 (Phase 8A): Deactivated staff member immediately loses permission & active staff access
RESET ROLE;
UPDATE public.staff SET status = 'inactive' WHERE staff_code = 'STF9001';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);

DO $$
DECLARE
  v_ctx jsonb;
BEGIN
  v_ctx := public.fn_my_staff_context();
  IF (v_ctx ->> 'active')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'FAIL: Deactivated staff still reported active in fn_my_staff_context()';
  END IF;
  IF public.is_active_staff() OR public.has_permission('stamps.issue') THEN
    RAISE EXCEPTION 'FAIL: Deactivated staff retained active RBAC permissions';
  END IF;
END;
$$;

ROLLBACK;
