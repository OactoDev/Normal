# HTTP API contract (v1)

All responses are JSON. Normal's backend derives `businessId` from an authenticated tenant context in production; never trust arbitrary user-supplied business IDs for access control. For demo, use a single `nova_store` tenant. Use `schemaVersion: 1` for persisted records.

| Method | Path | Body / response | Owner |
|---|---|---|---|
| POST | `/api/ingest/events` | `IngestBatch` -> `IngestResult` | Intelligence developer |
| POST | `/api/simulator/start` | `SimulatorRun` config -> `SimulatorRun` | Intelligence developer |
| POST | `/api/simulator/inject` | `InjectScenarioRequest` -> updated `SimulatorRun` | Intelligence developer |
| POST | `/api/simulator/tick` | `SimulatorTickRequest` -> `SimulatorTickResponse` | Intelligence developer |
| GET | `/api/metrics?businessId=...` | array of `MetricSnapshot` | Intelligence developer |
| POST | `/api/monitor/run` | `{businessId}` -> created anomalies | Intelligence developer |
| GET | `/api/investigations/:id` | `Investigation` plus evidence | Intelligence developer |
| POST | `/api/investigations/:id/diagnose` | -> `Diagnosis` | Intelligence developer |
| POST | `/api/investigations/:id/propose-plan` | -> `ProposedPlan` | Intelligence developer |
| GET | `/api/plans/:id` | `PlanHandoff` (plan + diagnosis + evidence) | Intelligence developer |
| POST | `/api/plans/:id/approve` | `PlanApproval` -> reviewed plan state | Execution developer |
| POST | `/api/plans/:id/execute` | `{approvalId, planVersion, selectedActionIds}` -> `AgentMission[]` | Execution developer |
| GET | `/api/plans/:id/executions` | `ActionExecution[]` | Execution developer |
| POST | `/api/diagnoses/:id/correct` | `ModelCorrection` -> receipt | Intelligence developer |
| GET | `/api/evaluations/:datasetId` | `EvaluationResult[]` | Intelligence developer |

## Critical handshake

Your partner builds against `examples/plan-handoff.json`. On GET `/api/plans/plan_001`, the exact response is:

```json
{
  "plan": "<ProposedPlan object>",
  "diagnosis": "<Diagnosis object>",
  "evidence": ["<Evidence object>"]
}
```

The angle brackets above are placeholders; the example fixture contains actual complete JSON.

### Approval invariants

1. Only the authenticated business owner or an authorised delegate can approve.
2. Approval references exact `planId`, `planVersion`, and selected `actionId` values. Editing a plan invalidates approvals for prior versions.
3. Do not execute until action IDs are in an unexpired approved record, and the plan is still current.
4. Reject unknown action types; never turn free-form LLM text into code or tool names.
5. Enforce per-action account, campaign, recipient and spend limits server-side, even if the model requested more.
6. Use stable idempotency keys, such as `plan_001:v1:act_ads_001`, to avoid duplicate emails or budget changes on retries.
7. Execution status comes from actual provider/simulator responses, not model text.
8. Keep side effects in the simulator and controlled test inboxes for the hackathon. Document any real integrations accurately.

### Ingestion invariants

1. Check webhook authentication/signatures where applicable, and validate against `BusinessEvent`.
2. For event deduplication, use `(businessId, provenance.connectorId, provenance.sourceRecordId)` as a unique composite index.
3. Store the raw source payload in a separate, access-controlled collection when appropriate; normalised events are immutable.
4. Distinguish source event time `occurredAt` from ingestion time `receivedAt`.
5. Aggregate the current/baseline windows consistently and label incomplete data; do not fabricate missing metrics.

---

## Implemented in the Nike simulator stage (this repository)

All routes return JSON; errors use the canonical `ApiError` envelope `{ error: { code, message, requestId } }`.
`businessId` defaults to `nike_demo` and may be passed as `?businessId=` on this stage's routes (a validated
`[a-z0-9_]` identifier). Money is integer minor units (GBP); times are ISO-8601 UTC strings; metric windows are
half-open `[startAt, endAt)` in **virtual** time.

### Access control

