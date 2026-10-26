import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { backup, emptyWorkspace, type Workspace } from "../../src/lib/domain";

async function open(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Load sample spools" }),
  ).toBeVisible();
}
async function samples(page: Page) {
  await open(page);
  await page.getByRole("button", { name: "Load sample spools" }).click();
  await expect(
    page.getByRole("button", { name: "View Sage workshop PLA" }),
  ).toBeVisible();
}
async function fillSpool(page: Page, label = "Workflow spool") {
  await page.getByRole("button", { name: "Add spool", exact: true }).click();
  await page.getByLabel("Spool name", { exact: true }).fill(label);
  await page.getByLabel("Brand", { exact: true }).fill("Workshop brand");
  await page.getByLabel("Color", { exact: true }).fill("Green");
  await page.getByLabel("Empty spool tare (g)", { exact: true }).fill("200");
  await page.getByLabel(/Purchase cost/).fill("20.00");
}
async function persisted(page: Page): Promise<Workspace> {
  return page.evaluate(
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
          read.onerror = () => {
            reject(read.error);
            db.close();
          };
        };
      }),
  );
}
async function importFile(page: Page, text: string, name = "backup.json") {
  await page
    .getByLabel("Import backup", { exact: true })
    .setInputFiles({
      name,
      mimeType: "application/json",
      buffer: Buffer.from(text),
    });
}

test("create → consume → weigh → reload, archive, restore, and atomic delete", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await open(page);
  await fillSpool(page);
  await page.getByRole("button", { name: "Save spool", exact: true }).click();
  await page.getByRole("button", { name: "View Workflow spool" }).click();
  const sheet = page.getByRole("dialog", {
    name: "Workflow spool",
    exact: true,
  });
  await sheet
    .getByRole("button", { name: "Record consumption", exact: true })
    .click();
  await sheet.getByLabel("Filament consumed (g)", { exact: true }).fill("100");
  await sheet
    .getByRole("button", { name: "Save consumption", exact: true })
    .click();
  await expect(sheet.getByTestId("remaining-mass")).toHaveText("900 g");
  await sheet.getByRole("button", { name: "Weigh spool", exact: true }).click();
  await sheet
    .getByLabel("Gross weight including spool (g)", { exact: true })
    .fill("1050");
  await sheet
    .getByRole("button", { name: "Save measurement", exact: true })
    .click();
  await expect(sheet.getByTestId("remaining-mass")).toHaveText("850 g");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "View Workflow spool" }),
  ).toBeFocused();
  await page.reload();
  await page.getByRole("button", { name: "View Workflow spool" }).click();
  await expect(
    page.getByRole("dialog").getByTestId("remaining-mass"),
  ).toHaveText("850 g");
  await page
    .getByRole("button", { name: "Archive spool", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "View Workflow spool" }),
  ).toHaveCount(0);
  await page.getByLabel("Filter by status").selectOption("archived");
  await page.getByRole("button", { name: "View Workflow spool" }).click();
  await page.getByRole("button", { name: "Restore to active" }).click();
  await page.getByLabel("Filter by status").selectOption("active");
  await page.getByRole("button", { name: "View Workflow spool" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Keep spool", exact: true }).click();
  expect((await persisted(page)).events).toHaveLength(3);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete spool and history", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Load sample spools" }),
  ).toBeVisible();
  expect((await persisted(page)).spools).toHaveLength(0);
  expect((await persisted(page)).events).toHaveLength(0);
  expect(errors).toEqual([]);
});

