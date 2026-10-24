import * as s from "../store/repos";
import { seedSimulator } from "./state";
import { ToolError } from "../execution/retry-policy";
export async function resetDemo(planId: string) {
  const execs = await s.executions.find({planId});
  // Work that has been running for minutes belongs to a crashed or hung process, so it no longer blocks a demo reset.
  const live = (e: (typeof execs)[number]) => e.status === "queued" || (e.status === "running" && Date.now() - Date.parse(e.startedAt) < 120000);
  if (execs.some(live)) throw new ToolError("EXECUTION_ACTIVE", "Wait for active work before resetting", false, false, 409);
  for (const e of execs) { await s.executions.remove(e.idempotencyKey); await s.details.remove(e.executionId); await s.outcomes.remove(e.executionId); }
  for (const r of await s.logs.find({planId})) await s.logs.remove(r.logId);
  for (const r of await s.missions.find({planId})) await s.missions.remove(r.missionId);
  for (const r of await s.approvals.find()) if (r.approval.planId === planId) await s.approvals.remove(r.approval.approvalId);
  for (const r of await s.approvalHeads.find({planId})) await s.approvalHeads.remove(`${planId}:v${r.planVersion}`);
  for (const r of await s.emails.find({planId})) await s.emails.remove(r.key);
  for (const r of await s.events.find()) if (r.payload.planId === planId) await s.events.remove(r.eventId);
  // The fixture plan is reseeded with fresh windows; generated plans are kept and reopened for approval.
  for (const h of await s.handoffs.find()) if (h.plan.planId === planId) {
    const key = `${planId}:v${h.plan.planVersion}`;
    if (planId === "plan_001") await s.handoffs.remove(key);
    else await s.handoffs.update(key, { $set: { ...h, plan: { ...h.plan, status: "awaiting_approval" } } });
  }
  // Shared demo platforms are explicitly reset to baseline.
  await s.campaigns.remove("campaign_A");
  for (const m of await s.adMetrics.find()) await s.adMetrics.remove(m.metricId);
  for (const b of await s.storefront.find()) await s.storefront.remove(b.bannerId);
  await seedSimulator();
}
