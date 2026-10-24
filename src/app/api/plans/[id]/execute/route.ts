import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { orchestrator } from "../../../../../agents/orchestrator";
import { apiError } from "../../../../../execution/api-error";
export const runtime = "nodejs";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = z.object({ approvalId: z.string().min(1), actionIds: z.array(z.string().min(1)).optional() }).strict().parse(await request.json());
    const snapshot = await orchestrator.start((await params).id, body.approvalId, body.actionIds, request.headers.get("x-normal-principal") || "", work => after(work));
    return NextResponse.json(snapshot, { status: 202 });
  } catch (e) { return apiError(e); }
}
