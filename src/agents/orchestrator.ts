import { randomUUID } from "crypto";
import { PlanHandoff, PlanHandoffT, ProposedPlanT, ActionExecution, ActionExecutionT } from "../contracts";
import * as store from "../store/repos";
import { loadPlanHandoff, seedDefaultPlan, storedHandoff } from "../execution/load-plan";
import { assertApprovalExecutable } from "../execution/validate-approval";
import { readiness } from "../execution/dependencies";
import { reconcileDeliveries } from "../execution/delivery-monitor";
import { ToolError, stepDelay } from "../execution/retry-policy";
import { log } from "../execution/execute-action";
import { marketingAgent } from "./marketing-agent";
import { customerCareAgent } from "./customer-care-agent";
import { storefrontAgent } from "./storefront-agent";

class AgentOrchestrator {
  async seedDefaultPlan() { await seedDefaultPlan(); return this.getPlan("plan_001"); }
  async getPlan(id: string) { return (await storedHandoff(id)).plan; }
  async getHandoff(id: string) { return storedHandoff(id); }
  async savePlan(plan: ProposedPlanT) {
    const h = await storedHandoff(plan.planId);
    return store.handoffs.update(`${plan.planId}:v${plan.planVersion}`, { $set: { ...h, plan } });
  }
  async saveHandoff(input: PlanHandoffT) {
    const h = PlanHandoff.parse(input), key = `${h.plan.planId}:v${h.plan.planVersion}`;
    const old = await store.handoffs.findOne(key);
    if (old && JSON.stringify(old.plan.actions) !== JSON.stringify(h.plan.actions)) throw new ToolError("VERSION_CONFLICT", "Edited actions require a new plan version", false, false, 409);
    await store.handoffs.claim(key,h);
  }
  async getApproval(id: string) {
    const plan = await this.getPlan(id);
    const head = await store.approvalHeads.findOne(`${id}:v${plan.planVersion}`);
    if (head) return (await store.approvals.findOne(head.approvalId))?.approval ?? null;
    const records = (await store.approvals.find()).filter(r => r.approval.planId === id).sort((a,b) => b.approval.decidedAt.localeCompare(a.approval.decidedAt));
    return records[0]?.approval ?? null;
  }
  getExecutions(id: string) { return store.executions.find({ planId: id }); }
  getMissions(id: string) { return store.missions.find({ planId: id }); }
  async getOutcomes(id: string) { const ids = new Set((await this.getExecutions(id)).map(e => e.executionId)); return (await store.outcomes.find()).filter(o => ids.has(o.executionId)); }
  async snapshot(id: string) {
    // Fire-and-forget so a slow provider never delays the poll; the next poll shows any confirmed delivery.
    void reconcileDeliveries(id).catch(e => console.error("[delivery-monitor]", e));
    await this.sweepStale(id);
    const plan = await this.getPlan(id), executions = await this.getExecutions(id), approval = await this.getApproval(id);
    const note = approval && (await store.approvals.findOne(approval.approvalId))?._meta.note;
    return { planId: id, planStatus: plan.status, needsAttention: executions.some(e => ["failed","cancelled"].includes(e.status)), approval, changeRequestNote: note ?? null, missions: await this.getMissions(id), executions, outcomes: await this.getOutcomes(id), emailSends: await store.emails.find({ planId: id }), details: await store.details.find({ planId: id }), logs: (await store.logs.find({ planId: id })).sort((a,b) => a.at.localeCompare(b.at)) };
  }
  /** Ends an execution that never reached a terminal state, so the plan cannot hang on it. */
  async fail(execution: ActionExecutionT, from: ActionExecutionT["status"][], code: string, message: string, retryable: boolean) {
    for (const status of from) {
      if (!await store.executions.compareAndSet(execution.idempotencyKey, { status }, { status: status === "queued" ? "cancelled" : "failed", finishedAt: new Date().toISOString(), error: { code, message, retryable } })) continue;
      await log(execution, `${code}: ${message}`);
      await store.outcomes.update(execution.executionId, { $set: { outcomeId: `out_${execution.executionId}`, executionId: execution.executionId, actionId: execution.actionId, status: "not_verified", observedMetricSnapshotIds: [], summary: message, observedAt: new Date().toISOString() } });
      return true;
    }
    return false;
  }
  /** A run that outlives EXECUTION_STALE_MS belongs to a crashed or cut-off process. Tools are idempotent and email sends are claimed per recipient, so a retry cannot repeat a side effect. */
  async sweepStale(planId: string) {
    const limit = Number(process.env.EXECUTION_STALE_MS || 120000);
    for (const e of await this.getExecutions(planId))
      if (e.status === "running" && Date.now() - Date.parse(e.startedAt ?? "") > limit)
        await this.fail(e, ["running"], "STALE_RUNNING", "The run stopped without finishing; retry is safe", true);
  }
  async start(planId: string, approvalId: string, actionIds?: string[], principal = "", dispatch: (work: () => Promise<void>) => void = work => { void work().catch(console.error); }) {
    const h = await loadPlanHandoff(planId), record = await store.approvals.findOne(approvalId);
    await assertApprovalExecutable(h,record,principal);
    await this.saveHandoff(h);
    const allowed = record.approval.approvedActionIds;
    if (actionIds && (!actionIds.length || new Set(actionIds).size !== actionIds.length || actionIds.some(id => !allowed.includes(id)))) throw new ToolError("ACTION_NOT_APPROVED", "Retry may only select approved actions");
    await this.sweepStale(planId);
    const targets = h.plan.actions.filter(a => (actionIds ?? allowed).includes(a.actionId));
    for (const agent of new Set(targets.map(a => a.agent))) {
      const missionId = `${planId}:v${h.plan.planVersion}:${agent}`, actions = h.plan.actions.filter(a => a.agent === agent && allowed.includes(a.actionId));
      // A later approval can add actions to an agent's existing mission.
      if (!await store.missions.claim(missionId, { schemaVersion: 1, missionId, planId, assignedAgent: agent, goal: `Execute approved ${agent} operations`, actionIds: actions.map(a => a.actionId), status: "assigned", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }))
        await store.missions.update(missionId, { $set: { actionIds: actions.map(a => a.actionId), updatedAt: new Date().toISOString() } });
    }
    for (const action of targets) {
      const key = `${planId}:v${h.plan.planVersion}:${action.actionId}`;
      const execution = ActionExecution.parse({ executionId: randomUUID(), planId, planVersion: h.plan.planVersion, approvalId, actionId: action.actionId, missionId: `${planId}:v${h.plan.planVersion}:${action.agent}`, idempotencyKey: key, status: "queued", attempts: 0, toolName: action.actionType, dryRun: false });
      if (await store.executions.claim(key,execution)) await log(execution,"queued");
      else {
        const old = await store.executions.findOne(key);
        // Cancelled work never reached its tool, so it can always be queued again under a valid approval.
        if ((old.status === "failed" && old.error?.retryable) || old.status === "cancelled") {
          if (await store.executions.compareAndSet(key, { status: old.status }, { status: "queued", approvalId, error: undefined, finishedAt: undefined })) await log(old,"manual retry queued");
        }
      }
    }
    const queued = await this.snapshot(planId);
    if (queued.executions.some(e => e.status === "queued")) {
      h.plan.status = "executing"; await this.savePlan(h.plan);
      dispatch(() => this.drain(planId,approvalId,principal));
    } else if (targets.every(a => queued.executions.some(e => e.actionId === a.actionId && e.planVersion === h.plan.planVersion && e.status === "succeeded"))) {
      // Re-approving already finished work queues nothing; keep the plan's completed state accurate.
      const current = queued.executions.filter(e => e.planVersion === h.plan.planVersion);
      h.plan.status = current.length && current.every(e => e.status === "succeeded") ? "completed" : h.plan.status; await this.savePlan(h.plan);
    }
    return { ...queued, planStatus: h.plan.status };
  }
  async refreshMission(missionId: string) {
    const records = await store.executions.find({ missionId });
    if (!records.length) return;
    await store.missions.update(missionId, { $set: { status: records.every(e => e.status === "succeeded") ? "completed" : records.some(e => ["queued","running"].includes(e.status)) ? "in_progress" : "failed", updatedAt: new Date().toISOString() } });
  }
  async drain(planId: string, approvalId: string, principal: string) {
    let h = await storedHandoff(planId);
    try {
      await stepDelay();
      while (true) {
        const all = (await this.getExecutions(planId)).filter(e => e.planVersion === h.plan.planVersion), byAction = new Map(all.map(e => [e.actionId,e]));
        const queued = all.filter(e => e.status === "queued");
        if (!queued.length) break;
        let progress = false;
        await Promise.all(queued.map(async execution => {
          try {
            const action = h.plan.actions.find(a => a.actionId === execution.actionId);
            const approval = await store.approvals.findOne(execution.approvalId);
            const ready = action && approval ? readiness(action, approval.approval.approvedActionIds, byAction) : "APPROVAL_INVALID";
            if (ready === "waiting") return;
            let code: string = ready === "ready" ? undefined : ready;
            try {
              h = await storedHandoff(planId);
              await assertApprovalExecutable(h,approval,principal);
            } catch (e) { code = e instanceof ToolError ? e.code : "APPROVAL_INVALID"; }
            progress = true;
            if (code) { await this.fail(execution, ["queued"], code, code, code.startsWith("DEPENDENCY_")); return; }
            await store.missions.update(execution.missionId, { $set: { status: "in_progress", updatedAt: new Date().toISOString() } });
            const agent = { marketing: marketingAgent, customer_care: customerCareAgent, storefront: storefrontAgent }[action.agent];
            await agent.runAction(action, execution);
            await this.refreshMission(execution.missionId);
          } catch (e) {
            // A store or agent error must end this execution, not the whole run.
            progress = true;
            const error = e instanceof ToolError ? e : new ToolError("ORCHESTRATOR_ERROR", e instanceof Error ? e.message : String(e), true);
            await this.fail(execution, ["running","queued"], error.code, error.message, error.retryable && !error.sideEffectPossible).catch(err => console.error("[orchestrator]", err));
          }
        }));
        if (!progress) {
          // Work whose dependency was never queued can never start; work waiting on another run's dependency stays queued for that run.
          for (const execution of queued) {
            const action = h.plan.actions.find(a => a.actionId === execution.actionId);
            if (action?.dependsOnActionIds.some(id => !byAction.has(id))) await this.fail(execution, ["queued"], "DEPENDENCY_BLOCKED", "A dependency was not queued for execution", true);
          }
          break;
        }
      }
    } finally {
      const executions = (await this.getExecutions(planId)).filter(e => e.planVersion === h.plan.planVersion);
      for (const mission of await this.getMissions(planId)) await this.refreshMission(mission.missionId);
      const latest = await this.getPlan(planId);
      if (latest.planVersion === h.plan.planVersion && latest.status !== "rejected" && !executions.some(e => ["queued","running"].includes(e.status))) {
        // Finished with failures: hand the plan back to its approved state so the owner can retry, rather than leaving it "executing".
        const status = executions.length && executions.every(e => e.status === "succeeded") ? "completed" : (await this.getApproval(planId))?.decision ?? latest.status;
        if (status !== "rejected") await this.savePlan({ ...latest, status });
      }
    }
  }
}
export const orchestrator = new AgentOrchestrator();
