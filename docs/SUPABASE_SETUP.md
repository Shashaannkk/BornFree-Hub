# BONFREE-HUB — Supabase Backend Setup & Deployment Instructions

## 1. Create Project & Configure Secrets

1. Create a production Supabase project in your target region (e.g. `ap-south-1` Mumbai for India retail latency).
2. Retrieve from **Project Settings -> API**:
   - Project URL (`PUBLIC_SUPABASE_URL`)
   - `anon` public key (`PUBLIC_SUPABASE_ANON_KEY`)
   - `service_role` secret key (`SUPABASE_SERVICE_ROLE_KEY` — **server-only, never put in Vercel frontend env vars**)
3. Configure Supabase Edge Function secrets:
   ```bash
   supabase link --project-ref <YOUR_PROJECT_REF>
   supabase secrets set APP_ENV=production
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<YOUR_SERVICE_ROLE_KEY>
   supabase secrets set ALLOWED_ORIGIN=https://your-domain.com,https://www.your-domain.com,https://your-project.vercel.app
   ```

---

## 2. Database Migration Deployment (`0001` – `0011`)

Apply all migrations in exact numeric order (never skip a migration):

1. `supabase/migrations/0001_core_identity_and_rbac.sql`
2. `supabase/migrations/0002_loyalty_purchases_and_rewards.sql`
3. `supabase/migrations/0003_engagement_settings_and_audit.sql`
4. `supabase/migrations/0004_security_functions_and_rls.sql`
5. `supabase/migrations/0005_profile_guard_and_auto_card.sql`
6. `supabase/migrations/0006_loyalty_qr_and_programme_lifecycle.sql`
7. `supabase/migrations/0007_stamp_cooldown_and_idempotency.sql`
8. `supabase/migrations/0008_rewards_redemption_lifecycle.sql`
9. `supabase/migrations/0009_staff_rbac_and_audit.sql`
10. `supabase/migrations/0010_campaigns_and_surveys_lifecycle.sql`
11. `supabase/migrations/0011_analytics_reports_and_settings.sql`

```bash
supabase db push
```

### Safe Production Reference Seed (Non-Destructive)
For a **production** environment, run **`supabase/production_seed.sql`** (`ON CONFLICT DO NOTHING` — never deletes existing data and omits sample dev campaigns/surveys):
```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/production_seed.sql
```
*(Use `supabase/seed.sql` only in local/staging development environments.)*

---

## 3. Supabase Authentication, Email Verification & Password Reset URLs

In **Supabase Dashboard -> Authentication -> URL Configuration**:

- **Site URL:** `https://your-domain.com` (or `https://your-project.vercel.app` before custom DNS cutover)
- **Additional Redirect URLs:** add ALL active origins and routes:
  - `https://your-domain.com/**`
  - `https://www.your-domain.com/**`
  - `https://your-project.vercel.app/**`
  - `https://your-domain.com/login.html?reason=verified`
  - `https://your-domain.com/login?reason=verified`
  - `https://your-domain.com/reset-password.html`
  - `https://your-domain.com/reset-password`

### Email Provider & Templates
- Enable **Confirm email** under **Authentication -> Providers -> Email** so customer registrations require inbox verification before sign-in.
- Configure custom **SMTP** credentials in **Project Settings -> Authentication -> SMTP Settings** (recommended for production deliverability instead of Supabase's shared rate-limited mailer).

---

## 4. Deploy Edge Functions & Configure CORS

Deploy all 5 server-side Edge Functions:
```bash
supabase functions deploy issue-stamp
supabase functions deploy redeem-reward
supabase functions deploy manage-staff
supabase functions deploy submit-contact
supabase functions deploy admin-analytics
```
All 5 functions share `supabase/functions/_shared/cors.ts`, which reads comma-separated `ALLOWED_ORIGIN` values, matches exact request origins, sends `Vary: Origin`, and rejects wildcard `*` when `APP_ENV=production`.

---

## 5. Securely Creating the First Administrator Account

Never store administrator passwords in source code, `.env`, or SQL files. Provision the initial administrator via Supabase Dashboard + SQL Editor:

1. Open **Supabase Dashboard -> Authentication -> Users -> Invite user** (or **Add user** with `Auto Confirm User` enabled and send a password-setup link).
2. Copy the new user's `UUID` (`auth.users.id`).
3. Run the following transaction in **Supabase SQL Editor**:
   ```sql
   BEGIN;

   UPDATE auth.users
   SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"is_staff": true}'::jsonb
   WHERE id = '<ADMIN_AUTH_USER_UUID>';

   INSERT INTO public.profiles (id, full_name, email)
   VALUES ('<ADMIN_AUTH_USER_UUID>', '<Admin Full Name>', '<admin-email>')
   ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

   INSERT INTO public.staff (user_id, staff_code, role_id, store_id, department, status)
   VALUES (
     '<ADMIN_AUTH_USER_UUID>',
     'STF1001',
     (SELECT id FROM public.roles WHERE code = 'administrator'),
     (SELECT id FROM public.stores WHERE store_code = 'STR-BLR-01'),
     'Head Office — CRM',
     'active'
   );

   COMMIT;
   ```
4. The first administrator should immediately visit `/admin/login`, sign in (or complete the recovery/invite link), enable MFA if enforced in Supabase Auth, and create additional store manager, sales, and marketing accounts exclusively through **Admin Console -> Staff Management** (`/admin/staff`).

---

## 6. Run RLS & Security Verification Tests

Against a **staging** database (note: wrapped in `BEGIN ... ROLLBACK` so test rows do not persist):
```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_security_tests.sql
```
