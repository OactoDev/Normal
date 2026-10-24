"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { money, num, pct, virtualDate } from "@/lib/format";
import { api, q } from "./api";
import { useRun } from "./run-context";

interface Campaign {
  campaignId: string; name: string; platform: string; status: string; dailyBudgetMinor: number; currency: string;
  targetCategory: string; targetProductIds: string[]; updatedAt: string;
}
interface Snapshot {
  snapshotId: string; window: { startAt: string; endAt: string };
  counters: { impressions: number; clicks: number; adSpendMinor: number; attributedOrders: number; attributedRevenueMinor: number };
}
interface CampaignAction {
  actionId: string; toolName: string; recordedAt: string; verification: string; agent: string | null; title: string | null;
  planId: string | null; previousDailyBudgetMinor: number | null; newDailyBudgetMinor: number | null;
}
interface CampaignWorkspaceData {
  simulationRunId: string; window: { startAt: string; endAt: string }; campaign: Campaign; campaigns: Campaign[];
  performance: { impressions: number; clicks: number; spendMinor: number; attributedOrders: number; attributedRevenueMinor: number; ctr: number | null; costPerAcquisitionMinor: number | null; roas: number | null } | null;
  daily: Snapshot[]; actions: CampaignAction[];
}

function campaignPlatform(platform: string) {
  return platform === "meta_ads" ? "Meta" : platform === "google_ads" ? "Google" : platform.replaceAll("_", " ");
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return <article className="meta-stat"><small>{label}</small><strong>{value}</strong>{note ? <span>{note}</span> : null}</article>;
}

