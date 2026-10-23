"use client";

import React, { useState } from "react";
import { ProposedPlanT, ActionProposalT } from "../contracts";
import {
  TrendingDown,
  Megaphone,
  Mail,
  Store,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

interface PlanReviewProps {
  plan: ProposedPlanT;
  onApprove: (approvedActionIds: string[]) => Promise<void>;
  isApproving: boolean;
}

export function PlanReview({ plan, onApprove, isApproving }: PlanReviewProps) {
  const [selectedActionIds, setSelectedActionIds] = useState<string[]>(
    plan.actions.map((a) => a.actionId)
  );

  const toggleAction = (id: string) => {
    if (selectedActionIds.includes(id)) {
      setSelectedActionIds(selectedActionIds.filter((item) => item !== id));
    } else {
      setSelectedActionIds([...selectedActionIds, id]);
    }
  };

  const selectAll = () => {
    setSelectedActionIds(plan.actions.map((a) => a.actionId));
  };

  const getAgentIcon = (agent: string) => {
    switch (agent) {
      case "marketing":
        return <Megaphone className="w-5 h-5 text-indigo-400" />;
      case "customer_care":
        return <Mail className="w-5 h-5 text-emerald-400" />;
      case "storefront":
        return <Store className="w-5 h-5 text-amber-400" />;
      default:
        return <ShieldCheck className="w-5 h-5 text-slate-400" />;
    }
  };

  const getAgentColor = (agent: string) => {
    switch (agent) {
      case "marketing":
        return "border-indigo-500/30 bg-indigo-950/20 text-indigo-300";
      case "customer_care":
        return "border-emerald-500/30 bg-emerald-950/20 text-emerald-300";
      case "storefront":
        return "border-amber-500/30 bg-amber-950/20 text-amber-300";
      default:
        return "border-slate-500/30 bg-slate-900 text-slate-300";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Diagnosis Summary */}
      <div className="bg-gradient-to-r from-red-950/40 via-amber-950/20 to-slate-900 border border-red-500/30 rounded-xl p-5 shadow-lg">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Anomaly Investigation
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Store: {plan.businessId} · Plan: {plan.planId} (v{plan.planVersion})
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {plan.objective}
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl">{plan.summary}</p>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-xs text-slate-400 uppercase tracking-wider">
              Expires In
            </div>
            <div className="text-sm font-mono font-medium text-amber-300">
              47h 58m
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Flowchart Diagram */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 shadow-md">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
          <span>Operational Recovery Flowchart</span>
          <span className="text-xs font-normal text-slate-500">
            (Independent parallel execution waves)
          </span>
        </h3>

        <div className="relative py-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            {/* Root Cause Node */}
            <div className="bg-slate-800/80 border-2 border-red-500/40 rounded-xl p-4 text-center shadow-md">
              <div className="text-xs font-semibold text-red-400 uppercase">
                Detected Root Cause
              </div>
              <div className="text-base font-bold text-white mt-1">
                3PL Delivery Bottleneck
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Margin collapse + High ad waste
              </div>
            </div>

            {/* Actions Flowing from Root */}
            {plan.actions.map((action, idx) => (
              <div
                key={action.actionId}
                className={`border rounded-xl p-4 transition-all relative ${
                  selectedActionIds.includes(action.actionId)
                    ? "border-sky-500/50 bg-slate-800/90 shadow-sky-950/40 shadow-lg"
                    : "border-slate-800 bg-slate-900/40 opacity-50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium border ${getAgentColor(
                      action.agent
                    )}`}
                  >
                    {action.agent}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Wave 1
                  </span>
                </div>
                <div className="font-semibold text-slate-100 text-sm">
                  {action.title}
                </div>
                <div className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {action.rationale}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action Selection Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">
            Review Proposed Interventions ({selectedActionIds.length}/
            {plan.actions.length} Selected)
          </h3>
          <button
            onClick={selectAll}
            className="text-xs text-sky-400 hover:text-sky-300 font-medium"
          >
            Select All Actions
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {plan.actions.map((action) => {
            const isSelected = selectedActionIds.includes(action.actionId);
            return (
              <div
                key={action.actionId}
                onClick={() => toggleAction(action.actionId)}
                className={`border rounded-xl p-5 cursor-pointer transition-all flex items-start justify-between gap-4 ${
                  isSelected
                    ? "bg-slate-900/90 border-sky-500/50 shadow-md ring-1 ring-sky-500/30"
                    : "bg-slate-900/40 border-slate-800 opacity-60 hover:opacity-80"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-sky-500 focus:ring-sky-500 focus:ring-offset-slate-900"
                    />
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700">
                    {getAgentIcon(action.agent)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-base">
                        {action.title}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium border ${getAgentColor(
                          action.agent
                        )}`}
                      >
                        {action.agent} agent
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {action.actionType}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300">
                      {action.rationale}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-slate-400 pt-1 font-mono">
                      <span>Risk: {action.risk}</span>
                      <span>Requires Approval: Yes</span>
                      {action.actionType === "ads.set_daily_budget" && (
                        <span className="text-emerald-400">
                          Target Budget: £30.00 / day (Reduced from £50.00)
                        </span>
                      )}
                      {action.actionType === "customer.send_delay_notice" && (
                        <span className="text-sky-400">
                          Personalized via Mubit LLM · 2 delayed customers
                        </span>
                      )}
                      {action.actionType === "storefront.publish_banner" && (
                        <span className="text-amber-400">
                          Live Storefront Alert Banner
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end justify-between self-stretch">
                  <span className="text-xs font-mono text-slate-500">
                    {action.actionId}
                  </span>
                  {isSelected && (
                    <span className="text-xs text-sky-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Approval Submit Action */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-white">
            Permission & Policy Gate
          </div>
          <div className="text-xs text-slate-400">
            Agents will execute state-changing operations across connected Meta
            Ads, email dispatch, and storefront services.
          </div>
        </div>

        <button
          onClick={() => onApprove(selectedActionIds)}
          disabled={selectedActionIds.length === 0 || isApproving}
          className="px-6 py-3 rounded-lg font-bold text-sm bg-sky-500 hover:bg-sky-400 text-slate-950 transition-all shadow-lg shadow-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isApproving ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              Validating Approval...
            </>
          ) : (
            <>
              Approve & Authorize ({selectedActionIds.length} Actions)
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
