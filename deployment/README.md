# Public Cloudflare deployment

Live app: https://normal-ops.kiritokris.workers.dev

- Account: `amanshah0844@gmail.com` (`cf7590968e7d3a54091b3a94df6f1506`).
- Worker: `normal-ops`, using the OpenNext adapter for Next.js.
- Database: D1 `normal-ops`, bound as `NORMAL_DB`.
- `NORMAL_STORE=d1` enables persistent records with atomic claims and optimistic concurrency checks.
- `PUBLIC_DEMO=1` isolates D1 collections by an HTTP-only browser session cookie. The middleware overwrites the internal session header.
- `EMAIL_PROVIDER=demo` records simulated sends without SMTP or a mail API. No private local keys or CSV files are deployed.
- Sapling checks call the real provider. The upstream Mubit diagnosis fallback remains an existing issue; no Mubit API key is configured on this public Worker.

## Redeploy

From the app repository, after authenticating Wrangler:

```bash
npx wrangler whoami
npx wrangler d1 execute normal-ops --remote --file deployment/schema.sql
NEXT_PUBLIC_PUBLIC_DEMO=1 npm run deploy:worker
```

The configuration pins the requested account and reuses the existing D1 database. The original `cloudflare/` folder is the separate team hub, not this app.

For an isolated build, copy source and configuration to a temporary folder, excluding `.env*`, `.dev.vars*`, `data/`, `.git/`, `node_modules/`, `.next/`, `.open-next/`, and generated videos; run `npm ci` there before deploying. Public demo builds must set `NEXT_PUBLIC_PUBLIC_DEMO=1` so the UI labels simulated operations correctly.

## Verified after deployment

All existing test scripts and `npm run test:d1` passed. The hosted workflow was checked over HTTPS:

- Supported diagnosis → generate plan → read it in a later request → approve → execute all three simulated actions.
- Two recorded email sends use the `demo` provider.
- A second browser session cannot read the first browser's generated plan or changed campaign budget.
- Eight late orders with a forged supported client verdict return HTTP 409 `SAPLING_BLOCKED`.
- All four live stress checks match their expected labels.

Initial deployed Worker version: `61da8324-0d6a-405b-b34a-4e1655928e8f`.
