<img width="8931" height="3240" alt="Normal — business intelligence and operations" src="https://github.com/user-attachments/assets/80916a0e-baf5-40fa-b5b5-7ccf4f6ab7c3" />

# Normal

**Find the business problem. Check the evidence. Approve the next step. See what happened.**

A small ecommerce business can see that sales have fallen. Finding the reason usually means moving between advertising reports, orders, delivery updates and customer feedback, then deciding what to do with incomplete information.

We built Normal to bring that work into one place. It watches business activity, groups unusual changes into an investigation, uses Mubit to compare possible explanations, and proposes a response that a person can review. Approved actions run through restricted tools. Normal saves the changes and assesses later observations against the plan's success criteria.

Our hackathon demonstration uses an **Nike shop simulation**. The orders, customers, advertising activity and deliveries are synthetic. The model requests, database records, validation checks and recorded changes described below are genuine development/demo results. Nothing here changes a real advertising account, sends a real customer email or takes a real payment.

## Start here

If you have two minutes, follow this evidence trail:

1. **The investigation:** [saved Mubit report](docs/stage5-runs/stage5_1792885194280.json) — five model calls, six verified internal evidence records and no unresolved citations.
2. **The proposed response:** [saved planner output and handoff](docs/stage6-runs/advertising-plan.json) — compare alternatives and inspect the exact campaign, amount, evidence and approval requirement.
3. **The result after approval:** [execution audit](docs/stage7-runs/audit.json) — the budget is read back from MongoDB at 6750 GBP minor units, with an action receipt and callback event.
4. **The browser proof:** [recorded browser results](docs/stage7-runs/browser.json) and [budget-after screenshot](docs/stage7-runs/meta-after.png) — the refreshed campaign table shows £67.50/day.
5. **The later outcome:** [saved assessment](docs/stage8-runs/controlled-observation.json) and [Outcomes screenshot](docs/stage8-runs/outcomes-controlled.png) — a separate isolated simulator run has complete before/after windows, but no observed return improvement and one unmet criterion.

The first four items are connected records. The execution demonstration is an isolated copy of the saved investigation and plan; its [copy manifest](docs/stage7-runs/acceptance.json) names the original run, original plan and source hash. The fifth item follows another isolated copy, with its own approval, execution and later observations. Neither copy claims a new model call.

