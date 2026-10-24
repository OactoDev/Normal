/**
 * Replays representative incident diagnoses through the same Mubit task the app uses, so Mubit collects
 * enough kept examples to train an adapter (25 by default; the console count is the source of truth).
 *
 *   npx tsx --env-file=.env scripts/mubit-replay.ts --dry-run          # print the cases, call nothing
 *   npx tsx --env-file=.env scripts/mubit-replay.ts --count 40         # send 40 live diagnosis calls
 *   npx tsx --env-file=.env scripts/mubit-replay.ts --cases cases.json # send prepared cases ([{ label, facts }])
 *
 * Every call goes through mubitDiagnoser.diagnose: the same system prompt, model and output format as the app,
 * with the same strict validation and temperature 0. No merchant corrections are attached, so the adapter gets one
 * consistent answer per kind of incident. Mubit decides which calls become kept examples; Normal cannot read that
 * count or the adapter's status through the API, so check Tasks and Adapters in the Mubit console afterwards.
 */
import fs from "node:fs";
import path from "node:path";
import { EvidenceT, InvestigationT } from "../src/contracts";
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
const casesIndex = args.indexOf("--cases");
const casesFile = casesIndex >= 0 ? args[casesIndex + 1] : undefined;

// Deterministic variation so reruns send the same spread, and each case is a new message.
let seed = option("seed", 7);
const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const between = (min: number, max: number) => Math.round(min + random() * (max - min));
const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];

type Fact = { observedFact: string; measurements: Record<string, string | number | boolean> };
type Case = { label: string; facts: Fact[] };

// Several phrasings per cause, so each call is a new message rather than the same sentence with new numbers.
// An adapter learns from the variety; Mubit treats calls that differ only in numbers as near-duplicates.
const carriers = ["Royal Mail", "DPD", "Evri", "UPS", "DHL Parcel", "Yodel"];
const hubs = ["Leeds", "Daventry", "Warrington", "Heathrow", "Glasgow", "Bristol"];
const products = ["Trail Runner 2", "Linen Overshirt", "Canvas Tote", "Merino Crew", "Rain Shell", "Court Classic"];
const pounds = (minor: number) => `£${(minor / 100).toFixed(2)}`;

