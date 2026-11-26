# BONFREE-HUB — Digital Loyalty & Streetwear Membership Platform

BONFREE-HUB is a production-structured loyalty, stamp card, voucher redemption, campaign, and retail analytics platform built for a modern Gen Z streetwear & everyday fashion brand.

It pairs a strict monochrome **HTML5 / CSS3 / Vanilla ES Modules** static frontend (deployed on **Vercel**) with **Supabase** (PostgreSQL, Row Level Security, Authentication, Storage, and Deno Edge Functions).

---

## Key Capabilities

- **Public Brand & Member Legal Surfaces:** Brand story, loyalty rules, interactive stamp card preview, contact inquiry portal, Privacy Policy (`privacy.html`), Terms & Conditions (`terms.html`), and branded `404.html`.
- **Customer Portal (`customer-dashboard.html`, `survey.html`):** Secure signup/login with email verification, password reset, mobile-friendly digital loyalty pass, **ISO/IEC 18004 scannable QR code** carrying strictly opaque `BFQR-*` tokens, stamp & purchase history, automatic reward unlocking, single-use voucher codes, promotional campaigns, and surveys.
- **Store Staff & Admin Console (`admin/*.html`):** Camera-enabled POS QR scanner (`html5-qrcode`), server-validated purchase & stamp issuance, voucher verification & redemption confirmation, loyalty programme & reward builders, granular 4-role RBAC staff management, campaigns, surveys, analytics, formula-safe CSV exports, and brand settings.

---

## Project Structure

```text
├── index.html, about.html, loyalty.html, contact.html
├── login.html, register.html, forgot-password.html, reset-password.html
├── customer-dashboard.html, survey.html
├── privacy.html, terms.html, 404.html, design-system.html
├── admin/                        # 15 authenticated staff & admin console pages
├── assets/
│   ├── images/                   # Optimized progressive JPEGs (<220 KB each)
│   └── vendor/html5-qrcode.min.js
├── src/
│   ├── styles/                   # Layered CSS (tokens, reset, layout, components, public, auth, dashboard, admin)
│   └── scripts/
│       ├── core/                 # config.js, supabaseClient.js, qr.js, logger.js, dom.js, state.js, icons.js
│       ├── components/           # navbar, footer, adminShell, charts, form, modal, table, toast, loader
│       ├── services/             # authService, loyaltyService, adminService, adminExtendedService, contactService
│       ├── pages/                # Page controllers
│       ├── main.js               # Public & customer entry bootstrapper
│       └── adminMain.js          # Admin RBAC guard & bootstrapper
├── scripts/
│   └── build-vercel.mjs          # Vercel static build (`dist/`) + safe public meta config injection
├── supabase/
│   ├── migrations/0001..0011     # Ordered PostgreSQL schema, RLS, triggers & transactional RPCs
│   ├── functions/                # issue-stamp, redeem-reward, manage-staff, submit-contact, admin-analytics
│   ├── tests/rls_security_tests.sql
│   ├── production_seed.sql       # Safe idempotent baseline seed (no dev/fake data)
│   └── seed.sql                  # Non-production dev reference seed
├── docs/                         # Architecture, ERD, Setup, Env Vars, Operating & Deployment guides
├── tests/                        # Node.js automated unit, security & integration test suites
├── vercel.json                   # Build, clean URLs, redirects, CSP, HSTS, camera header & caching
├── package.json
└── .env.example
```

---

## Installation & Local Development Guide

### Prerequisites
- **Node.js `>= 20.0.0`** (tested on `v22.16.0`)
- Optional for live backend deployment: **Supabase CLI**, **Vercel CLI**, and PostgreSQL `psql` client

### Local Setup & Verification
1. Clone the repository and review `.env.example`:
   ```bash
   cp .env.example .env
   ```
2. Run the full automated test suite (no external package install required):
   ```bash
   npm test
   ```
3. Build the deployable `dist/` bundle cleanly:
   ```bash
   npm run build
   ```
   *(For production builds, `PUBLIC_APP_ENV=production` requires `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` to be set.)*
4. Serve the workspace over local HTTP/HTTPS (e.g., `npx serve .` or `python -m http.server 8080`). Note: browser camera scanning (`admin/scanner.html`) requires **HTTPS** or `localhost`.

---

## Environment Variable Summary

| Variable | Scope | Secret? | Purpose |
| :--- | :--- | :--- | :--- |
| `PUBLIC_SUPABASE_URL` | Vercel Build / Browser Meta | No | HTTPS Supabase project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Vercel Build / Browser Meta | No | Public Supabase `anon` key (protected by RLS) |
| `PUBLIC_APP_ENV` | Vercel Build / Browser Meta | No | `development` or `production` (disables dev fixtures in prod) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Functions only | **YES** | Elevated admin DB/Auth access inside Edge Functions |
| `ALLOWED_ORIGIN` | Supabase Edge Functions only | Config | Comma-separated exact HTTPS origins for CORS |
| `APP_ENV` | Supabase Edge Functions only | Config | `production` enforces strict non-wildcard CORS |

See [docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md) for validation rules and safety checks.

---

## Documentation Index

- **Environment Variable Reference:** [docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md)
- **Supabase Setup & First Administrator Runbook:** [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)
- **System Architecture:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Database Schema & ERD:** [docs/DATABASE_ERD.md](docs/DATABASE_ERD.md)
- **Operating Guides (Admin, Staff Scanner, Customer Workflow):** [docs/OPERATING_GUIDES.md](docs/OPERATING_GUIDES.md)
- **Vercel Deployment, Custom Domain DNS, Backups & Monitoring:** [docs/DEPLOYMENT_AND_MAINTENANCE.md](docs/DEPLOYMENT_AND_MAINTENANCE.md)
- **Phase 9 Audit Report:** [docs/PHASE9_AUDIT_REPORT.md](docs/PHASE9_AUDIT_REPORT.md)
- **Final Production Readiness Report:** [docs/PRODUCTION_READINESS_REPORT.md](docs/PRODUCTION_READINESS_REPORT.md)
