import { copyFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const destination = ".open-next/assets/_normal_documents";
await mkdir(destination, { recursive: true });
for (const [source, target] of [["index.html", "home.html"], ["ads.html", "ads.html"], ["store.html", "store.html"]]) {
  const file = join(".next/server/app", source);
  const html = await readFile(file, "utf8");
  if (!html.includes("<html") || !html.includes("/_next/static/")) throw new Error(`Invalid page build: ${source}`);
  await copyFile(file, join(destination, target));
}
console.log("Prepared public HTML documents for direct Cloudflare asset delivery.");
