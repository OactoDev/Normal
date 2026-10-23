import {
  BusinessEventT,
  BusinessEventType,
  ScenarioName,
  SimulatorRunT,
  ScenarioGroundTruthT,
  RootCauseT,
} from "../contracts";

export interface SimulationState {
  run: SimulatorRunT;
  groundTruth: ScenarioGroundTruthT;
  events: BusinessEventT[];
}

export class TelemetrySimulator {
  private state: SimulationState;

  constructor() {
    this.state = this.createInitialState("healthy", 0.1);
  }

  private createInitialState(
    scenario: "healthy" | "ad_fatigue" | "delivery_delays" | "negative_reviews" | "promo_checkout_failure" | "viral_demand",
    severity: number
  ): SimulationState {
    const runId = `sim_${Date.now()}`;
    const now = new Date().toISOString();

    const actualCausesMap: Record<typeof scenario, RootCauseT[]> = {
      healthy: ["unknown"],
      delivery_delays: ["delivery_delays"],
      ad_fatigue: ["ad_fatigue", "ad_inefficiency"],
      negative_reviews: ["negative_sentiment", "product_quality"],
      promo_checkout_failure: ["checkout_failure", "discount_failure"],
      viral_demand: ["viral_demand", "stockout"],
    };

    return {
      run: {
        schemaVersion: 1,
        simulationRunId: runId,
        seed: 42,
        status: "running",
        virtualTime: now,
        minutesPerTick: 15,
        activeScenario: scenario,
        scenarioSeverity: severity,
        createdAt: now,
        updatedAt: now,
      },
      groundTruth: {
        simulationRunId: runId,
        scenario,
        actualCauses: actualCausesMap[scenario],
        hiddenFaultParameters: {
          injectedAt: now,
          nominalSeverity: severity,
          faultVector: scenario,
        },
      },
      events: [],
    };
  }

  public injectScenario(
    scenario: "healthy" | "ad_fatigue" | "delivery_delays" | "negative_reviews" | "promo_checkout_failure" | "viral_demand",
    severity: number = 0.8
  ): SimulationState {
    this.state = this.createInitialState(scenario, severity);
    // Generate initial batch of scenario events
    this.tick(2);
    return this.state;
  }

  public getState(): SimulationState {
    return this.state;
  }

  public getEvents(): BusinessEventT[] {
    return this.state.events;
  }

  public tick(ticks: number = 1): { generatedEvents: BusinessEventT[]; virtualTime: string } {
    const generated: BusinessEventT[] = [];
    const scenario = this.state.run.activeScenario;
    const severity = this.state.run.scenarioSeverity;

    for (let t = 0; t < ticks; t++) {
      // Advance virtual time by 15 minutes per tick
      const currentTimeMs = new Date(this.state.run.virtualTime).getTime();
      const nextTimeMs = currentTimeMs + 15 * 60 * 1000;
      const nextTime = new Date(nextTimeMs).toISOString();
      this.state.run.virtualTime = nextTime;
      this.state.run.updatedAt = nextTime;

      const tickEvents = this.generateEventsForScenario(scenario, severity, nextTime);
      generated.push(...tickEvents);
    }

    this.state.events.push(...generated);
    return {
      generatedEvents: generated,
      virtualTime: this.state.run.virtualTime,
    };
  }

  private generateEventsForScenario(
    scenario: string,
    severity: number,
    time: string
  ): BusinessEventT[] {
    const events: BusinessEventT[] = [];
    const idPrefix = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Baseline order completed event
    events.push({
      schemaVersion: 1,
      eventId: `${idPrefix}_ord_base`,
      businessId: "nova_store",
      occurredAt: time,
      receivedAt: time,
      source: "ecommerce_store",
      type: "order.completed",
      payload: {
        orderId: `ord_${Math.floor(Math.random() * 9000 + 1000)}`,
        totalMinor: 4800,
        currency: "GBP",
        itemsCount: 2,
        channel: "web",
      },
    });

    if (scenario === "delivery_delays") {
      // Shipping SLA breaches
      const delayedCount = Math.round(5 * severity) + 3;
      for (let i = 0; i < delayedCount; i++) {
        events.push({
          schemaVersion: 1,
          eventId: `${idPrefix}_del_${i}`,
          businessId: "nova_store",
          occurredAt: time,
          receivedAt: time,
          source: "shipping_platform",
          type: "delivery.status_changed",
          payload: {
            orderId: `ord_del_${i + 1}`,
            status: "delayed",
            carrier: "Royal Mail Tracked 24",
            promisedDeliveryDate: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
            estimatedDeliveryDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
            delayHours: 48 + i * 6,
          },
        });
      }

      // Negative review due to shipping
      events.push({
        schemaVersion: 1,
        eventId: `${idPrefix}_rev_01`,
        businessId: "nova_store",
        occurredAt: time,
        receivedAt: time,
        source: "review_platform",
        type: "review.created",
        payload: {
          reviewId: `rev_${Date.now()}`,
          rating: 1,
          comment: "Package has still not arrived after 4 days! No update from support.",
          orderId: "ord_del_1",
        },
      });
    } else if (scenario === "ad_fatigue") {
      // Ad cost spike & CTR drop
      events.push({
        schemaVersion: 1,
        eventId: `${idPrefix}_ad_01`,
        businessId: "nova_store",
        occurredAt: time,
        receivedAt: time,
        source: "ad_platform",
        type: "ad.metrics_observed",
        payload: {
          campaignId: "campaign_A",
          impressions: 12000,
          clicks: 140,
          spendMinor: 5000,
          frequency: 3.8,
          cacMinor: 3850,
          previousCacMinor: 1820,
        },
      });
    } else if (scenario === "promo_checkout_failure") {
      // Checkout failure spikes
      const failCount = Math.round(8 * severity) + 4;
      for (let i = 0; i < failCount; i++) {
        events.push({
          schemaVersion: 1,
          eventId: `${idPrefix}_chk_${i}`,
          businessId: "nova_store",
          occurredAt: time,
          receivedAt: time,
          source: "store_checkout",
          type: "checkout.failed",
          payload: {
            sessionId: `sess_${i + 100}`,
            failureCode: "COUPON_APPLY_TIMEOUT",
            cartValueMinor: 5500,
            couponCode: "SAVE20",
          },
        });
      }
    } else if (scenario === "negative_reviews") {
      // Deteriorating customer reviews
      events.push({
        schemaVersion: 1,
        eventId: `${idPrefix}_rev_qual`,
        businessId: "nova_store",
        occurredAt: time,
        receivedAt: time,
        source: "review_platform",
        type: "review.created",
        payload: {
          reviewId: `rev_q_${Date.now()}`,
          rating: 1,
          comment: "Fabric feels thin and zipper broke on first use.",
          productId: "prod_jacket_01",
        },
      });
    } else if (scenario === "viral_demand") {
      // Rapid orders + inventory warnings
      events.push({
        schemaVersion: 1,
        eventId: `${idPrefix}_inv_depleted`,
        businessId: "nova_store",
        occurredAt: time,
        receivedAt: time,
        source: "inventory_platform",
        type: "inventory.level_changed",
        payload: {
          productId: "prod_viral_01",
          availableUnits: 3,
          reservedUnits: 45,
          lowStockThreshold: 10,
        },
      });
    }

    return events;
  }
}

export const telemetrySimulator = new TelemetrySimulator();
