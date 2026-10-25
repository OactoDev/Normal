# Mubit training integration and source-support pilot

Current application configuration: **Gemini 4 Argon (`gemini-4-argon`) through Mubit** for all model stages. Model IDs and results below remain those of the historical calls; they are not relabelled as Gemini results.

Recorded 25 October 2026. Scope: the existing production task `normal.source_support.v1`, not the full investigator, root-cause diagnosis or planner.

## What actually ran

- **24 held-out provider calls** through Mubit, the frozen pilot model, reasoning `low`. All returned valid structured assessments. **15/24 (62.5%) agree with the authored rubric**, macro F1 **0.544**. Median latency **1,243 ms**, p95 **2,005 ms**, reported total **7,250 tokens**. Monetary cost is unknown because provider prices are unconfigured.
- **40 separate training-eligible provider calls**, all successful and recorded with full request/answer storage requested. This is automatic **provider distillation**, not supervised ingestion of the local labels. The gateway returning success does not prove that Mubit kept all 40, started training, or produced a passing adapter.
- **Source-support adapter improvement remains unmeasured.** After the user signed in, the console confirmed the exact task `ln_fa0a441a893491aa9e57315c`: 40 calls, 0 kept, 0 rejected, 40 waiting for review, and first training not started. The refreshed observation showed 40 queued and 3 running reviews. This is a Mubit review/training dependency, rather than an authentication blocker. See the [recorded console status](training/source-support-v1/console-status.json) and [captured console page](training/source-support-v1/console/review-queue-latest.png). No provider response is relabelled as an adapter response.

The [frozen manifest](training/source-support-v1/manifest.json), [calls and actual outputs](training/source-support-v1/calls.json), and [machine-readable report](training/source-support-v1/report.json) preserve the evidence. The data set was frozen before the baseline. The [comparison rule](training/source-support-v1/comparison-protocol.json) was frozen after viewing the provider baseline and before any adapter output; this is not a fully preregistered study. No test labels or prompts were changed after seeing results.

## Supported path

