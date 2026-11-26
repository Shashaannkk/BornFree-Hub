# BONFREE-HUB — System Architecture

## 1. Overview & Architectural Principles

BONFREE-HUB is a digital loyalty and rewards management platform for a modern Gen Z streetwear & everyday fashion brand.

### Core Principles
- **Zero Frontend Frameworks:** Pure HTML5, CSS3, and modular Vanilla JavaScript (ES Modules) for minimal bundle overhead, predictable DOM behavior, and zero build-pipeline lock-in.
- **Strict Separation of Concerns:** Separate `.html` entry points, layered `.css` stylesheets (`tokens` -> `reset` -> `layout` -> `components`), and modular `.js` (`core` -> `components` -> `services` -> `pages`).
- **Database as Single Source of Truth:** Supabase PostgreSQL with Row Level Security (RLS) is the authoritative persistence layer. `localStorage` is **never** used as a permanent database for members, stamps, purchases, rewards, or admin credentials.
- **Zero-Trust Sensitive Operations:** Stamp issuance, reward redemption, purchase qualification, staff role changes, and admin reports/exports execute exclusively via authenticated **Supabase Edge Functions** that validate JWT claims, enforce business rules atomically, and write immutable audit logs.
- **No Secret Leakage:** Frontend code only ever receives `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`. `SUPABASE_SERVICE_ROLE_KEY` lives strictly inside Supabase Edge Function secrets. No hardcoded admin passwords or backdoors exist anywhere.

---

## 2. Application Surfaces & Routing (Static MPA on Vercel)

| Surface | Target Routes (Planned) | Auth Requirement | Shell Style |
| --- | --- | --- | --- |
| **Public Brand & Loyalty Info** | `/`, `/about`, `/loyalty`, `/contact` | Public | Light topbar (`BONFREE-HUB` + links + `Login` / `Join Now`) |
| **Authentication** | `/login`, `/join`, `/reset-password` | Public (redirects if authenticated) | 50/50 Split-screen (B&W streetwear visual left, form right) |
| **Customer Member Portal** | `/member/dashboard`, `/member/rewards`, `/member/stamps`, `/member/purchases`, `/member/profile` | Customer (`role = 'customer'`) | Dark `#101010` topbar + Left sidebar (Desktop) / Bottom tab bar (Mobile) |
| **Admin & Store Staff Console** | `/admin/login`, `/admin/overview`, `/admin/customers`, `/admin/programmes`, `/admin/purchases`, `/admin/stamps`, `/admin/rewards`, `/admin/staff`, `/admin/campaigns`, `/admin/surveys`, `/admin/analytics`, `/admin/reports`, `/admin/settings` | Staff/Admin (`role IN ('admin','manager','associate')`) | Fixed `#101010` sidebar + Top search/alert/profile bar |
| **Phase 1 Design System** | `/design-system` | Public (Dev/Review) | Reusable UI primitive showcase |

---

## 3. Frontend Module Architecture

```text
src/
├── styles/
│   ├── tokens.css       # Design system CSS variables (colors, typography, spacing, radii, shadows, z-index)
│   ├── reset.css        # Accessible base reset and typographic defaults
│   ├── layout.css       # Containers, grids, public header/footer, split auth, member & admin shells
│   └── components.css   # Buttons, forms, toggles, cards, loyalty card, stamp tracker, tables, modals, alerts, skeletons
└── scripts/
    ├── core/
    │   ├── config.js    # Safe public runtime configuration reader
    │   ├── icons.js     # CSP-safe inline Lucide SVG icon registry & DOM renderer
    │   ├── dom.js       # Safe DOM utilities & HTML escaping (XSS mitigation)
    │   └── state.js     # Ephemeral in-memory pub/sub state store
    ├── components/
    │   ├── navbar.js    # Public, Member, and Admin navigation shells + responsive drawers
    │   ├── modal.js     # Accessible modal dialogs with focus management & Escape handling
    │   ├── toast.js     # Toast stack & inline alert banners
    │   ├── table.js     # Reusable data table, status badges & pagination
    │   ├── form.js      # Field validation, password toggles & submit states
    │   └── loader.js    # Spinners, skeletons & loading overlays
    ├── services/        # (Phase 2+) supabaseClient.js, authService.js, loyaltyService.js, adminService.js
    └── pages/           # (Phase 3+) Page-specific orchestrators
```

