import "server-only";

import type { Db, Filter } from "mongodb";
import { z } from "zod";
import { Anomaly, Investigation, MetricName, MetricSnapshot, type AnomalyT, type InvestigationT, type MetricSnapshotT } from "@normal/contracts";
import { COLLECTIONS } from "@/lib/collections";
import { getDb } from "@/lib/mongodb";
import type { FindingDoc, IncidentDoc } from "@/intelligence/detection/persistence";

const BusinessId = z.string().min(1).max(64).regex(/^[a-z0-9_]+$/).default("nike_demo");
const RunId = z.string().min(1).max(64).regex(/^[a-z0-9_]+$/);
const Page = { limit: z.coerce.number().int().min(1).max(100).default(25), offset: z.coerce.number().int().min(0).max(10_000).default(0) };
const IsoTime = z.string().datetime({ offset: true });
const THEMES = ["sales", "traffic", "advertising", "conversion", "fulfilment", "inventory", "reputation", "demand"] as const;

export const AnomalyQuery = z.object({
  businessId: BusinessId, simulationRunId: RunId.optional(),
  status: z.enum(["new", "investigating", "resolved", "dismissed"]).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  metric: MetricName.optional(),
  category: z.enum(THEMES).optional(),
  from: IsoTime.optional(), to: IsoTime.optional(),
  ...Page,
}).strict();

export const InvestigationQuery = z.object({
  businessId: BusinessId, simulationRunId: RunId.optional(),
  status: z.enum(["open", "collecting_evidence", "diagnosing", "awaiting_review", "planned", "closed"]).optional(),
  ...Page,
}).strict();

export const IncidentQuery = z.object({
  businessId: BusinessId, simulationRunId: RunId.optional(),
  status: z.enum(["monitoring", "investigating", "resolved", "merged"]).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  category: z.enum(THEMES).optional(),
  ...Page,
}).strict();

/** Strips storage-envelope fields so API responses carry exactly the canonical schema. */
const canonicalAnomaly = (d: Record<string, unknown>): AnomalyT => { const { simulationRunId: _r, _id: _i, ...rest } = d; void _r; void _i; return Anomaly.parse(rest); };
const canonicalInvestigation = (d: Record<string, unknown>): InvestigationT => { const { simulationRunId: _r, _id: _i, ...rest } = d; void _r; void _i; return Investigation.parse(rest); };
const canonicalSnapshot = (d: Record<string, unknown>): MetricSnapshotT => { const { simulationRunId: _r, _id: _i, ...rest } = d; void _r; void _i; return MetricSnapshot.parse(rest); };

export interface AnomalyListItem {
  anomaly: AnomalyT;
  simulationRunId: string;
  finding: Pick<FindingDoc, "findingId" | "signalId" | "label" | "theme" | "segment" | "segmentLabel" | "polarity" | "reason" | "incidentId" | "onsetAt" | "status"> | null;
}

export async function listAnomalies(input: unknown, dbOverride?: Db) {
  const q = AnomalyQuery.parse(input);
  const db = dbOverride ?? (await getDb());
  const filter: Filter<AnomalyT & { simulationRunId: string }> = { businessId: q.businessId };
  if (q.simulationRunId) filter.simulationRunId = q.simulationRunId;
  if (q.status) filter.status = q.status;
  if (q.severity) filter.severity = q.severity;
  if (q.metric) filter.metric = q.metric;
  if (q.from || q.to) filter.detectedAt = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lt: q.to } : {}) };
  if (q.category) {
    const ids = await db.collection<FindingDoc>(COLLECTIONS.detectionFindings)
      .find({ businessId: q.businessId, ...(q.simulationRunId ? { simulationRunId: q.simulationRunId } : {}), theme: q.category, anomalyId: { $ne: null } }, { projection: { anomalyId: 1 } })
      .limit(5_000).toArray();
    filter.anomalyId = { $in: ids.map((d) => d.anomalyId as string) };
  }
  const col = db.collection<AnomalyT & { simulationRunId: string }>(COLLECTIONS.anomalies);
  const [total, docs] = await Promise.all([
    col.countDocuments(filter),
    col.find(filter, { projection: { _id: 0 } }).sort({ detectedAt: -1, anomalyId: 1 }).skip(q.offset).limit(q.limit).toArray(),
  ]);
  const findings = new Map((await db.collection<FindingDoc>(COLLECTIONS.detectionFindings)
    .find({ businessId: q.businessId, anomalyId: { $in: docs.map((d) => d.anomalyId) } }, { projection: { _id: 0, findingId: 1, anomalyId: 1, signalId: 1, label: 1, theme: 1, segment: 1, segmentLabel: 1, polarity: 1, reason: 1, incidentId: 1, onsetAt: 1, status: 1 } })
    .toArray()).map((f) => [f.anomalyId as string, f]));
  const items: AnomalyListItem[] = docs.map((d) => ({ anomaly: canonicalAnomaly(d), simulationRunId: d.simulationRunId, finding: (findings.get(d.anomalyId) as AnomalyListItem["finding"]) ?? null }));
  return { total, limit: q.limit, offset: q.offset, items };
}

