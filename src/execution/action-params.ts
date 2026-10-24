import { z } from "zod";
import { ToolError } from "./retry-policy";
export const BudgetParams = z.object({ campaignId: z.string().min(1), newDailyBudgetMinor: z.number().int().positive(), currency: z.string().length(3) }).strict();
export const EmailParams = z.object({ orderIds: z.array(z.string().min(1)).min(1).max(25), templateId: z.literal("shipping_delay_v1"), maxRecipients: z.number().int().positive().max(25) }).strict();
export const BannerParams = z.object({ bannerId: z.string().min(1), message: z.string().trim().min(1).max(200), startsAt: z.string().datetime(), expiresAt: z.string().datetime() }).strict();
export function parseParams(type: string, params: unknown) {
  switch (type) {
    case "ads.set_daily_budget": return BudgetParams.parse(params);
    case "customer.send_delay_notice": return EmailParams.parse(params);
    case "storefront.publish_banner": return BannerParams.parse(params);
    default: throw new ToolError("UNSUPPORTED_TOOL", `Unsupported action: ${type}`);
  }
}
