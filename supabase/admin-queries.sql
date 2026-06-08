-- =============================================================
-- FinTrack — Admin Billing Queries
-- =============================================================
-- Run in Supabase SQL Editor (authenticated as service role /
-- project owner) or via psql as the database owner.
-- Service role bypasses RLS so these queries see all users.
--
-- SECTIONS
--   A. Check a user's effective plan
--   B. Grant Pro access manually
--   C. Revoke a Pro grant
--   D. Extend an existing grant
--   E. Audit — all current Pro users
--   F. Audit — grants expiring soon
--   G. Audit — full billing snapshot
-- =============================================================


-- ── A. Check effective plan ───────────────────────────────────

-- A1. By user ID
SELECT public.get_effective_plan('USER-UUID-HERE'::UUID);

-- A2. By email — full detail (plan source + expiry).
--     Uses LATERAL to get only the most recent active grant per user
--     (avoids duplicate rows when a user has multiple grants).
SELECT
  u.email,
  public.get_effective_plan(u.id)  AS effective_plan,
  s.plan_id                        AS sub_plan,
  s.status                         AS sub_status,
  s.provider,
  s.current_period_end             AS sub_expires,
  g.plan_id                        AS grant_plan,
  g.reason                         AS grant_reason,
  g.expires_at                     AS grant_expires,
  g.granted_by,
  g.revoked_at
FROM      auth.users          u
LEFT JOIN public.subscriptions s ON s.user_id = u.id
LEFT JOIN LATERAL (
  SELECT *
  FROM   public.plan_grants
  WHERE  user_id    = u.id
    AND  revoked_at IS NULL
    AND  (expires_at IS NULL OR expires_at > NOW())
  ORDER  BY granted_at DESC
  LIMIT  1
) g ON true
WHERE u.email = 'user@example.com';


-- ── B. Grant Pro access ───────────────────────────────────────

-- B1. Grant Pro indefinitely (never expires)
INSERT INTO public.plan_grants (user_id, plan_id, reason, granted_by, expires_at)
SELECT id, 'pro', 'admin_override', 'admin@fintrack.app', NULL
FROM auth.users
WHERE email = 'user@example.com';

-- B2. Grant Pro for N days
INSERT INTO public.plan_grants (user_id, plan_id, reason, granted_by, expires_at)
SELECT id, 'pro', 'promotion', 'admin@fintrack.app', NOW() + INTERVAL '30 days'
FROM auth.users
WHERE email = 'user@example.com';

-- B3. Grant Pro to multiple users at once (e.g. by domain),
--     skipping anyone who already has an active promotion grant.
INSERT INTO public.plan_grants (user_id, plan_id, reason, granted_by, expires_at)
SELECT u.id, 'pro', 'promotion', 'admin@fintrack.app', NOW() + INTERVAL '30 days'
FROM auth.users u
WHERE u.email LIKE '%@company.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.plan_grants g
    WHERE  g.user_id    = u.id
      AND  g.reason     = 'promotion'
      AND  g.revoked_at IS NULL
      AND  (g.expires_at IS NULL OR g.expires_at > NOW())
  );


-- ── C. Revoke a Pro grant ─────────────────────────────────────
-- Soft-revoke only (UPDATE revoked_at = NOW()).
-- Never DELETE — the audit row must be preserved.

-- C1. Revoke all active grants for a user (by email)
UPDATE public.plan_grants
SET    revoked_at = NOW()
WHERE  user_id = (SELECT id FROM auth.users WHERE email = 'user@example.com')
  AND  revoked_at IS NULL;

-- C2. Revoke a specific grant by its UUID
UPDATE public.plan_grants
SET    revoked_at = NOW()
WHERE  id = 'GRANT-UUID-HERE'::UUID;

-- C3. Revoke only the legacy_transition grant for a user
UPDATE public.plan_grants
SET    revoked_at = NOW()
WHERE  user_id = (SELECT id FROM auth.users WHERE email = 'user@example.com')
  AND  reason    = 'legacy_transition'
  AND  revoked_at IS NULL;


-- ── D. Extend an existing grant ───────────────────────────────

