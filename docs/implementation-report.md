# Implementation report — Nike business digital twin

Stage: simulator, ingestion, analytics, demo interfaces. Business: **Nike — Unaffiliated Simulation** (`nike_demo`).
Repository: Next.js 16.4.3 (App Router, Cache Components), React 19.3, MongoDB driver 7.7, Atlas `normal_dev`.

Every milestone below followed implement → test → run → fix → re-run. Test counts are from the final run; see
"Final verification" for the exact commands and outcomes.

## Milestone 0 — Repository and contracts ✅

- Moved the supplied bundle into `packages/contracts/` as the npm workspace `@normal/contracts` (single source of
  truth; root tsconfig path alias `@normal/contracts` → `packages/contracts/src/index.ts`). `src/contracts.ts`,
  `src/invariants.ts`, fixtures and the validation script are byte-identical **except** two import specifiers in the
  barrel/example files (`./contracts.js` → `./contracts`), because Turbopack cannot resolve `.js`-suffixed
  specifiers to `.ts` sources. No schema, enum or field changed. The package tsconfig uses `moduleResolution: Bundler`.
- Installed `zod@3.25.76` (contract-mandated; the only remaining `npm audit` advisory is Zod 3's oversized-collection
  DoS, mitigated by `IngestBatch.max(1000)` and bounded request bodies), `vitest@5`, `tsx`, `vite-tsconfig-paths`,
  `@playwright/test`; bumped `@types/node` to 22 to match the Node 22 runtime and allow vitest 5 (which fixed two
  critical dev-only advisories in vitest 3).
- Tests: `tests/contracts/*` — all 15 fixtures validate, `plan-handoff` passes `planReferenceErrors`, unknown event
  types/keys are rejected, the 13 canonical event names are asserted, and a grep guard fails if any second
  `BusinessEvent`/`ScenarioName`/`ProposedPlan`… definition appears outside `packages/contracts`.
- Existing `getDb()` round-trip and the dev-only `db-test` 404 behaviour are covered in `tests/db`.
- Gate: `npm run contracts:typecheck`, `contracts:validate` (15/15), `tsc`, `lint`, `next build` all passed.

## Milestone 1 — Reference catalogue ✅

- `src/reference/`: Zod schemas for provenance-tagged public observations; 17 products fetched verbatim from
  nike.com/gb category/product pages on 2026-10-24 (running 4, basketball 3, lifestyle 4, football 3, apparel 3) with
  name, subtitle, GBP list price, style code, URL, retrieval method; NIKE, Inc. Q1 FY2027 results (USD) stored
  separately with `relationshipToSimulator: "context_only_not_simulated_revenue"`.
- `seedReferenceData()` upserts idempotently; `getReferenceCatalogue()` prefers MongoDB and falls back to the
  bundled cache (empty DB and unreachable DB both tested).
- `src/simulator/catalogue.ts`: synthetic cost ratios, stock, popularity, quality per product (labelled synthetic);
  `priceOrigin` is `official_public_list_price` only for verified references, else `synthetic`.
- Tests: `tests/reference/catalogue.test.ts` (11). Gate passed.

## Milestone 2 — Customer, order and inventory engine ✅

- `rng.ts` (sfc32, serialisable), `bootstrap.ts` (pure initial world), `engine.ts` (`TickEngine`, one virtual hour per
  tick), `persistence.ts`, `runtime.ts` (lease lock, idempotency keys, chunked persistence, stock-conflict
  regeneration), `checkout.ts` (transactional storefront purchase), `ingestion/service.ts`.
- Tests: `tests/simulator/engine.test.ts` (12: 48-tick determinism, divergence, resume-from-serialised state,
  arithmetic, inventory, ads, deliveries, reviews, stock exhaustion), `tests/simulator/runtime.test.ts` (7: canonical
  shapes, idempotent replay, 3 concurrent ticks → 1 proceeds, same seed in two runs → identical persisted
  observations, 1-tick-per-request restart equivalence, ground-truth isolation, validation),
  `tests/simulator/checkout.test.ts` (6: server pricing, replay, coupon, 5 concurrent buyers of 1 unit → 1 success,
  zero-stock, fulfilment pickup), `tests/ingestion/service.test.ts` (6).
- Bugs fixed along the way: a `run` getter/method name clash in the engine; `loadEnvConfig` ignoring `.env.local`
  under `NODE_ENV=test`; a test expecting `toEqual` on a result that also carries `eventIds`.
