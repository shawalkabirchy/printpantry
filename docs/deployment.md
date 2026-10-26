# Cloudflare Pages deployment

**Current handoff: local build, as requested by the owner.** The saved Cloudflare authorization lacks `pages:write` (API error 10000). No Pages project or deployment was created. Authorization and live-origin verification are deferred; the steps below are the deployment handoff, not evidence of a published site.

PrintPantry is a static Next.js export. The build must produce `out/index.html`, `out/calculator/index.html`, `out/settings/index.html`, local assets, and the third-party notices file. No runtime credentials belong in the application.

## Release gate

Run the README verification commands against the release source and review `docs/verification.md`. Use an authenticated Cloudflare account on the Free plan. Never enable paid resources to bypass an error. Recheck current Pages terms and quotas before publishing.

## Direct Upload

1. Run `npm ci`, `node scripts/licenses.mjs`, and `npm run build` with Node 24.
2. In Cloudflare’s Workers & Pages dashboard, choose **Pages → Direct Upload** and a project name such as `printpantry`.
3. Upload the `out/` directory (or a ZIP containing its files at the ZIP root). Do not upload source, node_modules, fixtures, test results, or the portfolio video.
4. Use the resulting verified `*.pages.dev` URL. No new domain purchase is needed.
5. Test `/`, `/calculator/`, `/settings/`, refreshing each URL, adding a spool, saving a measurement, and exporting/restoring a backup on that deployed origin.

For an existing authenticated CLI setup, the equivalent upload is:

```sh
npx wrangler pages deploy out --project-name printpantry
```

The project must exist in the intended account, and the actual deployment URL must come from Cloudflare’s successful response. Keep credentials outside source control. `wrangler whoami` checks existing authentication; `wrangler login` is an interactive owner sign-in step.

## Optional Git-based builds

If the owner connects a repository, use a private or public repository according to their chosen visibility. Build command: `npm run build`. Output directory: `out`. Pin Node 24 in the provider build environment. The repository is not automatically published or pushed by the local implementation.

## Recovery and rollback

Export a JSON backup before a domain change or any later schema upgrade. A different domain or Pages preview URL is a different browser origin and does not share inventory. Keep the previous static release available for redeployment. Do not roll back to code that cannot read a newer local schema; restore compatible code instead. This v1 release preserves unknown schemas and has no destructive migration.

No backend data restore, authentication setup, or secrets rotation is required for this local-only release. Browser backup restoration is the recovery operation.

References: [Next.js static exports](https://nextjs.org/docs/app/guides/static-exports), [Cloudflare static Next.js](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/), [Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/).
