/**
 * Learning benchmark: do merchant corrections, sent through Mubit, fix later diagnoses of new incidents?
 *
 *   npx tsx --env-file=.env scripts/mubit-learning-benchmark.ts
 *
 * 1. Train: one incident per pattern is diagnosed. Where the answer differs from the merchant's own rule,
 *    a merchant correction is saved (the same CorrectionRecord shape the app stores).
 * 2. Test: three held-out incidents per pattern (new numbers and wording, never used for training) are
 *    diagnosed three times through mubitDiagnoser: with no examples, with the corrections only, and with the
 *    corrections plus confirmations (training incidents the merchant marked as right), up to the app's limit of 6.
 *
 * Every call is a live Mubit call in the app's diagnosis task (same instructions, model and output format).
 * This measures the correction loop. Adapter training status is only visible in the Mubit console.
 */
import fs from "node:fs";
import path from "node:path";
import { CorrectionRecordT, EvidenceT, InvestigationT, RootCauseT } from "../src/contracts";
import { MAX_CORRECTION_EXAMPLES, diagnosisModel, diagnosisTaskFingerprint, mubitDiagnoser } from "../src/intelligence/mubit-diagnoser";

process.env.NORMAL_STORE ??= "memory";

type Fact = { observedFact: string; measurements: Record<string, string | number | boolean> };
type Pattern = { id: string; title: string; truth: RootCauseT; rule: string; train: Fact[]; test: Fact[][] };

