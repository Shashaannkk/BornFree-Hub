-- ============================================================================
-- BONFREE-HUB Migration 0009: Staff RBAC Completeness, Active Context & Audit
-- ============================================================================

-- 1. Ensure complete granular permissions across all console modules (including customers & settings)
INSERT INTO public.permissions (code, module, description)
VALUES
  ('customers.read', 'customers', 'View customer directory and loyalty balances'),
  ('customers.manage', 'customers', 'Edit customer profiles and membership status'),
  ('purchases.read', 'purchases', 'View store purchase records and receipts'),
  ('stamps.read', 'stamps', 'View stamp transaction ledger'),
  ('stamps.issue', 'scanner', 'Verify receipts and issue loyalty stamps'),
  ('rewards.manage', 'rewards', 'Create, edit, and toggle reward catalogue items'),
  ('redemptions.verify', 'redemptions', 'Verify, confirm, or reject voucher redemptions'),
  ('programmes.manage', 'loyalty', 'Create and configure loyalty programmes'),
  ('campaigns.manage', 'campaigns', 'Create and toggle promotional campaigns'),
  ('surveys.manage', 'surveys', 'Build surveys and inspect customer feedback'),
  ('staff.manage', 'staff', 'Provision staff, assign roles, and manage granular permissions'),
  ('analytics.view', 'analytics', 'View aggregated loyalty analytics'),
  ('reports.export', 'reports', 'Preview and export authorized CSV reports'),
  ('settings.manage', 'settings', 'Modify brand details, default validity rules, and security settings')
ON CONFLICT (code) DO NOTHING;

-- Assign new granular permissions to existing seeded roles cleanly
WITH rp(role_code, perm_code) AS (
  VALUES
    ('administrator', 'customers.manage'),
    ('administrator', 'settings.manage'),
    ('store_manager', 'customers.manage')
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM rp
JOIN public.roles r ON r.code = rp.role_code
JOIN public.permissions p ON p.code = rp.perm_code
ON CONFLICT DO NOTHING;

-- 2. Enforce permission-based RLS on customers management, staff management & brand settings
DROP POLICY IF EXISTS customers_staff_manage ON public.customers;
CREATE POLICY customers_staff_manage ON public.customers
  FOR UPDATE USING (public.has_permission('customers.manage'))
  WITH CHECK (public.has_permission('customers.manage'));

DROP POLICY IF EXISTS brand_settings_admin_update ON public.brand_settings;
CREATE POLICY brand_settings_admin_update ON public.brand_settings
  FOR UPDATE USING (public.has_permission('settings.manage'))
  WITH CHECK (public.has_permission('settings.manage'));

DROP POLICY IF EXISTS staff_select ON public.staff;
CREATE POLICY staff_select ON public.staff
  FOR SELECT USING (
    user_id = auth.uid() OR public.has_permission('staff.manage') OR public.has_staff_role(ARRAY['administrator', 'store_manager'])
  );

DROP POLICY IF EXISTS staff_admin_manage ON public.staff;
CREATE POLICY staff_admin_manage ON public.staff
  FOR ALL USING (public.has_permission('staff.manage'))
  WITH CHECK (public.has_permission('staff.manage'));

DROP POLICY IF EXISTS staff_permissions_admin_manage ON public.staff_permissions;
CREATE POLICY staff_permissions_admin_manage ON public.staff_permissions
  FOR ALL USING (public.has_permission('staff.manage'))
  WITH CHECK (public.has_permission('staff.manage'));

-- 3. Audit triggers for brand settings and loyalty programmes
CREATE OR REPLACE FUNCTION public.audit_admin_config_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_staff_id uuid;
BEGIN
  SELECT id INTO v_staff_id
  FROM public.staff
  WHERE user_id = auth.uid()
  LIMIT 1;

  INSERT INTO public.audit_logs (actor_user_id, actor_staff_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(),
    v_staff_id,
    TG_TABLE_NAME || '.' || lower(TG_OP),
    TG_TABLE_NAME,
    NULLIF((to_jsonb(NEW) ->> 'id'), '')::uuid,
    jsonb_build_object('op', TG_OP, 'table', TG_TABLE_NAME)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_loyalty_programmes_dml ON public.loyalty_programmes;
CREATE TRIGGER trg_audit_loyalty_programmes_dml
  AFTER INSERT OR UPDATE ON public.loyalty_programmes
  FOR EACH ROW EXECUTE FUNCTION public.audit_admin_config_changes();

CREATE OR REPLACE FUNCTION public.audit_brand_settings_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_staff_id uuid;
BEGIN
  SELECT id INTO v_staff_id
  FROM public.staff
  WHERE user_id = auth.uid()
  LIMIT 1;

  INSERT INTO public.audit_logs (actor_user_id, actor_staff_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(),
    v_staff_id,
    'settings.updated',
    'brand_settings',
    NULL,
    jsonb_build_object(
      'brand_name', NEW.brand_name,
      'default_stamp_validity_months', NEW.default_stamp_validity_months,
      'default_reward_validity_months', NEW.default_reward_validity_months,
      'two_factor_required', NEW.two_factor_required
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_brand_settings_update ON public.brand_settings;
CREATE TRIGGER trg_audit_brand_settings_update
  AFTER UPDATE ON public.brand_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_brand_settings_update();

-- 4. Server-resolved active staff context & effective permissions for authenticated callers
--    Deactivated staff immediately get active = false even with an existing JWT.
CREATE OR REPLACE FUNCTION public.fn_my_staff_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_staff public.staff%ROWTYPE;
  v_role public.roles%ROWTYPE;
  v_prof public.profiles%ROWTYPE;
  v_perms text[] := ARRAY[]::text[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'is_staff', false, 'active', false);
  END IF;

  SELECT * INTO v_staff
  FROM public.staff
  WHERE user_id = v_uid
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'is_staff', false, 'active', false);
  END IF;

  IF v_staff.status <> 'active' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'is_staff', true,
      'active', false,
      'status', v_staff.status,
      'staff_code', v_staff.staff_code
    );
  END IF;

  SELECT * INTO v_role FROM public.roles WHERE id = v_staff.role_id;
  SELECT * INTO v_prof FROM public.profiles WHERE id = v_uid;

  SELECT COALESCE(array_agg(p.code ORDER BY p.code), ARRAY[]::text[]) INTO v_perms
  FROM public.permissions p
  LEFT JOIN public.staff_permissions sp
    ON sp.staff_id = v_staff.id AND sp.permission_id = p.id
  LEFT JOIN public.role_permissions rp
    ON rp.role_id = v_staff.role_id AND rp.permission_id = p.id
  WHERE COALESCE(sp.granted, rp.permission_id IS NOT NULL, false) = true;

  RETURN jsonb_build_object(
    'ok', true,
    'is_staff', true,
    'active', true,
    'id', v_staff.id,
    'staff_code', v_staff.staff_code,
    'status', v_staff.status,
    'role_code', v_role.code,
    'role_name', v_role.name,
    'store_id', v_staff.store_id,
    'department', v_staff.department,
    'full_name', COALESCE(v_prof.full_name, v_staff.staff_code),
    'email', COALESCE(v_prof.email, ''),
    'permissions', to_jsonb(v_perms)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.audit_admin_config_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_brand_settings_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_my_staff_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_my_staff_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_my_staff_context() TO service_role;
