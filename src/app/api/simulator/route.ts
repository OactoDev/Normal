import { NextResponse } from "next/server";
import { simulatorState } from "../../../simulator/state";

export async function GET() {
  const snapshot = simulatorState.getSnapshot();
  const events = simulatorState.getEvents();

  return NextResponse.json({
    simulator: snapshot,
    events,
  });
}
