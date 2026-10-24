import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

// Each collection is one CSV file (`key,json`) under NORMAL_DATA_DIR (default ./data).
// Under NODE_ENV=test (unless NORMAL_STORE=csv), or NORMAL_STORE=memory, records stay in process memory so tests never touch disk.
// Every operation is synchronous read-modify-write, so claim/compareAndSet stay atomic within a Node process.
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
}

const matches = (doc: object, filter: object) => Object.entries(filter).every(([k, v]) => (doc as Record<string, unknown>)[k] === v);

export class Repo<T extends object> {
  private table: CsvTable;
  constructor(readonly name: string, readonly schema: z.ZodType<T, z.ZodTypeDef, unknown>) { this.table = new CsvTable(name); }
  async findOne(key: string): Promise<T | undefined> {
    const doc = this.table.load().get(key);
    return doc ? this.schema.parse(doc) : undefined;
  }
  async find(filter: Partial<T> = {}): Promise<T[]> {
    return [...this.table.load().values()].map(doc => this.schema.parse(doc)).filter(doc => matches(doc, filter));
  }
  async insert(key: string, input: T) {
    const value = this.schema.parse(input);
    const map = this.table.load();
    if (map.has(key)) throw new Error(`Duplicate ${key}`);
    map.set(key, structuredClone(value)); this.table.save(map);
    return value;
  }
  async update(key: string, update: { $set: Partial<T> }) {
    const map = this.table.load();
    const merged = { ...(map.get(key) as T | undefined), ...update.$set };
    const value = { ...merged, ...this.schema.parse(merged) };
    map.set(key, structuredClone(value)); this.table.save(map);
    return value;
  }
  async claim(key: string, input: T): Promise<boolean> {
    const value = this.schema.parse(input);
    const map = this.table.load();
    if (map.has(key)) return false;
    map.set(key, structuredClone(value)); this.table.save(map);
    return true;
  }
  async remove(key: string) {
    const map = this.table.load();
    if (map.delete(key)) this.table.save(map);
  }
  async compareAndSet(key: string, expected: Partial<T>, changes: Partial<T>): Promise<boolean> {
    const map = this.table.load();
    const old = map.get(key) as T | undefined;
    if (!old || !matches(old, expected)) return false;
    const merged = { ...old, ...changes };
    const value = { ...merged, ...this.schema.parse(merged) };
    map.set(key, structuredClone(value)); this.table.save(map);
    return true;
  }
}
