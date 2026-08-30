import { authenticateStudioRequest, hasCapability } from "../../../../lib/cms-auth";
import { inspectExtensionPackage } from "../../../../lib/extension-package";

const CMS_BASE_URL = process.env.CMS_BASE_URL ?? "http://127.0.0.1:4200";
const CMS_API_TOKEN = process.env.CMS_API_TOKEN ?? "change-me-in-production";

type CmsEnvelope<T> = { ok: boolean; data?: T; error?: { message?: string } };

function reply(data: unknown, status = 200) {
  return Response.json({ ok: status < 400, data: status < 400 ? data : undefined, error: status >= 400 ? String(data) : undefined }, { status, headers: { "Cache-Control": "no-store" } });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + 0x8000, bytes.length)));
  return btoa(binary);
}

async function cmsRequest<T>(pathname: string, options: RequestInit = {}) {
  const upstream = await fetch(new URL(pathname, CMS_BASE_URL), {
    ...options,
    cache: "no-store",
    headers: { Accept: "application/json", Authorization: `Bearer ${CMS_API_TOKEN}`, ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers ?? {}) },
  });
  let payload: CmsEnvelope<T>;
  try { payload = await upstream.json() as CmsEnvelope<T>; } catch { throw new Error(`CMS returned an invalid response (${upstream.status}).`); }
  if (!upstream.ok || !payload.ok || payload.data === undefined) throw new Error(payload.error?.message ?? `CMS request failed with ${upstream.status}.`);
  return payload.data;
}

async function authorize(request: Request) {
  if (!sameOrigin(request)) return { response: reply("Cross-origin admin requests are not allowed.", 403) };
  const user = await authenticateStudioRequest(request);
  if (!user) return { response: reply("Sign in to manage themes and plugins.", 401) };
  if (!hasCapability(user, "manage_extensions")) return { response: reply("Your account cannot manage themes and plugins.", 403) };
  return { user };
}

export async function GET(request: Request) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;
  try {
    const [catalog, contracts] = await Promise.all([
      cmsRequest("/v1/extensions/manage"),
      cmsRequest("/v1/extensions/contracts"),
    ]);
    return reply({ catalog, contracts });
  } catch (error) {
    return reply(error instanceof Error ? error.message : "CMS extensions are unavailable.", 502);
  }
}

export async function POST(request: Request) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("package");
      if (!(file instanceof File)) return reply("Choose a theme or plugin ZIP.", 400);
      const inspected = await inspectExtensionPackage(file);
      const requestedKind = String(form.get("kind") ?? "");
      if (requestedKind && requestedKind !== inspected.kind) return reply(`This ZIP contains a ${inspected.kind} manifest, not a ${requestedKind} manifest.`, 400);
      const activate = String(form.get("activate") ?? "false") === "true";
      const installed = await cmsRequest<{ kind: "theme" | "plugin"; package: unknown }>("/v1/extensions/packages/upload", { method: "POST", body: JSON.stringify({ data_base64: bytesToBase64(new Uint8Array(await file.arrayBuffer())), activate }) });
      if (installed.kind !== inspected.kind) throw new Error("CMS package verification returned a different extension type.");
      return reply({ installed, kind: installed.kind, package: installed.package }, 201);
    }

    const input = await request.json() as Record<string, unknown>;
    const id = Number(input.id);
    if (!Number.isInteger(id) || id <= 0) return reply("Choose a valid extension.", 400);
    if (input.action === "activateTheme") return reply(await cmsRequest(`/v1/themes/${id}/activate`, { method: "POST" }));
    if (input.action === "setPluginStatus") {
      const status = input.status === "active" ? "active" : "inactive";
      return reply(await cmsRequest(`/v1/plugins/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }));
    }
    return reply("Unsupported extension action.", 400);
  } catch (error) {
    return reply(error instanceof Error ? error.message : "The extension could not be installed.", 400);
  }
}
