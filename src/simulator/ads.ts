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
    const cacMinor = fatigued ? 3850 : 1820;
    const metricId = randomUUID();
    const metric = await adMetrics.insert(metricId, { metricId, campaignId: campaign.campaignId, simulated: true, occurredAt, dailyBudgetMinor: campaign.dailyBudgetMinor, spendMinor, impressions, clicks, estimatedConversions: spendMinor / cacMinor, cacMinor, currency: campaign.currency });
    const event = BusinessEvent.parse({ eventId: `ads_${metricId}`, businessId: campaign.businessId, type: "ad.metrics_observed", payload: { ...metric, previousCacMinor: 1820, frequency: fatigued ? 3.8 : 1.5 }, occurredAt, receivedAt: new Date().toISOString(), source: "simulated_nike_ads" });
    await events.insert(event.eventId,event);
    generated.push(event);
  }
  return generated;
}
