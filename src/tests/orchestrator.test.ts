import { ActionExecution, ActionOutcome, AgentMission, PlanHandoffT } from "../contracts";
import { orchestrator } from "../agents/orchestrator";
import { createApproval } from "../execution/validate-approval";
import { loadPlanHandoff } from "../execution/load-plan";
import { resetDemo } from "../simulator/reset";
import fs from "node:fs";
import path from "node:path";
import * as store from "../store/repos";
import { reconcileDeliveries } from "../execution/delivery-monitor";

(process.env as Record<string, string>).NODE_ENV = "test";
process.env.EMAIL_PROVIDER = "memory";
process.env.EXECUTION_STEP_DELAY_MS = "0";

const OWNER = "merchant_owner_01";
let passed = 0;

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}
function ok(message: string) {
  passed++;
  console.log(`✅ ${message}`);
}
async function expectCode(code: string, work: () => Promise<unknown>) {
  try {
    await work();
  } catch (e) {
    const actual = (e as { code?: string }).code;
    assert(actual === code, `expected ${code}, got ${actual}: ${(e as Error).message}`);
    return;
  }
  throw new Error(`Expected ${code}, but the call succeeded`);
}

/** Starts execution and waits for the background drain instead of handing it to Next's after(). */
async function execute(planId: string, approvalId: string, actionIds?: string[], principal = OWNER) {
  let work: (() => Promise<void>) | undefined;
  await orchestrator.start(planId, approvalId, actionIds, principal, w => { work = w; });
  if (work) await work();
  return orchestrator.snapshot(planId);
}
async function approve(h: PlanHandoffT, ids: string[], principal = OWNER) {
  const decision = ids.length === h.plan.actions.length ? "approved" : "partially_approved";
  return createApproval(h, { planVersion: h.plan.planVersion, decision, approvedActionIds: ids }, principal);
}
/** Clones the fixture plan under a new ID so each scenario has its own idempotency keys. */
async function variant(planId: string, edit: (h: PlanHandoffT) => void) {
  const h: PlanHandoffT = structuredClone(await loadPlanHandoff("plan_001"));
  h.plan.planId = planId;
  h.plan.status = "awaiting_approval";
  edit(h);
  await orchestrator.saveHandoff(h);
  return loadPlanHandoff(planId);
}

async function happyPathAndIdempotency() {
  await resetDemo("plan_001");
  const h = await loadPlanHandoff("plan_001");
  assert((await store.campaigns.findOne("campaign_A")).dailyBudgetMinor === 5000, "Campaign A starts at £50");

  const { approval } = await approve(h, h.plan.actions.map(a => a.actionId));
  const snap = await execute("plan_001", approval.approvalId);

  assert(snap.executions.length === 3 && snap.executions.every(e => e.status === "succeeded"), "all 3 actions succeeded");
  snap.executions.forEach(e => ActionExecution.parse(e));
  snap.outcomes.forEach(o => ActionOutcome.parse(o));
  snap.missions.forEach(m => AgentMission.parse(m));
  assert(snap.executions.every(e => e.idempotencyKey === `plan_001:v1:${e.actionId}`), "stable idempotency keys");
  assert(snap.missions.length === 3 && snap.missions.every(m => m.status === "completed"), "one completed mission per agent");
  assert(snap.planStatus === "completed", "plan completed");
  ok("happy path: approval → missions → 3 verified executions");

  const campaign = await store.campaigns.findOne("campaign_A");
  assert(campaign.dailyBudgetMinor === 3000, `budget read-back is 3000, got ${campaign.dailyBudgetMinor}`);
  const adsDetail = snap.details.find(d => d.payload.campaignId === "campaign_A");
  assert(adsDetail.payload.previousBudgetMinor === 5000 && adsDetail.payload.newBudgetMinor === 3000, "details record £50 → £30");
  ok("Marketing Agent: Campaign A budget £50 → £30, verified by read-back");

  const banner = await store.storefront.findOne("banner_ship_001");
  assert(banner?.active && banner.message.startsWith("Delivery times"), "banner active in storefront config");
  ok("Storefront Agent: banner published and active");

  const sent = await store.emails.find({ planId: "plan_001" });
  assert(sent.length === 2 && sent.every(e => e.status === "accepted"), "2 emails accepted, none claimed delivered");
  assert(sent.every(e => e.to === "controlled@example.com"), "emails only go to the controlled test inbox");
  const emailOutcome = snap.outcomes.find(o => o.actionId === "act_email_001");
  assert(emailOutcome.status === "monitoring", "email outcome is monitoring, not verified delivery");
  ok("Customer Care Agent: 2 messages accepted by provider; delivery not claimed");

  const events = await store.events.find();
  const types = events.map(e => e.type).sort();
  assert(JSON.stringify(types) === JSON.stringify(["campaign.budget_updated", "customer.message_sent", "customer.message_sent", "storefront.banner_published"]), `events emitted: ${types}`);
  ok("simulated platforms emitted 4 business events");

  const attemptsBefore = snap.executions.map(e => e.attempts).join();
  const again = await execute("plan_001", approval.approvalId);
  assert((await store.emails.find({ planId: "plan_001" })).length === 2, "no duplicate emails");
  assert((await store.events.find()).length === events.length, "no duplicate events");
  assert(again.executions.map(e => e.attempts).join() === attemptsBefore, "succeeded actions were not re-run");
  ok("executing twice re-runs nothing and sends no duplicate email");
}

