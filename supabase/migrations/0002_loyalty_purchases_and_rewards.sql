-- ============================================================================
-- BONFREE-HUB Migration 0002: Loyalty Programmes, Cards, Purchases & Rewards
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Loyalty Programmes & Reward Milestone Tiers
-- ----------------------------------------------------------------------------
CREATE TABLE public.loyalty_programmes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  subtitle text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  stamp_goal integer NOT NULL CHECK (stamp_goal > 0 AND stamp_goal <= 100),
  qualifying_amount_inr numeric(12, 2) NOT NULL CHECK (qualifying_amount_inr > 0),
  calculation_rule text NOT NULL DEFAULT 'per_threshold'
    CHECK (calculation_rule IN ('per_threshold', 'per_transaction', 'multiplier_2x')),
  stamp_validity_months integer NOT NULL DEFAULT 12 CHECK (stamp_validity_months > 0),
  reward_validity_months integer NOT NULL DEFAULT 6 CHECK (reward_validity_months > 0),
  eligibility_rule text NOT NULL DEFAULT 'All active BONFREE-HUB members',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_loyalty_programmes_status ON public.loyalty_programmes (status);

CREATE TRIGGER trg_loyalty_programmes_updated_at
  BEFORE UPDATE ON public.loyalty_programmes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.loyalty_programme_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id uuid NOT NULL REFERENCES public.loyalty_programmes(id) ON DELETE CASCADE,
  stamps_required integer NOT NULL CHECK (stamps_required > 0),
  title text NOT NULL,
  reward_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (programme_id, stamps_required)
);

CREATE TRIGGER trg_loyalty_programme_tiers_updated_at
  BEFORE UPDATE ON public.loyalty_programme_tiers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Customer Digital Loyalty Cards
-- ----------------------------------------------------------------------------
CREATE TABLE public.loyalty_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  programme_id uuid NOT NULL REFERENCES public.loyalty_programmes(id) ON DELETE RESTRICT,
  current_stamps integer NOT NULL DEFAULT 0 CHECK (current_stamps >= 0),
  lifetime_stamps integer NOT NULL DEFAULT 0 CHECK (lifetime_stamps >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, programme_id)
);

CREATE INDEX idx_loyalty_cards_customer_id ON public.loyalty_cards (customer_id);
CREATE INDEX idx_loyalty_cards_programme_id ON public.loyalty_cards (programme_id);

CREATE TRIGGER trg_loyalty_cards_updated_at
  BEFORE UPDATE ON public.loyalty_cards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Purchases (Unique Receipt Scoped to Store Business Context)
-- ----------------------------------------------------------------------------
CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  programme_id uuid NOT NULL REFERENCES public.loyalty_programmes(id) ON DELETE RESTRICT,
  recorded_by_staff_id uuid REFERENCES public.staff(id) ON DELETE RESTRICT,
  receipt_no text NOT NULL CHECK (char_length(trim(receipt_no)) >= 3),
  items_summary text NOT NULL DEFAULT '',
  amount_inr numeric(12, 2) NOT NULL CHECK (amount_inr > 0),
  is_qualifying boolean NOT NULL DEFAULT false,
  stamps_calculated integer NOT NULL DEFAULT 0 CHECK (stamps_calculated >= 0),
  purchased_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, receipt_no)
);

CREATE INDEX idx_purchases_customer_id ON public.purchases (customer_id, purchased_at DESC);
CREATE INDEX idx_purchases_store_id ON public.purchases (store_id, purchased_at DESC);
CREATE INDEX idx_purchases_qualifying ON public.purchases (is_qualifying);

CREATE TRIGGER trg_purchases_updated_at
  BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Stamp Transactions (Immutable Append-Only Ledger)
-- ----------------------------------------------------------------------------
CREATE SEQUENCE public.stamp_tx_seq START WITH 10001 INCREMENT BY 1;

