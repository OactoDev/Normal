import { demoSession, demoSessionCookie } from "../lib/demo-session";

const documents: Record<string, string> = { "/": "home.html", "/ads": "ads.html", "/store": "store.html" };

// These three pages contain only public, build-time HTML; their data still comes
// from the dynamic API. Initial navigation does not need Next's SSR/cache runtime.
export async function staticDocument(request: Request, assets: { fetch(request: Request): Promise<Response> }, publicDemo: boolean): Promise<Response | null> {
  const url = new URL(request.url);
  const pathname = url.pathname === "/" ? "/" : url.pathname.replace(/\/$/, "");
  const document = documents[pathname];
  if (!document || !["GET", "HEAD"].includes(request.method) || request.headers.get("rsc") === "1" || request.headers.get("accept")?.includes("text/x-component")) return null;
  url.pathname = `/_normal_documents/${document}`;
  url.search = "";
  try {
    const asset = await assets.fetch(new Request(url, { method: request.method }));
    if (!asset.ok) throw new Error(`Asset HTTP ${asset.status}`);
    const headers = new Headers(asset.headers);
    headers.set("Content-Type", "text/html; charset=utf-8");
    headers.set("Cache-Control", "private, no-store");
    headers.set("X-Normal-Document-Delivery", "static");
    if (publicDemo) {
      const session = demoSession(request);
      if (session.isNew) headers.append("Set-Cookie", demoSessionCookie(session.id));
    }
    return new Response(request.method === "HEAD" ? null : asset.body, { status: 200, headers });
  } catch {
    console.error(JSON.stringify({ event: "normal_document_unavailable", path: pathname }));
    return new Response(request.method === "HEAD" ? null : "<!doctype html><html><head><title>Normal</title></head><body><h1>Normal is temporarily unavailable</h1><p>Please reload the page.</p></body></html>", { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "1" } });
  }
}
