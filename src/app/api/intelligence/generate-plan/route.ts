import { NextRequest, NextResponse } from "next/server";
import { planGenerator } from "../../../../intelligence/plan-generator";
import { DiagnosisT, EvidenceT } from "../../../../contracts";
import { SaplingBlockedError } from "../../../../intelligence/sapling-verifier";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const diagnosis: DiagnosisT = body.diagnosis;
    const evidence: EvidenceT[] = body.evidence || [];

    if (!diagnosis || !diagnosis.output) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "A valid diagnosis object is required" } },
        { status: 400 }
      );
    }

    const handoff = await planGenerator.generatePlan(diagnosis, evidence);

    return NextResponse.json({
      planId: handoff.plan.planId,
      handoff,
    });
  } catch (err: any) {
    if (err instanceof SaplingBlockedError) {
      return NextResponse.json(
        { error: { code: "SAPLING_BLOCKED", message: err.message }, saplingCheck: err.check },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: { code: "PLAN_GENERATION_FAILED", message: err.message || "Failed to generate recovery plan" } },
      { status: 500 }
    );
  }
}
