-- Migration 009: Add UNIQUE constraint on billing_payments.mp_payment_id
--
-- Required for atomic idempotency in the webhook handler.
-- The webhook now uses INSERT ... ON CONFLICT DO NOTHING via Supabase's
-- upsert({ onConflict: "mp_payment_id", ignoreDuplicates: true }) instead of
-- a non-atomic check-then-insert pattern.
--
-- NULLs are exempt (UNIQUE constraints in PostgreSQL allow multiple NULLs).

ALTER TABLE public.billing_payments
  DROP CONSTRAINT IF EXISTS uq_billing_payments_mp_payment_id;

ALTER TABLE public.billing_payments
  ADD CONSTRAINT uq_billing_payments_mp_payment_id UNIQUE (mp_payment_id);

-- The existing non-unique index is now redundant; the UNIQUE constraint
-- creates its own index. Drop the old one to avoid double-indexing.
DROP INDEX IF EXISTS idx_billing_payments_mp_payment_id;
