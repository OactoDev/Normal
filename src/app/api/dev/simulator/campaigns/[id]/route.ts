import { ProposedPlan, type ProposedPlanT } from "@normal/contracts";
import type { ActionReceipt } from "@/adapters/_shared";
import { readCampaign, readCampaigns } from "@/adapters/campaigns";
import { campaignBreakdown, computeSnapshots } from "@/analytics/metrics";
import { COLLECTIONS } from "@/lib/collections";
import { getDb } from "@/lib/mongodb";
import { apiError } from "@/lib/api";
import { businessIdFrom, guardDevRoute, handleRouteError } from "@/lib/route-helpers";
import { getRunSummary } from "@/simulator/runtime";
import type { BusinessEventT } from "@normal/contracts";

type BudgetUpdateEvent = Extract<BusinessEventT, { type: "campaign.budget_updated" }>;

/** Campaign workspace reads the persisted campaign, canonical performance events, and action receipts. */
export async function GET(request: Request, ctx: RouteContext<"/api/dev/simulator/campaigns/[id]">): Promise<Response> {
  const denied = guardDevRoute(request);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    if (!/^[A-Za-z0-9_.:-]{1,160}$/.test(id)) return apiError("validation_error", "Invalid campaign id", 400);
    const businessId = businessIdFrom(request);
    const url = new URL(request.url);
    const summary = await getRunSummary(businessId, url.searchParams.get("simulationRunId"));
    const simulationRunId = summary.run.simulationRunId;
    const db = await getDb();
    const [campaign, campaigns] = await Promise.all([
      readCampaign({ businessId, simulationRunId, db }, id),
      readCampaigns({ businessId, simulationRunId, db }),
    ]);
    if (!campaign) return apiError("campaign_not_found", `Campaign ${id} not found in run ${simulationRunId}`, 404);

    const endAt = summary.run.virtualTime;
    const startAt = new Date(Math.max(Date.parse(summary.virtualStartAt), Date.parse(endAt) - 30 * 86_400_000)).toISOString();
    const [daily, performance, events, receipts] = await Promise.all([
      Date.parse(endAt) > Date.parse(startAt)
        ? computeSnapshots({ businessId, simulationRunId, startAt, endAt, bucket: "day", dimension: { campaignId: id }, virtualTime: endAt }, db)
        : Promise.resolve([]),
      Date.parse(endAt) > Date.parse(startAt)
        ? campaignBreakdown(businessId, simulationRunId, startAt, endAt, db)
        : Promise.resolve([]),
      db.collection<BudgetUpdateEvent>(COLLECTIONS.businessEvents).find({
        businessId, simulationRunId, type: "campaign.budget_updated", "payload.campaignId": id,
      }, { projection: { _id: 0 } }).sort({ occurredAt: -1 }).limit(50).toArray(),
      db.collection<ActionReceipt>(COLLECTIONS.actionReceipts).find({
        businessId, simulationRunId, affectedEntityIds: id, toolName: "ads.set_daily_budget",
      }, { projection: { _id: 0, businessId: 1, simulationRunId: 1, actionId: 1, toolName: 1, emittedEventIds: 1, affectedEntityIds: 1, verification: 1, recordedAt: 1 } }).sort({ recordedAt: -1 }).limit(50).toArray(),
    ]);

    const actionIds = [...new Set(receipts.map((receipt) => receipt.actionId))];
    const planDocs = actionIds.length ? await db.collection<ProposedPlanT>(COLLECTIONS.plans).find({
      businessId, "actions.actionId": { $in: actionIds },
    }, { projection: { _id: 0 } }).limit(50).toArray() : [];
    const actionById = new Map<string, { agent: string; title: string; planId: string }>();
    for (const rawPlan of planDocs) {
      const parsed = ProposedPlan.safeParse(rawPlan);
      if (!parsed.success) continue;
      for (const action of parsed.data.actions) {
        if (actionIds.includes(action.actionId)) actionById.set(action.actionId, { agent: action.agent, title: action.title, planId: parsed.data.planId });
      }
    }
    const eventByAction = new Map(events.map((event) => [event.payload.actionId, event]));
    const receiptActions = receipts.map((receipt) => {
      const event = eventByAction.get(receipt.actionId);
      const proposal = actionById.get(receipt.actionId);
      return {
        actionId: receipt.actionId,
        toolName: receipt.toolName,
        recordedAt: receipt.recordedAt,
        verification: receipt.verification,
        emittedEventIds: receipt.emittedEventIds,
        agent: proposal?.agent ?? (receipt.toolName === "ads.set_daily_budget" ? "marketing" : null),
        title: proposal?.title ?? null,
        planId: proposal?.planId ?? null,
        previousDailyBudgetMinor: event?.payload.previousDailyBudgetMinor ?? null,
        newDailyBudgetMinor: event?.payload.newDailyBudgetMinor ?? null,
      };
    }).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));

    return Response.json({
      simulationRunId, window: { startAt, endAt }, campaign, campaigns,
      performance: performance.find((row) => row.campaignId === id) ?? null,
      daily, actions: receiptActions,
    });
  } catch (error) {
    return handleRouteError(error, "simulator/campaign-detail");
  }
}
