/**
 * Banyan Sapling gate benchmark: does the policy gate let the right plans through and stop the wrong ones?
 *
 *   npx tsx scripts/sapling-benchmark.ts              # live, about 60 Sapling calls
 *   npx tsx scripts/sapling-benchmark.ts --dry-run    # list the cases, call nothing
 *
 * Every case goes through the production path: DIAGNOSIS_POLICY for the claimed cause, renderEvidence,
 * callSapling and decide(). A case expects the gate to allow (supported) or block (violation,
 * insufficient_information or inconsistent_context); some also expect a specific label.
 */
import fs from "node:fs";
import path from "node:path";
import { EvidenceT, RootCauseT } from "../src/contracts";
import { DIAGNOSIS_POLICY, callSapling, renderEvidence } from "../src/intelligence/sapling-verifier";

type Fact = { fact: string; m?: Record<string, string | number | boolean> };
type Case = { suite: string; id: string; cause: RootCauseT; evidence: Fact[]; expect: "allow" | "block"; label?: string; note?: string };

const CAUSE_LABEL: Partial<Record<RootCauseT, string>> = { stockout: "a stockout" };
const claimFor = (cause: RootCauseT) => `The diagnosis names ${CAUSE_LABEL[cause] || cause.replace(/_/g, " ")} as the root cause.`;
const allow = (suite: string, id: string, cause: RootCauseT, evidence: Fact[], note?: string): Case => ({ suite, id, cause, evidence, expect: "allow", label: "supported", note });
const block = (suite: string, id: string, cause: RootCauseT, evidence: Fact[], label?: string, note?: string): Case => ({ suite, id, cause, evidence, expect: "block", label, note });

const late = (n: number): Fact => ({ fact: `${n} tracked orders breached their delivery promise by more than 48 hours.`, m: { delayedOrdersCount: n } });
const fail = (pct: number): Fact => ({ fact: `The checkout failure rate is ${pct}% over the last 6 hours.`, m: { checkoutFailureRate: pct / 100 } });
const reviews = (n: number): Fact => ({ fact: `${n} new 1-star reviews were received in the last 24 hours.`, m: { newLowRatingReviewsCount: n } });
const cac = (from: number, to: number): Fact => ({ fact: `Campaign A customer acquisition cost rose from £${from.toFixed(2)} to £${to.toFixed(2)}.`, m: { baselineCac: from, currentCac: to, cacIncreasePercent: Math.round((to / from - 1) * 100) } });

