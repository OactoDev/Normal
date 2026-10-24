import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (process.env.PUBLIC_DEMO !== "1") return NextResponse.next();
  const retained = request.cookies.get("normal_demo_session")?.value;
  const session = retained && /^[a-f0-9-]{36}$/.test(retained) ? retained : crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set("x-normal-demo-session", session);
  const response = NextResponse.next({ request: { headers } });
  if (session !== retained) response.cookies.set("normal_demo_session", session, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 86400 });
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"] };
