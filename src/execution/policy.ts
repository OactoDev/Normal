import { ActionProposalT } from "../contracts";
import { campaigns } from "../store/repos";
import { BudgetParams, BannerParams, parseParams } from "./action-params";
import { ToolError } from "./retry-policy";
const MVP_ACTION_TYPES = ["ads.set_daily_budget", "customer.send_delay_notice", "storefront.publish_banner"];
// Demo principal registry. Identity arrives in the x-normal-principal header; this is not production authentication.
export const PRINCIPALS: Record<string, { businessId: string; role: "owner" | "viewer"; actionTypes: string[] }> = {
  merchant_owner_01: { businessId: "nova_store", role: "owner", actionTypes: MVP_ACTION_TYPES },
  ops_viewer: { businessId: "nova_store", role: "viewer", actionTypes: [] },
};
export function authorize(principal: string, businessId: string, actionTypes: string[] = []) {
  const p = PRINCIPALS[principal];
  if (!p || p.role !== "owner") throw new ToolError("FORBIDDEN", "This principal cannot approve or execute actions", false, false, 403);
  if (p.businessId !== businessId) throw new ToolError("BUSINESS_MISMATCH", "Principal does not own this business", false, false, 403);
  const denied = actionTypes.filter(t => !p.actionTypes.includes(t));
  if (denied.length) throw new ToolError("FORBIDDEN", `Principal may not approve ${denied.join(", ")}`, false, false, 403);
}
export async function validatePolicy(action: ActionProposalT) {
  parseParams(action.actionType, action.params);
  const scopes: Record<string, string> = { "ads.set_daily_budget": "marketing", "customer.send_delay_notice": "customer_care", "storefront.publish_banner": "storefront" };
  if (scopes[action.actionType] !== action.agent) throw new ToolError("AGENT_SCOPE", "Action assigned to the wrong agent");
  if (action.actionType === "ads.set_daily_budget") {
    const p = BudgetParams.parse(action.params), campaign = await campaigns.findOne(p.campaignId);
    if (!campaign) throw new ToolError("CAMPAIGN_NOT_FOUND", "Campaign not found");
    if (campaign.currency !== p.currency || p.newDailyBudgetMinor > Number(process.env.MAX_DAILY_BUDGET_MINOR || 10000) || Math.abs(p.newDailyBudgetMinor / campaign.dailyBudgetMinor - 1) > Number(process.env.MAX_BUDGET_CHANGE_PERCENT || 60) / 100) throw new ToolError("BUDGET_POLICY", "Budget exceeds cap, change limit, or currency does not match");
  }
  if (action.actionType === "storefront.publish_banner") {
    const p = BannerParams.parse(action.params), start = Date.parse(p.startsAt), end = Date.parse(p.expiresAt);
    if (end <= Date.now() || end <= start || end - start > 14 * 86400000) throw new ToolError("BANNER_WINDOW", "Banner must expire in the future within a 14-day window");
  }
}
