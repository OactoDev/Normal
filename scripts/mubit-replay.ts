/**
 * Replays representative incident diagnoses through the same Mubit task the app uses, so Mubit collects
 * enough kept examples to train an adapter (25 by default; the console count is the source of truth).
 *
 *   npx tsx --env-file=.env scripts/mubit-replay.ts --dry-run          # print the cases, call nothing
 *   npx tsx --env-file=.env scripts/mubit-replay.ts --count 40         # send 40 live diagnosis calls
 *
 * Every call goes through mubitDiagnoser.diagnose: the same system prompt, model and output format as the app,
 * with the same strict validation. Mubit decides which calls become kept examples; Normal cannot read that
 * count or the adapter's status through the API, so check Tasks and Adapters in the Mubit console afterwards.
 */
import fs from "node:fs";
import path from "node:path";
import { CorrectionRecordT, EvidenceT, InvestigationT } from "../src/contracts";
import { DIAGNOSIS_TASK_CONSOLE_NAME, diagnosisModel, diagnosisTaskFingerprint, mubitDiagnoser } from "../src/intelligence/mubit-diagnoser";

process.env.NORMAL_STORE ??= "memory";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string, fallback: number) => {
  const index = args.indexOf(`--${name}`);
  const value = index >= 0 ? Number(args[index + 1]) : fallback;
  if (!Number.isInteger(value) || value < 1) throw new Error(`--${name} must be a positive integer`);
  return value;
};
const count = option("count", 40);
const concurrency = option("concurrency", 4);
const dryRun = flag("dry-run");

// Deterministic variation so reruns send the same spread, and each case is a new message.
let seed = option("seed", 7);
const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const between = (min: number, max: number) => Math.round(min + random() * (max - min));
const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];

type Fact = { observedFact: string; measurements: Record<string, string | number | boolean> };
type Case = { label: string; facts: Fact[]; withCorrection?: boolean };

const delivery = (): Fact => {
  const late = between(6, 40), carrier = pick(["Royal Mail", "DPD", "Evri", "UPS"]), hours = pick([24, 48, 72]);
  return { observedFact: `${late} tracked ${carrier} orders breached delivery SLA promise dates by >${hours} hours.`, measurements: { delayedOrdersCount: late, lateDeliveryRate: Number((late / between(80, 220)).toFixed(3)), slaBreachThresholdHours: hours } };
};
const adFatigue = (): Fact => {
  const base = between(1500, 2200), now = Math.round(base * (1.6 + random()));
  return { observedFact: `Meta Campaign ${pick(["A", "B", "Spring", "Retargeting"])} CAC rose from £${(base / 100).toFixed(2)} to £${(now / 100).toFixed(2)} as ad frequency climbed to ${(3 + random() * 2).toFixed(1)} and clickthrough fell.`, measurements: { currentCacMinor: now, baselineCacMinor: base, cacInflationPercent: Math.round(((now - base) / base) * 100) } };
};
const adInefficiency = (): Fact => {
  const base = between(1500, 2200), now = Math.round(base * (1.6 + random()));
  return { observedFact: `Google Shopping CAC rose from £${(base / 100).toFixed(2)} to £${(now / 100).toFixed(2)} after cost per click doubled; clickthrough and frequency were unchanged.`, measurements: { currentCacMinor: now, baselineCacMinor: base, cacInflationPercent: Math.round(((now - base) / base) * 100) } };
};
const coupon = (): Fact => {
  const rate = between(7, 25);
  return { observedFact: `Checkout step failure rate surged to ${rate}% with repeated COUPON_APPLY_TIMEOUT errors on code ${pick(["AUTUMN20", "WELCOME10", "FLASH15"])}.`, measurements: { failureRate: rate / 100, failedSessionCount: between(20, 140) } };
};
const payment = (): Fact => {
  const rate = between(6, 22);
  return { observedFact: `Checkout payment step failures reached ${rate}%, with ${pick(["card_declined_gateway_timeout", "3DS_CHALLENGE_FAILED", "PSP_503"])} errors and no coupon involved.`, measurements: { failureRate: rate / 100, failedSessionCount: between(20, 140) } };
};
const reviews = (theme: string): Fact => {
  const count = between(8, 35);
  return { observedFact: `${count} new 1-star reviews in 24 hours citing ${theme}.`, measurements: { newLowRatingReviewsCount: count } };
};
const viral = (): Fact => {
  const units = between(300, 1200);
  return { observedFact: `${pick(["Trail Runner 2", "Linen Overshirt", "Canvas Tote"])} sold ${units} units in 6 hours versus a ${between(40, 90)} daily average after a TikTok mention; orders and sessions spiked.`, measurements: { unitsSold6h: units, sessionsChangePercent: between(250, 900) } };
};
const stockout = (): Fact => {
  const skus = between(2, 6);
  return { observedFact: `${skus} best-selling products are out of stock; add-to-cart attempts on them fell to zero.`, measurements: { outOfStockSkuCount: skus, lostAddToCartEstimate: between(50, 400) } };
};
const seasonal = (): Fact => {
  const drop = between(10, 30);
  return { observedFact: `Orders fell ${drop}% week over week, matching the same week last year (-${drop + between(-3, 3)}%) and the end of the summer sale.`, measurements: { ordersChangePercent: -drop } };
};
const quiet = (): Fact => ({ observedFact: `Conversion rate is ${(2 + random()).toFixed(2)}%, within the 30-day range; no carrier, ad or checkout alerts.`, measurements: { conversionRate: Number((0.02 + random() / 100).toFixed(4)) } });

