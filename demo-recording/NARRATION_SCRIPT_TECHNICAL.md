# Normal execution engine: technical talk track

Follows the scenes of Normal_Demo_Silent.mp4 (2:16). Read in full this runs about 5 minutes, so pause the video at each scene, or let it loop while you talk. Every claim below was checked against the code in `src/` or the test suites.

## Scene 1 [0:00] Intro: where this module sits

"Normal has two halves. The intelligence half simulates telemetry, detects anomalies, and uses Mubit to produce a diagnosis and a structured plan called a PlanHandoff: the plan, the diagnosis, and the evidence behind it. My half starts at that handoff. It's a Next.js 15 app with a React Flow dashboard, and every object that crosses the boundary is validated against Zod schemas in `src/contracts.ts`: PlanHandoff, ProposedPlan, ActionProposal, PlanApproval, AgentMission, ActionExecution and ActionOutcome. I don't invent my own JSON shapes. The principle for the whole design is that a model can suggest, but only validated, approved, allowlisted code can act."

## Scene 2 [0:17] Plan review

"This is the plan as the owner sees it. The graph is built from the plan itself: each node is an ActionProposal, and each edge comes from `dependsOnActionIds`; actions with no dependencies hang off the diagnosis node. A node shows the assigned agent, the risk level, the rationale, and for the ad action, the previous and proposed budget, read live from the simulated ads platform. Clicking a node opens the evidence IDs it cites, and for the email action, the approved template preview. Selecting a node is not approval. That's an explicit second step."

## Scene 3 [0:45] Before state

"Here's the baseline in the simulators. Campaign A is at fifty pounds a day, stored as 5000 minor units in a CSV-backed collection. The ads simulator runs in fifteen-minute ticks, and each tick spends the floor of the daily budget divided by ninety-six, so 52 pence now. It re-reads the campaign record on every tick, which matters later: changing the budget changes future simulated spend, not just a label on screen. The store has no banner record yet. The clicks and conversions shown are modelled estimates, not measured gains."

## Scene 4 [0:57] Approval: the checks

"When the owner approves, the backend validates, independently of the UI. First, the principal: the demo identity arrives in an `x-normal-principal` header, and only the owner role may approve, only for its own business, and only for the three MVP action types. The viewer role is read-only. That header is a demo identity mechanism, not production authentication.

Then the plan: evidence must belong to the same business; the plan must not be expired or rejected; the submitted plan version must equal the current version; action IDs must exist and be unique; and the decision must match the selection, so 'approve all' requires every action. The dependency graph is checked for duplicate IDs, missing dependencies and cycles.

Then per-action policy. Parameters are parsed with strict Zod schemas, so unknown fields are rejected. Each action type must be assigned to its own agent. A budget change must match the campaign's currency, stay under a configured daily cap, and move by no more than sixty percent. A banner must expire in the future within a fourteen-day window. An email action allows at most twenty-five recipients.

The approval record itself expires after thirty minutes, capped at the plan's own expiry, and a newer decision supersedes older ones. At execute time, all of this is checked again, plus that the same principal who approved is the one executing. Execution returns 202 and runs in the background."

## Scene 5 [1:11] Mission Control: orchestration

"The orchestrator creates one AgentMission per specialist, keyed by plan, version and agent. Each approved action becomes an ActionExecution claimed under a stable idempotency key like `plan_001:v1:act_ads_001`. The claim is atomic, so two simultaneous execute requests produce exactly one execution per action. A drain loop runs every ready action concurrently. An action is ready only when every dependency was approved and has succeeded; if a dependency fails or wasn't approved, its dependents are cancelled, not run. In this plan nothing depends on anything, so all three run in parallel.

Tools are an allowlist: a registry maps each action type to one agent, one tool and one verifier. If the type or agent doesn't match, it's rejected with an agent-scope error. Transient, retryable errors get up to three attempts with exponential backoff, and for the budget change the original before-value is preserved across retries. Email sends are never retried automatically.

Where the model fits: the budget change and the banner are deterministic code with no LLM. The only model call is the Customer Care agent drafting one paragraph inside a fixed email template, routed through Mubit. The template, the recipient list and the sending are deterministic, and the recipient is always the configured controlled test inbox, never a customer address."

## Scene 6 [1:31] Verified results

"An action is only marked succeeded after a read-back. For the budget, I re-read the campaign and compare the stored amount and currency. For the banner, I re-read the stored config and check it's active, the message and window match, and it hasn't expired. If a read-back doesn't confirm the change, the action fails with a verification error instead of passing.

Email is handled per recipient. Before sending, each message is claimed in a ledger under a key built from the action key and the order ID, with status 'sending'. If a record is stuck in 'sending' or 'ambiguous', the system refuses to resend until it's reconciled, because the provider may already have sent it. The Resend idempotency key is a hash of that key plus the subject and body. The provider's operation ID is stored. A background monitor re-checks Resend's last event every ten seconds for up to thirty minutes and promotes accepted messages to delivered. So 'delivered' here means the provider reported delivery. It does not mean the recipient opened it, and I haven't treated it as such.

Every execution produces an ActionExecution, an ActionOutcome and an audit log line, and emits business events like `campaign.budget_updated`, `storefront.banner_published` and one `customer.message_sent` per message, which is what the intelligence pipeline ingests."

## Scene 7 [1:49] After state: proof in the running systems

"Back in the simulators: Campaign A now reads thirty pounds, with an audited change from 5000 to 3000 minor units. The next tick spends 31 pence instead of 52, because the tick re-reads the persisted campaign. The store page polls the banner configuration and now shows the notice. Both are separate pages reading the same stored state, not the dashboard's memory."

## Scene 8 [2:03] Close: persistence, tests, limits

"State is stored as one CSV file per collection with a key and a JSON column, validated by Zod on read and write. Writes take an exclusive per-table file lock and an atomic rename, so claims and compare-and-set are safe across processes. Restarting the app preserves plans, approvals, executions, outcomes, campaigns and banners.

It's covered by automated tests: contract validation, the orchestrator suite with 24 checks, and an acceptance suite that tests concurrent duplicate requests, recovery from CSV in a fresh process, cross-process claims with exactly one winner, dependency ordering, bounded retries, an unverified write never being marked successful, and a superseded approval being unable to execute.

Honest limits: the principal header is demo identity, not real auth. CSV with file locks assumes a local shared filesystem; it isn't a transactional database or a durable queue, so a crash mid-run needs manual reconciliation rather than blind resending. The live handoff from the intelligence service is not connected yet; plans come from a stored mock until `INTELLIGENCE_API_URL` is set."

---

## Likely technical questions

- **Why CSV and not a database?** The team had no MongoDB available, so a file-backed store with locks and atomic renames gives persistence and safe claims for the demo. The Repo interface is small, so a database can replace it.
- **What stops a duplicate email?** The atomic per-action claim, the per-recipient ledger claim before sending, no automatic retry for email, a block on ambiguous sends, and a content-bound provider idempotency key.
- **Can the LLM trigger an action?** No. It only drafts one paragraph. Actions come from the approved plan and run through the allowlisted registry after policy checks.
- **How do you know a change really happened?** The verifier reads the state back from the store the simulator itself uses, and the ads tick demonstrably spends the new amount.
- **What if two people approve at once?** The newest approval becomes the head for that plan version and supersedes the earlier one, and changing approval during a run is blocked.
- **Is it production ready?** No. It's a demo-grade engine with the right guarantees: approval enforcement, idempotency and verification. Real auth, a real database and a durable queue are the next steps.
