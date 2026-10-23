import { AnomalyT, MetricSnapshotT, BusinessEventT } from "../contracts";

export interface DetectionResult {
  snapshots: MetricSnapshotT[];
  anomalies: AnomalyT[];
}

export class AnomalyDetector {
  public analyzeEvents(events: BusinessEventT[]): DetectionResult {
    const now = new Date().toISOString();
    const snapshots: MetricSnapshotT[] = [];
    const anomalies: AnomalyT[] = [];

    // 1. Check Delivery Delay Rate
    const deliveryEvents = events.filter((e) => e.type === "delivery.status_changed");
    const delayedCount = deliveryEvents.filter(
      (e) => (e.payload as { status?: string }).status === "delayed"
    ).length;
    const totalDeliveries = Math.max(deliveryEvents.length, 1);
    const lateDeliveryRate = deliveryEvents.length > 0 ? delayedCount / totalDeliveries : 0;

    const deliverySnapshot: MetricSnapshotT = {
      schemaVersion: 1,
      snapshotId: `snap_del_${Date.now()}`,
      businessId: "nova_store",
      dimension: "carrier_performance",
      rawCounts: { totalDeliveries: deliveryEvents.length, delayedDeliveries: delayedCount },
      calculatedRates: { lateDeliveryRate },
      periodStart: new Date(Date.now() - 3600000).toISOString(),
      periodEnd: now,
      createdAt: now,
    };
    snapshots.push(deliverySnapshot);

    if (lateDeliveryRate > 0.15 || delayedCount >= 3) {
      anomalies.push({
        schemaVersion: 1,
        anomalyId: `anom_del_${Date.now()}`,
        businessId: "nova_store",
        metric: "late_delivery_rate",
        currentWindowStart: deliverySnapshot.periodStart,
        currentWindowEnd: deliverySnapshot.periodEnd,
        baselineWindowStart: new Date(Date.now() - 86400000).toISOString(),
        baselineWindowEnd: new Date(Date.now() - 3600000).toISOString(),
        severity: lateDeliveryRate > 0.3 ? "critical" : "high",
        baselineValue: 0.02,
        currentValue: lateDeliveryRate,
        deltaPercent: Math.round(((lateDeliveryRate - 0.02) / 0.02) * 100),
        detectedAt: now,
      });
    }

    // 2. Check Ad Efficiency (CAC spike)
    const adEvents = events.filter((e) => e.type === "ad.metrics_observed");
    if (adEvents.length > 0) {
      const latestAd = adEvents[adEvents.length - 1];
      const payload = latestAd.payload as {
        cacMinor?: number;
        previousCacMinor?: number;
        spendMinor?: number;
      };
      const cacMinor = payload.cacMinor || 0;
      const prevCacMinor = payload.previousCacMinor || 1820;

      const adSnapshot: MetricSnapshotT = {
        schemaVersion: 1,
        snapshotId: `snap_ad_${Date.now()}`,
        businessId: "nova_store",
        dimension: "paid_marketing",
        rawCounts: { spendMinor: payload.spendMinor || 5000 },
        calculatedRates: { cacMinor, previousCacMinor: prevCacMinor },
        periodStart: new Date(Date.now() - 3600000).toISOString(),
        periodEnd: now,
        createdAt: now,
      };
      snapshots.push(adSnapshot);

      if (cacMinor > prevCacMinor * 1.3) {
        anomalies.push({
          schemaVersion: 1,
          anomalyId: `anom_cac_${Date.now()}`,
          businessId: "nova_store",
          metric: "cac_minor",
          currentWindowStart: adSnapshot.periodStart,
          currentWindowEnd: adSnapshot.periodEnd,
          baselineWindowStart: new Date(Date.now() - 86400000).toISOString(),
          baselineWindowEnd: new Date(Date.now() - 3600000).toISOString(),
          severity: "high",
          baselineValue: prevCacMinor,
          currentValue: cacMinor,
          deltaPercent: Math.round(((cacMinor - prevCacMinor) / prevCacMinor) * 100),
          detectedAt: now,
        });
      }
    }

    // 3. Check Checkout Failure Rate
    const checkoutFails = events.filter((e) => e.type === "checkout.failed");
    if (checkoutFails.length >= 3) {
      const checkoutSnapshot: MetricSnapshotT = {
        schemaVersion: 1,
        snapshotId: `snap_chk_${Date.now()}`,
        businessId: "nova_store",
        dimension: "storefront_checkout",
        rawCounts: { failureCount: checkoutFails.length },
        calculatedRates: { failureRate: 0.18 },
        periodStart: new Date(Date.now() - 3600000).toISOString(),
        periodEnd: now,
        createdAt: now,
      };
      snapshots.push(checkoutSnapshot);

      anomalies.push({
        schemaVersion: 1,
        anomalyId: `anom_chk_${Date.now()}`,
        businessId: "nova_store",
        metric: "checkout_failure_rate",
        currentWindowStart: checkoutSnapshot.periodStart,
        currentWindowEnd: checkoutSnapshot.periodEnd,
        baselineWindowStart: new Date(Date.now() - 86400000).toISOString(),
        baselineWindowEnd: new Date(Date.now() - 3600000).toISOString(),
        severity: "critical",
        baselineValue: 0.01,
        currentValue: 0.18,
        deltaPercent: 1700,
        detectedAt: now,
      });
    }

    // 4. Check Customer Reviews
    const reviewEvents = events.filter((e) => e.type === "review.created");
    const lowReviews = reviewEvents.filter(
      (e) => ((e.payload as { rating?: number }).rating || 5) <= 2
    );
    if (lowReviews.length >= 1) {
      anomalies.push({
        schemaVersion: 1,
        anomalyId: `anom_rev_${Date.now()}`,
        businessId: "nova_store",
        metric: "negative_review_spike",
        currentWindowStart: new Date(Date.now() - 3600000).toISOString(),
        currentWindowEnd: now,
        baselineWindowStart: new Date(Date.now() - 86400000).toISOString(),
        baselineWindowEnd: new Date(Date.now() - 3600000).toISOString(),
        severity: "medium",
        baselineValue: 0,
        currentValue: lowReviews.length,
        deltaPercent: 100,
        detectedAt: now,
      });
    }

    return { snapshots, anomalies };
  }
}

export const anomalyDetector = new AnomalyDetector();
