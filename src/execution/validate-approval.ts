import { ProposedPlanT, PlanApprovalT, PlanApproval } from "../contracts";

export interface ApprovePlanInput {
  planVersion: number;
  approvedActionIds: string[];
  reviewingPrincipal: string;
}

export interface ValidationSuccess {
  valid: true;
  approval: PlanApprovalT;
  plan: ProposedPlanT;
}

export interface ValidationError {
  valid: false;
  code: string;
  message: string;
}

export function validateAndCreateApproval(
  plan: ProposedPlanT,
  input: ApprovePlanInput
): ValidationSuccess | ValidationError {
  // 1. Verify plan expiration
  const now = new Date();
  if (new Date(plan.expiresAt) <= now) {
    return {
      valid: false,
      code: "PLAN_EXPIRED",
      message: `Plan ${plan.planId} expired at ${plan.expiresAt}. Cannot approve an expired plan.`,
    };
  }

  // 2. Verify plan version
  if (input.planVersion !== plan.planVersion) {
    return {
      valid: false,
      code: "VERSION_MISMATCH",
      message: `Approval targeted plan version ${input.planVersion}, but current version is ${plan.planVersion}.`,
    };
  }

  // 3. Verify actions
  if (!input.approvedActionIds || input.approvedActionIds.length === 0) {
    return {
      valid: false,
      code: "NO_ACTIONS_APPROVED",
      message: "At least one action must be selected for approval.",
    };
  }

  const validActionIds = new Set(plan.actions.map((a) => a.actionId));
  const invalidIds = input.approvedActionIds.filter((id) => !validActionIds.has(id));
  if (invalidIds.length > 0) {
    return {
      valid: false,
      code: "INVALID_ACTION_IDS",
      message: `Actions not found in plan: ${invalidIds.join(", ")}`,
    };
  }

  // 4. Create PlanApproval record
  const decision =
    input.approvedActionIds.length === plan.actions.length
      ? ("approved" as const)
      : ("partially_approved" as const);

  const approvalRecord: PlanApprovalT = {
    schemaVersion: 1,
    approvalId: `appr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    planId: plan.planId,
    planVersion: plan.planVersion,
    decision,
    approvedActionIds: input.approvedActionIds,
    reviewingPrincipal: input.reviewingPrincipal,
    decidedAt: now.toISOString(),
  };

  // Validate with Zod schema
  const parsed = PlanApproval.safeParse(approvalRecord);
  if (!parsed.success) {
    return {
      valid: false,
      code: "SCHEMA_VALIDATION_FAILED",
      message: parsed.error.message,
    };
  }

  // Update plan status
  const updatedPlan: ProposedPlanT = {
    ...plan,
    status: decision,
  };

  return {
    valid: true,
    approval: parsed.data,
    plan: updatedPlan,
  };
}
