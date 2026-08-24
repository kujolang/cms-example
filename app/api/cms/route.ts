const CMS_BASE_URL = process.env.CMS_BASE_URL ?? "http://127.0.0.1:4200";
const CMS_API_TOKEN = process.env.CMS_API_TOKEN ?? "change-me-in-production";
const MAX_IMAGE_BYTES = 650 * 1024;

type CmsEnvelope<T> = { ok: boolean; data?: T; error?: { message?: string } };

function response(data: unknown, status = 200) {
  return Response.json({ ok: status < 400, data: status < 400 ? data : undefined, error: status >= 400 ? data : undefined }, { status });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function localAdminAllowed(request: Request) {
  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

async function cmsRequest<T>(pathname: string, options: RequestInit = {}): Promise<T> {
  const upstream = await fetch(new URL(pathname, CMS_BASE_URL), {
    ...options,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${CMS_API_TOKEN}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });
  const payload = (await upstream.json()) as CmsEnvelope<T>;
  if (!upstream.ok || !payload.ok || payload.data === undefined) throw new Error(payload.error?.message ?? `CMS request failed with ${upstream.status}`);
  return payload.data;
}

async function loadStudio() {
  const [entries, contentTypes, taxonomies, media] = await Promise.all([
    cmsRequest<{ items: unknown[] }>("/v1/entries?include=terms&limit=200&sort_by=updated_at&sort_dir=desc"),
    cmsRequest<{ items: unknown[] }>("/v1/content-types?limit=200&sort_by=type_key&sort_dir=asc"),
    cmsRequest<{ items: Array<{ id: number }> }>("/v1/taxonomies?limit=200&sort_by=taxonomy_key&sort_dir=asc"),
    cmsRequest<{ items: Array<Record<string, unknown>> }>("/v1/media?limit=200&sort_by=updated_at&sort_dir=desc"),
  ]);
  const taxonomyItems = await Promise.all(taxonomies.items.map(async (taxonomy) => ({
    ...taxonomy,
    terms: (await cmsRequest<{ items: unknown[] }>(`/v1/taxonomies/${taxonomy.id}/terms?limit=200&sort_by=name&sort_dir=asc`)).items,
  })));
  const mediaItems = media.items.map((item) => Object.fromEntries(Object.entries(item).filter(([key]) => key !== "meta_json")));
  return { entries: entries.items, contentTypes: contentTypes.items, taxonomies: taxonomyItems, media: mediaItems };
}

function randomId() {
  return crypto.randomUUID();
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunkSize, bytes.length)));
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function GET(request: Request) {
  const mediaId = Number(new URL(request.url).searchParams.get("media") ?? 0);
  if (Number.isInteger(mediaId) && mediaId > 0) {
    try {
      const media = await cmsRequest<{ mime_type: string; meta_json: string }>(`/v1/media/${mediaId}`);
      const meta = JSON.parse(media.meta_json || "{}") as { data_base64?: string };
      if (!meta.data_base64) return new Response("Media bytes not found", { status: 404 });
      return new Response(base64ToBytes(meta.data_base64), {
        headers: { "Content-Type": media.mime_type || "image/webp", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
      });
    } catch {
      return new Response("Media not found", { status: 404 });
    }
  }
  if (!localAdminAllowed(request)) return response("CMS Studio is local-only until production authentication is configured.", 401);
  if (!sameOrigin(request)) return response("Cross-origin admin requests are not allowed.", 403);
  try {
    return response(await loadStudio());
  } catch (error) {
    return response(error instanceof Error ? error.message : "CMS unavailable", 502);
  }
}

export async function POST(request: Request) {
  if (!localAdminAllowed(request)) return response("CMS Studio is local-only until production authentication is configured.", 401);
  if (!sameOrigin(request)) return response("Cross-origin admin requests are not allowed.", 403);
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      const altText = String(formData.get("alt_text") ?? "").trim();
      if (!(file instanceof File)) return response("Choose an image to upload.", 400);
      if (file.type !== "image/webp") return response("The editor accepts WebP uploads only.", 415);
      if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) return response("Optimized WebP images must be 650 KB or smaller.", 413);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const signature = new TextDecoder("ascii").decode(bytes.slice(0, 12));
      if (!signature.startsWith("RIFF") || !signature.endsWith("WEBP")) return response("The uploaded file is not a valid WebP image.", 415);
      const stem = file.name.replace(/\.webp$/i, "").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "image";
      const filename = `${stem}-${randomId().slice(0, 8)}.webp`;
      const media = await cmsRequest<{ id: number }>("/v1/media", {
        method: "POST",
        headers: { "Idempotency-Key": `studio-media-${filename}` },
        body: JSON.stringify({ filename, mime_type: "image/webp", storage_path: `/api/cms?media=pending`, size_bytes: file.size, alt_text: altText, meta: { source: "cms-studio", format: "webp", data_base64: bytesToBase64(bytes) } }),
      });
      const publicPath = `/api/cms?media=${media.id}`;
      await cmsRequest(`/v1/media/${media.id}`, {
        method: "PATCH",
        body: JSON.stringify({ storage_path: publicPath }),
      });
      return response({ path: publicPath, media: { id: media.id, filename, mime_type: "image/webp", storage_path: publicPath, size_bytes: file.size, alt_text: altText } });
    }

    const input = await request.json() as Record<string, unknown>;
    if (input.action === "createTerm") {
      const taxonomyId = Number(input.taxonomy_id);
      const name = String(input.name ?? "").trim();
      const slug = String(input.slug ?? "").trim();
      if (!Number.isInteger(taxonomyId) || taxonomyId <= 0 || name.length < 2 || slug.length < 2) return response("A taxonomy, name, and slug are required.", 400);
      const term = await cmsRequest(`/v1/taxonomies/${taxonomyId}/terms`, {
        method: "POST",
        headers: { "Idempotency-Key": `studio-term-${taxonomyId}-${slug}` },
        body: JSON.stringify({ name, slug, description: String(input.description ?? "") }),
      });
      return response({ term, studio: await loadStudio() }, 201);
    }

    if (input.action !== "saveEntry") return response("Unsupported CMS action.", 400);
    const id = Number(input.id ?? 0);
    const termIds = Array.isArray(input.term_ids) ? input.term_ids.map(Number).filter((value) => Number.isInteger(value) && value > 0) : [];
    const entry = input.entry as Record<string, unknown> | undefined;
    if (!entry) return response("Entry data is required.", 400);
    let saved: { id: number };
    if (id > 0) {
      await cmsRequest(`/v1/entries/${id}/revisions`, {
        method: "POST",
        headers: { "Idempotency-Key": `studio-revision-${id}-${Date.now()}` },
        body: JSON.stringify({ note: "Snapshot before CMS Studio update" }),
      });
      saved = await cmsRequest(`/v1/entries/${id}`, { method: "PATCH", body: JSON.stringify(entry) });
    } else {
      saved = await cmsRequest("/v1/entries", {
        method: "POST",
        headers: { "Idempotency-Key": `studio-entry-${randomId()}` },
        body: JSON.stringify(entry),
      });
    }
    await cmsRequest(`/v1/entries/${saved.id}/terms`, { method: "POST", body: JSON.stringify({ term_ids: termIds }) });
    return response({ entry: saved, studio: await loadStudio() }, id > 0 ? 200 : 201);
  } catch (error) {
    return response(error instanceof Error ? error.message : "CMS write failed", 502);
  }
}
