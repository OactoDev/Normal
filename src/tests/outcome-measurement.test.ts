import assert from "node:assert/strict";
import { PlanHandoffT } from "../contracts";
import { orchestrator } from "../agents/orchestrator";
import { createApproval } from "../execution/validate-approval";
import { loadPlanHandoff } from "../execution/load-plan";
import { resetDemo } from "../simulator/reset";
import * as store from "../store/repos";
import { telemetrySimulator } from "../intelligence/telemetry-simulator";
import { evaluateCriteria, measureWindow, outcomeEvaluation, outcomesForDiagnosis, verdictOf } from "../execution/outcome-measurement";
import { DIAGNOSIS_INSTRUCTIONS, diagnosisRequest, diagnosisTaskFingerprint } from "../intelligence/mubit-diagnoser";

(process.env as Record<string, string>).NODE_ENV = "test";
process.env.EMAIL_PROVIDER = "memory";
process.env.EXECUTION_STEP_DELAY_MS = "0";
const OWNER = "merchant_owner_01";

async function runPlan(planId: string, edit: (h: PlanHandoffT) => void, beforeDrain?: () => Promise<void>) {
  const h: PlanHandoffT = structuredClone(await loadPlanHandoff("plan_001"));
  h.plan.planId = planId;
  h.plan.status = "awaiting_approval";
  edit(h);
  await orchestrator.saveHandoff(h);
  const { approval } = await createApproval(h, { planVersion: 1, decision: "approved", approvedActionIds: h.plan.actions.map(a => a.actionId) }, OWNER);
  let work: (() => Promise<void>) | undefined;
  await orchestrator.start(planId, approval.approvalId, undefined, OWNER, w => { work = w; });
  if (beforeDrain) await beforeDrain();
  await work!();
  return orchestrator.snapshot(planId);
}

function unitChecks() {
  const t0 = Date.parse("2026-10-25T00:00:00Z"), at = (m: number) => new Date(t0 + m * 60000).toISOString();
  const ev = (type: any, m: number, payload: Record<string, unknown> = {}) => ({ schemaVersion: 1 as const, eventId: `${type}_${m}_${Math.random()}`, businessId: "nova_store", type, payload, occurredAt: at(m), receivedAt: at(m), source: "test" });
  const events = [15, 30].flatMap(m => [ev("order.completed", m), ev("support.ticket_created", m), ev("support.ticket_created", m), ev("ad.metrics_observed", m, { cacMinor: 3850, spendMinor: 52 })]);
  const before = measureWindow(events, t0, t0 + 30 * 60000, "test:before");
  assert.equal(before.rawCounts.ticks, 2);
  assert.equal(before.calculatedRates.support_tickets, 2);
  assert.equal(before.calculatedRates.cac_minor, 3850);
  assert.equal(before.calculatedRates.late_delivery_rate, 0);
  // Events outside the window don't count.
  assert.equal(measureWindow(events, t0 + 15 * 60000, t0 + 30 * 60000, "x").rawCounts.ticks, 1);
  const after = { ...before, calculatedRates: { ...before.calculatedRates, support_tickets: 0.5, cac_minor: 3800 } };
  const criteria = evaluateCriteria([{ metric: "support_tickets", direction: "decrease", measurementWindowMinutes: 60 }, { metric: "cac_minor", direction: "decrease", measurementWindowMinutes: 60 }, { metric: "unknown_metric", direction: "decrease", measurementWindowMinutes: 60 }], before, after);
  assert.deepEqual(criteria.map(c => c.result), ["met", "not_met", "no_data"], "a 1% CAC change is below the 10% bar; an unmeasured metric is no data");
  assert.equal(criteria[0].changePercent, -75);
  assert.equal(verdictOf(criteria), "partially_resolved");
  assert.equal(verdictOf([criteria[0]]), "resolved");
  assert.equal(verdictOf([criteria[1]]), "not_resolved");
  assert.equal(verdictOf([criteria[2]]), "inconclusive");
  console.log("✅ metric windows, criteria and verdicts");
}

