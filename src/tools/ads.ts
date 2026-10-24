import { BudgetParams } from "../execution/action-params";
import { campaigns } from "../store/repos";
import { ToolError } from "../execution/retry-policy";
export async function executeSetDailyBudget(raw: unknown) {
  const p = BudgetParams.parse(raw), before = await campaigns.findOne(p.campaignId);
  if (!before || before.currency !== p.currency) throw new ToolError("CAMPAIGN_NOT_FOUND", "Campaign or currency mismatch");
  if (p.newDailyBudgetMinor > Number(process.env.MAX_DAILY_BUDGET_MINOR || 10000) || Math.abs(p.newDailyBudgetMinor / before.dailyBudgetMinor - 1) > Number(process.env.MAX_BUDGET_CHANGE_PERCENT || 60)/100) throw new ToolError("BUDGET_POLICY", "Budget outside policy");
  await campaigns.update(p.campaignId, { $set: { dailyBudgetMinor: p.newDailyBudgetMinor, updatedAt: new Date().toISOString() } });
  return { previousBudgetMinor: before.dailyBudgetMinor, newBudgetMinor: p.newDailyBudgetMinor, currency: p.currency, campaignId: p.campaignId };
}
