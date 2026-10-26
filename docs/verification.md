# PrintPantry verification

Local release checked on **24 October 2026 (UTC)**. All records used for tests, screenshots, and the walkthrough are synthetic. The acceptance baseline is P03 and the shared rules in [the project brief](../files/consolelog-project-build-briefs.md), with the approved Next.js/Tailwind/shadcn stack.

## Recorded checks

| Command / check | Actual result | Evidence |
| --- | --- | --- |
| `npm run typecheck` | Passed | TypeScript checked application and test sources without diagnostics. |
| `npm test` | Passed: 8 domain tests | [Domain tests](../tests/domain.test.ts) |
| `npm run build` | Passed: static production export | `out/index.html`, `out/calculator/index.html`, `out/settings/index.html`; [export configuration](../next.config.ts) |
| `npm run test:e2e` — workflow cases | Passed: 30 cases across Chromium, Firefox, and WebKit | [Functional results](verification/functional.json), [test source](../tests/e2e/app.spec.ts) |
| `npm run test:e2e -- --grep "maximum supported" --workers 1` | Passed: 3 engine cases | [Performance results](verification/performance.json), [test source](../tests/e2e/performance.spec.ts) |
| `npm run test:e2e -- --config playwright.branded.config.ts` | Passed: 4 cases in installed Chrome and Edge | [Installed-browser results](verification/branded.json) |
| `npm run test:e2e -- --grep "360px layout\|private inputs" --workers 1` | Passed: 6 targeted cases after final phone navigation adjustment | [Final phone and privacy results](verification/final-ui-and-privacy.json) |
| `node scripts/capture.mjs` | Passed: 5 screenshots, valid fixture backups, no page errors | [Capture metadata](portfolio/capture.json), [screens and annotations](case-study.md) |
| Walkthrough duration probe with Playwright's bundled FFmpeg | 50.92 seconds | [Actual screen recording](portfolio/walkthrough.webm), [narration notes](walkthrough.md) |
| Cloudflare publication and live-origin verification | **Not run — deferred by owner** | [Deployment handoff](deployment.md) |

The workflow, performance, and installed-browser reports preserve separate accepted test groups: **37 passing browser cases** in total, plus the 8 domain tests. The final sweep repeated 6 of those scenarios with stronger network assertions; all passed. Windows browser checks run sequentially, with a two-minute startup allowance after a trace showed a 47-second blank-page launch. The independent calculation check still enforces 200 ms. Accessibility scans wait for client navigation, the destination heading, and the document title before inspecting the loaded screen.

## Acceptance results

