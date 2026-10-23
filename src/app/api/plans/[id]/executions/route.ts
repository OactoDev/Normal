import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "../../../../../agents/orchestrator";

export async function GET(
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

  const executions = orchestrator.getExecutions(id);
  const outcomes = orchestrator.getOutcomes(id);
  const missions = orchestrator.getMissions(id);
  const approval = orchestrator.getApproval(id);

  return NextResponse.json({
    planId: id,
    planStatus: plan.status,
    approval,
    missions,
    executions,
    outcomes,
  });
}
