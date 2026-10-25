import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import { callModel, promptFingerprint, providerConfig, ProviderError } from "../src/intelligence/investigator/provider";
import { SOURCE_SYSTEM, SOURCE_TASK, sourceTaskRequest } from "../src/intelligence/investigator/source-task";
import { SourceAssessments } from "../src/intelligence/investigator/schemas";
import { checksum, sourceDataset, validateSplit } from "../src/intelligence/training/source-dataset";
import { compare, prediction, score, type ScoredOutput } from "../src/intelligence/training/score";
import { z } from "zod";
import { readConsoleStatus } from "../src/intelligence/training/console-status";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const directory = resolve("docs/training/source-support-v1");
const cases = sourceDataset();
validateSplit(cases);
// Inspecting a frozen experiment does not need credentials or a network request.
const model = process.env.MUBIT_INVESTIGATOR_MODEL || "gpt-6-luna";
const reasoning = z.enum(["low", "medium", "high"]).parse(process.env.MUBIT_REASONING_DEPTH || "low");
const request = sourceTaskRequest(model, cases[0].input);
const fingerprint = promptFingerprint(request, SOURCE_TASK, "1.0.1");
const datasetHash = checksum(cases);
const manifest = { version: 1, task: SOURCE_TASK, promptVersion: "1.0.1", model, fingerprint, datasetHash,
  reasoning, trainCases: 40, testCases: 24,
  protocol: "Source-scene grouped synthetic pilot; provider distillation, no correction-label ingestion. Test calls use x-middleware-record: metadata. No test output is uploaded for training. No parameter tuning on this test.",
  comparisonRule: "Positive paired accuracy delta, lower whole-scene bootstrap bound above zero, all adapter responses valid, no increase in false-supported claims. Preserve the original provider baseline and pinned adapter version.",
  limitations: ["Labels and passages authored with agent assistance, not independently human adjudicated.", "Only source-support classification is tested; no claim about full investigator accuracy.", "Related claim variants share a passage within a split; 24 cases comprise six held-out scenes, not 24 independent incidents. Case-wise Wilson intervals are descriptive and ignore clustering; paired comparison resamples whole scenes.", "Mubit console kept-example counts and adapter history are authoritative; a successful request does not confirm training.", "Unknown monetary rates remain null."] };
