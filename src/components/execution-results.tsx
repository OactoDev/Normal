"use client";
import type { PlanHandoffT, PlanOutcomeT } from "../contracts";
import type { ExecutionSnapshot } from "../hooks/use-plan-executions";
import { agentDisplayName } from "../agents/roles";
import { money, clock, duration } from "../lib/format";
type EmailResult = { key: string; orderId: string; to: string; provider: string; providerOperationId?: string; status: string; previewUrl?: string; modelUsed: string; body: string; subject?: string };
type BannerReadBack = { bannerId: string; message: string; active: boolean; startsAt: string; expiresAt: string; publishedAt: string };
type CampaignReadBack = { campaignId: string; name: string; dailyBudgetMinor: number; currency: string; updatedAt: string };
const SENT = ["accepted", "delivered"];
const PILL: Record<string, string> = { verified: "bg-emerald-100 text-emerald-800", monitoring: "bg-blue-100 text-blue-700", not_verified: "bg-red-100 text-red-700", unknown: "bg-slate-100 text-slate-600" };

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{value}</p><p className="text-xs text-slate-500">{note}</p></div>;
}

const VERDICT: Record<PlanOutcomeT["verdict"], [string, string]> = {
  pending: ["Waiting for the run to finish", "bg-slate-100 text-slate-600"],
  measuring: ["Measuring", "bg-blue-100 text-blue-700"],
  resolved: ["Resolved", "bg-emerald-100 text-emerald-800"],
  partially_resolved: ["Partly resolved", "bg-amber-100 text-amber-800"],
  not_resolved: ["Not resolved", "bg-red-100 text-red-700"],
  inconclusive: ["Inconclusive", "bg-slate-100 text-slate-600"],
};
const LABEL: Record<string, string> = { cac_minor: "Customer acquisition cost", ad_spend_minor: "Ad spend per 15 min", late_delivery_rate: "Late deliveries per 15 min", support_tickets: "Support tickets per 15 min", negative_reviews: "1–2 star reviews per 15 min", checkout_failures: "Checkout failures per 15 min" };
const value = (metric: string, n: number | null) => n === null ? "—" : metric.endsWith("_minor") ? money(Math.round(n), "GBP") : String(n);

/** Before/after business metrics for the whole plan, judged against its success criteria. */
function MeasuredOutcome({ outcome }: { outcome: PlanOutcomeT }) {
  const [label, pill] = VERDICT[outcome.verdict];
  const minutes = (Date.parse(outcome.after?.periodEnd ?? "") - Date.parse(outcome.after?.periodStart ?? "")) / 60000;
  return <section data-testid="plan-outcome" className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><p className="text-xs uppercase tracking-wide text-slate-400">Measured outcome · did it fix the problem?</p><h3 className="font-semibold">{outcome.after ? `Business metrics, hour before vs ${minutes} simulated minutes after` : "Business metrics before and after execution"}</h3></div>
      <span data-testid="plan-outcome-verdict" className={`rounded-full px-2 py-0.5 text-xs font-medium ${pill}`}>{label}</span>
    </div>
    {outcome.criteria.length > 0 && <table className="w-full text-sm"><thead className="text-left text-xs text-slate-500"><tr><th className="py-1 font-medium">Success criterion</th><th className="font-medium">Before</th><th className="font-medium">After</th><th className="font-medium">Change</th><th className="font-medium">Result</th></tr></thead>
      <tbody className="tabular-nums">{outcome.criteria.map(c => <tr key={c.metric} className="border-t border-slate-100">
        <td className="py-1.5">{LABEL[c.metric] ?? c.metric} <span className="text-xs text-slate-400">({c.direction})</span></td>
        <td>{value(c.metric, c.before)}</td><td>{value(c.metric, c.after)}</td>
        <td>{c.changePercent === null ? "—" : `${c.changePercent > 0 ? "+" : ""}${c.changePercent}%`}</td>
        <td className={c.result === "met" ? "text-emerald-700" : c.result === "not_met" ? "text-red-600" : "text-slate-400"}>{c.result === "met" ? "Met" : c.result === "not_met" ? "Not met" : "No data"}</td>
      </tr>)}</tbody></table>}
    <p className="text-sm text-slate-600">{outcome.summary}</p>
    <p className="text-[11px] text-slate-500">Measured from the store simulator&apos;s event stream (scenario {outcome.scenario}), not taken from the plan. Diagnosed cause <b>{outcome.diagnosedCause}</b>{outcome.diagnosisMubitRequestId && <> · diagnosis {outcome.diagnosisMubitRequestId}</>}. {["resolved", "partially_resolved", "not_resolved"].includes(outcome.verdict) ? "This result is sent with the next Mubit diagnosis call." : ""}</p>
  </section>;
}

