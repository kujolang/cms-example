import { inflateSync } from "fflate";

const MAX_ARCHIVE = 16 * 1024 * 1024;
const MAX_EXPANDED = 64 * 1024 * 1024;
const MAX_FILES = 2_000;
const MAX_MANIFEST = 128 * 1024;

type ZipEntry = { path: string; method: number; crc: number; compressedSize: number; uncompressedSize: number; localOffset: number };

function safePath(value: string) {
  return Boolean(value) && !value.startsWith("/") && !value.includes("\\") && !value.includes("\0") && !value.split("/").includes("..");
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function inspectExtensionPackage(file: File) {
  if (!file.name.toLowerCase().endsWith(".zip")) throw new Error("Choose a ZIP package.");
  if (file.size <= 0 || file.size > MAX_ARCHIVE) throw new Error("Theme and plugin ZIPs must be 16 MB or smaller.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error("This is not a supported ZIP archive.");
  const fileCount = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (!fileCount || fileCount > MAX_FILES || centralOffset + centralSize > bytes.length) throw new Error("The ZIP directory is invalid or exceeds 2,000 files.");

  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  let expanded = 0;
  let cursor = centralOffset;
  while (cursor < centralOffset + centralSize) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error("The ZIP directory is malformed.");
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const crc = view.getUint32(cursor + 16, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const path = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if ((flags & 1) !== 0) throw new Error("Encrypted ZIP packages are not supported.");
    if (![0, 8].includes(method) || !safePath(path)) throw new Error("The ZIP contains an unsupported or unsafe entry.");
    expanded += uncompressedSize;
    if (expanded > MAX_EXPANDED) throw new Error("The ZIP expands beyond the 64 MB safety limit.");
    entries.push({ path, method, crc, compressedSize, uncompressedSize, localOffset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  if (entries.length !== fileCount) throw new Error("The ZIP file count does not match its directory.");
  const manifests = entries.filter((entry) => /(^|\/)kujo-(theme|plugin)\.json$/.test(entry.path));
  if (manifests.length !== 1) throw new Error("The ZIP must contain exactly one kujo-theme.json or kujo-plugin.json manifest.");
  const entry = manifests[0];
  if (entry.uncompressedSize > MAX_MANIFEST) throw new Error("The extension manifest is too large.");
  if (view.getUint32(entry.localOffset, true) !== 0x04034b50) throw new Error("The ZIP manifest entry is malformed.");
  const localNameLength = view.getUint16(entry.localOffset + 26, true);
  const localExtraLength = view.getUint16(entry.localOffset + 28, true);
  const dataOffset = entry.localOffset + 30 + localNameLength + localExtraLength;
  if (dataOffset + entry.compressedSize > bytes.length) throw new Error("The ZIP manifest data is truncated.");
  const compressed = bytes.subarray(dataOffset, dataOffset + entry.compressedSize);
  const manifestBytes = entry.method === 0 ? compressed : inflateSync(compressed);
  if (manifestBytes.length !== entry.uncompressedSize || manifestBytes.length > MAX_MANIFEST || crc32(manifestBytes) !== entry.crc) throw new Error("The ZIP manifest failed its integrity check.");
  let manifest: Record<string, unknown>;
  try { manifest = JSON.parse(decoder.decode(manifestBytes)) as Record<string, unknown>; } catch { throw new Error("The extension manifest is not valid JSON."); }
  const schema = String(manifest.schema ?? "");
  const kind = schema === "kujo.theme/v1" ? "theme" : schema === "kujo.plugin/v1" ? "plugin" : "";
  if (!kind) throw new Error("The manifest schema must be kujo.theme/v1 or kujo.plugin/v1.");
  return {
    kind,
    manifest,
    package: {
      format: "zip",
      filename: file.name.replace(/[\\/]/g, "-").slice(0, 240),
      size_bytes: file.size,
      uncompressed_bytes: expanded,
      file_count: entries.length,
      manifest_path: entry.path,
      sha256: hex(await crypto.subtle.digest("SHA-256", bytes)),
    },
  };
}
