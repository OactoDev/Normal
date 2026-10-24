import { ActionProposalT, ActionExecutionT } from "../contracts";
import { ToolError } from "../execution/retry-policy";
import { executeAction, ExecuteActionContext } from "../execution/execute-action";
import { toolRegistry } from "../execution/execute-action";

export class StorefrontAgent {
  public readonly tools = { "storefront.publish_banner": toolRegistry["storefront.publish_banner"] };
  public readonly agentType = "storefront" as const;

  public async runAction(
    action: ActionProposalT,
    context: ExecuteActionContext
  ): Promise<ActionExecutionT> {
    if (action.agent !== "storefront" || !this.tools[action.actionType]) {
      throw new ToolError("AGENT_SCOPE", `Storefront agent cannot execute action for ${action.agent}`);
    }
    return executeAction(action, context);
  }
}

export const storefrontAgent = new StorefrontAgent();
