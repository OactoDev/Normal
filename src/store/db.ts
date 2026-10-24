import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { D1Repo } from "./d1";

// Each collection is one CSV file (`key,json`) under NORMAL_DATA_DIR (default ./data).
// Under NODE_ENV=test (unless NORMAL_STORE=csv), or NORMAL_STORE=memory, records stay in process memory so tests never touch disk.
// Writes use an exclusive per-table lock across Node processes and atomic rename.
// A crashed writer leaves a lock: fail closed rather than risk duplicate sends.
const globals = globalThis as typeof globalThis & { normalMemory?: Map<string, Map<string, unknown>> };

const useMemory = () => process.env.NORMAL_STORE === "memory" || (process.env.NODE_ENV === "test" && process.env.NORMAL_STORE !== "csv");
const dataDir = () => path.resolve(process.env.NORMAL_DATA_DIR || "data");

const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = ""; rows.push(row); row = [];
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.length >= 2);
}

class CsvTable {
  constructor(private name: string) {}
  private get file() { return path.join(dataDir(), `${this.name}.csv`); }
  private memory() {
    globals.normalMemory ??= new Map();
    if (!globals.normalMemory.has(this.name)) globals.normalMemory.set(this.name, new Map());
    return globals.normalMemory.get(this.name)!;
  }
  load(): Map<string, unknown> {
    if (useMemory()) return this.memory();
    const map = new Map<string, unknown>();
    if (!fs.existsSync(this.file)) return map;
    for (const [key, json] of parseCsv(fs.readFileSync(this.file, "utf8")).slice(1)) map.set(key, JSON.parse(json));
    return map;
  }
  save(map: Map<string, unknown>) {
    if (useMemory()) return;
    fs.mkdirSync(dataDir(), { recursive: true });
    const body = ["key,json", ...[...map].map(([k, v]) => `${quote(k)},${quote(JSON.stringify(v))}`)].join("\n") + "\n";
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, body);
    fs.renameSync(tmp, this.file);
  }
  mutate<R>(work: (map: Map<string, unknown>) => R): R {
    if (useMemory()) return work(this.load());
    fs.mkdirSync(dataDir(), { recursive: true });
    const lock = `${this.file}.lock`, deadline = Date.now() + 5000;
    let fd: number;
    while (fd === undefined) {
      try { fd = fs.openSync(lock, "wx"); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        if (Date.now() >= deadline) throw new Error(`CSV table locked: ${this.name}. Stop writers and inspect ${lock} before recovery.`);
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
      }
    }
    try { return work(this.load()); }
    finally { fs.closeSync(fd); fs.unlinkSync(lock); }
  }
}

const matches = (doc: object, filter: object) => Object.entries(filter).every(([k, v]) => (doc as Record<string, unknown>)[k] === v);

export class Repo<T extends object> {
  private table: CsvTable;
  private d1: D1Repo<T>;
  constructor(readonly name: string, readonly schema: z.ZodType<T, z.ZodTypeDef, unknown>) { this.table = new CsvTable(name); this.d1 = new D1Repo(name, schema); }
  async findOne(key: string): Promise<T | undefined> {
    if (process.env.NORMAL_STORE === "d1") return this.d1.findOne(key);
    const doc = this.table.load().get(key);
    return doc ? this.schema.parse(doc) : undefined;
  }
  async find(filter: Partial<T> = {}): Promise<T[]> {
    if (process.env.NORMAL_STORE === "d1") return this.d1.find(filter);
    return [...this.table.load().values()].map(doc => this.schema.parse(doc)).filter(doc => matches(doc, filter));
  }
  async insert(key: string, input: T) {
    if (process.env.NORMAL_STORE === "d1") return this.d1.insert(key, input);
    const value = this.schema.parse(input);
    return this.table.mutate(map => {
    if (map.has(key)) throw new Error(`Duplicate ${key}`);
    map.set(key, structuredClone(value)); this.table.save(map);
    return value;
    });
  }
  async update(key: string, update: { $set: Partial<T> }) {
    if (process.env.NORMAL_STORE === "d1") return this.d1.update(key, update);
    return this.table.mutate(map => {
    const merged = { ...(map.get(key) as T | undefined), ...update.$set };
    const value = this.schema.parse(merged);
    map.set(key, structuredClone(value)); this.table.save(map);
    return value;
    });
  }
  async claim(key: string, input: T): Promise<boolean> {
    if (process.env.NORMAL_STORE === "d1") return this.d1.claim(key, input);
    const value = this.schema.parse(input);
    return this.table.mutate(map => {
    if (map.has(key)) return false;
    map.set(key, structuredClone(value)); this.table.save(map);
    return true;
    });
  }
  async remove(key: string) {
    if (process.env.NORMAL_STORE === "d1") return this.d1.remove(key);
    return this.table.mutate(map => {
    if (map.delete(key)) this.table.save(map);
    });
  }
  async compareAndSet(key: string, expected: Partial<T>, changes: Partial<T>): Promise<boolean> {
    if (process.env.NORMAL_STORE === "d1") return this.d1.compareAndSet(key, expected, changes);
    return this.table.mutate(map => {
    const old = map.get(key) as T | undefined;
    if (!old || !matches(old, expected)) return false;
    const merged = { ...old, ...changes };
    const value = this.schema.parse(merged);
    map.set(key, structuredClone(value)); this.table.save(map);
    return true;
    });
  }
}
