# BONFREE-HUB — Role Operating Guides

---

## 1. Administrator Operating Guide

**Entry Point:** `/admin/login` -> `/admin/dashboard`

1. **Loyalty Programmes (`/admin/loyalty`):**
   - Configure qualifying purchase threshold (default `₹1,000`), stamp goal (default `10` stamps), stamp & reward validity (`12` / `6` months), calculation mode (`per_threshold`, `per_transaction`, `multiplier_2x`), and reward milestone tiers.
2. **Rewards Catalogue (`/admin/rewards`):**
   - Create and toggle Fixed Discount, Percentage Discount, Free Product, Birthday Reward, and Exclusive Member Offers with explicit required stamp counts and per-member redemption caps.
3. **Staff & RBAC Management (`/admin/staff`):**
   - Invite new Store Managers, Sales Staff, or Marketing Staff accounts via `manage-staff`, adjust per-user permission overrides, trigger password setup links, audit recent staff activity, or deactivate accounts immediately when staff depart (revokes access on existing sessions).
4. **Campaigns & Surveys (`/admin/campaigns`, `/admin/surveys`):**
   - Schedule seasonal streetwear drops and bonus-stamp multipliers (subject to backend limits), save survey drafts, publish surveys to eligible members, close completed surveys, and review aggregated responses.
5. **Analytics, Reports & Settings (`/admin/analytics`, `/admin/reports`, `/admin/settings`):**
   - Monitor real KPI trends across daily, weekly, monthly, and custom windows; preview paginated reports; export authorized CSV files (protected against spreadsheet formula injection); update brand contact details (`care@bonfree-hub.in`), store defaults, and account passwords.

---

## 2. Store Staff QR Scanner Operating Guide

**Entry Point:** `/admin/login` -> `/admin/scanner`

1. **Sign In:** Authenticate with your staff email and password (`stamps.issue` permission required).
2. **Grant Camera Access:** Click **Start Camera Scanner** and allow browser webcam access when prompted (requires HTTPS).
3. **Scan Member Pass:** Hold the customer's digital loyalty QR pass steady inside the viewfinder.
   - The scanner decodes the opaque `BFQR-*` token and queries `fn_lookup_member_by_qr_or_query` to show member name, membership ID, status, and active card progress.
   - If a customer's screen is damaged, use the manual lookup box (Membership ID, QR token, or registered mobile/email).
4. **Verify Purchase & Award Stamps:**
   - Enter the exact **Receipt / Invoice Number** (scoped uniquely per store) and **Purchase Amount (INR)**, then review the preview.
   - Click **Confirm & Award Stamps**. The `issue-stamp` Edge Function recalculates stamps server-side, checks duplicate receipts and cooldown rules, records the purchase and immutable ledger transaction atomically, and auto-unlocks eligible rewards.
   - *Never re-enter an already-credited receipt number; duplicates are blocked automatically.*
5. **Verify & Confirm Reward Vouchers (`/admin/redemptions`):**
   - Enter or look up the customer's single-use voucher code (`BFH-...`), confirm item/discount eligibility at checkout, and click **Confirm Redemption**.

---

## 3. Customer Loyalty Workflow

**Entry Points:** `/register`, `/login`, `/customer-dashboard`, `/survey`

1. **Join & Verify:**
   - Open `/register`, complete Full Name, Mobile Number, Email Address, strong Password, and accept the Terms & Privacy Policy.
   - Open the verification link sent to your email (`login.html?reason=verified`), then sign in at `/login`.
2. **Digital Membership Pass & QR Code:**
   - Upon sign-in, your customer dashboard (`/customer-dashboard`) automatically initializes active loyalty cards (`Classic Stamps`, etc.) and renders your unique Membership ID (`BF-XXXXXX`) alongside your scannable monochrome QR pass (`BFQR-*`).
3. **Earn Stamps In-Store:**
   - Present your QR pass at any BONFREE-HUB retail checkout counter during qualifying purchases. Refresh or revisit the dashboard to view updated circular stamp progress, transaction history, and purchase receipts.
4. **Unlock & Redeem Rewards:**
   - Once your card collects the required stamps, eligible rewards unlock automatically in **My Rewards**.
   - Select **Request Redemption** to generate a single-use voucher code (`BFH-...`), present it at checkout for staff confirmation, and track redeemed vouchers in history.
5. **Campaigns & Feedback:**
   - Browse active streetwear drops and answer eligible published member surveys at `/survey`.
