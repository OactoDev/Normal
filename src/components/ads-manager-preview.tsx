"use client";

import React from "react";
import { Megaphone, CheckCircle2, TrendingDown, DollarSign, BarChart3 } from "lucide-react";

interface AdsManagerPreviewProps {
  campaignBudgetMinor: number;
}

export function AdsManagerPreview({ campaignBudgetMinor }: AdsManagerPreviewProps) {
  const currentBudgetPounds = (campaignBudgetMinor / 100).toFixed(2);
  const wasReduced = campaignBudgetMinor < 5000;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      {/* Platform Header */}
      <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-indigo-600 flex items-center justify-center font-bold text-[10px] text-white">
            M
          </div>
          <span className="text-slate-300 font-medium">Meta Ads Manager · Account: act_nova_london</span>
        </div>
        <div className="flex items-center gap-2 text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>API Connected & Synced</span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Campaign Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-sm font-bold text-white">Campaign A — Q4 UK Conversion Growth</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                campaign_A
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Objective: Catalog Sales · Audience: UK Lookalike 2% · Bid Strategy: Lowest Cost
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Active Delivery
            </span>
          </div>
        </div>

        {/* Budget & Performance KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Daily Budget</span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-emerald-400">£{currentBudgetPounds}</span>
              {wasReduced && (
                <span className="text-xs text-slate-500 line-through font-mono">£50.00</span>
              )}
            </div>
            <span className="text-[10px] text-emerald-400/90 font-mono block">
              {wasReduced ? "Controlled by Marketing Agent" : "Baseline Configuration"}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">CAC (Last 24h)</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono text-white">£34.80</span>
              <span className="text-[10px] text-amber-400 font-mono">↑ 91%</span>
            </div>
            <span className="text-[10px] text-slate-500 block">Baseline: £18.20</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">ROAS</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono text-white">2.1x</span>
              <span className="text-[10px] text-slate-500 font-mono">Target: 2.8x</span>
            </div>
            <span className="text-[10px] text-slate-500 block">Catalog Match Rate: 98%</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Ad Frequency</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono text-amber-400">3.8</span>
              <span className="text-[10px] text-amber-400 font-mono">Fatigued</span>
            </div>
            <span className="text-[10px] text-slate-500 block">Threshold: &lt; 2.5</span>
          </div>
        </div>

        {/* Read-Back Verification Audit Note */}
        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs font-mono text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-sky-400" />
            Meta Graph API Read-Back Verified: daily_budget = {campaignBudgetMinor} minor units
          </span>
          <span className="text-slate-500">HTTP 200 OK</span>
        </div>
      </div>
    </div>
  );
}
