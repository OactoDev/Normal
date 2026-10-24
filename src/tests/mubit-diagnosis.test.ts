import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { ModelCall } from "../contracts";
import { MubitDiagnosisError, mubitDiagnoser } from "../intelligence/mubit-diagnoser";
import { POST } from "../app/api/intelligence/diagnose/route";

async function run() {
  const saved = { key: process.env.MUBIT_API_KEY, base: process.env.MUBIT_BASE_URL, model: process.env.MUBIT_MODEL, fetch: globalThis.fetch };
  const now = new Date().toISOString();
  const investigation = { schemaVersion: 1 as const, investigationId: "inv_test", businessId: "nova_store", anomalyIds: [], evidenceIds: ["e_shipping"], status: "active" as const, createdAt: now, updatedAt: now };
  const evidence = [{ schemaVersion: 1 as const, evidenceId: "e_shipping", investigationId: "inv_test", businessId: "nova_store", observedFact: "14 orders breached the delivery promise.", measurements: { delayedOrdersCount: 14 }, sourceRecordIds: [], retrievedAt: now }];
  const output = { primaryCause: "delivery_delays", supportedHypotheses: [{ cause: "delivery_delays", confidence: .87, rationale: "An explanation returned by the provider.", evidenceIds: ["e_shipping"] }], missingEvidence: [] };
  const requestId = "mreq_0123456789abcdef0123456789abcdef";
  let providerCalls = 0;
  const provider = (content = JSON.stringify(output), options: { trace?: boolean; finish?: string } = {}) => Response.json({ model: "returned-model", choices: [{ message: { content }, finish_reason: options.finish || "stop" }], usage: { prompt_tokens: 31, completion_tokens: 59 } }, { headers: options.trace === false ? {} : { "x-middleware-request-id": requestId } });
  const mock = (response: () => Response) => {
    globalThis.fetch = async (url, init) => {
      if (String(url).startsWith("https://mubit.test/")) {
        providerCalls++;
        const body = JSON.parse(String(init.body));
        assert.equal(body.model, "configured-model");
        assert.equal(body.temperature, undefined, "reasoning models reject temperature 0.1");
        assert.equal(body.max_completion_tokens, 2048);
        assert.equal(body.metadata, undefined, "metadata requires provider-side storage to be enabled");
        assert.equal((init.headers as any).Authorization, "Bearer test-key");
        return response();
      }
      return Response.json({ status: "unsure", raw_label: "supported", probabilities: { supported: .8, violation: .1, insufficient_information: .08, inconsistent_context: .02 } });
    };
  };
  try {
    delete process.env.MUBIT_API_KEY;
    globalThis.fetch = async () => { throw new Error("must not call provider without a key"); };
    await assert.rejects(mubitDiagnoser.diagnose(investigation, evidence), (error: MubitDiagnosisError) => error.code === "MUBIT_NOT_CONFIGURED" && error.status === 503);
    const missing = await POST(new NextRequest("https://normal.test/api/intelligence/diagnose", { method: "POST", body: JSON.stringify({ investigation, evidence }) }));
    assert.equal(missing.status, 503);
    assert.equal((await missing.json()).error.code, "MUBIT_NOT_CONFIGURED");
    process.env.MUBIT_API_KEY = "test-key"; process.env.MUBIT_BASE_URL = "https://mubit.test/openai/v1/"; process.env.MUBIT_MODEL = "configured-model";
    mock(() => provider());
    const result = await mubitDiagnoser.diagnose(investigation, evidence);
    assert.deepEqual(result.diagnosis.output, output);
    assert.equal(result.modelCall.mubitRequestId, requestId);
    assert.equal(result.modelCall.providerModel, "returned-model");
    assert.equal(result.modelCall.inputTokens, 31); assert.equal(result.modelCall.outputTokens, 59);
    ModelCall.parse(result.modelCall);
    for (const [content, options] of [
      ["not JSON", {}],
      [JSON.stringify({ ...output, primaryCause: "invented-cause" }), {}],
      [JSON.stringify({ ...output, supportedHypotheses: [{ ...output.supportedHypotheses[0], evidenceIds: ["invented-evidence"] }] }), {}],
      [JSON.stringify(output), { finish: "length" }],
      [JSON.stringify(output), { trace: false }],
    ] as [string, any][]) {
      mock(() => provider(content, options));
      await assert.rejects(mubitDiagnoser.diagnose(investigation, evidence), (error: MubitDiagnosisError) => error.code === "MUBIT_INVALID_RESPONSE");
    }
    const originalError = console.error;
    try {
      console.error = () => {};
      mock(() => Response.json({ error: { message: "Rejected" } }, { status: 400, headers: { "x-middleware-request-id": requestId } }));
      const failed = await POST(new NextRequest("https://normal.test/api/intelligence/diagnose", { method: "POST", body: JSON.stringify({ investigation, evidence }) }));
      assert.equal(failed.status, 502);
      const failure = await failed.json();
      assert.equal(failure.error.requestId, requestId);
      assert.equal(failure.error.code, "MUBIT_REQUEST_FAILED");
      assert.equal(failure.diagnosis, undefined, "provider failure never produces a heuristic pass");
    } finally { console.error = originalError; }
    assert(providerCalls > 0);
  } finally {
    globalThis.fetch = saved.fetch;
    for (const [key, value] of Object.entries({ MUBIT_API_KEY: saved.key, MUBIT_BASE_URL: saved.base, MUBIT_MODEL: saved.model })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
  console.log("Mubit live request contract, real attribution, strict output validation and honest failure handling passed (HTTP mocked).");
}
run().catch(error => { console.error(error); process.exit(1); });
