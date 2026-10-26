# Cloudflare Pages deployment

**Live app: [printpantry.pages.dev](https://printpantry.pages.dev/).** Published and verified on **26 October 2026** from [shawalkabirchy/printpantry](https://github.com/shawalkabirchy/printpantry).

PrintPantry is a static Next.js export. The build must produce `out/index.html`, `out/calculator/index.html`, `out/settings/index.html`, local assets, and the third-party notices file. No runtime credentials belong in the application.

## Production configuration

| Setting | Value |
| --- | --- |
| Pages project | `printpantry` |
| Repository / production branch | `shawalkabirchy/printpantry` / `main` |
| Build command | `npm run build` |
| Published directory | `out` |
| Node runtime | `24.14.0`, pinned in `.node-version` |
| Build image | Pages v3 |
| Runtime server / Functions | None |
| Web analytics | Disabled |
| Preview deployments / PR comments | Disabled |

Only static application assets are published. Source, portfolio media, fixtures, and test reports stay in GitHub and are not part of `out/`. The application needs no runtime credentials, paid resource, or custom domain. No billing settings were changed.

The first verified production deployment is `63720a88-1c94-4396-8912-2a7bdb883715`, built from commit `eeb73d2be66ea3961b338bf8b03db39be32ce1f6`. Its immutable URL is [63720a88.printpantry.pages.dev](https://63720a88.printpantry.pages.dev/). The release was explicitly triggered through the Pages API after the source push.

## Publish an update

1. Run `npm ci`, `npm run typecheck`, `npm test`, and `npm run build` with Node 24.14.0. Regenerate notices with `node scripts/licenses.mjs` when dependencies change.
2. Commit and push to `main`. Production deployments are enabled for this branch.
3. Check the Pages project's deployment list. If a push has not queued a build, choose **Create deployment** for `main` in the Cloudflare dashboard.
4. Wait for the clone, build, and deploy stages to succeed. Confirm that the deployment's commit matches the pushed source.
5. Check `/`, `/calculator/`, and `/settings/` by direct navigation and refresh, then verify the workflow with synthetic records in an isolated browser profile.

The existing Playwright suite can test the published origin without launching a local server. For example, in PowerShell:

```powershell
$env:PRINTPANTRY_TEST_URL = 'https://printpantry.pages.dev'
npm run test:e2e -- --project=chromium --grep 'create.*consume|portfolio demo|backup validation|360px layout|private inputs' --workers 1
Remove-Item Env:PRINTPANTRY_TEST_URL
```

See [verification](verification.md), [the five passing live-site tests](verification/production.json), and [direct-navigation/refresh evidence](verification/production-routes.json). Tests use synthetic records in new browser contexts; they never open a personal browser profile.

## Recovery and rollback

Export a JSON backup before a domain change or any later schema upgrade. A different domain or Pages preview URL is a different browser origin and does not share inventory. Keep the previous static release available for redeployment. Do not roll back to code that cannot read a newer local schema; restore compatible code instead. This v1 release preserves unknown schemas and has no destructive migration.

No backend data restore, authentication setup, or secrets rotation is required for this local-only release. Browser backup restoration is the recovery operation.

References: [Next.js static exports](https://nextjs.org/docs/app/guides/static-exports), [Cloudflare static Next.js](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/), [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/), [build runtime overrides](https://developers.cloudflare.com/pages/configuration/build-image/), [static asset pricing](https://developers.cloudflare.com/pages/functions/pricing/).
