# Normal — Nike business digital twin

**Making seamless operations the new normal.** Hackathon build (Mubit Night Shift) of Normal's business
simulation layer: a deterministic Nike-style ecommerce twin, canonical event ingestion, MongoDB persistence,
metrics, a demo storefront and a simulator control room.

> **Nike — Unaffiliated Simulation.** Product names and list prices are cited public references from
> nike.com/gb; every order, campaign, customer and incident is synthetic. Nike has not authorised or connected to
> this project. See [`docs/data-provenance.md`](docs/data-provenance.md).

## Run it

```bash
npm install
# For a new checkout only: copy .env.example to .env.local and configure MongoDB.
# Preserve an existing .env.local.
npm run dev                       # http://localhost:3000
```

- `/demo-store` — shopper view: 17 real Nike products, synthetic stock, functional simulated checkout.
- `/dev/simulator` — operator view: start a seeded run, advance virtual time, inject incidents, inspect
  database-backed metrics, inventory, shipping, reviews and the canonical event ledger.
- `/dev/monitor` — persisted anomalies, correlated incidents, evidence, scan history, job counts and measured worker health.
- `/dashboard` — unified operations dashboard: selected run, KPIs, monitoring health, incidents, anomalies, investigations;
  `/dashboard/architecture` (Observe → … → Learn with measured readiness) and `/dashboard/investigations/:id`
  (incident overview, **Collect evidence**, evidence explorer with source drill-down, tool execution timeline, explicit
  placeholders for the Mubit investigator, planner, partner execution and outcome verification).

For independent automatic monitoring, run a second terminal:

```bash
npm run monitor:check              # verifies actual Atlas Change Stream cursor access
npm run monitor:watch              # long-running Node process; Ctrl-C shuts down cleanly
```

Direct post-tick processing is enabled in development. The watcher and direct trigger share one durable
MongoDB queue and detector. Neither requires Mubit. See the recovery section of
[`docs/implementation-report.md`](docs/implementation-report.md) for the demo procedure and limits.

To reproduce Stage 4 without resetting `demo_nike` or changing the storefront's active run:

```bash
# With Next.js and monitor:watch running in separate terminals:
npm run demo:stage4 -- http://localhost:3000
```

This creates a uniquely named run, advances 72 healthy hours then 24 hours of advertising deterioration,
waits for the standalone worker, collects evidence, verifies source resolution and refresh idempotency, and prints
its dashboard/workspace URLs. It retains the isolated run for inspection. To inspect the existing demonstration,
open `/dashboard?run=demo_nike` and its investigation workspace. **Collect evidence** reuses the existing cutoff;
**Refresh** re-executes the tools in place. Mubit reasoning and solution planning are explicitly unimplemented.

The simulator routes under `/api/dev/*` only answer in development (or demo mode, see `.env.example`).

## Verify it

```bash
npm run contracts:typecheck && npm run contracts:validate   # shared @normal/contracts (Zod 3.25) + fixtures
npm run typecheck && npm run lint && npm run build          # stop next dev before building
npm test                                                    # vitest: engine, scenarios, ingestion, runtime, checkout, adapters, analytics, routes (uses Atlas, test business nike_test)
npm run test:e2e                                            # Playwright (desktop + mobile) against `next dev -p 3101`; restores the previous storefront run
```

## Layout

| Path | What |
|---|---|
| `packages/contracts/` | the single authoritative `@normal/contracts` package (schemas, invariants, fixtures) |
| `src/reference/` | verified Nike public catalogue + financials, provenance schemas, MongoDB service |
| `src/simulator/` | PRNG, scenarios, engine, bootstrap, persistence, runtime, storefront checkout |
| `src/ingestion/` | canonical ingestion (validation, dedupe, tenant scoping) |
| `src/analytics/` | MetricSnapshot aggregation and breakdowns |
| `src/intelligence/` | historical baselines, seven detection families, correlation, canonical persistence and queries |
| `src/intelligence/monitoring/` | validated ready windows, unique jobs, leases, retries, manual scans, reconciliation and Change Streams |
| `src/intelligence/evidence/` | eight read-only evidence tools, deterministic routing policy, bounded orchestrator, verification, provenance and persistence |
| `src/components/normal/` | unified dashboard shell, run selector, overview, process flow, investigation workspace, evidence explorer, tool trace, placeholders |
| `src/simulator/monitoring.ts` | producer-side durable-clock recovery and completed metric publication |
| `scripts/monitor-watch.ts` | standalone worker and Atlas capability check |
| `src/adapters/` | partner execution adapters for the three MVP actions |
| `src/app/api/` | route handlers (see `docs/api.md`) |
| `src/components/` | storefront and control-room UI |
| `docs/` | implementation report, API reference, architecture, provenance, simulator state, partner integration |
| `tests/` | vitest suites and Playwright E2E |

## Documentation

- [`docs/implementation-report.md`](docs/implementation-report.md) — milestone log, tests, results, limitations
- [`docs/api.md`](docs/api.md) · [`docs/architecture.mmd`](docs/architecture.mmd) (implemented); [`roadmap`](docs/architecture-roadmap.mmd) (future) · [`docs/simulator-state.md`](docs/simulator-state.md)
- [`docs/partner-integration.md`](docs/partner-integration.md) — how the agent module reads/changes the twin
- [`docs/NIKE_SIMULATOR_IMPLEMENTATION_GUIDE.md`](docs/NIKE_SIMULATOR_IMPLEMENTATION_GUIDE.md) — the annotated contract guide this build follows
