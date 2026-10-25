import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { COLLECTIONS } from "@/lib/collections";
import { getDb } from "@/lib/mongodb";
import { mubitRequest, MUBIT_BASE_URL, MUBIT_MODEL } from "@/intelligence/investigator/mubit";
import { diagnoseInvestigation, latestDiagnosis, parseDiagnosis, TASK_KEY } from "@/intelligence/investigator/diagnose";

const BUSINESS = "nike_test";
const RUN = "investigator_test_run";
const INV = "inv_investigator_test";
const NOW = "2026-10-24T12:00:00.000Z";
const REQ_ID = "mreq_0123456789abcdef0123456789abcdef";
const scope = { businessId: BUSINESS, simulationRunId: RUN };

const answer = (overrides: Record<string, unknown> = {}) => ({
  primaryCause: "delivery_delays",
  hypotheses: [
    { cause: "delivery_delays", strength: "strong", evidenceIds: ["ev_ship"], counterEvidenceIds: [], explanation: "Late deliveries tripled in the incident window." },
    { cause: "ad_fatigue", strength: "weak", evidenceIds: ["ev_ads"], counterEvidenceIds: ["ev_ship"], explanation: "Click-through dipped slightly but spend was flat." },
  ],
  summary: "Orders are arriving late; that explains the drop better than ads.", missingEvidence: [], requiresReview: false, ...overrides,
});

const gemini = (body: unknown) => ({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(body) }] } }], usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 200, thoughtsTokenCount: 300 }, modelVersion: MUBIT_MODEL });

/** A fetch stand-in that records each call and answers like Mubit's Gemini route. */
function mockFetch(respond: () => Response) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const impl = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return respond(); }) as unknown as typeof fetch;
  return { impl, calls };
}
const ok = (body: unknown, requestId: string | null = REQ_ID) => new Response(JSON.stringify(gemini(body)), { status: 200, headers: { "content-type": "application/json", ...(requestId ? { "x-middleware-request-id": requestId } : {}) } });

describe("Mubit request shape", () => {
  it("goes to Mubit's Gemini route with the Mubit key, JSON output and temperature 0", () => {
    const r = mubitRequest({ system: "sys", user: "{}", maxTokens: 100 }, "mbt_test");
    expect(MUBIT_BASE_URL).toBe("https://api.mubit.ai/gemini/v1beta");
    expect(r.url).toBe(`https://api.mubit.ai/gemini/v1beta/models/${MUBIT_MODEL}:generateContent`);
    expect(r.headers["x-goog-api-key"]).toBe("mbt_test");
    expect(r.body.generationConfig).toEqual({ maxOutputTokens: 100, responseMimeType: "application/json", temperature: 0 });
  });
});

describe("diagnosis validation", () => {
  const allowed = new Set(["ev_ship", "ev_ads"]);
  it("accepts an evidence-grounded answer", () => {
    expect(parseDiagnosis(JSON.stringify(answer()), allowed).primaryCause).toBe("delivery_delays");
  });
  it("rejects evidence IDs that were not in the packet", () => {
    expect(() => parseDiagnosis(JSON.stringify(answer({ hypotheses: [{ cause: "delivery_delays", strength: "strong", evidenceIds: ["ev_made_up"], counterEvidenceIds: [], explanation: "x" }] })), allowed)).toThrow(/not provided/);
  });
  it("rejects a primary cause without supporting evidence", () => {
    expect(() => parseDiagnosis(JSON.stringify(answer({ primaryCause: "stockout" })), allowed)).toThrow(/no supporting evidence/);
  });
  it("rejects non-JSON and off-contract answers", () => {
    expect(() => parseDiagnosis("not json", allowed)).toThrow(/not a valid diagnosis/);
    expect(() => parseDiagnosis(JSON.stringify({ ...answer(), primaryCause: "aliens" }), allowed)).toThrow(/not a valid diagnosis/);
  });
});