export function CampaignWorkspace({ campaignId }: { campaignId: string }) {
  const { runId, loaded, withRun } = useRun();
  const [resource, setResource] = useState<{ key: string; data: CampaignWorkspaceData | null; error: string | null } | null>(null);
  const key = runId ? `${runId}:${campaignId}` : "";
  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    void api<CampaignWorkspaceData>(`/api/dev/simulator/campaigns/${encodeURIComponent(campaignId)}?${q({ simulationRunId: runId })}`)
      .then((data) => { if (!cancelled) setResource({ key, data, error: null }); })
      .catch((error: unknown) => { if (!cancelled) setResource({ key, data: null, error: error instanceof Error ? error.message : "Could not load campaign" }); });
    return () => { cancelled = true; };
  }, [runId, campaignId, key]);
  const data = resource?.key === key ? resource.data : null;
  const error = resource?.key === key ? resource.error : null;

  if (!loaded || (!data && !error)) return <div className="campaign-workspace-loading">Loading campaign data…</div>;
  if (error) return <div className="alert error">{error}</div>;
  if (!data) return <div className="campaign-workspace-empty">Select a simulation run to open its campaigns.</div>;

  const { campaign, performance } = data;
  const maxSpend = Math.max(1, ...data.daily.map((day) => day.counters.adSpendMinor));
  const title = campaign.name || campaign.campaignId;
  return <section className="meta-campaign-workspace" data-testid="campaign-workspace">
    <div className="meta-manager-bar"><div className="meta-manager-brand"><span className="meta-manager-mark" aria-hidden="true">M</span><strong>Ads Manager</strong><span className="meta-demo-tag">SIMULATION</span></div><div className="meta-manager-context"><span>Nike · Demo account</span><span>Run {data.simulationRunId}</span></div></div>
    <div className="meta-manager-body">
      <aside className="meta-campaign-sidebar">
        <div className="meta-sidebar-title"><small>CAMPAIGNS</small><span>{data.campaigns.length}</span></div>
        <nav aria-label="Campaigns in selected run">{data.campaigns.map((item) => <Link key={item.campaignId} href={withRun(`/dashboard/campaigns/${encodeURIComponent(item.campaignId)}`)} className={`meta-campaign-nav-item${item.campaignId === campaignId ? " selected" : ""}`} aria-current={item.campaignId === campaignId ? "page" : undefined}><span className={`meta-status-dot ${item.status === "active" ? "active" : "paused"}`} /><span><strong>{item.name || item.campaignId}</strong><small>{item.status === "active" ? "Active" : "Paused"} · {campaignPlatform(item.platform)}</small></span></Link>)}</nav>
        <Link className="meta-back-link" href={withRun("/dashboard")}>← Back to overview</Link>
      </aside>
      <div className="meta-campaign-content">
        <div className="meta-breadcrumb"><Link href={withRun("/dashboard")}>Overview</Link><span>/</span><span>Campaigns</span><span>/</span><strong>{title}</strong></div>
        <section className="meta-campaign-heading" id="overview"><div><div className="meta-campaign-kicker">{campaignPlatform(campaign.platform)} campaign</div><h1>{title}</h1><p>{campaign.targetCategory || "All categories"} audience · Updated {virtualDate(campaign.updatedAt)}</p></div><span className={`meta-delivery-badge ${campaign.status === "active" ? "active" : "paused"}`}><i />{campaign.status === "active" ? "Active" : "Paused"}</span></section>
        <nav className="meta-campaign-tabs" aria-label="Campaign sections"><a href="#overview">Overview</a><a href="#performance">Performance</a><a href="#activity">Activity</a></nav>
        <div className="meta-summary-strip" aria-label="Campaign configuration"><span><small>Daily budget</small><strong>{money(campaign.dailyBudgetMinor, campaign.currency)}</strong></span><span><small>Delivery</small><strong>{campaign.status === "active" ? "On" : "Off"}</strong></span><span><small>Target</small><strong>{campaign.targetCategory || "All categories"}</strong></span><span><small>Measurement</small><strong>Last 30 days</strong></span></div>
        <section id="performance" className="meta-performance-section"><div className="meta-section-heading"><div><h2>Performance</h2><p>Results from canonical campaign events in this run.</p></div><span>30 days · {data.window.startAt.slice(0, 10)} – {data.window.endAt.slice(0, 10)}</span></div>
          <div className="meta-stats-grid">
            <Stat label="Amount spent" value={money(performance?.spendMinor ?? 0)} note="Campaign delivery" />
            <Stat label="Impressions" value={num(performance?.impressions ?? 0)} />
            <Stat label="Clicks" value={num(performance?.clicks ?? 0)} note={performance?.ctr === null || !performance ? "CTR —" : `CTR ${pct(performance.ctr, 2)}`} />
            <Stat label="Attributed orders" value={num(performance?.attributedOrders ?? 0)} note="Reported conversions" />
            <Stat label="Attributed revenue" value={money(performance?.attributedRevenueMinor ?? 0)} />
            <Stat label="Return on ad spend" value={performance?.roas == null ? "—" : `${performance.roas.toFixed(2)}×`} note={performance?.costPerAcquisitionMinor == null ? "CPA —" : `CPA ${money(performance.costPerAcquisitionMinor)}`} />
          </div>
          <article className="meta-performance-chart"><div className="meta-chart-heading"><h3>Daily spend</h3><span>GBP · per day</span></div>
            {data.daily.length && data.daily.some((day) => day.counters.adSpendMinor > 0) ? <div className="meta-spend-chart" role="img" aria-label="Daily campaign spend from canonical campaign events">{data.daily.map((day) => <div className="meta-spend-column" key={day.snapshotId} title={`${day.window.startAt.slice(0, 10)} · ${money(day.counters.adSpendMinor)}`}><span style={{ height: `${Math.max(day.counters.adSpendMinor > 0 ? 3 : 0, day.counters.adSpendMinor / maxSpend * 100)}%` }} /><small>{new Date(day.window.startAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}</small></div>)}</div> : <div className="meta-no-data">No delivery spend was recorded for this campaign in the selected period.</div>}
          </article>
        </section>
        <section id="activity" className="meta-actions-section"><div className="meta-section-heading"><div><h2>Agent actions</h2><p>Budget changes recorded by the adapter for this campaign.</p></div><span>{data.actions.length} recorded</span></div>
          {data.actions.length ? <div className="meta-action-list">{data.actions.map((action) => <article className="meta-action-row" key={action.actionId}><span className={`meta-action-icon${action.newDailyBudgetMinor === 0 ? " paused" : ""}`}>{action.newDailyBudgetMinor === 0 ? "Ⅱ" : "↗"}</span><div className="meta-action-copy"><strong>{action.newDailyBudgetMinor === 0 ? "Paused campaign" : action.title ?? "Updated daily budget"}</strong><p>{action.agent ? `${action.agent.replaceAll("_", " ")} agent` : action.toolName} · {money(action.previousDailyBudgetMinor)} → {money(action.newDailyBudgetMinor)}/day</p><small>{action.verification}{action.planId ? ` · Plan ${action.planId}` : ""}</small></div><time>{virtualDate(action.recordedAt)}</time></article>)}</div> : <div className="meta-no-actions">No agent budget changes have been recorded for this campaign.</div>}
        </section>
      </div>
    </div>
  </section>;
}
