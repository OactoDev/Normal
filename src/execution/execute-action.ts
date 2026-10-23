import {
  ActionProposalT,
  ActionExecutionT,
  ActionExecution,
} from "../contracts";
import { executeSetDailyBudget } from "../tools/ads";
import { executeSendDelayNotice } from "../tools/email";
import { executePublishBanner } from "../tools/storefront";

export interface ExecuteActionContext {
  planId: string;
  planVersion: number;
  approvalId: string;
  missionId: string;
}

export async function executeAction(
  action: ActionProposalT,
  context: ExecuteActionContext
): Promise<ActionExecutionT> {
  const idempotencyKey = `${context.planId}:v${context.planVersion}:${action.actionId}`;
  const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const startedAt = new Date().toISOString();

  let status: "succeeded" | "failed" = "succeeded";
  let result: ActionExecutionT["result"] = undefined;
  let error: ActionExecutionT["error"] = undefined;

  try {
    switch (action.actionType) {
      case "ads.set_daily_budget": {
        const params = action.params as {
          campaignId: string;
          newDailyBudgetMinor: number;
          currency: string;
        };
        const adResult = await executeSetDailyBudget(params);
        result = {
          providerOperationId: adResult.providerOperationId,
          affectedEntityIds: [params.campaignId],
          verification: adResult.verificationDetails,
        };
        break;
      }

      case "customer.send_delay_notice": {
        const params = action.params as {
          orderIds: string[];
          templateId: string;
          maxRecipients: number;
        };
        const emailResult = await executeSendDelayNotice(params);
        result = {
          providerOperationId: emailResult.providerOperationId,
          affectedEntityIds: emailResult.recipientOrderIds,
          verification: emailResult.verificationDetails,
        };
        break;
      }

      case "storefront.publish_banner": {
        const params = action.params as {
          bannerId: string;
          message: string;
          startsAt: string;
          expiresAt: string;
        };
        const bannerResult = await executePublishBanner(params);
        result = {
          providerOperationId: bannerResult.providerOperationId,
          affectedEntityIds: [params.bannerId],
          verification: bannerResult.verificationDetails,
        };
        break;
      }

      default:
        throw new Error(`Unsupported action type: ${action.actionType}`);
    }
  } catch (err: unknown) {
    status = "failed";
    const message = err instanceof Error ? err.message : String(err);
    error = {
      code: "ACTION_EXECUTION_ERROR",
      message,
      retryable: true,
    };
  }

  const finishedAt = new Date().toISOString();

  const executionRecord: ActionExecutionT = {
    schemaVersion: 1,
    executionId,
    planId: context.planId,
    planVersion: context.planVersion,
    approvalId: context.approvalId,
    actionId: action.actionId,
    missionId: context.missionId,
    idempotencyKey,
    status,
    attempts: 1,
    toolName: action.actionType,
    dryRun: false,
    startedAt,
    finishedAt,
    result,
    error,
  };

  return ActionExecution.parse(executionRecord);
}
