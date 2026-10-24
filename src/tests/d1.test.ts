import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { D1Repo } from "../store/d1";
import { emailProvider, sendEmail } from "../tools/email-provider";

async function run() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE records (collection TEXT, id TEXT, payload TEXT, PRIMARY KEY (collection, id))");
  const db = { prepare(sql: string) {
    const prepared = sqlite.prepare(sql);
    let values: any[] = [];
    return {
      bind(...input: any[]) { values = input; return this; },
      async first<T>() { return (prepared.get(...values) || null) as T; },
      async all<T>() { return { results: prepared.all(...values) as T[] }; },
      async run() { return { meta: { changes: Number(prepared.run(...values).changes) } }; },
    };
  } };
  const schema = z.object({ status: z.string(), note: z.string().optional() }).strict();
  const repo = new D1Repo("claims", schema, async () => db);
  const winners = await Promise.all(Array.from({ length: 10 }, () => repo.claim("one", { status: "queued" })));
  assert.equal(winners.filter(Boolean).length, 1, "only one worker can claim an execution");
  const transitions = await Promise.all(Array.from({ length: 10 }, () => repo.compareAndSet("one", { status: "queued" }, { status: "running" })));
  assert.equal(transitions.filter(Boolean).length, 1, "only one worker can start an execution");
  await Promise.all([
    repo.update("one", { $set: { status: "done" } }),
    repo.update("one", { $set: { note: "preserved" } }),
  ]);
  assert.deepEqual(await repo.findOne("one"), { status: "done", note: "preserved" }, "concurrent field updates retain both changes");
  await repo.update("one", { $set: { note: undefined } });
  assert.deepEqual(await new D1Repo("claims", schema, async () => db).findOne("one"), { status: "done" }, "a fresh repository sees persisted state and cleared optional fields");
  await assert.rejects(repo.insert("invalid", { status: 123 } as any));
  assert.equal(await repo.findOne("invalid"), undefined);
  assert.equal((await repo.find({ status: "done" })).length, 1);
  await repo.remove("one");
  assert.equal(await repo.findOne("one"), undefined);
  sqlite.close();
  const saved = { provider: process.env.EMAIL_PROVIDER, demo: process.env.PUBLIC_DEMO, fetch: globalThis.fetch };
  try {
    process.env.EMAIL_PROVIDER = "demo";
    delete process.env.PUBLIC_DEMO;
    assert.throws(emailProvider, /Invalid email provider/);
    process.env.PUBLIC_DEMO = "1";
    globalThis.fetch = async () => { throw new Error("public demo email must not call an external service"); };
    const result = await sendEmail({ to: "controlled@example.com", subject: "Demo", body: "Simulation", key: "demo" });
    assert.equal(result.provider, "demo");
    assert.match(result.providerOperationId, /^demo_/);
  } finally {
    globalThis.fetch = saved.fetch;
    if (saved.provider === undefined) delete process.env.EMAIL_PROVIDER; else process.env.EMAIL_PROVIDER = saved.provider;
    if (saved.demo === undefined) delete process.env.PUBLIC_DEMO; else process.env.PUBLIC_DEMO = saved.demo;
  }
  console.log("D1 atomic claims, concurrent updates, persistence and public demo email checks passed.");
}
run().catch(error => { console.error(error); process.exit(1); });
