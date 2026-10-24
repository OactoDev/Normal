import { randomUUID } from "crypto";
import { ActionProposalT, ActionExecutionT } from "../contracts";
import { executions, details, logs, outcomes, emails } from "../store/repos";
import { executeSetDailyBudget } from "../tools/ads";
import { executeSendDelayNotice } from "../tools/email";
import { executePublishBanner } from "../tools/storefront";
import { verifyAction } from "./verify-action";
import { delay, stepDelay, ToolError } from "./retry-policy";
import { emitEvent } from "../simulator/events";
export interface ExecuteActionContext { planId: string; planVersion: number; approvalId: string; missionId: string }
export async function log(execution: ActionExecutionT, message: string) {
  const logId = randomUUID();
  await logs.insert(logId, { logId, planId: execution.planId, executionId: execution.executionId, message, at: new Date().toISOString() });
}
export const toolRegistry = {
  "ads.set_daily_budget": { agent: "marketing", tool: executeSetDailyBudget, verify: verifyAction },
  "customer.send_delay_notice": { agent: "customer_care", tool: executeSendDelayNotice, verify: verifyAction },
  "storefront.publish_banner": { agent: "storefront", tool: executePublishBanner, verify: verifyAction },
};
export async function executeAction(action: ActionProposalT, context: ExecuteActionContext): Promise<ActionExecutionT> {
  const key = `${context.planId}:v${context.planVersion}:${action.actionId}`;
  let execution = await executions.findOne(key);
  if (!execution) throw new ToolError("NOT_QUEUED", "Execution has not been claimed");
  if (!await executions.compareAndSet(key, { status: "queued" }, { status: "running", attempts: execution.attempts+1, startedAt: new Date().toISOString(), error: undefined, finishedAt: undefined })) return executions.findOne(key);
  execution = await executions.findOne(key);
  await log(execution,"running");
  await stepDelay();
  try {
    const binding = toolRegistry[action.actionType as keyof typeof toolRegistry];
    if (!binding || binding.agent !== action.agent) throw new ToolError("AGENT_SCOPE", "Tool is not in this agent's scope");
    let payload: Record<string, unknown>;
    for (let retry = 0; ; retry++) {
      try {
        payload = await binding.tool(action.params, { planId: context.planId, actionId: action.actionId, idempotencyKey: key });
        break;
      } catch (e) {
        if (action.actionType === "customer.send_delay_notice" || !(e instanceof ToolError) || !e.retryable || retry >= 2) throw e;
        await log(execution,`transient failure; retry ${retry+1}`);
        await delay(100 * 2**retry);
        execution = await executions.update(key, { $set: { attempts: execution.attempts+1 } });
      }
    }
    // Preserve the first before-value when retrying an idempotent write.
    const previous = await details.findOne(execution.executionId);
    if (previous) payload = { ...payload, previousBudgetMinor: previous.payload.previousBudgetMinor ?? payload.previousBudgetMinor };
    await details.update(execution.executionId, { $set: { executionId: execution.executionId, planId: context.planId, payload } });
    await log(execution,"tool completed; verifying stored effect");
    await stepDelay();
    const verified = await binding.verify(action,key);
    payload = { ...payload, readBack: verified.readBack };
    await details.update(execution.executionId, { $set: { payload } });
    if (action.actionType === "customer.send_delay_notice") {
      // One event per message, so ingestion sees each order's send status.
      for (const e of payload.emails as { key: string; orderId: string; status: string; provider: string; providerOperationId?: string }[])
        await emitEvent(e.key, "customer.message_sent", { planId: context.planId, actionId: action.actionId, orderId: e.orderId, templateId: action.params.templateId, status: e.status, provider: e.provider, providerOperationId: e.providerOperationId });
    } else {
      await emitEvent(key, action.actionType === "ads.set_daily_budget" ? "campaign.budget_updated" : "storefront.banner_published", { planId: context.planId, actionId: action.actionId, ...payload });
    }
    execution = await executions.update(key, { $set: { status: "succeeded", finishedAt: new Date().toISOString(), result: { affectedEntityIds: action.actionType === "ads.set_daily_budget" ? [String(action.params.campaignId)] : action.actionType === "storefront.publish_banner" ? [String(action.params.bannerId)] : (payload.emails as {orderId: string}[]).map(e => e.orderId), verification: verified.verification }, error: undefined } });
    await outcomes.update(execution.executionId, { $set: { outcomeId: `out_${execution.executionId}`, executionId: execution.executionId, actionId: action.actionId, status: action.actionType === "customer.send_delay_notice" ? "monitoring" : "verified", observedMetricSnapshotIds: [], summary: verified.verification, observedAt: new Date().toISOString() } });
    await log(execution,"succeeded: read-back verified");
  } catch (e) {
    if (action.actionType === "customer.send_delay_notice") {
      const sends = (await emails.find({ planId: context.planId, actionId: action.actionId })).filter(e=>e.key.startsWith(`${key}:`));
      if (sends.length) await details.update(execution.executionId, { $set: { executionId: execution.executionId, planId: context.planId, payload: { emails: sends } } });
    }
    const error = e instanceof ToolError ? e : new ToolError("TOOL_FAILED", e instanceof Error ? e.message : String(e));
    execution = await executions.update(key, { $set: { status: "failed", finishedAt: new Date().toISOString(), error: { code: error.code, message: error.message, retryable: error.retryable && !error.sideEffectPossible } } });
    await outcomes.update(execution.executionId, { $set: { outcomeId: `out_${execution.executionId}`, executionId: execution.executionId, actionId: action.actionId, status: "not_verified", observedMetricSnapshotIds: [], summary: error.message, observedAt: new Date().toISOString() } });
    await log(execution,`${error.code}: ${error.message}`);
  }
  return execution;
}