interface Entry extends ScoredOutput {
  phase: "baseline" | "collect"; inputHash: string; fingerprint: string; datasetHash: string;
  status: "pending" | "completed" | "failed"; startedAt: string; completedAt?: string;
  requestId?: string | null; providerRequestId?: string | null; ambiguous?: boolean; agreesWithAuthoredLabel?: boolean;
  recording: "full" | "metadata";
}
function save(path: string, data: unknown) {
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
  renameSync(temporary, path);
}
const EntrySchema = z.object({
  caseId: z.string(), phase: z.enum(["baseline", "collect"]), inputHash: z.string(), fingerprint: z.string(), datasetHash: z.string(),
  status: z.enum(["pending", "completed", "failed"]), startedAt: z.string().datetime(), completedAt: z.string().datetime().optional(),
  requestId: z.string().nullable().optional(), providerRequestId: z.string().nullable().optional(), ambiguous: z.boolean().optional(),
  agreesWithAuthoredLabel: z.boolean().optional(), recording: z.enum(["full", "metadata"]), output: z.unknown().optional(), error: z.string().optional(),
  latencyMs: z.number().finite().nonnegative().optional(), totalTokens: z.number().finite().int().nonnegative().nullable().optional(), costUsd: z.number().finite().nonnegative().nullable().optional(),
}).strict();
function readEntries(): Entry[] {
  if (!existsSync(`${directory}/calls.json`)) return [];
  const entries = z.array(EntrySchema).parse(JSON.parse(readFileSync(`${directory}/calls.json`, "utf8")));
  const seen = new Set<string>();
  for (const entry of entries) {
    const row = cases.find((c) => c.caseId === entry.caseId), key = `${entry.phase}:${entry.caseId}`;
    if (seen.has(key)) throw new Error("duplicate_ledger_entry");
    seen.add(key);
    if (!row || entry.phase !== (row.split === "train" ? "collect" : "baseline") || entry.recording !== (row.split === "train" ? "full" : "metadata")
      || entry.datasetHash !== datasetHash || entry.fingerprint !== fingerprint || entry.inputHash !== checksum(row.input)) throw new Error("ledger_identity_mismatch");
    if (entry.status === "completed" && (!entry.completedAt || !entry.requestId || entry.output === undefined)) throw new Error("incomplete_completed_entry");
  }
  return entries;
}
function prepare() {
  mkdirSync(directory, { recursive: true });
  readEntries(); // Reject a mismatched ledger before replacing any local evidence.
  if (existsSync(`${directory}/manifest.json`)) {
    const old = JSON.parse(readFileSync(`${directory}/manifest.json`, "utf8"));
    if (old.datasetHash !== datasetHash || old.fingerprint !== fingerprint || old.model !== model || old.reasoning !== manifest.reasoning) throw new Error("Frozen experiment differs; use a new versioned experiment directory.");
  } else save(`${directory}/manifest.json`, { ...manifest, frozenAt: new Date().toISOString() });
  if (existsSync(`${directory}/comparison-protocol.json`)) {
    const protocol = JSON.parse(readFileSync(`${directory}/comparison-protocol.json`, "utf8"));
    if (protocol.datasetHash !== datasetHash || protocol.fingerprint !== fingerprint || protocol.rule !== manifest.comparisonRule) throw new Error("frozen_comparison_protocol_mismatch");
  } else save(`${directory}/comparison-protocol.json`, {
    frozenAt: new Date().toISOString(), datasetHash, fingerprint, rule: manifest.comparisonRule,
    baselineAlreadyObserved: readEntries().some((e) => e.phase === "baseline" && e.status === "completed"),
    note: "Comparison rule frozen before observing any adapter outputs. Provider baseline had already been observed; this is not a fully preregistered study.",
  });
  save(`${directory}/cases-with-labels.json`, cases);
  save(`${directory}/heldout-inputs.json`, cases.filter((c) => c.split === "test").map(({ caseId, input }) => ({ caseId, inputHash: checksum(input), message: JSON.stringify(input) })));
}
function report() {
  const entries = readEntries();
  const baseline = entries.filter((e) => e.phase === "baseline");
  const collected = entries.filter((e) => e.phase === "collect");
  const statusPath = `${directory}/console-status.json`;
  const consoleStatus = existsSync(statusPath) ? readConsoleStatus(JSON.parse(readFileSync(statusPath, "utf8")), { model, datasetHash, fingerprint }) : null;
  if (consoleStatus?.evidencePaths.some((path) => !existsSync(path))) throw new Error("missing_console_status_evidence");
  const comparisonPath = `${directory}/adapter-comparison.json`;
  const adapterComparison = existsSync(comparisonPath) ? JSON.parse(readFileSync(comparisonPath, "utf8")) : null;
  if (adapterComparison && (adapterComparison.datasetHash !== datasetHash || adapterComparison.fingerprint !== fingerprint || adapterComparison.model !== model)) throw new Error("saved_comparison_identity_mismatch");
  const result = { generatedAt: new Date().toISOString(), task: SOURCE_TASK, model, datasetHash, fingerprint,
    baseline: score(cases.filter((c) => c.split === "test"), baseline),
    collection: { attempted: collected.length, successful: collected.filter((e) => e.status === "completed").length,
      teacherAgreement: score(cases.filter((c) => c.split === "train"), collected),
      keptExamples: consoleStatus?.keptExamples ?? null, trainingStatus: consoleStatus?.trainingStatus ?? "unverified_console_required", adapterVersion: consoleStatus?.adapterVersionId ?? null,
      consoleObservation: consoleStatus },
    comparison: adapterComparison ? { status: "complete_console_observed", improved: adapterComparison.comparison.improvedInPilot, adapterVersionId: adapterComparison.adapterVersionId,
      accuracyDelta: adapterComparison.comparison.accuracyDelta, sceneBootstrap95: adapterComparison.comparison.sceneBootstrap95 }
      : { status: consoleStatus && !consoleStatus.firstTrainingStarted ? "waiting_for_first_training" : "blocked_until_actual_adapter_outputs", improved: null,
        reason: consoleStatus && !consoleStatus.firstTrainingStarted ? `Console observation at ${consoleStatus.observedAt}: ${consoleStatus.keptExamples} kept, ${consoleStatus.waitingForReview} waiting for review; first training has not started. No adapter exists for this task to evaluate.`
          : "Mubit exposes adapter comparison through console Try models, not a documented adapter inference model ID. No provider response is labelled as an adapter response." },
    limitations: manifest.limitations };
  save(`${directory}/report.json`, result);
  console.log(JSON.stringify({ baseline: { attempted: result.baseline.attempted, correct: result.baseline.correct, total: result.baseline.total, accuracy: result.baseline.accuracy, macroF1: result.baseline.macroF1 }, collection: { successful: result.collection.successful, attempted: result.collection.attempted }, comparison: result.comparison }));
}
async function run(phase: "baseline" | "collect") {
  providerConfig(); // Reject missing credentials before creating a pending billable entry.
  prepare();
  const lockPath = `${directory}/run.lock`;
  writeFileSync(lockPath, String(process.pid), { flag: "wx", mode: 0o600 });
  try {
    const entries = readEntries();
    const split = phase === "collect" ? "train" : "test";
    const limitArg = process.argv.find((a) => a.startsWith("--limit="));
    const limit = limitArg ? Number(limitArg.split("=")[1]) : phase === "collect" ? 40 : 24;
    if (!Number.isInteger(limit) || limit < 1 || limit > 40) throw new Error("limit must be an integer from 1 to 40");
    let sent = 0;
    for (const row of cases.filter((c) => c.split === split)) {
      const old = entries.find((e) => e.phase === phase && e.caseId === row.caseId);
      if (old) {
        if (old.datasetHash !== datasetHash || old.fingerprint !== fingerprint || old.inputHash !== checksum(row.input)) throw new Error("result_identity_mismatch");
        if (old.status !== "completed" || old.ambiguous) throw new Error(`Outcome of ${row.caseId} needs review; inspect its gateway record before deciding whether to retry. No automatic replay.`);
        continue;
      }
      if (sent >= limit) break;
      const entry: Entry = { caseId: row.caseId, phase, inputHash: checksum(row.input), fingerprint, datasetHash,
        recording: phase === "collect" ? "full" : "metadata", status: "pending", startedAt: new Date().toISOString() };
      entries.push(entry); save(`${directory}/calls.json`, entries); // checkpoint before billing
      try {
        const result = await callModel(sourceTaskRequest(model, row.input, entry.recording));
        const output = SourceAssessments.parse(result.value);
        prediction(row, output); // unknown, omitted or repeated source IDs fail closed
        Object.assign(entry, { status: "completed", output, requestId: result.metadata.requestId, providerRequestId: result.metadata.providerRequestId,
          latencyMs: result.metadata.latencyMs, totalTokens: result.metadata.totalTokens, costUsd: result.metadata.estimatedCostUsd,
          agreesWithAuthoredLabel: prediction(row, output) === row.expected });
      } catch (error) {
        Object.assign(entry, { status: "failed", error: error instanceof ProviderError ? error.code : "invalid_response", ambiguous: error instanceof ProviderError ? error.ambiguous : true,
          requestId: error instanceof ProviderError ? error.metadata.requestId : null });
      }
      entry.completedAt = new Date().toISOString(); save(`${directory}/calls.json`, entries);
      console.log(JSON.stringify({ phase, caseId: row.caseId, status: entry.status, requestId: entry.requestId, agreesWithAuthoredLabel: entry.agreesWithAuthoredLabel, completed: ++sent }));
      if (entry.status === "failed") { report(); throw new Error("Stopped after provider/schema failure; inspect recorded outcome before continuing."); }
    }
    report();
  } finally { unlinkSync(lockPath); }
}
async function main() {
  const command = process.argv[2] || "prepare";
  if (command === "prepare") { prepare(); console.log(JSON.stringify({ ...manifest, directory, instructions: SOURCE_SYSTEM })); }
  else if (command === "baseline" || command === "collect") await run(command);
  else if (command === "report") { prepare(); report(); }
  else if (command === "compare") {
    prepare();
    const file = process.argv[3];
    if (!file) throw new Error("compare requires a console-observed adapter results JSON file");
    const imported = z.object({ origin: z.literal("mubit_console_try_models"), task: z.literal(SOURCE_TASK), model: z.string(), fingerprint: z.string(), datasetHash: z.string(),
      adapterVersionId: z.string().min(1), taskId: z.string().min(1), capturedAt: z.string().datetime(),
      consoleEvidencePaths: z.array(z.string().min(1)).min(1),
      results: z.array(z.object({ caseId: z.string(), inputHash: z.string(), output: z.unknown(), latencyMs: z.number().finite().nonnegative().optional(), totalTokens: z.number().finite().int().nonnegative().nullable().optional(), costUsd: z.number().finite().nonnegative().nullable().optional(), error: z.string().optional() }).strict()),
    }).strict().parse(JSON.parse(readFileSync(file, "utf8")));
    if (imported.model !== model || imported.fingerprint !== fingerprint || imported.datasetHash !== datasetHash) throw new Error("adapter_experiment_identity_mismatch");
    if (imported.consoleEvidencePaths.some((path) => !existsSync(path))) throw new Error("missing_console_evidence");
    const heldout = cases.filter((c) => c.split === "test");
    for (const row of imported.results) {
      const original = heldout.find((c) => c.caseId === row.caseId);
      if (!original || checksum(original.input) !== row.inputHash) throw new Error("adapter_input_identity_mismatch");
    }
    const baseline = readEntries().filter((e) => e.phase === "baseline");
    if (baseline.some((e) => e.status === "pending" || e.ambiguous)) throw new Error("baseline_outcome_unresolved");
    const result = compare(heldout, baseline, imported.results);
    save(`${directory}/adapter-comparison.json`, { ...imported, comparison: result,
      provenance: "Console-observed outputs supplied by the operator; local files and screenshots are evidence, not cryptographic provider attestation.", limitations: manifest.limitations });
    console.log(JSON.stringify({ adapterVersion: imported.adapterVersionId, accuracyDelta: result.accuracyDelta, improvedInPilot: result.improvedInPilot, interval: result.sceneBootstrap95 }));
    report();
  } else throw new Error("Usage: training:source -- prepare|baseline|collect|report|compare [adapter-results.json] [--limit=N]");
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "training_run_failed"); process.exitCode = 1; });
