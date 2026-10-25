import { randomUUID } from "node:crypto";
import { BusinessEventT, CriterionResultT, MetricSnapshotT, PlanHandoffT, PlanOutcomeT } from "../contracts";
import { executions, modelCalls, outcomes, planOutcomes } from "../store/repos";
import { telemetrySimulator } from "../intelligence/telemetry-simulator";

// Outcome measurement: the business metrics a plan targets are read from the event stream for the hour before
// execution and again for the simulated hour after it, then judged against the plan's success criteria.
// Each simulator tick is 15 minutes, so metrics are per 15 minutes.
const TICK_MS = 15 * 60_000;
const BASELINE_TICKS = 4;
const measureTicks = () => Math.max(1, Math.min(16, Number(process.env.OUTCOME_MEASURE_TICKS || 4)));
// A metric has to move at least this much in the wanted direction to count as met.
const MIN_CHANGE = 0.1;

export const METRIC_LABELS: Record<string, string> = {
  cac_minor: "Customer acquisition cost",
  ad_spend_minor: "Ad spend per 15 min",
  late_delivery_rate: "Late deliveries per 15 min",
  support_tickets: "Support tickets per 15 min",
  negative_reviews: "1–2 star reviews per 15 min",
  checkout_failures: "Checkout failures per 15 min",
};

const round = (n: number) => Math.round(n * 100) / 100;
const outcomeKey = (planId: string, planVersion: number) => `${planId}:v${planVersion}`;

/** Business metrics for events in (from, to]. A metric with no observations is left out, so it reads as no data. */
export function measureWindow(events: BusinessEventT[], from: number, to: number, dimension: string): MetricSnapshotT {
  const inWindow = events.filter(e => { const t = Date.parse(e.occurredAt); return t > from && t <= to; });
  const ofType = (type: BusinessEventT["type"]) => inWindow.filter(e => e.type === type);
  // The simulator records one baseline order per tick, so its timestamps count the ticks in the window.
  const ticks = new Set(ofType("order.completed").map(e => e.occurredAt)).size;
  const ads = ofType("ad.metrics_observed").map(e => e.payload as { cacMinor?: number; spendMinor?: number });
  const late = ofType("delivery.status_changed").filter(e => e.payload.status === "delayed").length;
  const tickets = ofType("support.ticket_created").length;
  const reviews = ofType("review.created").filter(e => Number(e.payload.rating) <= 2).length;
  const checkout = ofType("checkout.failed").length;
  const mean = (values: number[]) => values.length ? round(values.reduce((a, b) => a + b, 0) / values.length) : undefined;
  const perTick = (count: number) => ticks ? round(count / ticks) : undefined;
  const rates: Record<string, number | undefined> = {
    cac_minor: mean(ads.map(a => Number(a.cacMinor)).filter(Number.isFinite)),
    ad_spend_minor: mean(ads.map(a => Number(a.spendMinor)).filter(Number.isFinite)),
    late_delivery_rate: perTick(late),
    support_tickets: perTick(tickets),
    negative_reviews: perTick(reviews),
    checkout_failures: perTick(checkout),
  };
  return {
    schemaVersion: 1, snapshotId: `snap_${randomUUID()}`, businessId: "nova_store",
    periodStart: new Date(from).toISOString(), periodEnd: new Date(to).toISOString(), dimension,
    rawCounts: { ticks, adObservations: ads.length, lateDeliveries: late, supportTickets: tickets, negativeReviews: reviews, checkoutFailures: checkout },
    calculatedRates: Object.fromEntries(Object.entries(rates).filter(([, v]) => v !== undefined)) as Record<string, number>,
    createdAt: new Date().toISOString(),
  };
}

export function evaluateCriteria(criteria: PlanHandoffT["plan"]["successCriteria"], before: MetricSnapshotT, after: MetricSnapshotT): CriterionResultT[] {
  return criteria.map(({ metric, direction }) => {
    const b = before.calculatedRates[metric], a = after.calculatedRates[metric];
    if (b === undefined || a === undefined) return { metric, direction, before: b ?? null, after: a ?? null, changePercent: null, result: "no_data" as const };
    const changePercent = b === 0 ? (a === 0 ? 0 : null) : Math.round(((a - b) / b) * 1000) / 10;
    const met = direction === "decrease" ? b > 0 && a <= b * (1 - MIN_CHANGE) : a >= b * (1 + MIN_CHANGE) && a > b;
    return { metric, direction, before: b, after: a, changePercent, result: met ? "met" as const : "not_met" as const };
  });
}

export function verdictOf(criteria: CriterionResultT[]): PlanOutcomeT["verdict"] {
  const judged = criteria.filter(c => c.result !== "no_data");
  if (!judged.length) return "inconclusive";
  const met = judged.filter(c => c.result === "met").length;
  return met === criteria.length ? "resolved" : met > 0 ? "partially_resolved" : "not_resolved";
}

function describe(criteria: CriterionResultT[]) {
  const parts = criteria.map(c => {
    const label = METRIC_LABELS[c.metric] ?? c.metric;
    if (c.result === "no_data") return `${label}: no data`;
    const change = c.changePercent === null ? "changed" : c.changePercent === 0 ? "unchanged" : `${c.changePercent > 0 ? "+" : ""}${c.changePercent}%`;
    const show = (n: number | null) => n === null ? "—" : c.metric.endsWith("_minor") ? `£${(n / 100).toFixed(2)}` : String(n);
    return `${label} ${change} (${show(c.before)} → ${show(c.after)})`;
  });
  const met = criteria.filter(c => c.result === "met").length;
  return `${parts.join("; ")}. ${met} of ${criteria.length} success criteria met.`;
}

