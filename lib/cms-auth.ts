import {
  createCmsUser,
  derivePassword,
  ensureLocalDemoUsers,
  findCmsUserByEmail,
  getCmsUserCredential,
  getRegistrationSettings,
  listCmsUsers,
  updateCmsUser,
  verifyPassword,
  type CmsUserRecord,
} from "./cms-user-store";

export type CmsCapability =
  | "view_content"
  | "edit_content"
  | "publish_content"
  | "manage_taxonomies"
  | "manage_seo"
  | "upload_media"
  | "manage_users"
  | "manage_extensions";

export type StudioRole = "Administrator" | "Editor" | "Author" | "Viewer" | "Subscriber";

export type StudioUser = {
  id: string;
  name: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  bio: string;
  websiteUrl: string;
  avatarUrl: string;
  social: Record<string, string>;
  role: StudioRole;
  roleKey: string;
  status: CmsUserRecord["status"];
  capabilities: CmsCapability[];
  source: "cms" | "platform";
  createdAt: string;
  lastLoginAt: string | null;
};

export const CMS_SESSION_COOKIE = "kujo_cms_session";
const CMS_BASE_URL = process.env.CMS_BASE_URL ?? "http://127.0.0.1:4200";
const CMS_API_TOKEN = process.env.CMS_API_TOKEN ?? "change-me-in-production";

const ROLE_NAMES: Record<string, StudioRole> = {
  super_admin: "Administrator",
  administrator: "Administrator",
  editor: "Editor",
  author: "Author",
  viewer: "Viewer",
  subscriber: "Subscriber",
};

function isLoopback(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function safeSocial(value: string) {
  try {
    const parsed = JSON.parse(value || "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
      : {};
  } catch {
    return {};
  }
}

export function studioUserFromRecord(record: CmsUserRecord, source: StudioUser["source"] = "cms"): StudioUser {
  const role = ROLE_NAMES[record.role_key] ?? "Subscriber";
  return {
    id: String(record.id),
    name: record.display_name,
    email: record.email,
    username: record.username,
    firstName: record.first_name,
    lastName: record.last_name,
    bio: record.bio,
    websiteUrl: record.website_url,
    avatarUrl: record.avatar_url,
    social: safeSocial(record.social_json),
    role,
    roleKey: record.role_key,
    status: record.status,
    capabilities: [],
    source,
    createdAt: record.created_at,
    lastLoginAt: record.last_login_at,
  };
}

type IdentityUser = CmsUserRecord & { role_name: string; capabilities: CmsCapability[] };
type IdentityEnvelope<T> = { ok: boolean; data?: T; error?: { message?: string } };

function studioUserFromIdentity(record: IdentityUser, source: StudioUser["source"] = "cms"): StudioUser {
  return { ...studioUserFromRecord(record, source), role: (ROLE_NAMES[record.role_key] ?? record.role_name ?? "Subscriber") as StudioRole, capabilities: record.capabilities };
}

async function identityRequest<T>(path: string, options: RequestInit = {}, session = "") {
  const response = await fetch(new URL(path, CMS_BASE_URL), { ...options, cache: "no-store", headers: { Accept: "application/json", ...(session ? { "X-CMS-Session": session } : { Authorization: `Bearer ${CMS_API_TOKEN}` }), ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers ?? {}) } });
  const text = await response.text(); let payload: IdentityEnvelope<T> | null = null;
  if (text) { try { payload = JSON.parse(text) as IdentityEnvelope<T>; } catch { throw new Error(`CMS returned an invalid identity response (${response.status}).`); } }
  if (!response.ok || !payload?.ok || payload.data === undefined) throw new Error(payload?.error?.message ?? `CMS identity request failed with ${response.status}`);
  return payload.data;
}

export async function createSessionToken(_request: Request, user: StudioUser) {
  const result = await identityRequest<{ user: IdentityUser; session: { token: string; ttl_seconds: number } }>("/v1/auth/sessions", { method: "POST", body: JSON.stringify({ user_id: Number(user.id), provider: "password", provider_subject: user.id, ttl_seconds: 28_800 }) });
  return { token: result.session.token, user: studioUserFromIdentity(result.user) };
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}

async function sessionUser(request: Request): Promise<StudioUser | null> {
  const token = cookieValue(request, CMS_SESSION_COOKIE);
  if (!token) return null;
  try {
    const result = await identityRequest<{ authenticated: true; user: IdentityUser }>("/v1/auth/me", {}, token);
    return studioUserFromIdentity(result.user);
  } catch {
    return null;
  }
}

async function platformUser(request: Request): Promise<StudioUser | null> {
  const id = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email")?.toLowerCase();
  if (!id || !email) return null;
  let record = await findCmsUserByEmail(email);
  if (!record) {
    const settings = await getRegistrationSettings();
    const encodedName = request.headers.get("oai-authenticated-user-full-name");
    let displayName = email.split("@")[0];
    if (encodedName && request.headers.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8") {
      try { displayName = decodeURIComponent(encodedName); } catch { /* use email fallback */ }
    }
    const username = `platform-${id.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48)}`;
    const credential = await derivePassword(crypto.randomUUID());
    record = await createCmsUser({ user_key: username, username, email, display_name: displayName, role_key: settings.default_role, status: "active", approved_by: "platform-identity", ...credential, social: {} });
  }
  if (record.status !== "active") return null;
  try {
    const result = await identityRequest<{ authenticated: boolean; user: IdentityUser }>("/v1/auth/providers/resolve", { method: "POST", body: JSON.stringify({ provider: "platform", provider_subject: id, user_id: record.id }) });
    return result.authenticated ? studioUserFromIdentity(result.user, "platform") : null;
  } catch { return null; }
}

export async function authenticateStudioRequest(request: Request) {
  return await platformUser(request) ?? await sessionUser(request);
}

export async function revokeStudioSession(request: Request) {
  const token = cookieValue(request, CMS_SESSION_COOKIE);
  if (!token) return;
  try { await identityRequest("/v1/auth/session", { method: "DELETE" }, token); } catch { /* cookie is cleared even if the session already expired */ }
}

export async function studioUsersFor(request: Request, currentUser?: StudioUser | null) {
  await ensureLocalDemoUsers(request);
  const users = (await listCmsUsers()).map((user) => studioUserFromRecord(user));
  if (currentUser && !users.some((user) => user.id === currentUser.id)) users.push(currentUser);
  return users;
}

export async function authenticateLocalCredentials(request: Request, email: string, password: string) {
  if (!isLoopback(new URL(request.url).hostname) && !process.env.CMS_STUDIO_ALLOW_PASSWORD_LOGIN) return { user: null, error: "Password login is not enabled for this site." };
  await ensureLocalDemoUsers(request);
  const record = await findCmsUserByEmail(email);
  if (!record) return { user: null, error: "The email or password is incorrect." };
  if (record.status === "pending") return { user: null, error: "Your account is waiting for approval." };
  if (record.status === "rejected") return { user: null, error: "This account registration was not approved." };
  if (record.status === "suspended") return { user: null, error: "This account is suspended." };
  const credential = await getCmsUserCredential(record.id);
  if (!(await verifyPassword(password, credential))) return { user: null, error: "The email or password is incorrect." };
  const updated = await updateCmsUser(record.id, { last_login_at: new Date().toISOString() });
  return { user: studioUserFromRecord(updated), error: "" };
}

export function hasCapability(user: StudioUser, capability: CmsCapability) {
  return user.capabilities.includes(capability);
}

export function sessionCookie(request: Request, token: string, maxAge = 8 * 60 * 60) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${CMS_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}