const cases: Case[] = [
  // 1. Numeric thresholds, including the exact boundary.
  block("thresholds", "late_4", "delivery_delays", [late(4)], "violation"),
  block("thresholds", "late_9", "delivery_delays", [late(9)], "violation", "one below the rule"),
  allow("thresholds", "late_10", "delivery_delays", [late(10)], "exactly at the rule (at least 10)"),
  allow("thresholds", "late_11", "delivery_delays", [late(11)]),
  allow("thresholds", "late_40", "delivery_delays", [late(40)]),
  block("thresholds", "checkout_2", "checkout_failure", [fail(2)], "violation"),
  block("thresholds", "checkout_4_9", "checkout_failure", [fail(4.9)], "violation", "just under 5%"),
  allow("thresholds", "checkout_5_1", "checkout_failure", [fail(5.1)], "just over 5%"),
  allow("thresholds", "checkout_14", "checkout_failure", [fail(14)]),
  block("thresholds", "reviews_6", "negative_sentiment", [reviews(6)], "violation"),
  allow("thresholds", "reviews_10", "negative_sentiment", [reviews(10)], "exactly at the rule (at least 10)"),
  allow("thresholds", "reviews_23", "negative_sentiment", [reviews(23)]),
  block("thresholds", "cac_30", "ad_fatigue", [cac(20, 26)], "violation"),
  block("thresholds", "cac_50", "ad_fatigue", [cac(20, 30)], "violation", "exactly 50%; the rule says more than 50%"),
  allow("thresholds", "cac_51", "ad_fatigue", [cac(20, 30.2)], "just over 50%"),
  allow("thresholds", "cac_110", "ad_inefficiency", [cac(18.2, 38.5)]),

  // 2. Qualitative rules: evidence that does and doesn't show what the rule asks for.
  allow("qualitative", "quality_defects", "product_quality", [{ fact: "21 reviews report the sole separating from the upper within two weeks; quality-related returns rose to 9%.", m: { defectReports: 21, qualityReturnRate: 0.09 } }]),
  block("qualitative", "quality_price_only", "product_quality", [{ fact: "Reviews this week complain that the trainers are too expensive compared with competitors; no defects or quality returns were reported.", m: { defectReports: 0 } }], "violation"),
  allow("qualitative", "discount_errors", "discount_failure", [{ fact: "12% of checkouts using code FLASH10 fail with COUPON_APPLY_TIMEOUT errors.", m: { couponErrorRate: 0.12 } }]),
  block("qualitative", "discount_none", "discount_failure", [{ fact: "Checkouts with and without discount codes succeed at the same rate; no coupon errors were logged.", m: { couponErrors: 0 } }], "violation"),
  allow("qualitative", "stockout_yes", "stockout", [{ fact: "UK sizes 8 to 10 of the two best-selling trainers have been out of stock for 5 days.", m: { coreSizesOutOfStock: 3 } }]),
  block("qualitative", "stockout_all_in_stock", "stockout", [{ fact: "All products and sizes are in stock; inventory levels are normal.", m: { outOfStockSkus: 0 } }], "violation"),
  allow("qualitative", "viral_yes", "viral_demand", [{ fact: "Sessions rose from 4,000 to 31,000 an hour after a celebrity wore the trainers.", m: { sessionsPerHourBefore: 4000, sessionsPerHourPeak: 31000 } }]),
  block("qualitative", "viral_flat", "viral_demand", [{ fact: "Traffic and orders are flat against the last four weeks.", m: { trafficChangePercent: 0 } }], "violation"),
  allow("qualitative", "seasonal_yes", "seasonality", [{ fact: "Orders fell 15% week over week, matching the same week last year (-16%) at the end of the summer sale.", m: { ordersChangePercent: -15, lastYearSameWeekChangePercent: -16 } }]),
  block("qualitative", "seasonal_no", "seasonality", [{ fact: "Orders fell 15% this week, while the same week last year grew 8%.", m: { ordersChangePercent: -15, lastYearSameWeekChangePercent: 8 } }], "violation"),

  // 3. Missing or contradictory evidence must never pass.
  block("missing_conflict", "late_no_shipping_data", "delivery_delays", [{ fact: "Meta Campaign A cost per acquisition rose 80%; no shipping or delivery records were provided.", m: { cacIncreasePercent: 80 } }], "insufficient_information"),
  block("missing_conflict", "checkout_no_rate", "checkout_failure", [{ fact: "Customers mentioned problems at checkout in two chat messages.", m: { chatMentions: 2 } }], "insufficient_information"),
  block("missing_conflict", "reviews_conflict", "negative_sentiment", [{ fact: "Trustpilot export: 14 new 1-star reviews in 24 hours.", m: { newLowRatingReviewsCount: 14 } }, { fact: "Trustpilot export for the same 24 hours, same account: 3 new 1-star reviews.", m: { newLowRatingReviewsCount: 3 } }], "inconsistent_context"),
  block("missing_conflict", "late_conflict", "delivery_delays", [{ fact: "Carrier report: 14 orders breached the delivery promise this week.", m: { delayedOrdersCount: 14 } }, { fact: "Warehouse system, same orders and same week: 2 orders breached the delivery promise.", m: { delayedOrdersCount: 2 } }], "inconsistent_context"),

  // 4. Wrong diagnoses the learning benchmark produced. Would the gate stop them?
  block("wrong_cause", "damage_as_quality", "product_quality", [{ fact: "22 customers reported dented boxes and marked uppers on arrival; the carrier logged 19 'parcel damaged' exceptions; QA found no defects in warehouse stock.", m: { carrierDamageExceptions: 19, warehouseDefectsFound: 0 } }], undefined, "transit damage misread as product quality"),
  block("wrong_cause", "stockout_as_seasonal", "seasonality", [{ fact: "Weekly orders are down 22% while last year's same week was down 17%; the three best-selling shoes have zero stock in sizes 7 to 10.", m: { ordersChangePercent: -22, lastYearSameWeekChangePercent: -17 } }], undefined, "seasonal pattern is present, so the rule may pass a debatable cause"),
  block("wrong_cause", "spike_as_checkout", "checkout_failure", [{ fact: "An influencer post drove 5x normal traffic; payment page timeouts hit 11% during the surge and returned to normal when traffic fell.", m: { trafficMultiplier: 5, paymentTimeoutRate: 0.11 } }], undefined, "rate is over 5%, so a threshold rule cannot tell symptom from cause"),
  block("wrong_cause", "fatigue_as_delivery", "delivery_delays", [{ fact: "Meta Campaign A CAC rose 110% with falling clickthrough; all orders shipped on time.", m: { cacIncreasePercent: 110, delayedOrdersCount: 0 } }], "violation", "ad problem misread as delivery"),

  // 5. Wording robustness: the same facts said differently.
  allow("wording", "late_words", "delivery_delays", [{ fact: "Fourteen orders missed the promised delivery date by more than two days." }], "number written in words, no measurements"),
  allow("wording", "late_dozen", "delivery_delays", [{ fact: "A dozen orders arrived late against the delivery promise, plus three more this morning." }], "15 expressed indirectly"),
  block("wording", "late_eight_words", "delivery_delays", [{ fact: "Eight orders missed the promised delivery date." }], "violation", "8 in words"),
  allow("wording", "checkout_ratio", "checkout_failure", [{ fact: "41 of 500 checkout attempts failed in the last hour." }], "8.2% as a ratio"),
];

