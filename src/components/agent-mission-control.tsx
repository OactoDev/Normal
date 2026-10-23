"use client";

import React from "react";
import {
  AgentMissionT,
  ActionExecutionT,
  PlanApprovalT,
} from "../contracts";
import {
  Megaphone,
  Mail,
  Store,
  CheckCircle2,
  Clock,
  Play,
  RotateCcw,
  Sparkles,
  Terminal,
} from "lucide-react";

interface AgentMissionControlProps {
  approval: PlanApprovalT | null;
  missions: AgentMissionT[];
  executions: ActionExecutionT[];
  isExecuting: boolean;
  onExecute: () => Promise<void>;
  onReset: () => void;
}

export function AgentMissionControl({
  approval,
  missions,
  executions,
  isExecuting,
  onExecute,
  onReset,
}: AgentMissionControlProps) {
  const getAgentIcon = (agent: string) => {
    switch (agent) {
      case "marketing":
        return <Megaphone className="w-5 h-5 text-indigo-400" />;
      case "customer_care":
        return <Mail className="w-5 h-5 text-emerald-400" />;
      case "storefront":
        return <Store className="w-5 h-5 text-amber-400" />;
      default:
        return <Terminal className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "succeeded":
      case "completed":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Succeeded
          </span>
        );
      case "running":
      case "in_progress":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center gap-1 animate-pulse">
            <Clock className="w-3.5 h-3.5 animate-spin" /> Running
          </span>
        );
      case "failed":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
            Failed
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
            Queued
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Execution Control Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-slate-800 text-sky-400 border border-slate-700">
              Approval: {approval?.approvalId || "Authorized"}
            </span>
            <span className="text-xs text-slate-400">
              Approved by: {approval?.reviewingPrincipal}
            </span>
          </div>
          <h3 className="text-lg font-bold text-white mt-1">
            Agent Mission Control & Orchestration
          </h3>
          <p className="text-xs text-slate-400">
            Coordinating specialized workers across advertising, customer care, and storefront services.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onReset}
            className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Demo
          </button>
          <button
            onClick={onExecute}
            disabled={isExecuting || executions.length > 0}
            className="px-5 py-2.5 rounded-lg text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isExecuting ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                Executing Missions...
              </>
            ) : executions.length > 0 ? (
              <>
                <CheckCircle2 className="w-4 h-4" /> Missions Completed
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-slate-950" /> Run All Approved Missions
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3 Specialist Agent Mission Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Marketing Agent */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-950/60 border border-indigo-500/30">
                {getAgentIcon("marketing")}
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Marketing Agent</h4>
                <div className="text-xs text-indigo-400 font-mono">ads.set_daily_budget</div>
              </div>
            </div>
            {getStatusBadge(
              executions.find((e) => e.toolName === "ads.set_daily_budget")?.status
            )}
          </div>

          <div className="space-y-2 text-xs">
            <div className="text-slate-400">Assigned Mission:</div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
              Reduce Campaign A daily budget from £50.00 to £30.00 (3000 pence) to curb rising CAC.
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Target: Meta Ads API</span>
            <span className="text-indigo-400">Deterministic</span>
          </div>
        </div>

        {/* Customer Care Agent */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/30">
                {getAgentIcon("customer_care")}
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Customer Care Agent</h4>
                <div className="text-xs text-emerald-400 font-mono">customer.send_delay_notice</div>
              </div>
            </div>
            {getStatusBadge(
              executions.find((e) => e.toolName === "customer.send_delay_notice")?.status
            )}
          </div>

          <div className="space-y-2 text-xs">
            <div className="text-slate-400">Assigned Mission:</div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
              Draft personalized email updates for 2 delayed customers via Mubit LLM proxy and dispatch.
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Target: Controlled Test Inbox</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Mubit Proxy
            </span>
          </div>
        </div>

        {/* Storefront Agent */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-950/60 border border-amber-500/30">
                {getAgentIcon("storefront")}
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Storefront Agent</h4>
                <div className="text-xs text-amber-400 font-mono">storefront.publish_banner</div>
              </div>
            </div>
            {getStatusBadge(
              executions.find((e) => e.toolName === "storefront.publish_banner")?.status
            )}
          </div>

          <div className="space-y-2 text-xs">
            <div className="text-slate-400">Assigned Mission:</div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
              Publish live announcement banner on e-commerce homepage warning shoppers about delivery times.
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Target: Demo Storefront</span>
            <span className="text-amber-400">Live Config</span>
          </div>
        </div>
      </div>

      {/* Live Execution Logs Terminal */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 font-mono text-xs shadow-inner">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-slate-400">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>Agent Orchestration Execution Log</span>
          </div>
          <span>Status: {executions.length > 0 ? "Completed" : "Ready"}</span>
        </div>

        <div className="mt-3 space-y-2 max-h-56 overflow-y-auto">
          {executions.length === 0 ? (
            <div className="text-slate-500 italic py-4 text-center">
              Awaiting plan approval & authorization. Click &quot;Run All Approved Missions&quot; to begin.
            </div>
          ) : (
            executions.map((exec) => (
              <div key={exec.executionId} className="flex items-start gap-2.5 text-slate-300">
                <span className="text-emerald-400 font-bold">✔</span>
                <span className="text-slate-500">[{exec.finishedAt?.substring(11, 19)}]</span>
                <span className="text-sky-300 font-semibold">{exec.toolName}</span>
                <span className="text-slate-400">idempotencyKey: {exec.idempotencyKey}</span>
                <span className="text-emerald-300">— {exec.result?.verification}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
