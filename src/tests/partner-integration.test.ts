// The intelligence team's @normal/contracts PlanHandoff runs through approval and execution here, and the
// resulting action events reach their POST /api/ingest/events in their own event format.
// Fixture: packages/contracts/examples/plan-handoff.json from github.com/OactoDev/Normal (main, 4d4623c).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PlanHandoff, PlanHandoffT } from "../contracts";
import { fromPartnerHandoff, parseAnyHandoff } from "../partner/handoff-adapter";
import { PartnerActionEvent, PartnerActionEventT } from "../partner/normal-contracts";
import { retryFailedForwards } from "../partner/ingest-forwarder";
import { orchestrator } from "../agents/orchestrator";
import { createApproval } from "../execution/validate-approval";
import { loadPlanHandoff } from "../execution/load-plan";
import { resetDemo } from "../simulator/reset";
import { emitEvent } from "../simulator/events";
import * as store from "../store/repos";

(process.env as Record<string, string>).NODE_ENV = "test";
process.env.NORMAL_STORE = "memory";
process.env.EMAIL_PROVIDER = "memory";
process.env.EXECUTION_STEP_DELAY_MS = "0";
const OWNER = "merchant_owner_01";
const example = JSON.parse(fs.readFileSync(path.join(__dirname, "../fixtures/partner/plan-handoff.contracts-example.json"), "utf8"));

function mappingKeepsTheirMeaning() {
  const h = fromPartnerHandoff(example);
  PlanHandoff.parse(h);
  assert.equal(h.diagnosis.output.primaryCause, example.diagnosis.primaryCause);
  assert.equal(h.diagnosis.output.summary, example.diagnosis.summary);
  assert.deepEqual(h.diagnosis.output.supportedHypotheses.map(x => [x.cause, x.strength, x.rationale]), example.diagnosis.hypotheses.map((x: any) => [x.cause, x.strength, x.explanation]));
  assert.equal(h.diagnosis.serverAttribution.importedFrom, "@normal/contracts");
  assert.equal(h.diagnosis.serverAttribution.verifiedByRules, false, "their diagnosis is not claimed as checked here");
  const [first] = example.evidence;
  const mapped = h.evidence.find(e => e.evidenceId === first.evidenceId)!;
  assert.equal(mapped.observedFact, `${first.title}: ${first.observation}`);
  assert.equal(mapped.measurements[first.measurements[0].metric], first.measurements[0].value);
  assert.deepEqual(mapped.sourceRecordIds, first.sourceRecords.map((r: any) => `${r.collection}/${r.recordId}`));
  assert.deepEqual(h.plan.actions.map(a => a.actionId), example.plan.actions.map((a: any) => a.actionId));
  // Their DateTime allows offsets; ours is UTC. The instant must not move.
  const offset = structuredClone(example);
  offset.plan.createdAt = "2026-10-23T20:03:00+01:00";
  assert.equal(fromPartnerHandoff(offset).plan.createdAt, "2026-10-23T19:03:00.000Z");
  // Our own format still passes straight through; anything else is a clear upstream error.
  assert.deepEqual(parseAnyHandoff(h), h);
  assert.throws(() => parseAnyHandoff({ plan: {}, diagnosis: {}, evidence: [] }), (e: any) => e.code === "INTELLIGENCE_INVALID" && e.status === 502);
  console.log("✅ @normal/contracts PlanHandoff maps to ours without losing their diagnosis or evidence");
}

/** Their example plan, with its time window moved to now so it can be approved and executed. */
function livePartnerPlan(planId: string) {
  const h = structuredClone(example);
  const at = (ms: number) => new Date(Date.now() + ms).toISOString().replace("Z", "+00:00");
  h.plan.planId = planId;
  h.plan.createdAt = at(-60_000);
  h.plan.expiresAt = at(86_400_000);
  const banner = h.plan.actions.find((a: any) => a.actionType === "storefront.publish_banner");
  banner.params.startsAt = at(-60_000);
  banner.params.expiresAt = at(86_400_000);
  return h;
}

type Batch = { auth: string | null; url: string; events: PartnerActionEventT[] };
function mockIntelligence(plans: Record<string, unknown>, ingest: () => Response) {
  const original = globalThis.fetch, batches: Batch[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const plan = url.match(/^https:\/\/intel\.test\/api\/plans\/([^/?]+)$/);
    if (plan) return plans[plan[1]] ? Response.json(plans[plan[1]]) : Response.json({ error: { code: "plan_not_found" } }, { status: 404 });
    if (url.startsWith("https://intel.test/api/ingest/events")) {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.schemaVersion, 1);
      batches.push({ auth: new Headers(init?.headers).get("authorization"), url, events: body.events.map((e: unknown) => PartnerActionEvent.parse(e)) });
      return ingest();
    }
    throw new Error(`Unexpected network call in test: ${url}`);
  };
  return { batches, restore: () => { globalThis.fetch = original; } };
}
const accepted = () => Response.json({ accepted: 1, duplicates: 0, rejected: 0, eventIds: ["x"] });

