import { ActionProposalT, ActionExecutionT } from "../contracts";
import { executeAction, ExecuteActionContext } from "../execution/execute-action";

export class CustomerCareAgent {
  public readonly agentType = "customer_care" as const;

  public async runAction(
    action: ActionProposalT,
    context: ExecuteActionContext
  ): Promise<ActionExecutionT> {
    if (action.agent !== "customer_care") {
      throw new Error(`Customer Care agent cannot execute action for ${action.agent}`);
    }
    return executeAction(action, context);
  }
}

export const customerCareAgent = new CustomerCareAgent();