/** Canonical signal detail plus the exact metric snapshots and finding record used by its detector. */
export async function getAnomalyBundle(anomalyId: string, dbOverride?: Db, input: unknown = {}) {
  const scope = z.object({ businessId: BusinessId, simulationRunId: RunId.optional() }).strict().parse(input);
  const db = dbOverride ?? (await getDb());
  const raw = await db.collection(COLLECTIONS.anomalies).findOne({ anomalyId, businessId: scope.businessId,
    ...(scope.simulationRunId ? { simulationRunId: scope.simulationRunId } : {}) }, { projection: { _id: 0 } });
  if (!raw) return null;
  const simulationRunId = raw.simulationRunId as string;
  const anomaly = canonicalAnomaly(raw);
  const [snapshots, finding] = await Promise.all([
    db.collection(COLLECTIONS.metricSnapshots).find({ businessId: scope.businessId, simulationRunId, snapshotId: { $in: anomaly.sourceSnapshotIds } }, { projection: { _id: 0 } }).toArray(),
    db.collection<FindingDoc>(COLLECTIONS.detectionFindings).findOne({ businessId: scope.businessId, simulationRunId, anomalyId }, { projection: { _id: 0, findingId: 1, signalId: 1, label: 1, theme: 1, segment: 1, segmentLabel: 1, reason: 1, evaluation: 1, evidence: 1 } }),
  ]);
  return { anomaly, simulationRunId, snapshots: snapshots.map(canonicalSnapshot).sort((a, b) => a.window.startAt.localeCompare(b.window.startAt)), finding };
}

export async function listInvestigations(input: unknown, dbOverride?: Db) {
  const q = InvestigationQuery.parse(input);
  const db = dbOverride ?? (await getDb());
  const filter: Filter<InvestigationT & { simulationRunId: string }> = { businessId: q.businessId };
  if (q.simulationRunId) filter.simulationRunId = q.simulationRunId;
  if (q.status) filter.status = q.status;
  const col = db.collection<InvestigationT & { simulationRunId: string }>(COLLECTIONS.investigations);
  const [total, docs] = await Promise.all([
    col.countDocuments(filter),
    col.find(filter, { projection: { _id: 0 } }).sort({ startedAt: -1, investigationId: 1 }).skip(q.offset).limit(q.limit).toArray(),
  ]);
  const incidents = new Map((await db.collection<IncidentDoc>(COLLECTIONS.incidents)
    .find({ businessId: q.businessId, investigationId: { $in: docs.map((d) => d.investigationId) } }, { projection: { _id: 0, investigationId: 1, incidentId: 1, status: 1, severity: 1, primaryTheme: 1, polarity: 1, onsetAt: 1, lastTriggeredAt: 1, resolvedAt: 1 } })
    .toArray()).map((i) => [i.investigationId as string, i]));
  return { total, limit: q.limit, offset: q.offset, items: docs.map((d) => ({ investigation: canonicalInvestigation(d), simulationRunId: d.simulationRunId, incident: incidents.get(d.investigationId) ?? null })) };
}

