import { NextRequest, NextResponse } from "next/server";
import { telemetrySimulator } from "../../../../intelligence/telemetry-simulator";
import { anomalyDetector } from "../../../../intelligence/anomaly-detector";
import { evidenceCollector } from "../../../../intelligence/evidence-collector";
import { ScenarioName } from "../../../../contracts";

export async function GET() {
  const simState = telemetrySimulator.getState();
  const detection = anomalyDetector.analyzeEvents(simState.events);
  const investigationPacket = evidenceCollector.assembleInvestigation(
    detection.anomalies,
    simState.events
  );

  return NextResponse.json({
    simulationRun: simState.run,
    eventsCount: simState.events.length,
    recentEvents: simState.events.slice(-10),
    snapshots: detection.snapshots,
    anomalies: detection.anomalies,
    investigation: investigationPacket.investigation,
    evidence: investigationPacket.evidence,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const scenario = body.scenario || "delivery_delays";
    const severity = typeof body.severity === "number" ? body.severity : 0.8;

    const validatedScenario = ScenarioName.safeParse(scenario);
    if (!validatedScenario.success) {
      return NextResponse.json(
        { error: { code: "INVALID_SCENARIO", message: `Invalid scenario name: ${scenario}` } },
        { status: 400 }
      );
    }

    const simState = await telemetrySimulator.injectScenario(validatedScenario.data, severity);
    const detection = anomalyDetector.analyzeEvents(simState.events);
    const investigationPacket = evidenceCollector.assembleInvestigation(
      detection.anomalies,
      simState.events
    );

    return NextResponse.json({
      simulationRun: simState.run,
      eventsCount: simState.events.length,
      recentEvents: simState.events.slice(-10),
      snapshots: detection.snapshots,
      anomalies: detection.anomalies,
      investigation: investigationPacket.investigation,
      evidence: investigationPacket.evidence,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "SIMULATION_FAILED", message: err.message || "Failed to inject scenario" } },
      { status: 500 }
    );
  }
}
