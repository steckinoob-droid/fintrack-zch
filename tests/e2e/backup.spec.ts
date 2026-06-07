/**
 * Backup flows:
 *   - Export backup JSON (download triggered)
 *   - Import backup JSON (preview + confirm)
 *   - Rejects invalid / oversized / too-many-records files
 *   - Preserves recurrence_parent_id when parent is in the same backup
 */
import { test, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { mockSupabaseData, requireAuth, MOCK_CATEGORIES, MOCK_TRANSACTIONS, MOCK_GOALS } from "./helpers";

const SAMPLE_BACKUP = {
  exported_at: "2024-06-01T00:00:00.000Z",
  profile: { name: "Test User", currency: "BRL" },
  categories: MOCK_CATEGORIES,
  transactions: MOCK_TRANSACTIONS,
  goals: MOCK_GOALS,
  budgets: [],
};

test.describe("Backup", () => {
  test.beforeEach(async ({ page }) => {
    await requireAuth(page);
    await mockSupabaseData(page);
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
  });

  // ── Export ───────────────────────────────────────────────────────────

  test("triggers a JSON download on Export", async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 10_000 }),
      page.getByRole("button", { name: /exportar|export/i }).first().click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.json$/i);
  });

  // ── Import ───────────────────────────────────────────────────────────

  test("shows preview before importing backup JSON", async ({ page }) => {
    const tmpFile = path.join(os.tmpdir(), "backup-test.json");
    fs.writeFileSync(tmpFile, JSON.stringify(SAMPLE_BACKUP));

    await page.getByRole("button", { name: /importar|import/i }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const fileInput = dialog.locator("input[type='file']");
    await fileInput.setInputFiles(tmpFile);

    // Preview step should list entity counts
    await expect(dialog.getByText(/transaç|transaction/i)).toBeVisible({ timeout: 8_000 });
    await expect(dialog.getByText(/catego/i)).toBeVisible();

    fs.unlinkSync(tmpFile);
  });

  test("confirms import and shows success state", async ({ page }) => {
    const tmpFile = path.join(os.tmpdir(), "backup-test-confirm.json");
    fs.writeFileSync(tmpFile, JSON.stringify(SAMPLE_BACKUP));

    await page.getByRole("button", { name: /importar|import/i }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    await dialog.locator("input[type='file']").setInputFiles(tmpFile);
    await expect(dialog.getByText(/transaç|transaction/i)).toBeVisible({ timeout: 8_000 });

    // Click confirm / import button
    await dialog.getByRole("button", { name: /confirmar|importar|import/i }).last().click();

    // Should show success message or close the dialog
    await expect(
      dialog.getByText(/sucesso|success|concluído/i).or(dialog)
    ).toBeVisible({ timeout: 15_000 });

    fs.unlinkSync(tmpFile);
  });

  test("rejects an invalid backup file", async ({ page }) => {
    const tmpFile = path.join(os.tmpdir(), "bad-backup.json");
    fs.writeFileSync(tmpFile, JSON.stringify({ invalid: true }));

    await page.getByRole("button", { name: /importar|import/i }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    await dialog.locator("input[type='file']").setInputFiles(tmpFile);

    // Should show error about invalid/corrupt format
    await expect(
      page.getByRole("alert").or(dialog.getByText(/inválido|invalid|corrompido|corrupt/i))
    ).toBeVisible({ timeout: 8_000 });

    fs.unlinkSync(tmpFile);
  });

  // ── Safety limits ────────────────────────────────────────────────────

  test("rejects backup with more than 50,000 transactions", async ({ page }) => {
    // 50,001 minimal objects — each has a string id, so shape validation passes;
    // the count check (> 50 000) fires before any DB call.
    const manyTx = Array.from({ length: 50_001 }, (_, i) => ({ id: `tx-bulk-${i}` }));
    const tmpFile = path.join(os.tmpdir(), "huge-backup.json");
    fs.writeFileSync(tmpFile, JSON.stringify({
      transactions: manyTx, categories: [], goals: [], budgets: [],
    }));

    try {
      await page.getByRole("button", { name: /importar|import/i }).first().click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 5_000 });

      await dialog.locator("input[type='file']").setInputFiles(tmpFile);

      // Error: importTooMany — "50,000" or "50.000" (PT) or "demais" (PT) or "too many" (EN)
      await expect(
        dialog.getByText(/50[.,]000|demais|too many/i)
      ).toBeVisible({ timeout: 8_000 });
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test("rejects a file larger than 10 MB", async ({ page }) => {
    // 11 MB of raw bytes — the size check fires before JSON.parse so content
    // doesn't matter; the file never needs to be a valid JSON document.
    const tmpFile = path.join(os.tmpdir(), "oversize-backup.bin");
    fs.writeFileSync(tmpFile, Buffer.alloc(11 * 1024 * 1024, 48)); // ASCII '0'

    try {
      await page.getByRole("button", { name: /importar|import/i }).first().click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 5_000 });

      await dialog.locator("input[type='file']").setInputFiles(tmpFile);

      // Error: importTooLarge — "10 MB" or "10 mb" or "grande|large" keyword
      await expect(
        dialog.getByText(/10 ?MB|grande|large|too large/i)
      ).toBeVisible({ timeout: 8_000 });
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  // ── Recurrence link preservation ─────────────────────────────────────

  test("preserves recurrence_parent_id when parent is in the same backup", async ({ page }) => {
    const PARENT_TX = {
      id: "tx-parent-rec-001",
      user_id: "test-user",
      category_id: MOCK_CATEGORIES[0].id,
      goal_id: null,
      title: "Aluguel Mensal",
      amount: 1200,
      type: "expense",
      date: "2024-06-01",
      notes: null,
      is_recurring: true,
      recurrence_interval: "monthly",
      recurrence_parent_id: null,
      created_at: "2024-06-01T00:00:00Z",
    };
    const CHILD_TX = {
      ...PARENT_TX,
      id: "tx-child-rec-001",
      is_recurring: false,
      recurrence_interval: null,
      recurrence_parent_id: "tx-parent-rec-001",
      date: "2024-07-01",
      created_at: "2024-07-01T00:00:00Z",
    };

    const backup = {
      exported_at: "2024-07-15T00:00:00Z",
      categories: MOCK_CATEGORIES,
      transactions: [PARENT_TX, CHILD_TX],
      goals: [],
      budgets: [],
    };

    // Collect all POST payloads to transactions
    const postedRows: Record<string, unknown>[] = [];
    await page.route("**/rest/v1/transactions*", async (route) => {
      if (route.request().method() === "POST") {
        const body = JSON.parse(route.request().postData() ?? "[]");
        const rows = Array.isArray(body) ? body : [body];
        postedRows.push(...rows);
        return route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
      }
      // GET — return existing (does NOT include PARENT/CHILD so they're treated as new)
      return route.fulfill({
        status: 200,
        headers: { "content-type": "application/json", "content-range": "0-1/2" },
        body: JSON.stringify(MOCK_TRANSACTIONS),
      });
    });

    const tmpFile = path.join(os.tmpdir(), "backup-recurrence.json");
    fs.writeFileSync(tmpFile, JSON.stringify(backup));

    try {
      await page.getByRole("button", { name: /importar|import/i }).first().click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 5_000 });

      await dialog.locator("input[type='file']").setInputFiles(tmpFile);
      await expect(dialog.getByText(/transaç|transaction/i)).toBeVisible({ timeout: 8_000 });

      await dialog.getByRole("button", { name: /confirmar|importar|import/i }).last().click();
      await expect(dialog.getByText(/sucesso|success|concluído/i)).toBeVisible({ timeout: 15_000 });

      // The child tx must have its recurrence_parent_id preserved (not nulled)
      const childRow = postedRows.find(r => r["id"] === "tx-child-rec-001");
      expect(childRow, "child tx was not posted").toBeTruthy();
      expect(childRow!["recurrence_parent_id"]).toBe("tx-parent-rec-001");

      // Parent must be posted before child so the FK constraint holds
      const parentIdx = postedRows.findIndex(r => r["id"] === "tx-parent-rec-001");
      const childIdx  = postedRows.findIndex(r => r["id"] === "tx-child-rec-001");
      expect(parentIdx).toBeLessThan(childIdx);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});
