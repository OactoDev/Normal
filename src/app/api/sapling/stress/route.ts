import { NextResponse } from "next/server";
import { callSapling, renderEvidence } from "../../../../intelligence/sapling-verifier";
import { SAPLING_STRESS_CASES } from "../../../../intelligence/sapling-stress";

export const dynamic = "force-dynamic";

export async function POST() {
  const started = Date.now();
  const results = await Promise.all(SAPLING_STRESS_CASES.map(async (test) => {
    const renderedEvidence = renderEvidence(test.evidence);
    const check = await callSapling(test.policy, renderedEvidence, test.claim);
    return {
      id: test.id,
      title: test.title,
      expected: test.expected,
      actual: check.verdict,
      matches: check.status !== "unavailable" && check.verdict === test.expected,
      evidence: renderedEvidence,
      ...check,
    };
  }));
  return NextResponse.json({
    provider: "Banyan Sapling",
    live: true,
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - started,
    results,
  }, { headers: { "Cache-Control": "no-store" } });
}