CREATE TABLE public.stamp_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_code text NOT NULL UNIQUE
    DEFAULT ('TXN-' || to_char(now(), 'YYYYMMDD') || '-' || nextval('public.stamp_tx_seq')::text),
  loyalty_card_id uuid NOT NULL REFERENCES public.loyalty_cards(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  programme_id uuid NOT NULL REFERENCES public.loyalty_programmes(id) ON DELETE RESTRICT,
  purchase_id uuid REFERENCES public.purchases(id) ON DELETE RESTRICT,
  staff_id uuid REFERENCES public.staff(id) ON DELETE RESTRICT,
  tx_type text NOT NULL CHECK (tx_type IN ('earned', 'redeemed', 'reversed', 'expired', 'adjusted')),
  stamps_delta integer NOT NULL CHECK (stamps_delta <> 0),
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  status text NOT NULL DEFAULT 'awarded' CHECK (status IN ('awarded', 'completed', 'reversed', 'failed')),
  idempotency_key text UNIQUE,
  notes text NOT NULL DEFAULT '',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Prevents awarding stamps twice for the same purchase record.
CREATE UNIQUE INDEX uniq_stamp_tx_earned_per_purchase
  ON public.stamp_transactions (purchase_id)
  WHERE purchase_id IS NOT NULL AND tx_type = 'earned';

CREATE INDEX idx_stamp_tx_customer_id ON public.stamp_transactions (customer_id, created_at DESC);
CREATE INDEX idx_stamp_tx_card_id ON public.stamp_transactions (loyalty_card_id, created_at DESC);
CREATE INDEX idx_stamp_tx_staff_id ON public.stamp_transactions (staff_id, created_at DESC);

-- Enforce immutability of stamp_transactions (no UPDATE/DELETE allowed).
CREATE OR REPLACE FUNCTION public.prevent_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'stamp_transactions is an immutable append-only ledger';
END;
$$;

CREATE TRIGGER trg_stamp_tx_immutable
  BEFORE UPDATE OR DELETE ON public.stamp_transactions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_mutation();

-- ----------------------------------------------------------------------------
-- Rewards Catalogue
-- ----------------------------------------------------------------------------
CREATE TABLE public.rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  programme_id uuid REFERENCES public.loyalty_programmes(id) ON DELETE SET NULL,
  title text NOT NULL,
  reward_type text NOT NULL CHECK (
    reward_type IN (
      'Fixed Discount',
      'Percentage Discount',
      'Free Product',
      'Birthday Reward',
      'Exclusive Member Offer',
      'New Collection Offer'
    )
  ),
  value_label text NOT NULL,
  discount_amount_inr numeric(12, 2) CHECK (discount_amount_inr IS NULL OR discount_amount_inr >= 0),
  discount_percent numeric(5, 2) CHECK (
    discount_percent IS NULL OR (discount_percent > 0 AND discount_percent <= 100)
  ),
  description text NOT NULL DEFAULT '',
  required_stamps integer NOT NULL CHECK (required_stamps > 0),
  validity_months integer NOT NULL DEFAULT 6 CHECK (validity_months > 0),
  redemption_limit_per_member integer CHECK (
    redemption_limit_per_member IS NULL OR redemption_limit_per_member > 0
  ),
  redemption_limit_label text NOT NULL DEFAULT '1 per card completion',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rewards_status ON public.rewards (status);
CREATE INDEX idx_rewards_programme_id ON public.rewards (programme_id);

CREATE TRIGGER trg_rewards_updated_at
  BEFORE UPDATE ON public.rewards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Customer Rewards (Issued Vouchers / Unlocked Entitlements)
-- ----------------------------------------------------------------------------
CREATE TABLE public.customer_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  reward_id uuid NOT NULL REFERENCES public.rewards(id) ON DELETE RESTRICT,
  loyalty_card_id uuid NOT NULL REFERENCES public.loyalty_cards(id) ON DELETE RESTRICT,
  voucher_code text NOT NULL UNIQUE CHECK (voucher_code ~ '^BFH-[A-Z0-9-]{6,}$'),
  stamps_spent integer NOT NULL CHECK (stamps_spent > 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'available', 'redeemed', 'expired', 'rejected')),
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_rewards_customer_id ON public.customer_rewards (customer_id, created_at DESC);
CREATE INDEX idx_customer_rewards_status ON public.customer_rewards (status);
CREATE INDEX idx_customer_rewards_voucher_code ON public.customer_rewards (voucher_code);

CREATE TRIGGER trg_customer_rewards_updated_at
  BEFORE UPDATE ON public.customer_rewards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Redemptions (Staff Verification Workflow)
-- ----------------------------------------------------------------------------
CREATE TABLE public.redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_reward_id uuid NOT NULL UNIQUE REFERENCES public.customer_rewards(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  reward_id uuid NOT NULL REFERENCES public.rewards(id) ON DELETE RESTRICT,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  verified_by_staff_id uuid REFERENCES public.staff(id) ON DELETE RESTRICT,
  voucher_code text NOT NULL,
  stamps_cost integer NOT NULL CHECK (stamps_cost > 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'expired', 'rejected')),
  rejection_reason text,
  notes text NOT NULL DEFAULT '',
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_redemption_processed_fields CHECK (
    (status = 'pending' AND processed_at IS NULL) OR
    (status IN ('completed', 'expired', 'rejected') AND processed_at IS NOT NULL)
  )
);

CREATE INDEX idx_redemptions_status ON public.redemptions (status, requested_at DESC);
CREATE INDEX idx_redemptions_customer_id ON public.redemptions (customer_id);
CREATE INDEX idx_redemptions_voucher_code ON public.redemptions (voucher_code);

CREATE TRIGGER trg_redemptions_updated_at
  BEFORE UPDATE ON public.redemptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
