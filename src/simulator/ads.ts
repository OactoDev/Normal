import { randomUUID } from "node:crypto";
import { BusinessEvent } from "../contracts";
import { campaigns, adMetrics, events } from "../store/repos";
import { seedSimulator } from "./state";

/** Each tick represents 15 minutes. Values are simulated estimates, not real ad-platform data. */
export async function tickAds(occurredAt: string, fatigued: boolean) {
  await seedSimulator();
  const generated = [];
  for (const campaign of await campaigns.find()) {
    // Re-read CSV configuration on every tick, including after a process restart.
    const spendMinor = campaign.status === "paused" ? 0 : Math.floor(campaign.dailyBudgetMinor / 96);
    const impressions = Math.floor(spendMinor * (fatigued ? 6 : 10));
    const clicks = Math.floor(impressions * (fatigued ? 0.012 : 0.025));
    // A fatigued creative is shown to the same people too often. Frequency, and with it CAC, scales with the budget:
    // £50/day gives frequency 3.8 and £38.50 CAC; a cut lowers both but does not reach the 1.5 / £18.20 baseline.
    const load = campaign.dailyBudgetMinor / 5000;
    const frequency = fatigued ? Math.round((1.5 + 2.3 * load) * 10) / 10 : 1.5;
    const cacMinor = fatigued ? Math.round(1820 + 2030 * load) : 1820;
    const metricId = randomUUID();
    const metric = await adMetrics.insert(metricId, { metricId, campaignId: campaign.campaignId, simulated: true, occurredAt, dailyBudgetMinor: campaign.dailyBudgetMinor, spendMinor, impressions, clicks, estimatedConversions: spendMinor / cacMinor, cacMinor, currency: campaign.currency });
    const event = BusinessEvent.parse({ eventId: `ads_${metricId}`, businessId: campaign.businessId, type: "ad.metrics_observed", payload: { ...metric, previousCacMinor: 1820, frequency }, occurredAt, receivedAt: new Date().toISOString(), source: "simulated_nike_ads" });
    await events.insert(event.eventId,event);
    generated.push(event);
  }
  return generated;
}
