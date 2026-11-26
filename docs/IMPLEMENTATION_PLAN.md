# BONFREE-HUB — Phased Implementation Plan

This roadmap sequences delivery into safe, verifiable increments without cutting corners on security, design fidelity, or modularity.

---

## Phase 1: Foundation, Design System & Core UI Primitives *(Current Phase)*
- [x] Inspect workspace and establish clean repository structure (`vercel.json`, `.env.example`, `.gitignore`).
- [x] Author System Architecture (`docs/ARCHITECTURE.md`) and Phased Implementation Plan (`docs/IMPLEMENTATION_PLAN.md`).
- [x] Build monochrome design system CSS (`tokens.css`, `reset.css`, `layout.css`, `components.css`) matching `#101010`, `#FFFFFF`, `#F5F4F0`, `#D9D9D9`, `Playfair Display`, and `Inter`.
- [x] Build CSP-safe Lucide SVG icon registry (`icons.js`), safe DOM helpers (`dom.js`), runtime config (`config.js`), and in-memory state store (`state.js`).
- [x] Build reusable UI components: Navigation shells (`navbar.js`), Modals (`modal.js`), Alerts & Toasts (`toast.js`), Data Tables & Pagination (`table.js`), Form validation (`form.js`), and Loading States (`loader.js`).
- [x] Create `index.html` foundation entry and `design-system.html` interactive component showcase.
- [x] Run automated foundation verification tests (`tests/foundation.test.mjs`) and responsive layout checks.

---

## Phase 2: Database Schema, RLS Policies & Supabase Auth Integration
- [ ] Write PostgreSQL migrations in `supabase/migrations/` for `profiles`, `staff_members`, `loyalty_programmes`, `purchases`, `stamp_ledger`, `rewards_catalog`, `member_vouchers`, `campaigns`, `surveys`, `brand_settings`, `contact_messages`, and `audit_logs`.
- [ ] Implement strict RLS policies and PostgreSQL triggers (auto-create member profile & `BF-XXXXXX` ID on signup, immutable `stamp_ledger` constraints).
- [ ] Build `src/scripts/services/supabaseClient.js` and `authService.js` supporting Customer Login, Join Now, Reset Password, Staff Sign In, and Role Guards.

---

## Phase 3: Public Website & Authentication Screens
- [ ] Build **Home (`index.html`)** matching Reference `01. Home (Public)` with editorial streetwear photography, loyalty card preview, and benefits strip.
- [ ] Build **About Us (`about.html`)** and **Loyalty Club / How It Works (`loyalty.html`)** matching References `02` & `03`.
- [ ] Build **Contact (`contact.html`)** with validated form backed by `submit-contact` Edge Function.
- [ ] Build split-screen **Customer Login (`login.html`)**, **Join Now (`join.html`)**, **Reset Password (`reset-password.html`)**, and **Admin Staff Sign In (`admin/login.html`)**.

---

## Phase 4: Customer Member Experience (Desktop & Mobile)
- [ ] Build **Customer Dashboard (`member/dashboard.html`)** matching Board 03: welcome banner, `Membership ID` copy control, Digital Loyalty Card with QR code, `X/10 Stamps` tracker, and summary feeds (`Reward History`, `Purchase History`, `Stamp Activity`).
- [ ] Build **My Rewards (`member/rewards.html`)** with `Available` / `Voucher History` segmented control and live `redeem-reward` Edge Function integration.
- [ ] Build **Stamp Activity**, **Purchase History**, **My Profile**, and **Preferences** views with responsive mobile bottom navigation (`Home`, `Loyalty`, `Shop`, `Account`).

---

## Phase 5: Admin & Store Staff Console
- [ ] Build **Admin Overview (`admin/overview.html`)** with KPI cards, Customer Growth chart, and Recent Stamp Transactions.
- [ ] Build **Customers (`admin/customers.html`)**, **Loyalty Programmes (`admin/programmes.html`)**, **Purchase Records (`admin/purchases.html`)**, and **Stamp Transactions / Issuance** using `issue-stamp` Edge Function.
- [ ] Build **Staff Management (`admin/staff.html`)**, **Campaigns (`admin/campaigns.html`)**, **Surveys (`admin/surveys.html`)**, **Analytics (`admin/analytics.html`)**, **Reports (`admin/reports.html` + CSV export)**, and **Settings (`admin/settings.html`)**.

---

## Phase 6: Security Hardening, End-to-End QA & Vercel Deployment
- [ ] Conduct RLS penetration tests (verify customer cannot mutate ledger/other profiles; verify inactive/unauthorized staff blocked).
- [ ] Verify accessibility (WCAG AA contrast, keyboard navigation, ARIA roles) and responsive breakpoints (`375px`, `768px`, `1280px`, `1440px`).
- [ ] Configure Vercel environment variables, deploy Edge Functions to Supabase, and run production smoke tests.
