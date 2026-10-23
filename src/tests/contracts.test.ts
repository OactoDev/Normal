import {
  ProposedPlan,
  PlanApproval,
  ActionExecution,
  ActionOutcome,
  PlanHandoff,
  DiagnosisModelOutput,
} from "../contracts";
import { orchestrator } from "../agents/orchestrator";

async function runContractsTest() {
  console.log("=== Testing Zod Data Contracts ===");

  const plan = orchestrator.getPlan("plan_001");
  if (!plan) throw new Error("Default plan not found");

  // 1. Validate ProposedPlan
  const parsedPlan = ProposedPlan.parse(plan);
  console.log("✅ ProposedPlan schema validation passed:", parsedPlan.planId);

  // 2. Validate DiagnosisModelOutput
  const diagnosisOutput = DiagnosisModelOutput.parse({
    primaryCause: "delivery_delays",
    supportedHypotheses: [
      {
        cause: "delivery_delays",
        confidence: 0.94,
        rationale: "3PL shipping bottlenecks triggered 14 customer complaints",
        evidenceIds: ["e_ship_01"],
      },
    ],
    missingEvidence: [],
  });
  console.log("✅ DiagnosisModelOutput validation passed:", diagnosisOutput.primaryCause);

  // 3. Validate PlanHandoff wrapper
  const handoff = PlanHandoff.parse({
    plan: parsedPlan,
    diagnosis: {
      schemaVersion: 1,
      diagnosisId: "diag_001",
      investigationId: "inv_001",
      modelCallId: "call_001",
      output: diagnosisOutput,
      serverAttribution: {
        verifiedByRules: true,
        saplingVerification: "supported",
      },
      createdAt: new Date().toISOString(),
    },
    evidence: [
      {
        schemaVersion: 1,
        evidenceId: "e_ship_01",
        investigationId: "inv_001",
        businessId: "nova_store",
        observedFact: "Carrier SLA breaches exceeding 48 hours on 34 orders",
        measurements: {
          lateOrders: 34,
          avgDelayHours: 52.4,
        },
        sourceRecordIds: ["ord_001", "ord_002"],
        retrievedAt: new Date().toISOString(),
      },
    ],
  });
  console.log("✅ PlanHandoff validation passed:", handoff.plan.planId);

  console.log("All contract tests passed successfully!");
}

runContractsTest().catch((err) => {
  console.error("❌ Contracts test failed:", err);
  process.exit(1);
});
