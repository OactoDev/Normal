/**
 * Sends varied delivery-delay email drafts through Mubit in exactly the shape draftParagraph uses
 * (same instructions, model, temperature and user JSON), so they land in the app's email task
 * ("Write only short empathetic 4", fp_edc5f592db1db06c) and give it examples to train on.
 * Order data is synthetic; no customer names or emails are sent.
 *
 *   npx tsx --env-file=.env scripts/mubit-email-replay.ts --count 40 [--seed 5] [--concurrency 3] [--dry-run]
 *
 * Writes data/mubit-replay/email-<timestamp>.json.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { EMAIL_DRAFT_INSTRUCTIONS, fetchMubit, mubitRequest, readMubitReply } from "../src/llm/mubit";

const arg = (name: string, fallback: number) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? Number(process.argv[i + 1]) : fallback; };
const count = arg("count", 40), concurrency = arg("concurrency", 3), dryRun = process.argv.includes("--dry-run");
let seed = arg("seed", 5);
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)];

const CARRIERS = ["Royal Mail", "DPD", "Evri", "DHL Express", "UPS", "Parcelforce", "Yodel", "InPost"];
const ITEMS = ["Nike Air Max 90", "Nike Pegasus 41 Running Shoes", "Nike Dri-FIT Running Top", "Nike Tech Fleece Hoodie", "Nike Club Joggers",
  "Nike Brasilia Backpack", "Nike Everyday Cushioned Socks (3 pairs)", "Nike Air Force 1 '07", "Nike Pro Leggings", "Nike Windrunner Jacket",
  "Jordan 1 Mid", "Nike Revolution 7", "Nike Heritage Cap", "Nike Strike Football", "Nike Metcon 9"];

const cases = Array.from({ length: count }, (_, i) => {
  const items = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => pick(ITEMS)).filter((item, j, all) => all.indexOf(item) === j);
  return { orderId: `ord_${String(1000 + i * 7 + Math.floor(rand() * 7)).padStart(4, "0")}`, carrier: pick(CARRIERS), items };
});

async function send(context: typeof cases[number]) {
  const request = mubitRequest({ maxTokens: 1000, temperature: 0, system: EMAIL_DRAFT_INSTRUCTIONS, user: JSON.stringify(context) });
  const started = Date.now();
  try {
    const response = await fetchMubit(request.url, { method: "POST", signal: AbortSignal.timeout(30000), headers: request.headers, body: JSON.stringify(request.body) });
    const requestId = response.headers.get("x-middleware-request-id") || undefined;
    if (!response.ok) return { context, ok: false, status: response.status, requestId, latencyMs: Date.now() - started };
    const reply = readMubitReply(await response.json());
    const text = (reply.content || "").trim();
    return { context, ok: !!text && text.length <= 600, status: response.status, requestId, model: reply.model, length: text.length, paragraph: text, latencyMs: Date.now() - started };
  } catch (error) {
    return { context, ok: false, error: String(error), latencyMs: Date.now() - started };
  }
}

async function main() {
  if (dryRun) { console.log(JSON.stringify(cases.slice(0, 5), null, 2), `\n${cases.length} cases`); return; }
  if (!process.env.MUBIT_API_KEY) throw new Error("MUBIT_API_KEY is not set. Run with --env-file=.env");
  const results: Awaited<ReturnType<typeof send>>[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < cases.length) {
      const result = await send(cases[next++]);
      results.push(result);
      console.log(`${results.length}/${cases.length} ${result.ok ? "ok" : "FAILED"} ${result.status ?? ""} ${result.requestId ?? ""}`);
    }
  }));
  mkdirSync("data/mubit-replay", { recursive: true });
  const file = `data/mubit-replay/email-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(file, JSON.stringify({ instructions: EMAIL_DRAFT_INSTRUCTIONS, results }, null, 2));
  console.log(JSON.stringify({ sent: results.length, ok: results.filter(r => r.ok).length, log: file }));
}

main().catch(error => { console.error(error); process.exit(1); });