const delivery = (): Fact => {
  const late = between(6, 40), total = between(80, 220), carrier = pick(carriers), hub = pick(hubs), hours = pick([24, 48, 72]);
  const measurements = { delayedOrdersCount: late, lateDeliveryRate: Number((late / total).toFixed(3)), slaBreachThresholdHours: hours };
  return pick([
    { observedFact: `${late} tracked ${carrier} orders breached delivery SLA promise dates by >${hours} hours.`, measurements },
    { observedFact: `${late} of ${total} parcels handed to ${carrier} on Tuesday are still "in transit" past the promised date; tracking stalled at the ${hub} hub.`, measurements },
    { observedFact: `${carrier} posted a service alert for ${hub}: sorting backlog. ${late} orders are now ${hours}+ hours late.`, measurements },
    { observedFact: `Where-is-my-order tickets jumped; ${late} open orders show no ${carrier} scan for ${hours} hours after dispatch.`, measurements: { ...measurements, wismoTickets: late + between(2, 15) } },
  ]);
};
const adFatigue = (): Fact => {
  const base = between(1500, 2200), now = Math.round(base * (1.6 + random())), frequency = (3 + random() * 2).toFixed(1), ctr = (0.4 + random() * 0.5).toFixed(2);
  const measurements = { currentCacMinor: now, baselineCacMinor: base, cacInflationPercent: Math.round(((now - base) / base) * 100), adFrequency: Number(frequency) };
  return pick([
    { observedFact: `Meta campaign "${pick(["Spring", "Retargeting", "Prospecting", "Autumn Drop"])}" CAC rose from ${pounds(base)} to ${pounds(now)} as ad frequency climbed to ${frequency} and clickthrough fell.`, measurements },
    { observedFact: `The same Instagram creative has run for ${between(4, 9)} weeks; frequency is ${frequency}, CTR dropped to ${ctr}% and cost per purchase is up from ${pounds(base)} to ${pounds(now)}.`, measurements },
    { observedFact: `TikTok ads: audience saturation. Reach is flat, each viewer has seen the ad ${frequency} times, CTR halved, CAC ${pounds(base)} → ${pounds(now)}.`, measurements },
  ]);
};
const adInefficiency = (): Fact => {
  const base = between(1500, 2200), now = Math.round(base * (1.6 + random()));
  const measurements = { currentCacMinor: now, baselineCacMinor: base, cacInflationPercent: Math.round(((now - base) / base) * 100) };
  return pick([
    { observedFact: `Google Shopping CAC rose from ${pounds(base)} to ${pounds(now)} after cost per click doubled; clickthrough and frequency were unchanged.`, measurements },
    { observedFact: `A competitor started bidding on our brand keywords; search CPC is up ${between(60, 140)}% and CAC went from ${pounds(base)} to ${pounds(now)} with the same creatives.`, measurements },
    { observedFact: `Meta switched the campaign to broad targeting after a settings change; CTR is normal but conversion rate fell and CAC is ${pounds(now)} vs ${pounds(base)}.`, measurements },
  ]);
};
const coupon = (): Fact => {
  const rate = between(7, 25), failed = between(20, 140), code = pick(["AUTUMN20", "WELCOME10", "FLASH15", "VIP25"]);
  const measurements = { failureRate: rate / 100, failedSessionCount: failed };
  return pick([
    { observedFact: `Checkout step failure rate surged to ${rate}% with repeated COUPON_APPLY_TIMEOUT errors on code ${code}.`, measurements },
    { observedFact: `Customers report "${code} is not valid" at checkout although the promotion is live; ${failed} sessions abandoned at the discount step.`, measurements },
    { observedFact: `${code} applies 0% instead of the advertised discount since this morning's price import; ${rate}% of promo checkouts were abandoned.`, measurements },
  ]);
};
const payment = (): Fact => {
  const rate = between(6, 22), failed = between(20, 140);
  const measurements = { failureRate: rate / 100, failedSessionCount: failed };
  return pick([
    { observedFact: `Checkout payment step failures reached ${rate}%, with ${pick(["card_declined_gateway_timeout", "3DS_CHALLENGE_FAILED", "PSP_503"])} errors and no coupon involved.`, measurements },
    { observedFact: `Apple Pay and card payments time out after the ${pick(["Stripe", "Adyen", "Checkout.com"])} webhook change; ${failed} orders failed at "Pay now".`, measurements },
    { observedFact: `The checkout page throws a JavaScript error on Safari after today's theme release; ${rate}% of mobile checkouts fail before payment.`, measurements },
  ]);
};
const qualityTheme = () => pick(["a zip that breaks within a week", "seams splitting after one wash", "soles peeling off", "colour running in the first wash", "sizing two sizes small"]);
const reviews = (theme: string): Fact => {
  const count = between(8, 35);
  return pick([
    { observedFact: `${count} new 1-star reviews in 24 hours citing ${theme}.`, measurements: { newLowRatingReviewsCount: count } },
    { observedFact: `Average rating fell from 4.6 to ${(3 + random()).toFixed(1)} this week; ${count} reviews mention ${theme}.`, measurements: { newLowRatingReviewsCount: count } },
  ]);
};
const returns = (theme: string): Fact => {
  const rate = between(14, 32), product = pick(products);
  return pick([
    { observedFact: `${product} return rate rose to ${rate}% (normally 5%); the top return reason is "faulty".`, measurements: { returnRatePercent: rate, baselineReturnRatePercent: 5 } },
    { observedFact: `Returns for ${product} from the new batch are ${rate}%, mostly "${theme}".`, measurements: { returnRatePercent: rate, baselineReturnRatePercent: 5 } },
  ]);
};
const support = (): Fact => {
  const count = between(8, 35);
  return pick([
    { observedFact: `${count} new 1-star reviews in 24 hours citing rude replies from customer support.`, measurements: { newLowRatingReviewsCount: count } },
    { observedFact: `A post calling our refund policy unfair has ${between(2, 20)}k shares; ${count} angry comments and reviews in a day, orders and delivery normal.`, measurements: { newLowRatingReviewsCount: count } },
  ]);
};
const viral = (): Fact => {
  const units = between(300, 1200), product = pick(products), sessions = between(250, 900);
  const measurements = { unitsSold6h: units, sessionsChangePercent: sessions };
  return pick([
    { observedFact: `${product} sold ${units} units in 6 hours versus a ${between(40, 90)} daily average after a TikTok mention; orders and sessions spiked.`, measurements },
    { observedFact: `Sessions are up ${sessions}% since a ${pick(["YouTube review", "celebrity Instagram story", "Reddit thread"])} featured ${product}; ${units} units sold today.`, measurements },
  ]);
};
const stockout = (): Fact => {
  const skus = between(2, 6), lost = between(50, 400);
  const measurements = { outOfStockSkuCount: skus, lostAddToCartEstimate: lost };
  return pick([
    { observedFact: `${skus} best-selling products are out of stock; add-to-cart attempts on them fell to zero.`, measurements },
    { observedFact: `The warehouse sync shows 0 units for ${skus} core sizes of ${pick(products)}; product pages say "Sold out" and ${lost} notify-me sign-ups came in.`, measurements },
  ]);
};
const seasonal = (): Fact => {
  const drop = between(10, 30);
  return pick([
    { observedFact: `Orders fell ${drop}% week over week, matching the same week last year (-${drop + between(-3, 3)}%) and the end of the summer sale.`, measurements: { ordersChangePercent: -drop } },
    { observedFact: `Traffic and orders are down ${drop}% in the first week of January, as in each of the last three years; conversion rate unchanged.`, measurements: { ordersChangePercent: -drop } },
  ]);
};
const quiet = (): Fact => pick([
  { observedFact: `Conversion rate is ${(2 + random()).toFixed(2)}%, within the 30-day range; no carrier, ad or checkout alerts.`, measurements: { conversionRate: Number((0.02 + random() / 100).toFixed(4)) } },
  { observedFact: `Revenue is ${between(3, 8)}% below forecast today; traffic, conversion, delivery and ad costs are all within normal ranges.`, measurements: { revenueVsForecastPercent: -between(3, 8) } },
]);

