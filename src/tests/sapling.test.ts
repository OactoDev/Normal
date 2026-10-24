import assert from "node:assert/strict";
import { POST as stressPOST } from "../app/api/sapling/stress/route";
import { SAPLING_STRESS_CASES } from "../intelligence/sapling-stress";
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
    ["inconsistent_context", "inconsistent_context", "inconsistent_context", true],
    ["unsure", "inconsistent_context", "inconsistent_context", true],
    ["violation", "supported", "violation", true],
    ["supported", "violation", "supported", false],
    ["unexpected", "supported", "unsure", true],
    ["unsure", "unexpected", "unsure", true],
  ];
  for (const [status, raw, verdict, blocked] of cases) {
    const d = decide(status, raw);
    if (d.verdict !== verdict || d.blocked !== blocked) throw new Error(`decide(${status}, ${raw}) → ${JSON.stringify(d)}`);
  }
  console.log("✓ decision rule");

  // Verify the public stress response keeps model output separate from expectations,
  // and starts every live request together rather than serially.
  const originalFetch = globalThis.fetch;
  let active = 0;
  let maxActive = 0;
  let calls = 0;
  try {
    globalThis.fetch = async (_url, init) => {
      const index = calls++;
      const body = JSON.parse(String(init?.body));
      assert.equal(body.inputs.policy, SAPLING_STRESS_CASES[index].policy);
      assert.equal(body.inputs.claim, SAPLING_STRESS_CASES[index].claim);
      assert.match(body.inputs.evidence, new RegExp(SAPLING_STRESS_CASES[index].evidence[0].evidenceId));
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      // Deliberate mismatch: the route must report a violation, never rewrite it
      // to the expected insufficient_information label.
      const label = index === 2 ? "violation" : SAPLING_STRESS_CASES[index].expected;
      return Response.json({ status: "unsure", raw_label: label, probabilities: {
        supported: label === "supported" ? 1 : 0,
        violation: label === "violation" ? 1 : 0,
        insufficient_information: label === "insufficient_information" ? 1 : 0,
        inconsistent_context: label === "inconsistent_context" ? 1 : 0,
      } });
    };
    const response = await stressPOST();
    const result = await response.json();
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(calls, 4);
    assert.equal(maxActive, 4);
    assert.equal(result.results[2].expected, "insufficient_information");
    assert.equal(result.results[2].actual, "violation");
    assert.equal(result.results[2].matches, false);
    assert.equal(result.results[2].blocked, true);
    for (const row of result.results) {
      assert.deepEqual(Object.keys(row.probabilities).sort(), ["supported", "violation", "insufficient_information", "inconsistent_context"].sort());
      assert.equal(Object.values(row.probabilities).reduce((sum: number, value) => sum + Number(value), 0), 1);
      assert.equal(row.actual, row.rawLabel);
    }
    globalThis.fetch = async () => new Response("Unavailable", { status: 503 });
    const failed = await (await stressPOST()).json();
    assert(failed.results.every((row: any) => row.status === "unavailable" && row.actual === "unsure" && row.blocked && !row.matches));
    let unavailableRefused = false;
    try {
      await planGenerator.generatePlan({ schemaVersion: 1, diagnosisId: "diag_unavailable", investigationId: "inv_sap", modelCallId: "call_sap", output: diag("delivery_delays", ["e_ship_14"]), serverAttribution: { verifiedByRules: true, saplingVerification: "supported" }, createdAt: now }, [ship14]);
    } catch (error: any) {
      unavailableRefused = error.name === "SaplingBlockedError" && error.check.status === "unavailable";
    }
    assert(unavailableRefused, "server must block even a forged supported pass when Sapling is unavailable");
    for (const malformed of [
      { status: "unexpected", raw_label: "supported", probabilities: { supported: 1, violation: 0, insufficient_information: 0, inconsistent_context: 0 } },
      { status: "supported", raw_label: "unexpected", probabilities: { supported: 1, violation: 0, insufficient_information: 0, inconsistent_context: 0 } },
      { status: "supported", raw_label: "supported", probabilities: { supported: 1 } },
      { status: "supported", raw_label: "supported", probabilities: { supported: 1, violation: 1, insufficient_information: 0, inconsistent_context: 0 } },
    ]) {
      globalThis.fetch = async () => Response.json(malformed);
      const invalid = await saplingVerifier.verifyDiagnosis(diag("delivery_delays", ["e_ship_14"]), [ship14]);
      assert.equal(invalid.verdict, "unsure");
      assert.equal(invalid.status, "unavailable");
      assert.equal(invalid.blocked, true);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log("✓ stress route preserves live output; server blocks unavailable/malformed Sapling responses and forged passes");

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
