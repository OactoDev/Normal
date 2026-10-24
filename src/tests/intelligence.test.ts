import { telemetrySimulator } from "../intelligence/telemetry-simulator";
import { anomalyDetector } from "../intelligence/anomaly-detector";
import { evidenceCollector } from "../intelligence/evidence-collector";
import { DIAGNOSIS_INSTRUCTIONS, mubitDiagnoser } from "../intelligence/mubit-diagnoser";
import { planGenerator } from "../intelligence/plan-generator";
import { feedbackPipeline } from "../intelligence/feedback-pipeline";
import { benchmarkEvaluator } from "../intelligence/benchmark-evaluator";
import { orchestrator } from "../agents/orchestrator";

async function runIntelligenceTests() {
  // Corrections persist through the store: keep this run's records out of the local demo's data directory.
  process.env.NORMAL_STORE ??= "memory";
  console.log("=== Testing Normal Intelligence & Diagnosis System ===");

  // 1. Telemetry Simulation
  console.log("1. Injecting 'delivery_delays' scenario into simulator...");
  const simState = await telemetrySimulator.injectScenario("delivery_delays", 0.85);
  console.log(` - Generated ${simState.events.length} initial events`);
  console.log(` - Active scenario: ${simState.run.activeScenario}`);
  if (simState.events.length < 5) {
    throw new Error("Expected at least 5 events generated from scenario");
  }
  console.log("✅ Telemetry simulation verified.");

  // 2. Anomaly Detection
  console.log("2. Running Anomaly Detector on business events...");
  const detection = anomalyDetector.analyzeEvents(simState.events);
  console.log(` - Metric snapshots created: ${detection.snapshots.length}`);
  console.log(` - Anomalies flagged: ${detection.anomalies.length}`);
  const hasDeliveryAnomaly = detection.anomalies.some((a) => a.metric === "late_delivery_rate");
  if (!hasDeliveryAnomaly) {
    throw new Error("Expected late_delivery_rate anomaly to be detected");
  }
  console.log("✅ Anomaly detection verified.");

  // 3. Evidence Assembly
  console.log("3. Collecting structured evidence...");
  const packet = evidenceCollector.assembleInvestigation(detection.anomalies, simState.events);
  console.log(` - Investigation ID: ${packet.investigation.investigationId}`);
  console.log(` - Evidence count: ${packet.evidence.length}`);
  console.log(` - Sample fact: "${packet.evidence[0].observedFact}"`);
  if (packet.evidence.length === 0) {
    throw new Error("Expected at least 1 evidence item");
  }
  console.log("✅ Evidence assembly verified.");

  // 4. Mubit AI Diagnosis
  console.log("4. Running AI Diagnosis via Mubit proxy...");
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.MUBIT_API_KEY;
  let diagnosisResult;
  const sentBodies: any[] = [];
  const recordDiagnosisCalls = () => {
    const inner = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      if (String(url).endsWith("/chat/completions")) sentBodies.push(JSON.parse(String(init?.body)));
      return inner(url, init);
    };
  };
  try {
    if (!originalKey) {
      console.log(" - Mubit HTTP is mocked for this contract test; run with MUBIT_API_KEY for live AI.");
      process.env.MUBIT_API_KEY = "test-placeholder";
      globalThis.fetch = async (url, init) => {
        if (String(url).endsWith("/chat/completions")) return Response.json({ model: "mock-diagnosis-model", choices: [{ message: { content: JSON.stringify({ primaryCause: "delivery_delays", supportedHypotheses: [{ cause: "delivery_delays", confidence: .9, rationale: "Synthetic provider response for the diagnosis contract test.", evidenceIds: packet.evidence.filter(item => item.evidenceId.includes("ship")).map(item => item.evidenceId) }], missingEvidence: [] }) }, finish_reason: "stop" }], usage: { prompt_tokens: 100, completion_tokens: 50 } }, { headers: { "x-middleware-request-id": "mreq_00000000000000000000000000000001" } });
        return originalFetch(url, init);
      };
    }
    recordDiagnosisCalls();
    diagnosisResult = await mubitDiagnoser.diagnose(packet.investigation, packet.evidence);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.MUBIT_API_KEY; else process.env.MUBIT_API_KEY = originalKey;
  }
  if (!/^mreq_[a-f0-9]{32}$/i.test(diagnosisResult.modelCall.mubitRequestId || "")) throw new Error("Expected a Mubit request ID from the provider response");
  console.log(` - Model used: ${diagnosisResult.modelCall.providerModel}`);
  console.log(` - Primary root cause: ${diagnosisResult.diagnosis.output.primaryCause}`);
  console.log(` - Mubit trace ID: ${diagnosisResult.modelCall.mubitRequestId}`);
  console.log(` - Latency: ${diagnosisResult.modelCall.latencyMs}ms`);
  if (!diagnosisResult.diagnosis.output.primaryCause) {
    throw new Error("Expected a primary root cause");
  }
  console.log("✅ Diagnosis contract and provider attribution verified.");

  // 5. Recovery Plan Generation
  console.log("5. Generating Recovery Plan...");
  const handoff = await planGenerator.generatePlan(diagnosisResult.diagnosis, packet.evidence);
  console.log(` - Plan ID: ${handoff.plan.planId}`);
  console.log(` - Objective: "${handoff.plan.objective}"`);
  console.log(` - Proposed actions: ${handoff.plan.actions.length}`);
  const registered = await orchestrator.getHandoff(handoff.plan.planId);
  if (!registered) {
    throw new Error("Expected plan to be registered in orchestrator");
  }
  console.log("✅ Recovery plan generation & orchestrator handoff verified.");

  // 6. Merchant correction -> labelled example in the next Mubit call of the same task
  console.log("6. Saving a merchant correction and sending it with the next diagnosis...");
  const fetchBeforeCorrection = globalThis.fetch;
  let correctionRecord;
  try {
    globalThis.fetch = async () => { throw new Error("Mubit has no feedback API: saving a correction must not call the network"); };
    correctionRecord = await feedbackPipeline.submitCorrection({
      investigationId: packet.investigation.investigationId,
      diagnosisId: diagnosisResult.diagnosis.diagnosisId,
      modelCallId: diagnosisResult.modelCall.modelCallId,
      mubitRequestId: diagnosisResult.modelCall.mubitRequestId,
      predictedCause: diagnosisResult.diagnosis.output.primaryCause,
      correctedCause: "delivery_delays",
      correctedEvidenceIds: packet.evidence.map((e) => e.evidenceId),
      evidence: packet.evidence,
      note: "Carrier SLA delivery delays breached 48h.",
    });
  } finally {
    globalThis.fetch = fetchBeforeCorrection;
  }
  if (correctionRecord.correction.ingestionStatus !== "local_only") throw new Error("A correction is a local record until it is sent inside a diagnosis call");
  if (correctionRecord.examples.some((example: any) => "evidenceId" in example)) throw new Error("Correction examples must not carry citable evidence IDs");
  const examples = await feedbackPipeline.examplesForDiagnosis();
  if (examples[0]?.correction.correctionId !== correctionRecord.correction.correctionId) throw new Error("Expected the new correction to be used by the next diagnosis");
  let correctedResult;
  try {
    if (!originalKey) {
      process.env.MUBIT_API_KEY = "test-placeholder";
      globalThis.fetch = async (url, init) => {
        if (String(url).endsWith("/chat/completions")) return Response.json({ model: "mock-diagnosis-model", choices: [{ message: { content: JSON.stringify({ primaryCause: "delivery_delays", supportedHypotheses: [{ cause: "delivery_delays", confidence: .95, rationale: "Matches the merchant-verified correction.", evidenceIds: packet.evidence.filter(item => item.evidenceId.includes("ship")).map(item => item.evidenceId) }], missingEvidence: [] }) }, finish_reason: "stop" }], usage: { prompt_tokens: 150, completion_tokens: 50 } }, { headers: { "x-middleware-request-id": "mreq_00000000000000000000000000000002" } });
        return originalFetch(url, init);
      };
    }
    recordDiagnosisCalls();
    correctedResult = await mubitDiagnoser.diagnose(packet.investigation, packet.evidence, examples);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.MUBIT_API_KEY; else process.env.MUBIT_API_KEY = originalKey;
  }
  const [firstCall, correctedCall] = sentBodies;
  if (firstCall.messages[0].content !== DIAGNOSIS_INSTRUCTIONS || correctedCall.messages[0].content !== DIAGNOSIS_INSTRUCTIONS) throw new Error("The system prompt must be identical so both calls stay in one Mubit task");
  if (firstCall.model !== correctedCall.model || JSON.stringify(firstCall.response_format) !== JSON.stringify(correctedCall.response_format)) throw new Error("Model and output format must match across the task");
  const sentCorrections = JSON.parse(correctedCall.messages[1].content).merchantVerifiedCorrections;
  if (sentCorrections.length !== 1 || sentCorrections[0].merchantVerifiedCause !== "delivery_delays") throw new Error("Expected the correction in the next Mubit user message");
  if (!correctedResult.modelCall.appliedCorrectionIds?.includes(correctionRecord.correction.correctionId)) throw new Error("Expected the model call to record which corrections it applied");
  if (correctedResult.modelCall.instructionsFingerprint !== diagnosisResult.modelCall.instructionsFingerprint) throw new Error("Expected one task fingerprint");
  console.log(` - Correction ID: ${correctionRecord.correction.correctionId} (local record)`);
  console.log(` - Next Mubit call ${correctedResult.modelCall.mubitRequestId} applied ${correctedResult.modelCall.appliedCorrectionIds.length} correction(s), task ${correctedResult.modelCall.instructionsFingerprint}`);
  console.log("✅ Correction reaches Mubit inside the same diagnosis task.");

  // 7. Benchmark Evaluator
  console.log("7. Running the synthetic benchmark fixture (simulated numbers, not a Mubit measurement)...");
  const benchmark = benchmarkEvaluator.runBenchmark();
  console.log(` - Evaluated cases: ${benchmark.casesCount}`);
  console.log(` - Baseline provider accuracy: ${benchmark.providerAccuracy}%`);
  console.log(` - Mubit adapted model accuracy: ${benchmark.adapterAccuracy}%`);
  console.log(` - Provider avg latency: ${benchmark.providerAvgLatencyMs}ms vs Adapter: ${benchmark.adapterAvgLatencyMs}ms`);
  console.log(` - Provider avg cost: $${benchmark.providerAvgCostMicros / 1000000} vs Adapter: $${benchmark.adapterAvgCostMicros / 1000000}`);
  if (benchmark.adapterAccuracy < benchmark.providerAccuracy) {
    throw new Error("Expected adapted model to have higher accuracy");
  }
  console.log("✅ Benchmark evaluation verified.");

  console.log("\n🎉 ALL INTELLIGENCE SYSTEM TESTS PASSED SUCCESSFULLY!");
}

runIntelligenceTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