const templates: Array<() => Case> = [
  () => ({ label: "delivery_delays", facts: [delivery()] }),
  () => ({ label: "delivery_delays + reviews", facts: [delivery(), reviews("late delivery and no tracking updates")] }),
  () => ({ label: "ad_fatigue", facts: [adFatigue()] }),
  () => ({ label: "ad_inefficiency", facts: [adInefficiency()] }),
  () => ({ label: "discount_failure", facts: [coupon()] }),
  () => ({ label: "checkout_failure", facts: [payment()] }),
  () => ({ label: "product_quality", facts: [reviews(qualityTheme())] }),
  () => { const theme = qualityTheme(); return { label: "product_quality + returns", facts: [returns(theme), reviews(theme)] }; },
  () => ({ label: "negative_sentiment", facts: [support()] }),
  () => ({ label: "viral_demand", facts: [viral()] }),
  () => ({ label: "stockout", facts: [stockout()] }),
  () => ({ label: "viral_demand + stockout", facts: [viral(), stockout()] }),
  () => ({ label: "seasonality", facts: [seasonal()] }),
  () => ({ label: "unknown", facts: [quiet()] }),
];

function packet(index: number, facts: Fact[]): { investigation: InvestigationT; evidence: EvidenceT[] } {
  const now = new Date().toISOString(), investigationId = `inv_replay_${Date.now()}_${index}`;
  const evidence = facts.map((fact, n) => ({ schemaVersion: 1 as const, evidenceId: `e_replay_${index}_${n}`, investigationId, businessId: "nova_store", ...fact, sourceRecordIds: [], retrievedAt: now }));
  return { investigation: { schemaVersion: 1, investigationId, businessId: "nova_store", anomalyIds: [], evidenceIds: evidence.map(e => e.evidenceId), status: "active", createdAt: now, updatedAt: now }, evidence };
}

async function main() {
  const cases: Case[] = casesFile
    ? JSON.parse(fs.readFileSync(casesFile, "utf8"))
    : Array.from({ length: count }, (_, i) => templates[i % templates.length]());
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
        // Mubit may answer 503 engine_unavailable when busy; one retry after a pause before counting a failure.
        const result = await mubitDiagnoser.diagnose(investigation, evidence).catch(async (error: any) => {
          if (!["MUBIT_REQUEST_FAILED", "MUBIT_UNAVAILABLE"].includes(error.code)) throw error;
          await new Promise(resolve => setTimeout(resolve, 5000));
          return mubitDiagnoser.diagnose(investigation, evidence);
        });
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
