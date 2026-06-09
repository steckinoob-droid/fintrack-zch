-- FinTrack Migration 010: import_logs
-- Tracks CSV/OFX/PDF import events for per-month rate limiting.
-- Free users are limited to 1 successful import per calendar month.
-- An import is "successful" when transaction_count > 0 (all-duplicate
-- batches do not consume the monthly slot).
--
-- New installs: 000_consolidated.sql will incorporate this table.
-- Existing installs: run this file in the Supabase SQL Editor.

-- ── Table ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.import_logs (
  id                uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  transaction_count integer     NOT NULL DEFAULT 0 CHECK (transaction_count >= 0),
  file_mode         text        NOT NULL DEFAULT 'csv'
                                CHECK (file_mode IN ('csv', 'ofx', 'pdf'))
);

CREATE INDEX IF NOT EXISTS import_logs_user_month_idx
  ON public.import_logs (user_id, created_at DESC);

-- ── Row-level security ─────────────────────────────────────────────────────────

ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

-- Idempotent policy creation (DROP + CREATE)
DROP POLICY IF EXISTS "Users can view their own import logs"  ON public.import_logs;
DROP POLICY IF EXISTS "Users can insert their own import logs" ON public.import_logs;

CREATE POLICY "Users can view their own import logs"
  ON public.import_logs FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT is done via service-role (bypasses RLS) on the server, but this
-- policy ensures the row is safe if ever called with the anon/auth key.
CREATE POLICY "Users can insert their own import logs"
  ON public.import_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Grant table access to the authenticated role
GRANT SELECT, INSERT ON public.import_logs TO authenticated;