---

## 4. Supabase Database Architecture (PostgreSQL Blueprint)

### Core Tables (Planned for Phase 2)
1. **`profiles`** — Linked 1:1 to `auth.users(id)`. Stores `full_name`, `phone`, `membership_code` (`BF-XXXXXX`), `avatar_url`, `status` (`active`/`inactive`), `created_at`.
2. **`staff_members`** — Linked to `auth.users(id)`. Stores `staff_code` (`STF1001`), `role` (`super_admin`, `loyalty_admin`, `store_manager`, `sales_associate`, `marketing_admin`), `department_store`, `status`, `created_at`.
3. **`loyalty_programmes`** — Stamp-based programme rules (`name`, `description`, `stamp_goal`, `qualifying_amount_inr`, `stamp_validity_months`, `reward_validity_months`, `reward_value_inr`, `status`).
4. **`purchases`** — Member transactions (`receipt_no`, `member_id`, `store_location`, `amount_inr`, `is_qualifying`, `programme_id`, `recorded_by_staff_id`, `purchased_at`).
5. **`stamp_ledger`** — Immutable append-only ledger (`member_id`, `programme_id`, `purchase_id`, `delta`, `balance_after`, `tx_type` (`earned`/`redeemed`/`expired`/`adjusted`), `expires_at`, `created_by`, `created_at`).
6. **`rewards_catalog` & `member_vouchers`** — Reward definitions and issued/redeemed voucher codes (`voucher_code`, `member_id`, `status` (`available`/`redeemed`/`expired`), `stamps_cost`, `redeemed_at`).
7. **`campaigns`** — Promotional multipliers and early-access campaigns (`title`, `description`, `multiplier`, `start_date`, `end_date`, `status`, `banner_url`).
8. **`surveys`, `survey_questions`, `survey_responses`** — Dynamic feedback builder and analytics responses.
9. **`brand_settings`** — Singleton/versioned brand & loyalty rule metadata.
10. **`contact_messages` & `audit_logs`** — Support inquiries and immutable security/admin audit trail.

### Row Level Security (RLS) Strategy
- **Customers** can `SELECT` only their own `profiles`, `purchases`, `stamp_ledger`, and `member_vouchers` (`auth.uid() = member_id`).
- **Customers cannot `INSERT`/`UPDATE`/`DELETE`** `stamp_ledger`, `purchases`, `member_vouchers`, or `staff_members` directly; all mutations go through Edge Functions.
- **Staff/Admins** access rows scoped by verified `staff_members` role checks via helper SQL function `public.is_active_staff(required_roles text[])`.

---

## 5. Edge Functions Blueprint (Sensitive Operations)

| Function Name | Purpose | Caller Auth |
| --- | --- | --- |
| `issue-stamp` | Records purchase, evaluates qualifying threshold & active campaign multipliers, appends to `stamp_ledger` atomically | Staff (`store_manager`, `sales_associate`, `loyalty_admin`, `super_admin`) |
| `redeem-reward` | Verifies stamp balance via DB transaction/lock, deducts stamps, issues unique single-use voucher code | Customer (self) or Authorized Staff |
| `manage-staff` | Invites/updates/deactivates staff accounts via Supabase Admin API + writes `audit_logs` | `super_admin` / `loyalty_admin` |
| `admin-analytics` | Computes aggregated KPI metrics and generates sanitized CSV exports | Authorized Staff |
| `submit-contact` | Validates, rate-limits, and stores public contact inquiries | Public (with validation & honeypot/rate-limit) |

---

## 6. Security & Compliance Controls
- **Content Security Policy (CSP):** Configured in `vercel.json`, prohibiting inline `<script>` and inline `<style>` execution (`script-src 'self'`, `style-src 'self' https://fonts.googleapis.com`).
- **XSS Prevention:** All dynamic UI rendering uses `escapeHtml()` or safe `textContent` DOM nodes (`src/scripts/core/dom.js`).
- **Authentication Hygiene:** Supabase Auth JWTs with email verification, password reset flows, optional TOTP MFA (for admin 2FA toggle in Settings), and automatic idle/logout handling.
- **No Client-Side Admin Bypass:** Admin routes verify session + `staff_members` role server-side before displaying or fetching privileged data.
