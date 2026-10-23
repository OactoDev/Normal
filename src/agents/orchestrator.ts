import {
  ProposedPlanT,
  PlanApprovalT,
  AgentMissionT,
  ActionExecutionT,
  ActionOutcomeT,
  ActionProposalT,
  AgentMission,
  ActionOutcome,
} from "../contracts";
import { resolveDependencyWaves } from "../execution/dependencies";
import { marketingAgent } from "./marketing-agent";
import { customerCareAgent } from "./customer-care-agent";
import { storefrontAgent } from "./storefront-agent";
import { simulatorState } from "../simulator/state";

export interface OrchestratorRunResult {
  planId: string;
  planVersion: number;
  status: "completed" | "partially_completed" | "failed";
  missions: AgentMissionT[];
  executions: ActionExecutionT[];
  outcomes: ActionOutcomeT[];
}

class AgentOrchestrator {
  private plans: Map<string, ProposedPlanT> = new Map();
  private approvals: Map<string, PlanApprovalT> = new Map();
  private missions: Map<string, AgentMissionT[]> = new Map();
  private executions: Map<string, ActionExecutionT[]> = new Map();
  private outcomes: Map<string, ActionOutcomeT[]> = new Map();

  // Seed default Nova Store plan_001
  constructor() {
    this.seedDefaultPlan();
  }

  public seedDefaultPlan(): ProposedPlanT {
    const defaultPlan: ProposedPlanT = {
      schemaVersion: 1,
      businessId: "nova_store",
      planId: "plan_001",
      planVersion: 1,
      investigationId: "inv_001",
      diagnosisId: "diag_001",
      status: "awaiting_approval",
      objective: "Reduce inefficient spend and address delivery dissatisfaction.",
      summary:
        "Propose three controlled interventions based on campaign and shipping evidence.",
      actions: [
        {
          requiresApproval: true,
          dependsOnActionIds: [],
          risk: "medium",
          actionId: "act_ads_001",
          agent: "marketing",
          title: "Lower Campaign A daily budget",
          rationale: "Campaign has higher acquisition costs and reduced engagement.",
          evidenceIds: ["e_ads_01"],
          actionType: "ads.set_daily_budget",
          params: {
            campaignId: "campaign_A",
            newDailyBudgetMinor: 3000,
            currency: "GBP",
          },
        },
        {
          requiresApproval: true,
          dependsOnActionIds: [],
          risk: "medium",
          actionId: "act_email_001",
          agent: "customer_care",
          title: "Send targeted delivery notices",
          rationale:
            "Customers with delayed deliveries should receive accurate status information.",
          evidenceIds: ["e_ship_01"],
          actionType: "customer.send_delay_notice",
          params: {
            orderIds: ["ord_001", "ord_002"],
            templateId: "shipping_delay_v1",
            maxRecipients: 2,
          },
        },
        {
          requiresApproval: true,
          dependsOnActionIds: [],
          risk: "medium",
          actionId: "act_banner_001",
          agent: "storefront",
          title: "Publish a revised delivery notice",
          rationale:
            "Prevent checkout confusion while fulfilment performance recovers.",
          evidenceIds: ["e_ship_01"],
          actionType: "storefront.publish_banner",
          params: {
            bannerId: "banner_ship_001",
            message:
              "Delivery times for selected products may be longer than usual.",
            startsAt: "2026-10-23T19:05:00Z",
            expiresAt: "2026-10-25T19:05:00Z",
          },
        },
      ],
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
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000 * 2).toISOString(),
    };

