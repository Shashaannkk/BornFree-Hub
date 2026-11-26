-- ============================================================================
-- BONFREE-HUB Migration 0001: Core Identity, Stores & RBAC
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- Shared Timestamp Trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- Stores (Business Context for Scoped Receipts & Staff Assignments)
-- ----------------------------------------------------------------------------
CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code text NOT NULL UNIQUE,
  name text NOT NULL,
  city text NOT NULL,
  address text NOT NULL,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL CHECK (char_length(trim(full_name)) >= 2),
  email text NOT NULL UNIQUE,
  phone text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_email ON public.profiles (lower(email));

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RBAC: Roles, Permissions, Role-Permissions
-- ----------------------------------------------------------------------------
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (
    code IN ('administrator', 'store_manager', 'sales_staff', 'marketing_staff')
  ),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  module text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_permissions_updated_at
  BEFORE UPDATE ON public.permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

-- ----------------------------------------------------------------------------
-- Staff & Staff-Level Permission Overrides
-- ----------------------------------------------------------------------------
CREATE TABLE public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_code text NOT NULL UNIQUE CHECK (staff_code ~ '^STF[0-9]{4,}$'),
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  department text NOT NULL DEFAULT 'Operations',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_user_id ON public.staff (user_id);
CREATE INDEX idx_staff_role_id ON public.staff (role_id);
CREATE INDEX idx_staff_status ON public.staff (status);

CREATE TRIGGER trg_staff_updated_at
  BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.staff_permissions (
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  granted boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id, permission_id)
);

CREATE TRIGGER trg_staff_permissions_updated_at
  BEFORE UPDATE ON public.staff_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Customers & Unique Membership ID Generator
-- ----------------------------------------------------------------------------
CREATE SEQUENCE public.customer_membership_seq START WITH 1001 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.generate_membership_id()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_num bigint;
BEGIN
  next_num := nextval('public.customer_membership_seq');
  RETURN 'BF-' || lpad(next_num::text, 6, '0');
END;
$$;

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  membership_id text NOT NULL UNIQUE DEFAULT public.generate_membership_id()
    CHECK (membership_id ~ '^BF-[0-9]{6,}$'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  birth_month smallint CHECK (birth_month IS NULL OR birth_month BETWEEN 1 AND 12),
  preferences jsonb NOT NULL DEFAULT jsonb_build_object(
    'earlyAccessDrops', true,
    'birthdayOffers', true,
    'voucherExpiryAlerts', true,
    'smsStampReceipts', false
  ),
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_user_id ON public.customers (user_id);
CREATE INDEX idx_customers_membership_id ON public.customers (membership_id);
CREATE INDEX idx_customers_status ON public.customers (status);

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Auto-Provision Profile & Customer on Public Auth Signup
-- Note: Staff provisioning uses Edge Function `manage-staff` with service_role.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  resolved_name text;
  is_staff_invite boolean;
BEGIN
  resolved_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
    split_part(COALESCE(NEW.email, 'Member'), '@', 1)
  );
  is_staff_invite := COALESCE((NEW.raw_app_meta_data ->> 'is_staff')::boolean, false);

  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    resolved_name,
    COALESCE(NEW.email, ''),
    NULLIF(trim(NEW.raw_user_meta_data ->> 'phone'), '')
  )
  ON CONFLICT (id) DO NOTHING;

  IF NOT is_staff_invite THEN
    INSERT INTO public.customers (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
