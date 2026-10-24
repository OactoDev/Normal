import { NextRequest, NextResponse } from "next/server";
import { telemetrySimulator } from "../../../../intelligence/telemetry-simulator";
import { anomalyDetector } from "../../../../intelligence/anomaly-detector";
import { evidenceCollector } from "../../../../intelligence/evidence-collector";
import { MubitDiagnosisError, mubitDiagnoser } from "../../../../intelligence/mubit-diagnoser";
import { Evidence, Investigation } from "../../../../contracts";
import { z } from "zod";

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

    const result = await mubitDiagnoser.diagnose(Investigation.parse(investigation), z.array(Evidence).parse(evidence));

    return NextResponse.json(result);
  } catch (err: any) {
    if (err instanceof MubitDiagnosisError) return NextResponse.json({ error: { code: err.code, message: err.message, ...(err.requestId ? { requestId: err.requestId } : {}) } }, { status: err.status });
    if (err instanceof z.ZodError) return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "A valid investigation and evidence packet are required." } }, { status: 400 });
    return NextResponse.json(
      { error: { code: "DIAGNOSIS_FAILED", message: err.message || "Failed to execute AI diagnosis" } },
      { status: 500 }
    );
  }
}
