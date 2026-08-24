"use client";
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";

type Term = { id: number; name: string; slug: string };
type Taxonomy = { id: number; taxonomy_key: string; label: string; description: string; terms: Term[] };
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
type StudioData = { entries: Entry[]; contentTypes: ContentType[]; taxonomies: Taxonomy[]; media: Media[] };
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

export default function CmsStudio() {
  const [studio, setStudio] = useState<StudioData | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [selectedId, setSelectedId] = useState(0);
  const [search, setSearch] = useState("");
  const [editorMode, setEditorMode] = useState<"write" | "preview">("write");
  const [notice, setNotice] = useState("Connecting to Kujo CMS…");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newTerms, setNewTerms] = useState<Record<number, string>>({});
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
      if (data.entries[0]) {
        setSelectedId(data.entries[0].id);
        setForm(formFromEntry(data.entries[0]));
      }
    }).catch((error) => {
      if (active) setNotice(error instanceof Error ? error.message : "CMS unavailable");
    });
    return () => { active = false; };
  }, []);

  const filteredEntries = useMemo(() => (studio?.entries ?? []).filter((entry) => {
    const query = search.trim().toLowerCase();
    return !query || entry.title.toLowerCase().includes(query) || entry.slug.includes(query);
  }), [search, studio]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const selectEntry = (entry: Entry) => {
    setSelectedId(entry.id);
    setForm(formFromEntry(entry));
    setEditorMode("write");
    setNotice(`Editing ${entry.title}`);
  };

  const createNew = () => {
    const type = studio?.contentTypes[0]?.type_key ?? "article";
    setSelectedId(0);
    setForm(emptyForm(type));
    setEditorMode("write");
    setNotice("New draft. Choose a model, then write.");
  };

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
        setSelectedId(saved.id);
        setForm(formFromEntry(saved));
      }
      setNotice(form.id ? "Saved. A revision snapshot was created first." : "Created and saved to Kujo CMS.");
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

  return (
    <main className="studio-shell">
      <aside className="studio-sidebar">
        <a className="wordmark console-wordmark" href="/">KUJO / CMS</a>
        <nav aria-label="CMS navigation">
          <a className="active" href="/cms">Content studio</a>
          <a href="#taxonomies">Taxonomies</a>
          <a href="#seo">SEO & sharing</a>
        </nav>
        <div className="studio-api-status"><span className="status-dot" /> Live CMS API</div>
        <a className="view-site-link" href="/">← View publication</a>
      </aside>

      <section className="studio-workspace">
        <header className="studio-topbar">
          <div><p className="eyebrow">Human-friendly. Agent-ready.</p><h1>Content studio</h1></div>
          <button className="button" type="button" onClick={createNew}>+ New content</button>
        </header>
        <p className="studio-notice" aria-live="polite">{notice}</p>

        <div className="studio-layout">
          <aside className="studio-entry-list">
            <label className="studio-search"><span>Search content</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title or slug" /></label>
            <div className="studio-list-meta"><span>{filteredEntries.length} entries</span><span>Updated first</span></div>
            <div className="studio-entry-scroll">
              {filteredEntries.map((entry) => (
                <button className={`studio-entry-button ${selectedId === entry.id ? "selected" : ""}`} type="button" onClick={() => selectEntry(entry)} key={entry.id}>
                  <span><b>{entry.title}</b><small>{entry.content_type_key} · {entry.status}</small></span><em>›</em>
                </button>
              ))}
            </div>
          </aside>

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
                <button type="button" onClick={() => insertMarkdown("## ")}>H2</button>
                <button type="button" onClick={() => insertMarkdown("**", "**")}><b>B</b></button>
                <button type="button" onClick={() => insertMarkdown("_", "_")}><i>I</i></button>
                <button type="button" onClick={() => insertMarkdown("[", "](https://)")}>Link</button>
                <button type="button" onClick={() => insertMarkdown("- ")}>List</button>
                <button type="button" onClick={() => insertMarkdown("`", "`")}>Code</button>
              </div>
              <textarea ref={bodyRef} className="markdown-editor" value={form.body} onChange={(event) => update("body", event.target.value)} spellCheck="true" aria-label="Markdown content" />
            </> : <MarkdownPreview markdown={form.body} />}
          </section>

          <aside className="studio-settings">
            <section>
              <p className="eyebrow">Publishing</p>
              <label><span>Status</span><select value={form.status} onChange={(event) => update("status", event.target.value)}><option value="draft">Draft</option><option value="published">Published</option><option value="scheduled">Scheduled</option><option value="archived">Archived</option></select></label>
              {form.status === "scheduled" && <label><span>Publish at</span><input type="datetime-local" value={form.publishAt} onChange={(event) => update("publishAt", event.target.value)} /></label>}
              <label><span>Unpublish at</span><input type="datetime-local" value={form.unpublishAt} onChange={(event) => update("unpublishAt", event.target.value)} /></label>
              <label><span>Content model</span><select value={form.contentType} disabled={form.id > 0} onChange={(event) => { update("contentType", event.target.value); update("schemaType", event.target.value === "page" ? "WebPage" : "Article"); }}>{studio?.contentTypes.map((type) => <option value={type.type_key} key={type.id}>{type.singular_label}</option>)}</select></label>
              {form.id > 0 && <small className="field-help">The model is fixed after creation to preserve its public URL contract.</small>}
              <label><span>Author</span><input value={form.author} disabled={form.id > 0} onChange={(event) => update("author", event.target.value)} /></label>
              {form.id > 0 && <small className="field-help">Authorship is fixed after creation by the current CMS contract.</small>}
              <label><span>Reading time</span><input value={form.readingTime} onChange={(event) => update("readingTime", event.target.value)} placeholder="6 min" /></label>
            </section>

            <section id="taxonomies">
              <p className="eyebrow">Taxonomies</p>
              {studio?.taxonomies.map((taxonomy) => <fieldset className="taxonomy-group" key={taxonomy.id}><legend>{taxonomy.label}</legend>
                <div className="term-options">{taxonomy.terms.map((term) => <label className="check-label" key={term.id}><input type="checkbox" checked={form.termIds.includes(term.id)} onChange={(event) => update("termIds", event.target.checked ? [...form.termIds, term.id] : form.termIds.filter((id) => id !== term.id))} /><span>{term.name}</span></label>)}</div>
                <div className="new-term"><input value={newTerms[taxonomy.id] ?? ""} onChange={(event) => setNewTerms((current) => ({ ...current, [taxonomy.id]: event.target.value }))} placeholder={`New ${taxonomy.label.toLowerCase()}`} /><button type="button" onClick={() => void createTerm(taxonomy)}>Add</button></div>
              </fieldset>)}
            </section>

            <section id="seo">
              <p className="eyebrow">SEO & sharing</p>
              <label><span>SEO title <small>{form.seoTitle.length}/60</small></span><input value={form.seoTitle} maxLength={70} onChange={(event) => update("seoTitle", event.target.value)} placeholder={form.title || "Search title"} /></label>
              <label><span>Meta description <small>{form.seoDescription.length}/160</small></span><textarea value={form.seoDescription} maxLength={180} onChange={(event) => update("seoDescription", event.target.value)} placeholder={form.excerpt || "Search description"} /></label>
              <label><span>Canonical URL</span><input type="url" value={form.canonicalUrl} onChange={(event) => update("canonicalUrl", event.target.value)} placeholder="https://example.com/…" /></label>
              <label><span>Schema type</span><select value={form.schemaType} onChange={(event) => update("schemaType", event.target.value)}><option>Article</option><option>BlogPosting</option><option>WebPage</option><option>AboutPage</option></select></label>
              <label><span>Custom metadata JSON</span><textarea className="metadata-editor" value={form.customMeta} onChange={(event) => update("customMeta", event.target.value)} spellCheck="false" /></label>
              <label><span>Social sharing image</span><input className="file-input" type="file" accept="image/*" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file); }} /></label>
              <small className="field-help">Uploads are resized to 1600px and converted to WebP automatically.</small>
              {form.ogImage && <div className="social-preview"><img src={form.ogImage} alt="Current social sharing preview" /><button type="button" onClick={() => { update("ogImage", ""); update("coverImage", ""); }}>Remove</button></div>}
              {studio && studio.media.length > 0 && <label><span>Or choose from media</span><select value={form.ogImage} onChange={(event) => { update("ogImage", event.target.value); update("coverImage", event.target.value); }}><option value="">Choose an image</option>{studio.media.map((item) => <option value={item.storage_path} key={item.id}>{item.filename}</option>)}</select></label>}
            </section>

            <button className="button studio-save" type="button" disabled={saving || uploading} onClick={() => void saveEntry()}>{saving ? "Saving…" : form.id ? "Save changes" : "Create content"}</button>
          </aside>
        </div>
      </section>
    </main>
  );
}
