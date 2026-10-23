import { NextRequest, NextResponse } from "next/server";
import { planGenerator } from "../../../../intelligence/plan-generator";
import { DiagnosisT, EvidenceT } from "../../../../contracts";

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

    const handoff = planGenerator.generatePlan(diagnosis, evidence);

    return NextResponse.json({
      planId: handoff.plan.planId,
      handoff,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "PLAN_GENERATION_FAILED", message: err.message || "Failed to generate recovery plan" } },
      { status: 500 }
    );
  }
}
