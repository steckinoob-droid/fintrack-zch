import { test as setup, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const AUTH_FILE = path.join(__dirname, "../.auth/user.json");
const EMPTY_STATE = JSON.stringify({ cookies: [], origins: [] });

setup("authenticate", async ({ page }) => {
  const email    = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;

  if (!email || !password) {
    console.warn(
      "\n⚠  TEST_EMAIL / TEST_PASSWORD not set.\n" +
      "   All E2E tests will be skipped.\n" +
      "   Copy .env.playwright.example → .env.playwright and fill in credentials.\n"
    );
    fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
    fs.writeFileSync(AUTH_FILE, EMPTY_STATE);
    return;
  }

  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/senha|password/i).fill(password);
  await page.getByRole("button", { name: /entrar|login|sign in/i }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  await page.context().storageState({ path: AUTH_FILE });
  console.log("✓ Auth state saved to", AUTH_FILE);
});
