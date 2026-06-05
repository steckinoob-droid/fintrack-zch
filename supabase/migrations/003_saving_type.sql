-- FinTrack Migration 003: Add "saving" transaction type
-- Run this once in your Supabase SQL Editor

-- 1. Allow "saving" as a valid transaction type
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN (''income'', ''expense'', ''saving''));

-- 2. Allow "saving" as a valid category type (for future use)
ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_type_check;
ALTER TABLE public.categories
  ADD CONSTRAINT categories_type_check
  CHECK (type IN (''income'', ''expense'', ''saving''));

-- 3. Link saving transactions back to their goal (optional but useful)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS goal_id UUID
  REFERENCES public.savings_goals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_goal
  ON public.transactions(goal_id);
