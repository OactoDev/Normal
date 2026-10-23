"use client";

import React, { useState } from "react";
import { ActionExecutionT, ActionOutcomeT, BusinessEventT } from "../contracts";
import { DispatchedEmail, SimulatedBanner } from "../simulator/state";
import { StorefrontPreview } from "./storefront-preview";
import { AdsManagerPreview } from "./ads-manager-preview";
import {
  TrendingDown,
  Mail,
  Store,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  Inbox,
  User,
  Clock,
  ArrowRight,
  BarChart2,
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
  const [selectedEmail, setSelectedEmail] = useState<DispatchedEmail | null>(
    emails.length > 0 ? emails[0] : null
  );
  const [activeView, setActiveView] = useState<"all" | "storefront" | "ads" | "emails">("all");

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
      {/* View Switcher Sub-nav */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Verified Operational Impact
          </span>
          <span className="text-xs font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30">
            3 Systems Mutated
          </span>
        </div>
        <div className="flex gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-lg text-xs font-medium">
          <button
            onClick={() => setActiveView("all")}
            className={`px-3 py-1 rounded-md transition ${
              activeView === "all" ? "bg-sky-500 text-slate-950 font-semibold" : "text-slate-400 hover:text-white"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveView("storefront")}
            className={`px-3 py-1 rounded-md transition ${
              activeView === "storefront" ? "bg-sky-500 text-slate-950 font-semibold" : "text-slate-400 hover:text-white"
            }`}
          >
            Storefront
          </button>
          <button
            onClick={() => setActiveView("ads")}
            className={`px-3 py-1 rounded-md transition ${
              activeView === "ads" ? "bg-sky-500 text-slate-950 font-semibold" : "text-slate-400 hover:text-white"
            }`}
          >
            Meta Ads
          </button>
          <button
            onClick={() => setActiveView("emails")}
            className={`px-3 py-1 rounded-md transition ${
              activeView === "emails" ? "bg-sky-500 text-slate-950 font-semibold" : "text-slate-400 hover:text-white"
            }`}
          >
            Customer Inboxes
          </button>
        </div>
      </div>

      {/* 3 Real-World Impact Cards */}
      {(activeView === "all" || activeView === "ads") && (
        <AdsManagerPreview campaignBudgetMinor={campaignBudgetMinor} />
      )}

      {(activeView === "all" || activeView === "storefront") && (
        <StorefrontPreview banner={banner} />
      )}

      {/* Customer Care Dispatched Email Reader */}
      {(activeView === "all" || activeView === "emails") && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <div className="flex items-center gap-2">
              <Inbox className="w-4 h-4 text-sky-400" />
              <span className="text-slate-300 font-medium">Customer Care Dispatcher · Mubit LLM Inbox</span>
            </div>
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {emails.length} Dispatched
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800">
            {/* List of Affected Orders / Recipients */}
            <div className="p-3 space-y-2 bg-slate-950/40">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-2 block">
                Targeted Recipients ({emails.length})
              </span>
              {emails.map((email) => (
                <div
                  key={email.messageId}
                  onClick={() => setSelectedEmail(email)}
                  className={`p-3 rounded-lg cursor-pointer transition text-xs space-y-1 ${
                    selectedEmail?.messageId === email.messageId
                      ? "bg-slate-800 border border-sky-500/50"
                      : "bg-slate-900/60 border border-slate-800 hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                    <span className="text-sky-400 font-semibold">{email.orderId}</span>
                    <span>{new Date(email.sentAt).toLocaleTimeString()}</span>
                  </div>
                  <div className="font-semibold text-slate-200 truncate">{email.to}</div>
                  <div className="text-[11px] text-slate-400 truncate">{email.subject}</div>
                </div>
              ))}
            </div>

            {/* Email Message Detail Viewer */}
            <div className="md:col-span-2 p-5 space-y-4">
              {selectedEmail ? (
                <>
                  <div className="border-b border-slate-800 pb-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white">{selectedEmail.subject}</h4>
                      <span className="text-xs px-2 py-0.5 rounded font-mono bg-sky-950 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-sky-400" /> {selectedEmail.modelUsed}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 font-mono">
                      <span>To: <strong className="text-slate-200">{selectedEmail.to}</strong></span>
                      <span>Order: <strong className="text-slate-200">{selectedEmail.orderId}</strong></span>
                      <span className="text-sky-400">trace: {selectedEmail.mubitRequestId}</span>
                    </div>
                  </div>

                  <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-4 text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-line shadow-inner">
                    {selectedEmail.body}
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1">
                    <span>Delivered via SendGrid / Resend Webhook</span>
                    <span className="text-emerald-400">HTTP 202 Accepted</span>
                  </div>
                </>
              ) : (
                <div className="text-center py-10 text-xs text-slate-500">
                  Select an email on the left to inspect the Mubit-generated copy.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Emitted Business Events Stream (Closing the Normal feedback loop) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Emitted Business Telemetry Stream (Ingestion Feedback Loop)
          </h4>
          <span className="text-xs font-mono text-slate-500">
            Total Emitted: {events.length}
          </span>
        </div>
        <div className="space-y-2">
          {events.slice(-4).map((evt) => (
            <div
              key={evt.eventId}
              className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono"
            >
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded text-[11px] bg-sky-950 text-sky-400 border border-sky-500/30 font-semibold">
                  {evt.type}
                </span>
                <span className="text-slate-400">source: {evt.source}</span>
                <span className="text-slate-500">id: {evt.eventId}</span>
              </div>
              <span className="text-slate-400">[{evt.occurredAt.substring(11, 19)}]</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
