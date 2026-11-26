-- ============================================================================
-- BONFREE-HUB Production Reference Seed (Idempotent / Safe Non-Destructive)
--
-- Security & Data Hygiene Rules:
-- - NEVER deletes or truncates existing records (`ON CONFLICT DO NOTHING` only).
-- - Contains ZERO development fixtures, ZERO fake customers, ZERO sample surveys,
--   and ZERO hardcoded passwords or staff accounts.
-- - Seeds only baseline brand defaults, store locations, RBAC roles/permissions,
--   and the default Classic Stamps programme shell.
-- ============================================================================

INSERT INTO public.brand_settings (
  id, brand_name, tagline, support_email, support_phone, address,
  default_stamp_validity_months, default_reward_validity_months,
  two_factor_required, login_alerts_enabled, high_value_redemption_alerts
)
VALUES (
  true,
  'BONFREE-HUB',
  'Modern Streetwear & Everyday Fashion',
  'care@bonfree-hub.in',
  '+91 98765 43210',
  'Spectrum Mall, MG Road, Bengaluru — 560001, India',
  12,
  6,
  false,
  false,
  false
)
ON CONFLICT (id) DO NOTHING;

-- Retail Store Locations
INSERT INTO public.stores (store_code, name, city, address, phone)
VALUES
  ('STR-BLR-01', 'BONFREE-HUB Flagship — MG Road', 'Bengaluru', 'Spectrum Mall, MG Road, Bengaluru 560001', '+91 98765 43210'),
  ('STR-DEL-01', 'BONFREE-HUB — Khan Market', 'New Delhi', 'Middle Lane, Khan Market, New Delhi 110003', '+91 98111 22334'),
  ('STR-MUM-01', 'BONFREE-HUB — Bandra West', 'Mumbai', 'Linking Road, Bandra West, Mumbai 400050', '+91 98200 33445')
ON CONFLICT (store_code) DO NOTHING;

-- RBAC Roles
INSERT INTO public.roles (code, name, description)
VALUES
  ('administrator', 'Administrator', 'Full access to loyalty rules, staff RBAC, reports, and brand settings.'),
  ('store_manager', 'Store Manager', 'Oversees store operations, stamp verification, redemptions, campaigns, and reports.'),
  ('sales_staff', 'Sales Staff', 'Scans member QR passes, awards stamps on qualifying purchases, and verifies redemptions.'),
  ('marketing_staff', 'Marketing Staff', 'Manages promotional campaigns, feedback surveys, and aggregate insights.')
ON CONFLICT (code) DO NOTHING;

-- Granular Module Permissions
INSERT INTO public.permissions (code, module, description)
VALUES
  ('customers.read', 'customers', 'View customer directory and loyalty balances'),
  ('customers.manage', 'customers', 'Edit customer profiles and membership status'),
  ('purchases.read', 'purchases', 'View store purchase records and receipts'),
  ('stamps.read', 'stamps', 'View stamp transaction ledger'),
  ('stamps.issue', 'scanner', 'Verify receipts and issue loyalty stamps'),
  ('rewards.manage', 'rewards', 'Create and edit reward catalogue items'),
  ('redemptions.verify', 'redemptions', 'Verify, confirm, or reject voucher redemptions'),
  ('programmes.manage', 'loyalty', 'Create and configure loyalty programmes'),
  ('campaigns.manage', 'campaigns', 'Create and toggle promotional campaigns'),
  ('surveys.manage', 'surveys', 'Build surveys and inspect customer feedback'),
  ('staff.manage', 'staff', 'Provision and manage staff accounts and permissions'),
  ('analytics.view', 'analytics', 'View aggregated loyalty analytics'),
  ('reports.export', 'reports', 'Preview and export authorized CSV reports'),
  ('settings.manage', 'settings', 'Modify brand details, validity defaults, and security settings')
ON CONFLICT (code) DO NOTHING;

-- Default Role-to-Permission Mappings
WITH rp(role_code, perm_code) AS (
  VALUES
    ('administrator', 'customers.read'),
    ('administrator', 'customers.manage'),
    ('administrator', 'purchases.read'),
    ('administrator', 'stamps.read'),
    ('administrator', 'stamps.issue'),
    ('administrator', 'rewards.manage'),
    ('administrator', 'redemptions.verify'),
    ('administrator', 'programmes.manage'),
    ('administrator', 'campaigns.manage'),
    ('administrator', 'surveys.manage'),
    ('administrator', 'staff.manage'),
    ('administrator', 'analytics.view'),
    ('administrator', 'reports.export'),
    ('administrator', 'settings.manage'),
    ('store_manager', 'customers.read'),
    ('store_manager', 'customers.manage'),
    ('store_manager', 'purchases.read'),
    ('store_manager', 'stamps.read'),
    ('store_manager', 'stamps.issue'),
    ('store_manager', 'rewards.manage'),
    ('store_manager', 'redemptions.verify'),
    ('store_manager', 'campaigns.manage'),
    ('store_manager', 'analytics.view'),
    ('store_manager', 'reports.export'),
    ('sales_staff', 'customers.read'),
    ('sales_staff', 'purchases.read'),
    ('sales_staff', 'stamps.read'),
    ('sales_staff', 'stamps.issue'),
    ('sales_staff', 'redemptions.verify'),
    ('marketing_staff', 'campaigns.manage'),
    ('marketing_staff', 'surveys.manage'),
    ('marketing_staff', 'analytics.view')
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM rp
JOIN public.roles r ON r.code = rp.role_code
JOIN public.permissions p ON p.code = rp.perm_code
ON CONFLICT DO NOTHING;

-- Baseline Active Loyalty Programme (Safe to skip if already configured)
INSERT INTO public.loyalty_programmes (
  code, name, subtitle, description, status, stamp_goal, qualifying_amount_inr,
  calculation_rule, stamp_validity_months, reward_validity_months, eligibility_rule
)
VALUES (
  'PROG-CLASSIC',
  'Classic Stamps',
  'Spend · Collect · Redeem',
  'Earn 1 stamp per ₹1,000 qualifying in-store spend and unlock loyalty rewards.',
  'active', 10, 1000.00, 'per_threshold', 12, 6,
  'All registered BONFREE-HUB members'
)
ON CONFLICT (code) DO NOTHING;