const REPEATS = ["late_10", "checkout_5_1", "cac_50", "damage_as_quality", "late_dozen"];

async function pool<T>(items: (() => Promise<T>)[], size = 4) {
  const out: T[] = []; let next = 0;
  await Promise.all(Array.from({ length: size }, async () => { while (next < items.length) { const i = next++; out[i] = await items[i](); } }));
  return out;
}

function toEvidence(c: Case): EvidenceT[] {
  const now = new Date().toISOString();
  return c.evidence.map((f, i) => ({ schemaVersion: 1 as const, evidenceId: `e_${c.id}_${i}`, investigationId: "inv_sapling_bench", businessId: "nova_store", observedFact: f.fact, measurements: f.m || {}, sourceRecordIds: [], retrievedAt: now }));
}

async function main() {
  if (process.argv.includes("--dry-run")) {
    cases.forEach((c, i) => console.log(`${String(i + 1).padStart(2)}. [${c.suite}] ${c.id}: ${c.cause} → expect ${c.expect}${c.label ? ` (${c.label})` : ""}`));
    console.log(`${cases.length} cases + ${REPEATS.length * 2} repeats. Nothing sent.`);
    return;
  }
  const run = (c: Case) => callSapling(DIAGNOSIS_POLICY[c.cause], renderEvidence(toEvidence(c)), claimFor(c.cause));
  const results = await pool(cases.map(c => () => run(c)));
  const repeats = await pool(REPEATS.flatMap(id => [0, 1].map(() => () => run(cases.find(c => c.id === id)!))));

  const rows = cases.map((c, i) => {
    const r = results[i];
    const gateOk = r.status !== "unavailable" && (c.expect === "allow" ? !r.blocked : r.blocked);
    const labelOk = c.label ? r.verdict === c.label : undefined;
    return { ...c, policy: DIAGNOSIS_POLICY[c.cause], claim: claimFor(c.cause), verdict: r.verdict, blocked: r.blocked, status: r.status, rawLabel: r.rawLabel, probabilities: r.probabilities, latencyMs: r.latencyMs, error: (r as any).error, gateOk, labelOk };
  });
  const stability = REPEATS.map((id, k) => {
    const first = rows.find(r => r.id === id)!;
    const again = [repeats[k * 2], repeats[k * 2 + 1]];
    return { id, verdicts: [first.verdict, ...again.map(a => a.verdict)], top: [first, ...again].map(a => Math.max(0, ...Object.values(a.probabilities || {}))) };
  });

  const ms = rows.map(r => r.latencyMs).sort((a, b) => a - b);
  const summary = {
    cases: rows.length,
    gateCorrect: rows.filter(r => r.gateOk).length,
    falsePass: rows.filter(r => r.expect === "block" && !r.blocked).map(r => r.id),
    falseBlock: rows.filter(r => r.expect === "allow" && r.blocked).map(r => r.id),
    labelCorrect: rows.filter(r => r.labelOk).length,
    labelled: rows.filter(r => r.label).length,
    calibratedUnsure: rows.filter(r => r.status === "unsure").length,
    unavailable: rows.filter(r => r.status === "unavailable").length,
    stableRepeats: stability.filter(s => new Set(s.verdicts).size === 1).length,
    latencyP50: ms[Math.floor(ms.length / 2)], latencyP95: ms[Math.floor(ms.length * 0.95)],
  };
  for (const r of rows) console.log(`${r.gateOk ? "✓" : "✗"} [${r.suite}] ${r.id}: ${r.verdict} (${r.status}) expect ${r.expect}${r.label ? `/${r.label}` : ""} ${r.latencyMs}ms`);
  console.log(JSON.stringify(summary, null, 2));
  const dir = path.resolve("data", "sapling-benchmark");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `sapling-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify({ ranAt: new Date().toISOString(), summary, stability, rows }, null, 2));
  console.log(`Log: ${path.relative(process.cwd(), file)}`);
}

main().catch(error => { console.error(error); process.exit(1); });
