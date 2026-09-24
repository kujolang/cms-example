import { hasCapability, studioUsersFor, type CmsCapability, type StudioUser } from "./cms-auth";
import { getRegistrationSettings, getSocialSharingSettings, listCmsRoles } from "./cms-user-store";

const CMS_BASE_URL = process.env.CMS_BASE_URL ?? "http://127.0.0.1:4200";
const CMS_API_TOKEN = process.env.CMS_API_TOKEN ?? "change-me-in-production";

type CmsEnvelope<T> = { ok: boolean; data?: T; error?: { message?: string } };
const inFlightReads = new Map<string, Promise<unknown>>();
const waitingReaders: Array<() => void> = [];
let activeReaders = 0;
const MAX_CONCURRENT_READS = 3;

export type StudioView = "dashboard" | "content" | "new" | "edit" | "taxonomies" | "seo" | "ai" | "themes" | "plugins" | "users" | "userNew" | "userEdit";
export type Term = { id: number; name: string; slug: string };
export type Taxonomy = { id: number; taxonomy_key: string; label: string; description: string; hierarchical?: number | boolean; terms: Term[] };
export type ContentType = { id: number; type_key: string; label: string; singular_label: string; description: string };
export type Entry = { id: number; content_type_key: string; title: string; slug: string; status: string; excerpt: string; body: string; meta_json: string; author_id: string; terms?: Term[]; updated_at: string | number; published_at?: string | number | null; unpublish_at?: string | number | null };
export type Media = { id: number; filename: string; storage_path: string; alt_text: string };
export type StudioAuthor = Pick<StudioUser, "id" | "name" | "role">;
export type CmsRoleRecord = { id: number; role_key: string; name: string; permissions_json: string; is_system: number };
export type RegistrationSettings = { mode: "open" | "approval" | "closed"; default_role: string };
export type SocialSharingSettings = { networks: string[]; content_types: string[]; accounts: Record<string, string> };
export type NavigationContribution = { key: string; label: string; href: string; order: number; capability: string; icon?: string; source_icon?: string; source: "theme" | "plugin"; source_key: string };
export type SeoFields = { title: string; description: string; focus_keyword: string; canonical_url: string; og_image_url: string; social_title: string; social_description: string; schema_type: string; robots: string; title_length: number; description_length: number };
export type SeoItem = { id: number; content_type_key: string; title: string; slug: string; status: string; author_id: string; updated_at: string | number; word_count: number; term_count: number; url: string; readiness: "ready" | "needs_work"; score: number; issues: string[]; seo: SeoFields };
export type SeoReport = { items: SeoItem[]; total: number; limit: number; offset: number; summary: { total: number; missing_titles: number; missing_descriptions: number; missing_keywords: number; missing_social_images: number; missing_terms: number } };
export type Ability = { name: string; label: string; description: string; category: string; permission: string; enabled: boolean; manageable: boolean; source: string; source_name?: string; definition_digest: string; definition: { id: string; version: string; idempotency: { mode: "intrinsic" | "keyed" | "none" } }; annotations: { readonly: boolean; destructive: boolean; idempotent: boolean; requires_confirmation: boolean } };
export type Connector = { key: string; label: string; purpose: string; mode: string; configured: boolean; enabled: boolean; manageable: boolean; source: string; source_name?: string; status: string; approval_required: boolean; secret_storage: string };
export type AiControlPlane = { abilities: { items: Ability[]; count: number }; connectors: { items: Connector[]; count: number; secrets_exposed: boolean }; mcp: { tools: unknown[]; count: number; protocol: string }; webmcp: { enabled: boolean; automatic: boolean; tools: unknown[]; security: { published_only: boolean; read_only: boolean } }; extensions: { abilities: Array<Record<string, unknown>>; connectors: Array<Record<string, unknown>>; counts: { abilities: number; connectors: number } } };
export type ExtensionManifest = { key: string; name: string; version: string; description?: string; author?: { name?: string; url?: string }; distribution?: { repository?: string; homepage?: string }; admin?: { icon?: string }; supports?: string[]; capabilities?: string[]; runtime?: string };
export type InstalledExtension = { id: number; status: "active" | "inactive"; manifest: ExtensionManifest; package?: { filename?: string; size_bytes?: number; sha256?: string } | null; updated_at?: string | number };
export type ExtensionData = { catalog: { themes: InstalledExtension[]; plugins: InstalledExtension[]; counts: { themes: number; plugins: number } }; contracts: { package?: { max_archive_bytes?: number; max_files?: number } } };

export type StudioData = {
  entries: Entry[];
  contentTypes: ContentType[];
  taxonomies: Taxonomy[];
  media: Media[];
  currentUser: StudioUser;
  authors: StudioAuthor[];
  users: StudioUser[];
  roles: CmsRoleRecord[];
  registration: RegistrationSettings | null;
  socialSharing: SocialSharingSettings | null;
  navigation: NavigationContribution[];
  seoReport: SeoReport | null;
  ai: AiControlPlane | null;
  extensions: ExtensionData | null;
};

export async function cmsStudioRequest<T>(pathname: string, options: RequestInit = {}): Promise<T> {
  const isRead = !options.method || options.method === "GET";
  const existing = isRead ? inFlightReads.get(pathname) : undefined;
  if (existing) return await existing as T;
  const operation = (async () => {
    if (isRead && activeReaders >= MAX_CONCURRENT_READS) await new Promise<void>((resolve) => waitingReaders.push(resolve));
    if (isRead) activeReaders += 1;
    try {
      const upstream = await fetch(new URL(pathname, CMS_BASE_URL), {
        ...options,
        cache: "no-store",
        headers: { Accept: "application/json", Authorization: `Bearer ${CMS_API_TOKEN}`, ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers ?? {}) },
      });
      const payload = await upstream.json() as CmsEnvelope<T>;
      if (!upstream.ok || !payload.ok || payload.data === undefined) throw new Error(payload.error?.message ?? `CMS request failed with ${upstream.status}`);
      return payload.data;
    } finally {
      if (isRead) {
        activeReaders -= 1;
        waitingReaders.shift()?.();
      }
    }
  })();
  if (isRead) inFlightReads.set(pathname, operation);
  try { return await operation; }
  finally { if (isRead && inFlightReads.get(pathname) === operation) inFlightReads.delete(pathname); }
}

