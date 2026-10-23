import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "../../../../../agents/orchestrator";

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

  const approval = orchestrator.getApproval(id);
  if (!approval) {
    return NextResponse.json(
      {
        error: {
          code: "NOT_APPROVED",
          message: `Plan ${id} has not been approved yet. Call POST /api/plans/${id}/approve first.`,
          requestId: `req_${Date.now()}`,
        },
      },
      { status: 400 }
    );
  }

  try {
    const runResult = await orchestrator.executeApprovedPlan(id, approval);

    return NextResponse.json({
      success: true,
      status: runResult.status,
      missions: runResult.missions,
      executions: runResult.executions,
      outcomes: runResult.outcomes,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: { code: "EXECUTION_FAILED", message, requestId: `req_${Date.now()}` } },
      { status: 500 }
    );
  }
}