async function approvalChecks() {
  await resetDemo("plan_001");
  const h = await loadPlanHandoff("plan_001");
  const all = h.plan.actions.map(a => a.actionId);

  await expectCode("FORBIDDEN", () => approve(h, all, "ops_viewer"));
  ok("read-only principal cannot approve");

  await expectCode("VERSION_MISMATCH", () => createApproval(h, { planVersion: 2, decision: "approved", approvedActionIds: all }, OWNER));
  ok("approval for the wrong plan version is rejected");

  await expectCode("INVALID_ACTION_IDS", () => createApproval(h, { planVersion: 1, decision: "partially_approved", approvedActionIds: ["act_unknown"] }, OWNER));
  ok("unknown action IDs are rejected");

  const { approval } = await approve(h, all);
  await expectCode("PRINCIPAL_MISMATCH", () => execute("plan_001", approval.approvalId, undefined, "ops_viewer"));
  ok("another principal cannot execute the owner's approval");

  const record = await store.approvals.findOne(approval.approvalId);
  await store.approvals.update(approval.approvalId, { $set: { _meta: { ...record._meta, expiresAt: new Date(Date.now() - 1000).toISOString() } } });
  await expectCode("APPROVAL_EXPIRED", () => execute("plan_001", approval.approvalId));
  assert((await store.executions.find({ planId: "plan_001" })).length === 0, "nothing executed");
  ok("expired approval cannot execute");

  const rejected = await createApproval(h, { planVersion: 1, decision: "rejected", approvedActionIds: [], changeRequestNote: "Use £35 instead" }, OWNER);
  assert(rejected.plan.status === "rejected", "plan marked rejected");
  await expectCode("NOT_APPROVED", () => execute("plan_001", rejected.approval.approvalId));
  ok("request changes rejects the version and blocks execution");

  const other = await variant("plan_other_business", x => { x.plan.businessId = "other_store"; x.evidence.forEach(e => { e.businessId = "other_store"; }); });
  await expectCode("BUSINESS_MISMATCH", () => approve(other, other.plan.actions.map(a => a.actionId)));
  ok("approval for another business is rejected");
}

