-- ============================================================================
-- BONFREE-HUB Migration 0003: Campaigns, Surveys, Settings, Contact & Audit Logs
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Campaigns
-- ----------------------------------------------------------------------------
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_path text NOT NULL DEFAULT '',
  programme_id uuid REFERENCES public.loyalty_programmes(id) ON DELETE SET NULL,
  multiplier numeric(4, 2) NOT NULL DEFAULT 1.00 CHECK (multiplier >= 1.00 AND multiplier <= 10.00),
  bonus_stamps integer NOT NULL DEFAULT 0 CHECK (bonus_stamps >= 0),
  promotional_rule text NOT NULL DEFAULT '',
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('active', 'scheduled', 'completed', 'inactive')),
  created_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX idx_campaigns_status_dates ON public.campaigns (status, start_date, end_date);

CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Surveys, Questions & Responses
-- ----------------------------------------------------------------------------
CREATE TABLE public.surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_surveys_status ON public.surveys (status);

CREATE TRIGGER trg_surveys_updated_at
  BEFORE UPDATE ON public.surveys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.survey_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  question_type text NOT NULL CHECK (
    question_type IN ('rating', 'multiple_choice', 'short_answer', 'long_answer')
  ),
  prompt text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL CHECK (sort_order >= 0),
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_survey_questions_survey_order ON public.survey_questions (survey_id, sort_order);

CREATE TRIGGER trg_survey_questions_updated_at
  BEFORE UPDATE ON public.survey_questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  overall_rating smallint CHECK (overall_rating IS NULL OR overall_rating BETWEEN 1 AND 5),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (survey_id, customer_id)
);

CREATE INDEX idx_survey_responses_survey_id ON public.survey_responses (survey_id, submitted_at DESC);

-- ----------------------------------------------------------------------------
-- Contact Inquiries
-- ----------------------------------------------------------------------------
CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL CHECK (char_length(trim(message)) >= 10),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_contact_messages_updated_at
  BEFORE UPDATE ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Brand Settings (Singleton)
-- ----------------------------------------------------------------------------
CREATE TABLE public.brand_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  brand_name text NOT NULL DEFAULT 'BONFREE-HUB',
  tagline text NOT NULL DEFAULT 'Modern Streetwear & Everyday Fashion',
  support_email text NOT NULL DEFAULT 'care@bonfree-hub.in',
  support_phone text NOT NULL DEFAULT '+91 98765 43210',
  address text NOT NULL DEFAULT 'Spectrum Mall, MG Road, Bengaluru — 560001, India',
  default_stamp_validity_months integer NOT NULL DEFAULT 12 CHECK (default_stamp_validity_months > 0),
  default_reward_validity_months integer NOT NULL DEFAULT 6 CHECK (default_reward_validity_months > 0),
  two_factor_required boolean NOT NULL DEFAULT true,
  login_alerts_enabled boolean NOT NULL DEFAULT true,
  high_value_redemption_alerts boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_brand_settings_updated_at
  BEFORE UPDATE ON public.brand_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Immutable Audit Logs
-- ----------------------------------------------------------------------------
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs (actor_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only and cannot be modified or deleted';
END;
$$;

CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();
