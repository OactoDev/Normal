import { ActionProposalT, ActionExecutionT } from "../contracts";
import { executeAction, ExecuteActionContext } from "../execution/execute-action";
import { toolRegistry } from "../execution/execute-action";

export class MarketingAgent {
  public readonly tools = { "ads.set_daily_budget": toolRegistry["ads.set_daily_budget"] };
  public readonly agentType = "marketing" as const;

  public async runAction(
    action: ActionProposalT,
    context: ExecuteActionContext
  ): Promise<ActionExecutionT> {
    if (action.agent !== "marketing" || !this.tools[action.actionType]) {
      throw new Error(`Marketing agent cannot execute action for ${action.agent}`);
    }
    return executeAction(action, context);
  }
}

export const marketingAgent = new MarketingAgent();
