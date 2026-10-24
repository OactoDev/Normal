import { randomUUID } from "crypto";
import { z } from "zod";
import { PlanApproval, PlanHandoffT } from "../contracts";
import { approvals, approvalHeads, handoffs, executions, ApprovalRecordT } from "../store/repos";
import { authorize, validatePolicy } from "./policy";
import { ToolError } from "./retry-policy";
import { validateGraph } from "./dependencies";
export const ApprovalInput = z.object({ planVersion: z.number().int().positive(), decision: z.enum(["approved", "partially_approved", "rejected"]), approvedActionIds: z.array(z.string()).max(100), changeRequestNote: z.string().trim().min(1).max(2000).optional() }).strict();
async function validate(h: PlanHandoffT, input: z.infer<typeof ApprovalInput>, principal: string) {
  authorize(principal, h.plan.businessId);
  if (h.evidence.some(e => e.businessId !== h.plan.businessId)) throw new ToolError("BUSINESS_MISMATCH", "Evidence belongs to another business");
  if (Date.parse(h.plan.expiresAt) <= Date.now()) throw new ToolError("PLAN_EXPIRED", "Plan expired", false, false, 409);
  if (h.plan.status === "rejected" || h.plan.status === "expired") throw new ToolError("PLAN_REJECTED", "Plan is no longer executable", false, false, 409);
  if (input.planVersion !== h.plan.planVersion) throw new ToolError("VERSION_MISMATCH", "Plan version changed", false, false, 409);
  if (new Set(input.approvedActionIds).size !== input.approvedActionIds.length || input.approvedActionIds.some(id => !h.plan.actions.some(a => a.actionId === id))) throw new ToolError("INVALID_ACTION_IDS", "Invalid or duplicate action IDs");
  if (input.decision === "rejected" ? input.approvedActionIds.length !== 0 : input.approvedActionIds.length === 0) throw new ToolError("INVALID_DECISION", "Decision does not match selected actions");
  if (input.decision === "approved" && input.approvedActionIds.length !== h.plan.actions.length) throw new ToolError("INVALID_DECISION", "Approve all requires every action");
  validateGraph(h);
  for (const a of h.plan.actions.filter(a => input.approvedActionIds.includes(a.actionId))) await validatePolicy(a);
  authorize(principal, h.plan.businessId, h.plan.actions.filter(a => input.approvedActionIds.includes(a.actionId)).map(a => a.actionType));
}
export async function createApproval(h: PlanHandoffT, raw: unknown, principal: string) {
  const input = ApprovalInput.parse(raw); await validate(h,input,principal);
  if ((await executions.find({ planId: h.plan.planId })).some(e => ["queued", "running"].includes(e.status))) throw new ToolError("EXECUTION_ACTIVE", "Wait for running actions before changing the approval", false, false, 409);
  const approval = PlanApproval.parse({ approvalId: randomUUID(), planId: h.plan.planId, planVersion: input.planVersion, decision: input.decision, approvedActionIds: input.approvedActionIds, reviewingPrincipal: principal, decidedAt: new Date().toISOString() });
  const ttl = Number(process.env.APPROVAL_TTL_MINUTES || 30);
  if (!Number.isFinite(ttl) || ttl <= 0) throw new ToolError("CONFIG_ERROR", "Invalid approval TTL");
  const record: ApprovalRecordT = { approval, _meta: { businessId: h.plan.businessId, expiresAt: new Date(Math.min(Date.now()+ttl*60000, Date.parse(h.plan.expiresAt))).toISOString(), note: input.changeRequestNote } };
  await approvals.insert(approval.approvalId, record);
  await approvalHeads.update(`${h.plan.planId}:v${h.plan.planVersion}`, { $set: { planId: h.plan.planId, planVersion: h.plan.planVersion, approvalId: approval.approvalId } });
  h.plan.status = input.decision;
  await handoffs.update(`${h.plan.planId}:v${h.plan.planVersion}`, { $set: h });
  return { approval, plan: h.plan };
}
export async function assertApprovalExecutable(h: PlanHandoffT, record: ApprovalRecordT | undefined, principal: string) {
  if (!record || record.approval.planId !== h.plan.planId) throw new ToolError("NOT_APPROVED", "Approval missing or belongs to another plan", false, false, 409);
  if (record._meta.businessId !== h.plan.businessId) throw new ToolError("BUSINESS_MISMATCH", "Approval business mismatch", false, false, 403);
  if (record.approval.reviewingPrincipal !== principal) throw new ToolError("PRINCIPAL_MISMATCH", "Approval belongs to another principal", false, false, 403);
  if (Date.parse(record._meta.expiresAt) <= Date.now()) throw new ToolError("APPROVAL_EXPIRED", "Approval expired", false, false, 409);
  if (record.approval.decision === "rejected") throw new ToolError("NOT_APPROVED", "Plan rejected", false, false, 409);
  const head = await approvalHeads.findOne(`${h.plan.planId}:v${h.plan.planVersion}`);
  if (head && head.approvalId !== record.approval.approvalId) throw new ToolError("APPROVAL_SUPERSEDED", "A newer decision replaced this approval", false, false, 409);
  await validate(h, record.approval, principal);
}
