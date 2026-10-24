import { ActionProposalT, ActionExecutionT } from "../contracts";
import { ToolError } from "../execution/retry-policy";
import { executeAction, ExecuteActionContext } from "../execution/execute-action";
import { toolRegistry } from "../execution/execute-action";

export class CustomerCareAgent {
  public readonly tools = { "customer.send_delay_notice": toolRegistry["customer.send_delay_notice"] };
  public readonly agentType = "customer_care" as const;

  public async runAction(
    action: ActionProposalT,
    context: ExecuteActionContext
  ): Promise<ActionExecutionT> {
    if (action.agent !== "customer_care" || !this.tools[action.actionType]) {
      throw new ToolError("AGENT_SCOPE", `Customer Care agent cannot execute action for ${action.agent}`);
    }
    return executeAction(action, context);
  }
}

export const customerCareAgent = new CustomerCareAgent();