test("portfolio demo: no match → weigh → match, exact reserve boundary and material cost", async ({
  page,
}) => {
  await samples(page);
  await page.getByRole("link", { name: "Job calculator", exact: true }).click();
  await page.getByLabel("Required filament (g)", { exact: true }).fill("390");
  await page.getByRole("button", { name: "Find suitable spools" }).click();
  await expect(
    page.getByText("No single spool has enough yet", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Inventory", exact: true }).click();
  await page.getByRole("button", { name: "View Sage workshop PLA" }).click();
  await page.getByRole("button", { name: "Weigh spool", exact: true }).click();
  await page
    .getByLabel("Gross weight including spool (g)", { exact: true })
    .fill("150");
  await page.getByRole("button", { name: "Save measurement" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Gross weight must cover",
  );
  await page
    .getByLabel("Gross weight including spool (g)", { exact: true })
    .fill("600");
  await page.getByRole("button", { name: "Save measurement" }).click();
  await expect(
    page.getByRole("dialog").getByTestId("remaining-mass"),
  ).toHaveText("400 g");
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Job calculator", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "1 suitable spool", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("$7.80", { exact: true })).toBeVisible();
  await page.getByLabel("Required filament (g)", { exact: true }).fill("391");
  await expect(
    page.getByRole("heading", { name: "0 suitable spools", exact: true }),
  ).toBeVisible();
});

test("backup validation, preview cancellation, atomic replacement, and currency lock", async ({
  page,
}) => {
  await samples(page);
  const before = await persisted(page);
  await page
    .getByRole("link", { name: "Settings & backup", exact: true })
    .click();
  await expect(page.getByLabel("Currency", { exact: true })).toBeDisabled();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/printpantry-backup/);
  await importFile(page, '{"appId":"P01"}');
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "IMPORT_INVALID",
  );
  expect((await persisted(page)).revision).toBe(before.revision);
  await importFile(page, backup(emptyWorkspace()));
  await expect(
    page.getByText("Backup ready to review", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review replacement" }).click();
  await page.getByRole("button", { name: "Keep current workspace" }).click();
  expect((await persisted(page)).revision).toBe(before.revision);
  await page.getByRole("button", { name: "Review replacement" }).click();
  await page
    .getByRole("button", { name: "Replace current workspace", exact: true })
    .click();
  await expect(
    page.getByText("Backup ready to review", { exact: true }),
  ).toHaveCount(0);
  expect((await persisted(page)).spools).toEqual([]);
  expect((await persisted(page)).events).toEqual([]);
  await page.getByLabel("Currency", { exact: true }).selectOption("BDT");
  await expect
    .poll(async () => (await persisted(page)).settings.currency)
    .toBe("BDT");
  await page.reload();
  await expect(page.getByLabel("Currency", { exact: true })).toHaveValue("BDT");
});

test("stale tabs reject writes and stale import confirmations without losing committed records", async ({
  page,
  context,
}) => {
  test.slow();
  await open(page);
  const second = await context.newPage();
  await open(second);
  await fillSpool(second, "Stale draft");
  await page.bringToFront();
  await page.getByRole("button", { name: "Load sample spools" }).click();
  await expect(
    page.getByRole("button", { name: "View Sage workshop PLA" }),
  ).toBeVisible();
  await second.bringToFront();
  await second.getByRole("button", { name: "Save spool", exact: true }).click();
  await expect(second.getByRole("dialog").getByRole("alert")).toContainText(
    "Another tab changed",
  );
  expect((await persisted(page)).spools).toHaveLength(3);
  await second
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await second.getByRole("button", { name: "Reload (discard drafts)" }).click();
  await second
    .getByRole("link", { name: "Settings & backup", exact: true })
    .click();
  await importFile(second, backup(emptyWorkspace()));
  await page.bringToFront();
  await page.getByRole("button", { name: "View Sage workshop PLA" }).click();
  await page
    .getByRole("button", { name: "Archive spool", exact: true })
    .click();
  await second.bringToFront();
  await second.getByRole("button", { name: "Review replacement" }).click();
  await second
    .getByRole("button", { name: "Replace current workspace", exact: true })
    .click();
  await expect(
    second.getByRole("alertdialog").getByRole("alert"),
  ).toContainText("Another tab changed");
  expect((await persisted(page)).spools).toHaveLength(3);
});

test("quota failure preserves the draft and committed state and exports pending recovery", async ({
  page,
}) => {
  await samples(page);
  const before = await persisted(page);
  await fillSpool(page, "Unsaved quota spool");
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Save spool", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "storage is full",
  );
  await expect(page.getByLabel("Spool name", { exact: true })).toHaveValue(
    "Unsaved quota spool",
  );
  expect(await persisted(page)).toEqual(before);
  const draftDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Copy unsaved entry" }).click();
  expect((await draftDownload).suggestedFilename()).toContain("unsaved-entry");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "STORAGE_FULL",
  );
  const recoveryDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export unsaved recovery copy" })
    .click();
  expect((await recoveryDownload).suggestedFilename()).toContain(
    "recovery-unsaved",
  );
});

test("a transaction abort rolls back spool and initial event together", async ({
  page,
}) => {
  await samples(page);
  const before = await persisted(page);
  await fillSpool(page, "Aborted write");
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      const request = original.apply(this, args);
      this.transaction.abort();
      return request;
    };
  });
  await page.getByRole("button", { name: "Save spool", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "storage is unavailable",
  );
  expect(await persisted(page)).toEqual(before);
});

