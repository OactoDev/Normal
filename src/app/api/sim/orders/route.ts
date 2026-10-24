import { NextResponse } from "next/server";
import { orders } from "../../../../store/repos";
import { seedSimulator } from "../../../../simulator/state";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { await seedSimulator(); return NextResponse.json({ orders: await orders.find() }); }
