import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { callModel, promptFingerprint, gatewayRequest, jsonSchema, providerConfig, ProviderError } from "@/intelligence/investigator/provider";
const schema = z.object({ ok: z.boolean() }).strict();
const response = (content: unknown = { ok: true }, headers: Record<string, string> = { "x-middleware-request-id": "mreq_real" }) => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(content) } }], usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 } }), { status: 200, headers });
beforeEach(() => { vi.stubEnv("MUBIT_API_KEY", "mbt_test"); vi.stubEnv("GEMINI_API_KEY", "google_test"); vi.stubEnv("NORMAL_DIRECT_GEMINI_FALLBACK", "false"); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("provider boundaries", () => {
  it("keeps recurring task fingerprints stable across sessions and evidence without unsupported metadata", async () => {
    const first = { model: "test", system: "stable", input: { incident: "one" }, sessionId: "job_one", schema };
    const second = { ...first, input: { incident: "two" }, sessionId: "job_two" };
    expect(promptFingerprint(first, "diagnosis", "1")).toBe(promptFingerprint(second, "diagnosis", "1"));
    expect(promptFingerprint(first, "diagnosis", "1")).not.toBe(promptFingerprint({ ...second, system: "changed" }, "diagnosis", "1"));
    const mock = vi.fn().mockImplementation(async () => response()); vi.stubGlobal("fetch", mock);
    await callModel(first); await callModel(second);
    const bodies = mock.mock.calls.map((c) => JSON.parse(c[1].body));
    expect(bodies[0].messages[0]).toEqual(bodies[1].messages[0]);
    expect(bodies.every((b) => !("metadata" in b))).toBe(true);
    expect(bodies[0].messages[1]).not.toEqual(bodies[1].messages[1]);
  });
  it("requires Mubit credentials and rejects unsafe base URLs", () => { vi.stubEnv("MUBIT_API_KEY", ""); expect(providerConfig).toThrow("missing_mubit_key"); vi.stubEnv("MUBIT_API_KEY", "mbt_test"); vi.stubEnv("MUBIT_BASE_URL", "http://localhost/key"); expect(providerConfig).toThrow("invalid_base_url"); });
  it("sends only Mubit credentials and preserves actual usage and request id", async () => {
    const mock = vi.fn().mockResolvedValue(response()); vi.stubGlobal("fetch", mock);
    const result = await callModel({ model: "test", system: "stable", input: "data", schema });
    expect(result.value).toEqual({ ok: true }); expect(result.metadata.requestId).toBe("mreq_real"); expect(result.metadata.totalTokens).toBe(14);
    const init = mock.mock.calls[0][1]; expect(init.headers.authorization).toBe("Bearer mbt_test"); expect(JSON.stringify(init)).not.toContain("google_test");
    expect(JSON.parse(init.body).response_format.json_schema.strict).toBe(true);
  });
  it("refuses successful-looking responses without a gateway id", async () => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ ok: true }, {}))); await expect(callModel({ model: "test", system: "s", input: {}, schema })).rejects.toMatchObject({ code: "missing_gateway_request_id" }); });
  it.each([{ nope: true }, { ok: "yes" }, { ok: true, fabricated: 2 }])("rejects invalid structured output %j", async (body) => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(body))); await expect(callModel({ model: "test", system: "s", input: {}, schema })).rejects.toMatchObject({ code: "invalid_structured_output", metadata: { requestId: "mreq_real" } }); });
  it("classifies rate limiting without an automatic chargeable retry", async () => { const mock = vi.fn().mockResolvedValue(new Response("{}", { status: 429, headers: { "retry-after": "2", "x-middleware-request-id": "mreq_limit" } })); vi.stubGlobal("fetch", mock); await expect(callModel({ model: "x", system: "s", input: {} })).rejects.toMatchObject({ retryable: true, ambiguous: false, retryAfterMs: 2000 }); expect(mock).toHaveBeenCalledTimes(1); });
  it("honours gateway no-retry errors", async () => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 503, headers: { "x-should-retry": "false" } }))); await expect(callModel({ model: "x", system: "s", input: {} })).rejects.toMatchObject({ retryable: false, ambiguous: true }); });
  it("records a retryable Mubit 503 without automatically repeating an ambiguous chargeable request", async () => {
    const mock = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 503, headers: { "x-should-retry": "true", "retry-after": "3", "x-middleware-request-id": "mreq_outage" } })).mockResolvedValueOnce(response());
    vi.stubGlobal("fetch", mock);
    await expect(callModel({ model: "x", system: "s", input: {}, schema })).rejects.toMatchObject({
      code: "http_503", retryable: true, ambiguous: true, retryAfterMs: 3000, metadata: { requestId: "mreq_outage", provider: "mubit" },
    });
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it("accounts for an ambiguous timeout without retrying", async () => { const mock = vi.fn().mockRejectedValue(new DOMException("timeout", "TimeoutError")); vi.stubGlobal("fetch", mock); await expect(callModel({ model: "x", system: "s", input: {} })).rejects.toMatchObject({ ambiguous: true, retryable: false }); expect(mock).toHaveBeenCalledTimes(1); });
  it("validates function names and parses structured arguments", async () => {
    const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ finish_reason: "tool_calls", message: { tool_calls: [{ id: "call_actual", function: { name: "read", arguments: '{"ok":true}' } }] } }] }), { headers: { "x-middleware-request-id": "mreq_tool" } })); vi.stubGlobal("fetch", mock);
    const result = await callModel({ model: "x", system: "s", input: {}, tools: [{ name: "read", description: "read", parameters: jsonSchema(schema) }] });
    expect(schema.parse(result.toolCalls[0].arguments)).toEqual({ ok: true }); expect(JSON.parse(mock.mock.calls[0][1].body).reasoning_effort).toBe("none");
  });
  it("does not enable direct research implicitly", async () => { await expect(gatewayRequest("https://generativelanguage.googleapis.com/v1beta/models/test:generateContent", {}, "google_direct", "test")).rejects.toBeInstanceOf(ProviderError); });
  it("attributes explicitly enabled direct research correctly and sends only its key", async () => { vi.stubEnv("NORMAL_DIRECT_GEMINI_FALLBACK", "true"); const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3, thoughtsTokenCount: 2, totalTokenCount: 10 } }))); vi.stubGlobal("fetch", mock); const r = await gatewayRequest("https://generativelanguage.googleapis.com/v1beta/models/test:generateContent", {}, "google_direct", "test"); expect(r.metadata).toMatchObject({ provider: "google_direct", requestId: null, totalTokens: 10, outputTokens: 5 }); expect(mock.mock.calls[0][1].headers).toEqual({ "content-type": "application/json", "x-goog-api-key": "google_test" }); });
});
