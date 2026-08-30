const CMS_BASE_URL = process.env.CMS_BASE_URL ?? "http://127.0.0.1:4200";

function decodeBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function GET(_request: Request, context: { params: Promise<{ key: string }> | { key: string } }) {
  const { key } = await context.params;
  if (!/^[a-z0-9_-]{8,200}\.(?:png|jpe?g|gif|webp|pdf)$/i.test(key)) return new Response("Not found", { status: 404 });
  const upstream = await fetch(new URL(`/v1/media/files/${encodeURIComponent(key)}`, CMS_BASE_URL), { cache: "no-store" });
  const payload = await upstream.json() as { ok: boolean; data?: { mime_type: string; size_bytes: number; data_base64: string } };
  if (!upstream.ok || !payload.ok || !payload.data) return new Response("Not found", { status: upstream.status === 404 ? 404 : 502 });
  return new Response(decodeBase64(payload.data.data_base64), { headers: { "Content-Type": payload.data.mime_type, "Content-Length": String(payload.data.size_bytes), "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'" } });
}
