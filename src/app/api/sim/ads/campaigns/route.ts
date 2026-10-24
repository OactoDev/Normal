import { NextResponse } from "next/server";
import { campaigns, events } from "../../../../../store/repos";
import { seedSimulator } from "../../../../../simulator/state";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { await seedSimulator(); return NextResponse.json({ campaigns: await campaigns.find(), events: (await events.find()).filter(e => e.type === "campaign.budget_updated") }); }