export async function listIncidents(input: unknown, dbOverride?: Db) {
  const q = IncidentQuery.parse(input);
  const db = dbOverride ?? (await getDb());
  const filter: Filter<IncidentDoc> = { businessId: q.businessId };
  if (q.simulationRunId) filter.simulationRunId = q.simulationRunId;
  if (q.status) filter.status = q.status;
  if (q.severity) filter["severity.level"] = q.severity;
  if (q.category) filter.primaryTheme = q.category;
  const col = db.collection<IncidentDoc>(COLLECTIONS.incidents);
  const [total, items] = await Promise.all([
    col.countDocuments(filter),
    col.find(filter, { projection: { _id: 0, history: 0 } }).sort({ lastTriggeredAt: -1, incidentId: 1 }).skip(q.offset).limit(q.limit).toArray(),
  ]);
  return { total, limit: q.limit, offset: q.offset, items };
}

/**
 * Everything the next (Mubit investigation) stage needs to start from: the canonical Investigation, its canonical
 * Anomalies, the incident grouping, each finding's measurements/baselines/thresholds, the canonical MetricSnapshots
 * those anomalies cite, and resolvable source references into `business_events`. No diagnosis, no simulator truth.
 */
export const InvestigationScope = z.object({ businessId: BusinessId, simulationRunId: RunId.optional() }).strict();

export async function getInvestigationBundle(investigationId: string, dbOverride?: Db, input: unknown = {}) {
  const scope = InvestigationScope.parse(input);
  const db = dbOverride ?? (await getDb());
  const raw = await db.collection(COLLECTIONS.investigations).findOne({ investigationId, ...scope }, { projection: { _id: 0 } });
  if (!raw) return null;
  const investigation = canonicalInvestigation(raw);
  const simulationRunId = raw.simulationRunId as string;
  const { businessId } = investigation;
  const incident = await db.collection<IncidentDoc>(COLLECTIONS.incidents).findOne({ businessId, simulationRunId, investigationId }, { projection: { _id: 0 } });
  const findingIds = incident?.findingIds ?? [];
  const [anomalyDocs, findings] = await Promise.all([
    db.collection(COLLECTIONS.anomalies).find({ businessId, simulationRunId, anomalyId: { $in: investigation.anomalyIds } }, { projection: { _id: 0 } }).toArray(),
    db.collection<FindingDoc>(COLLECTIONS.detectionFindings).find({ businessId, simulationRunId, findingId: { $in: findingIds } }, { projection: { _id: 0 } }).toArray(),
  ]);
  const anomalies = anomalyDocs.map(canonicalAnomaly);
  const snapshotIds = [...new Set(anomalies.flatMap((a) => a.sourceSnapshotIds))];
  const snapshotDocs = await db.collection(COLLECTIONS.metricSnapshots).find({ businessId, simulationRunId, snapshotId: { $in: snapshotIds } }, { projection: { _id: 0 } }).toArray();
  const related = incident
    ? await db.collection<IncidentDoc>(COLLECTIONS.incidents).find({ businessId, simulationRunId, incidentId: { $ne: incident.incidentId },
      onsetAt: { $lte: incident.resolvedAt ?? incident.lastTriggeredAt }, $or: [{ resolvedAt: null }, { resolvedAt: { $gte: incident.onsetAt } }] },
      { projection: { _id: 0, incidentId: 1, title: 1, status: 1, severity: 1, primaryTheme: 1, polarity: 1, onsetAt: 1, investigationId: 1 } }).limit(20).toArray()
    : [];
  const timeWindows = findings.flatMap((f) => [f.evaluation.window, ...(f.evaluation.baseline?.samples ?? []).map((s) => ({ startAt: s.startAt, endAt: s.endAt }))]);
  return {
    investigation, simulationRunId, incident, anomalies,
    findings: findings.sort((a, b) => b.severity.score - a.severity.score),
    metricSnapshots: snapshotDocs.map(canonicalSnapshot),
    sourceRecords: [...new Map(findings.flatMap((f) => f.evidence.sourceRecords).map((r) => [`${r.collection}:${r.recordId}`, r])).values()],
    eventQueries: findings.map((f) => ({ findingId: f.findingId, ...f.evidence.eventQuery })),
    affected: incident?.affected ?? { campaigns: [], products: [], channels: [], categories: [] },
    timeWindows: { incident: { startAt: incident?.onsetAt ?? null, endAt: incident?.resolvedAt ?? null }, evaluated: timeWindows },
    relatedIncidents: related,
    note: "Detector output is observational. Correlations are grouping aids, not causal claims; no diagnosis has been made.",
  };
}