describe("investigator against MongoDB", () => {
  const key = process.env.MUBIT_API_KEY;
  beforeEach(async () => {
    process.env.MUBIT_API_KEY = "mbt_test_key";
    const db = await getDb();
    await clean();
    await db.collection(COLLECTIONS.investigations).insertOne({ schemaVersion: 1, businessId: BUSINESS, simulationRunId: RUN, investigationId: INV, anomalyIds: ["anom_1"], status: "collecting_evidence", title: "Revenue down while late deliveries rise", evidenceIds: ["ev_ship", "ev_ads"], startedAt: NOW, updatedAt: NOW });
    const ev = (evidenceId: string, category: string, title: string, observation: string) => ({ schemaVersion: 1, businessId: BUSINESS, simulationRunId: RUN, evidenceId, investigationId: INV, category, title, observation,
      measurements: [{ metric: "count", value: 14, unit: "orders", baseline: 3 }], sourceRecords: [{ collection: "business_events", recordId: `evt_${evidenceId}` }], retrievedAt: NOW });
    await db.collection(COLLECTIONS.evidence).insertMany([ev("ev_ship", "fulfillment", "Late deliveries", "14 orders late vs 3 at baseline"), ev("ev_ads", "advertising", "Ad click-through", "Click-through down 4%")]);
  });
  afterEach(clean);
  afterAll(() => { if (key === undefined) delete process.env.MUBIT_API_KEY; else process.env.MUBIT_API_KEY = key; });

  async function clean() {
    const db = await getDb();
    await Promise.all([COLLECTIONS.investigations, COLLECTIONS.evidence, COLLECTIONS.diagnoses, COLLECTIONS.modelCalls].map((c) => db.collection(c).deleteMany({ businessId: BUSINESS, simulationRunId: RUN })));
  }
  async function saved() {
    const db = await getDb();
    const [diagnoses, calls, inv] = await Promise.all([db.collection(COLLECTIONS.diagnoses).countDocuments(scope), db.collection(COLLECTIONS.modelCalls).countDocuments(scope), db.collection(COLLECTIONS.investigations).findOne({ ...scope, investigationId: INV })]);
    return { diagnoses, calls, status: inv?.status };
  }

  it("sends the investigation's evidence to Mubit, saves a Diagnosis and ModelCall, and moves the investigation to review", async () => {
    const f = mockFetch(() => ok(answer()));
    const { diagnosis, modelCall } = await diagnoseInvestigation(INV, scope, { fetchImpl: f.impl });
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]!.url).toContain("https://api.mubit.ai/gemini/v1beta/models/gemini-4-argon:generateContent");
    const sent = JSON.parse(JSON.parse(String(f.calls[0]!.init.body)).contents[0].parts[0].text);
    expect(sent.evidence.map((e: { evidenceId: string }) => e.evidenceId).sort()).toEqual(["ev_ads", "ev_ship"]);
    expect(diagnosis.taskKey).toBe(TASK_KEY);
    expect(diagnosis.modelCallId).toBe(modelCall.modelCallId);
    expect(modelCall).toMatchObject({ route: "mubit", mubitRequestId: REQ_ID, providerModel: MUBIT_MODEL, modelKind: "provider", inputTokens: 900, outputTokens: 500 });
    expect(await saved()).toEqual({ diagnoses: 1, calls: 1, status: "awaiting_review" });
    const latest = await latestDiagnosis(INV, scope);
    expect(latest.diagnosis?.diagnosisId).toBe(diagnosis.diagnosisId);
    expect(latest.modelCall?.mubitRequestId).toBe(REQ_ID);
  });

  const failures: Array<[string, () => Response, number, string]> = [
    ["Mubit HTTP error", () => new Response("{}", { status: 500, headers: { "x-middleware-request-id": REQ_ID } }), 502, "mubit_request_failed"],
    ["no Mubit request ID", () => ok(answer(), null), 502, "mubit_invalid_response"],
    ["cut-off answer", () => new Response(JSON.stringify({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "{" }] } }] }), { status: 200, headers: { "x-middleware-request-id": REQ_ID } }), 502, "mubit_invalid_response"],
    ["made-up evidence ID", () => ok(answer({ hypotheses: [{ cause: "delivery_delays", strength: "strong", evidenceIds: ["ev_other"], counterEvidenceIds: [], explanation: "x" }] })), 502, "diagnosis_invalid"],
  ];
  for (const [name, respond, status, code] of failures) {
    it(`saves nothing when ${name}`, async () => {
      await expect(diagnoseInvestigation(INV, scope, { fetchImpl: mockFetch(respond).impl })).rejects.toMatchObject({ status, code });
      expect(await saved()).toEqual({ diagnoses: 0, calls: 0, status: "collecting_evidence" });
    });
  }

  it("saves nothing when Mubit cannot be reached", async () => {
    const impl = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    await expect(diagnoseInvestigation(INV, scope, { fetchImpl: impl })).rejects.toMatchObject({ status: 503, code: "mubit_unavailable" });
    expect(await saved()).toEqual({ diagnoses: 0, calls: 0, status: "collecting_evidence" });
  });

  it("refuses to run without a Mubit key or before evidence exists, without calling Mubit", async () => {
    const f = mockFetch(() => ok(answer()));
    delete process.env.MUBIT_API_KEY;
    await expect(diagnoseInvestigation(INV, scope, { fetchImpl: f.impl })).rejects.toMatchObject({ status: 503, code: "mubit_not_configured" });
    process.env.MUBIT_API_KEY = "mbt_test_key";
    await (await getDb()).collection(COLLECTIONS.evidence).deleteMany(scope);
    await expect(diagnoseInvestigation(INV, scope, { fetchImpl: f.impl })).rejects.toMatchObject({ status: 409, code: "evidence_required" });
    expect(f.calls).toHaveLength(0);
    expect(await saved()).toEqual({ diagnoses: 0, calls: 0, status: "collecting_evidence" });
  });

  it("404s an unknown investigation", async () => {
    await expect(diagnoseInvestigation("inv_missing", scope, { fetchImpl: mockFetch(() => ok(answer())).impl })).rejects.toMatchObject({ status: 404 });
  });
});
