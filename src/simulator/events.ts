import { BusinessEvent, BusinessEventT } from "../contracts";
import { events } from "../store/repos";
import { telemetrySimulator } from "../intelligence/telemetry-simulator";
import { forwardEvent } from "../partner/ingest-forwarder";
export async function emitEvent(key: string, type: BusinessEventT["type"], payload: Record<string, unknown>) {
  const now = new Date().toISOString();
  const event = BusinessEvent.parse({ eventId: key, businessId: "nova_store", type, payload, occurredAt: now, receivedAt: now, source: "normal_execution" });
  if (!await events.claim(key,event)) return;
  telemetrySimulator.ingestExternalEvents([event]);
  // Also hand action-callback events to the intelligence service's ingest, when one is configured.
  await forwardEvent(event);
}