async function policyChecks() {
  await resetDemo("plan_001");
  const overCap = await variant("plan_over_cap", x => { x.plan.actions[0].params.newDailyBudgetMinor = 20000; });
  await expectCode("BUDGET_POLICY", () => approve(overCap, [overCap.plan.actions[0].actionId]));
  ok("budget above the cap is rejected");

  const tooManyRecipients = await variant("plan_recipients", x => { x.plan.actions[1].params.maxRecipients = 500; });
  const recipientError = await approve(tooManyRecipients, [tooManyRecipients.plan.actions[1].actionId]).then(() => null, e => e as Error);
  assert(recipientError?.name === "ZodError", `expected param validation error, got ${recipientError?.message}`);
  ok("recipient count above the limit is rejected");

  const unsupported = await variant("plan_unsupported", x => { x.plan.actions[0].actionType = "marketing.publish_ad"; });
  await expectCode("UNSUPPORTED_TOOL", () => approve(unsupported, [unsupported.plan.actions[0].actionId]));
  ok("unsupported tool operations are rejected");
}

async function partialApproval() {
  await resetDemo("plan_001");
  const h = await loadPlanHandoff("plan_001");
  const { approval } = await approve(h, ["act_ads_001"]);
  assert(approval.decision === "partially_approved", "partial decision recorded");
  const snap = await execute("plan_001", approval.approvalId);
  assert(snap.executions.length === 1 && snap.executions[0].actionId === "act_ads_001", "only the approved action ran");
  assert((await store.emails.find({ planId: "plan_001" })).length === 0, "no email sent");
  assert(!(await store.storefront.findOne("banner_ship_001")), "no banner published");
  await expectCode("ACTION_NOT_APPROVED", () => execute("plan_001", approval.approvalId, ["act_email_001"]));
  ok("unapproved actions never run, even when requested directly");
}

async function dependencies() {
  await resetDemo("plan_001");
  // The banner depends on the email; the email fails because the controlled inbox is misconfigured.
  const chained = await variant("plan_chain", x => { x.plan.actions[2].dependsOnActionIds = [x.plan.actions[1].actionId]; });
  const { approval } = await approve(chained, chained.plan.actions.map(a => a.actionId));
  process.env.EMAIL_TEST_RECIPIENT = "not-an-inbox";
  const snap = await execute("plan_chain", approval.approvalId);
  delete process.env.EMAIL_TEST_RECIPIENT;
  const status = (id: string) => snap.executions.find(e => e.actionId === id);
  assert(status("act_ads_001").status === "succeeded", "independent action still ran");
  assert(status("act_email_001").status === "failed" && status("act_email_001").error.code === "EMAIL_CONFIG", "email failed");
  assert(status("act_banner_001").status === "cancelled" && status("act_banner_001").error.code === "DEPENDENCY_FAILED", "dependent cancelled");
  assert(!(await store.storefront.findOne("banner_ship_001")), "dependent banner never published");
  assert(snap.needsAttention, "plan flagged as needing attention");
  ok("a failed dependency cancels its dependents");

  await resetDemo("plan_chain");
  const fresh = await loadPlanHandoff("plan_chain");
  const bannerOnly = await approve(fresh, ["act_banner_001"]);
  const snap2 = await execute("plan_chain", bannerOnly.approval.approvalId);
  assert(snap2.executions[0].status === "cancelled" && snap2.executions[0].error.code === "DEPENDENCY_NOT_APPROVED", "unapproved dependency blocks");
  ok("an action whose dependency was not approved is cancelled, not run");
}

async function emailRetrySafety() {
  await resetDemo("plan_001");
  const h = await loadPlanHandoff("plan_001");
  const key = "plan_001:v1:act_email_001";
  // Simulate a previous attempt that already reached the provider for ord_001.
  await store.emails.claim(`${key}:ord_001`, { key: `${key}:ord_001`, planId: "plan_001", actionId: "act_email_001", orderId: "ord_001", status: "accepted", provider: "memory", providerOperationId: "memory_prior", to: "controlled@example.com", subject: "prior", body: "prior", modelUsed: "deterministic_template_v1", sentAt: new Date().toISOString() });
  const { approval } = await approve(h, ["act_email_001"]);
  await execute("plan_001", approval.approvalId);
  const sent = await store.emails.find({ planId: "plan_001" });
  assert(sent.length === 2 && sent.find(e => e.orderId === "ord_001").providerOperationId === "memory_prior", "accepted recipient was skipped");
  ok("email retry skips recipients the provider already accepted");

  await resetDemo("plan_001");
  const h2 = await loadPlanHandoff("plan_001");
  await store.emails.claim(`${key}:ord_001`, { key: `${key}:ord_001`, planId: "plan_001", actionId: "act_email_001", orderId: "ord_001", status: "ambiguous", provider: "memory", to: "controlled@example.com", subject: "prior", body: "prior", modelUsed: "deterministic_template_v1", sentAt: new Date().toISOString() });
  const second = await approve(h2, ["act_email_001"]);
  const snap = await execute("plan_001", second.approval.approvalId);
  const exec = snap.executions[0];
  assert(exec.status === "failed" && exec.error.code === "EMAIL_AMBIGUOUS" && !exec.error.retryable, "ambiguous send is not auto-retryable");
  assert((await store.emails.find({ planId: "plan_001" })).length === 1, "ambiguous recipient was not resent");
  ok("an ambiguous email send is never retried automatically");
}