// Merchant house rules: where the shop's own definition decides between two plausible causes.
const patterns: Pattern[] = [
  {
    id: "transit_damage", title: "Parcels arriving damaged", truth: "delivery_delays",
    rule: "Damage in transit is a carrier problem for us, so we file it under delivery issues, not product quality.",
    train: [{ observedFact: "17 new 1-star reviews in 24 hours say the shoe box arrived crushed and the trainers were scuffed; 15 of those orders have a carrier 'damaged in handling' scan.", measurements: { newLowRatingReviewsCount: 17, carrierDamageScans: 15 } }],
    test: [
      [{ observedFact: "22 customers reported dented boxes and marked uppers on arrival this week; the carrier logged 19 'parcel damaged' exceptions on the same orders.", measurements: { damageComplaints: 22, carrierDamageExceptions: 19 } }],
      [{ observedFact: "Returns flagged 'arrived damaged' rose to 31 in two days, all shipped through the same DPD hub that reported a conveyor fault.", measurements: { arrivedDamagedReturns: 31, hubIncidentReported: true } }],
      [{ observedFact: "12 one-star reviews mention torn packaging and scuffed soles on delivery; QA re-inspected 40 units from the same batch in the warehouse and found none damaged.", measurements: { newLowRatingReviewsCount: 12, warehouseUnitsInspected: 40, warehouseDefectsFound: 0 } }],
    ],
  },
  {
    id: "seasonal_stockout", title: "Sizes sold out during a seasonal dip", truth: "stockout",
    rule: "When best-selling sizes are out, we call it a stockout even if the season is also slowing; we can fix stock, not the season.",
    train: [{ observedFact: "Orders fell 18% week over week, close to the same week last year (-14%); UK sizes 8, 9 and 10 of the top two trainers have been out of stock for 5 days.", measurements: { ordersChangePercent: -18, lastYearSameWeekChangePercent: -14, coreSizesOutOfStock: 3 } }],
    test: [
      [{ observedFact: "Weekly orders are down 22% and last year's same week was down 17%; the three best-selling running shoes show zero stock in sizes 7 to 10.", measurements: { ordersChangePercent: -22, lastYearSameWeekChangePercent: -17, bestSellersWithCoreSizesOut: 3 } }],
      [{ observedFact: "Revenue dropped 15% as the summer sale ended (same pattern as last August); add-to-cart on the Air Max 90 fell 70% because sizes 8 to 11 are sold out.", measurements: { revenueChangePercent: -15, addToCartChangePercent: -70, sizesSoldOut: 4 } }],
      [{ observedFact: "Orders are 12% below last week, in line with the usual post-payday dip; 2 of the top 5 products have no stock in their most popular sizes.", measurements: { ordersChangePercent: -12, topProductsWithCoreSizesOut: 2 } }],
    ],
  },
  {
    id: "spike_checkout_errors", title: "Checkout errors during a viral spike", truth: "viral_demand",
    rule: "Checkout errors that only appear under a traffic spike are a demand problem for us; the cause is the viral spike, the errors are the symptom.",
    train: [{ observedFact: "After a TikTok video, sessions rose 6x in two hours and checkout returned HTTP 503 on 9% of attempts; outside the spike the error rate was 0.2%.", measurements: { sessionsMultiplier: 6, checkoutErrorRate: 0.09, baselineErrorRate: 0.002 } }],
    test: [
      [{ observedFact: "An influencer post drove 5x normal traffic within an hour; payment page timeouts hit 11% during the surge and returned to normal when traffic fell.", measurements: { trafficMultiplier: 5, paymentTimeoutRate: 0.11 } }],
      [{ observedFact: "Sessions jumped from 4,000 to 31,000 an hour after a celebrity wore the trainers; checkout 'service unavailable' errors reached 7% at peak.", measurements: { sessionsPerHourBefore: 4000, sessionsPerHourPeak: 31000, checkoutErrorRatePeak: 0.07 } }],
      [{ observedFact: "A viral Reddit thread sent 8x traffic; cart-to-order conversion fell from 3.1% to 1.4% as the order API rate-limited requests.", measurements: { trafficMultiplier: 8, conversionBefore: 0.031, conversionDuring: 0.014 } }],
    ],
  },
  {
    id: "auction_cac", title: "CAC up from auction prices (control)", truth: "ad_inefficiency",
    rule: "Higher costs per click with unchanged clickthrough is inefficient bidding.",
    train: [{ observedFact: "Google Shopping CAC rose from £17.10 to £29.80 after cost per click rose 70%; clickthrough and frequency were flat.", measurements: { baselineCacMinor: 1710, currentCacMinor: 2980, cpcChangePercent: 70 } }],
    test: [
      [{ observedFact: "Meta CAC climbed from £20.40 to £33.00 as CPMs rose 55% during a competitor's launch; clickthrough held at 1.9%.", measurements: { baselineCacMinor: 2040, currentCacMinor: 3300, cpmChangePercent: 55, ctr: 0.019 } }],
      [{ observedFact: "Search CAC is up 48% because cost per click doubled on brand terms; impressions and clickthrough are unchanged.", measurements: { cacChangePercent: 48, cpcChangePercent: 100 } }],
      [{ observedFact: "Paid social cost per purchase went from £16 to £27 after auction prices rose 60%; frequency stayed at 1.8 and clickthrough at 2.1%.", measurements: { baselineCpaMinor: 1600, currentCpaMinor: 2700, frequency: 1.8, ctr: 0.021 } }],
    ],
  },
  {
    id: "expired_code", title: "Expired promo code at checkout (control)", truth: "discount_failure",
    rule: "Checkout failures caused by a promo code are discount failures.",
    train: [{ observedFact: "Checkout failures reached 13% with 'code expired' errors on SUMMER20, which influencers are still posting.", measurements: { failureRate: 0.13, failingCode: "SUMMER20" } }],
    test: [
      [{ observedFact: "Failed checkouts rose to 9% and 94% of them show 'promo code not valid' for WELCOME15.", measurements: { failureRate: 0.09, shareWithPromoError: 0.94 } }],
      [{ observedFact: "Cart abandonment at the discount step jumped to 18%; the AUTUMN25 code was disabled early but still appears in a newsletter.", measurements: { abandonmentAtDiscountStep: 0.18 } }],
      [{ observedFact: "Customers applying FLASH10 get 'coupon service timeout' and 12% of those checkouts fail; checkouts without a code succeed normally.", measurements: { failureRateWithCode: 0.12, failureRateWithoutCode: 0.003 } }],
    ],
  },
  {
    id: "support_backlog", title: "Support backlog reviews (control)", truth: "negative_sentiment",
    rule: "Reviews about our service, not the product or delivery, are sentiment.",
    train: [{ observedFact: "26 one-star reviews this week say support has not replied for 5 days; the ticket backlog grew to 640.", measurements: { newLowRatingReviewsCount: 26, ticketBacklog: 640 } }],
    test: [
      [{ observedFact: "Trustpilot rating fell from 4.5 to 3.9 with reviews citing rude chat replies; delivery and product scores are unchanged.", measurements: { ratingBefore: 4.5, ratingAfter: 3.9 } }],
      [{ observedFact: "19 reviews complain that refunds take three weeks to be acknowledged by support.", measurements: { newLowRatingReviewsCount: 19 } }],
      [{ observedFact: "Social mentions turned 40% negative after a support agent's dismissive reply went viral; orders and deliveries are normal.", measurements: { negativeMentionShare: 0.4 } }],
    ],
  },
  {
    id: "fit_complaints", title: "Fit complaints (control)", truth: "product_quality",
    rule: "Problems with the product itself are product quality.",
    train: [{ observedFact: "Returns citing 'runs a full size small' rose to 14% on the Pegasus 41, up from 3%.", measurements: { returnRate: 0.14, baselineReturnRate: 0.03 } }],
    test: [
      [{ observedFact: "21 reviews say the sole separates from the upper within two weeks of wear.", measurements: { newLowRatingReviewsCount: 21 } }],
      [{ observedFact: "The new colourway's return rate is 17% with 'colour bleeds when wet' as the top reason.", measurements: { returnRate: 0.17 } }],
      [{ observedFact: "Customers report the insole squeaks on every step; 9% of buyers have opened a complaint.", measurements: { complaintRate: 0.09 } }],
    ],
  },
];

