import {
  DiagnosisT,
  EvidenceT,
  ProposedPlanT,
  PlanHandoffT,
  ActionProposalT,
} from "../contracts";
import { orchestrator } from "../agents/orchestrator";

export class PlanGenerator {
  public async generatePlan(
    diagnosis: DiagnosisT,
    evidence: EvidenceT[]
  ): Promise<PlanHandoffT> {
    const planId = `plan_${Date.now()}`;
    const now = new Date().toISOString();
    const primaryCause = diagnosis.output.primaryCause;

    const actions: ActionProposalT[] = [];

    if (primaryCause === "delivery_delays") {
      // 1. Marketing Agent: Lower Campaign A daily budget
      actions.push({
        requiresApproval: true,
        dependsOnActionIds: [],
        risk: "medium",
        actionId: `act_ads_${Date.now()}`,
        agent: "marketing",
        title: "Lower Campaign A daily budget",
        rationale: "Reduce paid traffic volume while carrier delivery backlog is cleared.",
        evidenceIds: evidence.map((e) => e.evidenceId),
        actionType: "ads.set_daily_budget",
        params: {
          campaignId: "campaign_A",
          newDailyBudgetMinor: 3000,
          currency: "GBP",
        },
      });

      // 2. Customer Care Agent: Send proactive delivery notices
      actions.push({
        requiresApproval: true,
        dependsOnActionIds: [],
        risk: "medium",
        actionId: `act_email_${Date.now()}`,
        agent: "customer_care",
        title: "Send targeted delivery notices",
        rationale: "Notify impacted customers with live tracking links to mitigate negative sentiment.",
        evidenceIds: evidence.map((e) => e.evidenceId),
        actionType: "customer.send_delay_notice",
        params: {
          orderIds: ["ord_001", "ord_002"],
          templateId: "shipping_delay_v1",
          maxRecipients: 2,
        },
      });

      // 3. Storefront Agent: Publish delivery warning banner
      actions.push({
        requiresApproval: true,
        dependsOnActionIds: [],
        risk: "medium",
        actionId: `act_banner_${Date.now()}`,
        agent: "storefront",
        title: "Publish revised storefront delivery notice",
        rationale: "Manage customer expectations at storefront entry and checkout.",
        evidenceIds: evidence.map((e) => e.evidenceId),
        actionType: "storefront.publish_banner",
        params: {
          bannerId: `banner_ship_${Date.now()}`,
          message: "Delivery times for selected orders may take up to 48 hours longer than usual.",
          startsAt: now,
          expiresAt: new Date(Date.now() + 86400000 * 2).toISOString(),
        },
      });
    } else if (primaryCause === "ad_fatigue" || primaryCause === "ad_inefficiency") {
      actions.push({
        requiresApproval: true,
        dependsOnActionIds: [],
        risk: "medium",
        actionId: `act_ads_fatigue_${Date.now()}`,
        agent: "marketing",
        title: "Reduce fatigued ad campaign spend",
        rationale: "Lower daily budget on Campaign A by 40% to prevent budget burn on fatigued audiences.",
        evidenceIds: evidence.map((e) => e.evidenceId),
        actionType: "ads.set_daily_budget",
        params: {
          campaignId: "campaign_A",
          newDailyBudgetMinor: 2500,
          currency: "GBP",
        },
      });
    } else if (primaryCause === "checkout_failure") {
      actions.push({
        requiresApproval: true,
        dependsOnActionIds: [],
        risk: "medium",
        actionId: `act_banner_chk_${Date.now()}`,
        agent: "storefront",
        title: "Publish checkout promotion notice",
        rationale: "Alert customers that coupons are automatically applied at checkout while backend settles.",
        evidenceIds: evidence.map((e) => e.evidenceId),
        actionType: "storefront.publish_banner",
        params: {
          bannerId: `banner_chk_${Date.now()}`,
          message: "Enjoy 20% off automatically at checkout today. No discount code needed!",
          startsAt: now,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      });
    } else {
      // Default fallback action
      actions.push({
        requiresApproval: true,
        dependsOnActionIds: [],
        risk: "low",
        actionId: `act_banner_gen_${Date.now()}`,
        agent: "storefront",
        title: "Publish customer satisfaction notice",
        rationale: "Maintain customer confidence during ongoing operational review.",
        evidenceIds: evidence.map((e) => e.evidenceId),
        actionType: "storefront.publish_banner",
        params: {
          bannerId: `banner_gen_${Date.now()}`,
          message: "Our customer team is available 24/7 to assist with any order queries.",
          startsAt: now,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      });
    }

    const proposedPlan: ProposedPlanT = {
      schemaVersion: 1,
      businessId: "nova_store",
      planId,
      planVersion: 1,
      investigationId: diagnosis.investigationId,
      diagnosisId: diagnosis.diagnosisId,
      status: "awaiting_approval",
      objective: `Address ${primaryCause} to stabilize conversion and customer retention.`,
      summary: `Propose ${actions.length} targeted interventions executed by specialist agents.`,
      actions,
      successCriteria: [
        {
          metric: "cac_minor",
          direction: "decrease",
          measurementWindowMinutes: 120,
        },
        {
          metric: "late_delivery_rate",
          direction: "decrease",
          measurementWindowMinutes: 240,
        },
      ],
      createdAt: now,
      expiresAt: new Date(Date.now() + 86400000 * 2).toISOString(),
    };

    const handoff: PlanHandoffT = {
      plan: proposedPlan,
      diagnosis,
      evidence,
    };

    // Store in orchestrator so GET /api/plans/:planId serves it immediately
    await orchestrator.saveHandoff(handoff);

    return handoff;
  }
}

export const planGenerator = new PlanGenerator();