/** Records the hour before execution as the plan's baseline. The first run of a plan version sets it; later runs keep it. */
export async function captureBaseline(h: PlanHandoffT) {
  const key = outcomeKey(h.plan.planId, h.plan.planVersion);
  const existing = await planOutcomes.findOne(key);
  if (existing) {
    // A retry or a later approval changes what was done, so the plan is measured again from the same baseline.
    if (!["pending", "measuring"].includes(existing.verdict)) await planOutcomes.update(key, { $set: { verdict: "pending", summary: "Waiting for execution to finish", after: undefined, measuredAt: undefined } });
    return;
  }
  const { run } = telemetrySimulator.getState();
  const now = Date.parse(run.virtualTime);
  const call = await modelCalls.findOne(h.diagnosis.modelCallId);
  const outcome: PlanOutcomeT = {
    schemaVersion: 1, planOutcomeId: `pout_${randomUUID()}`, planId: h.plan.planId, planVersion: h.plan.planVersion,
    diagnosisId: h.diagnosis.diagnosisId, diagnosedCause: h.diagnosis.output.primaryCause,
    ...(call?.mubitRequestId ? { diagnosisMubitRequestId: call.mubitRequestId } : {}),
    ...(call?.instructionsFingerprint ? { diagnosisTaskFingerprint: call.instructionsFingerprint } : {}),
    simulationRunId: run.simulationRunId, scenario: run.activeScenario, actionsTaken: [],
    baseline: measureWindow(telemetrySimulator.getEvents(), now - BASELINE_TICKS * TICK_MS, now, `${key}:before`),
    criteria: [], verdict: "pending", summary: "Waiting for execution to finish", createdAt: new Date().toISOString(),
  };
  await planOutcomes.claim(key, outcome);
}

/** Runs the simulator for the measurement window after execution, then judges the plan. Called once a run has no work left. */
export async function measurePlanOutcome(h: PlanHandoffT) {
  const key = outcomeKey(h.plan.planId, h.plan.planVersion);
  // Claiming the measurement keeps two finishing runs from measuring the same plan twice.
  if (!await planOutcomes.compareAndSet(key, { verdict: "pending" }, { verdict: "measuring", summary: "Measuring the hour after execution" })) return planOutcomes.findOne(key);
  const outcome = (await planOutcomes.findOne(key))!;
  const runs = (await executions.find({ planId: h.plan.planId })).filter(e => e.planVersion === h.plan.planVersion);
  const actionsTaken = runs.map(e => ({ actionId: e.actionId, actionType: e.toolName, status: e.status }));
  const finish = (changes: Partial<PlanOutcomeT>) => planOutcomes.update(key, { $set: { actionsTaken, measuredAt: new Date().toISOString(), ...changes } });
  try {
    const { run } = telemetrySimulator.getState();
    if (run.simulationRunId !== outcome.simulationRunId) return finish({ verdict: "inconclusive", summary: "The simulator was reset or a new scenario was injected after the baseline, so before and after can't be compared." });
    if (!runs.some(e => e.status === "succeeded")) return finish({ verdict: "inconclusive", summary: "No action succeeded, so there is no effect to measure." });
    if (!h.plan.successCriteria.length) return finish({ verdict: "inconclusive", summary: "The plan has no success criteria to measure against." });
    const start = Date.parse(run.virtualTime);
    await telemetrySimulator.tick(measureTicks());
    const end = Date.parse(telemetrySimulator.getState().run.virtualTime);
    const after = measureWindow(telemetrySimulator.getEvents(), start, end, `${key}:after`);
    const criteria = evaluateCriteria(h.plan.successCriteria, outcome.baseline, after);
    const saved = await finish({ after, criteria, verdict: verdictOf(criteria), summary: describe(criteria) });
    // Each action's outcome now points at the snapshots its plan was judged on.
    for (const e of runs) if (await outcomes.findOne(e.executionId)) await outcomes.update(e.executionId, { $set: { observedMetricSnapshotIds: [outcome.baseline.snapshotId, after.snapshotId] } });
    return saved;
  } catch (e) {
    console.error("[outcome-measurement]", e);
    return finish({ verdict: "inconclusive", summary: "Measurement failed; no result was recorded." });
  }
}

export const MAX_OUTCOME_EXAMPLES = 6;

/** Measured plans, newest first; inconclusive ones say nothing about the diagnosis and are left out. */
export async function measuredOutcomes(): Promise<PlanOutcomeT[]> {
  return (await planOutcomes.find())
    .filter(o => ["resolved", "partially_resolved", "not_resolved"].includes(o.verdict))
    .sort((a, b) => (b.measuredAt ?? "").localeCompare(a.measuredAt ?? ""));
}

export async function outcomesForDiagnosis() {
  return (await measuredOutcomes()).slice(0, MAX_OUTCOME_EXAMPLES);
}

/** Recurring-task evaluation: how often plans built on each Mubit diagnosis task fixed what they targeted. */
export async function outcomeEvaluation() {
  const all = await planOutcomes.find();
  type Counts = { measured: number; resolved: number; partially_resolved: number; not_resolved: number; inconclusive: number };
  const byTask = new Map<string, Counts>();
  for (const o of all) {
    if (["pending", "measuring"].includes(o.verdict)) continue;
    const task = o.diagnosisTaskFingerprint ?? "unknown";
    const counts = byTask.get(task) ?? { measured: 0, resolved: 0, partially_resolved: 0, not_resolved: 0, inconclusive: 0 };
    counts.measured++; counts[o.verdict as keyof Counts]++;
    byTask.set(task, counts);
  }
  return [...byTask].map(([fingerprint, counts]) => ({ fingerprint, ...counts }));
}
