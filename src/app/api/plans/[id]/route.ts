import { NextRequest, NextResponse } from "next/server";
import { loadPlanHandoff } from "../../../../execution/load-plan";
import { apiError } from "../../../../execution/api-error";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await loadPlanHandoff((await params).id)); } catch (e) { return apiError(e); }
}
