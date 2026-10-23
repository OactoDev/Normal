import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "../../../../../agents/orchestrator";
import { validateAndCreateApproval } from "../../../../../execution/validate-approval";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const plan = orchestrator.getPlan(id);

  if (!plan) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: `Plan ${id} not found`, requestId: `req_${Date.now()}` } },
      { status: 404 }
    );
  }

  try {
    const body = await request.json();
    const result = validateAndCreateApproval(plan, {
      planVersion: body.planVersion ?? plan.planVersion,
      approvedActionIds: body.approvedActionIds ?? plan.actions.map((a) => a.actionId),
      reviewingPrincipal: body.reviewingPrincipal ?? "merchant_owner_01",
    });

    if (result.valid === false) {
      return NextResponse.json(
        { error: { code: result.code, message: result.message, requestId: `req_${Date.now()}` } },
        { status: 400 }
      );
    }

    orchestrator.savePlan(result.plan);
    orchestrator.saveApproval(result.approval);

    return NextResponse.json({
      success: true,
      approval: result.approval,
      plan: result.plan,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message, requestId: `req_${Date.now()}` } },
      { status: 400 }
    );
  }
}
