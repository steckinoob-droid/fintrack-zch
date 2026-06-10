/**
 * Central plan / feature-gate helpers — single source of truth for paywall rules.
 *
 * Usage (client component):
 *   const plan = usePlan();                               // string | null
 *   if (!canUseFeature("export_csv", plan)) { ... }
 *
 * `null` means the plan is still loading. Every check treats `null` as
 * "not allowed" to prevent any flash-of-access before the value resolves.
 * The consequence is that gated buttons are briefly disabled while the plan
 * loads — identical behaviour to the existing <UpgradeCta /> component.
 */

// ── Feature catalogue ─────────────────────────────────────────────────────────

/**
 * All plan-gated features across all Parts of the paywall rollout.
 * Using a string-literal union so TypeScript catches typos at call sites.
 *
 * Parts 2 & 3 are listed but NOT in ENFORCED_PRO_FEATURES yet.
 * Add them to the Set below when the corresponding Part ships.
 */
export type ProFeature =
  // ── Part 1 (active) ────────────────────────────────────────────────────────
  | "export_csv"           // Export current transactions view as CSV
  | "backup_json"          // Export full account backup as JSON
  // ── Part 2 (pending) ───────────────────────────────────────────────────────
  | "import_unlimited"     // More than 1 statement import per month
  | "reports_full"         // Reports beyond the last 3 months
  // ── Part 3 (pending) ───────────────────────────────────────────────────────
  | "goals_unlimited"      // More than 2 savings goals
  | "recurring_unlimited"; // More than 5 recurring transactions

/**
 * Features that are actively enforced right now.
 * Expand this Set when shipping a new Part.
 */
const ENFORCED_PRO_FEATURES = new Set<ProFeature>([
  "export_csv",
  "backup_json",
  // Part 2 (active)
  "import_unlimited",
  "reports_full",
  // Part 3 (active)
  "goals_unlimited",
  "recurring_unlimited",
]);

// ── Free-tier numeric limits (Part 3) ─────────────────────────────────────────
/** Maximum savings goals a Free user may have. Creating the (n+1)-th is blocked. */
export const FREE_GOALS_LIMIT = 2;
/** Maximum recurring-transaction templates a Free user may have. */
export const FREE_RECURRING_LIMIT = 2;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Type-guard that returns true when the resolved plan is "pro".
 * Safe to call with the raw value from `usePlan()` which may be null/undefined
 * while the async hook is still fetching.
 */
export function isPro(plan: string | null | undefined): plan is "pro" {
  return plan === "pro";
}

/**
 * Returns true when the user is allowed to use the given feature.
 *
 * - `null` / `undefined` (loading) → false  (prevents flash-of-access)
 * - "pro"                           → true   (all features always allowed)
 * - "free"                          → true only for features NOT in ENFORCED_PRO_FEATURES
 */
export function canUseFeature(
  feature: ProFeature,
  plan: string | null | undefined,
): boolean {
  if (plan == null) return false;
  if (isPro(plan)) return true;
  return !ENFORCED_PRO_FEATURES.has(feature);
}