    this.plans.set(defaultPlan.planId, defaultPlan);
    return defaultPlan;
  }

  public getPlan(planId: string): ProposedPlanT | undefined {
    return this.plans.get(planId);
  }

  public savePlan(plan: ProposedPlanT): void {
    this.plans.set(plan.planId, plan);
  }

  public getApproval(planId: string): PlanApprovalT | undefined {
    return this.approvals.get(planId);
  }

  public saveApproval(approval: PlanApprovalT): void {
    this.approvals.set(approval.planId, approval);
  }

  public getExecutions(planId: string): ActionExecutionT[] {
    return this.executions.get(planId) || [];
  }

  public getOutcomes(planId: string): ActionOutcomeT[] {
    return this.outcomes.get(planId) || [];
  }

  public getMissions(planId: string): AgentMissionT[] {
    return this.missions.get(planId) || [];
  }

  public async executeApprovedPlan(
    planId: string,
    approval: PlanApprovalT
  ): Promise<OrchestratorRunResult> {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    // 1. Transition plan to executing
    plan.status = "executing";
    this.plans.set(planId, plan);

    const approvedIds = new Set(approval.approvedActionIds);
    const { waves, unexecutable } = resolveDependencyWaves(
      plan.actions,
      approvedIds
    );

    if (unexecutable.length > 0) {
      console.warn(
        `[Orchestrator] ${unexecutable.length} actions could not be executed due to unmet dependencies.`
      );
    }

    // 2. Create AgentMission records
    const missions: AgentMissionT[] = [];
    const agentActionsMap = new Map<string, ActionProposalT[]>();

    for (const actionId of approval.approvedActionIds) {
      const action = plan.actions.find((a) => a.actionId === actionId);
      if (action) {
        const list = agentActionsMap.get(action.agent) || [];
        list.push(action);
        agentActionsMap.set(action.agent, list);
      }
    }

    for (const [agentType, actions] of agentActionsMap.entries()) {
      const missionRecord: AgentMissionT = {
        schemaVersion: 1,
        missionId: `mission_${agentType}_${Date.now()}`,
        planId: plan.planId,
        assignedAgent: agentType as AgentMissionT["assignedAgent"],
        goal: `Execute ${actions.length} approved actions for ${agentType} operations.`,
        actionIds: actions.map((a) => a.actionId),
        status: "in_progress",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      missions.push(AgentMission.parse(missionRecord));
    }
    this.missions.set(planId, missions);

    // 3. Execute wave by wave
    const executions: ActionExecutionT[] = [];
    const outcomes: ActionOutcomeT[] = [];

    for (const wave of waves) {
      // Actions in the same wave can execute concurrently
      const wavePromises = wave.actions.map(async (action) => {
        const mission = missions.find((m) => m.assignedAgent === action.agent);
        const context = {
          planId: plan.planId,
          planVersion: plan.planVersion,
          approvalId: approval.approvalId,
          missionId: mission?.missionId || `mission_${action.agent}`,
        };

        let execution: ActionExecutionT;
        if (action.agent === "marketing") {
          execution = await marketingAgent.runAction(action, context);
        } else if (action.agent === "customer_care") {
          execution = await customerCareAgent.runAction(action, context);
        } else if (action.agent === "storefront") {
          execution = await storefrontAgent.runAction(action, context);
        } else {
          throw new Error(`Unassigned agent for action ${action.actionId}`);
        }

        executions.push(execution);

        // 4. Create ActionOutcome record
        const isSuccess = execution.status === "succeeded";
        const outcomeRecord: ActionOutcomeT = {
          schemaVersion: 1,
          outcomeId: `outcome_${execution.executionId}`,
          executionId: execution.executionId,
          actionId: action.actionId,
          status: isSuccess ? "verified" : "not_verified",
          observedMetricSnapshotIds: [],
          summary: isSuccess
            ? execution.result?.verification || "Action verified successfully."
            : execution.error?.message || "Action failed during execution.",
          observedAt: new Date().toISOString(),
        };
        outcomes.push(ActionOutcome.parse(outcomeRecord));
      });

      await Promise.all(wavePromises);
    }

    // 5. Update mission statuses
    for (const mission of missions) {
      const missionExecs = executions.filter((e) =>
        mission.actionIds.includes(e.actionId)
      );
      const allSucceeded = missionExecs.every((e) => e.status === "succeeded");
      mission.status = allSucceeded ? "completed" : "failed";
      mission.updatedAt = new Date().toISOString();
    }

    // 6. Update plan status
    const allSuccessful = executions.every((e) => e.status === "succeeded");
    plan.status = allSuccessful ? "completed" : "executing";
    this.plans.set(planId, plan);

    this.executions.set(planId, executions);
    this.outcomes.set(planId, outcomes);

    return {
      planId: plan.planId,
      planVersion: plan.planVersion,
      status: allSuccessful ? "completed" : "partially_completed",
      missions,
      executions,
      outcomes,
    };
  }
}

export const orchestrator = new AgentOrchestrator();