test("blocked storage is explicit and does not silently claim a save", async ({
  page,
}) => {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
  });
  await open(page);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "STORAGE_UNAVAILABLE",
  );
  await fillSpool(page, "Storage blocked draft");
  await page.getByRole("button", { name: "Save spool", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "storage is unavailable",
  );
  await expect(page.getByLabel("Spool name", { exact: true })).toHaveValue(
    "Storage blocked draft",
  );
});

test("future database versions remain intact instead of being reset", async ({
  page,
}) => {
  await samples(page);
  const before = await persisted(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("printpantry", 2);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          request.result.close();
          resolve();
        };
      }),
  );
  await page.reload();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "STORAGE_UNAVAILABLE",
  );
  expect(await persisted(page)).toEqual(before);
});

test("360px layout, keyboard focus, filters, and automated accessibility", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await samples(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Filter by material").selectOption("PETG");
  await expect(
    page.getByRole("button", { name: "View Sage workshop PLA" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "View Terracotta PETG" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View Terracotta PETG" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "View Terracotta PETG" }),
  ).toBeFocused();
  await expect(page).toHaveTitle(/PrintPantry/);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("link", { name: "Job calculator", exact: true }).click();
  await expect(page).toHaveURL(/\/calculator\/$/);
  await expect(
    page.getByRole("heading", { name: "A confident next print" }),
  ).toBeVisible();
  await expect(page).toHaveTitle(/PrintPantry/);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page
    .getByRole("link", { name: "Settings & backup", exact: true })
    .click();
  await expect(page).toHaveURL(/\/settings\/$/);
  await expect(
    page.getByRole("heading", { name: "A home for your records" }),
  ).toBeVisible();
  await expect(page).toHaveTitle(/PrintPantry/);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("private inputs and imported filenames never leave the browser; oversized imports fail before parsing", async ({
  page,
}) => {
  const requests: string[] = [];
  const methods: string[] = [];
  const bodies: (string | null)[] = [];
  page.on("request", (request) => {
    requests.push(request.url() + (request.postData() ?? ""));
    methods.push(request.method());
    bodies.push(request.postData());
  });
  await samples(page);
  await fillSpool(page, "PRIVATE_SENTINEL_815");
  await page.getByRole("button", { name: "Save spool", exact: true }).click();
  await page
    .getByRole("link", { name: "Settings & backup", exact: true })
    .click();
  await importFile(page, backup(emptyWorkspace()), "PRIVATE_FILENAME_815.json");
  await page.getByRole("button", { name: "Cancel import" }).click();
  await importFile(page, " ".repeat(10 * 1024 * 1024 + 1));
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "FILE_TOO_LARGE",
  );
  expect((await persisted(page)).spools).toHaveLength(4);
  expect(requests.join("\n")).not.toMatch(
    /PRIVATE_SENTINEL_815|PRIVATE_FILENAME_815/,
  );
  expect(
    requests.every((url) => url.startsWith("http://127.0.0.1:3000/")),
  ).toBe(true);
  expect(requests.length).toBeGreaterThan(0);
  expect(methods.every((method) => method === "GET" || method === "HEAD")).toBe(
    true,
  );
  expect(bodies.every((body) => body === null)).toBe(true);
});
