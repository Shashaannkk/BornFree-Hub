# BONFREE-HUB — Environment Variable Reference

## 1. Vercel Public Frontend Variables

Configured in **Vercel Dashboard -> Project Settings -> Environment Variables** (`Production` and `Preview` scopes) and processed at build time by `scripts/build-vercel.mjs`:

| Variable | Required in Production | Example Value | Security Classification | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `PUBLIC_SUPABASE_URL` | Yes | `https://xyzcompany.supabase.co` | Public | Must use `https://`. Injected as `<meta name="bonfree-supabase-url">`. |
| `PUBLIC_SUPABASE_ANON_KEY` | Yes | `eyJhbGciOi...` | Public (`anon` role only) | Build aborts automatically if a `service_role` JWT is accidentally supplied. |
| `PUBLIC_APP_ENV` | Yes | `production` | Public | When `production`: disables all frontend dev fixtures (`ADMIN_DEV_FIXTURE`, `DEV_MEMBER_FIXTURE`), excludes `design-system.html` from `dist/`, and sets `data-bonfree-ready` flags off. |

---

## 2. Supabase Edge Function Secrets (Server-Only)

Configured strictly via `supabase secrets set` (never stored in `.env`, Git, or Vercel frontend environment variables):

| Variable | Required | Example Value | Purpose |
| :--- | :--- | :--- | :--- |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (built-in / secret) | `eyJhbGciOi...` | Allows Edge Functions (`issue-stamp`, `redeem-reward`, `manage-staff`, `submit-contact`, `admin-analytics`) to verify staff permissions and execute server-validated DB operations. |
| `APP_ENV` | Yes | `production` | Enables strict CORS origin checking in `supabase/functions/_shared/cors.ts` (rejects fallback wildcard `*`). |
| `ALLOWED_ORIGIN` | Yes | `https://bonfree-hub.com,https://www.bonfree-hub.com` | Exact allowed browser origins (no trailing slashes, comma-separated). |

---

## 3. Build-Time Injection & Security Guarantees

- `scripts/build-vercel.mjs` copies HTML/CSS/JS/assets into `dist/` and injects `<meta name="bonfree-env">`, `<meta name="bonfree-supabase-url">`, and `<meta name="bonfree-supabase-anon-key">` without inline `<script>` tags, preserving strict CSP (`script-src 'self'`).
- Decodes JWT payload claims during build to **fail fast** if `PUBLIC_SUPABASE_ANON_KEY` carries `role: "service_role"`.
- Zero database passwords, SMTP credentials, or signing secrets exist in client-side code.
