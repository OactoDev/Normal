import { orchestrator } from "../agents/orchestrator";
import { validateAndCreateApproval } from "../execution/validate-approval";
import { simulatorState } from "../simulator/state";

async function runOrchestratorTest() {
  console.log("=== Testing Agent Orchestrator & Tool Execution ===");

  simulatorState.reset();
  const plan = orchestrator.seedDefaultPlan();

  console.log("Initial state:");
  console.log(" - Campaign A budget:", simulatorState.getCampaign("campaign_A")?.dailyBudgetMinor);
  console.log(" - Active banner:", simulatorState.getStorefrontBanner());
  console.log(" - Dispatched emails:", simulatorState.getDispatchedEmails().length);

  // 1. Approve all actions
  const approvalValidation = validateAndCreateApproval(plan, {
    planVersion: plan.planVersion,
    approvedActionIds: plan.actions.map((a) => a.actionId),
    reviewingPrincipal: "merchant_owner_01",
  });

  if (!approvalValidation.valid) {
    throw new Error(`Approval validation failed: ${approvalValidation.message}`);
  }

  console.log("✅ Approval validated successfully:", approvalValidation.approval.approvalId);
  orchestrator.saveApproval(approvalValidation.approval);

  // 2. Execute approved plan
  console.log("Executing approved plan via Orchestrator...");
  const runResult = await orchestrator.executeApprovedPlan(
    plan.planId,
    approvalValidation.approval
  );

  console.log("Execution status:", runResult.status);
  console.log("Missions count:", runResult.missions.length);
  console.log("Executions count:", runResult.executions.length);
  console.log("Outcomes count:", runResult.outcomes.length);

  // 3. Verify actual state changes
  const campaignA = simulatorState.getCampaign("campaign_A");
  console.log("Verified Campaign A new budget (pence):", campaignA?.dailyBudgetMinor);
  if (campaignA?.dailyBudgetMinor !== 3000) {
    throw new Error(`Expected budget 3000, got ${campaignA?.dailyBudgetMinor}`);
  }
  console.log("✅ Marketing Agent verified: Budget reduced from £50 to £30.");

  const banner = simulatorState.getStorefrontBanner();
  console.log("Verified Storefront Banner message:", banner?.message);
  if (!banner?.active || !banner.message.includes("Delivery times")) {
    throw new Error("Storefront banner was not activated properly.");
  }
  console.log("✅ Storefront Agent verified: Announcement banner published live.");

  const emails = simulatorState.getDispatchedEmails();
  console.log("Verified Dispatched emails count:", emails.length);
  if (emails.length !== 2) {
    throw new Error(`Expected 2 emails, got ${emails.length}`);
  }
  console.log("✅ Customer Care Agent verified: 2 personalized messages dispatched.");
  console.log(" - Sample subject:", emails[0].subject);
  console.log(" - Sample model used:", emails[0].modelUsed);
  console.log(" - Sample Mubit request ID:", emails[0].mubitRequestId);

  const events = simulatorState.getEvents();
  console.log("Emitted business events count:", events.length);
  console.log(
    "Emitted event types:",
    events.map((e) => e.type)
  );

  console.log("🎉 ALL ORCHESTRATION TESTS PASSED WITH 100% SUCCESS!");
}

runOrchestratorTest().catch((err) => {
  console.error("❌ Orchestration test failed:", err);
  process.exit(1);
});
