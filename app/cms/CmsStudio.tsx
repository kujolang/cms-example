"use client";
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState, type ReactNode, type SelectHTMLAttributes } from "react";
import {
  IconArticle,
  IconBold,
  IconChartDots3,
  IconChevronDown,
  IconChevronRight,
  IconCode,
  IconDeviceFloppy,
  IconEdit,
  IconExternalLink,
  IconFileDescription,
  IconFileText,
  IconH2,
  IconItalic,
  IconLayoutDashboard,
  IconLink,
  IconList,
  IconLogout,
  IconPhoto,
  IconPlus,
  IconSearch,
  IconTags,
  IconTrash,
  IconUpload,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";

type Term = { id: number; name: string; slug: string };
type Taxonomy = { id: number; taxonomy_key: string; label: string; description: string; hierarchical?: number | boolean; terms: Term[] };
type ContentType = { id: number; type_key: string; label: string; singular_label: string; description: string };
type Entry = {
  id: number;
  content_type_key: string;
  title: string;
  slug: string;
  status: string;
  excerpt: string;
  body: string;
  meta_json: string;
  author_id: string;
  terms?: Term[];
  updated_at: string | number;
  published_at?: string | number | null;
  unpublish_at?: string | number | null;
};
type Media = { id: number; filename: string; storage_path: string; alt_text: string };
type Capability = "view_content" | "edit_content" | "publish_content" | "manage_taxonomies" | "manage_seo" | "upload_media" | "manage_users";
type StudioUser = { id: string; name: string; email: string; role: string; capabilities: Capability[]; source: "local" | "platform" };
type StudioAuthor = Pick<StudioUser, "id" | "name" | "role">;
type StudioData = { entries: Entry[]; contentTypes: ContentType[]; taxonomies: Taxonomy[]; media: Media[]; currentUser: StudioUser; authors: StudioAuthor[]; users: StudioUser[] };
type FormState = {
  id: number;
  contentType: string;
  title: string;
  slug: string;
  status: string;
  excerpt: string;
  body: string;
  author: string;
  readingTime: string;
  publishAt: string;
  unpublishAt: string;
  coverImage: string;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  ogImage: string;
  schemaType: string;
  customMeta: string;
  termIds: number[];
};

const emptyForm = (contentType = "article"): FormState => ({
  id: 0,
  contentType,
  title: "",
  slug: "",
  status: "draft",
  excerpt: "",
  body: "# Start with a clear idea\n\nWrite the opening paragraph here.",
  author: "editorial-team",
  readingTime: "",
  publishAt: "",
  unpublishAt: "",
  coverImage: "",
  seoTitle: "",
  seoDescription: "",
  canonicalUrl: "",
  ogImage: "",
  schemaType: contentType === "page" ? "WebPage" : "Article",
  customMeta: "{}",
  termIds: [],
});

function parseMeta(entry: Entry) {
  try {
    return JSON.parse(entry.meta_json || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function formFromEntry(entry: Entry): FormState {
  const meta = parseMeta(entry);
  const seo = typeof meta.seo === "object" && meta.seo ? meta.seo as Record<string, unknown> : {};
  const customMeta = Object.fromEntries(Object.entries(meta).filter(([key]) => !["seo", "cover_image", "reading_time"].includes(key)));
  return {
    id: entry.id,
    contentType: String(entry.content_type_key ?? "article"),
    title: String(entry.title ?? ""),
    slug: String(entry.slug ?? ""),
    status: String(entry.status ?? "draft"),
    excerpt: String(entry.excerpt ?? ""),
    body: String(entry.body ?? ""),
    author: String(entry.author_id ?? "editorial-team"),
    readingTime: String(meta.reading_time ?? ""),
    publishAt: toDateTimeLocal(entry.published_at),
    unpublishAt: toDateTimeLocal(entry.unpublish_at),
    coverImage: String(meta.cover_image ?? ""),
    seoTitle: String(seo.title ?? ""),
    seoDescription: String(seo.description ?? ""),
    canonicalUrl: String(seo.canonical_url ?? ""),
    ogImage: String(seo.og_image_url ?? meta.cover_image ?? ""),
    schemaType: String(seo.schema_type ?? (entry.content_type_key === "page" ? "WebPage" : "Article")),
    customMeta: JSON.stringify(customMeta, null, 2),
    termIds: entry.terms?.map((term) => term.id) ?? [],
  };
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

function toDateTimeLocal(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  const numeric = Number(value);
  const timestamp = Number.isFinite(numeric) && numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
  const date = Number.isFinite(timestamp) ? new Date(timestamp) : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 16);
}

async function request<T>(options?: RequestInit): Promise<T> {
  const response = await fetch("/api/cms", options);
  const payload = await response.json() as { ok: boolean; data?: T; error?: string };
  if (response.status === 401) {
    window.location.assign(`/cms/login?returnTo=${encodeURIComponent(window.location.pathname)}`);
    throw new Error("Sign in required.");
  }
  if (!response.ok || !payload.ok || payload.data === undefined) throw new Error(payload.error ?? "CMS request failed");
  return payload.data;
}

async function convertToWebP(file: File) {
  const bitmap = await createImageBitmap(file);
  let maxDimension = 1600;
  let quality = 0.84;
  let blob: Blob | null = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot prepare the image.");
    context.drawImage(bitmap, 0, 0, width, height);
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (blob && blob.size <= 620 * 1024) break;
    maxDimension = Math.round(maxDimension * 0.78);
    quality = Math.max(0.62, quality - 0.07);
  }
  bitmap.close();
  if (!blob || blob.size > 650 * 1024) throw new Error("The image could not be optimized below 650 KB.");
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" });
}

function MarkdownPreview({ markdown }: { markdown: string }) {
  return <div className="studio-preview">{markdown.split(/\n{2,}/).map((block, index) => {
    if (block.startsWith("# ")) return <h1 key={index}>{block.slice(2)}</h1>;
    if (block.startsWith("## ")) return <h2 key={index}>{block.slice(3)}</h2>;
    if (block.startsWith("### ")) return <h3 key={index}>{block.slice(4)}</h3>;
    if (block.split("\n").every((line) => line.startsWith("- "))) return <ul key={index}>{block.split("\n").map((line) => <li key={line}>{line.slice(2)}</li>)}</ul>;
    return <p key={index}>{block}</p>;
  })}</div>;
}

type StudioView = "dashboard" | "content" | "new" | "edit" | "taxonomies" | "seo" | "users";

const navItems = [
  { href: "/cms", label: "Dashboard", view: "dashboard", icon: IconLayoutDashboard },
  { href: "/cms/content", label: "Content", view: "content", icon: IconFileText },
  { href: "/cms/taxonomies", label: "Taxonomies", view: "taxonomies", icon: IconTags },
  { href: "/cms/seo", label: "SEO & sharing", view: "seo", icon: IconChartDots3 },
  { href: "/cms/users", label: "Users & roles", view: "users", icon: IconUsers },
] as const;

function IconButtonLabel({ icon: Icon, children }: { icon: typeof IconPlus; children: ReactNode }) {
  return <><Icon size={17} stroke={1.8} aria-hidden="true" /><span>{children}</span></>;
}

function StyledSelect({ children, className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <div className={`styled-select ${className}`}><select {...props}>{children}</select><IconChevronDown size={17} stroke={1.8} aria-hidden="true" /></div>;
}

export default function CmsStudio({ view = "dashboard", entryId }: { view?: StudioView; entryId?: number }) {
  const [studio, setStudio] = useState<StudioData | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [search, setSearch] = useState("");
  const [editorMode, setEditorMode] = useState<"write" | "preview">("write");
  const [notice, setNotice] = useState("Connecting to Kujo CMS…");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newTerms, setNewTerms] = useState<Record<number, string>>({});
  const [newTaxonomy, setNewTaxonomy] = useState({ label: "", key: "", description: "", hierarchical: false });
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const loadStudio = async () => {
    try {
      const data = await request<StudioData>();
      setStudio(data);
      setNotice("All changes save to the live CMS API.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "CMS unavailable");
    }
  };

  useEffect(() => {
    let active = true;
    void request<StudioData>().then((data) => {
      if (!active) return;
      setStudio(data);
      setNotice("All changes save to the live CMS API.");
      if (view === "new") setForm({ ...emptyForm(data.contentTypes[0]?.type_key ?? "article"), author: data.currentUser.id });
      if (view === "edit") {
        const selected = data.entries.find((entry) => entry.id === entryId);
        if (selected) setForm(formFromEntry(selected));
        else setNotice("That content item could not be found.");
      }
    }).catch((error) => {
      if (active) setNotice(error instanceof Error ? error.message : "CMS unavailable");
    });
    return () => { active = false; };
  }, [entryId, view]);

  const filteredEntries = useMemo(() => (studio?.entries ?? []).filter((entry) => {
    const query = search.trim().toLowerCase();
    return !query || entry.title.toLowerCase().includes(query) || entry.slug.includes(query);
  }), [search, studio]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const insertMarkdown = (before: string, after = "") => {
    const textarea = bodyRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = form.body.slice(start, end) || "text";
    const next = `${form.body.slice(0, start)}${before}${selected}${after}${form.body.slice(end)}`;
    update("body", next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const saveEntry = async () => {
    if (form.title.trim().length < 2 || form.body.trim().length < 1) {
      setNotice("Add a title and body before saving.");
      return;
    }
    if (form.status === "scheduled" && !form.publishAt) {
      setNotice("Choose a publication date for scheduled content.");
      return;
    }
    let customMeta: Record<string, unknown>;
    try {
      customMeta = JSON.parse(form.customMeta || "{}") as Record<string, unknown>;
      if (!customMeta || Array.isArray(customMeta) || typeof customMeta !== "object") throw new Error();
    } catch {
      setNotice("Custom metadata must be a valid JSON object.");
      return;
    }
    setSaving(true);
    setNotice("Saving and creating a revision snapshot…");
    const meta = {
      ...customMeta,
      cover_image: form.coverImage,
      reading_time: form.readingTime,
      seo: {
        title: form.seoTitle,
        description: form.seoDescription,
        canonical_url: form.canonicalUrl,
        og_image_url: form.ogImage,
        schema_type: form.schemaType,
      },
    };
    const entry = {
      content_type_key: form.contentType,
      title: form.title.trim(),
      slug: form.slug || slugify(form.title),
      status: form.status,
      excerpt: form.excerpt.trim(),
      body: form.body,
      author_id: form.author.trim() || "editorial-team",
      published_at: form.publishAt ? new Date(form.publishAt).toISOString() : null,
      unpublish_at: form.unpublishAt ? new Date(form.unpublishAt).toISOString() : null,
      meta,
      seo: meta.seo,
    };
    try {
      const result = await request<{ entry: Entry; studio: StudioData }>({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "saveEntry", id: form.id || undefined, entry, term_ids: form.termIds }),
      });
      setStudio(result.studio);
      const saved = result.studio.entries.find((item) => item.id === result.entry.id);
      if (saved) {
        setForm(formFromEntry(saved));
      }
      setNotice(form.id ? "Saved. A revision snapshot was created first." : "Created and saved to Kujo CMS.");
      if (!form.id) window.location.assign(`/cms/content/${result.entry.id}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    setNotice("Optimizing the image as WebP…");
    try {
      const webp = await convertToWebP(file);
      const data = new FormData();
      data.append("file", webp);
      data.append("alt_text", form.title ? `Social image for ${form.title}` : "CMS social image");
      const uploaded = await request<{ path: string }>({ method: "POST", body: data });
      update("coverImage", uploaded.path);
      update("ogImage", uploaded.path);
      setNotice(`Uploaded ${Math.round(webp.size / 1024)} KB WebP and selected it for sharing.`);
      await loadStudio();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const createTerm = async (taxonomy: Taxonomy) => {
    const name = (newTerms[taxonomy.id] ?? "").trim();
    if (name.length < 2) return;
    try {
      const result = await request<{ studio: StudioData }>({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "createTerm", taxonomy_id: taxonomy.id, name, slug: slugify(name) }),
      });
      setStudio(result.studio);
      setNewTerms((current) => ({ ...current, [taxonomy.id]: "" }));
      setNotice(`Added ${name} to ${taxonomy.label}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not add term");
    }
  };

  const createTaxonomy = async () => {
    const label = newTaxonomy.label.trim();
    const key = slugify(newTaxonomy.key || label).replace(/-/g, "_");
    if (label.length < 2 || key.length < 2) {
      setNotice("Add a taxonomy name and key.");
      return;
    }
    try {
      const result = await request<{ studio: StudioData }>({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "createTaxonomy", taxonomy_key: key, label, description: newTaxonomy.description, hierarchical: newTaxonomy.hierarchical }),
      });
      setStudio(result.studio);
      setNewTaxonomy({ label: "", key: "", description: "", hierarchical: false });
      setNotice(`Created the ${label} taxonomy.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not create taxonomy");
    }
  };

  const logout = async () => {
    await fetch("/api/cms/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    window.location.assign("/cms/login");
  };

  const can = (capability: Capability) => studio?.currentUser.capabilities.includes(capability) ?? false;

  const publishedCount = studio?.entries.filter((entry) => entry.status === "published").length ?? 0;
  const draftCount = studio?.entries.filter((entry) => entry.status === "draft").length ?? 0;
  const seoReadyCount = studio?.entries.filter((entry) => {
    const meta = parseMeta(entry);
    const seo = typeof meta.seo === "object" && meta.seo ? meta.seo as Record<string, unknown> : {};
    return Boolean(seo.title && seo.description);
  }).length ?? 0;

  const header = (eyebrow: string, title: string, action = true) => <>
    <header className="studio-topbar">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>
      {action && can("edit_content") && <a className="button studio-action" href="/cms/content/new"><IconButtonLabel icon={IconPlus}>New content</IconButtonLabel></a>}
    </header>
    <p className="studio-notice" aria-live="polite">{notice}</p>
  </>;

  const contentList = (compact = false) => <div className={`content-list-panel ${compact ? "compact" : ""}`}>
    {!compact && <div className="content-list-tools">
      <label className="studio-search"><span>Search content</span><div className="search-control"><IconSearch size={18} aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title or slug" /></div></label>
      <span>{filteredEntries.length} items</span>
    </div>}
    <div className="content-table" role="table" aria-label="Content">
      <div className="content-table-head" role="row"><span>Title</span><span>Model</span><span>Status</span><span>Updated</span><span /></div>
      {(compact ? studio?.entries.slice(0, 5) ?? [] : filteredEntries).map((entry) => <a className="content-table-row" role="row" href={`/cms/content/${entry.id}`} key={entry.id}>
        <span className="content-title"><b>{entry.title}</b><small>/{entry.slug}</small></span>
        <span className="model-cell">{entry.content_type_key === "article" ? <IconArticle size={17} aria-hidden="true" /> : <IconFileDescription size={17} aria-hidden="true" />}{entry.content_type_key}</span>
        <span><i className={`status-badge ${entry.status}`}>{entry.status}</i></span>
        <span>{new Date(Number(entry.updated_at) * (Number(entry.updated_at) < 1_000_000_000_000 ? 1000 : 1)).toLocaleDateString()}</span>
        <IconChevronRight size={18} aria-hidden="true" />
      </a>)}
    </div>
  </div>;

  const editor = <div className="editor-layout">
    <section className="studio-editor">
      <div className="studio-document-head">
        <label className="studio-title-field"><span>Title</span><input value={form.title} onChange={(event) => update("title", event.target.value)} onBlur={() => { if (!form.slug) update("slug", slugify(form.title)); }} placeholder="A clear, useful title" /></label>
        <label><span>Slug</span><div className="slug-field"><span>/</span><input value={form.slug} onChange={(event) => update("slug", slugify(event.target.value))} placeholder="entry-slug" /></div></label>
        <label><span>Excerpt</span><textarea className="studio-excerpt" value={form.excerpt} onChange={(event) => update("excerpt", event.target.value)} placeholder="A concise summary for cards and search." /></label>
      </div>
      <div className="studio-editor-tabs">
        <div><button className={editorMode === "write" ? "active" : ""} type="button" onClick={() => setEditorMode("write")}>Write</button><button className={editorMode === "preview" ? "active" : ""} type="button" onClick={() => setEditorMode("preview")}>Preview</button></div>
        <span>Markdown</span>
      </div>
      {editorMode === "write" ? <>
        <div className="markdown-toolbar" aria-label="Markdown formatting">
          <button type="button" aria-label="Heading two" onClick={() => insertMarkdown("## ")}><IconH2 size={18} /></button>
          <button type="button" aria-label="Bold" onClick={() => insertMarkdown("**", "**")}><IconBold size={18} /></button>
          <button type="button" aria-label="Italic" onClick={() => insertMarkdown("_", "_")}><IconItalic size={18} /></button>
          <button type="button" aria-label="Link" onClick={() => insertMarkdown("[", "](https://)")}><IconLink size={18} /></button>
          <button type="button" aria-label="List" onClick={() => insertMarkdown("- ")}><IconList size={18} /></button>
          <button type="button" aria-label="Inline code" onClick={() => insertMarkdown("`", "`")}><IconCode size={18} /></button>
        </div>
        <textarea ref={bodyRef} className="markdown-editor" value={form.body} onChange={(event) => update("body", event.target.value)} spellCheck="true" aria-label="Markdown content" />
      </> : <MarkdownPreview markdown={form.body} />}
    </section>
    <aside className="studio-settings">
      <section>
        <p className="eyebrow">Publishing</p>
        <label htmlFor="entry-status"><span>Status</span><StyledSelect id="entry-status" value={form.status} onChange={(event) => update("status", event.target.value)}><option value="draft">Draft</option><option value="published">Published</option><option value="scheduled">Scheduled</option><option value="archived">Archived</option></StyledSelect></label>
        {form.status === "scheduled" && <label><span>Publish at</span><input type="datetime-local" value={form.publishAt} onChange={(event) => update("publishAt", event.target.value)} /></label>}
        <label><span>Unpublish at</span><input type="datetime-local" value={form.unpublishAt} onChange={(event) => update("unpublishAt", event.target.value)} /></label>
        <label><span>Content model</span><StyledSelect value={form.contentType} disabled={form.id > 0} onChange={(event) => { update("contentType", event.target.value); update("schemaType", event.target.value === "page" ? "WebPage" : "Article"); }}>{studio?.contentTypes.map((type) => <option value={type.type_key} key={type.id}>{type.singular_label}</option>)}</StyledSelect></label>
        {form.id > 0 && <small className="field-help">The model is fixed after creation to preserve its public URL contract.</small>}
        <label><span>Author</span><StyledSelect value={form.author} disabled={form.id > 0} onChange={(event) => update("author", event.target.value)}>{studio?.authors.map((user) => <option value={user.id} key={user.id}>{user.name} — {user.role}</option>)}</StyledSelect></label>
        {form.id > 0 && <small className="field-help">Authorship is fixed after creation by the current CMS API contract.</small>}
        <label><span>Reading time</span><input value={form.readingTime} onChange={(event) => update("readingTime", event.target.value)} placeholder="6 min" /></label>
      </section>
      <section>
        <p className="eyebrow">Taxonomies</p>
        {studio?.taxonomies.map((taxonomy) => <fieldset className="taxonomy-group" key={taxonomy.id}><legend>{taxonomy.label}</legend><div className="term-options">{taxonomy.terms.map((term) => <label className="check-label" key={term.id}><input type="checkbox" checked={form.termIds.includes(term.id)} onChange={(event) => update("termIds", event.target.checked ? [...form.termIds, term.id] : form.termIds.filter((id) => id !== term.id))} /><span>{term.name}</span></label>)}</div></fieldset>)}
      </section>
      <section>
        <p className="eyebrow">SEO & sharing</p>
        <label><span>SEO title <small>{form.seoTitle.length}/60</small></span><input value={form.seoTitle} maxLength={70} onChange={(event) => update("seoTitle", event.target.value)} placeholder={form.title || "Search title"} /></label>
        <label><span>Meta description <small>{form.seoDescription.length}/160</small></span><textarea value={form.seoDescription} maxLength={180} onChange={(event) => update("seoDescription", event.target.value)} placeholder={form.excerpt || "Search description"} /></label>
        <label><span>Canonical URL</span><input type="url" value={form.canonicalUrl} onChange={(event) => update("canonicalUrl", event.target.value)} placeholder="https://example.com/…" /></label>
        <label htmlFor="schema-type"><span>Schema type</span><StyledSelect id="schema-type" value={form.schemaType} onChange={(event) => update("schemaType", event.target.value)}><option>Article</option><option>BlogPosting</option><option>WebPage</option><option>AboutPage</option></StyledSelect></label>
        <label><span>Custom metadata JSON</span><textarea className="metadata-editor" value={form.customMeta} onChange={(event) => update("customMeta", event.target.value)} spellCheck="false" /></label>
        <label className="upload-label"><span><IconUpload size={16} /> Social sharing image</span><input className="file-input" type="file" accept="image/*" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file); }} /></label>
        <small className="field-help">Uploads are resized and converted to WebP automatically.</small>
        {form.ogImage && <div className="social-preview"><img src={form.ogImage} alt="Current social sharing preview" /><button type="button" aria-label="Remove social image" onClick={() => { update("ogImage", ""); update("coverImage", ""); }}><IconTrash size={15} /></button></div>}
        {studio && studio.media.length > 0 && <label><span><IconPhoto size={16} /> Choose from media</span><StyledSelect value={form.ogImage} onChange={(event) => { update("ogImage", event.target.value); update("coverImage", event.target.value); }}><option value="">Choose an image</option>{studio.media.map((item) => <option value={item.storage_path} key={item.id}>{item.filename}</option>)}</StyledSelect></label>}
      </section>
      <button className="button studio-save" type="button" disabled={saving || uploading} onClick={() => void saveEntry()}><IconButtonLabel icon={IconDeviceFloppy}>{saving ? "Saving…" : form.id ? "Save changes" : "Create content"}</IconButtonLabel></button>
    </aside>
  </div>;

  return (
    <main className="studio-shell">
      <aside className="studio-sidebar">
        <a className="wordmark console-wordmark" href="/cms">KUJO / CMS</a>
        <nav aria-label="CMS navigation">
          {navItems.filter((item) => item.view !== "users" || can("manage_users")).map((item) => { const Icon = item.icon; const active = item.view === view || (item.view === "content" && (view === "new" || view === "edit")); return <a className={active ? "active" : ""} href={item.href} key={item.href}><Icon size={19} stroke={1.7} aria-hidden="true" /><span>{item.label}</span></a>; })}
        </nav>
        {studio?.currentUser && <div className="studio-account"><span className="account-avatar"><IconUser size={18} /></span><span><b>{studio.currentUser.name}</b><small>{studio.currentUser.role}</small></span><button type="button" onClick={() => void logout()} aria-label="Sign out"><IconLogout size={17} /></button></div>}
        <div className="studio-api-status"><span className="status-dot" /> Authenticated CMS API</div>
        <a className="view-site-link" href="/"><IconExternalLink size={17} aria-hidden="true" /><span>View publication</span></a>
      </aside>

      <section className="studio-workspace">
        {view === "dashboard" && <>{header("Human-friendly. Agent-ready.", "Dashboard")}<div className="dashboard-grid">
          <section className="dashboard-metrics"><article><IconFileText size={22} /><b>{studio?.entries.length ?? 0}</b><span>Total content</span></article><article><IconExternalLink size={22} /><b>{publishedCount}</b><span>Published</span></article><article><IconEdit size={22} /><b>{draftCount}</b><span>Drafts</span></article><article><IconChartDots3 size={22} /><b>{seoReadyCount}</b><span>SEO ready</span></article></section>
          <section className="dashboard-panel"><div className="panel-heading"><div><p className="eyebrow">Recently updated</p><h2>Content</h2></div><a href="/cms/content">View all <IconChevronRight size={17} /></a></div>{contentList(true)}</section>
        </div></>}
        {view === "content" && <>{header("Manage the publication", "Content")} {contentList()}</>}
        {(view === "new" || view === "edit") && <>{header(view === "new" ? "Create content" : "Edit content", view === "new" ? "New content" : form.title || "Loading…", false)}<div className="editor-breadcrumb"><a href="/cms/content">Content</a><IconChevronRight size={15} /><span>{view === "new" ? "New" : form.title || "Loading"}</span></div>{editor}</>}
        {view === "taxonomies" && <>{header("Organize the publication", "Taxonomies", false)}
          {can("manage_taxonomies") && <section className="create-taxonomy-panel"><div><p className="eyebrow">Custom structure</p><h2>Create a taxonomy</h2><p>Add a reusable classification such as Region, Audience, Format, or Product.</p></div><div className="taxonomy-form"><label><span>Name</span><input value={newTaxonomy.label} onChange={(event) => setNewTaxonomy((current) => ({ ...current, label: event.target.value, key: current.key || slugify(event.target.value).replace(/-/g, "_") }))} placeholder="Audience" /></label><label><span>API key</span><input value={newTaxonomy.key} onChange={(event) => setNewTaxonomy((current) => ({ ...current, key: slugify(event.target.value).replace(/-/g, "_") }))} placeholder="audience" /></label><label className="wide"><span>Description</span><input value={newTaxonomy.description} onChange={(event) => setNewTaxonomy((current) => ({ ...current, description: event.target.value }))} placeholder="Who this content is intended for" /></label><label className="hierarchy-toggle"><input type="checkbox" checked={newTaxonomy.hierarchical} onChange={(event) => setNewTaxonomy((current) => ({ ...current, hierarchical: event.target.checked }))} /><span>Allow parent and child terms</span></label><button className="button" type="button" onClick={() => void createTaxonomy()}><IconPlus size={18} /><span>Create taxonomy</span></button></div></section>}
          <div className="taxonomy-admin-grid">{studio?.taxonomies.map((taxonomy) => <section className="taxonomy-admin-card" key={taxonomy.id}><div className="panel-heading"><div><p className="eyebrow">{taxonomy.taxonomy_key}</p><h2>{taxonomy.label}</h2></div><span>{taxonomy.terms.length} terms</span></div><p>{taxonomy.description || `Manage the terms available under ${taxonomy.label}.`}</p><div className="taxonomy-term-list">{taxonomy.terms.map((term) => <span key={term.id}>{term.name}<small>/{term.slug}</small></span>)}</div>{can("manage_taxonomies") && <div className="new-term"><input value={newTerms[taxonomy.id] ?? ""} onChange={(event) => setNewTerms((current) => ({ ...current, [taxonomy.id]: event.target.value }))} placeholder={`New ${taxonomy.label.toLowerCase()}`} /><button type="button" onClick={() => void createTerm(taxonomy)} aria-label={`Add ${taxonomy.label} term`}><IconPlus size={18} /><span>Add term</span></button></div>}</section>)}</div></>}
        {view === "seo" && <>{header("Search and social presentation", "SEO & sharing", false)}<div className="seo-admin-panel"><div className="panel-heading"><div><p className="eyebrow">Content metadata</p><h2>Search readiness</h2></div><span>{seoReadyCount} of {studio?.entries.length ?? 0} ready</span></div><div className="seo-list">{studio?.entries.map((entry) => { const formEntry = formFromEntry(entry); const ready = Boolean(formEntry.seoTitle && formEntry.seoDescription); return <a href={`/cms/content/${entry.id}`} key={entry.id}><span><b>{entry.title}</b><small>{formEntry.seoTitle || "SEO title needed"}</small></span><i className={`status-badge ${ready ? "published" : "draft"}`}>{ready ? "Ready" : "Needs work"}</i><IconEdit size={18} /></a>; })}</div></div></>}
        {view === "users" && <>{header("People, roles, and access", "Users & roles", false)}<div className="users-admin-grid">{studio?.users.map((user) => <section className="user-card" key={user.id}><div className="user-card-head"><span><IconUser size={21} /></span><div><h2>{user.name}</h2><p>{user.email}</p></div><i>{user.role}</i></div><p className="eyebrow">Capabilities</p><div className="capability-list">{user.capabilities.map((capability) => <span key={capability}>{capability.replace(/_/g, " ")}</span>)}</div><small>{user.source === "platform" ? "Authenticated by the hosting platform" : "Configured on the trusted server"}</small></section>)}</div><p className="users-help">Users and role grants are configured server-side through <code>CMS_STUDIO_USERS_JSON</code>. Hosted Sites use the authenticated platform identity headers; the browser never receives passwords or the CMS write token.</p></>}
      </section>
    </main>
  );
}
