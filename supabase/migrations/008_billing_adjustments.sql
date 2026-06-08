-- =============================================================
-- FinTrack Migration 008: Billing adjustments and hardening
-- =============================================================
--
-- PURPOSE
--   Three targeted fixes identified in the Phase 2 prep audit:
--   1. get_effective_plan — honour 'trialing' subscriptions with
--                           trial_end expiry check
--   2. billing_payments   — enforce status vocabulary via CHECK
--   3. webhook_events     — explicit constraint name + column docs
--
-- WHAT THIS CHANGES
--   • get_effective_plan(uuid) — updated (CREATE OR REPLACE)
--   • billing_payments         — ADD CONSTRAINT billing_payments_status_check
--   • webhook_events           — renamed UNIQUE + COMMENT ON
--
-- WHAT THIS DOES NOT CHANGE
--   • Any table DDL or column list
--   • get_my_plan() — still calls get_effective_plan, unchanged
--   • handle_new_user_subscription() / trigger
--   • UNIQUE(user_id) on subscriptions
--   • Any existing row data
--   • No Mercado Pago, checkout, webhooks, pricing page or paywall
--
-- IDEMPOTENT
--   CREATE OR REPLACE FUNCTION, DROP CONSTRAINT IF EXISTS + ADD,
--   COMMENT ON (idempotent by definition). Safe to re-run.
-- =============================================================


-- ── 1. get_effective_plan — include 'trialing' ────────────────
--
-- Priority (unchanged from 006):
--   1. Active non-revoked non-expired plan_grant  → grant plan_id
--   2. Active OR trialing paid subscription       → subscription plan_id
--   3. 'free' (hard default)
--
-- New in 008: 'trialing' added to the status filter.
-- Trial expiry rule:
--   active   → current_period_end check only (unchanged)
--   trialing → current_period_end check AND trial_end check
--              (trial_end IS NULL means no expiry set = still valid)
--
-- Grant priority is unchanged — a manual Pro grant still overrides
-- any subscription status, including a valid trial.

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
    --    Both statuses require current_period_end to be valid (or unset).
    --    trialing additionally requires trial_end to be valid (or unset).
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


-- ── 2. billing_payments.status CHECK constraint ───────────────
--
-- Enforces Mercado Pago status vocabulary at the DB level.
-- Default value 'pending' is in the allowed set — no default change.
-- billing_payments was created in 007 with zero rows (no MP yet),
-- so no data migration is needed before adding this constraint.

ALTER TABLE public.billing_payments
  DROP CONSTRAINT IF EXISTS billing_payments_status_check;

ALTER TABLE public.billing_payments
  ADD CONSTRAINT billing_payments_status_check
  CHECK (status IN (
    'pending',      -- charge initiated, awaiting provider response
    'approved',     -- payment confirmed
    'rejected',     -- payment declined by issuer
    'refunded',     -- refunded after approval
    'cancelled',    -- cancelled before capture
    'in_process',   -- under review by provider
    'in_mediation'  -- dispute / chargeback opened
  ));


-- ── 3. webhook_events — explicit constraint name + docs ───────
--
-- The table has two distinct ID fields that must never be confused:
--
--   id       UUID NOT NULL PK  — internal auto-generated row ID
--                                never sent to or received from providers
--   event_id TEXT NOT NULL     — provider-assigned event ID
--                                (e.g. Mercado Pago notification_id / data.id)
--                                THIS is the dedup / idempotency key
--
-- The UNIQUE(provider, event_id) was created without a name in 006,
-- which would give it an auto-generated name
-- (webhook_events_provider_event_id_key). Naming it explicitly makes
-- future code and error messages unambiguous.

ALTER TABLE public.webhook_events
  DROP CONSTRAINT IF EXISTS webhook_events_provider_event_id_key; -- auto-generated (006)
ALTER TABLE public.webhook_events
  DROP CONSTRAINT IF EXISTS uq_webhook_events_idempotency;        -- guard for re-run
ALTER TABLE public.webhook_events
  ADD CONSTRAINT uq_webhook_events_idempotency
  UNIQUE (provider, event_id);

COMMENT ON TABLE  public.webhook_events IS
  'Idempotent log of incoming payment-provider events. '
  'Insert-only: never UPDATE or DELETE a row after it is processed. '
  'Dedup key: (provider, event_id) via constraint uq_webhook_events_idempotency.';

COMMENT ON COLUMN public.webhook_events.id IS
  'Internal UUID PK — auto-generated. Never exposed to or received from providers. '
  'Do not use this as the idempotency key; use event_id instead.';

COMMENT ON COLUMN public.webhook_events.event_id IS
  'Provider-assigned event ID (e.g. Mercado Pago notification_id or data.id). '
  'Combined with provider, this is the idempotency key '
  '(constraint uq_webhook_events_idempotency). '
  'Always check ON CONFLICT (provider, event_id) when inserting.';

COMMENT ON COLUMN public.webhook_events.processed IS
  'Set to TRUE once the event has been fully handled. '
  'processed_at records the timestamp of that transition.';
