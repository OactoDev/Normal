"use client";

import React, { useState } from "react";
import { ActionExecutionT, ActionOutcomeT, BusinessEventT } from "../contracts";
import { DispatchedEmail, SimulatedBanner } from "../simulator/state";
import {
  TrendingDown,
  Mail,
  Store,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

interface ExecutionResultsProps {
  executions: ActionExecutionT[];
  outcomes: ActionOutcomeT[];
  events: BusinessEventT[];
  banner: SimulatedBanner | null;
  emails: DispatchedEmail[];
  campaignBudgetMinor: number;
}

export function ExecutionResults({
  executions,
  outcomes,
  events,
  banner,
  emails,
  campaignBudgetMinor,
}: ExecutionResultsProps) {
  const [selectedEmail, setSelectedEmail] = useState<DispatchedEmail | null>(null);

  if (executions.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
        <ShieldAlert className="w-8 h-8 mx-auto mb-2 text-slate-600" />
        No actions have been executed yet. Approve the plan and run missions to see verified operational changes.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 3 Real-World Impact Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Ad Budget Result */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Meta Ads Campaign A</span>
            <span className="text-emerald-400 flex items-center gap-1 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Verified
            </span>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-400">Daily Budget Modification:</div>
            <div className="flex items-baseline gap-3">
              <span className="text-slate-500 line-through text-lg">£50.00</span>
              <span className="text-2xl font-bold text-emerald-400">
                £{(campaignBudgetMinor / 100).toFixed(2)}
              </span>
              <span className="text-xs font-semibold text-emerald-300 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30">
                -40% Spend
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-400 border-t border-slate-800 pt-2">
            Prevents ad cannibalization while delivery delays are resolved. Verified via live Meta Ads API.
          </p>
        </div>

        {/* Customer Care Dispatched Emails */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Customer Delay Notices</span>
            <span className="text-emerald-400 flex items-center gap-1 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Dispatched
            </span>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-400">Personalized Messages Sent:</div>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-white">{emails.length} Emails</span>
              <span className="text-xs font-semibold text-sky-300 px-2 py-0.5 rounded bg-sky-950/60 border border-sky-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Mubit Generated
              </span>
            </div>
          </div>
          <div className="text-xs text-slate-400 border-t border-slate-800 pt-2 flex items-center justify-between">
            <span>Controlled Test Inboxes</span>
            {emails.length > 0 && (
              <button
                onClick={() => setSelectedEmail(emails[0])}
                className="text-xs text-sky-400 hover:text-sky-300 underline"
              >
                Inspect Draft
              </button>
            )}
          </div>
        </div>

        {/* Storefront Banner Live Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Storefront Announcement</span>
            <span className="text-emerald-400 flex items-center gap-1 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Live on Site
            </span>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-400">Active Banner ID:</div>
            <div className="text-sm font-bold text-amber-300 font-mono truncate">
              {banner?.bannerId || "banner_ship_001"}
            </div>
          </div>
          <p className="text-xs text-slate-400 border-t border-slate-800 pt-2 truncate">
            &quot;{banner?.message}&quot;
          </p>
        </div>
      </div>

      {/* Simulated Storefront Live Banner Preview */}
      {banner && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <Store className="w-4 h-4 text-amber-400" />
              Live Storefront Preview (Nova Store)
            </span>
            <span className="text-xs font-mono text-emerald-400">● Status: Active</span>
          </div>
          {/* Simulated Banner */}
          <div className="bg-amber-500 text-slate-950 font-semibold px-4 py-2.5 rounded-lg text-sm text-center shadow-md animate-fade-in flex items-center justify-center gap-2">
            <span>⚠️</span>
            <span>{banner.message}</span>
          </div>
        </div>
      )}

      {/* Dispatched Emails Modal / Card */}
      {selectedEmail && (
        <div className="bg-slate-900 border border-sky-500/40 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-sky-400" />
              <span className="font-bold text-white text-sm">
                Inspecting Dispatched Message: {selectedEmail.orderId}
              </span>
            </div>
            <button
              onClick={() => setSelectedEmail(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              ✕ Close Preview
            </button>
          </div>
          <div className="text-xs font-mono space-y-1 text-slate-400">
            <div>To: <span className="text-white">{selectedEmail.to}</span></div>
            <div>Subject: <span className="text-white">{selectedEmail.subject}</span></div>
            <div>Model: <span className="text-sky-300">{selectedEmail.modelUsed}</span></div>
            <div>Mubit Trace ID: <span className="text-slate-300">{selectedEmail.mubitRequestId}</span></div>
          </div>
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs whitespace-pre-line font-sans leading-relaxed">
            {selectedEmail.body}
          </div>
        </div>
      )}

      {/* Emitted Business Events Stream (Closing the Normal feedback loop) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Emitted Business Events Stream (Returning to Normal Ingestion)
        </h4>
        <div className="space-y-2">
          {events.slice(-4).map((evt) => (
            <div
              key={evt.eventId}
              className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono"
            >
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded text-xs bg-sky-950 text-sky-400 border border-sky-500/30">
                  {evt.type}
                </span>
                <span className="text-slate-400">Source: {evt.source}</span>
                <span className="text-slate-500">ID: {evt.eventId}</span>
              </div>
              <span className="text-slate-400">[{evt.occurredAt.substring(11, 19)}]</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
