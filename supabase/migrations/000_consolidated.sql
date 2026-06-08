-- =========================================================
-- FinTrack – Consolidated Schema (v1.1)
--
-- NEW INSTALL: run THIS file once via Supabase SQL Editor.
--   It creates all tables, RLS policies, indexes, triggers
--   and RPC functions in one shot.
--
-- EXISTING INSTALL (already ran 001–004): run ONLY:
--   005_rpc_functions.sql
--   (adds get_all_time_totals + get_monthly_stats; safe to
--    re-run — uses CREATE OR REPLACE)
--
-- The dashboard falls back to direct queries if the RPCs are
-- missing, so skipping 005 degrades performance but never
-- breaks the UI.
-- =========================================================

-- ── Extensions ──────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Tables ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT,
  avatar_url      TEXT,
  currency        TEXT NOT NULL DEFAULT 'BRL',
  initial_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
