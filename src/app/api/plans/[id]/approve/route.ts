import { NextRequest, NextResponse } from "next/server";
import { loadPlanHandoff } from "../../../../../execution/load-plan";
import { createApproval } from "../../../../../execution/validate-approval";
import { apiError } from "../../../../../execution/api-error";
export const runtime = "nodejs";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const handoff = await loadPlanHandoff((await params).id);
    return NextResponse.json(await createApproval(handoff, await request.json(), request.headers.get("x-normal-principal") || ""));
  } catch (e) { return apiError(e); }
}