The updated demo also covers a [shipping response](#another-use-case-delayed-shipping): approved delay notices followed by a factual storefront banner. Its diagnosis is a labelled fixture, so it demonstrates the review and execution path rather than a new live Mubit investigation.

**Evidence snapshot:** the Stage 5–7 artifacts were reviewed against `2436c4b`; the Stage 8 assessment and interface checks are documented in their linked reports from 25 October 2026. Results below belong to those recorded checks. A fresh full regression of this combined version is not established.

## What the demo shows

The main story follows a deteriorating advertising campaign:

| Step | What happens | Where to inspect it |
| --- | --- | --- |
| Detect | Recorded activity produces an advertising incident. Normal compares the affected period with its baseline. | [Investigation artifact](docs/stage5-runs/stage5_1792885194280.json), [detector](src/intelligence/detection/engine.ts) |
| Investigate | The Mubit investigator checks competing explanations and calls read-only evidence tools. The saved report includes citations and uncertainty. | [Investigator controller](src/intelligence/investigator/controller.ts), [report audit](docs/stage5-runs/report-audit-final.json) |
| Plan | Mubit compares a targeted budget reduction, a broader reduction and further investigation without changes. Deterministic checks reject unsupported proposals. | [Planner artifact](docs/stage6-runs/advertising-plan.json), [planner validation](src/planner/validation.ts) |
| Review | A person approves an exact plan version and selected actions. Approval and execution are separate steps. | [Approval/execution screenshot](docs/stage7-runs/approval-execution.png), [approval route](src/app/api/plans/[id]/approve/route.ts) |
| Execute and check | The approved marketing action changes the simulated campaign budget from **£90 to £67.50/day**. Normal reads the result back and records the receipt and event. | [Audit](docs/stage7-runs/audit.json), [browser record](docs/stage7-runs/browser.json), [execution implementation](src/execution/) |
| Assess | Normal compares later campaign observations with the approved plan's criteria and keeps the original receipt separate from the business assessment. | [Stage 8 report](docs/stage8-verification.md), [assessment implementation](src/outcomes/), [Outcomes screenshot](docs/stage8-runs/outcomes-controlled.png) |

The campaign is `cmp_basketball_search`. Its proposed 25% reduction is tied to campaign-specific evidence, including zero attributed orders in the observed window. It is a cautious intervention, not a prediction that revenue will recover.

The advertising run's injected scenario was `ad_fatigue`; the investigator selected a qualified `ad_inefficiency` explanation and retained alternatives. We do not count this as an exact root-cause match or a definitive causal finding. The distinction is visible in the saved report's metrics and hypotheses.

The original Stage 7 advertising run has **0/30 post-action hours**, so its business assessment remains pending. A separate Stage 8 copy of the same saved plan received its own approval, executed the budget change and advanced 30 virtual hours. Its complete windows show spend **£122.31 → £91.92**, CTR **0.60% → 0.49%**, zero attributed orders in both windows and no observed return improvement. The spend and order criteria were met; the CTR criterion was not. This comparison does not establish what caused the CTR change. [Controlled observation](docs/stage8-runs/controlled-observation.json) · [Stage 8 method and limits](docs/stage8-verification.md).

### Another use case: delayed shipping

The shipping demonstration starts from a **labelled test fixture** for a delivery-delay diagnosis. Its reviewed plan orders two actions: send delay notices to the two eligible simulated customers, then publish a factual delivery banner. A person approves the exact plan and action set before execution. The [audit](docs/stage7-runs/audit.json) records both messages in the demo inbox, the banner on the simulated store, adapter receipts and callback events. See the [shipping fixture](docs/stage7-runs/shipping-fixture.json) and [visible banner](docs/stage7-runs/nike-banner.png).

This demonstrates approval, ordered execution and read-back for customer care. The shipping diagnosis was supplied as a fixture; this run did not make a fresh Mubit diagnosis call or send a real customer message. Its [later assessment](docs/stage8-runs/demonstration.json) is pending because there is no linked comparison cohort to measure a shipping or support benefit.

![Recorded simulated campaign state after the approved budget change](docs/stage7-runs/meta-after.png)

## How we use Mubit

Normal uses Mubit as the gateway for its model requests. Monitoring and anomaly detection first build an investigation from the simulated event ledger. A separate investigator worker then sends scoped observations to Mubit; a planner worker sends the validated result and current action targets to Mubit. Normal owns the evidence tools, validation, approval, execution and outcome records. Mubit does not receive hidden simulator scenario labels or authority to change a business account.

| Mubit use | Input and model task | What Normal checks and saves |
| --- | --- | --- |
| Investigate | The [investigator](src/intelligence/investigator/controller.ts) sends observed metrics, anomalies, verified evidence IDs and competing hypotheses. `MUBIT_INVESTIGATOR_MODEL` returns structured reasoning decisions and may request registered read-only evidence tools. | Tool names, parameters and business/run scope are checked locally. Bounded rounds update hypothesis history and keep contradictions; new evidence is verified before reuse. |
| Diagnose | `MUBIT_DIAGNOSIS_MODEL` produces one structured root-cause assessment from the investigation history. | The app validates the schema, cited evidence, uncertainty and report consistency before persisting a diagnosis, seven-section report, brief and **non-executable** handoff. Provider failure or insufficient support yields a provisional or unknown-cause result, not a confident claim. |
| Compare responses | The separate [planner](src/planner/service.ts) sends a completed, non-provisional diagnosis, scoped evidence, current targets and registered action capabilities to `MUBIT_PLANNER_MODEL`. It asks for distinct strategies, including further investigation or no action. | [Deterministic validation](src/planner/validation.ts) checks evidence, target state, parameters, dependencies and safety limits. A person selects and approves an exact plan version before Normal's restricted adapters can act. Planning itself makes no business change. |
| Research public context, when enabled | The [research path](src/intelligence/investigator/research.ts) sends a bounded public topic, geography and time window through Mubit's Gemini endpoint using `MUBIT_RESEARCH_MODEL` and Google Search grounding. | Model-suggested URLs are only discovery candidates. Normal separately retrieves allowed HTTPS pages and checks dates, excerpts and claim support. Public context cannot establish the cause of a synthetic incident. |

The [provider](src/intelligence/investigator/provider.ts) uses Mubit's OpenAI-compatible `/openai/v1/chat/completions` route for reasoning, structured diagnosis and planning, and its native `/gemini/v1beta/models/...:generateContent` route for optional research. See [Mubit's HTTP connection guide](https://docs.mubit.ai/guides/connect-http). The recorded investigation and planning work used `gpt-6-luna`; the research configuration uses `gemini-4-argon`. Set the key and model IDs in the server-side [.env.example](.env.example) variables; never expose `MUBIT_API_KEY` through a `NEXT_PUBLIC_` variable.

| Recorded task | Evidence of actual requests | Result and boundary |
| --- | --- | --- |
| Advertising investigation | Five request IDs in [the saved run](docs/stage5-runs/stage5_1792885194280.json), beginning `mreq_01a1704a2da17a43bcdbc66d3a46f3d2`; **30,477 reported tokens** | Completed, qualified diagnosis; six verified evidence records, four cited records, zero unresolved citations. |
| Checkout investigation | Three request IDs in [the saved checkout run](docs/stage5-runs/s5eval_1792881375759_0_0.json); **11,735 reported tokens** | Completed `discount_failure` diagnosis on held-out seed 11; two evidence records, four citations, zero invalid citations. One scenario result, not a general accuracy score. |
| Advertising strategy generation | `mreq_01a170a09c2c775184fffe17575bd54c`, with earlier attempts preserved in [the planning record](docs/stage6-runs/advertising-plan.json) | A valid targeted proposal was selected. The broader reduction was blocked when its individual targets lacked sufficient support. |
| Checkout strategy generation | Request `mreq_01a170a089347992a28b32b637d4f5a2` in the [checkout planning archive](docs/stage6-runs/checkout-advisory.json) | Mubit compared three advisory strategies for a coupon failure. There is no coupon-repair adapter, so this saved archive has no executable plan or approval handoff. |
| External-source check | Discovery and passage-assessment IDs in [the source acceptance record](docs/stage5-runs/source_acceptance_1792885169199.json) | A narrow Nike employee-note claim was supported; an unsupported Google Ads outage claim was not. This was a separate source check, not causal evidence for the advertising incident. |

Normal keeps a durable call ledger with the Mubit request ID, route, model, reported token use, output or error, prompt version, stable task fingerprint and per-input checksum. This lets a reviewer distinguish repeated tasks from changing case data. Provider errors and ambiguous billable requests are recorded rather than silently replayed. Cost remains unknown without configured rates. See [provider tests](tests/investigator/provider.test.ts) and [investigation validation tests](tests/investigator/validation.test.ts).

To exercise these paths locally, configure `MUBIT_API_KEY` and the relevant model IDs, start `npm run investigator:work` and `npm run planner:work`, then open an eligible investigation. Research is opt-in with `NORMAL_EXTERNAL_RESEARCH_ENABLED=true`. For the hackathon's Mubit-only setup, keep `NORMAL_DIRECT_GEMINI_FALLBACK=false`; enabling that fallback can send research directly to Google after an unambiguous Mubit failure. The saved [Stage 5](docs/stage5-verification.md) and [Stage 6](docs/stage6-verification.md) reports show the actual request history and acceptance limits.

### Adapter training: what the console actually shows

We checked the training path and kept the results, including the failure. These are two separate Mubit tasks:

| Task | Recorded result | What it means |
| --- | --- | --- |
| Existing diagnostic adapter, `ad_lane_0026fbd6`, v1 | Mubit displays **Passed**, with 100% teacher agreement on **nine** test cases. No production request path is linked. | Mubit produced and tested an adapter. This is its own small teacher-agreement check, not proof of better diagnosis. |
| Diagnostic comparison on six new synthetic cases | The available reference matched **6/6** authored primary conclusions; the adapter matched **5/6**. It mistook a tracking problem for checkout failure. | We found a concrete error and did not promote the adapter. The reference was `gemini-3.8-flash`; the original teacher, `gemini-4-argon`, was unavailable. These agent-reviewed counts are not independently adjudicated accuracy. |
| New source-support pilot, `normal.source_support.v1` | **40/40** collection calls completed. The console at **07:22 UTC, 25 October 2026** showed **0 kept, 0 rejected, 40 awaiting review; first training not started**. A separate provider baseline matched **15/24** authored labels. | Collection works; this task has no trained version to compare yet. The 24 held-out cases were excluded from training storage. |

![Mubit diagnostic adapter console showing a passed latest training result and nine teacher-agreement test cases](docs/training/diagnostic-adapter-v1/console/training-result.png)

*Existing diagnostic adapter: the latest training result says Passed. The same console shows no linked production request path. The displayed 100% belongs to Mubit’s nine-case check.*

![Mubit source-support console showing 40 calls, zero kept examples and first training not started](docs/training/source-support-v1/console/recheck-2026-10-25-0722.jpg)

*Rechecked at 07:22 UTC on 25 October 2026: all 40 calls are present, with 40 reviews queued and 3 running. First training has not started; there is no source-support adapter version to test yet. The sidebar’s three adapters belong to the workspace, not to this task.*

![Mubit side-by-side comparison showing the reference identifying a tracking problem while the diagnostic adapter selects checkout failure](docs/training/diagnostic-adapter-v1/console/tracking-artifact.png)

*The comparison preserves an error rather than claiming improvement: normal payments and orders contradict the adapter’s checkout-failure conclusion.*

The [evaluation report](docs/adapter-evaluation-2026-10-25.md) links the frozen cases, actual replies and scored rows. The [training runbook](docs/training-integration.md) links all 64 source-support calls and explains safe resumption and the pending comparison. Run `npm run training:source -- report` to recompute that pilot locally without an API key or new provider calls. **No independent quality improvement, production speedup or cost saving is established.** Local corrections and outcome feedback do not automatically retrain Mubit.

## Evidence you can check

The linked JSON files contain the underlying records; the verification reports explain how they were obtained and what they do not establish.

| Claim | Evidence | What it proves |
| --- | --- | --- |
| The saved advertising report is internally consistent. | [Report audit](docs/stage5-runs/report-audit-final.json) | **13/13 checks passed**, including diagnosis, brief, citations, impact reference, request attribution and a non-executable investigation handoff. This is consistency, not causal truth. |
| Planning does not itself change the business. | [Stage 6 preservation result](docs/stage6-runs/preservation-after.json), [planner tests](tests/planner/validation.test.ts) | Planning created proposals without receipts, notices, banners or budget changes. |
| An approved budget change was persisted and verified. | [Execution audit](docs/stage7-runs/audit.json), [browser results](docs/stage7-runs/browser.json), [before](docs/stage7-runs/meta-before.png) / [after](docs/stage7-runs/meta-after.png) | £90 → £67.50/day, one durable receipt and a verified budget callback; the browser checked the result after refresh. |
| Unsafe or repeated execution is rejected. | [Execution integration tests](tests/execution/integration.test.ts), [Stage 7 report](docs/stage7-verification.md) | Checks cover missing approval, wrong scope/version, changed targets, expired approval, altered parameters, dependencies and duplicate requests. |
| Shipping actions respect their order. | [Shipping fixture](docs/stage7-runs/shipping-fixture.json), [execution audit](docs/stage7-runs/audit.json) | Two demo notices followed by a factual banner, with saved receipts and callbacks. |
| Later results are kept separate from execution success. | [Stage 8 assessment record](docs/stage8-runs/demonstration.json), [controlled observation](docs/stage8-runs/controlled-observation.json) | The original run remains pending; a separate 30-hour run has a completed comparison with no observed return improvement. Neither is a causal effect estimate. |
| The storefront reads persisted product data. | [Browser results](docs/stage7-runs/browser.json), [storefront screenshot](docs/stage7-runs/nike-storefront.png), [browser test](tests/e2e/stage7-partner.spec.ts) | 17 products, 141 local images, decoded catalogue images, filtering, a second detail image and one persisted simulated checkout order. |
| Public-source cards distinguish support from speculation. | [Source records](docs/stage5-runs/source_acceptance_1792885169199.json), [integration browser record](docs/stage5-runs/source-card-integration-browser.json) | Genuine source discovery/retrieval and positive/negative claim checks; the final source-card integration used an explicitly file-backed report fixture. Spontaneous research within a relevant live investigation remains unverified. |
| Existing demonstration data was preserved. | [Stage 7 before](docs/stage7-runs/preservation-before.json) / [after](docs/stage7-runs/preservation-after.json), [verification report](docs/stage7-verification.md) | Hashes match across 39 original collections outside the new isolated acceptance scopes; active selection remained `demo_nike`. |

### Detector evaluation

The [committed detector evaluation](docs/evaluation/detection-evaluation.json) records 15 seeded runs for each scenario, with separate development and held-out groups. This evaluates detection on synthetic activity; it does not measure Mubit diagnosis accuracy or prove performance on a real shop.

| Synthetic scenario | Detected | Opened an investigation-worthy incident |
| --- | ---: | ---: |
| Advertising fatigue | 15/15 | 15/15 |
| Delivery delays | 15/15 | 15/15 |
| Viral demand | 15/15 | 15/15 |
| Promotional checkout failure | 15/15 | 1/15 |
| Negative reviews | 5/15 | 4/15 |

Across the 15 healthy runs, one incident was recorded. Checkout escalation and sparse negative-review detection remain clear weaknesses in this evaluation. The exact seeds, scenario durations and results are included so those limits are inspectable.

### Recorded software checks

| Scope | Recorded result | Source |
| --- | --- | --- |
| Stage 5 source/evidence/card checks | **64/64 focused tests**, plus **1/1** desktop source-card integration test | [Stage 5 verification](docs/stage5-verification.md) |
| Stage 6 planner | **21/21 focused tests**, plus **1/1** desktop planning acceptance | [Stage 6 verification](docs/stage6-verification.md) |
| Stage 7 approval/execution and partner interfaces | **31 focused tests**, plus **1/1** desktop production-build acceptance; no browser page errors | [Stage 7 verification](docs/stage7-verification.md) |
| Contracts | Typechecking and **15/15** examples passed in the Stage 7 verification | [Shared contracts](packages/contracts/README.md), [Stage 7 verification](docs/stage7-verification.md) |
| Stage 7 build/static checks | Production build and TypeScript passed; ESLint had **0 errors and 14 warnings** | [Stage 7 verification](docs/stage7-verification.md) |
| Stage 8 outcome assessment | **27/27 focused tests** and **1/1** desktop acceptance; build and TypeScript passed | [Stage 8 verification](docs/stage8-verification.md) |
| Investigation decision canvas | **4/4** focused desktop checks; TypeScript and build passed | [Canvas verification](docs/investigation-redesign-verification.md) |
| Adapter-training integration | **83/83 focused tests**, TypeScript, production build, focused lint and **15/15** contract examples passed; saved pilot recomputed offline | [Training validation and reproduction](docs/training-integration.md#validation) |
| Full regression | **307/307 across 52 files** is the previous complete baseline. A later run reached **319/320**; a focused repair passed, but the subsequent full rerun was interrupted. A current full-suite pass remains unestablished. | [Full history and limitations](docs/stage5-verification.md#focused-verification-policy-and-latest-results) |

The focused test counts overlap in places and should not be added together. Stage 8 and the revised investigation canvas have no recorded mobile/tablet run or full regression. The canvas report also records a failed global unchanged-data guard while other workers changed monitoring state; it does not claim global preservation.

## Architecture

```mermaid
flowchart LR
    A[Business activity] --> B[Validated event ledger]
    B --> C[Metrics and detection]
    C --> D[Investigation and read-only evidence]
    D --> E[Mubit investigator]
    E --> F[Validated diagnosis with citations]
    F --> G[Mubit solution planner]
    G --> H[Validated proposed plan]
    H --> I[Human approval of exact version]
    I --> J[Restricted execution agents]
    J --> K[Simulated ads, inbox and storefront]
    K --> L[Read-back verification and callback events]
    L --> B
    B --> M
    L --> M[Later observation and outcome assessment]
    M --> N[Human feedback and saved history]
```

### Technologies and where they are used

| Technology | Role in this repository |
| --- | --- |
| **Next.js 16, React 19 and TypeScript** | The [App Router](src/app/) provides the dashboards, simulated storefronts and HTTP API routes. React renders the operator and partner views; TypeScript is used across the app, workers and shared contracts. Versions and scripts are in [package.json](package.json). |
| **Node.js and npm** | Run the web app, the independent monitoring/investigation/planning workers and the repeatable demo scripts. `tsx` runs the TypeScript worker and audit entry points. |
| **MongoDB** | The [MongoDB driver](src/lib/mongodb.ts) connects to Atlas or another replica set. Scoped collections persist the immutable business-event ledger, metric snapshots, monitoring jobs, evidence, Mubit call records, diagnoses, plan versions, approvals, adapter receipts, execution history and outcome assessments. [Unique indexes](src/lib/collections.ts) support idempotency; [transactions](src/intelligence/detection/persistence.ts) commit linked records; [Change Streams](src/intelligence/monitoring/watcher.ts) wake the monitoring worker. See the [collection guide](docs/mongodb.md). |
| **Mubit and `gpt-6-luna`** | The [Mubit gateway](src/intelligence/investigator/provider.ts) routes investigator reasoning, structured diagnosis and solution-planning requests. Normal records request IDs, usage and validation results; the [Mubit section](#how-we-use-mubit) explains the complete workflow and its limits. |
| **Gemini 4 (`gemini-4-argon`) through Mubit** | Optional [public-source research](src/intelligence/investigator/research.ts) calls `https://api.mubit.ai/gemini/v1beta/models/gemini-4-argon:generateContent` with the Mubit key and requests Google Search grounding. The [saved request](docs/stage5-runs/research_1792885024061.json) records `provider: "mubit"`, the Gemini model and that route; it also records when grounding was unavailable. Normal independently checks retrieved sources before using them as context. Direct Google fallback is disabled in the documented Mubit-only setup. |
| **Zod and `@normal/contracts`** | [Shared schemas](packages/contracts/README.md) validate events, evidence, diagnoses, plans and execution records at API, model-output and persistence boundaries. |
| **TypeScript simulator and restricted adapters** | The [seeded digital twin](src/simulator/) generates synthetic shop, advertising, shipping and customer events. [Adapters](src/adapters/) apply only approved budget, delay-notice and banner actions to that twin; the Meta-style account, Nike-style shop and Shopify introduction are demo interfaces rather than live external accounts. |
| **CSS, Tailwind utilities and Lucide** | [Custom CSS](src/app/globals.css) styles the dashboard and partner views; Tailwind utilities support selected components, and [Lucide icons](src/components/normal/InvestigationCanvas.tsx) label controls and states. |
| **Vitest, Playwright and ESLint** | [Vitest](vitest.config.mts) checks contracts, business rules and service integration; [Playwright](playwright.config.ts) checks browser flows; ESLint and TypeScript provide static checks. Recorded results and limits appear above. |

The detector and evidence tools use allowed observations rather than hidden scenario labels; the [data-boundary test](tests/intelligence/leakage.test.ts) checks those module boundaries. The planner can read scoped current target state to validate a proposed action. Saved outcome history and human feedback do not automatically retrain Mubit or change the planner. The [API guide](docs/api.md) and [partner integration guide](docs/partner-integration.md) describe the interfaces; older roadmap sections are historical, while the Stage 5–8 reports record the later implementation.

<details>
<summary>Original product architecture illustration</summary>

This illustration describes the broader product direction. The implemented flow and remaining limits are stated above and below.

<img width="5760" height="3240" alt="Normal product architecture" src="https://github.com/user-attachments/assets/7fe85851-bedc-466a-84c1-6ab2cc665fc5" />

</details>

## Run Normal locally

You need Node.js 22 or newer, npm, MongoDB Atlas or another MongoDB replica set, and a Mubit key with access to the configured models. Transactions and Change Streams need a replica set. The saved JSON reports can be reviewed without a database or provider account.

```sh
npm ci
cp .env.example .env.local
```

Set `MONGODB_URI`, `MONGODB_DB` and `MUBIT_API_KEY` in `.env.local`. Keep credentials out of Git. Start the app:

```sh
npm run dev -- --port 3000
```

In separate terminals, from the same repository, start the workers for the paths you want to exercise:

```sh
npm run monitor:watch
npm run investigator:work
npm run planner:work
```

Open `/dev/simulator` to create a fresh named simulation run, advance its clock and inject a scenario. Use its run ID consistently in dashboard links. `/dev/monitor` shows monitoring progress. Investigations and planning require their workers; queued work will not complete from the web page alone.

The main routes are `/dashboard`, `/dashboard/signals`, `/dashboard/investigations`, `/dashboard/approvals`, `/dashboard/activity` and `/dashboard/outcomes`. The investigation page connects signals, evidence, decisions and outcomes; its details open in side panels. [Canvas example](docs/investigation-redesign/advertising-desktop.png). `/ads` shows the simulated campaign account; `/demo-store` and `/store` show the simulated shop. `/shopify` is a separately labelled synthetic introduction with no live Shopify connection.

### Reproduce or inspect the evidence

For a fresh isolated advertising investigation, the existing script creates a new run without changing active selection, requests Mubit output and writes a report:

```sh
npm run demo:stage5
```

This makes paid/provider-credit model requests and writes a fresh isolated demo scope. Its output includes the run ID and investigation workspace URL. Completion depends on provider availability; a failed provider call must remain a failed/provisional result.

If the recorded acceptance runs are present in your configured database, the following rechecks their saved state without approving, executing or making a model request:

```sh
node --conditions=react-server --import tsx scripts/audit-stage7.ts
node --conditions=react-server --import tsx scripts/stage7-preservation.ts
node --conditions=react-server --import tsx scripts/demo-stage8.ts
```

These scripts refresh local audit reports and Stage 8 assessment records. They do not recreate records from JSON on an empty database; the Stage 8 script evaluates only the saved Stage 7 executions and makes no new model request or business action. To prepare a fresh execution demonstration, see [the Stage 7 procedure](docs/stage7-verification.md); its advertising copy preserves the source plan's expiry and deliberately fails after that plan expires. Use a new eligible plan rather than extending an old approval.

For checks, run:

```sh
npm run contracts:typecheck
npm run contracts:validate
npm run typecheck
npm run lint
npm test -- tests/investigator/provider.test.ts tests/investigator/validation.test.ts tests/planner/validation.test.ts
```

`npm run verify` also runs the full database-backed suite. Use a dedicated test database and allow for the long simulator evaluations. Browser tests use `npm run test:e2e`; live-model and Stage 7 acceptance cases have their own setup and existing-record requirements, documented in the verification reports. They are not a one-command fresh-database replay.

## What is real, simulated, and still unfinished

- **Implemented:** persisted monitoring and evidence, Mubit investigation and planning, exact-version human review, restricted execution, receipts, read-back verification and on-demand observational outcome assessment with separate human feedback.
- **Simulated:** customer activity, ad accounts, campaign effects, orders, delivery activity, inbox messages, purchases and storefront operations. The Shopify introduction is a separate presentation fixture.
- **Public reference material:** cited product information and contextual company sources. These describe the real brand; they do not establish the cause of a simulated business incident. See [data provenance](docs/data-provenance.md). Stage 7's local product-image implementation is documented in [its verification report](docs/stage7-verification.md).
- **Still unfinished:** production identity/roles, an always-on execution recovery worker, causal business-impact evaluation, automatic outcome-driven planning or model training, and a verified correction-to-adapter improvement loop. Provider cost remains unknown because rates are not configured. External research is optional and its combined spontaneous live-investigation acceptance remains unverified.

Action read-back confirms that a budget, message or banner changed as approved. Later assessments compare observed data only when coverage is sufficient; they do not prove that an action caused a business change. Interrupted or ambiguous actions require review; they are not automatically retried. Unsupported actions remain disabled or advisory.

The intended next step is to collect more comparable outcomes and test whether verified corrections improve task-specific models. The saved assessments alone do not establish that improvement.

## Further evidence and project context

- [Stage 4 implementation and historical verification](docs/implementation-report.md)
- [Stage 5 investigation verification and limitations](docs/stage5-verification.md)
- [Stage 6 planning verification](docs/stage6-verification.md)
- [Stage 7 approval/execution verification](docs/stage7-verification.md)
- [Stage 8 outcome verification](docs/stage8-verification.md) and [investigation canvas verification](docs/investigation-redesign-verification.md)
- [Data dictionary](docs/data-dictionary.md) and [simulation state](docs/simulator-state.md)
- [Official Mubit documentation](https://docs.mubit.ai/) and [Night Shift brief and judging criteria](https://luma.com/nightshift-london)
- [Repository contributors](https://github.com/OactoDev/Normal/graphs/contributors)