// Which recovery playbook the plan generator picks for a cause (mirrors src/intelligence/plan-generator.ts).
const playbook = (cause?: string) =>
  cause === "delivery_delays" ? "delivery notices + banner" :
  cause === "ad_fatigue" || cause === "ad_inefficiency" ? "ad budget cut" :
  cause === "checkout_failure" ? "checkout banner" : "generic notice";

let n = 0;
function packet(facts: Fact[]): { investigation: InvestigationT; evidence: EvidenceT[] } {
  const now = new Date().toISOString(), id = `inv_learn_${Date.now()}_${n++}`;
  const evidence = facts.map((fact, i) => ({ schemaVersion: 1 as const, evidenceId: `e_learn_${n}_${i}`, investigationId: id, businessId: "nova_store", ...fact, sourceRecordIds: [], retrievedAt: now }));
  return { investigation: { schemaVersion: 1, investigationId: id, businessId: "nova_store", anomalyIds: [], evidenceIds: evidence.map(e => e.evidenceId), status: "active", createdAt: now, updatedAt: now }, evidence };
}

async function diagnose(facts: Fact[], corrections: CorrectionRecordT[]) {
  const { investigation, evidence } = packet(facts);
  const started = Date.now();
  try {
    const r = await mubitDiagnoser.diagnose(investigation, evidence, corrections);
    const top = r.diagnosis.output.supportedHypotheses.find(h => h.cause === r.diagnosis.output.primaryCause);
    const sapling = r.diagnosis.serverAttribution.saplingCheck;
    return { cause: r.diagnosis.output.primaryCause, confidence: top?.confidence, rationale: top?.rationale, mubitRequestId: r.modelCall.mubitRequestId, appliedCorrections: r.modelCall.appliedCorrectionIds?.length || 0, sapling: sapling?.verdict || sapling?.status, saplingBlocked: sapling?.blocked, ms: Date.now() - started };
  } catch (error: any) {
    return { error: error.code || error.message, mubitRequestId: error.requestId, ms: Date.now() - started };
  }
}

async function pool<T>(items: (() => Promise<T>)[], size = 4) {
  const out: T[] = []; let next = 0;
  await Promise.all(Array.from({ length: size }, async () => { while (next < items.length) { const i = next++; out[i] = await items[i](); } }));
  return out;
}

