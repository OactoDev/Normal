import assert from "node:assert/strict";
import { DiagnosisT, EvidenceT } from "../contracts";
import { MubitPlanningError, PLANNER_INSTRUCTIONS, checkProposal, mubitPlanner, plannerPacket, plannerTaskFingerprint } from "../intelligence/mubit-planner";

async function run() {
  process.env.NORMAL_STORE ??= "memory";
  const saved = { key: process.env.MUBIT_API_KEY, base: process.env.MUBIT_BASE_URL, fetch: globalThis.fetch };
  const now = new Date().toISOString();
  const evidence: EvidenceT[] = [{ schemaVersion: 1, evidenceId: "e_ship", investigationId: "inv_plan", businessId: "nova_store", observedFact: "14 Royal Mail orders breached the delivery promise.", measurements: { delayedOrdersCount: 14 }, sourceRecordIds: [], retrievedAt: now }];
  const diagnosis: DiagnosisT = { schemaVersion: 1, diagnosisId: "diag_plan", investigationId: "inv_plan", modelCallId: "call_plan", output: { primaryCause: "delivery_delays", supportedHypotheses: [{ cause: "delivery_delays", confidence: .9, rationale: "Carrier backlog.", evidenceIds: ["e_ship"] }], missingEvidence: [] }, serverAttribution: { verifiedByRules: true }, createdAt: now } as DiagnosisT;
  const budget = (minor: number) => ({ actionType: "ads.set_daily_budget" as const, title: "Lower budget", rationale: "Fewer orders while the carrier recovers.", evidenceIds: ["e_ship"], params: { campaignId: "campaign_A", newDailyBudgetMinor: minor, currency: "GBP" } });
  const email = (orderIds: string[]) => ({ actionType: "customer.send_delay_notice" as const, title: "Notify customers", rationale: "Orders are late.", evidenceIds: ["e_ship"], params: { orderIds, templateId: "shipping_delay_v1", maxRecipients: orderIds.length } });
  const banner = (message: string, evidenceIds = ["e_ship"]) => ({ actionType: "storefront.publish_banner" as const, title: "Delivery notice", rationale: "Set expectations.", evidenceIds, params: { message, durationHours: 48 } });
  const plan = (actions: any[]) => ({ objective: "Recover from late deliveries.", summary: "Three actions.", actions });
  let checks = 0;
  try {
    const packet = await plannerPacket(diagnosis, evidence);
    assert.ok(packet.delayedOrders.length >= 2 && packet.delayedOrders.every(o => !("customerName" in o) && !("customerEmail" in o)), "orders reach Mubit without names or emails"); checks++;
    assert.ok(!JSON.stringify(packet).includes("@"), "no email addresses in the planner packet"); checks++;

    const good = await checkProposal(plan([budget(3000), email(["ord_001", "ord_002"]), banner("Some deliveries are taking longer than usual. We will email you with updates.")]), packet);
    assert.deepEqual(good.problems, []); assert.equal(good.actions.length, 3); checks++;
    assert.deepEqual(good.actions.map(a => a.agent), ["marketing", "customer_care", "storefront"]); checks++;
    const bannerAction = good.actions[2];
    assert.equal(Date.parse(String(bannerAction.params.expiresAt)) - Date.parse(String(bannerAction.params.startsAt)), 48 * 3600000); checks++;

    // Stating that a discount code is failing is a fact, not a promise.
    const factual = await checkProposal(plan([banner("The AUTUMN20 discount code is not applying at checkout right now. We're fixing it.")]), packet);
    assert.deepEqual(factual.problems, []); checks++;

    for (const [name, actions, expect] of [
      ["budget above the cap", [budget(20000)], /BUDGET_POLICY/],
      ["budget cut beyond 60%", [budget(1000)], /BUDGET_POLICY/],
      ["order that isn't delayed", [email(["ord_999"])], /orders that aren't delayed/],
      ["evidence not in the packet", [banner("Deliveries are slower than usual this week.", ["e_invented"])], /evidence not in the packet/],
      ["discount promise", [banner("Enjoy 20% off automatically at checkout today!")], /promises a discount/],
      ["refund promise", [banner("Late orders get a full refund.")], /promises a discount/],
      ["money-off promise", [banner("Save 15 percent off everything while we fix checkout.")], /promises a discount/],
      ["free shipping promise", [banner("Free shipping on all delayed orders.")], /promises a discount/],
      ["two budget actions", [budget(3000), budget(3500)], /more than one/],
      ["bad params", [{ ...banner("x"), params: { message: "x", durationHours: 9999 } }], /invalid params/],
      ["no actions", [], /no action proposed/],
    ] as const) {
      const result = await checkProposal(plan([...actions]), packet);
      assert.ok(result.problems.some(problem => expect.test(problem)), `${name}: ${JSON.stringify(result.problems)}`); checks++;
    }

    // Live path with Mubit mocked: fixed instructions, temperature 0, a request ID, and a 422 with reasons for an unsafe plan.
    process.env.MUBIT_API_KEY = "test-key"; process.env.MUBIT_BASE_URL = "https://mubit.test/gemini/v1beta";
    let reply = plan([budget(3000), banner("Some deliveries are taking longer than usual.")]), lastBody: any;
    globalThis.fetch = async (url, init) => {
      if (!String(url).startsWith("https://mubit.test/")) return saved.fetch(url, init);
      lastBody = JSON.parse(String(init?.body));
      return Response.json({ modelVersion: "gemini-4-argon", candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 40, candidatesTokenCount: 60 } }, { headers: { "x-middleware-request-id": "mreq_0123456789abcdef0123456789abcdef" } });
    };
    const result = await mubitPlanner.plan(diagnosis, evidence);
    assert.equal(lastBody.systemInstruction.parts[0].text, PLANNER_INSTRUCTIONS); checks++;
    assert.equal(lastBody.generationConfig.temperature, 0); checks++;
    assert.equal(result.modelCall.taskKey, "normal_recovery_planning"); checks++;
    assert.equal(result.modelCall.instructionsFingerprint, plannerTaskFingerprint()); checks++;
    assert.equal(result.modelCall.modelKind, "provider"); checks++;
    assert.equal(result.modelCall.mubitRequestId, "mreq_0123456789abcdef0123456789abcdef"); checks++;
    reply = plan([banner("Enjoy 20% off automatically at checkout today!")]);
    await assert.rejects(mubitPlanner.plan(diagnosis, evidence), (error: MubitPlanningError) => error.code === "PLAN_POLICY_REJECTED" && error.status === 422 && error.problems.length === 1 && error.requestId === "mreq_0123456789abcdef0123456789abcdef"); checks++;
    globalThis.fetch = async () => Response.json({ candidates: [{ content: { parts: [{ text: "{}" }] }, finishReason: "STOP" }] }, { headers: { "x-middleware-request-id": "mreq_0123456789abcdef0123456789abcdef" } });
    await assert.rejects(mubitPlanner.plan(diagnosis, evidence), (error: MubitPlanningError) => error.code === "MUBIT_INVALID_RESPONSE"); checks++;
    console.log(`✓ ${checks} planner checks passed: no customer data in the packet, policy enforced on every AI action (budget cap and change limit, real delayed orders, cited evidence, no discount/refund promises, one action per type), fixed Mubit task, temperature 0, request ID kept on rejection. Mubit mocked.`);
  } finally {
    globalThis.fetch = saved.fetch;
    for (const [key, value] of Object.entries({ MUBIT_API_KEY: saved.key, MUBIT_BASE_URL: saved.base })) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
