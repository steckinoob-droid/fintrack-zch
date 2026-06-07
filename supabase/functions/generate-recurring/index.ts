/**
 * Supabase Edge Function: generate-recurring
 *
 * Runs on a cron schedule (e.g. daily at 00:05 UTC) and generates
 * recurring transaction occurrences for ALL users who have any.
 *
 * ─── SETUP ────────────────────────────────────────────────────────────────
 * 1. Deploy this function:
 *    supabase functions deploy generate-recurring --no-verify-jwt
 *
 * 2. Set the service-role key as a secret:
 *    supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-key>
 *
 * 3. Create the cron in Supabase Dashboard → Database → Cron Jobs:
 *    name: generate-recurring-daily
 *    schedule: 5 0 * * *   (daily at 00:05 UTC)
 *    command:
 *      select net.http_post(
 *        url := 'https://<project-ref>.supabase.co/functions/v1/generate-recurring',
 *        headers := '{"Authorization":"Bearer <anon-key>","x-cron-secret":"<random-secret>"}'::jsonb,
 *        body := '{}'::jsonb
 *      );
 *
 *    Or use pg_cron via SQL:
 *    select cron.schedule(
 *      'generate-recurring-daily',
 *      '5 0 * * *',
 *      $$select net.http_post(...)$$
 *    );
 *
 * 4. Add CRON_SECRET to secrets (same random string used in the schedule):
 *    supabase secrets set CRON_SECRET=<random-secret>
 * ─────────────────────────────────────────────────────────────────────────
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL             = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET              = Deno.env.get("CRON_SECRET");

Deno.serve(async (req: Request) => {
  // ── Optional: verify the cron secret so random callers can't trigger it ──
  if (CRON_SECRET) {
    const incoming = req.headers.get("x-cron-secret");
    if (incoming !== CRON_SECRET) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Get all users who have at least one recurring parent transaction ──────
  const { data: recurringRows, error } = await admin
    .from("transactions")
    .select("user_id")
    .eq("is_recurring", true)
    .is("recurrence_parent_id", null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const uniqueUsers = [...new Set((recurringRows ?? []).map((r: { user_id: string }) => r.user_id))];

  let processed = 0;
  let errors    = 0;

  for (const userId of uniqueUsers) {
    try {
      // Use the user's own client (anon) to respect RLS, but we pass the
      // service key so we can read/write on behalf of the user.
      // NOTE: generateRecurringTransactions is the same logic as the client-side
      // utility. Here we inline a minimal version to avoid a circular import
      // with Deno.
      await runForUser(admin, userId);
      processed++;
    } catch (err) {
      console.error(`Error processing user ${userId}:`, err);
      errors++;
    }
  }

  return new Response(
    JSON.stringify({ processed, errors, users: uniqueUsers.length }),
    { headers: { "Content-Type": "application/json" } }
  );
});

// ── Inline recurring generation logic (mirrors src/lib/utils/recurring.ts) ──
async function runForUser(supabase: ReturnType<typeof createClient>, userId: string) {
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  const { data: parents } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .eq("is_recurring", true)
    .is("recurrence_parent_id", null);

  if (!parents?.length) return;

  for (const parent of parents) {
    const interval = parent.recurrence_interval as string | null;
    if (!interval) continue;

    const parentDate  = new Date(parent.date);
    const parentDay   = parentDate.getDate();
    const parentMonth = parentDate.getMonth();

    const { data: latestChildren } = await supabase
      .from("transactions")
      .select("date")
      .eq("user_id", userId)
      .eq("recurrence_parent_id", parent.id)
      .order("date", { ascending: false })
      .limit(1);

    const baseDate = latestChildren?.[0]
      ? new Date(latestChildren[0].date)
      : parentDate;

    // Safety cap: daily/weekly → max 90 days back
    const maxLookback =
      interval === "daily" || interval === "weekly"
        ? new Date(now.getTime() - 90 * 24 * 3600 * 1000)
        : new Date(0);

    const effectiveBase = baseDate > maxLookback ? baseDate : maxLookback;
    let nextDate = advance(effectiveBase, interval);

    while (nextDate <= now) {
      let occurrenceDate: Date;
      if (interval === "monthly") {
        occurrenceDate = clamp(nextDate.getFullYear(), nextDate.getMonth(), parentDay);
      } else if (interval === "yearly") {
        occurrenceDate = clamp(nextDate.getFullYear(), parentMonth, parentDay);
      } else {
        occurrenceDate = nextDate;
      }

      const dateStr    = fmtDate(occurrenceDate);
      const monthStart = fmtDate(new Date(occurrenceDate.getFullYear(), occurrenceDate.getMonth(), 1));
      const monthEnd   = fmtDate(new Date(occurrenceDate.getFullYear(), occurrenceDate.getMonth() + 1, 0));

      let exists = false;
      if (interval === "monthly" || interval === "yearly") {
        const { count } = await supabase
          .from("transactions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("recurrence_parent_id", parent.id)
          .gte("date", monthStart)
          .lte("date", monthEnd);
        exists = (count ?? 0) > 0;
      } else {
        const { count } = await supabase
          .from("transactions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("recurrence_parent_id", parent.id)
          .eq("date", dateStr);
        exists = (count ?? 0) > 0;
      }

      if (!exists) {
        await supabase.from("transactions").insert({
          user_id: parent.user_id,
          category_id: parent.category_id,
          title: parent.title,
          amount: parent.amount,
          type: parent.type,
          date: dateStr,
          notes: parent.notes,
          is_recurring: false,
          recurrence_parent_id: parent.id,
          recurrence_interval: null,
        });

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
              await supabase.from("savings_goals").update({ current_amount: newAmt }).eq("id", goalId);
            }
          }
        }
      }

      nextDate = advance(nextDate, interval);
    }
  }
}

function advance(date: Date, interval: string): Date {
  const d = new Date(date);
  if (interval === "daily")   { d.setDate(d.getDate() + 1); }
  if (interval === "weekly")  { d.setDate(d.getDate() + 7); }
  if (interval === "monthly") { d.setMonth(d.getMonth() + 1); }
  if (interval === "yearly")  { d.setFullYear(d.getFullYear() + 1); }
  return d;
}

function clamp(year: number, month: number, day: number): Date {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, last));
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
