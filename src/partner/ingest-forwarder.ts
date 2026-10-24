import { createHash } from "node:crypto";
import { BusinessEventT } from "../contracts";
import { events, ingestForwards, orders } from "../store/repos";
import { PartnerActionEvent, PartnerActionEventT, PartnerIngestResult } from "./normal-contracts";

// Forwards this module's action-callback events to the intelligence service's POST /api/ingest/events, so its
// monitoring sees what the agents changed. Configured by NORMAL_INGEST_URL (+ NORMAL_INGEST_API_KEY). Forwarding
// never fails an execution: every attempt is recorded in `ingest_forwards`, and failed ones are retried.
const MAX_ATTEMPTS = 5;
const RETRY_AFTER_MS = 10_000;
const FORWARDED_TYPES = new Set(["campaign.budget_updated", "customer.message_sent", "storefront.banner_published"]);

export const ingestConfigured = () => Boolean(process.env.NORMAL_INGEST_URL);

/** Pseudonymous, stable customer ID: their contract needs one and our orders carry only name and email. */
const customerId = (email: string) => `cust_${createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 16)}`;

type Mapped = { event: PartnerActionEventT } | { skip: string };

export async function toPartnerEvent(event: BusinessEventT): Promise<Mapped> {
  const p = event.payload as Record<string, any>;
  const envelope = (source: "meta_ads" | "email" | "storefront", simulated: boolean) => ({
    schemaVersion: 1 as const, businessId: event.businessId, eventId: event.eventId, source,
    occurredAt: event.occurredAt, receivedAt: new Date().toISOString(),
    provenance: { sourceRecordId: event.eventId, connectorId: "normal_execution", simulated, ingestMethod: "action_callback" as const },
    ...(p.planId ? { correlationId: String(p.planId) } : {}),
  });
  switch (event.type) {
    case "campaign.budget_updated":
      return { event: PartnerActionEvent.parse({ ...envelope("meta_ads", true), type: event.type, payload: {
        campaignId: p.campaignId, previousDailyBudgetMinor: p.previousBudgetMinor, newDailyBudgetMinor: p.newBudgetMinor, currency: p.currency, actionId: p.actionId,
      } }) };
    case "storefront.banner_published": {
      const banner = p.after ?? {};
      return { event: PartnerActionEvent.parse({ ...envelope("storefront", true), type: event.type, payload: {
        bannerId: banner.bannerId, message: banner.message, startsAt: banner.startsAt, ...(banner.expiresAt ? { expiresAt: banner.expiresAt } : {}), actionId: p.actionId,
      } }) };
    }
    case "customer.message_sent": {
      // Their deliveryStatus has no "delivered": the provider's acceptance is forwarded once as "sent", and our
      // later delivery confirmation stays local rather than being sent as a second, identical-looking event.
      if (event.eventId.endsWith(":delivered")) return { skip: "delivery confirmation has no equivalent in @normal/contracts" };
      const status = ({ accepted: "sent", delivered: "sent", failed: "failed" } as Record<string, "sent" | "failed">)[p.status];
      if (!status) return { skip: `email status ${p.status} is not final` };
      const order = await orders.findOne(String(p.orderId));
      if (!order) return { skip: `order ${p.orderId} not found` };
      return { event: PartnerActionEvent.parse({ ...envelope("email", p.provider !== "resend"), type: event.type, payload: {
        messageId: p.providerOperationId || event.eventId, orderId: p.orderId, customerId: customerId(order.customerEmail),
        templateId: p.templateId, deliveryStatus: status, actionId: p.actionId,
      } }) };
    }
    default:
      return { skip: `${event.type} is not an action-callback event` };
  }
}

