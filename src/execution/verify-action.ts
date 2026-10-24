import { ActionProposalT } from "../contracts";
import { BudgetParams, BannerParams } from "./action-params";
import { campaigns, storefront, emails } from "../store/repos";
import { ToolError } from "./retry-policy";
export async function verifyAction(action: ActionProposalT, key: string) {
  if (action.actionType === "ads.set_daily_budget") {
    const p = BudgetParams.parse(action.params), readBack = await campaigns.findOne(p.campaignId);
    if (readBack?.dailyBudgetMinor === p.newDailyBudgetMinor && readBack.currency === p.currency) return { readBack, verification: "Simulated Ads Manager budget confirmed by read-back" };
  } else if (action.actionType === "storefront.publish_banner") {
    const p = BannerParams.parse(action.params), readBack = await storefront.findOne(p.bannerId);
    if (readBack?.active && readBack.message === p.message && readBack.startsAt === p.startsAt && readBack.expiresAt === p.expiresAt && Date.parse(readBack.expiresAt) > Date.now()) return { readBack, verification: Date.parse(p.startsAt) <= Date.now() ? "Storefront banner active; config read-back verified" : "Storefront banner scheduled; config read-back verified" };
  } else {
    const readBack = (await emails.find()).filter(e => e.key.startsWith(`${key}:`));
    if (readBack.length && readBack.every(e => ["accepted", "delivered"].includes(e.status))) return { readBack, verification: `${readBack.length} messages accepted by provider; delivery remains under monitoring` };
  }
  throw new ToolError("VERIFICATION_FAILED", "Tool read-back did not confirm requested effect", true);
}
