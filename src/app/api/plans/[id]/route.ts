import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "../../../../agents/orchestrator";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const plan = orchestrator.getPlan(id);

  if (!plan) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: `Plan ${id} not found`, requestId: `req_${Date.now()}` } },
      { status: 404 }
    );
  }

  // Returns PlanHandoff format as requested by spec
  const handoff = {
    plan,
    diagnosis: {
      schemaVersion: 1,
      diagnosisId: "diag_001",
      investigationId: "inv_001",
      modelCallId: "call_mubit_001",
      output: {
        primaryCause: "delivery_delays",
        supportedHypotheses: [
          {
            cause: "delivery_delays",
            confidence: 0.94,
            rationale: "Carrier SLA delivery delays (>48h) triggered customer churn and negative reviews.",
            evidenceIds: ["e_ship_01"],
          },
          {
            cause: "ad_inefficiency",
            confidence: 0.82,
            rationale: "Campaign A acquisition cost spiked 42% with lower conversion.",
            evidenceIds: ["e_ads_01"],
          },
        ],
        missingEvidence: [],
      },
      serverAttribution: {
        verifiedByRules: true,
        saplingVerification: "supported",
      },
      createdAt: new Date().toISOString(),
    },
    evidence: [
      {
        schemaVersion: 1,
        evidenceId: "e_ads_01",
        investigationId: "inv_001",
        businessId: "nova_store",
        observedFact: "Meta Campaign A CAC increased from £18.20 to £34.80.",
        measurements: {
          previousCacMinor: 1820,
          currentCacMinor: 3480,
          deltaPercent: 91.2,
        },
        sourceRecordIds: ["ad_snap_01"],
        retrievedAt: new Date().toISOString(),
      },
      {
        schemaVersion: 1,
        evidenceId: "e_ship_01",
        investigationId: "inv_001",
        businessId: "nova_store",
        observedFact: "12 tracked parcels delayed past guaranteed delivery promise date.",
        measurements: {
          delayedOrdersCount: 12,
          avgDelayHours: 46.5,
        },
        sourceRecordIds: ["ord_001", "ord_002"],
        retrievedAt: new Date().toISOString(),
      },
    ],
  };

  return NextResponse.json(handoff);
}
