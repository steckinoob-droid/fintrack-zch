-- FinTrack Migration 005: Dashboard aggregate RPC functions
-- Run in Supabase SQL Editor on existing installs.
-- New installs: use 000_consolidated.sql instead.
--
-- SECURITY INVOKER: functions execute as the calling user so RLS on
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
