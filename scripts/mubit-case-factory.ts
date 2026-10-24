/**
 * Builds training incidents for the diagnosis task with two more Mubit tasks on gemini-4-argon:
 *   1. a case writer (temperature 0.9 for variety) that writes labelled incidents per root cause;
 *   2. a blind checker (temperature 0) that names each incident's cause without seeing the label.
 * Only incidents the checker agrees with, and calls "clear", are kept. Cases from elsewhere (e.g. Cursor) can be
 * added with --include and go through the same check.
 *
 *   npx tsx --env-file=.env scripts/mubit-case-factory.ts --per-cause 6 --include cases.json
 *   npx tsx --env-file=.env scripts/mubit-replay.ts --cases data/mubit-cases/cases-<ts>.json
 */
import fs from "node:fs";
import path from "node:path";
import { RootCause } from "../src/contracts";
import { mubitRequest, readMubitReply } from "../src/llm/mubit";

type Fact = { observedFact: string; measurements: Record<string, number | boolean> };
type Case = { label: string; facts: Fact[]; source?: string };

const args = process.argv.slice(2);
const option = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const perCause = Number(option("per-cause") || 6), include = option("include");

const MEANING: Record<string, string> = {
  ad_fatigue: "paid ads lose effectiveness because the same audience has seen the same creative too often: rising frequency, falling CTR, rising CAC on an unchanged campaign",
  ad_inefficiency: "ad spend buys less because of auction, targeting or bidding problems (higher CPC, competitor bids, settings changes), not creative wear-out; frequency and CTR roughly normal",
  delivery_delays: "orders reach customers late because of carrier or warehouse dispatch problems (stalled tracking, missed promised dates)",
  product_quality: "a product is faulty or not as described, shown by returns and reviews about the product itself",
  negative_sentiment: "customers turn against the brand for non-product, non-delivery reasons (rude support, unpopular policy, backlash) while orders and delivery are normal",
  checkout_failure: "customers cannot complete payment or checkout because of technical errors, with no discount code involved",
  discount_failure: "a promotion or discount code fails (not applied, rejected, wrong amount), causing abandoned checkouts during a live promotion",
  stockout: "best-selling items or key sizes are out of stock, so demand cannot convert",
  viral_demand: "a sudden external spike in demand (social post, press, influencer) multiplies traffic and orders far above normal",
  seasonality: "a change that matches the normal yearly calendar pattern (same week last year, end of a sale season, holidays) with conversion unchanged",
  unknown: "metrics are within normal ranges or the evidence is too thin to name any cause",
};

// Fixed instructions per task; the cause and the cases go in the user message, so each stays one Mubit task.
const WRITER_INSTRUCTIONS = `You write synthetic test incidents for an e-commerce operations AI that diagnoses root causes. Return JSON only: an array of incidents, each {"facts": [1 to 3 facts]}, each fact {"observedFact": "one or two sentences an ops monitoring tool would log", "measurements": {"camelCaseKey": number or boolean}}. The shop is a UK online store (GBP, UK carriers, Shopify, Meta, Google, TikTok); invent product names; no real people, emails or phone numbers. Every incident must be clearly diagnosable as the requested root cause, with the decisive signal stated as numbers, multiples and rates written out. About a third include a plausible side-effect fact, but the main cause stays obvious. Vary wording, channels, products and magnitudes; no two incidents start with the same words. Money in pence with keys ending in Minor.`;
const CHECKER_INSTRUCTIONS = `You check test incidents for an online shop. For each incident, name the single most likely root cause from: ${RootCause.options.join(", ")}. Use unknown only if no cause is supported. Say "clear" if the evidence makes that cause clear, or "ambiguous" if another cause is reasonably likely. Return JSON only: an array of {"id", "cause", "clarity"} in the same order.`;

const calls: Array<{ task: string; requestId?: string; ok: boolean; note?: string }> = [];
async function ask(task: string, system: string, user: string, temperature: number) {
  const request = mubitRequest({ system, user, maxTokens: 8192, json: true, temperature });
  let response: Response;
  // Mubit answers 429/503 with retry-after when it is busy; wait and try again, at most three times.
  for (let attempt = 1; ; attempt++) {
    response = await fetch(request.url, { method: "POST", headers: request.headers, body: JSON.stringify(request.body), signal: AbortSignal.timeout(120000) });
    if (![429, 503].includes(response.status) || attempt === 3) break;
    calls.push({ task, requestId: response.headers.get("x-middleware-request-id") || undefined, ok: false, note: `HTTP ${response.status}, retried` });
    await new Promise(resolve => setTimeout(resolve, 1000 * Math.max(2, Number(response.headers.get("retry-after")) || 2) * attempt));
  }
  const requestId = response.headers.get("x-middleware-request-id") || undefined;
  if (!response.ok) { calls.push({ task, requestId, ok: false, note: `HTTP ${response.status}` }); return undefined; }
  const reply = readMubitReply(await response.json());
  try {
    const parsed = JSON.parse(reply.content || "");
    calls.push({ task, requestId, ok: reply.complete });
    return Array.isArray(parsed) ? parsed : undefined;
  } catch { calls.push({ task, requestId, ok: false, note: "not JSON" }); return undefined; }
}

