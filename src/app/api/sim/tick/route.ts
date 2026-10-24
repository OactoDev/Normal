import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { telemetrySimulator } from "../../../../intelligence/telemetry-simulator";
import { authorize } from "../../../../execution/policy";
import { apiError } from "../../../../execution/api-error";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    authorize(request.headers.get("x-normal-principal") || "", "nova_store");
    const { ticks } = z.object({ ticks: z.number().int().min(1).max(60).default(1) }).strict().parse(await request.json());
    return NextResponse.json(await telemetrySimulator.tick(ticks));
  } catch (e) { return apiError(e); }
}
