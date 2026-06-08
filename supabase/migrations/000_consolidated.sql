-- =========================================================
-- FinTrack – Consolidated Schema (v1.2)
--
-- NEW INSTALL: run THIS file once via Supabase SQL Editor.
--   Creates all tables, indexes, constraints, RLS policies,
--   triggers and RPC functions in one shot — including the
--   Phase 1 billing infrastructure.
--
-- EXISTING INSTALL (already ran 001–003): run in order:
--   005_rpc_functions.sql  — get_all_time_totals + get_monthly_stats
--   006_billing.sql        — billing tables, plans, grants,
--                            get_effective_plan, back-fill
--
-- The dashboard falls back to direct queries if the RPCs are
-- missing, so skipping 005 degrades performance but never
-- breaks the UI.
-- =========================================================

-- ── Extensions ──────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Tables ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT,
  avatar_url TEXT,
  currency   TEXT NOT NULL DEFAULT 'BRL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#10B981',
  icon       TEXT NOT NULL DEFAULT 'circle',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- savings_goals must exist before transactions (FK dependency)
CREATE TABLE IF NOT EXISTS public.savings_goals (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  target_amount  NUMERIC(12,2) NOT NULL,
  current_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  deadline       DATE,
  color          TEXT NOT NULL DEFAULT '#6366F1',
  icon           TEXT NOT NULL DEFAULT 'target',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id          UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  goal_id              UUID REFERENCES public.savings_goals(id) ON DELETE SET NULL,
  title                TEXT NOT NULL,
  amount               NUMERIC(12,2) NOT NULL,
  type                 TEXT NOT NULL,
  date                 DATE NOT NULL,
  notes                TEXT,
  is_recurring         BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_interval  TEXT,
  recurrence_parent_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.budgets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  amount      NUMERIC(12,2) NOT NULL,
  month       DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, category_id, month)
);

-- ── CHECK Constraints ────────────────────────────────────

ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_type_check;
ALTER TABLE public.categories
  ADD CONSTRAINT categories_type_check
  CHECK (type IN ('income', 'expense', 'saving'));

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('income', 'expense', 'saving'));

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_amount_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_amount_check
  CHECK (amount > 0);

-- NULL is allowed (non-recurring transactions have no interval)
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_recurrence_interval_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_recurrence_interval_check
  CHECK (recurrence_interval IS NULL
      OR recurrence_interval IN ('daily','weekly','monthly','yearly'));

ALTER TABLE public.savings_goals
  DROP CONSTRAINT IF EXISTS savings_goals_target_amount_check;
ALTER TABLE public.savings_goals
  ADD CONSTRAINT savings_goals_target_amount_check
  CHECK (target_amount > 0);

ALTER TABLE public.savings_goals
  DROP CONSTRAINT IF EXISTS savings_goals_current_amount_check;
ALTER TABLE public.savings_goals
  ADD CONSTRAINT savings_goals_current_amount_check
  CHECK (current_amount >= 0);

ALTER TABLE public.budgets
  DROP CONSTRAINT IF EXISTS budgets_amount_check;
ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_amount_check
  CHECK (amount > 0);

-- ── Indexes ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category  ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_goal      ON public.transactions(goal_id);
CREATE INDEX IF NOT EXISTS idx_transactions_parent    ON public.transactions(recurrence_parent_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_month     ON public.budgets(user_id, month);
CREATE INDEX IF NOT EXISTS idx_categories_user        ON public.categories(user_id);

-- ── Row Level Security ────────────────────────────────────

ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies ─────────────────────────────────────────

DROP POLICY IF EXISTS "Users manage own profile"      ON public.profiles;
DROP POLICY IF EXISTS "Users manage own categories"   ON public.categories;
DROP POLICY IF EXISTS "Users manage own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users manage own budgets"      ON public.budgets;
DROP POLICY IF EXISTS "Users manage own goals"        ON public.savings_goals;

CREATE POLICY "Users manage own profile"
  ON public.profiles FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users manage own categories"
  ON public.categories FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own transactions"
  ON public.transactions FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own budgets"
  ON public.budgets FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own goals"
  ON public.savings_goals FOR ALL USING (auth.uid() = user_id);

-- ── Trigger: auto-create profile on signup ────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- trigger needs elevated privilege to write profiles

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── RPC: Dashboard aggregate functions ───────────────────
--
-- SECURITY INVOKER: functions run as the calling user so RLS on
-- transactions applies automatically. No cross-user data leak is
-- possible even if a caller passes a foreign user_id.

CREATE OR REPLACE FUNCTION public.get_all_time_totals(p_user_id UUID)
RETURNS TABLE(total_income NUMERIC, total_expenses NUMERIC, total_savings NUMERIC)
LANGUAGE sql SECURITY INVOKER AS $$
  SELECT
    COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'saving'  THEN amount ELSE 0 END), 0)
  FROM public.transactions
  WHERE user_id = p_user_id;
