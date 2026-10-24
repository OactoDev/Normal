import { NextResponse } from "next/server";
import { simulatorState } from "../../../simulator/state";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await simulatorState.getSnapshot();
  const events = await simulatorState.getEvents();

  return NextResponse.json({
    simulator: snapshot,
    events,
  });
}