| Check | Test method | Result | Evidence location |
| --- | --- | --- | --- |
| **P03-A1 — Weighing** | Domain assertions and browser preview/save: gross 600 g − tare 200 g = 400 g; gross 150 g rejects. | Passed | Domain tests; functional portfolio-demo cases; [weighing screenshot](portfolio/02-weighing-preview.png) |
| **P03-A2 — Ledger** | Replay initial 1,000 g → consume 100 g → measure 850 g; reload and inspect balances/history. | Passed: 900 g after consumption, then 850 g | Domain tests; functional create/consume/weigh/reload cases |
| **P03-A3 — Eligibility** | At 400 g, 390 g + 10 g qualifies and 391 g + 10 g fails; archive exclusion, tied-surplus ID ordering. | Passed | Domain tests; functional portfolio-demo and archive cases |
| **P03-A4 — Cost** | 20.00 per 1,000 g gives 2.00 per 100 g; reserve affects eligibility only; half-unit ties round upward; large intermediate multiplication uses exact arithmetic. | Passed | Domain tests; [calculator screenshot](portfolio/03-calculator-result.png) |
| **P03-A5 — Integrity** | Reject precision, bounds, over-consumption, malformed references/sequences and limit violations; force transaction abort; create/delete spool with ledger atomically. | Passed | Domain tests; functional create/delete and aborted-transaction cases |
| **P03-A6 — Recovery** | Export/import restores settings, events, balances and sequence. Cancelled, malformed, oversized and stale imports preserve committed records. Complete workflow at phone width. | Passed | Functional backup, stale-tab, privacy and 360 px cases; [fixtures](fixtures/sample-backup.json) |
| **G-A1 — Usable UI** | 360 px phone and 1440 px desktop; no page overflow; keyboard Enter/Escape and restored dialog focus; axe on inventory, details, calculator and settings; visible focus/reduced-motion CSS review. | Passed in tested engines; actual Safari **Not run** | Functional 360 px cases; [desktop](portfolio/01-inventory-desktop.png) and [phone](portfolio/05-inventory-mobile.png) screenshots |
| **G-A2 — Truthful state** | Check empty/loading/saved states; invalid forms; inject blocked storage and quota failure. Failed save retains pending input and reports Not saved, with recovery export. | Passed | Functional blocked-storage, quota and validation cases; [workspace provider](../src/components/workspace-provider.tsx) |
| **G-A3 — Reliable records** | Reload persistence, two-tab stale writes, stale replacement preview, aborted transaction, atomic creation/deletion, future database version preservation. | Passed | Functional reports and transaction tests; [storage implementation](../src/lib/storage.ts) |
| **G-A4 — Privacy** | Observe browser requests during private spool entry and file selection/import/cancellation. Check private text and filenames never occur in requests; no foreign-origin calls. All observed requests are GET/HEAD with no bodies. Runtime assets remain local. | Passed | Functional private-input cases; [final sweep](verification/final-ui-and-privacy.json) |
| **G-A5 — Bounded work** | Reject over 200 spools / 5,000 events and >10 MiB backup before replacement; validate decimal magnitude before conversion; measure maximum-size calculation and allow staged results/history access. | Passed | Domain tests; privacy oversize-import cases; performance report |
| **G-A6 — Evidence** | Preserve commands, actual engine versions, reference hardware, timings and explicit unavailable checks. | Passed for local handoff | This report and linked machine-readable results; hosted checks remain Not run |

Automated accessibility checks supplement keyboard interaction and visual inspection. They are not an accessibility certification. Failure injection runs in isolated browser contexts and does not open an existing personal browser profile.

## Browser and performance evidence

Reference computer: **13th Gen Intel Core i7-1355U, 12 logical cores, 16 GiB RAM; Windows 10.0.26200**. Runtime: **Node 24.14.0, npm 11.14.1**.

| Browser / engine | Coverage | Maximum-size submit-to-results frame |
| --- | --- | --- |
| Playwright Chromium 156.0.8078.4 | 10 functional cases and maximum-size calculation | **77.9 ms** |
| Playwright Firefox 157.0 | 10 functional cases and maximum-size calculation | **18.0 ms** |
| Playwright WebKit 27.2 | 10 functional cases and maximum-size calculation | **62.0 ms** |
| Installed Google Chrome 156.0.8078.47 | Create/consume/weigh/reload/archive/delete and portfolio matching workflow | Not separately benchmarked |
| Installed Microsoft Edge 155.0.4283.62 | Same two main workflows | Not separately benchmarked |
| Actual Safari / iOS Safari | **Not run** — Apple hardware unavailable | Not run |

The measured fixture contains **200 spools and 5,000 events**. Each number is one recorded local run from submitting a valid job to the rendered results frame, not a percentile or service guarantee. All three measurements met the brief's 200 ms target on this computer. Results initially show 20 matches; **Show next 20** exposes the rest. Full ledger history remains available through **Show older 20**.

The production export, rather than the development server, is used for browser tests. Direct navigation and refresh work for all three routes. Browser-created spool IDs open inside inventory and require no dynamic routes. Screenshot sizes are 1440 × 960 desktop and 360 × 800 phone; test desktop viewports are 1440 × 1000. In-app-browser inspection and the capture script found no application console/page errors.

## Delivery limits

The owner selected **local delivery for now**. The saved Cloudflare authorization lacked `pages:write` (API error 10000); no Pages project or deployment was created. Provider authorization, a public URL, HTTPS-origin workflow checks, and actual Safari testing are **Not run**. No social posts or agency-website changes were published.

Records belong to one browser profile and origin. Site-data clearing, browser eviction, or changing domains can remove access to them. Export a JSON backup regularly and before moving origins. This release has no accounts, sync, printer integration, or installed offline/PWA support.
