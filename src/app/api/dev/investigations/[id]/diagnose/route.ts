import { apiError, readJson } from "@/lib/api";
import { guardDevRoute, handleRouteError } from "@/lib/route-helpers";
import { diagnoseInvestigation } from "@/intelligence/investigator/diagnose";

/**
 * POST /api/dev/investigations/:id/diagnose — `{businessId?, simulationRunId?}`.
 * Runs the Mubit investigator (Gemini 4 Argon through Mubit) on the investigation's collected evidence and persists the
 * validated Diagnosis. Fails with 409 before evidence exists and 502/503 when Mubit fails; nothing is saved on failure.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/dev/investigations/[id]/diagnose">): Promise<Response> {
  const denied = guardDevRoute(request);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    if (!/^[A-Za-z0-9_.-]{1,160}$/.test(id)) return apiError("validation_error", "Invalid investigation id", 400);
    const body = ((await readJson(request)) ?? {}) as Record<string, unknown>;
    const scope = { ...(body.businessId ? { businessId: body.businessId } : {}), ...(body.simulationRunId ? { simulationRunId: body.simulationRunId } : {}) };
    const { diagnosis, modelCall } = await diagnoseInvestigation(id, scope);
    return Response.json({ diagnosis, modelCall });
  } catch (error) {
    if (error instanceof Error && error.name === "InvestigatorError") {
      const e = error as Error & { code: string; status: number; mubitRequestId?: string };
      return Response.json({ error: { code: e.code, message: e.message, ...(e.mubitRequestId ? { mubitRequestId: e.mubitRequestId } : {}) } }, { status: e.status });
    }
    return handleRouteError(error, "investigations/diagnose");
  }
}