async function deliveryMonitoring() {
  await resetDemo("plan_001");
  const h = await loadPlanHandoff("plan_001");
  const { approval } = await approve(h, ["act_email_001"]);
  await execute("plan_001", approval.approvalId);
  // Make the memory-provider sends look like real Resend sends that are still awaiting a delivery report.
  for (const e of await store.emails.find({ planId: "plan_001" })) await store.emails.update(e.key, { $set: { provider: "resend", providerOperationId: `re_${e.orderId}` } });
  // Read the store directly: snapshot() would also start a background re-check against the real provider.
  const execution = (await store.executions.find({ planId: "plan_001", actionId: "act_email_001" }))[0];
  const outcomeFor = () => store.outcomes.findOne(execution.executionId);

  const calls: string[] = [];
  const t0 = Date.now();
  await reconcileDeliveries("plan_001", async id => { calls.push(id); return id === "re_ord_001" ? "delivered" : "accepted"; }, t0);
  assert(calls.length === 2, "both accepted sends were checked");
  assert((await store.emails.findOne("plan_001:v1:act_email_001:ord_001")).status === "delivered", "ord_001 promoted to delivered");
  assert((await outcomeFor()).status === "monitoring", "outcome stays monitoring while one send is unconfirmed");
  ok("a partly delivered batch stays in monitoring");

  await reconcileDeliveries("plan_001", async id => { calls.push(id); return "delivered"; }, t0 + 1000);
  assert(calls.length === 2, "no re-check inside the 10s throttle");
  ok("delivery re-checks are throttled");

  await reconcileDeliveries("plan_001", async id => { calls.push(id); return "delivered"; }, t0 + 11_000);
  assert(calls.length === 3 && calls[2] === "re_ord_002", "only the still-accepted send is re-checked");
  const outcome = await outcomeFor();
  assert(outcome.status === "verified" && outcome.summary.startsWith("2/2 messages delivered"), `outcome promoted: ${outcome.status} ${outcome.summary}`);
  const delivered = (await store.events.find()).filter(e => e.type === "customer.message_sent" && e.payload.status === "delivered");
  assert(delivered.length === 2, "one delivered event per message");
  ok("all sends delivered promotes the ledger and ActionOutcome to verified");
}

async function main() {
  const csv = process.env.NORMAL_STORE === "csv";
  console.log(`=== Execution module tests (${csv ? `CSV files in ${path.resolve(process.env.NORMAL_DATA_DIR || "data")}` : "in-memory store"}) ===`);
  // A CSV run must use its own directory, which starts empty so earlier runs cannot collide.
  if (csv) {
    if (!process.env.NORMAL_DATA_DIR) throw new Error("Set NORMAL_DATA_DIR so CSV tests never touch ./data");
    fs.rmSync(process.env.NORMAL_DATA_DIR, { recursive: true, force: true });
  }
  await happyPathAndIdempotency();
  await approvalChecks();
  await policyChecks();
  await partialApproval();
  await dependencies();
  await emailRetrySafety();
  await deliveryMonitoring();
  console.log(`🎉 ${passed} checks passed`);
  process.exit(0);
}

main().catch(err => {
  console.error("❌", err);
  process.exit(1);
});