- Gate passed.

## Milestone 3 — Advertising, shipping, reviews, partner adapters ✅

- Advertising/fulfilment/review mechanics live in the engine (see `docs/simulator-state.md`); attribution is derived
  from linked orders, `ad.metrics_observed` windows are disjoint per campaign per tick.
- `src/adapters/`: `setDailyBudget`, `sendDelayNotice`, `publishBanner` with exact `ActionProposal` param schemas,
  server limits, idempotent receipts (`action_receipts`), read-back before callback events, `verifyAction`, read
  helpers (`readCampaigns`, `listDelayedOrders`, `readOrdersShipping`, `readStorefront`, `readTestInbox`).
- Tests: `tests/adapters/adapters.test.ts` (6) — including "later ticks obey the new budget" (spend ≤ new budget and
  < 65 % of prior spend while another campaign is unchanged).
- Bug fixed: `ActionProposal.options.find(...)` lost the discriminant type; switched to index + runtime assertion.
- Gate passed.

## Milestone 4 — Scenario injection ✅

- `scenarios.ts` maps `(scenario, severity)` to mechanistic parameters only. All six canonical scenarios implemented.
- Tests: `tests/simulator/scenarios.test.ts` (8) over three seeds with per-seed assertions: ad_fatigue (frequency
  ×1.5+, CTR/clicks/paid sessions/paid orders < 60 %, spend ±10 %, revenue < 80 %), delivery_delays (late rate > 0.35
  and > 3× baseline, satisfaction ↓, ratings −0.3★, ads untouched), viral_demand (mentions ×5, organic ×2, viral
  product orders ×3, revenue +15 %, stock-outs, ads untouched), negative_reviews (−1★ on target product, deliveries
  healthy), promo_checkout_failure (coupon failures ↑, orders −10 %), monotonic severity, hidden parameters absent
  from every event.
- Tuning while testing: Dunk Low Retro initial stock 240 → 110 so viral pressure shows within a week; defective
  products raise review propensity; delayed-delivery penalty strengthened; measurement windows lengthened for
  effects that lag by design (deliveries/reviews).
- Gate passed.

## Milestone 5 — APIs and analytics ✅

- `src/analytics/metrics.ts`: one `$facet` aggregation per query producing validated `MetricSnapshot`s per bucket
  (window/hour/day), dimensions (campaign/product/channel/device via `$lookup`), ad-window deduplication, null rates
  on zero denominators, partial/complete flag; `productBreakdown`, `campaignBreakdown`; per-tick hourly snapshots
  persisted (`SimulatorTickResponse.metricSnapshotIds`).
- Routes: see `docs/api.md`. Dev routes 404 outside development/demo mode; ingest requires credentials.
- Tests: `tests/analytics/metrics.test.ts` (6: counters equal an independent recount, half-open buckets sum to the
  total, partial windows, null rates, dimensions, cross-business isolation, duplicate ad windows not double counted,
  product/campaign arithmetic, idempotent persistence), `tests/api/routes.test.ts` (6: protection, start→tick→inject→
  state round-trip with canonical shapes, ingest auth/scoping, metrics/breakdown, demo-store incl. idempotent checkout,
  `GET /api/plans/plan_001` after fixture seeding).
- Bugs fixed: MongoDB `Filter<T>` typings on two routes; a test that sampled a review event before any review existed.
- Gate passed.

## Milestone 6 — Frontend ✅

- `/demo-store`: catalogue with search + category chips, provenance drawer (source link, retrieval date, synthetic
  disclaimer), cart with quantity caps by stock, server-priced checkout with idempotency key, confirmation, "your
  orders" persisted across refresh, partner banners, prominent unaffiliated/no-real-purchases notices. Original
  category-tile visuals; no Nike imagery is hotlinked.
- `/dev/simulator`: run selector, seed/run-id start-reset, +1/+6/+24/+72h ticks (with idempotency key), scenario +
  severity injection, metrics window chips, KPI tiles, four single-axis SVG charts with crosshair tooltips and table
  toggles (palette validated with the dataviz validator for light and dark), campaign table (budget, spend, CTR,
  frequency, CPA, ROAS), inventory & product revenue, shipping activity, recent reviews, filterable canonical event
  ledger. All data from the APIs; refresh preserves state.
