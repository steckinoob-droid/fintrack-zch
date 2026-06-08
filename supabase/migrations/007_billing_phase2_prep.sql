-- =============================================================
-- FinTrack Migration 007: Billing Phase 2 preparation
-- =============================================================
--
-- PURPOSE
--   Extend the billing schema to support real payment records
--   from Mercado Pago (Phase 2).  Phase 2 is NOT wired yet —
--   this migration only prepares the columns and tables so the
--   schema is ready before any application code lands.
--
-- WHAT THIS CHANGES
--   • public.subscriptions — 4 new nullable columns + status CHECK
--   • public.billing_payments — new table (payment history per charge)
--   • get_my_plan() — no-parameter version of get_effective_plan()
--                     safe for direct client-side use
--
-- WHAT THIS DOES NOT CHANGE
--   • UNIQUE(user_id) on subscriptions — kept (Phase 2 invariant)
--   • get_effective_plan(uuid) — untouched
--   • handle_new_user_subscription() / trigger — untouched
--   • webhook_events — processed_at already exists from 006
--   • Any existing row data
--
-- IDEMPOTENT
--   ADD COLUMN IF NOT EXISTS, DROP CONSTRAINT IF EXISTS,
--   CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
--   DROP POLICY IF EXISTS.  Safe to re-run on a live DB.
-- =============================================================


-- ── 1. Extend subscriptions ───────────────────────────────────
--
-- canceled_at already exists from 006 — NOT added here.
-- All four columns are nullable: existing rows are unaffected.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS mp_subscription_id TEXT,      -- MP recurring sub ID
  ADD COLUMN IF NOT EXISTS mp_customer_id      TEXT,      -- MP customer/payer ID
  ADD COLUMN IF NOT EXISTS cancel_reason       TEXT,      -- human-readable cancel reason
  ADD COLUMN IF NOT EXISTS trial_end           TIMESTAMPTZ; -- when trial expires


-- ── 2. CHECK constraint on subscriptions.status ───────────────
--
-- All existing rows have status = 'active', which is in the
-- allowed list — no data migration needed before adding this.

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN (
    'active',
    'canceled',
    'past_due',
    'trialing',
    'incomplete',
    'paused',
    'unpaid'
  ));


-- ── 3. billing_payments table ─────────────────────────────────
--
-- Immutable payment record per charge attempt.
-- subscriptions keeps the CURRENT state (one row per user);
-- billing_payments keeps the full history (one row per event).
--
-- subscription_id is nullable so that one-off charges that are
-- not tied to a recurring subscription can still be recorded.
-- plan_id is nullable for the same reason (e.g. top-up credits).

CREATE TABLE IF NOT EXISTS public.billing_payments (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id  UUID          REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  mp_payment_id    TEXT,                          -- Mercado Pago payment ID
  mp_preference_id TEXT,                          -- Mercado Pago preference ID
  amount           NUMERIC(12,2) NOT NULL,
  currency         TEXT          NOT NULL DEFAULT 'BRL',
  status           TEXT          NOT NULL DEFAULT 'pending',
  -- 'pending' | 'approved' | 'rejected' | 'refunded' | 'cancelled'
  -- | 'in_process' | 'in_mediation'  (MP status vocabulary)
  payment_method   TEXT,                          -- 'credit_card' | 'pix' | 'boleto' | ...
  payment_type     TEXT,                          -- 'one_time' | 'recurring'
  plan_id          TEXT          REFERENCES public.plans(id),
  period_start     TIMESTAMPTZ,
  period_end       TIMESTAMPTZ,
  raw_webhook      JSONB         NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- ── 4. billing_payments indexes ───────────────────────────────

CREATE INDEX IF NOT EXISTS idx_billing_payments_user
  ON public.billing_payments(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_payments_mp_payment_id
  ON public.billing_payments(mp_payment_id)
  WHERE mp_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_payments_subscription
  ON public.billing_payments(subscription_id)
  WHERE subscription_id IS NOT NULL;


-- ── 5. billing_payments RLS ───────────────────────────────────
--
-- Users can SELECT their own payment history.
-- INSERT / UPDATE / DELETE are only via service role (webhooks,
-- admin scripts) — no authenticated user write policy is created.

ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own billing payments" ON public.billing_payments;
CREATE POLICY "Users read own billing payments"
  ON public.billing_payments FOR SELECT
  USING (auth.uid() = user_id);


-- ── 6. get_my_plan() ──────────────────────────────────────────
--
-- A no-parameter wrapper around get_effective_plan() that uses
-- auth.uid() internally.  Because the UUID comes from the session
-- (not a parameter), it is safe to call from the client — a caller
-- cannot ask for another user's plan by passing a different UUID.
--
-- SECURITY INVOKER: runs as the calling user, so RLS on
-- plan_grants / subscriptions scopes reads to that user's rows.
-- auth.uid() still reflects the authenticated session.

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
