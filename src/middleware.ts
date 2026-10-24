import { NextRequest, NextResponse } from "next/server";
import { demoSession, demoSessionCookie } from "./lib/demo-session";

export function middleware(request: NextRequest) {
  if (process.env.PUBLIC_DEMO !== "1") return NextResponse.next();
  const session = demoSession(request);
  const headers = new Headers(request.headers);
  headers.set("x-normal-demo-session", session.id);
  const response = NextResponse.next({ request: { headers } });
  if (session.isNew) response.headers.append("Set-Cookie", demoSessionCookie(session.id));
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"] };