async function loadTaxonomies() {
  const taxonomies = await cmsStudioRequest<{ items: Array<Omit<Taxonomy, "terms">> }>("/v1/taxonomies?limit=200&sort_by=taxonomy_key&sort_dir=asc");
  return await Promise.all(taxonomies.items.map(async (taxonomy) => ({
    ...taxonomy,
    terms: (await cmsStudioRequest<{ items: Term[] }>(`/v1/taxonomies/${taxonomy.id}/terms?limit=200&sort_by=name&sort_dir=asc`)).items,
  })));
}

const needsEntries = new Set<StudioView>(["dashboard", "content", "edit"]);
const needsModels = new Set<StudioView>(["content", "new", "edit", "seo"]);
const needsTaxonomies = new Set<StudioView>(["content", "new", "edit", "taxonomies"]);
const needsAuthors = new Set<StudioView>(["new", "edit"]);
const needsUsers = new Set<StudioView>(["users", "userNew", "userEdit"]);

export async function loadStudioData(request: Request, currentUser: StudioUser, view: StudioView = "dashboard"): Promise<StudioData> {
  const [entries, contentTypes, taxonomies, media, navigation, configuredUsers, rolesAndRegistration, socialSharing, seoReport, ai, extensions] = await Promise.all([
    needsEntries.has(view) ? cmsStudioRequest<{ items: Entry[] }>("/v1/entries?include=terms&limit=200&sort_by=updated_at&sort_dir=desc") : null,
    needsModels.has(view) ? cmsStudioRequest<{ items: ContentType[] }>("/v1/content-types?limit=200&sort_by=type_key&sort_dir=asc") : null,
    needsTaxonomies.has(view) ? loadTaxonomies() : null,
    view === "new" || view === "edit" ? cmsStudioRequest<{ items: Array<Media & { meta_json?: string }> }>("/v1/media?limit=200&sort_by=updated_at&sort_dir=desc") : null,
    cmsStudioRequest<{ items: NavigationContribution[] }>("/v1/extensions/navigation"),
    needsAuthors.has(view) || needsUsers.has(view) ? studioUsersFor(request, currentUser) : null,
    needsUsers.has(view) && hasCapability(currentUser, "manage_users") ? Promise.all([listCmsRoles(), getRegistrationSettings()]) : null,
    view === "seo" && hasCapability(currentUser, "manage_seo") ? getSocialSharingSettings() : null,
    view === "seo" && hasCapability(currentUser, "manage_seo") ? cmsStudioRequest<SeoReport>("/v1/seo/entries?limit=25&offset=0&sort_by=updated_at&sort_dir=desc") : null,
    view === "ai" && hasCapability(currentUser, "manage_extensions") ? Promise.all([
      cmsStudioRequest<AiControlPlane["abilities"]>("/v1/abilities"),
      cmsStudioRequest<AiControlPlane["connectors"]>("/v1/ai/connectors"),
      cmsStudioRequest<AiControlPlane["mcp"]>("/v1/ai/mcp/tools"),
      cmsStudioRequest<AiControlPlane["webmcp"]>("/v1/webmcp"),
      cmsStudioRequest<AiControlPlane["extensions"]>("/v1/extensions/ai"),
    ]) : null,
    (view === "themes" || view === "plugins") && hasCapability(currentUser, "manage_extensions") ? Promise.all([
      cmsStudioRequest<ExtensionData["catalog"]>("/v1/extensions/manage"),
      cmsStudioRequest<ExtensionData["contracts"]>("/v1/extensions/contracts"),
    ]) : null,
  ]);
  const users = configuredUsers ?? [];
  return {
    entries: entries?.items ?? [],
    contentTypes: contentTypes?.items ?? [],
    taxonomies: taxonomies ?? [],
    media: (media?.items ?? []).map(({ id, filename, storage_path, alt_text }) => ({ id, filename, storage_path, alt_text })),
    currentUser,
    authors: users.filter((user) => user.status === "active" && ["Administrator", "Editor", "Author"].includes(user.role)).map(({ id, name, role }) => ({ id, name, role })),
    users: needsUsers.has(view) && hasCapability(currentUser, "manage_users") ? users : [],
    roles: rolesAndRegistration?.[0] ?? [],
    registration: rolesAndRegistration?.[1] ?? null,
    socialSharing,
    navigation: navigation.items,
    seoReport,
    ai: ai ? { abilities: ai[0], connectors: ai[1], mcp: ai[2], webmcp: ai[3], extensions: ai[4] } : null,
    extensions: extensions ? { catalog: extensions[0], contracts: extensions[1] } : null,
  };
}

export function viewForMutation(action: unknown): StudioView {
  if (["createTaxonomy", "createTerm", "createTerms"].includes(String(action))) return "taxonomies";
  if (["createUser", "updateUser", "updateRegistration"].includes(String(action))) return "users";
  if (action === "updateSocialSharing") return "seo";
  return "edit";
}

export function isStudioView(value: string | null): value is StudioView {
  return value !== null && ["dashboard", "content", "new", "edit", "taxonomies", "seo", "ai", "themes", "plugins", "users", "userNew", "userEdit"].includes(value);
}

export type { CmsCapability, StudioUser };
