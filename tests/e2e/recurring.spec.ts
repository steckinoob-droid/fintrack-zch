/**
 * Recurring transaction flows:
 *   - Create a monthly recurring transaction
 *   - Verify it appears in the recurring manager
 */
import { test, expect } from "@playwright/test";
import { mockSupabaseData, requireAuth, MOCK_USER_ID, MOCK_CATEGORIES } from "./helpers";

const MOCK_RECURRING_TX = {
  id: "tx-rec-001",
  user_id: MOCK_USER_ID,
  category_id: "cat-expense-01",
  goal_id: null,
  title: "Aluguel",
  amount: 1200,
  type: "expense",
  date: "2024-06-01",
  notes: null,
  is_recurring: true,
  recurrence_interval: "monthly",
  recurrence_parent_id: null,
  created_at: "2024-06-01T10:00:00Z",
  category: MOCK_CATEGORIES[1],
};

const MOCK_OCCURRENCES = [
  { ...MOCK_RECURRING_TX, id: "tx-rec-002", date: "2024-07-01", recurrence_parent_id: "tx-rec-001" },
  { ...MOCK_RECURRING_TX, id: "tx-rec-003", date: "2024-08-01", recurrence_parent_id: "tx-rec-001" },
];

test.describe("Recurring Transactions", () => {
  test.beforeEach(async ({ page }) => {
    await requireAuth(page);
    await mockSupabaseData(page);

    const allTx = [MOCK_RECURRING_TX, ...MOCK_OCCURRENCES];
    await page.route("**/rest/v1/transactions*", (route) => {
      const method = route.request().method();
      if (method === "GET")    return route.fulfill({ status: 200, headers: { "content-type": "application/json", "content-range": `0-${allTx.length - 1}/${allTx.length}` }, body: JSON.stringify(allTx) });
      if (method === "POST")   return route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
      if (method === "PATCH")  return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      if (method === "DELETE") return route.fulfill({ status: 204, body: "" });
      return route.continue();
    });

    await page.goto("/transactions");
    await page.waitForLoadState("networkidle");
  });

  // ── Create recurring ─────────────────────────────────────────────────

  test("creates a monthly recurring transaction via the dialog", async ({ page }) => {
    await page.getByRole("button", { name: /nova|add|new/i }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("tab", { name: /despesa|expense/i }).click();
    await dialog.locator("#tx-title").fill("Aluguel");
    await dialog.locator("#tx-amount").fill("1200");
    await dialog.locator("#tx-date").fill("2024-06-01");

    // Recurring toggle: <button type="button"> containing recurring label text.
    // tx.recurring (dialog) = "Transação recorrente" (PT) / "Recurring transaction" (EN)
    const recurringToggle = dialog.locator("button[type='button']", {
      hasText: /transação recorrente|recurring transaction/i,
    });
    await expect(recurringToggle).toBeVisible({ timeout: 3_000 });
    await recurringToggle.click();

    // After enabling, frequency Select appears; default is "monthly"
    await expect(dialog.getByRole("combobox")).toBeVisible({ timeout: 3_000 });

    await dialog.getByRole("button", { name: /adicionar|salvar|add$|save$/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
  });

  // ── Recurring manager ─────────────────────────────────────────────────

  test("opens recurring manager and shows recurring transactions", async ({ page }) => {
    // Recurring manager button — transactions.recurring = "Recorrente" (PT) / "Recurring" (EN)
    await page.getByRole("button", { name: /recorrente|recurring/i }).click({ timeout: 5_000 });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // The recurring parent "Aluguel" should be listed
    await expect(dialog.getByText("Aluguel")).toBeVisible({ timeout: 5_000 });
  });

  // ── Recurring badge ───────────────────────────────────────────────────

  test("recurring transaction appears in the transaction list", async ({ page }) => {
    // The mocked list includes MOCK_RECURRING_TX with is_recurring: true
    await expect(page.getByText("Aluguel")).toBeVisible({ timeout: 5_000 });
  });
});
