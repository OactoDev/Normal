import { z } from "zod";

interface Statement {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
interface Database { prepare(sql: string): Statement }

async function database(): Promise<Database> {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const db = (getCloudflareContext().env as unknown as { NORMAL_DB?: Database }).NORMAL_DB;
  if (!db) throw new Error("NORMAL_DB binding is required for the D1 store");
  return db;
}

const matches = (doc: object, expected: object) => Object.entries(expected).every(([key, value]) => (doc as Record<string, unknown>)[key] === value);

export class D1Repo<T extends object> {
  constructor(private collection: string, private schema: z.ZodType<T, z.ZodTypeDef, unknown>, private getDatabase: () => Promise<Database> = database) {}
  private async scopedCollection() {
    if (process.env.PUBLIC_DEMO !== "1") return this.collection;
    const { headers } = await import("next/headers");
    const session = (await headers()).get("x-normal-demo-session");
    if (!session || !/^[a-f0-9-]{36}$/.test(session)) throw new Error("Demo session is missing");
    return `${session}:${this.collection}`;
  }
  private async row(key: string) {
    return (await this.getDatabase()).prepare("SELECT payload FROM records WHERE collection = ? AND id = ?").bind(await this.scopedCollection(), key).first<{ payload: string }>();
  }
  async findOne(key: string): Promise<T | undefined> {
    const row = await this.row(key);
    return row ? this.schema.parse(JSON.parse(row.payload)) : undefined;
  }
  async find(filter: Partial<T> = {}): Promise<T[]> {
    const rows = await (await this.getDatabase()).prepare("SELECT payload FROM records WHERE collection = ?").bind(await this.scopedCollection()).all<{ payload: string }>();
    return rows.results.map(row => this.schema.parse(JSON.parse(row.payload))).filter(doc => matches(doc, filter));
  }
  async insert(key: string, input: T) {
    const value = this.schema.parse(input);
    await (await this.getDatabase()).prepare("INSERT INTO records (collection, id, payload) VALUES (?, ?, ?)").bind(await this.scopedCollection(), key, JSON.stringify(value)).run();
    return value;
  }
  async claim(key: string, input: T): Promise<boolean> {
    const value = this.schema.parse(input);
    const result = await (await this.getDatabase()).prepare("INSERT OR IGNORE INTO records (collection, id, payload) VALUES (?, ?, ?)").bind(await this.scopedCollection(), key, JSON.stringify(value)).run();
    return result.meta.changes === 1;
  }
  async remove(key: string) {
    await (await this.getDatabase()).prepare("DELETE FROM records WHERE collection = ? AND id = ?").bind(await this.scopedCollection(), key).run();
  }
  async update(key: string, update: { $set: Partial<T> }) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const old = await this.row(key);
      const value = this.schema.parse({ ...(old ? JSON.parse(old.payload) : {}), ...update.$set });
      if (!old) {
        if (await this.claim(key, value)) return value;
      } else {
        const result = await (await this.getDatabase()).prepare("UPDATE records SET payload = ? WHERE collection = ? AND id = ? AND payload = ?").bind(JSON.stringify(value), await this.scopedCollection(), key, old.payload).run();
        if (result.meta.changes === 1) return value;
      }
    }
    throw new Error("Record changed concurrently; retry the operation");
  }
  async compareAndSet(key: string, expected: Partial<T>, changes: Partial<T>): Promise<boolean> {
    for (let attempt = 0; attempt < 12; attempt++) {
      const old = await this.row(key);
      if (!old || !matches(JSON.parse(old.payload), expected)) return false;
      const value = this.schema.parse({ ...JSON.parse(old.payload), ...changes });
      const result = await (await this.getDatabase()).prepare("UPDATE records SET payload = ? WHERE collection = ? AND id = ? AND payload = ?").bind(JSON.stringify(value), await this.scopedCollection(), key, old.payload).run();
      if (result.meta.changes === 1) return true;
    }
    throw new Error("Record changed concurrently; retry the operation");
  }
}