const templates: Array<() => Case> = [
  () => ({ label: "delivery_delays", facts: [delivery()] }),
  () => ({ label: "delivery_delays + reviews", facts: [delivery(), reviews("late delivery and no tracking updates")] }),
  () => ({ label: "ad_fatigue", facts: [adFatigue()] }),
  () => ({ label: "ad_fatigue (with merchant correction)", facts: [adFatigue()], withCorrection: true }),
  () => ({ label: "ad_inefficiency", facts: [adInefficiency()] }),
  () => ({ label: "discount_failure", facts: [coupon()] }),
  () => ({ label: "checkout_failure", facts: [payment()] }),
  () => ({ label: "product_quality", facts: [reviews(pick(["a zip that breaks within a week", "seams splitting after one wash", "soles peeling off"]))] }),
  () => ({ label: "negative_sentiment", facts: [reviews("rude replies from customer support")] }),
  () => ({ label: "viral_demand", facts: [viral()] }),
  () => ({ label: "stockout", facts: [stockout()] }),
  () => ({ label: "viral_demand + stockout", facts: [viral(), stockout()] }),
  () => ({ label: "seasonality", facts: [seasonal()] }),
  () => ({ label: "unknown", facts: [quiet()] }),
];

// The same representative correction a merchant makes in the demo, sent in the production message shape.
const demoCorrection: CorrectionRecordT = {
  correction: { schemaVersion: 1, correctionId: "corr_replay_ad_fatigue", investigationId: "inv_replay", diagnosisId: "diag_replay", modelCallId: "call_replay", predictedCause: "ad_inefficiency", correctedCause: "ad_fatigue", correctedEvidenceIds: ["e_replay"], note: "Rising frequency with falling clickthrough on the same creative is creative fatigue for us.", verifiedByUserId: "usr_operator_01", verifiedAt: new Date().toISOString(), ingestionStatus: "local_only" },
  examples: [{ observedFact: "Meta Campaign A customer acquisition cost (CAC) jumped from £18.20 to £38.50 with declining clickthrough.", measurements: { currentCacMinor: 3850, baselineCacMinor: 1820, cacInflationPercent: 112 } }],
};

function packet(index: number, facts: Fact[]): { investigation: InvestigationT; evidence: EvidenceT[] } {
  const now = new Date().toISOString(), investigationId = `inv_replay_${Date.now()}_${index}`;
  const evidence = facts.map((fact, n) => ({ schemaVersion: 1 as const, evidenceId: `e_replay_${index}_${n}`, investigationId, businessId: "nova_store", ...fact, sourceRecordIds: [], retrievedAt: now }));
  return { investigation: { schemaVersion: 1, investigationId, businessId: "nova_store", anomalyIds: [], evidenceIds: evidence.map(e => e.evidenceId), status: "active", createdAt: now, updatedAt: now }, evidence };
}

async function main() {
  const cases = Array.from({ length: count }, (_, i) => templates[i % templates.length]());
  console.log(`Mubit task: "${DIAGNOSIS_TASK_CONSOLE_NAME}…" · ${diagnosisModel()} · ${diagnosisTaskFingerprint()}`);
  if (dryRun) {
    cases.forEach((c, i) => console.log(`${String(i + 1).padStart(3)}. [${c.label}] ${c.facts.map(f => f.observedFact).join(" / ")}`));
    console.log(`Dry run: ${cases.length} cases, nothing sent.`);
    return;
  }
  if (!process.env.MUBIT_API_KEY) throw new Error("MUBIT_API_KEY is not set. Run with --env-file=.env");
  const results: Array<{ label: string; requestId?: string; cause?: string; error?: string }> = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, cases.length) }, async () => {
    while (next < cases.length) {
      const i = next++, c = cases[i], { investigation, evidence } = packet(i, c.facts);
      try {
        const result = await mubitDiagnoser.diagnose(investigation, evidence, c.withCorrection ? [demoCorrection] : []);
        results[i] = { label: c.label, requestId: result.modelCall.mubitRequestId, cause: result.diagnosis.output.primaryCause };
        console.log(`${String(i + 1).padStart(3)}. ${result.modelCall.mubitRequestId} [${c.label}] → ${result.diagnosis.output.primaryCause}`);
      } catch (error: any) {
        results[i] = { label: c.label, requestId: error.requestId, error: error.code || error.message };
        console.log(`${String(i + 1).padStart(3)}. FAILED [${c.label}] ${error.code || ""} ${error.message}`);
      }
    }
  }));
  const sent = results.filter(r => r.requestId && !r.error).length;
  const dir = path.resolve("data", "mubit-replay");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `replay-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify({ task: { consoleName: DIAGNOSIS_TASK_CONSOLE_NAME, model: diagnosisModel(), fingerprint: diagnosisTaskFingerprint() }, results }, null, 2));
  console.log(`\n${sent}/${cases.length} calls completed through Mubit; ${results.length - sent} failed. Log: ${path.relative(process.cwd(), file)}`);
  console.log("Mubit decides which calls become kept examples. Open Tasks in the Mubit console for the kept-example count and Adapters for training status.");
}

main().catch(error => { console.error(error); process.exit(1); });
