"use client";

import React, { useState, useEffect } from "react";
import { ProposedPlanT, PlanApprovalT, AgentMissionT, ActionExecutionT, ActionOutcomeT, BusinessEventT } from "../contracts";
import { PlanReview } from "../components/plan-review";
import { AgentMissionControl } from "../components/agent-mission-control";
import { ExecutionResults } from "../components/execution-results";
import { IntelligencePanel } from "../components/intelligence-panel";
import { DispatchedEmail, SimulatedBanner } from "../simulator/state";
import {
  Activity,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  Shield,
  Layers,
  Cpu,
} from "lucide-react";

export default function NormalOperationsCockpit() {
  const [activeTab, setActiveTab] = useState<"intelligence" | "review" | "control" | "results">("intelligence");
  const [plan, setPlan] = useState<ProposedPlanT | null>(null);
  const [approval, setApproval] = useState<PlanApprovalT | null>(null);
  const [missions, setMissions] = useState<AgentMissionT[]>([]);
  const [executions, setExecutions] = useState<ActionExecutionT[]>([]);
  const [outcomes, setOutcomes] = useState<ActionOutcomeT[]>([]);
  const [events, setEvents] = useState<BusinessEventT[]>([]);
  const [banner, setBanner] = useState<SimulatedBanner | null>(null);
  const [emails, setEmails] = useState<DispatchedEmail[]>([]);
  const [campaignBudget, setCampaignBudget] = useState<number>(5000);

  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // 1. Initial Load: fetch plan and simulator state
  const loadData = async () => {
    try {
      const planRes = await fetch("/api/plans/plan_001");
      if (planRes.ok) {
        const data = await planRes.json();
        setPlan(data.plan);
      }

      const execRes = await fetch("/api/plans/plan_001/executions");
      if (execRes.ok) {
        const execData = await execRes.json();
        if (execData.approval) setApproval(execData.approval);
        if (execData.missions) setMissions(execData.missions);
        if (execData.executions) setExecutions(execData.executions);
        if (execData.outcomes) setOutcomes(execData.outcomes);
      }

      const simRes = await fetch("/api/simulator");
      if (simRes.ok) {
        const simData = await simRes.json();
        setEvents(simData.events || []);
        setBanner(simData.simulator?.activeBanner || null);
        setEmails(simData.simulator?.dispatchedEmails || []);
        const camp = simData.simulator?.campaigns?.find(
          (c: { campaignId: string }) => c.campaignId === "campaign_A"
        );
        if (camp) setCampaignBudget(camp.dailyBudgetMinor);
      }
    } catch (err) {
      console.error("Failed to load operations state:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 2. Handle Plan Approval
  const handleApprove = async (approvedActionIds: string[]) => {
    if (!plan) return;
    setIsApproving(true);
    try {
      const res = await fetch(`/api/plans/${plan.planId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planVersion: plan.planVersion,
          approvedActionIds,
          reviewingPrincipal: "merchant_principal_aman",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setApproval(data.approval);
        setPlan(data.plan);
        setActiveTab("control");
      }
    } catch (err) {
      console.error("Approval failed:", err);
    } finally {
      setIsApproving(false);
    }
  };

  // 3. Handle Plan Execution
  const handleExecute = async () => {
    if (!plan) return;
    setIsExecuting(true);
    try {
      const res = await fetch(`/api/plans/${plan.planId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        const data = await res.json();
        setExecutions(data.executions || []);
        setOutcomes(data.outcomes || []);
        await loadData();
        setActiveTab("results");
      }
    } catch (err) {
      console.error("Execution failed:", err);
    } finally {
      setIsExecuting(false);
    }
  };

  // 4. Handle Demo Reset
  const handleReset = async () => {
    setIsLoading(true);
    setExecutions([]);
    setOutcomes([]);
    setApproval(null);
    setActiveTab("review");
    await loadData();
    setIsLoading(false);
  };

  const handlePlanGenerated = async (newPlanId: string) => {
    try {
      const res = await fetch(`/api/plans/${newPlanId}`);
      if (res.ok) {
        const data = await res.json();
        setPlan(data.plan);
        setApproval(null);
        setExecutions([]);
        setMissions([]);
        setOutcomes([]);
        setActiveTab("review");
      }
    } catch (e) {
      console.error("Error loading generated plan:", e);
    }
  };

  if (isLoading || !plan) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-sm font-mono">Loading Normal Operations Platform...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500 flex items-center justify-center font-black text-slate-950 text-lg shadow-md shadow-sky-500/20">
              N
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base tracking-tight">
                  Normal
                </span>
                <span className="text-xs px-2 py-0.5 rounded font-mono bg-sky-950 text-sky-400 border border-sky-500/30">
                  v1.0 Night Shift
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Making seamless operations the new normal
              </p>
            </div>
          </div>

          {/* Navigation Stages */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("intelligence")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === "intelligence"
                  ? "bg-purple-500 text-slate-950 shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>0. Intelligence Studio</span>
            </button>
            <button
              onClick={() => setActiveTab("review")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === "review"
                  ? "bg-sky-500 text-slate-950 shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>1. Plan Review</span>
              {approval && <CheckCircle2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setActiveTab("control")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === "control"
                  ? "bg-sky-500 text-slate-950 shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>2. Agent Mission Control</span>
              {executions.length > 0 && <CheckCircle2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setActiveTab("results")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === "results"
                  ? "bg-sky-500 text-slate-950 shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>3. Execution Results</span>
              {executions.length > 0 && <span className="text-emerald-400">● Live</span>}
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-3 font-mono text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Mubit Gateway Active
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full space-y-6">
        {activeTab === "intelligence" && (
          <IntelligencePanel onPlanGenerated={handlePlanGenerated} />
        )}

        {activeTab === "review" && (
          <PlanReview
            plan={plan}
            onApprove={handleApprove}
            isApproving={isApproving}
          />
        )}

        {activeTab === "control" && (
          <AgentMissionControl
            approval={approval}
            missions={missions}
            executions={executions}
            isExecuting={isExecuting}
            onExecute={handleExecute}
            onReset={handleReset}
          />
        )}

        {activeTab === "results" && (
          <ExecutionResults
            executions={executions}
            outcomes={outcomes}
            events={events}
            banner={banner}
            emails={emails}
            campaignBudgetMinor={campaignBudget}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500 font-mono">
        Normal Platform · Night Shift $65K Mubit Hackathon · Canary Wharf London 2026
      </footer>
    </div>
  );
}