async function post(event: PartnerActionEventT): Promise<{ status: "accepted" | "duplicate" | "rejected" | "failed"; error?: string }> {
  const base = process.env.NORMAL_INGEST_URL!.replace(/\/$/, "");
  const key = process.env.NORMAL_INGEST_API_KEY;
  let response: Response;
  try {
    response = await fetch(`${base}/api/ingest/events?businessId=${encodeURIComponent(event.businessId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({ schemaVersion: 1, events: [event] }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    return { status: "failed", error: `ingest unreachable: ${error instanceof Error ? error.message : error}` };
  }
  const body = await response.json().catch(() => null);
  if (response.status === 400) return { status: "rejected", error: body?.error?.message || "ingest rejected the batch" };
  if (!response.ok) return { status: "failed", error: `ingest HTTP ${response.status}${body?.error?.code ? ` ${body.error.code}` : ""}` };
  const result = PartnerIngestResult.safeParse(body);
  if (!result.success) return { status: "failed", error: "ingest returned an unexpected result" };
  if (result.data.accepted > 0) return { status: "accepted" };
  if (result.data.duplicates > 0) return { status: "duplicate" };
  return { status: "rejected", error: response.headers.get("x-normal-rejections") || "ingest rejected the event" };
}

/** Maps and forwards one event; records the outcome. Never throws. */
export async function forwardEvent(event: BusinessEventT): Promise<void> {
  if (!ingestConfigured() || !FORWARDED_TYPES.has(event.type)) return;
  const planId = String((event.payload as Record<string, unknown>).planId ?? "");
  const now = () => new Date().toISOString();
  try {
    if (!await ingestForwards.claim(event.eventId, { eventId: event.eventId, planId, type: event.type, status: "failed", attempts: 0, updatedAt: now() })) return;
    let mapped: Mapped;
    try {
      mapped = await toPartnerEvent(event);
    } catch (error) {
      await ingestForwards.update(event.eventId, { $set: { status: "rejected", error: `could not map to @normal/contracts: ${error instanceof Error ? error.message : error}`, updatedAt: now() } });
      return;
    }
    if ("skip" in mapped) { await ingestForwards.update(event.eventId, { $set: { status: "skipped", error: mapped.skip, updatedAt: now() } }); return; }
    const sent = await post(mapped.event);
    await ingestForwards.update(event.eventId, { $set: { status: sent.status, attempts: 1, event: mapped.event, error: sent.error, updatedAt: now() } });
  } catch (error) {
    console.error(JSON.stringify({ event: "ingest_forward_failed", eventId: event.eventId, error: error instanceof Error ? error.message : String(error) }));
  }
}

/** Re-sends failed forwards, at most every RETRY_AFTER_MS and MAX_ATTEMPTS times each. */
export async function retryFailedForwards(planId?: string, nowMs = Date.now()): Promise<void> {
  if (!ingestConfigured()) return;
  const due = (await ingestForwards.find(planId ? { planId, status: "failed" } : { status: "failed" }))
    .filter(f => f.attempts < MAX_ATTEMPTS && nowMs - Date.parse(f.updatedAt) >= RETRY_AFTER_MS);
  for (const record of due) {
    // Claim the attempt first so overlapping polls don't post the same event twice.
    if (!await ingestForwards.compareAndSet(record.eventId, { status: "failed", attempts: record.attempts }, { attempts: record.attempts + 1, updatedAt: new Date(nowMs).toISOString() })) continue;
    try {
      // A forward interrupted before mapping has no stored event yet: map it again from the original.
      let event = record.event ? PartnerActionEvent.parse(record.event) : undefined;
      if (!event) {
        const original = await events.findOne(record.eventId);
        const mapped = original ? await toPartnerEvent(original) : { skip: "original event not found" };
        if ("skip" in mapped) { await ingestForwards.update(record.eventId, { $set: { status: "skipped", error: mapped.skip, updatedAt: new Date().toISOString() } }); continue; }
        event = mapped.event;
      }
      const sent = await post(event);
      await ingestForwards.update(record.eventId, { $set: { status: sent.status, event, error: sent.error, updatedAt: new Date().toISOString() } });
    } catch (error) {
      await ingestForwards.update(record.eventId, { $set: { error: error instanceof Error ? error.message : String(error), updatedAt: new Date().toISOString() } });
    }
  }
}
