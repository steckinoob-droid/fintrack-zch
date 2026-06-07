/**
 * Transaction flows:
 *   - Create (income + expense)
 *   - Edit
 *   - Delete with Undo
 *   - Import CSV
 */
import { test, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { mockSupabaseData, requireAuth, MOCK_TRANSACTIONS } from "./helpers";

test.describe("Transactions", () => {
  test.beforeEach(async ({ page }) => {
    await requireAuth(page);
    await mockSupabaseData(page);
    await page.goto("/transactions");
    await page.waitForLoadState("networkidle");
  });

  // ── Create ──────────────────────────────────────────────────────────────

  test("opens New Transaction dialog", async ({ page }) => {
    await page.getByRole("button", { name: /nova|add|new/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("creates an expense transaction", async ({ page }) => {
    let postedPayload: unknown = null;

    await page.route("**/rest/v1/transactions*", async (route) => {
      if (route.request().method() === "POST") {
        postedPayload = JSON.parse(route.request().postData() ?? "{}");
        return route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
      }
      return route.fulfill({
        status: 200,
        headers: { "content-type": "application/json", "content-range": `0-1/2` },
        body: JSON.stringify(MOCK_TRANSACTIONS),
      });
    });

    await page.getByRole("button", { name: /nova|add|new/i }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Select "Expense" tab — TabsTrigger renders as role="tab"
    await dialog.getByRole("tab", { name: /despesa|expense/i }).click();

    // Actual input IDs from transaction-dialog.tsx
    await dialog.locator("#tx-title").fill("Teste Supermercado");
    await dialog.locator("#tx-amount").fill("150");
    await dialog.locator("#tx-date").fill("2024-06-10");

    // Submit button text for new transaction = common.add = "Adicionar" (PT) / "Add" (EN)
    await dialog.getByRole("button", { name: /adicionar|salvar|add$|save$/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });

    expect(postedPayload).toBeTruthy();
  });

  test("creates an income transaction", async ({ page }) => {
    await page.getByRole("button", { name: /nova|add|new/i }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("tab", { name: /receita|income/i }).click();
    await dialog.locator("#tx-title").fill("Freelance");
    await dialog.locator("#tx-amount").fill("1200");
    await dialog.locator("#tx-date").fill("2024-06-12");

    await dialog.getByRole("button", { name: /adicionar|salvar|add$|save$/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
  });

  // ── Edit ────────────────────────────────────────────────────────────────

  test("edits an existing transaction", async ({ page }) => {
    let patchCalled = false;
    await page.route("**/rest/v1/transactions*", async (route) => {
      const method = route.request().method();
      if (method === "PATCH") { patchCalled = true; }
      return route.fulfill({
        status: method === "PATCH" ? 200 : 200,
        contentType: "application/json",
        body: JSON.stringify(method === "PATCH" ? {} : MOCK_TRANSACTIONS),
      });
    });

    // Find the first transaction's edit button (rows or card items)
    const editBtn = page.getByRole("button", { name: /editar|edit/i }).first();
    await editBtn.click({ timeout: 5_000 }).catch(async () => {
      // Some UIs use a kebab menu
      await page.locator("button[aria-label*='menu' i], button[aria-label*='opções' i]").first().click();
      await page.getByRole("menuitem", { name: /editar|edit/i }).click();
    });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.locator("#tx-amount").clear();
    await dialog.locator("#tx-amount").fill("5500");

    // Edit button text = common.save = "Salvar" (PT) / "Save" (EN)
    await dialog.getByRole("button", { name: /salvar|save/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
    expect(patchCalled).toBe(true);
  });

  // ── Delete with Undo ──────────────────────────────────────────────────

  test("deletes a transaction and undoes it", async ({ page }) => {
    let deleteCount = 0;
    let insertAfterUndo = false;

    await page.route("**/rest/v1/transactions*", async (route) => {
      const method = route.request().method();
      if (method === "DELETE") {
        deleteCount++;
        return route.fulfill({ status: 204, body: "" });
      }
      if (method === "POST") {
        insertAfterUndo = true;
        return route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
      }
      return route.fulfill({
        status: 200,
        headers: { "content-type": "application/json", "content-range": "0-1/2" },
        body: JSON.stringify(MOCK_TRANSACTIONS),
      });
    });

    // Click delete on the first transaction
    const deleteBtn = page.getByRole("button", { name: /excluir|delete|remover/i }).first();
    await deleteBtn.click({ timeout: 5_000 }).catch(async () => {
      await page.locator("button[aria-label*='menu' i], button[aria-label*='opções' i]").first().click();
      await page.getByRole("menuitem", { name: /excluir|delete/i }).click();
    });

    // Undo toast must appear
    const undoBtn = page.getByRole("button", { name: /desfazer|undo/i });
    await expect(undoBtn).toBeVisible({ timeout: 5_000 });
    expect(deleteCount).toBe(1);

    await undoBtn.click();
    await expect(undoBtn).not.toBeVisible({ timeout: 5_000 });
    expect(insertAfterUndo).toBe(true);
  });

  // ── Import CSV ────────────────────────────────────────────────────────

  test("opens CSV import and previews transactions", async ({ page }) => {
    const csv = "date,title,amount,type\n2024-06-20,Teste Import,100,expense\n2024-06-21,Outro Import,50,expense";
    const tmpFile = path.join(os.tmpdir(), "test-import.csv");
    fs.writeFileSync(tmpFile, csv);

    try {
      // Open import dialog — may be a button labelled "Importar" or an icon button
      await page.getByRole("button", { name: /importar|import/i }).first().click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 5_000 });

      // Upload CSV file
      await dialog.locator("input[type='file']").setInputFiles(tmpFile);

      // Preview step — should show transaction rows or a count
      await expect(
        dialog.getByRole("table").or(dialog.getByText(/transaç|transaction|linha|row/i))
      ).toBeVisible({ timeout: 8_000 });
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  // ── Recurring ─────────────────────────────────────────────────────────

  test("enables recurring toggle in new transaction dialog", async ({ page }) => {
    await page.getByRole("button", { name: /nova|add|new/i }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Recurring toggle is a <button type="button"> containing the recurring label text
    // (tx.recurring = "Transação recorrente" PT / "Recurring transaction" EN)
    const recurringBtn = dialog.locator("button[type='button']", {
      hasText: /transação recorrente|recurring transaction/i,
    });
    await expect(recurringBtn).toBeVisible({ timeout: 5_000 });
    await recurringBtn.click();

    // After enabling, a frequency Select should appear
    await expect(dialog.getByRole("combobox")).toBeVisible({ timeout: 3_000 });
  });
});
