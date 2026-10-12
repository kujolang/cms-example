import { readFile } from "node:fs/promises";

const expected = JSON.parse(await readFile(new URL("../cms-backend.json", import.meta.url), "utf8"));
const base = process.env.CMS_BASE_URL || "http://127.0.0.1:4200";
const response = await fetch(`${base.replace(/\/$/, "")}/v1/contract`, { signal: AbortSignal.timeout(5000) });
if (!response.ok) throw new Error(`CMS contract returned HTTP ${response.status}`);
const contract = await response.json();
const actual = contract.data?.info?.version;
if (actual !== expected.version) {
  throw new Error(`Expected CMS ${expected.version}, received ${actual ?? "no version"}. Update the backend checkout and restart it; see ${expected.release}`);
}
console.log(`CMS backend ${actual} verified.`);
