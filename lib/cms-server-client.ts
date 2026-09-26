const DEFAULT_CMS_BASE_URL = "http://127.0.0.1:4200";
const DEVELOPMENT_TOKEN = "change-me-in-production";

type CmsEnvelope<T> = { ok: boolean; data?: T; error?: { message?: string } };

export type CmsRequestOptions = RequestInit & { session?: string };

function cmsBaseUrl() {
  return process.env.CMS_BASE_URL ?? DEFAULT_CMS_BASE_URL;
}

function cmsApiToken() {
  const token = process.env.CMS_API_TOKEN ?? DEVELOPMENT_TOKEN;
  if (process.env.NODE_ENV === "production" && token === DEVELOPMENT_TOKEN) {
    throw new Error("CMS_API_TOKEN must be configured with a non-default secret in production.");
  }
  return token;
}

export async function cmsServerRequest<T>(pathname: string, options: CmsRequestOptions = {}): Promise<T> {
  const { session = "", ...requestOptions } = options;
  const response = await fetch(new URL(pathname, cmsBaseUrl()), {
    ...requestOptions,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(session ? { "X-CMS-Session": session } : { Authorization: `Bearer ${cmsApiToken()}` }),
      ...(requestOptions.body ? { "Content-Type": "application/json" } : {}),
      ...(requestOptions.headers ?? {}),
    },
  });
  const text = await response.text();
  let payload: CmsEnvelope<T> | null = null;
  if (text) {
    try { payload = JSON.parse(text) as CmsEnvelope<T>; }
    catch { throw new Error(`CMS returned an invalid JSON response (${response.status}).`); }
  }
  if (!response.ok || !payload?.ok || payload.data === undefined) {
    throw new Error(payload?.error?.message ?? `CMS request failed with ${response.status}.`);
  }
  return payload.data;
}
