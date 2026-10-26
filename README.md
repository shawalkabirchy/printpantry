# PrintPantry

A little order for your next print. Track filament spools, update estimates by weighing, record consumption, and find one spool that can cover a planned job with a reserve.

**Self-initiated studio project by [ConsoleLog Studio](https://consolelog.studio/).** Sample records are synthetic. No business savings, client relationships, or market-validation claims are implied.

## Run locally

Use Node **24.14.0** (the tested runtime) and npm **11.14.1**.

```sh
npm ci
npm run dev
```

For the production export:

```sh
npm run build
npm run start
```

Open **http://127.0.0.1:3000/**. `start` serves the exported `out/` directory on loopback only. It is a local preview server; Cloudflare serves the deployed files. Development runs Next.js locally; the shipped application has no runtime server.

Next.js 16.4.3, React 19.3.1, TypeScript 7.0.2, Tailwind CSS 4.3.3, idb 8.0.4, Zod 4.6.7, Vitest 5.0.5, and Playwright 1.64.1 are pinned in the package files. The official shadcn/ui Radix components are included as source. We use the documented `--webpack` option because Turbopack’s compilation worker exited before connecting in this Windows environment.

## Use the app

1. Open **Settings & backup** to select USD or BDT before creating spools. Currency stays locked while financial records exist, including archived spools.
2. Add a spool with label, brand, material, color, nominal filament mass, empty-spool tare, acquisition cost, and initial remaining mass. Blank initial remaining means a full spool.
3. Open its details to consume filament or weigh it. Enter gross weight including the empty spool. Preview and save the replacement estimate.
4. Use **Job calculator** with required grams and a reserve (10 g initially). Candidates exclude archived spools and sort by least surplus. Costs cover the required filament only.
5. Export a JSON backup regularly.

Mass uses grams with at most three decimal places and a 50,000 g input ceiling. Money accepts at most two decimal places and 1,000,000,000 minor units per entered amount. Limits: 200 spools, 5,000 events, and a 10 MiB UTF-8 backup. Changes that would make a complete backup exceed that size cannot save.

The ledger is append-only. Measurements replace the estimate; consumption subtracts from it. Correct an incorrect weighing with a new weighing. Nominal mass, tare, and acquisition cost are fixed; use a replacement spool to correct those baseline facts. Archive preserves history. Confirmed deletion removes the spool and its entire ledger together.

## Storage and recovery

Inventory stays in IndexedDB under the current browser profile and origin. There is no login, cloud sync, upload API, analytics, or session replay. Fonts and assets require no third-party runtime service. This is not an installed offline/PWA application; initial page loading still requires the app’s static assets.

Every write checks the workspace revision and commits one complete snapshot atomically. A stale tab rejects its save with `STALE_LOCAL_STATE`. Copy the open form’s unsaved entry before using **Reload (discard drafts)**, then re-enter it against the current state. Copying downloads a clearly labeled text file rather than requiring clipboard permission.

Blocked/full storage shows **Not saved**, retains the form, and offers an unsaved recovery backup when a valid proposed workspace is available. A recovery file contains the loaded snapshot plus the proposed edit; it is not proof that the edit committed. If existing storage could not be read, it cannot contain those inaccessible records. Download the form draft too, and inspect the recovery file before replacing any other workspace.

Unknown database/schema versions are preserved and reported as unavailable; the app never clears a database to repair it. Browser eviction, site-data clearing, switching profiles, and changing origin can remove access to local records. A downloaded backup is the recovery mechanism.

### Restore or reset safely

- Export the current workspace first.
- Import a PrintPantry v1 JSON file through Settings. Validation checks IDs, references, bounds, sequence invariants, and replayed balances before showing a preview.
- **Review replacement** opens the final confirmation. Import replaces the whole workspace; it does not merge. Cancelling changes nothing. Another tab writing after preview makes the confirmation stale and rejects it.
- `docs/fixtures/sample-backup.json` restores three synthetic spools. `docs/fixtures/empty-backup.json` explicitly resets the workspace to empty USD records. Back up first and review the replacement counts.
- **Load sample spools** appends missing sample records without overwriting existing spools or duplicating samples already present. The sample prices for USD and BDT are independent synthetic fixtures, not currency conversion.

## Verification

```sh
npm run typecheck
npm test
npx playwright install chromium firefox webkit
npm run build
npm run test:e2e
npx playwright test --config playwright.branded.config.ts
```

The browser suite tests the production export. It covers complete workflows, revision conflicts, quota/blocked-storage failures, transaction aborts, future database versions, replacement safety, privacy inspection, keyboard focus, automated accessibility, phone layout, and maximum-size calculation performance. Real Safari is distinct from Playwright WebKit and requires separate verification on Apple hardware.

See [verification evidence](docs/verification.md) for actual results, browser versions, hardware, and unrun checks. Tests deliberately inject storage failures into isolated synthetic browser contexts; they never use an existing personal browser profile.

## Deployment

The current delivery is the local production build. Cloudflare publication is deferred by owner choice; no public deployment URL has been created.

See [Cloudflare Pages deployment](docs/deployment.md). Deploy the contents of `out/` on the Free plan. No Functions, D1, Node server, external API, paid plan, or custom domain is required.

Keep the same production origin to preserve access to browser data. Preview deployments and new domains have separate local workspaces. Before moving domains or rolling back a release with a newer schema, export a backup. Schema v1 has no destructive migrations.

## Portfolio material

- [Case-study draft and five annotated screens](docs/case-study.md)
- [Three LinkedIn drafts](docs/linkedin-drafts.md)
- [Walkthrough and recording notes](docs/walkthrough.md)
- [Design reference and generation prompt](docs/design/README.md)

To regenerate the synthetic screenshots, fixture backups, and walkthrough while the production preview is running:

```sh
node scripts/capture.mjs
```

This uses a fresh temporary browser context and overwrites only the generated portfolio files and fixtures. It includes intentional pauses to make the recording readable. It does not publish content or edit the agency website.

## Project layout and boundaries

`src/lib/domain.ts` owns validation and calculations. `src/lib/storage.ts` owns IndexedDB transactions. The workspace provider owns browser state and revision notifications. Feature components own inventory, spool forms, job calculations, and backup recovery. `src/app` contains three statically exported routes.

Accounts, collaboration, printer/scale integrations, procurement, CSV/PDF export, and a separate landing page are outside this release. Material estimates exclude machine time, power, labor, and waste beyond the entered requirement.

Third-party license notices are retained in `public/third-party-notices.txt`, including shadcn’s MIT notice. Regenerate them after dependency changes with `node scripts/licenses.mjs`. Publishing this repository or choosing a license for the original studio code is an owner decision.