function wellFormed(item: any): item is { facts: Fact[] } {
  const facts = item?.facts;
  return Array.isArray(facts) && facts.length >= 1 && facts.length <= 3 && facts.every((f: any) =>
    typeof f?.observedFact === "string" && f.observedFact.length >= 20 && f.observedFact.length <= 400
    && !/[\w.+-]+@[\w-]+\.\w+/.test(f.observedFact)
    && f.measurements && typeof f.measurements === "object" && Object.keys(f.measurements).length >= 1
    && Object.entries(f.measurements).every(([k, v]) => /^[a-z][A-Za-z0-9]*$/.test(k) && (typeof v === "number" || typeof v === "boolean")));
}

async function main() {
  if (!process.env.MUBIT_API_KEY) throw new Error("MUBIT_API_KEY is not set. Run with --env-file=.env");
  const cases: Case[] = [];
  if (include) for (const c of JSON.parse(fs.readFileSync(include, "utf8"))) if (RootCause.options.includes(c.label) && wellFormed(c)) cases.push({ label: c.label, facts: c.facts, source: "included" });
  const included = cases.length;
  const causes = [...RootCause.options];
  for (let i = 0; i < causes.length; i += 4) await Promise.all(causes.slice(i, i + 4).map(async cause => {
    const items = await ask("case_writer", WRITER_INSTRUCTIONS, JSON.stringify({ rootCause: cause, meaning: MEANING[cause], count: perCause }), 0.9);
    for (const item of items || []) if (wellFormed(item)) cases.push({ label: cause, facts: item.facts.map(f => ({ observedFact: f.observedFact.trim(), measurements: f.measurements })), source: "gemini" });
  }));
  console.log(`${included} included + ${cases.length - included} written by gemini-4-argon via Mubit`);

  const verdicts = new Map<string, { cause?: string; clarity?: string }>();
  const ids = cases.map((_, i) => `k${i}`), batches: number[][] = [];
  for (let i = 0; i < cases.length; i += 30) batches.push(ids.slice(i, i + 30).map((_, j) => i + j));
  for (let b = 0; b < batches.length; b += 4) await Promise.all(batches.slice(b, b + 4).map(async batch => {
    const items = await ask("blind_checker", CHECKER_INSTRUCTIONS, JSON.stringify(batch.map(i => ({ id: ids[i], evidence: cases[i].facts.map(f => f.observedFact) }))), 0);
    for (const v of items || []) if (typeof v?.id === "string") verdicts.set(v.id, v);
  }));

  const openings = new Set<string>(), kept: Case[] = [], dropped: Array<Case & { checker?: unknown }> = [];
  cases.forEach((c, i) => {
    const v = verdicts.get(ids[i]), opening = c.facts[0].observedFact.toLowerCase().match(/[a-z]+/g)?.slice(0, 5).join(" ") || "";
    if (v?.cause === c.label && v.clarity === "clear" && !openings.has(opening)) { openings.add(opening); kept.push(c); }
    else dropped.push({ ...c, checker: v || "no verdict" });
  });
  const perLabel = Object.fromEntries(RootCause.options.map(l => [l, `${kept.filter(c => c.label === l).length}/${cases.filter(c => c.label === l).length}`]));
  const dir = path.resolve("data", "mubit-cases"), stamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `cases-${stamp}.json`), JSON.stringify(kept.map(({ label, facts }) => ({ label, facts })), null, 1));
  fs.writeFileSync(path.join(dir, `report-${stamp}.json`), JSON.stringify({ model: "gemini-4-argon", included, written: cases.length - included, judged: verdicts.size, kept: kept.length, perLabel, calls, dropped }, null, 1));
  console.log(`checker judged ${verdicts.size}/${cases.length}; kept ${kept.length}`);
  for (const [label, count] of Object.entries(perLabel)) console.log(`  ${label.padEnd(20)} ${count}`);
  console.log(`Mubit calls: ${calls.length} (${calls.filter(c => c.ok).length} ok, ${calls.filter(c => c.note?.includes("retried")).length} retried) · data/mubit-cases/cases-${stamp}.json`);
}

main().catch(error => { console.error(error); process.exit(1); });
