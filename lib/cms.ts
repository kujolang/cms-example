export const CMS_BASE_URL =
  process.env.CMS_BASE_URL ?? "http://127.0.0.1:4200";

type CmsEnvelope<T> = {
  ok: boolean;
  data: T;
};

export type CmsEntry = {
  id: number;
  content_type_key: string;
  title: string;
  slug: string;
  status: string;
  excerpt: string;
  body: string;
  meta_json: string;
  author_id: string;
  published_at: string | number | null;
  updated_at: string | number;
  terms?: Array<{ id: number; name: string; slug: string }>;
};

export type CmsList<T> = {
  items: T[];
  count: number;
  total: number;
};

export type CmsHealth = {
  status: string;
  db: string;
  counts: Record<string, number>;
};

export type CmsContentType = {
  id: number;
  type_key: string;
  label: string;
  singular_label: string;
  description: string;
  is_system: number;
};

export type CmsTaxonomy = {
  id: number;
  taxonomy_key: string;
  label: string;
  description: string;
};

async function cmsGet<T>(path: string): Promise<T> {
  const response = await fetch(new URL(path, CMS_BASE_URL), {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`CMS request failed with ${response.status}`);
  }

  const payload = (await response.json()) as CmsEnvelope<T>;
  if (!payload.ok) throw new Error("CMS returned an unsuccessful response");
  return payload.data;
}

export function getArticles() {
  return cmsGet<CmsList<CmsEntry>>(
    "/v1/entries?content_type=article&include=terms&sort_by=published_at&sort_dir=desc",
  );
}

export function getPages() {
  return cmsGet<CmsList<CmsEntry>>(
    "/v1/entries?content_type=page&sort_by=title&sort_dir=asc",
  );
}

export async function getArticle(slug: string) {
  try {
    return await cmsGet<CmsEntry>(
      `/v1/entries/by-slug/article/${encodeURIComponent(slug)}`,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) return null;
    throw error;
  }
}

export async function getPage(slug: string) {
  try {
    return await cmsGet<CmsEntry>(
      `/v1/entries/by-slug/page/${encodeURIComponent(slug)}`,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) return null;
    throw error;
  }
}

export function getEntryMeta(entry: CmsEntry): Record<string, unknown> {
  try {
    const value = JSON.parse(entry.meta_json || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export function getEntrySeo(entry: CmsEntry) {
  const meta = getEntryMeta(entry);
  const seo = meta.seo && typeof meta.seo === "object" ? meta.seo as Record<string, unknown> : {};
  return {
    title: typeof seo.title === "string" && seo.title ? seo.title : entry.title,
    description: typeof seo.description === "string" && seo.description ? seo.description : entry.excerpt,
    canonicalUrl: typeof seo.canonical_url === "string" ? seo.canonical_url : "",
    image: typeof seo.og_image_url === "string" && seo.og_image_url
      ? seo.og_image_url
      : typeof meta.cover_image === "string" ? meta.cover_image : "",
    schemaType: typeof seo.schema_type === "string" ? seo.schema_type : "",
  };
}

export function getCmsHealth() {
  return cmsGet<CmsHealth>("/health");
}

export function getContentTypes() {
  return cmsGet<CmsList<CmsContentType>>(
    "/v1/content-types?sort_by=type_key&sort_dir=asc",
  );
}

export function getTaxonomies() {
  return cmsGet<CmsList<CmsTaxonomy>>(
    "/v1/taxonomies?sort_by=taxonomy_key&sort_dir=asc",
  );
}

export function formatCmsDate(value: string | number | null) {
  if (value === null || value === "") return "Unscheduled";
  const numeric = Number(value);
  const timestamp = Number.isFinite(numeric) && numeric < 1_000_000_000_000
    ? numeric * 1000
    : numeric;
  const date = Number.isFinite(timestamp) ? new Date(timestamp) : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
