-- FinTrack Migration 004: Initial balance on profiles
-- Allows users to set an opening balance so Total Balance reflects real finances.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS initial_balance NUMERIC(12,2) NOT NULL DEFAULT 0;
