import type { SupabaseClient } from "@supabase/supabase-js";
import { format, addDays, addWeeks, addMonths, addYears, parseISO, isBefore, startOfMonth, endOfMonth } from "date-fns";
import type { Transaction } from "@/lib/types";

/**
 * Verifica transações recorrentes e gera as do mês atual que ainda não existem.
 */
export async function generateRecurringTransactions(supabase: SupabaseClient, userId: string) {
  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd   = format(endOfMonth(now),   "yyyy-MM-dd");

  // Busca todas as transações pai (recorrentes originais)
  const { data: parents } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .eq("is_recurring", true)
    .is("recurrence_parent_id", null);

  if (!parents?.length) return;

  for (const parent of parents as Transaction[]) {
    if (!parent.recurrence_interval) continue;

    // Verifica se já foi gerada este mês
    const { count } = await supabase
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("recurrence_parent_id", parent.id)
      .gte("date", monthStart)
      .lte("date", monthEnd);

    if (count && count > 0) continue; // já existe

    // Calcula a data desta ocorrência
    const parentDate = parseISO(parent.date);
    let nextDate: Date;
    switch (parent.recurrence_interval) {
      case "daily":   nextDate = addDays(parentDate, 1);   break;
      case "weekly":  nextDate = addWeeks(parentDate, 1);  break;
      case "monthly": nextDate = addMonths(parentDate, 1); break;
      case "yearly":  nextDate = addYears(parentDate, 1);  break;
      default: continue;
    }

    // Ajusta para cair dentro do mês atual
    const targetDate = new Date(now.getFullYear(), now.getMonth(), parseISO(parent.date).getDate());
    const dateStr = format(targetDate, "yyyy-MM-dd");

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
    });
  }
}