async function partnerPlanExecutesAndReportsBack() {
  await resetDemo("plan_001");
  process.env.INTELLIGENCE_API_URL = "https://intel.test";
  process.env.NORMAL_INGEST_URL = "https://intel.test";
  process.env.NORMAL_INGEST_API_KEY = "ingest-test-key";
  const planId = "plan_partner_001";
  const intel = mockIntelligence({ [planId]: livePartnerPlan(planId) }, accepted);
  try {
    const before = await orchestrator.getHandoff(planId);
    assert.equal(before.diagnosis.serverAttribution.importedFrom, "@normal/contracts", "unapproved remote plans are read from the service");
    const h: PlanHandoffT = await loadPlanHandoff(planId);
    const approval = await createApproval(h, { planVersion: h.plan.planVersion, decision: "approved", approvedActionIds: h.plan.actions.map(a => a.actionId) }, OWNER);
    let work: (() => Promise<void>) | undefined;
    await orchestrator.start(planId, approval.approval.approvalId, undefined, OWNER, w => { work = w; });
    await work?.();
    const snapshot = await orchestrator.snapshot(planId);
    assert.deepEqual(snapshot.executions.map(e => e.status).sort(), ["succeeded", "succeeded", "succeeded"]);
    assert.equal((await store.campaigns.findOne("campaign_A"))!.dailyBudgetMinor, 3000);
    assert((await store.storefront.find()).some(b => b.bannerId === "banner_ship_001" && b.active));

    const sent = intel.batches.flatMap(b => b.events);
    assert.deepEqual(sent.map(e => e.type).sort(), ["campaign.budget_updated", "customer.message_sent", "customer.message_sent", "storefront.banner_published"]);
    assert(intel.batches.every(b => b.auth === "Bearer ingest-test-key" && b.url.endsWith("?businessId=nova_store")));
    assert(sent.every(e => e.correlationId === planId && e.provenance.ingestMethod === "action_callback"));
    const budget = sent.find(e => e.type === "campaign.budget_updated")!;
    assert.deepEqual(budget.payload, { campaignId: "campaign_A", previousDailyBudgetMinor: 5000, newDailyBudgetMinor: 3000, currency: "GBP", actionId: "act_ads_001" });
    const message = sent.find(e => e.type === "customer.message_sent")!;
    assert.equal(message.type === "customer.message_sent" && message.payload.deliveryStatus, "sent");
    assert(message.type === "customer.message_sent" && /^cust_[a-f0-9]{16}$/.test(message.payload.customerId), "customer ID is pseudonymous, never the email address");
    assert(!JSON.stringify(sent).includes("@example.com"), "no customer email address leaves this module");
    assert.deepEqual(snapshot.partnerIngest.map(f => f.status).sort(), ["accepted", "accepted", "accepted", "accepted"]);
    console.log("✅ Their plan was approved and executed by all three agents; 4 events reached their ingest in their format");
  } finally {
    intel.restore();
  }
}

async function failuresAreRecordedAndRetried() {
  let reply = () => Response.json({ error: { code: "unavailable" } }, { status: 503 });
  const intel = mockIntelligence({}, () => reply());
  try {
    const payload = { planId: "plan_retry", actionId: "act_retry", campaignId: "campaign_A", previousBudgetMinor: 3000, newBudgetMinor: 2500, currency: "GBP" };
    await emitEvent("plan_retry:v1:act_retry", "campaign.budget_updated", payload);
    let record = await store.ingestForwards.findOne("plan_retry:v1:act_retry");
    assert.equal(record!.status, "failed");
    assert.match(record!.error!, /HTTP 503/);
    await retryFailedForwards("plan_retry", Date.now());
    assert.equal(intel.batches.length, 1, "no retry before the back-off");
    reply = accepted;
    await retryFailedForwards("plan_retry", Date.now() + 11_000);
    record = await store.ingestForwards.findOne("plan_retry:v1:act_retry");
    assert.equal(record!.status, "accepted");
    assert.equal(record!.attempts, 2);
    assert.deepEqual(intel.batches[0].events, intel.batches[1].events, "the retry re-sends the same event ID, so their ingest can deduplicate");

    reply = () => Response.json({ error: { code: "validation_error", message: "bad event" } }, { status: 400 });
    await emitEvent("plan_retry:v1:act_rejected", "campaign.budget_updated", { ...payload, actionId: "act_rejected" });
    assert.equal((await store.ingestForwards.findOne("plan_retry:v1:act_rejected"))!.status, "rejected");
    await retryFailedForwards("plan_retry", Date.now() + 60_000);
    assert.equal(intel.batches.length, 3, "a rejected event is not retried");

    await emitEvent("plan_retry:v1:act_email:ord_001:delivered", "customer.message_sent", { planId: "plan_retry", actionId: "act_email", orderId: "ord_001", status: "delivered", provider: "resend" });
    assert.equal((await store.ingestForwards.findOne("plan_retry:v1:act_email:ord_001:delivered"))!.status, "skipped");
    assert.equal(intel.batches.length, 3, "delivery confirmations have no @normal/contracts equivalent and are not sent");

    delete process.env.NORMAL_INGEST_URL;
    await emitEvent("plan_retry:v1:act_off", "campaign.budget_updated", { ...payload, actionId: "act_off" });
    assert.equal(intel.batches.length, 3, "nothing is forwarded when no ingest URL is configured");
    console.log("✅ Ingest failures are recorded, retried with back-off, rejections and delivery confirmations are not re-sent");
  } finally {
    intel.restore();
  }
}

async function run() {
  mappingKeepsTheirMeaning();
  await partnerPlanExecutesAndReportsBack();
  await failuresAreRecordedAndRetried();
  console.log("Partner contract integration passed (HTTP mocked).");
}
run().catch(error => { console.error(error); process.exit(1); });
