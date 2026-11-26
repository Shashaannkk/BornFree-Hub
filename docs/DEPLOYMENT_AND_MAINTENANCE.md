# BONFREE-HUB — Deployment, DNS, Backup & Maintenance Guide

---

## 1. Vercel Production Deployment Configuration

`vercel.json` is preconfigured for static multi-page hosting with security headers:
- **Build Command:** `node scripts/build-vercel.mjs`
- **Output Directory:** `dist`
- **Clean URLs & Routing:** `cleanUrls: true`, `trailingSlash: false`, `/404.html` automatic 404 fallback, `/admin -> /admin/login` redirect.
- **Security Headers:**
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  - `Content-Security-Policy` (`script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `connect-src 'self' https://*.supabase.co wss://*.supabase.co`)
  - `Permissions-Policy: camera=(self), microphone=(), geolocation=()` (enables webcam QR scanning exclusively on same-origin HTTPS pages)
  - `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`

### Steps to Deploy on Vercel
1. Connect the repository in **Vercel Dashboard -> Add New Project**.
2. Keep Framework Preset as **Other** (automatically picks up `vercel.json` build command & `dist` output).
3. Add the 3 Environment Variables for **Production** (see `docs/ENVIRONMENT_VARIABLES.md`):
   - `PUBLIC_SUPABASE_URL`
   - `PUBLIC_SUPABASE_ANON_KEY`
   - `PUBLIC_APP_ENV=production`
4. Trigger deployment and confirm build output prints `environment: "production"` and `supabaseConfigured: true`.

---

## 2. Custom Domain & DNS Configuration

When connecting a custom BONFREE-HUB domain (e.g., `bonfree-hub.in` or `bonfree-hub.com`):

1. Add both the apex domain (`bonfree-hub.in`) and `www.bonfree-hub.in` under **Vercel Project -> Settings -> Domains**.
2. Configure DNS records at your registrar:
   - **Apex (`@`):** `A` record -> `76.76.21.21` (Vercel Anycast IPv4)
   - **`www` subdomain:** `CNAME` record -> `cname.vercel-dns.com`
3. Wait for DNS propagation & automatic Let's Encrypt TLS certificate issuance (mandatory for `Permissions-Policy: camera=(self)` and `getUserMedia`).
4. Set `www` -> apex (or apex -> `www`) canonical 308 redirect in Vercel Domains so users never split `sessionStorage` auth state across hosts.
5. **Update Supabase after domain cutover:**
   - Update **Supabase Authentication -> URL Configuration -> Site URL** & **Redirect URLs** to the custom domain.
   - Update Edge Function secret:
     ```bash
     supabase secrets set ALLOWED_ORIGIN=https://bonfree-hub.in,https://www.bonfree-hub.in
     ```

---

## 3. Production Logging & Monitoring

- **Client Error Monitoring (`src/scripts/core/logger.js`):** Automatically attaches global `window.error` and `unhandledrejection` handlers in `main.js` and `adminMain.js`, redacts JWTs/emails before logging, and captures structured error codes without exposing secrets.
- **Database Audit Trail (`public.audit_logs`):** Records privileged actions (`issue-stamp`, `redeem-reward`, `manage-staff`, `settings` updates) with `actor_user_id`, `action`, `entity_type`, `metadata`, and UTC timestamps. Query weekly for anomalous failure spikes or unauthorized role attempts.
- **Supabase Platform Logs:** Monitor Edge Function invocations (`issue-stamp`, `redeem-reward`, `manage-staff`, `admin-analytics`, `submit-contact`), Auth rate limits, and PostgREST `401/403` trends under **Supabase -> Logs**.
- **Vercel Logs:** Monitor HTTP 4xx/5xx responses and edge bandwidth via **Vercel -> Logs**.

---

## 4. Database Backup & Recovery Plan

1. **Automated Supabase Backups:** Enable Supabase Pro **Point-in-Time Recovery (PITR)** (continuous WAL archiving, 5-minute RPO target) or confirm automated daily snapshots in **Database -> Backups**.
2. **Off-Site Logical Snapshots:** Run a scheduled weekly CI/admin backup from a locked vault using non-destructive read-only dumps:
   ```bash
   pg_dump "$READ_ONLY_DATABASE_URL" --format=custom --no-owner --no-acl -f "bonfree_hub_$(date +%F).dump"
   ```
   Encrypt backups with KMS/age before archival storage.
3. **Recovery Procedure:**
   - Never run destructive `DROP`/`TRUNCATE`/`DELETE` commands directly against live production without an approved change ticket and fresh snapshot.
   - Restore to a **new staging branch/project first** (`pg_restore`), run row-count checks on `customers`, `loyalty_cards`, `stamp_transactions`, `purchases`, and `redemptions`, run `supabase/tests/rls_security_tests.sql`, then switch connection strings or promote.
4. **Quarterly Restore Drill:** Test backup restoration into a temporary Supabase/PostgreSQL instance every quarter.

---

## 5. Post-Deployment Smoke Test Checklist

Execute once Vercel + Supabase production credentials are live:
1. Open `https://<domain>/` -> verify HTTP `200`, strict CSP/HSTS headers, `design-system.html` excluded in prod (`404.html` renders cleanly), and `privacy.html` / `terms.html` load cleanly.
2. Submit an inquiry on `/contact` -> verify `201` ticket created in `contact_inquiries`.
3. Register a test customer at `/register` -> confirm verification email arrives (`login?reason=verified`), log in at `/login`, inspect `/customer-dashboard`, verify opaque `BFQR-*` SVG QR renders.
4. Log in with the provisioned Administrator account at `/admin/login` -> verify `/admin/dashboard` shows live `0`-fixture DB state.
5. Open `/admin/scanner` over HTTPS on desktop/mobile -> allow camera, scan the customer QR code, submit one qualifying receipt, verify stamp increment on `/customer-dashboard`, then resubmit the same receipt and confirm duplicate rejection (`409`).
6. Confirm reward unlock & redemption voucher verification end-to-end on `/admin/redemptions`, then clean up test records safely if done in staging.
