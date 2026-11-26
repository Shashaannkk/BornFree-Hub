-- ============================================================================
-- BONFREE-HUB Development Seed Data (Non-Production Reference Setup Only)
--
-- Security rules:
-- - Seeds only static reference catalogues (roles, permissions, stores,
--   programmes, rewards, campaigns, sample survey, and brand defaults).
-- - Contains ZERO hardcoded production passwords and ZERO fake production users.
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

-- Stores
INSERT INTO public.stores (store_code, name, city, address, phone)
VALUES
  ('STR-BLR-01', 'BONFREE-HUB Flagship — MG Road', 'Bengaluru', 'Spectrum Mall, MG Road, Bengaluru 560001', '+91 98765 43210'),
  ('STR-DEL-01', 'BONFREE-HUB — Khan Market', 'New Delhi', 'Middle Lane, Khan Market, New Delhi 110003', '+91 98111 22334'),
  ('STR-MUM-01', 'BONFREE-HUB — Bandra West', 'Mumbai', 'Linking Road, Bandra West, Mumbai 400050', '+91 98200 33445')
ON CONFLICT (store_code) DO NOTHING;

-- Roles
INSERT INTO public.roles (code, name, description)
VALUES
  ('administrator', 'Administrator', 'Full access to loyalty rules, staff RBAC, reports, and brand settings.'),
  ('store_manager', 'Store Manager', 'Oversees store operations, stamp verification, redemptions, campaigns, and reports.'),
  ('sales_staff', 'Sales Staff', 'Scans member QR passes, awards stamps on qualifying purchases, and verifies redemptions.'),
  ('marketing_staff', 'Marketing Staff', 'Manages promotional campaigns, feedback surveys, and aggregate insights.')
ON CONFLICT (code) DO NOTHING;

-- Permissions
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
    -- Administrator: all permissions
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
    -- Store Manager
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
    -- Sales Staff
    ('sales_staff', 'customers.read'),
    ('sales_staff', 'purchases.read'),
    ('sales_staff', 'stamps.read'),
    ('sales_staff', 'stamps.issue'),
    ('sales_staff', 'redemptions.verify'),
    -- Marketing Staff
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

-- Default Loyalty Programmes
INSERT INTO public.loyalty_programmes (
  code, name, subtitle, description, status, stamp_goal, qualifying_amount_inr,
  calculation_rule, stamp_validity_months, reward_validity_months, eligibility_rule
)
VALUES
  (
    'PROG-CLASSIC',
    'Classic Stamps',
    'Spend · Collect · Redeem',
    'Spend · Collect · Redeem stamps on eligible streetwear & everyday fashion purchases.',
    'active', 10, 1000.00, 'per_threshold', 12, 6,
    'All registered members (in-store & verified channels)'
  ),
  (
    'PROG-PREMIUM',
    'Premium Circle',
    'Higher rewards for loyal shoppers',
    'Accelerated perks and priority capsule previews for frequent outerwear & denim buyers.',
    'active', 10, 2500.00, 'per_transaction', 12, 6,
    'Members with >= ₹15,000 lifetime qualifying spend'
  ),
  (
    'PROG-STREETWEAR',
    'Streetwear Club',
    'Exclusive rewards for streetwear lovers',
    'Campus & youth club programme tailored around oversized tees, cargos, and sneakers.',
    'inactive', 10, 1200.00, 'per_transaction', 12, 6,
    'Verified campus & Gen Z community signups'
  )
ON CONFLICT (code) DO NOTHING;

-- Programme Tiers
INSERT INTO public.loyalty_programme_tiers (programme_id, stamps_required, title, reward_value)
SELECT id, 5, 'Member Drop Credit', '₹250 Voucher' FROM public.loyalty_programmes WHERE code = 'PROG-CLASSIC'
ON CONFLICT DO NOTHING;

INSERT INTO public.loyalty_programme_tiers (programme_id, stamps_required, title, reward_value)
SELECT id, 10, 'Signature Store Reward', '₹500 Voucher' FROM public.loyalty_programmes WHERE code = 'PROG-CLASSIC'
ON CONFLICT DO NOTHING;

