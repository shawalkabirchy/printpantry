import { test, expect } from "@playwright/test";
import {
  backup,
  createSpool,
  emptyWorkspace,
  type Workspace,
} from "../../src/lib/domain";

test("maximum supported inventory settles within 200ms", async ({
  page,
  browser,
}, info) => {
  const fixture: Workspace = emptyWorkspace();
  for (let index = 0; index < 200; index++) {
    const created = createSpool(emptyWorkspace(), {
      label: `Reference spool ${index + 1}`,
      brand: "Synthetic fixture",
      material: "PLA",
      colorName: "Green",
      nominalMassMilliGrams: 1_000_000,
      tareMassMilliGrams: 200_000,
      purchaseCostMinor: 2000,
      initialRemaining: 1_000_000,
    });
    const spool = created.spools[0];
    fixture.spools.push(spool);
    fixture.events.push(created.events[0]);
    for (let sequence = 2; sequence <= 25; sequence++)
      fixture.events.push({
        id: crypto.randomUUID(),
        spoolId: spool.id,
        kind: "consumption",
        quantityMilliGrams: 10_000,
        note: "Synthetic performance fixture",
        createdAt: spool.createdAt,
        sequence,
      });
  }
  await page.goto("/settings/");
  await page.getByLabel("Import backup", { exact: true }).setInputFiles({
    name: "max-supported.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup(fixture)),
  });
  await page.getByRole("button", { name: "Review replacement" }).click();
  await page
    .getByRole("button", { name: "Replace current workspace", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Job calculator", exact: true }).click();
  await page.getByLabel("Required filament (g)", { exact: true }).fill("390");
  await page.evaluate(() => {
    const reference = window as unknown as {
      pantryTiming: { start: number; duration: number };
    };
    reference.pantryTiming = { start: 0, duration: 0 };
    document.querySelector("form")!.addEventListener(
      "submit",
      () => {
        reference.pantryTiming.start = performance.now();
      },
      { capture: true, once: true },
    );
    const observer = new MutationObserver(() => {
      if (
        document.getElementById("results-heading")?.textContent ===
        "200 suitable spools"
      ) {
        observer.disconnect();
        requestAnimationFrame(() => {
          reference.pantryTiming.duration =
            performance.now() - reference.pantryTiming.start;
        });
      }
    });
    observer.observe(document.getElementById("main")!, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });
  await page.getByRole("button", { name: "Find suitable spools" }).click();
  await expect(
    page.getByRole("heading", { name: "200 suitable spools", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { pantryTiming: { duration: number } })
            .pantryTiming.duration,
      ),
    )
    .toBeGreaterThan(0);
  const duration = await page.evaluate(
    () =>
      (window as unknown as { pantryTiming: { duration: number } }).pantryTiming
        .duration,
  );
  const result = {
    browser: info.project.name,
    version: browser.version(),
    spools: 200,
    events: 5000,
    submitToResultsFrameMs: duration,
  };
  console.log(JSON.stringify(result));
  await info.attach("maximum-inventory-timing", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  expect(duration).toBeLessThan(200);
  await expect(
    page.getByText("Showing 20 of 200 suitable spools.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show next 20", exact: true }).click();
  await expect(
    page.getByText("Showing 40 of 200 suitable spools.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Inventory", exact: true }).click();
  await page
    .getByRole("button", { name: "View Reference spool 1", exact: true })
    .click();
  await expect(
    page.getByText("Showing 20 of 25 ledger entries.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Show older 20", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Measurement ledger" }).getByRole("listitem"),
  ).toHaveCount(25);
});