-- D1. Add 30 days to a grant (GREATEST handles already-expired ones)
UPDATE public.plan_grants
SET    expires_at = GREATEST(expires_at, NOW()) + INTERVAL '30 days'
WHERE  user_id = (SELECT id FROM auth.users WHERE email = 'user@example.com')
  AND  reason    = 'legacy_transition'
  AND  revoked_at IS NULL;

-- D2. Make a grant permanent (remove expiry)
UPDATE public.plan_grants
SET    expires_at = NULL
WHERE  id = 'GRANT-UUID-HERE'::UUID;


-- ── E. Audit — all current Pro users ─────────────────────────
-- Uses a CTE so get_effective_plan is called once per user,
-- not twice (SELECT + WHERE would call it twice per row).

WITH effective AS (
  SELECT id AS user_id, public.get_effective_plan(id) AS plan
  FROM   auth.users
)
SELECT
  u.email,
  u.id                  AS user_id,
  e.plan                AS effective_plan,
  CASE
    WHEN g.id IS NOT NULL AND s.plan_id = 'pro' THEN 'grant + subscription'
    WHEN g.id IS NOT NULL                        THEN 'grant: ' || g.reason
    WHEN s.plan_id = 'pro'                       THEN 'subscription: ' || s.provider
    ELSE '(unknown)'
  END                   AS pro_source,
  g.expires_at          AS grant_expires,
  g.granted_by,
  s.current_period_end  AS sub_expires
FROM      auth.users          u
JOIN      effective            e  ON e.user_id = u.id AND e.plan = 'pro'
LEFT JOIN LATERAL (
  SELECT *
  FROM   public.plan_grants
  WHERE  user_id    = u.id
    AND  plan_id    = 'pro'
    AND  revoked_at IS NULL
    AND  (expires_at IS NULL OR expires_at > NOW())
  ORDER  BY granted_at DESC
  LIMIT  1
) g ON true
LEFT JOIN public.subscriptions s
  ON  s.user_id  = u.id
  AND s.status   = 'active'
  AND s.plan_id  = 'pro'
ORDER BY u.email;


-- ── F. Audit — grants expiring soon ──────────────────────────

-- F1. Expiring in the next 7 days
SELECT
  u.email,
  g.id          AS grant_id,
  g.reason,
  g.granted_by,
  g.expires_at,
  g.expires_at - NOW() AS time_remaining
FROM      public.plan_grants g
JOIN      auth.users         u ON u.id = g.user_id
WHERE g.revoked_at IS NULL
  AND g.expires_at IS NOT NULL
  AND g.expires_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
ORDER BY g.expires_at ASC;

-- F2. Already expired but not yet revoked (stale rows worth cleaning up)
SELECT
  u.email,
  g.id       AS grant_id,
  g.reason,
  g.expires_at,
  NOW() - g.expires_at AS expired_ago
FROM      public.plan_grants g
JOIN      auth.users         u ON u.id = g.user_id
WHERE g.revoked_at IS NULL
  AND g.expires_at < NOW()
ORDER BY g.expires_at DESC;


-- ── G. Full billing snapshot ──────────────────────────────────
-- Uses a CTE so get_effective_plan is resolved once per user and
-- can be referenced safely in both SELECT and GROUP BY.

WITH effective AS (
  SELECT id AS user_id, public.get_effective_plan(id) AS plan
  FROM   auth.users
)
SELECT
  u.email,
  u.created_at          AS user_since,
  e.plan                AS effective_plan,
  s.plan_id             AS sub_plan,
  s.status              AS sub_status,
  s.provider,
  s.current_period_end  AS sub_period_end,
  COUNT(g.id)           AS active_grants
FROM      auth.users          u
JOIN      effective            e  ON e.user_id = u.id
LEFT JOIN public.subscriptions s  ON s.user_id = u.id
LEFT JOIN public.plan_grants   g
  ON  g.user_id    = u.id
  AND g.revoked_at IS NULL
  AND (g.expires_at IS NULL OR g.expires_at > NOW())
GROUP BY
  u.email, u.id, u.created_at,
  e.plan,
  s.plan_id, s.status, s.provider, s.current_period_end
ORDER BY u.created_at DESC;
