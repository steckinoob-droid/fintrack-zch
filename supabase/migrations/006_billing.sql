-- =============================================================
-- FinTrack Migration 006: Billing infrastructure — Phase 1
-- =============================================================
--
-- PURPOSE
--   Lay the data foundation for future paid plans.
--   Phase 1 is observation-only: no features are gated,
--   no UX changes, no Mercado Pago wiring.
--
-- WHAT THIS CREATES
--   • public.plans              — plan catalog (free / pro)
--   • public.subscriptions      — one row per user
--   • public.plan_grants        — admin overrides, promos, legacy
--   • public.webhook_events     — idempotent payment event log
--   • get_effective_plan(uuid)  — returns 'free' | 'pro'
--   • handle_new_user_subscription() + trigger
--   • Legacy 60-day Pro grant for every existing user
--
-- IDEMPOTENT
--   All DDL uses IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT
--   DO NOTHING / WHERE NOT EXISTS.  Safe to re-run on a live DB.
--
-- DOES NOT TOUCH
--   • handle_new_user() or on_auth_user_created (profile trigger)
--   • Any existing table, column, or row
-- =============================================================


-- ── 0. Prerequisites ─────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ── 1. Tables ─────────────────────────────────────────────────

-- 1a. Plan catalog (admin-managed; application only reads)
CREATE TABLE IF NOT EXISTS public.plans (
  id          TEXT PRIMARY KEY,             -- 'free' | 'pro'
  name        TEXT        NOT NULL,
  price_cents INT         NOT NULL DEFAULT 0,
  currency    TEXT        NOT NULL DEFAULT 'BRL',
  features    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1b. User subscriptions — one row per user, updated in place
--     UNIQUE(user_id): Phase 1 invariant; Phase 2 (Mercado Pago)
--     will upgrade this to track multiple historical rows.
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id              TEXT        NOT NULL REFERENCES public.plans(id),
  status               TEXT        NOT NULL DEFAULT 'active',
  -- 'active' | 'canceled' | 'past_due' | 'trialing'
  provider             TEXT        NOT NULL DEFAULT 'internal',
  -- 'internal' = free / manual; 'mercadopago' = Phase 2
  provider_sub_id      TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  canceled_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

-- 1c. Admin-issued grants — legacy transitions, promos, overrides
--     Soft-revoke: revoked_at is set instead of deleting the row
--     so the audit trail is preserved.
CREATE TABLE IF NOT EXISTS public.plan_grants (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id    TEXT        NOT NULL REFERENCES public.plans(id),
  reason     TEXT        NOT NULL,
  -- 'legacy_transition' | 'admin_override' | 'promotion' | 'refund_goodwill'
  granted_by TEXT        NOT NULL DEFAULT 'system',
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,          -- NULL = never expires
  revoked_at TIMESTAMPTZ,          -- NULL = still active
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1d. Webhook event log — prevents double-processing of payment events
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider     TEXT        NOT NULL,  -- 'mercadopago' | 'stripe'
  event_type   TEXT        NOT NULL,
  event_id     TEXT        NOT NULL,  -- provider's own event ID
  payload      JSONB       NOT NULL DEFAULT '{}',
  processed    BOOLEAN     NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, event_id)         -- idempotency key
);


-- ── 2. Plan seeds ─────────────────────────────────────────────

INSERT INTO public.plans (id, name, price_cents, currency, features)
VALUES
  ('free', 'Free', 0,    'BRL', '{"highlight": false}'),
  ('pro',  'Pro',  1990, 'BRL', '{"highlight": true}')
ON CONFLICT (id) DO NOTHING;


-- ── 3. Indexes ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_subscriptions_user
  ON public.subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON public.subscriptions(status);

