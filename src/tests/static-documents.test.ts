import assert from "node:assert/strict";
import { staticDocument } from "../execution/static-documents";

async function run() {
  const fetched: string[] = [];
  const assets = { async fetch(request: Request) { fetched.push(new URL(request.url).pathname); return new Response("<!doctype html><html>Normal</html>", { headers: { "Cache-Control": "public, max-age=31536000" } }); } };
  const first = await staticDocument(new Request("https://normal.test/"), assets, true);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("x-normal-document-delivery"), "static");
  assert.equal(first.headers.get("cache-control"), "private, no-store");
  assert.match(first.headers.get("set-cookie"), /Secure; HttpOnly; SameSite=Lax/);
  const cookie = first.headers.get("set-cookie").split(";")[0];
  const retained = await staticDocument(new Request("https://normal.test/ads?new=1", { headers: { cookie } }), assets, true);
  assert.equal(retained.headers.get("set-cookie"), null, "navigation retains the browser's session");
  assert.deepEqual(fetched, ["/_normal_documents/home.html", "/_normal_documents/ads.html"]);
  const repaired = await staticDocument(new Request("https://normal.test/store", { headers: { cookie: "normal_demo_session=invalid" } }), assets, true);
  assert.match(repaired.headers.get("set-cookie"), /^normal_demo_session=[a-f0-9-]{36};/);
  const count = fetched.length;
  for (const request of [
    new Request("https://normal.test/api/plans/plan_001"),
    new Request("https://normal.test/", { headers: { rsc: "1" } }),
    new Request("https://normal.test/", { headers: { accept: "text/x-component" } }),
    new Request("https://normal.test/", { method: "POST" }),
  ]) assert.equal(await staticDocument(request, assets, true), null, "API and dynamic Next requests remain dynamic");
  assert.equal(fetched.length, count);
  const head = await staticDocument(new Request("https://normal.test/", { method: "HEAD" }), assets, true);
  assert.equal(await head.text(), "");
  const originalError = console.error;
  try {
    console.error = () => {};
    const unavailable = await staticDocument(new Request("https://normal.test/"), { async fetch() { throw new Error("Asset unavailable"); } }, true);
    assert.equal(unavailable.status, 503);
    assert.match(await unavailable.text(), /Please reload/);
  } finally { console.error = originalError; }
  console.log("Direct page delivery, cache isolation, session retention, dynamic routing and failure handling passed.");
}
run().catch(error => { console.error(error); process.exit(1); });
