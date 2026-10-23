import { EvidenceT, InvestigationT, AnomalyT, BusinessEventT } from "../contracts";

export class EvidenceCollector {
  public assembleInvestigation(
    anomalies: AnomalyT[],
    events: BusinessEventT[]
  ): { investigation: InvestigationT; evidence: EvidenceT[] } {
    const investigationId = `inv_${Date.now()}`;
    const now = new Date().toISOString();
    const evidence: EvidenceT[] = [];

    // Synthesize Evidence from Anomalies and Events
    for (const anom of anomalies) {
      if (anom.metric === "late_delivery_rate") {
        const delayedDeliveries = events.filter(
          (e) =>
            e.type === "delivery.status_changed" &&
            (e.payload as { status?: string }).status === "delayed"
        );
        evidence.push({
          schemaVersion: 1,
          evidenceId: `e_ship_${Date.now()}`,
          investigationId,
          businessId: "nova_store",
          observedFact: `${delayedDeliveries.length} tracked orders breached delivery SLA promise dates by >48 hours.`,
          measurements: {
            delayedOrdersCount: delayedDeliveries.length,
            lateDeliveryRate: anom.currentValue,
            slaBreachThresholdHours: 48,
          },
          sourceRecordIds: delayedDeliveries.map((d) => d.eventId).slice(0, 5),
          retrievedAt: now,
        });
      } else if (anom.metric === "cac_minor") {
        const adEvents = events.filter((e) => e.type === "ad.metrics_observed");
        evidence.push({
          schemaVersion: 1,
          evidenceId: `e_ads_${Date.now()}`,
          investigationId,
          businessId: "nova_store",
          observedFact: `Meta Campaign A customer acquisition cost (CAC) jumped from £18.20 to £38.50 with declining clickthrough.`,
          measurements: {
            currentCacMinor: anom.currentValue,
            baselineCacMinor: anom.baselineValue,
            cacInflationPercent: Math.round(((anom.currentValue - anom.baselineValue) / anom.baselineValue) * 100),
          },
          sourceRecordIds: adEvents.map((a) => a.eventId).slice(0, 3),
          retrievedAt: now,
        });
      } else if (anom.metric === "checkout_failure_rate") {
        const checkouts = events.filter((e) => e.type === "checkout.failed");
        evidence.push({
          schemaVersion: 1,
          evidenceId: `e_chk_${Date.now()}`,
          investigationId,
          businessId: "nova_store",
          observedFact: `Checkout step failure rate surged to 18% with repeated COUPON_APPLY_TIMEOUT errors.`,
          measurements: {
            failureRate: anom.currentValue,
            failedSessionCount: checkouts.length,
          },
          sourceRecordIds: checkouts.map((c) => c.eventId).slice(0, 5),
          retrievedAt: now,
        });
      } else if (anom.metric === "negative_review_spike") {
        const reviews = events.filter((e) => e.type === "review.created");
        evidence.push({
          schemaVersion: 1,
          evidenceId: `e_rev_${Date.now()}`,
          investigationId,
          businessId: "nova_store",
          observedFact: `Surge in 1-star customer ratings citing severe fulfilment delays and missing updates.`,
          measurements: {
            newLowRatingReviewsCount: reviews.length,
          },
          sourceRecordIds: reviews.map((r) => r.eventId).slice(0, 3),
          retrievedAt: now,
        });
      }
    }

    const investigation: InvestigationT = {
      schemaVersion: 1,
      investigationId,
      businessId: "nova_store",
      anomalyIds: anomalies.map((a) => a.anomalyId),
      status: "active",
      evidenceIds: evidence.map((e) => e.evidenceId),
      createdAt: now,
      updatedAt: now,
    };

    return { investigation, evidence };
  }
}

export const evidenceCollector = new EvidenceCollector();
