import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const output = resolve("docs/portfolio");
await mkdir(output, { recursive: true });
await mkdir(resolve("docs/fixtures"), { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  recordVideo: {
    dir: "test-results/video",
    size: { width: 1440, height: 960 },
  },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.goto("http://127.0.0.1:3000/");
await expect(
  page.getByRole("button", { name: "Load sample spools" }),
).toBeVisible();
await page.waitForTimeout(2500);
await page.getByRole("button", { name: "Load sample spools" }).click();
await expect(
  page.getByRole("button", { name: "View Sage workshop PLA" }),
).toBeVisible();
await page.evaluate(() => window.scrollTo(0, 0));
await page.mouse.move(5, 5);
await page.waitForTimeout(3500);
await page.screenshot({
  path: resolve(output, "01-inventory-desktop.png"),
  fullPage: true,
});
const snapshot = await page.evaluate(
  () =>
    new Promise((resolve, reject) => {
      const request = indexedDB.open("printpantry");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const read = db
          .transaction("workspace")
          .objectStore("workspace")
          .get("current");
        read.onsuccess = () => {
          resolve(read.result);
          db.close();
        };
      };
    }),
);
assert.equal(snapshot.spools.length, 3);
const { revision, ...payload } = snapshot;
await writeFile(
  "docs/fixtures/sample-backup.json",
  JSON.stringify(
    {
      appId: "P03",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      payload,
    },
    null,
    2,
  ),
);
await writeFile(
  "docs/fixtures/empty-backup.json",
  JSON.stringify(
    {
      appId: "P03",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      payload: {
        settings: { currency: "USD", schemaVersion: 1 },
        spools: [],
        events: [],
      },
    },
    null,
    2,
  ),
);
await page.getByRole("link", { name: "Job calculator", exact: true }).click();
await page.getByLabel("Required filament (g)", { exact: true }).fill("390");
await page.getByRole("button", { name: "Find suitable spools" }).click();
await expect(
  page.getByText("No single spool has enough yet", { exact: true }),
).toBeVisible();
await page.waitForTimeout(4000);
await page.getByRole("link", { name: "Inventory", exact: true }).click();
await page.getByRole("button", { name: "View Sage workshop PLA" }).click();
await page.getByRole("button", { name: "Weigh spool", exact: true }).click();
await page
  .getByLabel("Gross weight including spool (g)", { exact: true })
  .fill("600");
await expect(
  page.getByText("Replace 350 g with 400 g remaining.", { exact: true }),
).toBeVisible();
await page.waitForTimeout(4000);
await page.screenshot({
  path: resolve(output, "02-weighing-preview.png"),
  fullPage: true,
});
await page
  .getByRole("button", { name: "Save measurement", exact: true })
  .click();
await expect(page.getByTestId("remaining-mass")).toHaveText("400 g");
await page.waitForTimeout(3000);
await page.keyboard.press("Escape");
await page.getByRole("link", { name: "Job calculator", exact: true }).click();
await expect(
  page.getByRole("heading", { name: "1 suitable spool", exact: true }),
).toBeVisible();
await expect(page.getByText("$7.80", { exact: true })).toBeVisible();
await page.waitForTimeout(5000);
await page.screenshot({
  path: resolve(output, "03-calculator-result.png"),
  fullPage: true,
});
await page
  .getByRole("link", { name: "Settings & backup", exact: true })
  .click();
await page.waitForTimeout(3000);
await page.screenshot({
  path: resolve(output, "04-settings-backup.png"),
  fullPage: true,
});
const download = page.waitForEvent("download");
await page.getByRole("button", { name: "Export backup", exact: true }).click();
await download;
await page.waitForTimeout(3500);
await page.getByRole("link", { name: "Inventory", exact: true }).click();
await page.waitForTimeout(2500);
const video = page.video();
await page.close();
await context.close();
await video.saveAs(resolve(output, "walkthrough.webm"));
const mobile = await browser.newContext({
  viewport: { width: 360, height: 800 },
  deviceScaleFactor: 1,
});
const phone = await mobile.newPage();
await phone.goto("http://127.0.0.1:3000/");
await phone.getByRole("button", { name: "Load sample spools" }).click();
await expect(
  phone.getByRole("button", { name: "View Sage workshop PLA" }),
).toBeVisible();
await phone.evaluate(() => window.scrollTo(0, 0));
await phone.screenshot({
  path: resolve(output, "05-inventory-mobile.png"),
  fullPage: true,
});
assert(
  await phone.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  ),
);
assert.deepEqual(errors, []);
await writeFile(
  resolve(output, "capture.json"),
  JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      browser: browser.version(),
      desktop: "1440 × 960",
      phone: "360 × 800",
      fixture: "Synthetic sample spools",
      pageErrors: errors,
    },
    null,
    2,
  ),
);
await mobile.close();
await browser.close();
console.log(
  "Five screenshots, sample/reset fixtures, and the recorded walkthrough are ready in docs/portfolio.",
);