-- Rewards Catalogue
INSERT INTO public.rewards (
  code, programme_id, title, reward_type, value_label, discount_amount_inr, discount_percent,
  description, required_stamps, validity_months, redemption_limit_per_member, redemption_limit_label,
  eligibility_rule, eligibility_config, status
)
SELECT
  'RW-500-OFF',
  (SELECT id FROM public.loyalty_programmes WHERE code = 'PROG-CLASSIC'),
  '₹500 Off Store Voucher',
  'Fixed Discount',
  '₹500 Off',
  500.00,
  NULL,
  '₹500 off on streetwear & everyday fashion purchases of ₹2,000 or above.',
  10, 6, 4, '1 per card completion',
  'Active Classic Stamps members with >= 10 stamps', '{}'::jsonb, 'active'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.rewards (
  code, programme_id, title, reward_type, value_label, discount_amount_inr, discount_percent,
  description, required_stamps, validity_months, redemption_limit_per_member, redemption_limit_label,
  eligibility_rule, eligibility_config, status
)
SELECT
  'RW-15PCT',
  (SELECT id FROM public.loyalty_programmes WHERE code = 'PROG-CLASSIC'),
  'Streetwear Insider — 15% Off',
  'Percentage Discount',
  '15% Off',
  NULL,
  15.00,
  '15% off on oversized tees, boxy shirts, cargos, baggy jeans, and layered jackets.',
  15, 3, 2, '2 per member / year',
  'Active members with >= 15 stamps', '{}'::jsonb, 'active'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.rewards (
  code, programme_id, title, reward_type, value_label, discount_amount_inr, discount_percent,
  description, required_stamps, validity_months, redemption_limit_per_member, redemption_limit_label,
  eligibility_rule, eligibility_config, status
)
SELECT
  'RW-FREE-TEE',
  (SELECT id FROM public.loyalty_programmes WHERE code = 'PROG-CLASSIC'),
  'Complimentary Graphic Tee',
  'Free Product',
  'Free Heavyweight Tee',
  NULL,
  NULL,
  'Redeem 1 complimentary seasonal monochrome graphic tee from our core drop.',
  25, 6, 1, '1 per member',
  'Members with >= 25 stamps', '{}'::jsonb, 'active'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.rewards (
  code, programme_id, title, reward_type, value_label, discount_amount_inr, discount_percent,
  description, required_stamps, validity_months, redemption_limit_per_member, redemption_limit_label,
  eligibility_rule, eligibility_config, status
)
SELECT
  'RW-BIRTHDAY',
  NULL,
  'Birthday Month Streetwear Perk',
  'Birthday Reward',
  '₹750 Birthday Credit',
  750.00,
  NULL,
  'Celebrate your birthday month with ₹750 credit + priority fitting support.',
  5, 1, 1, 'Once per birth month',
  'Members celebrating their birth month', '{"birthday_month_only": true}'::jsonb, 'active'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.rewards (
  code, programme_id, title, reward_type, value_label, discount_amount_inr, discount_percent,
  description, required_stamps, validity_months, redemption_limit_per_member, redemption_limit_label,
  eligibility_rule, eligibility_config, status
)
SELECT
  'RW-EARLY-DROP',
  (SELECT id FROM public.loyalty_programmes WHERE code = 'PROG-PREMIUM'),
  'Early Access to New Drops',
  'Exclusive Member Offer',
  '48h Drop Preview',
  NULL,
  NULL,
  'Be first to shop limited streetwear capsules, denim washes, and collabs.',
  10, 12, NULL, 'Unlimited while active',
  'Premium Circle members (>= 10 lifetime stamps)', '{"min_lifetime_stamps": 10}'::jsonb, 'active'
ON CONFLICT (code) DO NOTHING;

-- Development Campaigns
INSERT INTO public.campaigns (
  title, description, image_path, programme_id, multiplier, bonus_stamps, promotional_rule,
  eligibility_rule, eligibility_config, start_date, end_date, status
)
VALUES
  (
    'New Drop Rewards',
    'Earn 2x loyalty stamps on new drop streetwear — oversized tees, cargos, baggy jeans and more.',
    'assets/images/hero-streetwear.jpg',
    (SELECT id FROM public.loyalty_programmes WHERE code = 'PROG-CLASSIC'),
    2.00,
    0,
    '2x Stamp Multiplier on New Arrivals',
    'Classic Stamps members on purchases >= ₹1,000',
    '{"min_purchase_inr": 1000}'::jsonb,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '45 days',
    'active'
  ),
  (
    'Denim Days',
    'Special rewards on denim — baggy jeans, relaxed fits and new washes for a modern everyday look.',
    'assets/images/streetwear-editorial.jpg',
    (SELECT id FROM public.loyalty_programmes WHERE code = 'PROG-CLASSIC'),
    1.00,
    1,
    '+1 Bonus Stamp on Denim Purchases >= ₹2,000',
    'Classic Stamps members spending >= ₹2,000',
    '{"min_purchase_inr": 2000}'::jsonb,
    CURRENT_DATE + INTERVAL '5 days',
    CURRENT_DATE + INTERVAL '60 days',
    'scheduled'
  ),
  (
    'Members'' Month Exclusive',
    'Priority capsule access + bonus stamp credit for Premium Circle members across flagship drops.',
    'assets/images/auth-login.jpg',
    (SELECT id FROM public.loyalty_programmes WHERE code = 'PROG-PREMIUM'),
    1.00,
    2,
    '+2 Bonus Stamps for Premium Circle',
    'Premium Circle members',
    '{"min_purchase_inr": 2500}'::jsonb,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    'active'
  )
ON CONFLICT DO NOTHING;

-- Sample Published Survey
INSERT INTO public.surveys (id, title, subtitle, status, published_at)
VALUES (
  '00000000-0000-4000-8000-000000000101',
  'Modern streetwear & everyday fashion',
  'Help us serve you better. Share your experience with BONFREE-HUB.',
  'published',
  now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.survey_questions (survey_id, question_type, prompt, options, sort_order)
VALUES
  ('00000000-0000-4000-8000-000000000101', 'rating', 'How would you rate your overall shopping & loyalty experience at BONFREE-HUB?', '[]'::jsonb, 1),
  ('00000000-0000-4000-8000-000000000101', 'multiple_choice', 'What do you like the most about our collections?', '["Oversized tees & casual basics","Trendy boxy shirts","Cargos & baggy jeans","Layered jackets & crop tops"]'::jsonb, 2),
  ('00000000-0000-4000-8000-000000000101', 'short_answer', 'Which streetwear fit or colourway should we restock next?', '[]'::jsonb, 3),
  ('00000000-0000-4000-8000-000000000101', 'long_answer', 'Any suggestions to make your BONFREE-HUB loyalty rewards even better?', '[]'::jsonb, 4)
ON CONFLICT DO NOTHING;
