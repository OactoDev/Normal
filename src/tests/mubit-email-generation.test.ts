import assert from "node:assert/strict";
import { draftParagraph } from "../llm/mubit";
import { shippingDelayTemplate } from "../tools/email-templates";

async function main() {
  const originalFetch = globalThis.fetch;
  const saved = { key: process.env.MUBIT_API_KEY, base: process.env.MUBIT_BASE_URL, model: process.env.MUBIT_MODEL };
  const context = { customerName: "Test Customer", orderId: "sim_order", carrier: "Test Carrier", items: ["Nike Running Shoes"] };
  const fallback = { paragraph: shippingDelayTemplate.paragraph, modelUsed: "deterministic_template_v1" };
  let checks = 0;
  try {
    delete process.env.MUBIT_API_KEY;
    globalThis.fetch = async () => { throw new Error("Missing key must not call a provider"); };
    assert.deepEqual(await draftParagraph(context), fallback); checks++;
    process.env.MUBIT_API_KEY = "test-placeholder";
    process.env.MUBIT_BASE_URL = "https://mubit.test/openai/v1";
    process.env.MUBIT_MODEL = "test-routed-model";
    globalThis.fetch = async (url, init) => {
      assert.equal(String(url), "https://mubit.test/openai/v1/chat/completions");
      const body = JSON.parse(String(init.body));
      assert.equal(body.model, "test-routed-model");
      assert.equal(body.max_completion_tokens, 1000);
      assert.deepEqual(JSON.parse(body.messages[1].content), context);
      return Response.json({ choices: [{ message: { content: " Thank you for your patience while we check your delivery. " } }] });
    };
    assert.deepEqual(await draftParagraph(context), { paragraph: "Thank you for your patience while we check your delivery.", modelUsed: "test-routed-model" }); checks++;
    for (const status of [401, 429, 500]) {
      globalThis.fetch = async () => new Response("provider unavailable", { status });
      assert.deepEqual(await draftParagraph(context), fallback); checks++;
    }
    for (const content of ["", " ", "x".repeat(601), null, 42]) {
      globalThis.fetch = async () => Response.json({ choices: [{ message: { content } }] });
      assert.deepEqual(await draftParagraph(context), fallback); checks++;
    }
    globalThis.fetch = async () => { throw new Error("network timeout"); };
    assert.deepEqual(await draftParagraph(context), fallback); checks++;
    globalThis.fetch = async () => new Response("not JSON");
    assert.deepEqual(await draftParagraph(context), fallback); checks++;
    console.log(`✓ ${checks} Mubit email checks passed: gateway routing, valid personalisation, length guard and honest template fallback. Network responses mocked; no messages sent.`);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key,value] of Object.entries({ MUBIT_API_KEY:saved.key,MUBIT_BASE_URL:saved.base,MUBIT_MODEL:saved.model })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
