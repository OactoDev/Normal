import { NextRequest, NextResponse } from "next/server";
import { telemetrySimulator } from "../../../../intelligence/telemetry-simulator";
import { anomalyDetector } from "../../../../intelligence/anomaly-detector";
import { evidenceCollector } from "../../../../intelligence/evidence-collector";
import { mubitDiagnoser } from "../../../../intelligence/mubit-diagnoser";

export async function POST(request: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body optional; will use active simulation if omitted
    }

    let investigation = body.investigation;
    let evidence = body.evidence;

    if (!investigation || !evidence || evidence.length === 0) {
      const simState = telemetrySimulator.getState();
      const detection = anomalyDetector.analyzeEvents(simState.events);
      const packet = evidenceCollector.assembleInvestigation(
        detection.anomalies,
        simState.events
      );
      investigation = packet.investigation;
      evidence = packet.evidence;
    }

    const result = await mubitDiagnoser.diagnose(investigation, evidence);

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "DIAGNOSIS_FAILED", message: err.message || "Failed to execute AI diagnosis" } },
      { status: 500 }
    );
  }
}
