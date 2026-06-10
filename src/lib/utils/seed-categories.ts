import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_CATEGORIES = [
  // Receitas
  { name: "Salário",        type: "income",  color: "#10B981", icon: "briefcase"   },
  { name: "Freelance",      type: "income",  color: "#6366F1", icon: "code-2"      },
  { name: "Investimentos",  type: "income",  color: "#F59E0B", icon: "trending-up" },
  // Despesas
  { name: "Moradia",        type: "expense", color: "#EF4444", icon: "home"        },
  { name: "Alimentação",    type: "expense", color: "#F97316", icon: "utensils"    },
  { name: "Transporte",     type: "expense", color: "#8B5CF6", icon: "car"         },
  { name: "Saúde",          type: "expense", color: "#14B8A6", icon: "heart-pulse" },
  { name: "Beleza",         type: "expense", color: "#F472B6", icon: "sparkles"    },
  { name: "Lazer",          type: "expense", color: "#EC4899", icon: "gamepad-2"   },
  { name: "Educação",       type: "expense", color: "#3B82F6", icon: "book-open"   },
  { name: "Vestuário",      type: "expense", color: "#A855F7", icon: "shirt"       },
  { name: "Assinaturas",    type: "expense", color: "#06B6D4", icon: "repeat"      },
] as const;

export async function seedDefaultCategories(supabase: SupabaseClient, userId: string) {
  const { count, error: countError } = await supabase
    .from("categories")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (countError) {
    console.error("[seed-categories] count query failed:", countError.message);
    return; // don't attempt insert if we can't verify current state
  }

  if (count && count > 0) return; // já tem categorias

  const { error: insertError } = await supabase.from("categories").insert(
    DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: userId }))
  );
  if (insertError) {
    console.error("[seed-categories] insert failed:", insertError.message);
  }
}