export function ExecutionResults({handoff,data}:{handoff:PlanHandoffT|null;data:ExecutionSnapshot|null}) {
  const version = handoff?.plan.planVersion, executions = (data?.executions ?? []).filter(e => version === undefined || e.planVersion === version);
  if (!data || !executions.length) return <section className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center"><h3 className="text-lg font-semibold">No verified results yet</h3><p className="text-sm text-slate-500 mt-1">Results only show effects the agents read back from the store, ad platform and email provider after an approved run.</p></section>;
  const detailFor = (executionId: string) => data.details.find(d => d.executionId === executionId)?.payload;
  const succeeded = executions.filter(e => e.status === "succeeded");
  // Every figure below is read back from the tools' persisted results, never taken from the plan.
  const budgetRuns = succeeded.filter(e => e.toolName === "ads.set_daily_budget").map(e => detailFor(e.executionId)).filter(Boolean);
  const saved = budgetRuns.reduce((sum, p) => sum + Math.max(0, Number(p.previousBudgetMinor) - Number(p.newBudgetMinor)), 0), currency = String(budgetRuns[0]?.currency ?? "GBP");
  const notified = new Set((data.emailSends ?? []).filter(s => executions.some(e => e.actionId === s.actionId) && SENT.includes(s.status)).map(s => s.orderId));
  const banners = succeeded.filter(e => e.toolName === "storefront.publish_banner").map(e => detailFor(e.executionId)?.readBack as BannerReadBack | undefined).filter(Boolean);
  const live = banners.filter(b => b.active && Date.parse(b.startsAt) <= Date.now() && Date.parse(b.expiresAt) > Date.now());
  const first = executions.map(e => e.startedAt).filter(Boolean).sort()[0], last = executions.map(e => e.finishedAt).filter(Boolean).sort().at(-1);

  return <div className="space-y-6">
    <section className="space-y-1"><p className="text-xs uppercase tracking-wide text-slate-400">Execution results · verified effects only</p><h2 className="text-xl font-bold">{succeeded.length === executions.length ? "Recovery strategy carried out" : `${succeeded.length} of ${executions.length} actions verified`}</h2>{first && last && <p className="text-sm text-slate-500">{new Set(executions.map(e => e.missionId)).size} specialist agents · {clock(first)} → {clock(last)} · {duration(first, last)} end to end</p>}</section>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Kpi label="Actions verified" value={`${succeeded.length}/${executions.length}`} note="Confirmed by tool read-back" />
      <Kpi label="Ad spend saved" value={budgetRuns.length ? `${money(saved, currency)}/day` : "—"} note={budgetRuns.length ? "Budget read back from Ads Manager" : "No verified budget change"} />
      <Kpi label="Customers notified" value={String(notified.size)} note="Accepted by the email provider" />
      <Kpi label="Store notice" value={live.length ? "Live" : banners.length ? "Scheduled" : "—"} note={banners.length ? `Read back from the storefront` : "No verified banner"} />
    </div>

    {data.planOutcome && <MeasuredOutcome outcome={data.planOutcome} />}

    {executions.map(execution => {
      const p = detailFor(execution.executionId), outcome = data.outcomes.find(o => o.executionId === execution.executionId);
      const action = handoff?.plan.actions.find(a => a.actionId === execution.actionId), agent = action ? agentDisplayName(action.agent) : execution.missionId.split(":").at(-1);
      return <section key={execution.executionId} className={`bg-white border rounded-xl p-5 space-y-4 ${execution.status === "succeeded" ? "border-slate-200" : "border-red-200"}`}>
        <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-semibold text-slate-500">{agent}</p><h3 className="font-semibold">{action?.title ?? execution.actionId}</h3><p className="font-mono text-[11px] text-slate-400">{execution.toolName} · {execution.attempts} attempt{execution.attempts === 1 ? "" : "s"}{execution.startedAt && ` · ${duration(execution.startedAt, execution.finishedAt)}`}</p></div>{outcome && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PILL[outcome.status]}`}>{outcome.status.replace("_", " ")}</span>}</div>
        {outcome && <p className="text-sm text-slate-600">{outcome.summary}</p>}
        {execution.error && <p className="text-sm text-red-600">{execution.error.code}: {execution.error.message}. No state change was verified for this action.</p>}

        {p?.previousBudgetMinor !== undefined && (() => { const rb = p.readBack as CampaignReadBack | undefined, c = String(p.currency); return <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg bg-slate-50 p-4">
          <div><p className="text-xs text-slate-500">{rb?.name ?? String(p.campaignId)} · daily budget</p><p className="text-3xl font-bold tabular-nums"><span className="text-slate-400 line-through decoration-2">{money(Number(p.previousBudgetMinor), c)}</span> <span className="text-slate-400">→</span> {money(Number(p.newBudgetMinor), c)}<span className="text-base font-normal text-slate-500">/day</span></p></div>
          <div className="text-right text-xs text-slate-500"><p className="text-sm font-medium text-emerald-700">{Number(p.newBudgetMinor) < Number(p.previousBudgetMinor) ? `−${money(Number(p.previousBudgetMinor) - Number(p.newBudgetMinor), c)}/day` : `+${money(Number(p.newBudgetMinor) - Number(p.previousBudgetMinor), c)}/day`}</p>{rb && <p>Read back {money(rb.dailyBudgetMinor, rb.currency)}/day at {clock(rb.updatedAt)}</p>}<a className="text-blue-600 hover:underline" href="/ads">Open Ads Manager ↗</a></div>
        </div>; })()}

        {Array.isArray(p?.emails) && <div className="grid md:grid-cols-2 gap-3">{(p.emails as EmailResult[]).map(original => { const e = (data.emailSends?.find(s => s.key === original.key) || original) as EmailResult; return <article key={e.key} className="rounded-lg bg-slate-50 p-4 space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2"><p className="font-medium">{e.orderId}</p><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${SENT.includes(e.status) ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>{e.status}</span></div>
          <p className="text-xs text-slate-500">To {e.to} (controlled test inbox) · {e.provider}{e.providerOperationId && ` · ${e.providerOperationId}`}</p>
          <p className="text-xs text-slate-500">Personalised paragraph drafted by {e.modelUsed}</p>
          <details className="text-xs"><summary className="cursor-pointer text-blue-700">Read the email</summary><p className="whitespace-pre-line mt-2 text-slate-700">{e.body}</p></details>
          {e.previewUrl && <a className="text-xs text-blue-600 hover:underline" target="_blank" rel="noreferrer" href={e.previewUrl}>Open Ethereal preview ↗</a>}
          <p className="text-[11px] text-slate-400">{e.status === "delivered" ? `${e.provider} reported this message delivered.` : "Accepted is not proof of inbox delivery; re-checked with the provider."}</p>
        </article>; })}</div>}

        {(() => { const b = p?.readBack as BannerReadBack | undefined; if (!b || execution.toolName !== "storefront.publish_banner") return null; return <div className="space-y-2">
          <div className="overflow-hidden rounded-lg border border-stone-200"><div className="bg-stone-100 px-3 py-1 text-[11px] text-stone-500">Store preview · read back from the storefront</div><div className="bg-amber-200 p-3 text-center text-sm font-semibold text-stone-900">{b.message}</div></div>
          <p className="text-xs text-slate-500">{b.active ? "Active" : "Inactive"} · shows {new Date(b.startsAt).toLocaleString("en-GB")} → {new Date(b.expiresAt).toLocaleString("en-GB")} · published {clock(b.publishedAt)} · <a href="/store" className="text-blue-600 hover:underline">Open store ↗</a></p>
        </div>; })()}
      </section>;
    })}
  </div>;
}
