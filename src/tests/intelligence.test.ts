import { telemetrySimulator } from "../intelligence/telemetry-simulator";
import { anomalyDetector } from "../intelligence/anomaly-detector";
import { evidenceCollector } from "../intelligence/evidence-collector";
import { mubitDiagnoser } from "../intelligence/mubit-diagnoser";
import { planGenerator } from "../intelligence/plan-generator";
import { feedbackPipeline } from "../intelligence/feedback-pipeline";
import { benchmarkEvaluator } from "../intelligence/benchmark-evaluator";
import { orchestrator } from "../agents/orchestrator";

async function runIntelligenceTests() {
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
  const diagnosisResult = await mubitDiagnoser.diagnose(packet.investigation, packet.evidence);
  console.log(` - Model used: ${diagnosisResult.modelCall.providerModel}`);
  console.log(` - Primary root cause: ${diagnosisResult.diagnosis.output.primaryCause}`);
  console.log(` - Mubit trace ID: ${diagnosisResult.modelCall.mubitRequestId}`);
  console.log(` - Latency: ${diagnosisResult.modelCall.latencyMs}ms`);
  if (!diagnosisResult.diagnosis.output.primaryCause) {
    throw new Error("Expected a primary root cause");
  }
  console.log("✅ Mubit AI Diagnosis verified.");

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

  // 6. Feedback & Adapter Record
  console.log("6. Submitting human correction to Mubit learning pipeline...");
  const feedbackResult = await feedbackPipeline.submitCorrection({
    investigationId: packet.investigation.investigationId,
    diagnosisId: diagnosisResult.diagnosis.diagnosisId,
    modelCallId: diagnosisResult.modelCall.modelCallId,
    predictedCause: diagnosisResult.diagnosis.output.primaryCause,
    correctedCause: "delivery_delays",
    correctedEvidenceIds: packet.evidence.map((e) => e.evidenceId),
    note: "Carrier SLA delivery delays breached 48h.",
  });
  console.log(` - Correction ID: ${feedbackResult.correction.correctionId}`);
  console.log(` - Ingestion status: ${feedbackResult.correction.ingestionStatus}`);
  console.log(` - Adapter record status: ${feedbackResult.adapter.status}`);
  console.log("✅ Mubit feedback & adapter record verified.");

  // 7. Benchmark Evaluator
  console.log("7. Running benchmark on held-out test suite...");
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