-- Partial index: only active (non-expired, non-revoked) grants
CREATE INDEX IF NOT EXISTS idx_plan_grants_user_active
  ON public.plan_grants(user_id, granted_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_plan_grants_expires
  ON public.plan_grants(expires_at)
  WHERE revoked_at IS NULL AND expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_events_lookup
  ON public.webhook_events(provider, event_type, processed);


-- ── 4. Row Level Security ─────────────────────────────────────

ALTER TABLE public.plans          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_grants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- plans: public read (pricing page, feature checks, client-side)
DROP POLICY IF EXISTS "Plans are publicly readable" ON public.plans;
CREATE POLICY "Plans are publicly readable"
  ON public.plans FOR SELECT USING (true);

-- subscriptions: users read their own row only;
-- all writes go through service-role / triggers (no user write policy)
DROP POLICY IF EXISTS "Users read own subscription" ON public.subscriptions;
CREATE POLICY "Users read own subscription"
  ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

-- plan_grants: users see only their own active (non-revoked) grants
DROP POLICY IF EXISTS "Users read own active grants" ON public.plan_grants;
CREATE POLICY "Users read own active grants"
  ON public.plan_grants FOR SELECT
  USING (auth.uid() = user_id AND revoked_at IS NULL);

-- webhook_events: no user policy — all authenticated access blocked;
-- service role (used by Next.js API routes) bypasses RLS automatically.
-- This is intentional: payment event logs are admin-only data.


-- ── 5. get_effective_plan(p_user_id) ─────────────────────────
--
-- Returns 'pro' or 'free' for the given user.
--
-- Priority:
--   1. Active, non-expired, non-revoked plan_grant  → grant's plan_id
--   2. Active paid subscription with valid period   → subscription's plan_id
--   3. 'free' (hard default)
--
-- SECURITY INVOKER: runs with the caller's privileges so RLS
-- on plan_grants / subscriptions scopes each user to their own rows.
-- Server-side callers (service role) bypass RLS automatically.
--
-- Phase 2 note: when feature gating is added, call this function
-- server-side (service-role) so RLS doesn't interfere with admin checks.

CREATE OR REPLACE FUNCTION public.get_effective_plan(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT COALESCE(
    -- 1. Active plan grant (highest priority — admin can always override)
    (
      SELECT g.plan_id
      FROM   public.plan_grants g
      WHERE  g.user_id    = p_user_id
        AND  g.revoked_at IS NULL
        AND  (g.expires_at IS NULL OR g.expires_at > NOW())
      ORDER  BY g.granted_at DESC
      LIMIT  1
    ),
    -- 2. Active paid subscription (not free, not expired)
    (
      SELECT s.plan_id
      FROM   public.subscriptions s
      WHERE  s.user_id   = p_user_id
        AND  s.status    = 'active'
        AND  s.plan_id  <> 'free'
        AND  (s.current_period_end IS NULL OR s.current_period_end > NOW())
      ORDER  BY s.created_at DESC
      LIMIT  1
    ),
    -- 3. Default
    'free'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_effective_plan(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_effective_plan(UUID) TO authenticated;


-- ── 6. Trigger: free subscription for every new user ─────────
--
-- Uses a SEPARATE function and trigger so it cannot interfere with
-- the existing handle_new_user() / on_auth_user_created that creates
-- the profiles row. Both triggers fire AFTER INSERT ON auth.users;
-- PostgreSQL runs them in alphabetical trigger-name order, so
-- on_auth_user_created fires before on_auth_user_created_subscription.
--
-- SECURITY DEFINER is required for AFTER INSERT triggers on auth.users
-- to write into public.* tables (same pattern as handle_new_user).
-- Risk is minimal: the only write is a single INSERT for NEW.id —
-- the trigger cannot be exploited to create rows for other users.

CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan_id, status, provider)
  VALUES (NEW.id, 'free', 'active', 'internal')
  ON CONFLICT (user_id) DO NOTHING;  -- safe if trigger somehow fires twice
  RETURN NEW;
END;
$$;

-- Drop and recreate our own trigger only — does NOT touch on_auth_user_created
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();


-- ── 7. Back-fill existing users ───────────────────────────────
--
-- Users created before this migration have no subscription or grant.
-- Both INSERTs are guarded with WHERE NOT EXISTS — idempotent.

-- 7a. Free subscription for every existing user
INSERT INTO public.subscriptions (user_id, plan_id, status, provider)
SELECT p.id, 'free', 'active', 'internal'
FROM   public.profiles p
WHERE  NOT EXISTS (
  SELECT 1 FROM public.subscriptions s WHERE s.user_id = p.id
);

-- 7b. 60-day Pro grant for every existing user (legacy transition)
--     Reason: launching billing should not feel like a downgrade to
--     people who've been using the app since before it was paid.
INSERT INTO public.plan_grants
  (user_id, plan_id, reason, granted_by, granted_at, expires_at)
SELECT
  p.id,
  'pro',
  'legacy_transition',
  'system',
  NOW(),
  NOW() + INTERVAL '60 days'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.plan_grants g
  WHERE  g.user_id = p.id
    AND  g.reason  = 'legacy_transition'
);
