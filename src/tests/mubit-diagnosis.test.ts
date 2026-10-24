import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { ModelCall } from "../contracts";
import { DIAGNOSIS_INSTRUCTIONS, MubitDiagnosisError, diagnosisTaskFingerprint, mubitDiagnoser } from "../intelligence/mubit-diagnoser";
import { POST } from "../app/api/intelligence/diagnose/route";
import * as feedbackRoute from "../app/api/intelligence/feedback/route";

async function run() {
  process.env.NORMAL_STORE ??= "memory";
  const saved = { key: process.env.MUBIT_API_KEY, base: process.env.MUBIT_BASE_URL, fetch: globalThis.fetch };
  const now = new Date().toISOString();
  const investigation = { schemaVersion: 1 as const, investigationId: "inv_test", businessId: "nova_store", anomalyIds: [], evidenceIds: ["e_shipping"], status: "active" as const, createdAt: now, updatedAt: now };
  const evidence = [{ schemaVersion: 1 as const, evidenceId: "e_shipping", investigationId: "inv_test", businessId: "nova_store", observedFact: "14 orders breached the delivery promise.", measurements: { delayedOrdersCount: 14 }, sourceRecordIds: [], retrievedAt: now }];
  const output = { primaryCause: "delivery_delays", supportedHypotheses: [{ cause: "delivery_delays", confidence: .87, rationale: "An explanation returned by the provider.", evidenceIds: ["e_shipping"] }], missingEvidence: [] };
  const requestId = "mreq_0123456789abcdef0123456789abcdef";
  let providerCalls = 0;
  let lastBody: any;
  const provider = (content = JSON.stringify(output), options: { trace?: boolean; finish?: string } = {}) => Response.json({ modelVersion: "returned-model", candidates: [{ content: { parts: [{ text: content }] }, finishReason: options.finish || "STOP" }], usageMetadata: { promptTokenCount: 31, candidatesTokenCount: 59 } }, { headers: options.trace === false ? {} : { "x-middleware-request-id": requestId } });
  const mock = (response: () => Response) => {
    globalThis.fetch = async (url, init) => {
      if (String(url).startsWith("https://mubit.test/")) {
        assert.equal(String(url), "https://mubit.test/gemini/v1beta/models/gemini-4-argon:generateContent");
        providerCalls++;
        const body = JSON.parse(String(init.body));
        lastBody = body;
        assert.equal(body.generationConfig.maxOutputTokens, 2048);
        assert.equal(body.generationConfig.responseMimeType, "application/json");
        assert.equal(body.generationConfig.temperature, 0);
        assert.equal((init.headers as any)["x-goog-api-key"], "test-key");
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
    process.env.MUBIT_API_KEY = "test-key"; process.env.MUBIT_BASE_URL = "https://mubit.test/openai/v1/"; // a legacy OpenAI-route URL still reaches the Gemini route
    mock(() => provider());
    const result = await mubitDiagnoser.diagnose(investigation, evidence);
    assert.deepEqual(result.diagnosis.output, output);
    assert.equal(result.modelCall.mubitRequestId, requestId);
    assert.equal(result.modelCall.providerModel, "returned-model");
    assert.equal(result.modelCall.inputTokens, 31); assert.equal(result.modelCall.outputTokens, 59);
    ModelCall.parse(result.modelCall);
    assert.equal(lastBody.systemInstruction.parts[0].text, DIAGNOSIS_INSTRUCTIONS);
    // The Gemini task that already holds the kept examples; temperature must not move calls to a new task.
    assert.equal(diagnosisTaskFingerprint(), "fp_36d6849aa9403aac");
    assert.equal(result.modelCall.instructionsFingerprint, "fp_36d6849aa9403aac");
    assert.deepEqual(JSON.parse(lastBody.contents[0].parts[0].text).merchantVerifiedCorrections, []);
    assert.deepEqual(result.modelCall.appliedCorrectionIds, []);

    // A correction is saved locally (no Mubit feedback endpoint exists) and rides along in the next call of the same task.
    const correctionUrl = "https://normal.test/api/intelligence/feedback";
    const correctionBody = { investigationId: "inv_test", diagnosisId: result.diagnosis.diagnosisId, modelCallId: result.modelCall.modelCallId, mubitRequestId: requestId, predictedCause: "delivery_delays", correctedCause: "negative_sentiment", correctedEvidenceIds: ["e_shipping"], evidence, note: "Reviews drove this one." };
    const callsBeforeCorrection = providerCalls;
    const badCorrection = await feedbackRoute.POST(new NextRequest(correctionUrl, { method: "POST", body: JSON.stringify({ ...correctionBody, correctedEvidenceIds: ["not-in-packet"] }) }));
    assert.equal(badCorrection.status, 400);
    assert.equal((await badCorrection.json()).error.code, "CORRECTION_EVIDENCE_REQUIRED");
    const saved = await feedbackRoute.POST(new NextRequest(correctionUrl, { method: "POST", body: JSON.stringify(correctionBody) }));
    assert.equal(saved.status, 200);
    const savedBody = await saved.json();
    assert.equal(savedBody.record.correction.ingestionStatus, "local_only");
    assert.equal(savedBody.record.correctedMubitRequestId, requestId);
    assert.equal(savedBody.mubitTask.fingerprint, result.modelCall.instructionsFingerprint);
    assert.deepEqual(savedBody.nextDiagnosisCorrectionIds, [savedBody.record.correction.correctionId]);
    assert.equal(providerCalls, callsBeforeCorrection, "saving a correction never calls Mubit");
    const corrected = await POST(new NextRequest("https://normal.test/api/intelligence/diagnose", { method: "POST", body: JSON.stringify({ investigation, evidence }) }));
    assert.equal(corrected.status, 200);
    assert.deepEqual((await corrected.json()).modelCall.appliedCorrectionIds, [savedBody.record.correction.correctionId]);
    assert.equal(lastBody.systemInstruction.parts[0].text, DIAGNOSIS_INSTRUCTIONS, "same system prompt keeps corrected calls in one Mubit task");
    const sent = JSON.parse(lastBody.contents[0].parts[0].text).merchantVerifiedCorrections;
    assert.deepEqual(sent, [{ observedEvidence: [{ observedFact: evidence[0].observedFact, measurements: evidence[0].measurements }], modelDiagnosed: "delivery_delays", merchantVerifiedCause: "negative_sentiment", merchantNote: "Reviews drove this one." }]);
    const cleared = await (await feedbackRoute.DELETE()).json();
    assert.deepEqual(cleared.corrections, []);
    for (const [content, options] of [
      ["not JSON", {}],
      [JSON.stringify({ ...output, primaryCause: "invented-cause" }), {}],
      [JSON.stringify({ ...output, supportedHypotheses: [{ ...output.supportedHypotheses[0], evidenceIds: ["invented-evidence"] }] }), {}],
      [JSON.stringify(output), { finish: "MAX_TOKENS" }],
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
    for (const [key, value] of Object.entries({ MUBIT_API_KEY: saved.key, MUBIT_BASE_URL: saved.base })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
  console.log("Mubit live request contract, real attribution, strict output validation and honest failure handling passed (HTTP mocked).");
}
run().catch(error => { console.error(error); process.exit(1); });