async function deliveryPlan() {
  await resetDemo("plan_001");
  await telemetrySimulator.injectScenario("delivery_delays", 0.85);
  await telemetrySimulator.tick(2);
  const snap = await runPlan("plan_outcome_delivery", h => {
    h.plan.successCriteria = [
      { metric: "late_delivery_rate", direction: "decrease", measurementWindowMinutes: 60 },
      { metric: "support_tickets", direction: "decrease", measurementWindowMinutes: 60 },
    ];
  });
  const o = snap.planOutcome!;
  assert.ok(o, "snapshot carries the plan outcome");
  assert.equal(o.scenario, "delivery_delays");
  assert.equal(o.diagnosedCause, "delivery_delays");
  const [late, tickets] = o.criteria;
  // The carrier delay is outside every action in the plan, so late deliveries don't move.
  assert.equal(late.result, "not_met");
  assert.equal(late.before, late.after);
  // Delayed customers who got the email stop contacting support.
  assert.equal(tickets.result, "met", JSON.stringify(tickets));
  assert.ok(tickets.after! < tickets.before!);
  assert.equal(o.verdict, "partially_resolved");
  assert.equal(o.actionsTaken.filter(a => a.status === "succeeded").length, 3);
  for (const out of snap.outcomes) assert.deepEqual(out.observedMetricSnapshotIds, [o.baseline.snapshotId, o.after!.snapshotId]);
  console.log(`✅ delivery plan measured: ${o.summary}`);
}

async function adPlan() {
  // The delivery plan cut the shared campaign to £30; reset puts it back to £50 before this baseline.
  await resetDemo("plan_001");
  await telemetrySimulator.injectScenario("ad_fatigue", 0.8);
  await telemetrySimulator.tick(2);
  const snap = await runPlan("plan_outcome_ads", h => { h.diagnosis.output.primaryCause = "ad_fatigue"; });
  const o = snap.planOutcome!;
  assert.equal(o.criteria[0].metric, "cac_minor");
  assert.equal(o.criteria[0].before, 3850);
  assert.ok(o.criteria[0].after! < 3850 * 0.9 && o.criteria[0].after! > 1820, "a £50 → £30 cut lowers CAC but not back to baseline");
  assert.equal(o.verdict, "resolved");
  console.log(`✅ ad plan measured: ${o.summary}`);
}

async function restartedSimulator() {
  await telemetrySimulator.injectScenario("delivery_delays", 0.85);
  const snap = await runPlan("plan_outcome_restart", () => {}, () => telemetrySimulator.injectScenario("healthy", 0.1).then(() => undefined));
  assert.equal(snap.planOutcome!.verdict, "inconclusive");
  assert.match(snap.planOutcome!.summary, /simulator was reset/);
  console.log("✅ a new scenario between baseline and measurement is inconclusive, not a success");
}

async function feedsDiagnosis() {
  const outcomes = await outcomesForDiagnosis();
  assert.deepEqual(outcomes.map(o => o.planId), ["plan_outcome_ads", "plan_outcome_delivery"], "newest first, inconclusive left out");
  const evidence = [{ schemaVersion: 1 as const, evidenceId: "e1", investigationId: "inv", businessId: "nova_store", observedFact: "14 orders late.", measurements: { late: 14 }, sourceRecordIds: ["r1"], retrievedAt: new Date().toISOString() }];
  const plain = diagnosisRequest(evidence, [], "gemini-4-argon", "k") as any, withOutcomes = diagnosisRequest(evidence, [], "gemini-4-argon", "k", false, outcomes) as any;
  const userOf = (r: any) => JSON.parse(r.body.contents[0].parts[0].text);
  assert.equal("measuredOutcomesOfEarlierPlans" in userOf(plain), false, "no outcomes: the user message is unchanged");
  const sent = userOf(withOutcomes).measuredOutcomesOfEarlierPlans;
  assert.equal(sent.length, 2);
  assert.equal(sent[1].diagnosedCause, "delivery_delays");
  assert.equal(sent[1].measuredResult, "partially_resolved");
  assert.ok(sent[1].actionsTaken.includes("customer.send_delay_notice"));
  assert.ok(!JSON.stringify(sent).includes("@example.com"), "no customer data in the outcome examples");
  // Same system prompt, so outcome-carrying calls stay in the same Mubit task.
  assert.equal(withOutcomes.body.systemInstruction.parts[0].text, DIAGNOSIS_INSTRUCTIONS);
  assert.equal(diagnosisTaskFingerprint("gemini-4-argon"), "fp_36d6849aa9403aac");
  const evaluation = await outcomeEvaluation();
  assert.equal(evaluation.reduce((n, t) => n + t.measured, 0), 3);
  console.log("✅ measured outcomes go into the next diagnosis call, same Mubit task");
}

async function main() {
  unitChecks();
  await deliveryPlan();
  await adPlan();
  await restartedSimulator();
  await feedsDiagnosis();
  await resetDemo("plan_outcome_delivery");
  assert.equal((await store.planOutcomes.find({ planId: "plan_outcome_delivery" })).length, 0, "reset removes the plan's outcome");
  console.log("✅ reset clears the plan outcome");
}
main().catch(e => { console.error(e); process.exit(1); });