$$;

-- Restrict execution to authenticated users only
REVOKE EXECUTE ON FUNCTION public.get_all_time_totals(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_all_time_totals(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_monthly_stats(p_user_id UUID)
RETURNS TABLE(
  month_start   DATE,
  income        NUMERIC,
  expenses      NUMERIC,
  first_tx_date DATE,
  last_tx_date  DATE
)
LANGUAGE sql SECURITY INVOKER AS $$
  SELECT
    date_trunc('month', date::timestamp)::DATE AS month_start,
    COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0) AS income,
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expenses,
    MIN(date)                                                            AS first_tx_date,
    MAX(date)                                                            AS last_tx_date
  FROM public.transactions
  WHERE user_id = p_user_id
    AND date >= (date_trunc('month', NOW()) - INTERVAL '5 months')::DATE
  GROUP BY date_trunc('month', date::timestamp)
  ORDER BY month_start;
$$;

REVOKE EXECUTE ON FUNCTION public.get_monthly_stats(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_monthly_stats(UUID) TO authenticated;

-- ── Billing: Phase 1 + Phase 2 prep ──────────────────────────
-- Observation-only — no features gated, no Mercado Pago wiring.
-- 006_billing.sql handles back-filling existing users; on a fresh
-- install the trigger below covers all new signups from day one.
-- 007_billing_phase2_prep.sql adds subscriptions columns,
-- billing_payments table, and get_my_plan().
-- 008_billing_adjustments.sql: get_effective_plan trialing support,
-- billing_payments status CHECK, webhook_events explicit constraint.

-- Plans catalog
CREATE TABLE IF NOT EXISTS public.plans (
  id          TEXT        PRIMARY KEY,
  name        TEXT        NOT NULL,
  price_cents INT         NOT NULL DEFAULT 0,
  currency    TEXT        NOT NULL DEFAULT 'BRL',
  features    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One subscription row per user (current state; history in billing_payments)
-- UNIQUE(user_id) is the Phase 1/2 invariant — never remove.
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id              TEXT        NOT NULL REFERENCES public.plans(id),
  status               TEXT        NOT NULL DEFAULT 'active'
                         CONSTRAINT subscriptions_status_check
                         CHECK (status IN (
                           'active', 'canceled', 'past_due', 'trialing',
                           'incomplete', 'paused', 'unpaid'
                         )),
  provider             TEXT        NOT NULL DEFAULT 'internal',
  provider_sub_id      TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  canceled_at          TIMESTAMPTZ,
  mp_subscription_id   TEXT,
  mp_customer_id       TEXT,
  cancel_reason        TEXT,
  trial_end            TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

-- Admin-issued grants (legacy transitions, promos, overrides)
CREATE TABLE IF NOT EXISTS public.plan_grants (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id    TEXT        NOT NULL REFERENCES public.plans(id),
  reason     TEXT        NOT NULL,
  granted_by TEXT        NOT NULL DEFAULT 'system',
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent log of incoming payment-provider events (insert-only).
-- id       = internal UUID PK (never sent to providers)
-- event_id = provider-assigned event ID (MP notification_id / data.id)
-- Dedup key: (provider, event_id) via uq_webhook_events_idempotency
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider     TEXT        NOT NULL,
  event_type   TEXT        NOT NULL,
  event_id     TEXT        NOT NULL,  -- provider event ID — idempotency key, NOT our internal id
  payload      JSONB       NOT NULL DEFAULT '{}',
  processed    BOOLEAN     NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_webhook_events_idempotency UNIQUE (provider, event_id)
);

-- Payment history — one row per charge attempt (immutable audit log)
-- subscription_id and plan_id are nullable to support one-off charges.
CREATE TABLE IF NOT EXISTS public.billing_payments (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id  UUID          REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  mp_payment_id    TEXT,
  mp_preference_id TEXT,
  amount           NUMERIC(12,2) NOT NULL,
  currency         TEXT          NOT NULL DEFAULT 'BRL',
  status           TEXT          NOT NULL DEFAULT 'pending'
                     CONSTRAINT billing_payments_status_check
                     CHECK (status IN (
                       'pending', 'approved', 'rejected', 'refunded',
                       'cancelled', 'in_process', 'in_mediation'
                     )),
  payment_method   TEXT,
  payment_type     TEXT,
  plan_id          TEXT          REFERENCES public.plans(id),
  period_start     TIMESTAMPTZ,
  period_end       TIMESTAMPTZ,
  raw_webhook      JSONB         NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Plan seeds
INSERT INTO public.plans (id, name, price_cents, currency, features)
VALUES
  ('free', 'Free', 0,    'BRL', '{"highlight": false}'),
  ('pro',  'Pro',  1990, 'BRL', '{"highlight": true}')
ON CONFLICT (id) DO NOTHING;

-- Billing indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user
  ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_plan_grants_user_active
  ON public.plan_grants(user_id, granted_at DESC)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_plan_grants_expires
  ON public.plan_grants(expires_at)
  WHERE revoked_at IS NULL AND expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_events_lookup
  ON public.webhook_events(provider, event_type, processed);
CREATE INDEX IF NOT EXISTS idx_billing_payments_user
  ON public.billing_payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_payments_mp_payment_id
  ON public.billing_payments(mp_payment_id)
  WHERE mp_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_payments_subscription
  ON public.billing_payments(subscription_id)
  WHERE subscription_id IS NOT NULL;

-- Billing RLS
ALTER TABLE public.plans             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_grants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payments  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Plans are publicly readable"       ON public.plans;
DROP POLICY IF EXISTS "Users read own subscription"       ON public.subscriptions;
DROP POLICY IF EXISTS "Users read own active grants"      ON public.plan_grants;
DROP POLICY IF EXISTS "Users read own billing payments"   ON public.billing_payments;

-- plans: public read (pricing page, client-side checks)
CREATE POLICY "Plans are publicly readable"
  ON public.plans FOR SELECT USING (true);

-- subscriptions: own row only; writes via service role / trigger
CREATE POLICY "Users read own subscription"
  ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

-- plan_grants: own non-revoked grants only
CREATE POLICY "Users read own active grants"
  ON public.plan_grants FOR SELECT
  USING (auth.uid() = user_id AND revoked_at IS NULL);

-- billing_payments: own rows only; writes via service role (webhooks)
CREATE POLICY "Users read own billing payments"
  ON public.billing_payments FOR SELECT USING (auth.uid() = user_id);

-- webhook_events: no user policy — all authenticated access blocked;
-- service role bypasses RLS (intentional: admin-only data).

-- get_effective_plan: priority → grant → active/trialing subscription → 'free'
-- trialing: respects trial_end when set; current_period_end check still applies.
-- Grant always wins over any subscription status (including valid trial).
CREATE OR REPLACE FUNCTION public.get_effective_plan(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT COALESCE(
    -- 1. Active plan grant (highest priority — admin always wins)
    (
      SELECT g.plan_id
      FROM   public.plan_grants g
      WHERE  g.user_id    = p_user_id
        AND  g.revoked_at IS NULL
        AND  (g.expires_at IS NULL OR g.expires_at > NOW())
      ORDER  BY g.granted_at DESC
      LIMIT  1
    ),
    -- 2. Active or trialing paid subscription
    --    trialing: also requires trial_end to be valid (or unset)
    (
      SELECT s.plan_id
      FROM   public.subscriptions s
      WHERE  s.user_id   = p_user_id
        AND  s.status    IN ('active', 'trialing')
        AND  s.plan_id  <> 'free'
        AND  (s.current_period_end IS NULL OR s.current_period_end > NOW())
        AND  (s.status <> 'trialing' OR s.trial_end IS NULL OR s.trial_end > NOW())
      ORDER  BY s.created_at DESC
      LIMIT  1
    ),
    -- 3. Default
    'free'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_effective_plan(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_effective_plan(UUID) TO authenticated;

-- get_my_plan: no-parameter client-safe wrapper around get_effective_plan.
-- Uses auth.uid() so the caller cannot request another user's plan.
CREATE OR REPLACE FUNCTION public.get_my_plan()
RETURNS TEXT
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT public.get_effective_plan(auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_plan() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_plan() TO authenticated;

-- Trigger: free subscription for every new user.
-- Uses a SEPARATE function/trigger from handle_new_user (profile trigger)
-- so the two never interfere.  PostgreSQL fires triggers alphabetically:
--   on_auth_user_created             → profile
--   on_auth_user_created_subscription → subscription
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan_id, status, provider)
  VALUES (NEW.id, 'free', 'active', 'internal')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();
