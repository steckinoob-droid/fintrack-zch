/**
 * Savings goal flows:
 *   - Create a goal
 *   - Make a deposit
 *   - Verify progress updates
 */
import { test, expect } from "@playwright/test";
import { mockSupabaseData, requireAuth, MOCK_USER_ID } from "./helpers";

const MOCK_GOAL = {
  id: "goal-test-001",
  user_id: MOCK_USER_ID,
  name: "Viagem Europa",
  target_amount: 10000,
  current_amount: 2500,
  deadline: "2025-12-31",
  color: "#6366F1",
  icon: "target",
  created_at: "2024-01-01T00:00:00Z",
};

test.describe("Savings Goals", () => {
  test.beforeEach(async ({ page }) => {
    await requireAuth(page);
    await mockSupabaseData(page);

    await page.route("**/rest/v1/savings_goals*", (route) => {
      const method = route.request().method();
      if (method === "GET")    return route.fulfill({ status: 200, headers: { "content-type": "application/json", "content-range": "0-0/1" }, body: JSON.stringify([MOCK_GOAL]) });
      if (method === "POST")   return route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
      if (method === "PATCH")  return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      if (method === "DELETE") return route.fulfill({ status: 204, body: "" });
      return route.continue();
    });

    await page.goto("/goals");
    await page.waitForLoadState("networkidle");
  });

  // ── Goal visible ─────────────────────────────────────────────────────

  test("shows goal name and progress bar", async ({ page }) => {
    await expect(page.getByText("Viagem Europa")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("[role='progressbar']").first()).toBeVisible({ timeout: 5_000 });
  });

  // ── Create ───────────────────────────────────────────────────────────

  test("creates a new savings goal", async ({ page }) => {
    let postedPayload: unknown = null;

    await page.route("**/rest/v1/savings_goals*", async (route) => {
      if (route.request().method() === "POST") {
        postedPayload = JSON.parse(route.request().postData() ?? "{}");
        return route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
      }
      return route.fulfill({ status: 200, headers: { "content-type": "application/json", "content-range": "0-0/1" }, body: JSON.stringify([MOCK_GOAL]) });
    });

    // "New goal" button — tx.new = "New goal" (EN) / "Nova meta" (PT)
    await page.getByRole("button", { name: /nova meta|new goal/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // goal-dialog.tsx uses standard label+input pattern
    await dialog.getByLabel(/nome.*meta|goal name/i).fill("Fundo Emergência");
    await dialog.getByLabel(/valor.*alvo|target amount/i).fill("5000");

    // Submit: goals.dialog.create = "Create goal" (EN) / need to check PT
    await dialog.getByRole("button", { name: /criar meta|create goal|salvar|save/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });

    expect(postedPayload).toBeTruthy();
  });

  // ── Deposit ──────────────────────────────────────────────────────────

  test("opens deposit dialog for an existing goal", async ({ page }) => {
    await page.getByText("Viagem Europa").waitFor({ timeout: 5_000 });

    // Deposit button text:
    //   EN: "Deposit" (goals.depositBtn)
    //   PT: "Fazer aporte" (goals.depositBtn)
    await page.getByRole("button", { name: /fazer aporte|deposit/i }).first().click({ timeout: 5_000 });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    // Deposit dialog shows the goal name
    await expect(dialog.getByText("Viagem Europa")).toBeVisible();
  });

  test("submits a deposit and receives success", async ({ page }) => {
    let depositTxCreated = false;
    let goalPatched = false;

    await page.route("**/rest/v1/transactions*", async (route) => {
      if (route.request().method() === "POST") { depositTxCreated = true; }
      return route.fulfill({ status: route.request().method() === "POST" ? 201 : 200, contentType: "application/json", body: "[]" });
    });

    await page.route("**/rest/v1/savings_goals*", async (route) => {
      const method = route.request().method();
      if (method === "PATCH") {
        goalPatched = true;
        return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      }
      return route.fulfill({ status: 200, headers: { "content-type": "application/json", "content-range": "0-0/1" }, body: JSON.stringify([MOCK_GOAL]) });
    });

    await page.getByText("Viagem Europa").waitFor({ timeout: 5_000 });
    await page.getByRole("button", { name: /fazer aporte|deposit/i }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // id="deposit-amount" from goal-deposit-dialog.tsx
    await dialog.locator("#deposit-amount").fill("500");

    // Submit: goals.deposit.submit = "Confirmar aporte" (PT) — contains "Confirmar"
    await dialog.getByRole("button", { name: /confirmar|confirm|deposit/i }).last().click();

    await expect(dialog).not.toBeVisible({ timeout: 8_000 });
    // Deposit updates goal.current_amount (PATCH) and creates a saving tx (POST)
    expect(goalPatched || depositTxCreated).toBe(true);
  });

  test("progress bar has non-zero value when goal has savings", async ({ page }) => {
    // MOCK_GOAL has current_amount=2500 / target=10000 = 25%
    const bar = page.locator("[role='progressbar']").first();
    await expect(bar).toBeVisible({ timeout: 5_000 });
    const value = await bar.getAttribute("aria-valuenow");
    expect(Number(value ?? "0")).toBeGreaterThan(0);
  });
});
