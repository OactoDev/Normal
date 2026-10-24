import assert from "node:assert/strict";
import { EMAIL_DRAFT_INSTRUCTIONS, draftParagraph, mubitRequest } from "../llm/mubit";
import { shippingDelayTemplate } from "../tools/email-templates";

async function main() {
  const originalFetch = globalThis.fetch;
  const saved = { key: process.env.MUBIT_API_KEY, base: process.env.MUBIT_BASE_URL };
  const context = { customerName: "Test Customer", orderId: "sim_order", carrier: "Test Carrier", items: ["Nike Running Shoes"] };
  const fallback = { paragraph: shippingDelayTemplate.paragraph, modelUsed: "deterministic_template_v1" };
  let checks = 0;
  try {
    delete process.env.MUBIT_API_KEY;
    globalThis.fetch = async () => { throw new Error("Missing key must not call a provider"); };
    assert.deepEqual(await draftParagraph(context), fallback); checks++;
    process.env.MUBIT_API_KEY = "test-placeholder";
    process.env.MUBIT_BASE_URL = "https://mubit.test/gemini/v1beta";
    globalThis.fetch = async (url, init) => {
      assert.equal(String(url), "https://mubit.test/gemini/v1beta/models/gemini-4-argon:generateContent");
      const body = JSON.parse(String(init.body));
      assert.equal(body.generationConfig.maxOutputTokens, 1000);
      const sent = body.contents[0].parts[0].text;
      // The customer's name stays out of Mubit; the email template adds the greeting afterwards.
      assert.deepEqual(JSON.parse(sent), { orderId: context.orderId, carrier: context.carrier, items: context.items });
      assert.ok(!sent.includes(context.customerName) && !String(init.body).includes(context.customerName));
      assert.equal(body.systemInstruction.parts[0].text, EMAIL_DRAFT_INSTRUCTIONS);
      assert.equal(body.generationConfig.temperature, 0);
      assert.equal((init.headers as Record<string, string>)["x-middleware-record"], undefined, "real drafts are fully recorded so they can train");
      return Response.json({ candidates: [{ content: { parts: [{ text: " Thank you for your patience while we check your delivery. " }] }, finishReason: "STOP" }] });
    };
    assert.deepEqual(await draftParagraph(context), { paragraph: "Thank you for your patience while we check your delivery.", modelUsed: "gemini-4-argon" }); checks++;
    for (const status of [401, 429, 500]) {
      globalThis.fetch = async () => new Response("provider unavailable", { status });
      assert.deepEqual(await draftParagraph(context), fallback); checks++;
    }
    for (const content of ["", " ", "x".repeat(601), null, 42]) {
      globalThis.fetch = async () => Response.json({ candidates: [{ content: { parts: [{ text: content }] } }] });
      assert.deepEqual(await draftParagraph(context), fallback); checks++;
    }
    for (const record of ["full", "metadata", "off"] as const) {
      const request = mubitRequest({ system: "s", user: "u", maxTokens: 8, record });
      assert.equal(request.headers["x-middleware-record"], record); checks++;
    }
    assert.equal(mubitRequest({ system: "s", user: "u", maxTokens: 8 }).headers["x-middleware-record"], undefined); checks++;
    globalThis.fetch = async () => { throw new Error("network timeout"); };
    assert.deepEqual(await draftParagraph(context), fallback); checks++;
    globalThis.fetch = async () => new Response("not JSON");
    assert.deepEqual(await draftParagraph(context), fallback); checks++;
    console.log(`✓ ${checks} Mubit email checks passed: gateway routing, no customer name sent to Mubit, recording header, length guard and honest template fallback. Network responses mocked; no messages sent.`);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key,value] of Object.entries({ MUBIT_API_KEY:saved.key,MUBIT_BASE_URL:saved.base })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
