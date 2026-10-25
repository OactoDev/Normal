import {
  BusinessEventT,
  BusinessEventType,
  ScenarioName,
  SimulatorRunT,
  ScenarioGroundTruthT,
  RootCauseT,
} from "../contracts";
import { tickAds } from "../simulator/ads";
import { emails, storefront } from "../store/repos";

/** What Normal's agents have done since this simulation run began, which the simulated customers react to. */
export interface Mitigations { delayNoticeSent: boolean; bannerLive: boolean }

async function currentMitigations(since: string): Promise<Mitigations> {
  const now = Date.now();
  const sent = (await emails.find()).some(e => ["accepted", "delivered"].includes(e.status) && e.sentAt >= since);
  const live = (await storefront.find()).some(b => b.active && b.publishedAt >= since && Date.parse(b.startsAt) <= now && Date.parse(b.expiresAt) > now);
  return { delayNoticeSent: sent, bannerLive: live };
}

export interface SimulationState {
  run: SimulatorRunT;
  groundTruth: ScenarioGroundTruthT;
  events: BusinessEventT[];
}

export class TelemetrySimulator {
  public ingestExternalEvents(events: BusinessEventT[]): void {
    const existing = new Set(this.state.events.map(e => e.eventId));
    this.state.events.push(...events.filter(e => !existing.has(e.eventId)));
  }
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

  public async injectScenario(
    scenario: "healthy" | "ad_fatigue" | "delivery_delays" | "negative_reviews" | "promo_checkout_failure" | "viral_demand",
    severity: number = 0.8
  ): Promise<SimulationState> {
    this.state = this.createInitialState(scenario, severity);
    // Generate initial batch of scenario events
    await this.tick(2);
    return this.state;
  }

  public getState(): SimulationState {
    return this.state;
  }

  public getEvents(): BusinessEventT[] {
    return this.state.events;
  }

  public async tick(ticks: number = 1): Promise<{ generatedEvents: BusinessEventT[]; virtualTime: string }> {
    const generated: BusinessEventT[] = [];
    const scenario = this.state.run.activeScenario;
    const severity = this.state.run.scenarioSeverity;
    const mitigations = await currentMitigations(this.state.run.createdAt);

    for (let t = 0; t < ticks; t++) {
      // Advance virtual time by 15 minutes per tick
      const currentTimeMs = new Date(this.state.run.virtualTime).getTime();
      const nextTimeMs = currentTimeMs + 15 * 60 * 1000;
      const nextTime = new Date(nextTimeMs).toISOString();
      this.state.run.virtualTime = nextTime;
      this.state.run.updatedAt = nextTime;

      const tickEvents = this.generateEventsForScenario(scenario, severity, nextTime, mitigations);
      generated.push(...tickEvents);
      generated.push(...await tickAds(nextTime, scenario === "ad_fatigue"));
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
    time: string,
    mitigations: Mitigations = { delayNoticeSent: false, bannerLive: false }
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

      // Simulated customer response: delayed customers who heard nothing contact support and leave angry reviews.
      // A delay email answers most of them; a store notice alone answers fewer. The carrier delay itself is unchanged.
      const contactRate = mitigations.delayNoticeSent ? 0.15 : mitigations.bannerLive ? 0.4 : 0.6;
      const tickets = Math.round(delayedCount * contactRate);
      for (let i = 0; i < tickets; i++) {
        events.push({
          schemaVersion: 1,
          eventId: `${idPrefix}_tkt_${i}`,
          businessId: "nova_store",
          occurredAt: time,
          receivedAt: time,
          source: "helpdesk",
          type: "support.ticket_created",
          payload: { ticketId: `tkt_${idPrefix}_${i}`, orderId: `ord_del_${i + 1}`, topic: "where_is_my_order" },
        });
      }

      // Negative review due to shipping, from a customer who got no update
      if (!mitigations.delayNoticeSent) events.push({
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
      // Budget-aware ad metrics are generated by tickAds for every scenario.
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

// Next.js loads each route's modules separately, so a plain module-level instance would give the intelligence
// routes and the plan routes different simulators. One instance per process keeps the scenario, its events and
// the outcome measurement on the same stream.
const shared = globalThis as typeof globalThis & { normalTelemetrySimulator?: TelemetrySimulator };
export const telemetrySimulator = shared.normalTelemetrySimulator ??= new TelemetrySimulator();
