import { NextRequest, NextResponse } from "next/server";
import { planGenerator } from "../../../../intelligence/plan-generator";
import { DiagnosisT, EvidenceT } from "../../../../contracts";
import { SaplingBlockedError } from "../../../../intelligence/sapling-verifier";
import { MubitPlanningError } from "../../../../intelligence/mubit-planner";

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

    const { handoff, modelCall } = await planGenerator.generatePlan(diagnosis, evidence);

    return NextResponse.json({
      planId: handoff.plan.planId,
      handoff,
      modelCall,
    });
  } catch (err: any) {
    if (err instanceof MubitPlanningError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message, ...(err.requestId ? { requestId: err.requestId } : {}), ...(err.problems.length ? { problems: err.problems } : {}) } },
        { status: err.status }
      );
    }
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