Mubit's [first-adapter guide](https://docs.mubit.ai/guides/first-adapter) describes automatic training from kept calls of one task, with a default first-training threshold of 25 kept examples. The console's kept count and task status are authoritative; training must be enabled in the workspace. Its [model-ID guide](https://docs.mubit.ai/guides/model-ids) explicitly says an adapter cannot be invoked by naming it as a model: comparison currently runs in console Try models.

Production and this runner now share `sourceTaskRequest` in `src/intelligence/investigator/source-task.ts`. Instructions, model, schema, output-format name and tool settings match. The production prompt text has not changed. Normal's own fingerprint identifies the protocol locally; it is **not** claimed to equal Mubit's task ID. Variable source IDs and passages remain user input.

The provider supports the documented `x-middleware-record` header. Collection uses `full`; the provider baseline uses `metadata`, so Mubit records no held-out request/answer for training. See the [HTTP guide](https://docs.mubit.ai/guides/connect-http). Try models comparisons are documented as not stored and training nothing. Normal's local `ModelCorrection` records remain local; no undocumented correction endpoint is called.

## Reproduce or resume

Run from the Normal checkout with `.env.local` configured:

```sh
npm run training:source -- prepare
npm run training:source -- baseline
npm run training:source -- collect
npm run training:source -- report
```

These commands reuse completed ledger entries. They do not resubmit the 64 completed calls. `--limit=N` bounds new calls per invocation. The run lock prevents competing runners; pending or ambiguous calls stop resumption, requiring inspection of the original request outcome. Results are written by atomic file replacement. Do not delete the ledger to obtain a second result for the same experiment. A different prompt, model, reasoning setting or dataset requires a new versioned experiment, rather than overwriting this one.

No business database or `demo_nike` run is changed by these commands. Examples are newly authored synthetic public-context passages; no customer or business records are transmitted.

## Complete the adapter comparison

1. Sign in to the correct Mubit workspace. Find the task beginning **“Assess whether each supplied actual source passage…”**, using the frozen pilot model. Match request IDs from `calls.json`, and record Mubit's actual task ID, kept count, training status and version history. Confirm training is enabled. Sending more calls without this information is not a substitute for checking it.
2. Once a version passes and is available, open its **Compare with your provider** action. Pin and record that exact version. Passing Mubit's teacher-agreement test alone does not establish independent correctness improvement.
3. Use all 24 messages from `heldout-inputs.json` in Try models. Submit only each `message`; task instructions are supplied by Mubit. Keep the version fixed, record the actual adapter JSON and errors, and save console evidence. Do not submit `cases-with-labels.json`. If console limits prevent all cases, report an incomplete comparison.
4. Capture an adapter-results JSON document with fields `origin: "mubit_console_try_models"`, `task`, `model`, `fingerprint`, `datasetHash`, `adapterVersionId`, `taskId`, ISO `capturedAt`, `consoleEvidencePaths` (existing local captures), and `results`. Each result needs `caseId`, `inputHash`, the actual structured `output`, and optional measured `latencyMs`, `totalTokens`, `costUsd` or `error`. Missing cost stays unknown. The manifest and held-out input file provide identity fields; they provide no adapter output. These operator-supplied records are explicitly labelled as console observations, not cryptographic provider attestations.
5. Run `npm run training:source -- compare /absolute/path/to/adapter-results.json`. The importer rejects foreign input hashes, duplicate cases, mismatched experiment identity, missing evidence and incomplete pairs. Schema/identity failures count as incorrect; the scorer never drops difficult cases. It saves the raw capture and paired results in `adapter-comparison.json`.

The comparison reports accuracy/rubric agreement, per-class precision/recall/F1, false-supported claims, valid-output rate, and available latency, tokens and cost. The pilot improvement gate requires positive paired accuracy change, a positive lower bound from whole-scene bootstrap resampling, valid adapter output on every case, and no increase in false-supported claims. It never deploys or promotes an adapter automatically. Console timing and gateway timing have different measurement boundaries and must not be presented as a controlled speed comparison.

## Interpretation limits

The 24 test cases represent **six held-out scenes**, with correlated claims. All passages and labels were authored with agent assistance. They have not received independent human adjudication. Wilson intervals in the individual score are descriptive case-wise intervals and ignore scene dependence; the paired bootstrap resamples scenes. Even the latter has limited evidential value with six synthetic scenes.

The provider agreed on all six supported and all six contradictory labels. It matched none of the six `context_only` labels and three of six `insufficient` labels. The context-only/insufficient distinction particularly needs independent review. Treat 62.5% as agreement with this pilot rubric, not a validated production accuracy score. Preserve this experiment; improve/adjudicate the next dataset under a new version instead of relabelling this test after seeing predictions. Training also distils teacher mistakes: the authored labels are not uploaded as corrections.

A full improvement claim needs an independently adjudicated, larger held-out sample of actual eligible source checks, followed by a separate end-to-end investigation evaluation. This pilot does not establish improved root-cause identification, action quality, business outcomes, or savings.

## Validation

TypeScript, focused ESLint and 78 focused Vitest cases passed during the initial integration. A subsequent 21-case provider/training rerun also passed after adding console-status identity validation. The original 78 cases covered provider, training/scoring, source verification, diagnosis validation, report-source composition and Mongo-backed investigator persistence suites. No fresh full regression or production build is claimed. All 64 live Mubit requests completed without an automatic retry.

## Signed-in console follow-up and updated main

The console was inspected after sign-in. The source-support task is still reviewing its 40 calls and has no adapter version; the exact timestamped observation is in `training/source-support-v1/console-status.json`. A separate existing diagnostic adapter was actually run on six new cases. It matched five authored primary conclusions against six for the available reference, with a tracking-versus-checkout regression. This is a different task and reference model, and does not replace the pending 24-case source-support comparison. See [the complete evaluation](adapter-evaluation-2026-10-25.md).

After the checkout fast-forwarded to `c888f3e` (`origin/main`), TypeScript and 25 focused provider/training/outcome-measurement tests passed. Focused ESLint also passed. Outcome feedback in the updated main is stored locally; it does not automatically train Mubit. No full regression, new production build or adapter promotion is claimed.

Historical `report` and `compare` operations use the frozen experiment model/reasoning and include the current live configuration separately. Live inference/collection still rejects configuration drift. The live local model is now Gemini 4 Argon (`gemini-4-argon`); the saved source-support pilot retains its original model identity in the frozen manifest. A guarded collection smoke check refused the mismatch before any call and preserved the ledger. A new-model experiment needs its own versioned dataset/report directory.

## Review-queue diagnosis

A subsequent investigation found all 40 calls usable and an inspected request retained the full expected input and structured reply. Training was enabled, the task was below its 200-call/day review cap, and there was no opt-out, cooldown or displayed daily training limit. Nevertheless, zero review decisions had completed while three reviews remained running. This suggests slow or stalled hosted review processing; the precise worker/lease/judge error cannot be confirmed from the console. No supported review restart action was exposed, and locked judge settings were not changed. A diagnostic packet and unsent support email are in [queue-diagnosis](training/source-support-v1/queue-diagnosis/README.md). Sending the support email is awaiting the user’s explicit instruction.
