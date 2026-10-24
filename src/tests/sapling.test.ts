import { DiagnosisModelOutputT, EvidenceT, RootCauseT } from "../contracts";
import { decide, saplingVerifier } from "../intelligence/sapling-verifier";
import { planGenerator } from "../intelligence/plan-generator";

const now = new Date().toISOString();
const ev = (evidenceId: string, observedFact: string, measurements: Record<string, number>): EvidenceT => ({
  schemaVersion: 1, evidenceId, investigationId: "inv_sap", businessId: "nova_store",
  observedFact, measurements, sourceRecordIds: [], retrievedAt: now,
});
const diag = (cause: RootCauseT, evidenceIds: string[]): DiagnosisModelOutputT => ({
  primaryCause: cause,
  supportedHypotheses: [{ cause, confidence: 0.9, rationale: "test", evidenceIds }],
  missingEvidence: [],
});

const ship14 = ev("e_ship_14", "14 tracked orders breached delivery SLA promise dates by >48 hours.", { delayedOrdersCount: 14 });
const ship3 = ev("e_ship_3", "3 tracked orders breached delivery SLA promise dates by >48 hours.", { delayedOrdersCount: 3 });
const ads = ev("e_ads_1", "Meta Campaign A customer acquisition cost (CAC) jumped from £18.20 to £38.50 with declining clickthrough.", { cacInflationPercent: 112 });

async function run() {
  console.log("=== Testing Banyan Sapling diagnosis gate ===");

  // Decision rule (offline)
  const cases: [string, string, string, boolean][] = [
    ["violation", "violation", "violation", true],
    ["supported", "supported", "supported", false],
    ["insufficient_information", "insufficient_information", "insufficient_information", true],
    ["unsure", "violation", "violation", true],
    ["unsure", "insufficient_information", "insufficient_information", true],
    ["unsure", "supported", "supported", false],
  ];
  for (const [status, raw, verdict, blocked] of cases) {
    const d = decide(status, raw);
    if (d.verdict !== verdict || d.blocked !== blocked) throw new Error(`decide(${status}, ${raw}) → ${JSON.stringify(d)}`);
  }
  console.log("✓ decision rule");

  const unknown = await saplingVerifier.verifyDiagnosis(diag("unknown", []), [ads]);
  if (!unknown.blocked || unknown.status !== "not_called") throw new Error("unknown cause must block without a call");
  console.log("✓ unknown cause blocks without calling Sapling");

  // Live Sapling calls
  const live: [string, DiagnosisModelOutputT, EvidenceT[], boolean][] = [
    ["delivery delays, 14 delayed orders", diag("delivery_delays", ["e_ship_14"]), [ship14, ads], false],
    ["delivery delays, 3 delayed orders", diag("delivery_delays", ["e_ship_3"]), [ship3, ads], true],
    ["delivery delays, only ad evidence", diag("delivery_delays", ["e_ads_1"]), [ads], true],
  ];
  for (const [name, output, evidence, expectBlocked] of live) {
    const check = await saplingVerifier.verifyDiagnosis(output, evidence);
    const p = Object.entries(check.probabilities).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(", ");
    console.log(` - ${name}: status=${check.status} raw=${check.rawLabel} → ${check.verdict}${check.blocked ? " (BLOCKED)" : ""} [${p}] ${check.latencyMs}ms`);
    if (check.status === "unavailable") throw new Error(`Sapling unavailable: ${check.error}`);
    if (check.blocked !== expectBlocked) throw new Error(`${name}: expected blocked=${expectBlocked}`);
  }
  console.log("✓ live Sapling verdicts");

  let refused = false;
  try { await planGenerator.generatePlan({ schemaVersion: 1, diagnosisId: "diag_sap", investigationId: "inv_sap", modelCallId: "call_sap", output: diag("delivery_delays", ["e_ship_3"]), serverAttribution: { verifiedByRules: true, saplingVerification: "supported" }, createdAt: now }, [ship3]); }
  catch (e: any) { refused = e.name === "SaplingBlockedError"; }
  if (!refused) throw new Error("plan generator must refuse a blocked diagnosis even when the client claims 'supported'");
  console.log("✓ plan generator re-verifies and refuses a forged 'supported' diagnosis");

  console.log("All Sapling tests passed.");
}

run().catch((e) => { console.error("❌", e.message); process.exit(1); });
