import { NextResponse } from "next/server";
import { storefront, events } from "../../../../store/repos";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  // Publication events let the store attribute each banner to the agent action that set it.
  const publications = (await events.find()).filter(e => e.type === "storefront.banner_published").map(e => ({ occurredAt: e.occurredAt, planId: String(e.payload.planId), actionId: String(e.payload.actionId), bannerId: String((e.payload.after as { bannerId?: string } | undefined)?.bannerId ?? "") }));
  return NextResponse.json({ banners: await storefront.find(), publications });
}
