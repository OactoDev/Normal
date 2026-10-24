import { PlanHandoff, planReferenceErrors, type DiagnosisT, type EvidenceT, type ProposedPlanT } from "@normal/contracts";
import { apiError } from "@/lib/api";
import { COLLECTIONS } from "@/lib/collections";
import { getDb } from "@/lib/mongodb";
import { handleRouteError } from "@/lib/route-helpers";

/**
 * GET /api/plans/:id — canonical PlanHandoff `{ plan, diagnosis, evidence }` for
 * the partner's approval/execution module. Reads the latest persisted plan
 * version plus its diagnosis and evidence; validates before returning.
 * (Plan generation itself belongs to the future intelligence stage.)
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/plans/[id]">): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const db = await getDb();
    const plan = await db.collection<ProposedPlanT>(COLLECTIONS.plans).find({ planId: id }, { projection: { _id: 0 } }).sort({ planVersion: -1 }).limit(1).next();
    if (!plan) return apiError("plan_not_found", `Plan ${id} not found`, 404);
    const [diagnosis, evidence] = await Promise.all([
      db.collection<DiagnosisT>(COLLECTIONS.diagnoses).findOne({ businessId: plan.businessId, diagnosisId: plan.diagnosisId }, { projection: { _id: 0 } }),
      db.collection<EvidenceT>(COLLECTIONS.evidence).find({ businessId: plan.businessId, investigationId: plan.investigationId }, { projection: { _id: 0 } }).toArray(),
    ]);
    if (!diagnosis) return apiError("diagnosis_not_found", `Diagnosis ${plan.diagnosisId} for plan ${id} not found`, 404);
    const handoff = PlanHandoff.parse({ plan, diagnosis, evidence });
    const errors = planReferenceErrors(handoff.plan, handoff.diagnosis, handoff.evidence);
    if (errors.length) return apiError("invalid_plan_references", errors.join("; "), 500);
    return Response.json(handoff);
  } catch (error) {
    return handleRouteError(error, "plans/get");
  }
}
