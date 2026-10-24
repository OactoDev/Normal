import { NextResponse } from "next/server";
import { storefront } from "../../../../store/repos";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json({ banners: await storefront.find() }); }
