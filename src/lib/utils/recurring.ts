import type { SupabaseClient } from "@supabase/supabase-js";
import {
  format, addDays, addWeeks, addMonths, addYears, parseISO,
  isAfter, startOfMonth, endOfMonth, lastDayOfMonth, subYears,
} from "date-fns";
import type { Transaction } from "@/lib/types";

type Interval = "daily" | "weekly" | "monthly" | "yearly";

function getNextOccurrence(date: Date, interval: Interval): Date {
  switch (interval) {
    case "daily":   return addDays(date, 1);
    case "weekly":  return addWeeks(date, 1);
    case "monthly": return addMonths(date, 1);
    case "yearly":  return addYears(date, 1);
  }
}

/** Clamp day-of-month so Feb 31 becomes Feb 28/29, etc. */
function clampToEndOfMonth(year: number, month: number, day: number): Date {
  const last = lastDayOfMonth(new Date(year, month, 1)).getDate();
  return new Date(year, month, Math.min(day, last));
}

/**
 * Generates all missed recurring transaction occurrences up to today.
 *
 * This replaces the previous "current-month-only" logic that silently dropped
 * intermediate months when the user hadn't opened the app in a while.
 *
 * Safety caps:
 *  - daily / weekly → max 90 days of lookback
 *  - monthly / yearly → no cap (1 per month/year is fine)
 */
export async function generateRecurringTransactions(
  supabase: SupabaseClient,
  userId: string,
) {
  const now = new Date();
  now.setHours(23, 59, 59, 999); // include all of today

  // Load all parent recurring transactions (is_recurring=true, no parent)
  const { data: parents } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .eq("is_recurring", true)
    .is("recurrence_parent_id", null);

  if (!parents?.length) return;

  for (const parent of parents as Transaction[]) {
    const interval = parent.recurrence_interval as Interval | null;
    if (!interval) continue;

    const parentDate   = parseISO(parent.date);
    const parentDay    = parentDate.getDate();   // day-of-month (for monthly clamping)
    const parentMonth  = parentDate.getMonth();  // month (for yearly clamping)

    // ── Safety cap: for daily/weekly don't go back more than 90 days ──────────
    const maxLookback =
      interval === "daily" || interval === "weekly"
        ? addDays(now, -90)
        : subYears(now, 10); // effectively no cap for monthly/yearly

    // ── Find the most recently generated child ─────────────────────────────────
    const { data: latestChildren } = await supabase
      .from("transactions")
      .select("date")
      .eq("user_id", userId)
      .eq("recurrence_parent_id", parent.id)
      .order("date", { ascending: false })
      .limit(1);

    const baseDate = latestChildren?.[0]
      ? parseISO(latestChildren[0].date)
      : parentDate; // no children yet → start from parent

    // If the base is before the safety cap, jump the cap forward
    const effectiveBase = isAfter(baseDate, maxLookback) ? baseDate : maxLookback;

    let nextDate = getNextOccurrence(effectiveBase, interval);

    // ── Generate every missed occurrence up to today ───────────────────────────
    while (!isAfter(nextDate, now)) {
      // Compute the actual calendar date for this occurrence
      let occurrenceDate: Date;
      if (interval === "monthly") {
        occurrenceDate = clampToEndOfMonth(nextDate.getFullYear(), nextDate.getMonth(), parentDay);
      } else if (interval === "yearly") {
        occurrenceDate = clampToEndOfMonth(nextDate.getFullYear(), parentMonth, parentDay);
      } else {
        occurrenceDate = nextDate; // daily / weekly: exact date
      }

      const dateStr    = format(occurrenceDate, "yyyy-MM-dd");
      const monthStart = format(startOfMonth(occurrenceDate), "yyyy-MM-dd");
      const monthEnd   = format(endOfMonth(occurrenceDate),   "yyyy-MM-dd");

      // ── Duplicate check ────────────────────────────────────────────────────
      let alreadyExists = false;
      if (interval === "monthly" || interval === "yearly") {
        // Allow at most one child per calendar month/year
        const { count } = await supabase
          .from("transactions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("recurrence_parent_id", parent.id)
          .gte("date", monthStart)
          .lte("date", monthEnd);
        alreadyExists = (count ?? 0) > 0;
      } else {
        // daily / weekly: check the exact date
        const { count } = await supabase
          .from("transactions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("recurrence_parent_id", parent.id)
          .eq("date", dateStr);
        alreadyExists = (count ?? 0) > 0;
      }

      if (!alreadyExists) {
        await supabase.from("transactions").insert({
          user_id:             parent.user_id,
          category_id:         parent.category_id,
          goal_id:             parent.goal_id ?? null,
          title:               parent.title,
          amount:              parent.amount,
          type:                parent.type,
          date:                dateStr,
          notes:               parent.notes,
          is_recurring:        false,
          recurrence_parent_id: parent.id,
          recurrence_interval: null,
        });

        // If this is a goal auto-deposit, update the goal's current_amount
        if (parent.type === "saving" && parent.notes?.startsWith("goal_id:")) {
          const goalId = parent.notes.replace("goal_id:", "").trim();
          if (goalId) {
            const { data: goal } = await supabase
              .from("savings_goals")
              .select("current_amount, target_amount")
              .eq("id", goalId)
              .single();
            if (goal) {
              const newAmt = Math.min(goal.target_amount, goal.current_amount + parent.amount);
              await supabase
                .from("savings_goals")
                .update({ current_amount: newAmt })
                .eq("id", goalId);
            }
          }
        }
      }

      nextDate = getNextOccurrence(nextDate, interval);
    }
  }
}
