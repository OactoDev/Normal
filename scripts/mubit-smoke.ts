/**
 * Checks that Mubit's Gemini route answers, without leaving training data behind:
 * the call is sent with x-middleware-record: off, so Mubit keeps no content and no task fingerprint for it.
 *
 *   npx tsx --env-file=.env scripts/mubit-smoke.ts
 */
import { mubitModel, mubitRequest, readMubitReply } from "../src/llm/mubit";

async function main() {
  if (!process.env.MUBIT_API_KEY) throw new Error("MUBIT_API_KEY is not set. Run with --env-file=.env");
  const request = mubitRequest({ system: "Health check. Reply with the JSON {\"ok\":true} and nothing else.", user: "ping", maxTokens: 256, json: true, temperature: 0, record: "off" });
  const started = Date.now();
  const response = await fetch(request.url, { method: "POST", headers: request.headers, body: JSON.stringify(request.body), signal: AbortSignal.timeout(30000) });
  const requestId = response.headers.get("x-middleware-request-id");
  const reply = response.ok ? readMubitReply(await response.json()) : undefined;
  console.log(JSON.stringify({ ok: response.ok && /"ok"\s*:\s*true/.test(reply?.content || ""), status: response.status, requestId, model: reply?.model || mubitModel(), recording: request.headers["x-middleware-record"], latencyMs: Date.now() - started }));
  if (!response.ok) process.exitCode = 1;
}

main().catch(error => { console.error(error); process.exit(1); });
