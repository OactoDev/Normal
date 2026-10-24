/**
 * The parts of the intelligence team's `@normal/contracts` package (github.com/OactoDev/Normal, branch main,
 * packages/contracts/src/contracts.ts at 4d4623c) that this module exchanges with their service.
 * Copied, not re-designed: keep these schemas identical to theirs, and re-copy when their package changes.
 */
import { z } from "zod";

const Id = z.string().min(1);
const DateTime = z.string().datetime({ offset: true });
const Currency = z.enum(["GBP", "USD", "EUR"]);
const TimeWindow = z.object({ startAt: DateTime, endAt: DateTime }).strict();
const SourceReference = z.object({ collection: z.string().min(1), recordId: Id, sourceUrl: z.string().url().optional() }).strict();
const Source = z.enum(["storefront", "shopify", "woocommerce", "meta_ads", "google_ads", "ga4", "shipping", "reviews", "social", "email", "finance", "supplier", "simulator"]);
const Provenance = z.object({
  sourceRecordId: Id, connectorId: Id, simulated: z.boolean(),
  ingestMethod: z.enum(["webhook", "poll", "import", "simulation", "action_callback"]),
  sourceUrl: z.string().url().optional(),
}).strict();
const SchemaMeta = { schemaVersion: z.literal(1), businessId: Id };

export const PartnerRootCause = z.enum(["ad_fatigue", "ad_inefficiency", "delivery_delays", "product_quality", "negative_sentiment", "checkout_failure", "discount_failure", "stockout", "viral_demand", "seasonality", "unknown"]);

export const PartnerEvidence = z.object({
  ...SchemaMeta, evidenceId: Id, investigationId: Id,
  category: z.enum(["sales", "advertising", "fulfillment", "reviews", "social", "technical", "inventory"]),
  title: z.string().min(1), observation: z.string().min(1),
  window: TimeWindow.optional(),
  measurements: z.array(z.object({ metric: z.string().min(1), value: z.number(), unit: z.string().min(1), baseline: z.number().optional() }).strict()),
  sourceRecords: z.array(SourceReference).min(1),
  retrievedAt: DateTime,
}).strict();

const Hypothesis = z.object({
  cause: PartnerRootCause,
  strength: z.enum(["weak", "moderate", "strong"]),
  evidenceIds: z.array(Id), counterEvidenceIds: z.array(Id),
  explanation: z.string().min(1),
}).strict();
const DiagnosisModelOutput = z.object({
  primaryCause: PartnerRootCause, hypotheses: z.array(Hypothesis).min(1),
  summary: z.string().min(1), missingEvidence: z.array(z.string()),
  requiresReview: z.boolean(),
}).strict();
export const PartnerDiagnosis = DiagnosisModelOutput.extend({
  ...SchemaMeta, diagnosisId: Id, investigationId: Id,
  modelCallId: Id, taskKey: z.literal("revenue_diagnosis_v1"),
  createdAt: DateTime,
}).strict();

// Their ProposedPlan has the same fields as ours (checked against their examples), so the plan is parsed with our
// schema after date normalisation; only the diagnosis and evidence shapes differ.
export const PartnerPlanHandoff = z.object({
  plan: z.record(z.string(), z.unknown()), diagnosis: PartnerDiagnosis, evidence: z.array(PartnerEvidence),
}).strict();

const eventBase = {
  ...SchemaMeta, eventId: Id, source: Source, occurredAt: DateTime, receivedAt: DateTime,
  provenance: Provenance, correlationId: Id.optional(), simulationRunId: Id.optional(),
};
const E = <T extends string, P extends z.ZodTypeAny>(type: T, payload: P) => z.object({ ...eventBase, type: z.literal(type), payload }).strict();
/** The action-callback events from their BusinessEvent union. */
export const PartnerActionEvent = z.discriminatedUnion("type", [
  E("campaign.budget_updated", z.object({
    campaignId: Id, previousDailyBudgetMinor: z.number().int().nonnegative(),
    newDailyBudgetMinor: z.number().int().nonnegative(), currency: Currency, actionId: Id,
  }).strict()),
  E("customer.message_sent", z.object({
    messageId: Id, orderId: Id, customerId: Id, templateId: Id,
    deliveryStatus: z.enum(["queued", "sent", "failed"]), actionId: Id,
  }).strict()),
  E("storefront.banner_published", z.object({
    bannerId: Id, message: z.string().min(1), startsAt: DateTime, expiresAt: DateTime.optional(), actionId: Id,
  }).strict()),
]);
export type PartnerActionEventT = z.infer<typeof PartnerActionEvent>;

export const PartnerIngestResult = z.object({
  accepted: z.number().int().nonnegative(), duplicates: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(), eventIds: z.array(Id),
}).strict();
