# BONFREE-HUB — Database Entity Relationship Documentation

## 1. Entity Relationship Diagram

```mermaid
erDiagram
    AUTH_USERS ||--|| PROFILES : "1:1 identity"
    AUTH_USERS ||--o| CUSTOMERS : "customer profile"
    AUTH_USERS ||--o| STAFF : "staff profile"

    ROLES ||--|{ STAFF : "assigned role"
    ROLES ||--|{ ROLE_PERMISSIONS : "default grants"
    PERMISSIONS ||--|{ ROLE_PERMISSIONS : "granted to role"
    STAFF ||--o{ STAFF_PERMISSIONS : "per-staff overrides"
    PERMISSIONS ||--o{ STAFF_PERMISSIONS : "overridden permission"
    STORES ||--o{ STAFF : "home branch"

    CUSTOMERS ||--|{ LOYALTY_CARDS : "holds cards"
    LOYALTY_PROGRAMMES ||--|{ LOYALTY_CARDS : "governs rules"
    LOYALTY_PROGRAMMES ||--|{ LOYALTY_PROGRAMME_TIERS : "milestone tiers"
    LOYALTY_PROGRAMMES ||--o{ REWARDS : "optional programme scope"

    STORES ||--|{ PURCHASES : "unique (store_id, receipt_no)"
    CUSTOMERS ||--|{ PURCHASES : "makes purchases"
    STAFF ||--o{ PURCHASES : "records purchase"
    LOYALTY_PROGRAMMES ||--|{ PURCHASES : "evaluated under"

    LOYALTY_CARDS ||--|{ STAMP_TRANSACTIONS : "append-only ledger"
    PURCHASES ||--o| STAMP_TRANSACTIONS : "unique earned tx per purchase"
    STAFF ||--o{ STAMP_TRANSACTIONS : "authorized actor"

    CUSTOMERS ||--|{ CUSTOMER_REWARDS : "issued vouchers"
    REWARDS ||--|{ CUSTOMER_REWARDS : "reward template"
    LOYALTY_CARDS ||--|{ CUSTOMER_REWARDS : "stamps debited from"
    CUSTOMER_REWARDS ||--|| REDEMPTIONS : "1:1 verification workflow"
    STAFF ||--o{ REDEMPTIONS : "verifies or rejects"

    LOYALTY_PROGRAMMES ||--o{ CAMPAIGNS : "promotional multiplier"
    SURVEYS ||--|{ SURVEY_QUESTIONS : "ordered questions"
    SURVEYS ||--o{ SURVEY_RESPONSES : "submitted answers"
    CUSTOMERS ||--o{ SURVEY_RESPONSES : "optional member link"
```

---

## 2. Core Integrity & Security Constraints

| Constraint / Mechanism | Table(s) | Purpose |
| --- | --- | --- |
| `UNIQUE (store_id, receipt_no)` | `purchases` | Prevents reusing the same POS receipt number at a store. |
| `UNIQUE (purchase_id) WHERE tx_type = 'earned'` | `stamp_transactions` | Guarantees stamps cannot be awarded twice for the same purchase. |
| `idempotency_key UNIQUE` | `stamp_transactions` | Safe retry protection for POS/Edge Function requests. |
| `trg_stamp_tx_immutable` | `stamp_transactions` | Blocks all `UPDATE`/`DELETE` operations on the stamp ledger. |
| `trg_audit_logs_immutable` | `audit_logs` | Blocks all `UPDATE`/`DELETE` operations on security audit logs. |
| `CHECK (current_stamps >= 0)` | `loyalty_cards` | Prevents negative stamp balances even under concurrency (`FOR UPDATE`). |
| `UNIQUE (customer_id, programme_id)` | `loyalty_cards` | Ensures one digital loyalty card per customer per programme. |
| `voucher_code UNIQUE CHECK ('^BFH-...')` | `customer_rewards` | Unique, non-guessable voucher codes (`gen_random_uuid` entropy). |
| `trg_guard_customer_self_update` | `customers` | Prevents customers from updating `membership_id` or `status` via RLS. |
| `SECURITY DEFINER` RPCs (`REVOKE ALL` from `anon`/`authenticated`) | `fn_award_stamps`, `fn_request_redemption`, `fn_process_redemption` | Guarantees all stamp & redemption mutations execute atomically inside PostgreSQL via `service_role` Edge Functions only. |
