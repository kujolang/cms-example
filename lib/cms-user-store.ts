const CMS_BASE_URL = process.env.CMS_BASE_URL ?? "http://127.0.0.1:4200";
const CMS_API_TOKEN = process.env.CMS_API_TOKEN ?? "change-me-in-production";

type CmsEnvelope<T> = { ok: boolean; data?: T; error?: { message?: string } };

export type CmsUserRecord = {
  id: number;
  user_key: string;
  email: string;
  username: string;
  display_name: string;
  first_name: string;
  last_name: string;
  bio: string;
  website_url: string;
  avatar_url: string;
  social_json: string;
  role_key: string;
  status: "pending" | "active" | "suspended" | "rejected";
  email_verified_at: string | null;
  approved_at: string | null;
  approved_by: string;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CmsRoleRecord = { id: number; role_key: string; name: string; permissions_json: string; is_system: number };
export type RegistrationSettings = { mode: "open" | "approval" | "closed"; default_role: string };
export type SocialSharingSettings = { networks: string[]; content_types: string[]; accounts: Record<string, string> };
export type PasswordCredential = { id: number; password_hash: string; password_salt: string; password_iterations: number };
export type CmsUserInput = Partial<Omit<CmsUserRecord, "id" | "created_at" | "updated_at" | "social_json">> & {
  social?: Record<string, string>;
  password_hash?: string;
  password_salt?: string;
  password_iterations?: number;
};

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
  const payload = await upstream.json() as CmsEnvelope<T>;
  if (!upstream.ok || !payload.ok || payload.data === undefined) throw new Error(payload.error?.message ?? `CMS user request failed with ${upstream.status}`);
  return payload.data;
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function derivePassword(password: string, salt = base64Url(crypto.getRandomValues(new Uint8Array(24))), iterations = 210_000) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: decodeBase64Url(salt), iterations }, key, 256);
  return { password_hash: base64Url(new Uint8Array(bits)), password_salt: salt, password_iterations: iterations };
}

function constantTimeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

export async function verifyPassword(password: string, credential: PasswordCredential) {
  const derived = await derivePassword(password, credential.password_salt, Number(credential.password_iterations));
  return constantTimeEqual(derived.password_hash, credential.password_hash);
}

export async function listCmsUsers(query = "") {
  const list = await cmsRequest<{ items: CmsUserRecord[] }>(`/v1/users?limit=200${query ? `&${query}` : ""}`);
  return list.items;
}

export async function getCmsUser(id: number) {
  return cmsRequest<CmsUserRecord>(`/v1/users/${id}`);
}

export async function findCmsUserByEmail(email: string) {
  const normalized = email.toLowerCase();
  const users = await listCmsUsers();
  return users.find((user) => user.email.toLowerCase() === normalized) ?? null;
}

export function createCmsUser(input: CmsUserInput) {
  return cmsRequest<CmsUserRecord>("/v1/users", { method: "POST", body: JSON.stringify(input) });
}

export function updateCmsUser(id: number, input: CmsUserInput) {
  return cmsRequest<CmsUserRecord>(`/v1/users/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function getCmsUserCredential(id: number) {
  return cmsRequest<PasswordCredential>(`/v1/users/${id}/credentials`);
}

export async function listCmsRoles() {
  const list = await cmsRequest<{ items: CmsRoleRecord[] }>("/v1/auth/roles?limit=200");
  return list.items;
}

export function getRegistrationSettings() {
  return cmsRequest<RegistrationSettings>("/v1/settings/registration");
}

export function updateRegistrationSettings(settings: RegistrationSettings) {
  return cmsRequest<RegistrationSettings>("/v1/settings/registration", { method: "PATCH", body: JSON.stringify(settings) });
}

export function getSocialSharingSettings() {
  return cmsRequest<SocialSharingSettings>("/v1/settings/social-sharing");
}

export function updateSocialSharingSettings(settings: SocialSharingSettings) {
  return cmsRequest<SocialSharingSettings>("/v1/settings/social-sharing", { method: "PATCH", body: JSON.stringify(settings) });
}

export async function ensureLocalDemoUsers(request: Request) {
  const hostname = new URL(request.url).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) return;
  const demos = [
    { user_key: "editorial-team", username: "editorial-team", email: "admin@fieldnotes.local", display_name: "Editorial Team", first_name: "Editorial", last_name: "Team", role_key: "super_admin", password: "fieldnotes-demo", bio: "Site administrator and publishing lead." },
    { user_key: "maya-chen", username: "maya-chen", email: "editor@fieldnotes.local", display_name: "Maya Chen", first_name: "Maya", last_name: "Chen", role_key: "editor", password: "editor-demo", bio: "Editor focused on practical agentic systems." },
  ];
  const current = await listCmsUsers();
  for (const demo of demos) {
    if (current.some((user) => user.email === demo.email)) continue;
    const credential = await derivePassword(demo.password);
    try {
      await createCmsUser({ ...demo, password: undefined, ...credential, status: "active", approved_by: "local-bootstrap", social: {} } as CmsUserInput);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.toLowerCase().includes("already exists")) throw error;
    }
  }
}
