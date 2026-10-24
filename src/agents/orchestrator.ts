import { randomUUID } from "crypto";
import { PlanHandoff, PlanHandoffT, ProposedPlanT, ActionExecution } from "../contracts";
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
    const plan = await this.getPlan(id), executions = await this.getExecutions(id);
    return { planId: id, planStatus: plan.status, needsAttention: executions.some(e => ["failed","cancelled"].includes(e.status)), approval: await this.getApproval(id), missions: await this.getMissions(id), executions, outcomes: await this.getOutcomes(id), emailSends: await store.emails.find({ planId: id }), details: await store.details.find({ planId: id }), logs: (await store.logs.find({ planId: id })).sort((a,b) => a.at.localeCompare(b.at)) };
  }
  async start(planId: string, approvalId: string, actionIds?: string[], principal = "", dispatch: (work: () => Promise<void>) => void = work => { void work().catch(console.error); }) {
    const h = await loadPlanHandoff(planId), record = await store.approvals.findOne(approvalId);
    await assertApprovalExecutable(h,record,principal);
    await this.saveHandoff(h);
    const allowed = record.approval.approvedActionIds;
    if (actionIds && (!actionIds.length || new Set(actionIds).size !== actionIds.length || actionIds.some(id => !allowed.includes(id)))) throw new ToolError("ACTION_NOT_APPROVED", "Retry may only select approved actions");
    const targets = h.plan.actions.filter(a => (actionIds ?? allowed).includes(a.actionId));
    for (const agent of new Set(targets.map(a => a.agent))) {
      const missionId = `${planId}:v${h.plan.planVersion}:${agent}`, actions = h.plan.actions.filter(a => a.agent === agent && allowed.includes(a.actionId));
      await store.missions.claim(missionId, { schemaVersion: 1, missionId, planId, assignedAgent: agent, goal: `Execute approved ${agent} operations`, actionIds: actions.map(a => a.actionId), status: "assigned", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    for (const action of targets) {
      const key = `${planId}:v${h.plan.planVersion}:${action.actionId}`;
      const execution = ActionExecution.parse({ executionId: randomUUID(), planId, planVersion: h.plan.planVersion, approvalId, actionId: action.actionId, missionId: `${planId}:v${h.plan.planVersion}:${action.agent}`, idempotencyKey: key, status: "queued", attempts: 0, toolName: action.actionType, dryRun: false });
      if (await store.executions.claim(key,execution)) await log(execution,"queued");
      else {
        const old = await store.executions.findOne(key);
        if ((old.status === "failed" && old.error?.retryable) || (old.status === "cancelled" && old.error?.code.startsWith("DEPENDENCY_"))) {
          if (await store.executions.compareAndSet(key, { status: old.status }, { status: "queued", approvalId, error: undefined, finishedAt: undefined })) await log(old,"manual retry queued");
        }
      }
    }
    const queued = await this.snapshot(planId);
    if (queued.executions.some(e => e.status === "queued")) {
      h.plan.status = "executing"; await this.savePlan(h.plan);
      dispatch(() => this.drain(planId,approvalId,principal));
    }
    return { ...queued, planStatus: h.plan.status };
  }
  async refreshMission(missionId: string) {
    const records = await store.executions.find({ missionId });
    if (!records.length) return;
    await store.missions.update(missionId, { $set: { status: records.every(e => e.status === "succeeded") ? "completed" : records.some(e => ["queued","running"].includes(e.status)) ? "in_progress" : "failed", updatedAt: new Date().toISOString() } });
  }
  async drain(planId: string, approvalId: string, principal: string) {
    await stepDelay();
    let h = await storedHandoff(planId);
    while (true) {
      const all = (await this.getExecutions(planId)).filter(e => e.planVersion === h.plan.planVersion), byAction = new Map(all.map(e => [e.actionId,e]));
      const queued = all.filter(e => e.status === "queued");
      if (!queued.length) break;
      let progress = false;
      await Promise.all(queued.map(async execution => {
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
        if (code) {
          if (await store.executions.compareAndSet(execution.idempotencyKey, { status: "queued" }, { status: "cancelled", finishedAt: new Date().toISOString(), error: { code, message: code, retryable: code.startsWith("DEPENDENCY_") } })) {
            await log(execution,code);
            await store.outcomes.update(execution.executionId, { $set: { outcomeId: `out_${execution.executionId}`, executionId: execution.executionId, actionId: action.actionId, status: "not_verified", observedMetricSnapshotIds: [], summary: code, observedAt: new Date().toISOString() } });
          }
          return;
        }
        await store.missions.update(execution.missionId, { $set: { status: "in_progress", updatedAt: new Date().toISOString() } });
        const agent = { marketing: marketingAgent, customer_care: customerCareAgent, storefront: storefrontAgent }[action.agent];
        await agent.runAction(action, execution);
        await this.refreshMission(execution.missionId);
      }));
      if (!progress) break;
    }
    const executions = (await this.getExecutions(planId)).filter(e => e.planVersion === h.plan.planVersion);
    for (const mission of await this.getMissions(planId)) await this.refreshMission(mission.missionId);
    const latest = await this.getPlan(planId);
    if (latest.planVersion === h.plan.planVersion && latest.status !== "rejected") await this.savePlan({ ...latest, status: executions.length && executions.every(e => e.status === "succeeded") ? "completed" : "executing" });
  }
}
export const orchestrator = new AgentOrchestrator();
