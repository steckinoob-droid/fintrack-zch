import { type Page, type Route, test } from "@playwright/test";

// ── Mock data ─────────────────────────────────────────────────────────────────

export const MOCK_USER_ID = "00000000-0000-0000-0000-000000000001";

export const MOCK_CATEGORIES = [
  { id: "cat-income-01", user_id: MOCK_USER_ID, name: "Salário",   type: "income",  color: "#10B981", icon: "briefcase", created_at: "2024-01-01T00:00:00Z" },
  { id: "cat-expense-01", user_id: MOCK_USER_ID, name: "Alimentação", type: "expense", color: "#EF4444", icon: "utensils",  created_at: "2024-01-01T00:00:00Z" },
  { id: "cat-expense-02", user_id: MOCK_USER_ID, name: "Transporte", type: "expense", color: "#F59E0B", icon: "car",       created_at: "2024-01-01T00:00:00Z" },
];

export const MOCK_TRANSACTIONS = [
  { id: "tx-001", user_id: MOCK_USER_ID, category_id: "cat-income-01", goal_id: null, title: "Salário Junho", amount: 5000, type: "income",  date: "2024-06-01", notes: null, is_recurring: false, recurrence_interval: null, recurrence_parent_id: null, created_at: "2024-06-01T10:00:00Z", category: MOCK_CATEGORIES[0] },
  { id: "tx-002", user_id: MOCK_USER_ID, category_id: "cat-expense-01", goal_id: null, title: "Supermercado",  amount: 250,  type: "expense", date: "2024-06-05", notes: null, is_recurring: false, recurrence_interval: null, recurrence_parent_id: null, created_at: "2024-06-05T12:00:00Z", category: MOCK_CATEGORIES[1] },
];

export const MOCK_GOALS = [
  { id: "goal-001", user_id: MOCK_USER_ID, name: "Viagem Europa", target_amount: 10000, current_amount: 2500, deadline: "2025-12-31", color: "#6366F1", icon: "target", created_at: "2024-01-01T00:00:00Z" },
];

export const MOCK_BUDGETS = [
  { id: "budget-001", user_id: MOCK_USER_ID, category_id: "cat-expense-01", amount: 500, month: "2024-06-01", created_at: "2024-06-01T00:00:00Z", spent: 250, category: MOCK_CATEGORIES[1] },
];

// ── Route helpers ─────────────────────────────────────────────────────────────

function fulfill(route: Route, body: unknown, status = 200) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (Array.isArray(body)) {
    headers["content-range"] = `0-${Math.max(0, body.length - 1)}/${body.length}`;
  }
  return route.fulfill({ status, headers, body: JSON.stringify(body) });
}

/** Mock all Supabase REST + RPC calls for deterministic data in tests. */
export async function mockSupabaseData(page: Page) {
  // Profiles
  await page.route("**/rest/v1/profiles*", (route) => {
    const method = route.request().method();
    if (method === "GET")   return fulfill(route, [{ id: MOCK_USER_ID, name: "Test User", avatar_url: null, currency: "BRL", initial_balance: 0, created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" }]);
    if (method === "PATCH") return fulfill(route, {});
    return route.continue();
  });

  // Categories
  await page.route("**/rest/v1/categories*", (route) => {
    const method = route.request().method();
    if (method === "GET")    return fulfill(route, MOCK_CATEGORIES);
    if (method === "POST")   return fulfill(route, [], 201);
    if (method === "PATCH")  return fulfill(route, {});
    if (method === "DELETE") return fulfill(route, {}, 204);
    return route.continue();
  });

  // Transactions
  await page.route("**/rest/v1/transactions*", (route) => {
    const method = route.request().method();
    if (method === "GET")    return fulfill(route, MOCK_TRANSACTIONS);
    if (method === "POST")   return fulfill(route, [], 201);
    if (method === "PATCH")  return fulfill(route, {});
    if (method === "DELETE") return fulfill(route, {}, 204);
    return route.continue();
  });

  // Budgets
  await page.route("**/rest/v1/budgets*", (route) => {
    const method = route.request().method();
    if (method === "GET")    return fulfill(route, MOCK_BUDGETS);
    if (method === "POST")   return fulfill(route, [], 201);
    if (method === "PATCH")  return fulfill(route, {});
    if (method === "DELETE") return fulfill(route, {}, 204);
    return route.continue();
  });

  // Savings goals
  await page.route("**/rest/v1/savings_goals*", (route) => {
    const method = route.request().method();
    if (method === "GET")    return fulfill(route, MOCK_GOALS);
    if (method === "POST")   return fulfill(route, [], 201);
    if (method === "PATCH")  return fulfill(route, {});
    if (method === "DELETE") return fulfill(route, {}, 204);
    return route.continue();
  });

  // RPC functions
  await page.route("**/rest/v1/rpc/**", (route) => {
    const url = route.request().url();
    if (url.includes("get_all_time_totals")) {
      return fulfill(route, [{ total_income: 5000, total_expenses: 250, total_savings: 0 }]);
    }
    if (url.includes("get_monthly_stats")) {
      return fulfill(route, [{ month_start: "2024-06-01", income: 5000, expenses: 250, first_tx_date: "2024-06-01", last_tx_date: "2024-06-05" }]);
    }
    return fulfill(route, []);
  });
}

/** Skip the test if auth state is empty (credentials not configured). */
export async function requireAuth(page: Page) {
  await page.goto("/dashboard");
  if (page.url().includes("/login")) {
    test.skip(true, "Auth not configured — run `npx playwright test --project=setup` with TEST_EMAIL/TEST_PASSWORD set.");
  }
}
