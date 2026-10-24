import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { MubitDiagnosisError, mubitDiagnoser } from "../intelligence/mubit-diagnoser";
import { POST } from "../app/api/intelligence/diagnose/route";
import { GET as usage } from "../app/api/intelligence/mubit-usage/route";

async function run() {
  process.env.NORMAL_STORE ??= "memory";
  const saved = { key: process.env.MUBIT_API_KEY, base: process.env.MUBIT_BASE_URL, fetch: globalThis.fetch };
  const now = new Date().toISOString();
  const investigation = { schemaVersion: 1 as const, investigationId: "inv_stream", businessId: "nova_store", anomalyIds: [], evidenceIds: ["e_ship"], status: "active" as const, createdAt: now, updatedAt: now };
  const evidence = [{ schemaVersion: 1 as const, evidenceId: "e_ship", investigationId: "inv_stream", businessId: "nova_store", observedFact: "14 orders breached the delivery promise.", measurements: { delayedOrdersCount: 14 }, sourceRecordIds: [], retrievedAt: now }];
  const answer = JSON.stringify({ primaryCause: "delivery_delays", supportedHypotheses: [{ cause: "delivery_delays", confidence: .9, rationale: "Carrier backlog.", evidenceIds: ["e_ship"] }], missingEvidence: [] });
  const requestId = "mreq_0123456789abcdef0123456789abcdef";
  // Gemini's SSE: three chunks, the last with finishReason and usage. Cut the byte stream mid-event on purpose.
  const sse = (text: string, finish = "STOP") => {
    const pieces = [text.slice(0, 20), text.slice(20, 60), text.slice(60)];
    const events = pieces.map((piece, i) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: piece }] }, ...(i === 2 ? { finishReason: finish } : {}) }], ...(i === 2 ? { usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 40 }, modelVersion: "gemini-4-argon" } : {}) })}\r\n\r\n`).join("");
    const bytes = new TextEncoder().encode(events), cut = Math.floor(bytes.length / 3);
    return new ReadableStream({ start(c) { c.enqueue(bytes.slice(0, cut)); c.enqueue(bytes.slice(cut, cut + 7)); c.enqueue(bytes.slice(cut + 7)); c.close(); } });
  };
  let urls: string[] = [], body = sse(answer);
  let checks = 0;
  try {
    process.env.MUBIT_API_KEY = "test-key"; process.env.MUBIT_BASE_URL = "https://mubit.test/gemini/v1beta";
    globalThis.fetch = async (url, init) => {
      if (!String(url).startsWith("https://mubit.test/")) return Response.json({ status: "unsure", raw_label: "supported", probabilities: { supported: .8, violation: .1, insufficient_information: .08, inconsistent_context: .02 } });
      urls.push(String(url));
      return new Response(body, { headers: { "content-type": "text/event-stream", "x-middleware-request-id": requestId } });
    };
    const deltas: string[] = [];
    const result = await mubitDiagnoser.diagnose(investigation, evidence, [], text => deltas.push(text));
    assert.equal(urls[0], "https://mubit.test/gemini/v1beta/models/gemini-4-argon:streamGenerateContent?alt=sse"); checks++;
    assert.equal(deltas.length, 3); assert.equal(deltas.join(""), answer); checks++;
    assert.equal(result.diagnosis.output.primaryCause, "delivery_delays"); checks++;
    assert.equal(result.modelCall.mubitRequestId, requestId); checks++;
    assert.equal(result.modelCall.inputTokens, 30); assert.equal(result.modelCall.outputTokens, 40); checks++;

    body = sse(answer.replace("delivery_delays", "invented_cause"));
    await assert.rejects(mubitDiagnoser.diagnose(investigation, evidence, [], () => {}), (error: MubitDiagnosisError) => error.code === "MUBIT_INVALID_RESPONSE" && error.requestId === requestId); checks++;
    body = sse(answer, "MAX_TOKENS");
    await assert.rejects(mubitDiagnoser.diagnose(investigation, evidence, [], () => {}), (error: MubitDiagnosisError) => error.code === "MUBIT_INVALID_RESPONSE"); checks++;

    // The route's own stream: delta events, then one result event.
    body = sse(answer);
    const res = await POST(new NextRequest("https://normal.test/api/intelligence/diagnose?stream=1", { method: "POST", body: JSON.stringify({ investigation, evidence }) }));
    assert.match(res.headers.get("content-type") || "", /text\/event-stream/); checks++;
    const text = await res.text(), events = [...text.matchAll(/^event: (\w+)$/gm)].map(m => m[1]);
    assert.deepEqual(events, ["started", "delta", "delta", "delta", "result"]); checks++;
    body = sse("not json at all, not json at all, not json at all, not json");
    const bad = await (await POST(new NextRequest("https://normal.test/api/intelligence/diagnose?stream=1", { method: "POST", body: JSON.stringify({ investigation, evidence }) }))).text();
    assert.match(bad, /event: error\ndata: .*MUBIT_INVALID_RESPONSE/); assert.doesNotMatch(bad, /event: result/); checks++;

    const counted = await (await usage()).json();
    assert.ok(counted.tasks.find((t: any) => t.taskKey === "normal_incident_diagnosis").calls >= 2, "accepted streamed calls are recorded for the usage card"); checks++;
    console.log(`✓ ${checks} streaming checks passed: streamGenerateContent route, SSE split across chunks, request ID and tokens kept, same validation (bad cause and cut-off answers refused), route emits started, deltas, then result or error, calls recorded. Mubit mocked.`);
  } finally {
    globalThis.fetch = saved.fetch;
    for (const [key, value] of Object.entries({ MUBIT_API_KEY: saved.key, MUBIT_BASE_URL: saved.base })) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
