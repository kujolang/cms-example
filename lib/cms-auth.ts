export type CmsCapability =
  | "view_content"
  | "edit_content"
  | "publish_content"
  | "manage_taxonomies"
  | "manage_seo"
  | "upload_media"
  | "manage_users";

export type StudioUser = {
  id: string;
  name: string;
  email: string;
  role: "Administrator" | "Editor" | "Viewer";
  capabilities: CmsCapability[];
  source: "local" | "platform";
};

type ConfiguredUser = StudioUser & { password?: string; active?: boolean };
type SessionPayload = { sub: string; exp: number };

export const CMS_SESSION_COOKIE = "kujo_cms_session";

const ROLE_CAPABILITIES: Record<StudioUser["role"], CmsCapability[]> = {
  Administrator: ["view_content", "edit_content", "publish_content", "manage_taxonomies", "manage_seo", "upload_media", "manage_users"],
  Editor: ["view_content", "edit_content", "publish_content", "manage_seo", "upload_media"],
  Viewer: ["view_content"],
};

const LOCAL_DEMO_USERS: ConfiguredUser[] = [
  { id: "editorial-team", name: "Editorial Team", email: "admin@fieldnotes.local", role: "Administrator", capabilities: ROLE_CAPABILITIES.Administrator, source: "local", password: "fieldnotes-demo", active: true },
  { id: "maya-chen", name: "Maya Chen", email: "editor@fieldnotes.local", role: "Editor", capabilities: ROLE_CAPABILITIES.Editor, source: "local", password: "editor-demo", active: true },
];

function isLoopback(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function configuredUsers(request: Request): ConfiguredUser[] {
  const raw = process.env.CMS_STUDIO_USERS_JSON;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Array<Partial<ConfiguredUser>>;
      return parsed.filter((user) => user.id && user.email && user.name).map((user) => {
        const role = user.role && ROLE_CAPABILITIES[user.role] ? user.role : "Viewer";
        return {
          id: String(user.id),
          name: String(user.name),
          email: String(user.email).toLowerCase(),
          role,
          capabilities: Array.isArray(user.capabilities) ? user.capabilities.filter((capability): capability is CmsCapability => ROLE_CAPABILITIES.Administrator.includes(capability as CmsCapability)) : ROLE_CAPABILITIES[role],
          source: "local",
          password: user.password ? String(user.password) : undefined,
          active: user.active !== false,
        };
      });
    } catch {
      return [];
    }
  }
  return isLoopback(new URL(request.url).hostname) ? LOCAL_DEMO_USERS : [];
}

function publicUser(user: ConfiguredUser): StudioUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role, capabilities: user.capabilities, source: user.source };
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
    const user = configuredUsers(request).find((candidate) => candidate.id === parsed.sub && candidate.active !== false);
    return user ? publicUser(user) : null;
  } catch {
    return null;
  }
}

function platformUser(request: Request): StudioUser | null {
  const id = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email");
  if (!id || !email) return null;
  const configured = configuredUsers(request).find((candidate) => candidate.id === id || candidate.email === email.toLowerCase());
  const role = configured?.role ?? (process.env.CMS_STUDIO_PLATFORM_DEFAULT_ROLE === "Editor" ? "Editor" : "Viewer");
  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const name = configured?.name ?? (encodedName && request.headers.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8" ? decodeURIComponent(encodedName) : email);
  return { id, email, name, role, capabilities: configured?.capabilities ?? ROLE_CAPABILITIES[role], source: "platform" };
}

export async function authenticateStudioRequest(request: Request) {
  return platformUser(request) ?? await sessionUser(request);
}

export function studioUsersFor(request: Request, currentUser?: StudioUser | null) {
  const users = configuredUsers(request).filter((user) => user.active !== false).map(publicUser);
  if (currentUser && !users.some((user) => user.id === currentUser.id)) users.push(currentUser);
  return users;
}

export async function authenticateLocalCredentials(request: Request, email: string, password: string) {
  if (!isLoopback(new URL(request.url).hostname)) return null;
  const user = configuredUsers(request).find((candidate) => candidate.active !== false && candidate.email === email.toLowerCase());
  if (!user?.password) return null;
  const [candidateHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(password)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(user.password)),
  ]);
  return signaturesMatch(base64UrlEncode(new Uint8Array(candidateHash)), base64UrlEncode(new Uint8Array(expectedHash))) ? publicUser(user) : null;
}

export function hasCapability(user: StudioUser, capability: CmsCapability) {
  return user.capabilities.includes(capability);
}

export function sessionCookie(request: Request, token: string, maxAge = 8 * 60 * 60) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${CMS_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}
