import {
  DiagnosisT,
  EvidenceT,
  ProposedPlanT,
  PlanHandoffT,
  ModelCallT,
} from "../contracts";
import { orchestrator } from "../agents/orchestrator";
import { SaplingBlockedError, saplingVerifier } from "./sapling-verifier";
import { mubitPlanner } from "./mubit-planner";

export class PlanGenerator {
  public async generatePlan(
    diagnosis: DiagnosisT,
    evidence: EvidenceT[]
  ): Promise<{ handoff: PlanHandoffT; modelCall: ModelCallT }> {
    // Re-verify server-side: the diagnosis arrives from the client, so its saplingCheck can't be trusted.
    const saplingCheck = await saplingVerifier.verifyDiagnosis(diagnosis.output, evidence);
    if (saplingCheck.blocked) throw new SaplingBlockedError(saplingCheck);

    // The recovery actions come from Gemini through Mubit (its own Mubit task); the server enforces policy on them.
    const { output, actions, modelCall } = await mubitPlanner.plan(diagnosis, evidence);
    const planId = `plan_${Date.now()}`;
    const now = new Date().toISOString();
    const types = new Set(actions.map(action => action.actionType));
    const successCriteria = [
      ...(types.has("ads.set_daily_budget") ? [{ metric: "cac_minor", direction: "decrease" as const, measurementWindowMinutes: 120 }] : []),
      ...(diagnosis.output.primaryCause === "delivery_delays" ? [{ metric: "late_delivery_rate", direction: "decrease" as const, measurementWindowMinutes: 240 }] : []),
      ...(types.has("storefront.publish_banner") || types.has("customer.send_delay_notice") ? [{ metric: "support_tickets", direction: "decrease" as const, measurementWindowMinutes: 240 }] : []),
    ];

    const proposedPlan: ProposedPlanT = {
      schemaVersion: 1,
      businessId: "nova_store",
      planId,
      planVersion: 1,
      investigationId: diagnosis.investigationId,
      diagnosisId: diagnosis.diagnosisId,
      status: "awaiting_approval",
      objective: output.objective,
      summary: output.summary,
      actions,
      successCriteria,
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

    return { handoff, modelCall };
  }
}

export const planGenerator = new PlanGenerator();
