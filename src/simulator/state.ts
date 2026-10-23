import { BusinessEventT } from "../contracts";

export interface SimulatedCampaign {
  campaignId: string;
  name: string;
  dailyBudgetMinor: number;
  currency: string;
  status: "active" | "paused";
  updatedAt: string;
}

export interface SimulatedOrder {
  orderId: string;
  customerName: string;
  customerEmail: string;
  items: string[];
  promisedDeliveryDate: string;
  carrier: string;
  trackingNumber: string;
  status: "delayed" | "in_transit" | "delivered";
}

export interface SimulatedBanner {
  bannerId: string;
  message: string;
  startsAt: string;
  expiresAt: string;
  active: boolean;
  publishedAt: string;
}

export interface DispatchedEmail {
  messageId: string;
  providerOperationId: string;
  to: string;
  orderId: string;
  subject: string;
  body: string;
  sentAt: string;
  mubitRequestId?: string;
  modelUsed?: string;
}

class SimulatorState {
  private campaigns: Map<string, SimulatedCampaign> = new Map();
  private orders: Map<string, SimulatedOrder> = new Map();
  private activeBanner: SimulatedBanner | null = null;
  private dispatchedEmails: DispatchedEmail[] = [];
  private eventLog: BusinessEventT[] = [];

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.campaigns.clear();
    this.orders.clear();
    this.dispatchedEmails = [];
    this.eventLog = [];
    this.activeBanner = null;

    // Seed baseline Nova Store state
    this.campaigns.set("campaign_A", {
      campaignId: "campaign_A",
      name: "Meta Prospecting Autumn 2026",
      dailyBudgetMinor: 5000, // £50.00
      currency: "GBP",
      status: "active",
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
    });

    this.orders.set("ord_001", {
      orderId: "ord_001",
      customerName: "Emma Watson",
      customerEmail: "emma.watson.test@normalops.internal",
      items: ["Oversized Merino Knit"],
      promisedDeliveryDate: new Date(Date.now() - 3600000 * 48).toISOString(),
      carrier: "Royal Mail 48 Tracked",
      trackingNumber: "GB982341230",
      status: "delayed",
    });

    this.orders.set("ord_002", {
      orderId: "ord_002",
      customerName: "Liam Davies",
      customerEmail: "liam.davies.test@normalops.internal",
      items: ["Canvas Heavyweight Tote"],
      promisedDeliveryDate: new Date(Date.now() - 3600000 * 36).toISOString(),
      carrier: "DPD Express",
      trackingNumber: "DPD88239019",
      status: "delayed",
    });
  }

  // --- Campaign Ads Methods ---
  public getCampaign(campaignId: string): SimulatedCampaign | undefined {
    return this.campaigns.get(campaignId);
  }

  public updateCampaignBudget(campaignId: string, newDailyBudgetMinor: number): SimulatedCampaign {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }
    const previousBudget = campaign.dailyBudgetMinor;
    campaign.dailyBudgetMinor = newDailyBudgetMinor;
    campaign.updatedAt = new Date().toISOString();
    this.campaigns.set(campaignId, campaign);

    // Emit business event
    this.emitEvent({
      schemaVersion: 1,
      eventId: `evt_ads_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      businessId: "nova_store",
      type: "campaign.budget_updated",
      payload: {
        campaignId,
        previousDailyBudgetMinor: previousBudget,
        newDailyBudgetMinor,
        currency: campaign.currency,
      },
      occurredAt: campaign.updatedAt,
      receivedAt: campaign.updatedAt,
      source: "marketing_agent",
    });

    return campaign;
  }

  // --- Order & Email Methods ---
  public getOrder(orderId: string): SimulatedOrder | undefined {
    return this.orders.get(orderId);
  }

  public listDelayedOrders(): SimulatedOrder[] {
    return Array.from(this.orders.values()).filter((o) => o.status === "delayed");
  }

  public recordDispatchedEmail(email: DispatchedEmail): void {
    this.dispatchedEmails.push(email);

    // Emit business event
    this.emitEvent({
      schemaVersion: 1,
      eventId: `evt_email_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      businessId: "nova_store",
      type: "customer.message_sent",
      payload: {
        orderId: email.orderId,
        messageId: email.messageId,
        to: email.to,
        subject: email.subject,
        providerOperationId: email.providerOperationId,
      },
      occurredAt: email.sentAt,
      receivedAt: email.sentAt,
      source: "customer_care_agent",
    });
  }

  public getDispatchedEmails(): DispatchedEmail[] {
    return [...this.dispatchedEmails];
  }

  // --- Storefront Methods ---
  public publishStorefrontBanner(banner: {
    bannerId: string;
    message: string;
    startsAt: string;
    expiresAt: string;
  }): SimulatedBanner {
    const now = new Date().toISOString();
    const publishedBanner: SimulatedBanner = {
      ...banner,
      active: true,
      publishedAt: now,
    };
    this.activeBanner = publishedBanner;

    // Emit business event
    this.emitEvent({
      schemaVersion: 1,
      eventId: `evt_banner_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      businessId: "nova_store",
      type: "storefront.banner_published",
      payload: {
        bannerId: banner.bannerId,
        message: banner.message,
        startsAt: banner.startsAt,
        expiresAt: banner.expiresAt,
      },
      occurredAt: now,
      receivedAt: now,
      source: "storefront_agent",
    });

    return publishedBanner;
  }

  public getStorefrontBanner(): SimulatedBanner | null {
    return this.activeBanner;
  }

  // --- Event Emission ---
  public emitEvent(event: BusinessEventT): void {
    this.eventLog.push(event);
  }

  public getEvents(): BusinessEventT[] {
    return [...this.eventLog];
  }

  public getSnapshot(): {
    campaigns: SimulatedCampaign[];
    orders: SimulatedOrder[];
    activeBanner: SimulatedBanner | null;
    dispatchedEmails: DispatchedEmail[];
    eventCount: number;
  } {
    return {
      campaigns: Array.from(this.campaigns.values()),
      orders: Array.from(this.orders.values()),
      activeBanner: this.activeBanner,
      dispatchedEmails: this.dispatchedEmails,
      eventCount: this.eventLog.length,
    };
  }
}

export const simulatorState = new SimulatorState();
