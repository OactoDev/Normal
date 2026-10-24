# Partner integration: executing approved actions against the Nike digital twin

Audience: the developer building Normal's approval UI, orchestration and agent execution.

## What you consume

- `GET /api/plans/:id` → canonical `PlanHandoff` `{ plan, diagnosis, evidence }` validated with `@normal/contracts`
  before it is returned. Until the intelligence stage produces real plans, run
  `POST /api/dev/plans/seed-fixture` (development only) to load `packages/contracts/examples/plan-handoff.json`
  and exercise `GET /api/plans/plan_001`.
- The simulated business state, through the **adapter service functions** below. They are the only supported
  way to read or change the twin from your module. There is deliberately **no public HTTP mutation route** for
  them: expose them behind your own authenticated, approval-checked route.

## Adapter functions (`import { ... } from "@/adapters"`)

All mutations take an `ActionContext`:

```ts
interface ActionContext {
  businessId: string;            // "nike_demo"
  simulationRunId?: string;      // defaults to the business's active run
  actionId: string;              // ProposedPlan action.actionId
  idempotencyKey: string;        // e.g. `${planId}:v${planVersion}:${actionId}`
  executionId?: string;
}
```

and return an `AdapterResult<T>`:

```ts
interface AdapterResult<T> {
  applied: boolean;              // false when the idempotency key was already executed (replay)
  emittedEventIds: string[];     // canonical callback events written to business_events
  verification: string;          // read-back statement for ActionExecution.result.verification
  affectedEntityIds: string[];
  state: T;                      // the entity as read back after the change
}
```

| Action type (exact params from `ActionProposal`) | Adapter | Reads | Callback event |
|---|---|---|---|
| `ads.set_daily_budget` `{campaignId, newDailyBudgetMinor, currency}` | `setDailyBudget(ctx, params)` | `readCampaigns(ctx)`, `readCampaign(ctx, id)` | `campaign.budget_updated` (`ingestMethod: action_callback`) |
| `customer.send_delay_notice` `{orderIds, templateId, maxRecipients}` | `sendDelayNotice(ctx, params)` | `listDelayedOrders(ctx)`, `readOrdersShipping(ctx, orderIds)`, `readTestInbox(ctx)` | one `customer.message_sent` per message |
| `storefront.publish_banner` `{bannerId, message, startsAt, expiresAt, promoCode?}` | `publishBanner(ctx, params)` | `readStorefront(ctx)` | `storefront.banner_published` |

Independent verification: `verifyAction(ctx, idempotencyKey)` re-reads the affected entity and confirms the
callback events exist in the ledger (`stateMatches`, `callbackEventsPresent`).

### Guarantees

- Params are parsed with the **exact** `@normal/contracts` `ActionProposal` param schemas; unknown keys fail.
- Server-side limits always win over requested values (`ADAPTER_LIMITS`): max daily budget £1,000, max 4× budget
  change per action, ≤200 delay-notice recipients, banner ≤160 chars and ≤14 days.
- Idempotent: the first execution for an `idempotencyKey` is recorded in `action_receipts`; replays return the
  original result with `applied:false` and emit nothing.
- Callback events are emitted **only after** the persisted change has been read back.
- Effects are real for the twin: later ticks pace ad spend against the new budget; banners appear on `/demo-store`;
  delay notices land in the `simulated_messages` fake inbox (`inbox: "demo_test_inbox"`). No email is sent.
- Errors are `AdapterError { code, retryable }` (`campaign_not_found`, `budget_limit`, `budget_change_limit`,
  `currency_mismatch`, `no_recipients`, `invalid_window`, `verification_failed`, `conflict`…).

### Example

```ts
import { setDailyBudget, verifyAction } from "@/adapters";

const ctx = { businessId: "nike_demo", actionId: "act_ads_001", idempotencyKey: "plan_001:v1:act_ads_001" };
const result = await setDailyBudget(ctx, { campaignId: "cmp_running_pegasus", newDailyBudgetMinor: 6000, currency: "GBP" });
// result.applied === true, result.emittedEventIds = ["ev_<run>:action:plan_001:v1:act_ads_001:budget"]
const check = await verifyAction(ctx, ctx.idempotencyKey);   // { stateMatches: true, callbackEventsPresent: true, ... }
```

## Campaign IDs in the default run

`cmp_running_pegasus`, `cmp_lifestyle_af1`, `cmp_basketball_search`, `cmp_football_mercurial`, `cmp_apparel_search`.
Product IDs are listed in `src/simulator/catalogue.ts` (e.g. `nk_pegasus_42`, `nk_air_force_1_07`).

## What is NOT provided here (yours or the intelligence stage's)

Approval UI, `PlanApproval` validation, mission orchestration, `ActionExecution`/`ActionOutcome` persistence,
anomaly detection, evidence retrieval, Mubit diagnosis and plan generation.
