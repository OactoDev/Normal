import { EvidenceT, SaplingLabelT } from "../contracts";
import { DIAGNOSIS_POLICY } from "./sapling-verifier";

const evidence = (evidenceId: string, observedFact: string, measurements: Record<string, number>): EvidenceT => ({
  schemaVersion: 1,
  evidenceId,
  investigationId: "inv_sapling_stress",
  businessId: "nova_store",
  observedFact,
  measurements,
  sourceRecordIds: [],
  retrievedAt: new Date().toISOString(),
});

export interface SaplingStressCase {
  id: string;
  title: string;
  expected: SaplingLabelT;
  policy: string;
  evidence: EvidenceT[];
  claim: string;
}

const policy = DIAGNOSIS_POLICY.delivery_delays;
const claim = "The diagnosis names delivery delays as the root cause.";

// Fixed illustrative inputs, each verified by a fresh real request to Banyan Sapling.
export const SAPLING_STRESS_CASES: SaplingStressCase[] = [
  {
    id: "supported",
    title: "14 late orders · rule requires 10",
    expected: "supported",
    policy,
    evidence: [evidence("e_shipping_14", "14 tracked orders breached their delivery promise by more than 48 hours.", { delayedOrdersCount: 14 })],
    claim,
  },
  {
    id: "violation",
    title: "8 late orders · below the threshold",
    expected: "violation",
    policy,
    evidence: [evidence("e_shipping_8", "Exactly 8 tracked orders breached their delivery promise by more than 48 hours.", { delayedOrdersCount: 8 })],
    claim,
  },
  {
    id: "insufficient_information",
    title: "Ad CAC only · no delivery evidence",
    expected: "insufficient_information",
    policy,
    evidence: [evidence("e_ads_1", "Campaign A has a customer acquisition cost of £38.50. Delivery records are not included in this evidence packet.", { currentCacMinor: 3850 })],
    claim,
  },
  {
    id: "inconsistent_context",
    title: "Same orders · contradictory reports",
    expected: "inconsistent_context",
    policy,
    evidence: [
      evidence("e_shipping_report_a", "Report A states exactly 14 orders breached the delivery promise in the incident. This report covers the complete incident and all orders.", { delayedOrdersCount: 14 }),
      evidence("e_shipping_report_b", "Report B states exactly 3 orders breached the delivery promise in the same incident, for exactly the same orders and time window. Both reports are equally authoritative and cannot be reconciled.", { delayedOrdersCount: 3 }),
    ],
    claim,
  },
];
