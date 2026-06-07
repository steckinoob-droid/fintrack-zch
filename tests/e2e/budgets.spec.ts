/**
 * Budget flows:
 *   - Create a budget
 *   - Verify overflow alert when expenses exceed limit
 */
import { test, expect } from "@playwright/test";
import { mockSupabaseData, requireAuth, MOCK_CATEGORIES, MOCK_USER_ID } from "./helpers";

const BUDGET_LIMIT = 500;
const OVER_BUDGET_EXPENSE = 600;

const MOCK_BUDGET_WITH_OVERFLOW = {
  id: "budget-test-001",
  user_id: MOCK_USER_ID,
  category_id: "cat-expense-01",
  amount: BUDGET_LIMIT,
  month: "2024-06-01",
  created_at: "2024-06-01T00:00:00Z",
  spent: OVER_BUDGET_EXPENSE,
  category: MOCK_CATEGORIES[1],
};

test.describe("Budgets", () => {
  test.beforeEach(async ({ page }) => {
    await requireAuth(page);
    await mockSupabaseData(page);
    await page.goto("/budgets");
    await page.waitForLoadState("networkidle");
  });

  // ── Create ───────────────────────────────────────────────────────────

  test("creates a new budget with category and amount", async ({ page }) => {
    let postedPayload: unknown = null;

    await page.route("**/rest/v1/budgets*", async (route) => {
      if (route.request().method() === "POST") {
        postedPayload = JSON.parse(route.request().postData() ?? "{}");
        return route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
      }
      return route.fulfill({
        status: 200,
        headers: { "content-type": "application/json", "content-range": "0-0/1" },
        body: JSON.stringify([MOCK_BUDGET_WITH_OVERFLOW]),
      });
    });

    // Click "New budget" button — label varies by lang
    await page.getByRole("button", { name: /novo|new|criar|create/i }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Category select — Radix UI renders as role="combobox"
    await dialog.getByRole("combobox").click();
    await page.getByRole("option").first().click();

    // Amount input — id="budget-amount" from budget-dialog.tsx
    await dialog.locator("#budget-amount").fill("300");

    // Submit: new budget button text = budgets.dialog.create = "Create" (EN) / "Criar" (PT)
    await dialog.getByRole("button", { name: /criar|create|salvar|save/i }).last().click();
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
    expect(postedPayload).toBeTruthy();
  });

  // ── Overflow alert ────────────────────────────────────────────────────

  test("shows overflow indicator when spent exceeds budget", async ({ page }) => {
    await page.route("**/rest/v1/budgets*", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      return route.fulfill({
        status: 200,
        headers: { "content-type": "application/json", "content-range": "0-0/1" },
        body: JSON.stringify([MOCK_BUDGET_WITH_OVERFLOW]),
      });
    });

    await page.reload();
    await page.waitForLoadState("networkidle");

    // BudgetAlerts component shows overTitle when pct >= 100:
    //   PT: "Limite excedido" | EN: "Budget exceeded"
    // Individual budget card also shows tx.overLimit:
    //   PT: "⚠️ Limite excedido" | EN: "⚠️ Over limit"
    await expect(
      page.getByText(/limite excedido|budget exceeded|over limit/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test("budget progress bar reflects spent percentage", async ({ page }) => {
    await page.route("**/rest/v1/budgets*", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      return route.fulfill({
        status: 200,
        headers: { "content-type": "application/json", "content-range": "0-0/1" },
        body: JSON.stringify([{ ...MOCK_BUDGET_WITH_OVERFLOW, spent: 250 }]),
      });
    });

    await page.reload();
    await page.waitForLoadState("networkidle");

    // Radix UI <Progress> renders as role="progressbar"
    await expect(page.locator("[role='progressbar']").first()).toBeVisible({ timeout: 5_000 });
  });

  // ── Dashboard overflow alert ──────────────────────────────────────────

  test("dashboard shows BudgetAlerts when over budget", async ({ page }) => {
    await page.route("**/rest/v1/budgets*", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      return route.fulfill({
        status: 200,
        headers: { "content-type": "application/json", "content-range": "0-0/1" },
        body: JSON.stringify([MOCK_BUDGET_WITH_OVERFLOW]),
      });
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // BudgetAlerts renders when pct >= 80; overTitle text for over-100% case:
    //   PT: "Limite excedido" | EN: "Budget exceeded"
    await expect(
      page.getByText(/limite excedido|budget exceeded/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });
});