- Playwright (`tests/e2e`, desktop + Pixel 7 projects, 10 tests): catalogue count/filter/provenance, add-to-cart →
  persisted order → API inventory decrement and ledger event → survives reload, sold-out product blocked, control
  room start → +24h → KPIs/charts/tables match the breakdown API → inject → reload preserves scenario and clock.
- Bugs fixed: Turbopack could not resolve the contracts barrel's `.js` specifiers (see M0); React hooks lint rule on
  storage hydration; a Playwright locator ambiguity.
- Gate passed (10/10 E2E).

## Milestone 7 — Full system regression ✅ (see final verification)

`tests/regression/full-system.test.ts` executes the 17-step scenario against Atlas with run `t_regression` (seed 42):
3-day healthy baseline → `ad_fatigue 0.8` → 3 days → MongoDB evidence (frequency ↑, CTR/clicks < 60 %, spend ≈,
attributed orders & revenue ↓, no hidden labels) → adapter halves `cmp_lifestyle_af1` budget → callback event → 1 day →
spend ≤ new budget and < 65 % while Pegasus spend unchanged → `delivery_delays 0.8` → 5 days → late rate > 0.25 and
> 4× baseline, customer satisfaction ↓, delayed events ↑ → storefront checkout → order/events/inventory persisted and
visible in a metrics window → fresh state load: 288 ticks, lock released, event/order/snapshot counts reconcile →
seed 42 replayed in a new run reproduces every event of the first 72 ticks.

Two assertions were recalibrated after the first run (late-delivery threshold ignored the 48 h observation lag; the
replay comparison included boundary-timestamped tick-72 events on one side). No product code changed for M7.

## Known limitations

- `lateDeliveryRate` compares delayed and shipped **events within the window** (not a cohort), so it understates
  during the first ~2 days after an incident; documented in `src/analytics/metrics.ts`.
- Channel/device metric dimensions join orders to `simulated_sessions` via `$lookup`; ad counters are zero for
  product/channel/device slices by design.
- Business scoping uses a validated `businessId` parameter (default `nike_demo`); real tenant authentication is a
  later stage. Dev routes are hidden outside development/demo mode.
- The partner's approval/orchestration/execution records are not implemented (by design). `GET /api/plans/:id`
  serves persisted plans; only the fixture can be seeded today.
- `simulated_sessions` is the largest collection (~1.2 k docs per virtual day); a 30-day run stays well inside the
  Atlas free tier but very long runs should be reset.
- Reference prices were observed on 2026-10-24 and may change; the UI states this.
- E2E uses run `e2e_run` inside `nike_demo` and makes it the storefront's active run.

## Final verification (2026-10-24, against Atlas `normal_dev`)

| Check | Command | Result |
|---|---|---|
| Contract package typecheck | `npm run contracts:typecheck` | pass |
| Contract fixture validation | `npm run contracts:validate` | 15/15 fixtures valid |
| TypeScript | `npx tsc --noEmit` | 0 errors |
| ESLint | `npm run lint` | 0 errors, 0 warnings |
| Unit/integration suites | `npx vitest run` | **13 files, 99 tests passed**, 0 failed (524 s; DB-backed suites use business `nike_test`) |
| Full-system regression (M7, 17 steps) | part of the suite: `tests/regression/full-system.test.ts` | 7/7 steps passed |
| Production build | `npm run build` | success; 2 static pages + 16 dynamic routes, no prerender bail-out warnings |
| Browser end-to-end | `npx playwright test` (desktop Chromium + Pixel 7) | **10/10 passed** (1.2 min, against `next dev -p 3101`) |
| Live Atlas connectivity | `tests/db/mongodb.test.ts` | replica set, transactions supported, write/read round-trip ok |

Checks that could not be run or were not applicable: none skipped. External fetching was performed once (HTTP
requests to nike.com/gb and investors.nike.com on 2026-10-24); no bot block was encountered and no access control
was bypassed. The repository is not a git repository, so no commits were made.

## Definition of done — status

The Nike twin generates simulated purchases and advertising (engine + runtime tests); MongoDB stores canonical,
validated, deduplicated events (ingestion tests); an injected advertising problem degrades campaign mechanics and
the metrics reveal it (scenario + regression tests); a controlled budget change through the partner adapter alters
future performance (adapter + regression tests); a shopper completes a synthetic purchase in the browser and the
order, inventory and revenue changes persist (Playwright + regression). The system exposes events, metric snapshots
and `GET /api/plans/:id` for the next stage: anomaly detection → evidence → Mubit diagnosis → ProposedPlan →
partner execution.
