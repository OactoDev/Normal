import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resetDemo } from "../../../../simulator/reset";
import { authorize } from "../../../../execution/policy";
import { apiError } from "../../../../execution/api-error";
import { ToolError } from "../../../../execution/retry-policy";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production") throw new ToolError("NOT_FOUND", "Dev only", false, false, 404);
    authorize(request.headers.get("x-normal-principal") || "", "nova_store");
    const { planId } = z.object({ planId: z.string().min(1) }).strict().parse(await request.json());
    await resetDemo(planId); return NextResponse.json({ success: true });
  } catch (e) { return apiError(e); }
}
