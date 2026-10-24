import { PlanHandoff, PlanHandoffT } from "../contracts";
import fixture from "../fixtures/plan_001.handoff.json";
import { handoffs } from "../store/repos";
import { seedSimulator } from "../simulator/state";
import { ToolError } from "./retry-policy";
export async function seedDefaultPlan() {
  await seedSimulator();
  const h = PlanHandoff.parse(fixture);
  // Date-relative demo windows are established once, never refreshed on read.
  h.plan.createdAt = new Date().toISOString();
  h.plan.expiresAt = new Date(Date.now()+2*86400000).toISOString();
  const banner = h.plan.actions.find(a => a.actionType === "storefront.publish_banner")!;
  banner.params.startsAt = new Date(Date.now()-60000).toISOString();
  banner.params.expiresAt = h.plan.expiresAt;
  await handoffs.claim("plan_001:v1", h);
}
export async function storedHandoff(planId: string): Promise<PlanHandoffT> {
  // Reads stay read-only once the demo plan exists; reset removes it, so the next read reseeds.
  if (!await handoffs.findOne("plan_001:v1")) await seedDefaultPlan();
  const records = (await handoffs.find()).filter(h => h.plan.planId === planId).sort((a,b) => b.plan.planVersion-a.plan.planVersion);
  if (!records[0]) throw new ToolError("NOT_FOUND", "Plan not found", false, false, 404);
  return records[0];
}
export async function loadPlanHandoff(planId: string): Promise<PlanHandoffT> {
  if (!process.env.INTELLIGENCE_API_URL) return storedHandoff(planId);
  const r = await fetch(`${process.env.INTELLIGENCE_API_URL}/api/plans/${encodeURIComponent(planId)}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new ToolError("INTELLIGENCE_UNAVAILABLE", "Could not load intelligence plan");
  return PlanHandoff.parse(await r.json());
}
