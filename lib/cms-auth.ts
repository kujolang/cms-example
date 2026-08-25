import {
  createCmsUser,
  derivePassword,
  ensureLocalDemoUsers,
  findCmsUserByEmail,
  getCmsUser,
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
  | "manage_users";

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

type SessionPayload = { sub: string; exp: number };
export const CMS_SESSION_COOKIE = "kujo_cms_session";

const ROLE_CAPABILITIES: Record<StudioRole, CmsCapability[]> = {
  Administrator: ["view_content", "edit_content", "publish_content", "manage_taxonomies", "manage_seo", "upload_media", "manage_users"],
  Editor: ["view_content", "edit_content", "publish_content", "manage_seo", "upload_media"],
  Author: ["view_content", "edit_content", "publish_content", "upload_media"],
  Viewer: ["view_content"],
  Subscriber: [],
};

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
    capabilities: ROLE_CAPABILITIES[role],
    source,
    createdAt: record.created_at,
    lastLoginAt: record.last_login_at,
  };
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function sessionSecret(request: Request) {
  const configured = process.env.CMS_STUDIO_SESSION_SECRET;
  if (configured && configured.length >= 32) return configured;
  return isLoopback(new URL(request.url).hostname) ? "kujo-local-demo-session-secret-rotate-before-deployment" : "";
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64UrlEncode(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

async function signaturesMatch(left: string, right: string) {
  const [leftBytes, rightBytes] = [new TextEncoder().encode(left), new TextEncoder().encode(right)];
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) difference |= leftBytes[index] ^ rightBytes[index];
  return difference === 0;
}

export async function createSessionToken(request: Request, user: StudioUser) {
  const secret = sessionSecret(request);
  if (!secret) throw new Error("CMS_STUDIO_SESSION_SECRET must be configured for non-local authentication.");
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ sub: user.id, exp: Date.now() + 8 * 60 * 60 * 1000 } satisfies SessionPayload)));
  return `${payload}.${await sign(payload, secret)}`;
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}

async function sessionUser(request: Request): Promise<StudioUser | null> {
  const token = cookieValue(request, CMS_SESSION_COOKIE);
  const secret = sessionSecret(request);
  if (!token || !secret) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !(await signaturesMatch(signature, await sign(payload, secret)))) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as SessionPayload;
    if (!parsed.sub || parsed.exp <= Date.now()) return null;
    const record = await getCmsUser(Number(parsed.sub));
    return record.status === "active" ? studioUserFromRecord(record) : null;
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
  return record.status === "active" ? studioUserFromRecord(record, "platform") : null;
}

export async function authenticateStudioRequest(request: Request) {
  return await platformUser(request) ?? await sessionUser(request);
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
