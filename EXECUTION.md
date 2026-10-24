# Normal execution engine — Nike simulation

## Run locally

```
npm install
npm run dev
```

Set `NORMAL_DATA_DIR=./data` and `NORMAL_STORE=csv` (CSV is the default outside tests).
Set `EMAIL_TEST_RECIPIENT` to your controlled inbox. With `RESEND_API_KEY`, messages use Resend; otherwise Ethereal SMTP provides preview links. `EMAIL_PROVIDER=memory` is **test-only**, never evidence of real delivery. No credentials belong in source control.

Open `/`, review `plan_001`, inspect evidence and approve. Execute in Mission Control. Results contain the provider operation IDs, read-backs and audit logs. `/store` is the working simulated Nike store, polling banner configuration. `/ads` reads persisted campaigns and provides a 15-minute tick button. Each active tick spends `floor(dailyBudgetMinor / 96)`; changing £50 → £30 changes future spend from 52 → 31 minor units. Clicks/conversions are modeled, not claims of real efficiency improvement.

The system contains one deterministic orchestrator and three allowlisted MVP specialists. Customer Experience uses canonical agent ID `customer_care`; the existing `nova_store` business ID remains the demo tenant for compatibility with the intelligence developer. Marketing pause actions and storefront discount creation are not enabled by the shared action contracts. Inventory, Reputation and Growth are explicitly Phase 2 roles, not executing tools.

## Integration ownership

This module owns `/api/plans/[id]/{approve,execute,executions}`. GET `/api/plans/[id]` serves canonical `PlanHandoff`. Intelligence can `await orchestrator.saveHandoff(handoff)` or expose a canonical GET API configured via `INTELLIGENCE_API_URL`. Coordinate that base URL with its owner; never point it back at this same proxy. Edited actions require a new `planVersion`. No shared contract changes are required.

Approval and execution require `x-normal-principal: merchant_owner_01`; `ops_viewer` is read-only. This header is a **demo identity mechanism**, not production authentication.

```
POST /api/plans/plan_001/approve
{"planVersion":1,"decision":"approved","approvedActionIds":["act_ads_001","act_email_001","act_banner_001"]}

POST /api/plans/plan_001/execute
{"approvalId":"<returned approval ID>"}
```

Execution returns 202 and runs via Next's `after`. Poll GET `/api/plans/:id/executions` for missions, executions, outcomes, details, logs, and the recipient ledger. This is also the intelligence pipeline's results API. Repeated execution skips successes; safe failures can be retried with `actionIds`. Emails with uncertain side effects are blocked pending provider reconciliation. Accepted email means accepted, not delivered or read. No replies are fabricated.

## Persistence and operational limits

Each collection is an RFC-style quoted CSV file (`key,json`) in `NORMAL_DATA_DIR`. Every record is parsed against its Zod schema on reads/writes. CSV files include customer/test-message content; keep the directory private and backed up. Do not commit it. Restarting the application preserves plans, approvals, execution records, outcomes, campaigns and banners.

Writes use an exclusive per-table filesystem lock plus atomic rename, including claims and compare-and-set. Use a **local shared filesystem**, not independently deployed serverless filesystems. A crashed writer can leave a `.lock`: stop all writers, inspect/reconcile any ambiguous sends, then remove only the confirmed stale lock. No automatic stale-lock stealing is performed. Multi-table updates are not database transactions; do not manually edit live files. Background work is not a durable distributed queue: a process crash can leave running work needing manual reconciliation, not blind resending.

## Verification

```
npx tsc --noEmit
npm run test:contracts
npm run test:orchestrator
npm run test:execution
npm run test:intelligence
npm run build
```

`test:execution` uses a new isolated CSV directory and test-only email transport. It tests concurrent duplicate requests, actual CSV restart recovery in a fresh process, cross-process atomic claims, budget-aware future ticks, dependency ordering, bounded retries, verification failure, and superseded approvals. `test:orchestrator` covers expiry, principal/business isolation, partial approval, unsupported actions, limits and recipient retry safety.

Real SMTP/Resend delivery requires network access and a controlled inbox; inspect the actual provider ID and preview/inbox separately. The tests do not claim delivery to a real inbox.