| Routes | Rule |
|---|---|
| `/api/dev/**` | `NODE_ENV=development`, or `NORMAL_DEMO_MODE=true` with header `x-normal-demo-key: $NORMAL_DEMO_KEY`; otherwise **404** |
| `POST /api/ingest/events` | as above, or `Authorization: Bearer $NORMAL_INGEST_API_KEY`; otherwise **401** |
| `/api/metrics*`, `/api/demo-store/*`, `GET /api/plans/:id` | public read (checkout is a public, bounded, server-priced mutation) |

### Simulator (dev/demo)

| Method | Path | Body → response |
|---|---|---|
| POST | `/api/dev/simulator/start` | `StartSimulatorRequest` (supplementary) `{ businessId?, simulationRunId?, seed=42, virtualStartAt?, minutesPerTick=60, reset=false, makeActive=true }` → **201** run summary `{ run: SimulatorRun, tickIndex, virtualStartAt, totals, locked, scenarioInjectedAt, isActiveRun }`. **409 `run_exists`** unless `reset:true`. Seeds the reference catalogue first. |
| POST | `/api/dev/simulator/tick` | canonical `SimulatorTickRequest` → canonical `SimulatorTickResponse` (`metricSnapshotIds` = one hourly global snapshot per tick). Optional `Idempotency-Key` header replays the stored response. **409 `run_locked`** when another tick/inject is running. |
| POST | `/api/dev/simulator/inject` | canonical `InjectScenarioRequest` → run summary. Writes private ground truth; never returns it. |
| GET | `/api/dev/simulator/state?simulationRunId` | run summary + `inventory[]`, `campaigns[]` (budget/status/totals, no hidden params), `storefront`, `shipments{status→count}`, `recentReviews[]`, `recentShipments[]`, `counts` |
| GET | `/api/dev/simulator/events?simulationRunId&type&limit≤200` | `{ simulationRunId, events: BusinessEvent[] }` newest first |
| GET | `/api/dev/simulator/runs` | `{ activeSimulationRunId, runs: (SimulatorRun & {tickIndex,totals})[] }` |
| POST | `/api/dev/plans/seed-fixture` | loads `examples/plan-handoff.json` into `plans`/`diagnoses`/`evidence` |

### Data

| Method | Path | Body → response |
|---|---|---|
| POST | `/api/ingest/events?businessId?` | canonical `IngestBatch` → canonical `IngestResult`. Per-event rejections are listed in header `x-normal-rejections`; a malformed envelope is **400**. Dedupe key: `(businessId, provenance.connectorId, provenance.sourceRecordId)`. |
| GET | `/api/metrics?simulationRunId&startAt&endAt&bucket=window\|hour\|day&days=7&campaignId&productId&channel&device&persist=false` | `MetricSnapshot[]` (one per bucket; `completeness: partial` when the bucket ends after virtual time; rates `null` on zero denominators) |
| GET | `/api/metrics/breakdown?simulationRunId&days=7` | UI wrapper `{ run, window, total: MetricSnapshot, daily: MetricSnapshot[], hourly (last 72h), products[] (units, revenue, stock), campaigns[] (CTR, CPA, ROAS, frequency) }` |
| GET | `/api/demo-store/products` | `{ simulationRunId, virtualTime, servedFrom, banners[], promotions[], products[] }` — each product carries `priceOrigin` and `reference { sourceUrl, retrievedAt, dataOrigin, styleCode }` |
| POST | `/api/demo-store/checkout` | `CheckoutRequest` `{ idempotencyKey (8–120 chars), items[{productId, quantity≤5}]≤5, device?, couponCode?, shopperName? }` → **201** `{ status: "completed", order, ingest }`, **200** `{ status: "replayed", order }`, **409** `{ status: "failed", failureCode: "out_of_stock" \| "coupon_rejected", message }` |
| GET | `/api/demo-store/orders?keys=k1,k2` | `{ orders[] }` with shipment status; without keys, the latest storefront orders |
| GET | `/api/plans/:id` | canonical `PlanHandoff`, validated incl. `planReferenceErrors`; **404** when missing |

### Partner adapters

Service functions, not HTTP: see [`partner-integration.md`](partner-integration.md).
