import { apiError } from "@/lib/api";
import { guardDevRoute, handleRouteError } from "@/lib/route-helpers";
import { latestDiagnosis } from "@/intelligence/investigator/diagnose";

/** GET /api/investigations/:id/diagnosis?businessId&simulationRunId — the latest Mubit diagnosis and its model call, or nulls. */
export async function GET(request: Request, ctx: RouteContext<"/api/investigations/[id]/diagnosis">): Promise<Response> {
  const denied = guardDevRoute(request);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    if (!/^[A-Za-z0-9_.-]{1,160}$/.test(id)) return apiError("validation_error", "Invalid investigation id", 400);
    return Response.json(await latestDiagnosis(id, Object.fromEntries(new URL(request.url).searchParams)));
  } catch (error) {
    return handleRouteError(error, "investigations/diagnosis");
  }
}