async function main() {
  if (!process.env.MUBIT_API_KEY) throw new Error("MUBIT_API_KEY is not set. Run with --env-file=.env");
  console.log(`Mubit task fingerprint ${diagnosisTaskFingerprint()} · ${diagnosisModel()}`);

  // 1. Train: diagnose one incident per pattern; correct the ones that break the merchant's rule.
  const train = await pool(patterns.map(p => () => diagnose(p.train, [])));
  const corrections: CorrectionRecordT[] = [], confirmations: CorrectionRecordT[] = [];
  patterns.forEach((p, i) => {
    const t = train[i] as any;
    console.log(`train ${p.id}: ${t.cause || t.error} (merchant: ${p.truth}) ${t.mubitRequestId || ""}`);
    if (t.cause) (t.cause === p.truth ? confirmations : corrections).push({
      correction: { schemaVersion: 1, correctionId: `corr_learn_${p.id}`, investigationId: "inv_learn_train", diagnosisId: "diag_learn_train", modelCallId: "call_learn_train", predictedCause: t.cause, correctedCause: p.truth, correctedEvidenceIds: [], ...(t.cause === p.truth ? {} : { note: p.rule }), verifiedByUserId: "merchant_owner", verifiedAt: new Date().toISOString(), ingestionStatus: "local_only" },
      correctedMubitRequestId: t.mubitRequestId,
      examples: p.train,
    });
  });
  // The app sends at most 6 verified examples; confirmations from the most confusable patterns go first.
  const priority = ["spike_checkout_errors", "expired_code", "transit_damage", "fit_complaints", "support_backlog", "seasonal_stockout", "auction_cac"];
  confirmations.sort((a, b) => priority.indexOf(a.correction.correctionId.replace("corr_learn_", "")) - priority.indexOf(b.correction.correctionId.replace("corr_learn_", "")));
  const verified = [...corrections, ...confirmations].slice(0, MAX_CORRECTION_EXAMPLES);
  console.log(`${corrections.length} correction(s), ${confirmations.length} confirmation(s); ${verified.length} verified examples fit the limit.`);

  // 2. Test: the same held-out incidents, before and after the corrections.
  const cases = patterns.flatMap(p => p.test.map((facts, k) => ({ p, k, facts })));
  const rounds: Record<string, any[]> = {};
  for (const [name, applied] of [["before", []], ["after", corrections], ["verified", verified]] as const) {
    rounds[name] = await pool(cases.map(c => () => diagnose(c.facts, applied as CorrectionRecordT[])));
    const ok = rounds[name].filter((r, i) => r.cause === cases[i].p.truth).length;
    console.log(`${name}: ${ok}/${cases.length} match the merchant's rule`);
  }

  const results = cases.map((c, i) => ({ pattern: c.p.id, title: c.p.title, truth: c.p.truth, rule: c.p.rule, incident: c.facts.map(f => f.observedFact).join(" "), before: rounds.before[i], after: rounds.after[i], verified: rounds.verified[i], rightPlaybook: playbook(c.p.truth) }));
  const dir = path.resolve("data", "mubit-learning");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `learning-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify({ model: diagnosisModel(), fingerprint: diagnosisTaskFingerprint(), ranAt: new Date().toISOString(), patterns: patterns.map(p => ({ id: p.id, title: p.title, truth: p.truth, rule: p.rule })), train: patterns.map((p, i) => ({ pattern: p.id, ...train[i] })), corrections: corrections.map(c => ({ pattern: c.correction.correctionId.replace("corr_learn_", ""), predicted: c.correction.predictedCause, corrected: c.correction.correctedCause, note: c.correction.note, mubitRequestId: c.correctedMubitRequestId })),
    verifiedExamples: verified.map(c => ({ pattern: c.correction.correctionId.replace("corr_learn_", ""), predicted: c.correction.predictedCause, verified: c.correction.correctedCause, kind: c.correction.predictedCause === c.correction.correctedCause ? "confirmation" : "correction" })), results }, null, 2));
  console.log(`Log: ${path.relative(process.cwd(), file)}`);
}

main().catch(error => { console.error(error); process.exit(1); });
