"use client";
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  IconArticle,
  IconBold,
  IconChartDots3,
  IconCheck,
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
  IconSettings,
  IconShieldCheck,
  IconTags,
  IconTrash,
  IconUpload,
  IconUser,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";
import SeoWorkspace, { type SocialSharingSettings } from "./SeoWorkspace";

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
type StudioUser = { id: string; name: string; email: string; username: string; firstName: string; lastName: string; bio: string; websiteUrl: string; avatarUrl: string; social: Record<string, string>; role: string; roleKey: string; status: "pending" | "active" | "suspended" | "rejected"; capabilities: Capability[]; source: "cms" | "platform"; createdAt: string; lastLoginAt: string | null };
type StudioAuthor = Pick<StudioUser, "id" | "name" | "role">;
type StudioRole = { id: number; role_key: string; name: string; permissions_json: string; is_system: number };
type RegistrationSettings = { mode: "open" | "approval" | "closed"; default_role: string };
type StudioData = { entries: Entry[]; contentTypes: ContentType[]; taxonomies: Taxonomy[]; media: Media[]; currentUser: StudioUser; authors: StudioAuthor[]; users: StudioUser[]; roles: StudioRole[]; registration: RegistrationSettings | null; socialSharing: SocialSharingSettings | null };
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

type StudioView = "dashboard" | "content" | "new" | "edit" | "taxonomies" | "seo" | "users" | "userNew" | "userEdit";

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

type SelectOption = { value: string; label: string };

function ThemeSelect({ value, options, onChange, disabled = false, id, ariaLabel }: { value: string; options: SelectOption[]; onChange: (value: string) => void; disabled?: boolean; id?: string; ariaLabel?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);
  const choose = (next: string) => { onChange(next); setOpen(false); };
  const keyboard = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape") { setOpen(false); return; }
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setOpen((current) => !current); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (options.length === 0) return;
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const index = (selectedIndex + direction + options.length) % options.length;
      choose(options[index]?.value ?? value);
    }
  };
  return <div ref={rootRef} className={`theme-select ${open ? "open" : ""}`}>
    <button id={id} type="button" className="theme-select-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => setOpen((current) => !current)} onKeyDown={keyboard}><span>{options[selectedIndex]?.label ?? "Choose an option"}</span><IconChevronDown size={17} stroke={1.8} aria-hidden="true" /></button>
    {open && <div className="theme-select-menu" role="listbox" aria-label={ariaLabel}>{options.map((option) => <button type="button" role="option" aria-selected={option.value === value} key={option.value} onClick={() => choose(option.value)}><span>{option.label}</span>{option.value === value && <IconCheck size={16} />}</button>)}</div>}
  </div>;
}

export default function CmsStudio({ view = "dashboard", entryId, userId }: { view?: StudioView; entryId?: number; userId?: number }) {
  const [studio, setStudio] = useState<StudioData | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [search, setSearch] = useState("");
  const [editorMode, setEditorMode] = useState<"write" | "preview">("write");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newTerms, setNewTerms] = useState<Record<number, string>>({});
  const [newTaxonomy, setNewTaxonomy] = useState({ label: "", key: "", description: "", hierarchical: false });
  const [userSearch, setUserSearch] = useState("");
  const [contentModelFilter, setContentModelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [termFilter, setTermFilter] = useState("all");
  const [userForm, setUserForm] = useState({ id: 0, display_name: "", username: "", email: "", first_name: "", last_name: "", bio: "", website_url: "", avatar_url: "", x: "", linkedin: "", github: "", role_key: "subscriber", status: "active", password: "" });
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const loadStudio = async () => {
    try {
      const data = await request<StudioData>();
      setStudio(data);
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "CMS unavailable");
    }
  };

  useEffect(() => {
    let active = true;
    void request<StudioData>().then((data) => {
      if (!active) return;
      setStudio(data);
      setNotice("");
      if (view === "new") setForm({ ...emptyForm(data.contentTypes[0]?.type_key ?? "article"), author: data.currentUser.id });
      if (view === "edit") {
        const selected = data.entries.find((entry) => entry.id === entryId);
        if (selected) setForm(formFromEntry(selected));
        else setNotice("That content item could not be found.");
      }
      if (view === "userNew") setUserForm((current) => ({ ...current, role_key: data.registration?.default_role ?? "subscriber" }));
      if (view === "userEdit") {
        const selectedUser = data.users.find((user) => Number(user.id) === userId);
        if (selectedUser) setUserForm({ id: Number(selectedUser.id), display_name: selectedUser.name, username: selectedUser.username, email: selectedUser.email, first_name: selectedUser.firstName, last_name: selectedUser.lastName, bio: selectedUser.bio, website_url: selectedUser.websiteUrl, avatar_url: selectedUser.avatarUrl, x: selectedUser.social.x ?? "", linkedin: selectedUser.social.linkedin ?? "", github: selectedUser.social.github ?? "", role_key: selectedUser.roleKey, status: selectedUser.status, password: "" });
        else setNotice("That user could not be found.");
      }
    }).catch((error) => {
      if (active) setNotice(error instanceof Error ? error.message : "CMS unavailable");
    });
    return () => { active = false; };
  }, [entryId, userId, view]);

  const filteredEntries = useMemo(() => (studio?.entries ?? []).filter((entry) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || entry.title.toLowerCase().includes(query) || entry.slug.includes(query);
    const matchesModel = contentModelFilter === "all" || entry.content_type_key === contentModelFilter;
    const matchesStatus = statusFilter === "all" || entry.status === statusFilter;
    const matchesTerm = termFilter === "all" || entry.terms?.some((term) => String(term.id) === termFilter);
    return matchesSearch && matchesModel && matchesStatus && matchesTerm;
  }), [contentModelFilter, search, statusFilter, studio, termFilter]);
  const filteredUsers = useMemo(() => (studio?.users ?? []).filter((user) => {
    const query = userSearch.trim().toLowerCase();
    return !query || user.name.toLowerCase().includes(query) || user.email.includes(query) || user.username.includes(query);
  }), [studio, userSearch]);

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
    const names = (newTerms[taxonomy.id] ?? "").split(",").map((name) => name.trim()).filter((name) => name.length >= 2);
    if (names.length === 0) return;
    try {
      const result = await request<{ studio: StudioData }>({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "createTerms", taxonomy_id: taxonomy.id, names }),
      });
      setStudio(result.studio);
      setNewTerms((current) => ({ ...current, [taxonomy.id]: "" }));
      setNotice(`Added ${names.length} ${names.length === 1 ? "term" : "terms"} to ${taxonomy.label}.`);
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

  const saveUser = async () => {
    if (userForm.display_name.trim().length < 2 || userForm.username.trim().length < 3 || !userForm.email.includes("@")) { setNotice("Add a display name, username, and valid email."); return; }
    if (!userForm.id && userForm.password.length < 10) { setNotice("New users need a password with at least 10 characters."); return; }
    setSaving(true); setNotice(userForm.id ? "Saving user…" : "Creating user…");
    try {
      const result = await request<{ user: { id: number }; studio: StudioData }>({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: userForm.id ? "updateUser" : "createUser", ...userForm, social: { x: userForm.x, linkedin: userForm.linkedin, github: userForm.github } }) });
      setStudio(result.studio);
      setNotice(userForm.id ? "User details, role, and status saved." : "User created and ready to manage.");
      if (!userForm.id) window.location.assign(`/cms/users/${result.user.id}`);
      else setUserForm((current) => ({ ...current, password: "" }));
    } catch (error) { setNotice(error instanceof Error ? error.message : "User could not be saved."); } finally { setSaving(false); }
  };

  const saveRegistration = async (mode: RegistrationSettings["mode"], defaultRole: string) => {
    setSaving(true); setNotice("Updating registration policy…");
    try {
      const result = await request<{ studio: StudioData }>({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "updateRegistration", mode, default_role: defaultRole }) });
      setStudio(result.studio); setNotice("Registration policy saved.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Registration policy could not be saved."); } finally { setSaving(false); }
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
    {notice && <p className="studio-notice" aria-live="polite">{notice}</p>}
  </>;

  const contentList = (compact = false) => <div className={`content-list-panel ${compact ? "compact" : ""}`}>
    {!compact && <div className="content-list-tools">
      <label className="studio-search"><span>Search content</span><div className="search-control"><IconSearch size={18} aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title or slug" /></div></label>
      <div className="content-filters"><div><span>Model</span><ThemeSelect ariaLabel="Filter by content model" value={contentModelFilter} onChange={setContentModelFilter} options={[{ value: "all", label: "All models" }, ...(studio?.contentTypes ?? []).map((type) => ({ value: type.type_key, label: type.label }))]} /></div><div><span>Status</span><ThemeSelect ariaLabel="Filter by status" value={statusFilter} onChange={setStatusFilter} options={[{ value: "all", label: "All statuses" }, ...["draft", "published", "scheduled", "archived"].map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }))]} /></div><div><span>Taxonomy</span><ThemeSelect ariaLabel="Filter by taxonomy term" value={termFilter} onChange={setTermFilter} options={[{ value: "all", label: "All terms" }, ...(studio?.taxonomies.flatMap((taxonomy) => taxonomy.terms.map((term) => ({ value: String(term.id), label: `${taxonomy.label}: ${term.name}` }))) ?? [])]} /></div></div>
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

  const seoFields = <section className="entry-seo-panel"><div className="panel-heading"><div><p className="eyebrow">SEO & sharing</p><h2>Search presentation</h2></div><span>{form.seoTitle.length}/60 title · {form.seoDescription.length}/160 description</span></div><div className="entry-seo-fields">
    <label><span>SEO title</span><input value={form.seoTitle} maxLength={70} onChange={(event) => update("seoTitle", event.target.value)} placeholder={form.title || "Search title"} /></label>
    <label><span>Meta description</span><textarea value={form.seoDescription} maxLength={180} onChange={(event) => update("seoDescription", event.target.value)} placeholder={form.excerpt || "Search description"} /></label>
    <label><span>Canonical URL</span><input type="url" value={form.canonicalUrl} onChange={(event) => update("canonicalUrl", event.target.value)} placeholder="https://example.com/…" /></label>
    <div className="select-field"><span>Schema type</span><ThemeSelect ariaLabel="Schema type" value={form.schemaType} onChange={(value) => update("schemaType", value)} options={["Article", "BlogPosting", "WebPage", "AboutPage"].map((value) => ({ value, label: value }))} /></div>
    <label className="wide"><span>Custom metadata JSON</span><textarea className="metadata-editor" value={form.customMeta} onChange={(event) => update("customMeta", event.target.value)} spellCheck="false" /></label>
    <label className="upload-label wide"><span><IconUpload size={16} /> Social sharing image</span><input className="file-input" type="file" accept="image/*" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file); }} /></label>
    {form.ogImage && <div className="social-preview wide"><img src={form.ogImage} alt="Current social sharing preview" /><button type="button" aria-label="Remove social image" onClick={() => { update("ogImage", ""); update("coverImage", ""); }}><IconTrash size={15} /></button></div>}
    {studio && studio.media.length > 0 && <div className="select-field wide"><span><IconPhoto size={16} /> Choose from media</span><ThemeSelect ariaLabel="Choose from media" value={form.ogImage} onChange={(value) => { update("ogImage", value); update("coverImage", value); }} options={[{ value: "", label: "Choose an image" }, ...studio.media.map((item) => ({ value: item.storage_path, label: item.filename }))]} /></div>}
  </div></section>;

  const editor = <div className="editor-layout">
    <div className="editor-main-column"><section className="studio-editor">
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
    </section>{seoFields}</div>
    <aside className="studio-settings">
      <section>
        <p className="eyebrow">Publishing</p>
        <label htmlFor="entry-status"><span>Status</span><ThemeSelect id="entry-status" ariaLabel="Status" value={form.status} onChange={(value) => update("status", value)} options={[{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }, { value: "scheduled", label: "Scheduled" }, { value: "archived", label: "Archived" }]} /></label>
        {form.status === "scheduled" && <label><span>Publish at</span><input type="datetime-local" value={form.publishAt} onChange={(event) => update("publishAt", event.target.value)} /></label>}
        <label><span>Unpublish at</span><input type="datetime-local" value={form.unpublishAt} onChange={(event) => update("unpublishAt", event.target.value)} /></label>
        <div className="select-field"><span>Content model</span><ThemeSelect ariaLabel="Content model" value={form.contentType} disabled={form.id > 0} onChange={(value) => { update("contentType", value); update("schemaType", value === "page" ? "WebPage" : "Article"); }} options={(studio?.contentTypes ?? []).map((type) => ({ value: type.type_key, label: type.singular_label }))} /></div>
        {form.id > 0 && <small className="field-help">The model is fixed after creation to preserve its public URL contract.</small>}
        <div className="select-field"><span>Author</span><ThemeSelect ariaLabel="Author" value={form.author} disabled={form.id > 0} onChange={(value) => update("author", value)} options={(studio?.authors ?? []).map((user) => ({ value: user.id, label: `${user.name} — ${user.role}` }))} /></div>
        {form.id > 0 && <small className="field-help">Authorship is fixed after creation by the current CMS API contract.</small>}
        <label><span>Reading time</span><input value={form.readingTime} onChange={(event) => update("readingTime", event.target.value)} placeholder="6 min" /></label>
      </section>
      <section>
        <p className="eyebrow">Taxonomies</p>
        {studio?.taxonomies.map((taxonomy) => <fieldset className="taxonomy-group" key={taxonomy.id}><legend>{taxonomy.label}</legend><div className="term-options">{taxonomy.terms.map((term) => <label className="check-label" key={term.id}><input type="checkbox" checked={form.termIds.includes(term.id)} onChange={(event) => update("termIds", event.target.checked ? [...form.termIds, term.id] : form.termIds.filter((id) => id !== term.id))} /><span>{term.name}</span></label>)}</div></fieldset>)}
      </section>
      <button className="button studio-save" type="button" disabled={saving || uploading} onClick={() => void saveEntry()}><IconButtonLabel icon={IconDeviceFloppy}>{saving ? "Saving…" : form.id ? "Save changes" : "Create content"}</IconButtonLabel></button>
    </aside>
  </div>;

  const userEditor = <div className="user-editor-layout">
    <section className="user-editor-main">
      <div className="user-editor-section"><div><p className="eyebrow">Identity</p><h2>Personal details</h2><p>These details identify the person throughout the publication.</p></div><div className="form-grid"><label className="wide"><span>Display name</span><input value={userForm.display_name} onChange={(event) => setUserForm({ ...userForm, display_name: event.target.value })} /></label><label><span>First name</span><input value={userForm.first_name} onChange={(event) => setUserForm({ ...userForm, first_name: event.target.value })} /></label><label><span>Last name</span><input value={userForm.last_name} onChange={(event) => setUserForm({ ...userForm, last_name: event.target.value })} /></label><label><span>Username</span><input value={userForm.username} disabled={userForm.id > 0} onChange={(event) => setUserForm({ ...userForm, username: slugify(event.target.value) })} /></label><label><span>Email address</span><input type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} /></label><label className="wide"><span>Biography</span><textarea value={userForm.bio} onChange={(event) => setUserForm({ ...userForm, bio: event.target.value })} placeholder="A concise public biography." /></label></div></div>
      <div className="user-editor-section"><div><p className="eyebrow">Profile</p><h2>Web presence</h2><p>Optional links can be used on author pages and profile cards.</p></div><div className="form-grid"><label className="wide"><span>Website URL</span><input type="url" value={userForm.website_url} onChange={(event) => setUserForm({ ...userForm, website_url: event.target.value })} /></label><label className="wide"><span>Avatar URL</span><input type="url" value={userForm.avatar_url} onChange={(event) => setUserForm({ ...userForm, avatar_url: event.target.value })} /></label><label><span>X profile</span><input value={userForm.x} onChange={(event) => setUserForm({ ...userForm, x: event.target.value })} placeholder="https://x.com/…" /></label><label><span>LinkedIn</span><input value={userForm.linkedin} onChange={(event) => setUserForm({ ...userForm, linkedin: event.target.value })} /></label><label className="wide"><span>GitHub</span><input value={userForm.github} onChange={(event) => setUserForm({ ...userForm, github: event.target.value })} /></label></div></div>
    </section>
    <aside className="user-editor-side"><section><p className="eyebrow">Access</p><div className="select-field"><span>Role</span><ThemeSelect ariaLabel="User role" value={userForm.role_key} onChange={(value) => setUserForm({ ...userForm, role_key: value })} options={(studio?.roles ?? []).map((role) => ({ value: role.role_key, label: role.name }))} /></div><div className="select-field"><span>Account status</span><ThemeSelect ariaLabel="Account status" value={userForm.status} onChange={(value) => setUserForm({ ...userForm, status: value })} options={[{ value: "active", label: "Active" }, { value: "pending", label: "Pending approval" }, { value: "suspended", label: "Suspended" }, { value: "rejected", label: "Rejected" }]} /></div></section><section><p className="eyebrow">Security</p><label><span>{userForm.id ? "Set a new password" : "Temporary password"}</span><input type="password" value={userForm.password} minLength={10} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} autoComplete="new-password" /></label><small className="field-help">{userForm.id ? "Leave blank to keep the existing password." : "The user can change this from their account page."}</small></section><button className="button studio-save" type="button" disabled={saving} onClick={() => void saveUser()}><IconDeviceFloppy size={18} />{saving ? "Saving…" : userForm.id ? "Save user" : "Create user"}</button></aside>
  </div>;

  return (
    <main className="studio-shell">
      <aside className="studio-sidebar">
        <a className="wordmark console-wordmark" href="/cms">KUJO / CMS</a>
        <nav aria-label="CMS navigation">
          {navItems.filter((item) => item.view !== "users" || can("manage_users")).map((item) => { const Icon = item.icon; const active = item.view === view || (item.view === "content" && (view === "new" || view === "edit")) || (item.view === "users" && (view === "userNew" || view === "userEdit")); return <a className={active ? "active" : ""} href={item.href} key={item.href}><Icon size={19} stroke={1.7} aria-hidden="true" /><span>{item.label}</span></a>; })}
        </nav>
        <a className="view-site-link" href="/"><IconExternalLink size={17} aria-hidden="true" /><span>View publication</span></a>
        {studio?.currentUser && <div className="studio-account"><span className="account-avatar"><IconUser size={18} /></span><span><b>{studio.currentUser.name}</b><small>{studio.currentUser.role}</small></span><button type="button" onClick={() => void logout()} aria-label="Sign out"><IconLogout size={17} /></button></div>}
      </aside>

      <section className="studio-workspace">
        {view === "dashboard" && <>{header("Human-friendly. Agent-ready.", "Dashboard")}<div className="dashboard-grid">
          <section className="dashboard-metrics"><article><IconFileText size={22} /><b>{studio?.entries.length ?? 0}</b><span>Total content</span></article><article><IconExternalLink size={22} /><b>{publishedCount}</b><span>Published</span></article><article><IconEdit size={22} /><b>{draftCount}</b><span>Drafts</span></article><article><IconChartDots3 size={22} /><b>{seoReadyCount}</b><span>SEO ready</span></article></section>
          <section className="dashboard-panel"><div className="panel-heading"><div><p className="eyebrow">Recently updated</p><h2>Content</h2></div><a href="/cms/content">View all <IconChevronRight size={17} /></a></div>{contentList(true)}</section>
        </div></>}
        {view === "content" && <>{header("Manage the publication", "Content")} {contentList()}</>}
        {(view === "new" || view === "edit") && <>{header("Content", view === "new" ? "New content" : "Edit content", false)}<div className="editor-breadcrumb"><a href="/cms/content">Content</a><IconChevronRight size={15} /><span>{view === "new" ? "New" : form.title || "Loading"}</span></div>{editor}</>}
        {view === "taxonomies" && <>{header("Organize the publication", "Taxonomies", false)}
          {can("manage_taxonomies") && <section className="create-taxonomy-panel"><div><p className="eyebrow">Custom structure</p><h2>Create a taxonomy</h2><p>Add a reusable classification such as Region, Audience, Format, or Product.</p></div><div className="taxonomy-form"><label><span>Name</span><input value={newTaxonomy.label} onChange={(event) => setNewTaxonomy((current) => ({ ...current, label: event.target.value, key: current.key || slugify(event.target.value).replace(/-/g, "_") }))} placeholder="Audience" /></label><label><span>API key</span><input value={newTaxonomy.key} onChange={(event) => setNewTaxonomy((current) => ({ ...current, key: slugify(event.target.value).replace(/-/g, "_") }))} placeholder="audience" /></label><label className="wide"><span>Description</span><input value={newTaxonomy.description} onChange={(event) => setNewTaxonomy((current) => ({ ...current, description: event.target.value }))} placeholder="Who this content is intended for" /></label><label className="hierarchy-toggle"><input type="checkbox" checked={newTaxonomy.hierarchical} onChange={(event) => setNewTaxonomy((current) => ({ ...current, hierarchical: event.target.checked }))} /><span>Allow parent and child terms</span></label><button className="button" type="button" onClick={() => void createTaxonomy()}><IconPlus size={18} /><span>Create taxonomy</span></button></div></section>}
          <div className="taxonomy-admin-grid">{studio?.taxonomies.map((taxonomy) => <section className="taxonomy-admin-card" key={taxonomy.id}><div className="panel-heading"><div><h2>{taxonomy.label}</h2></div><span>{taxonomy.terms.length} terms</span></div><p>{taxonomy.description || `Manage the terms available under ${taxonomy.label}.`}</p><div className="taxonomy-term-list">{taxonomy.terms.map((term) => <span key={term.id}>{term.name}<small>/{term.slug}</small></span>)}</div>{can("manage_taxonomies") && <div className="new-term"><input value={newTerms[taxonomy.id] ?? ""} onChange={(event) => setNewTerms((current) => ({ ...current, [taxonomy.id]: event.target.value }))} placeholder="Add terms separated by commas" /><button type="button" onClick={() => void createTerm(taxonomy)} aria-label={`Add ${taxonomy.label} terms`} title="Add terms"><IconPlus size={18} /></button></div>}</section>)}</div></>}
        {view === "seo" && <>{header("Search and social presentation", "SEO & sharing", false)}<SeoWorkspace contentTypes={studio?.contentTypes ?? []} initialSharing={studio?.socialSharing ?? null} /></>}
        {view === "users" && <>{header("People, roles, and access", "Users", false)}
          <div className="users-toolbar"><label className="studio-search"><span>Search users</span><div className="search-control"><IconSearch size={18} /><input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Name, email, or username" /></div></label><a className="button" href="/cms/users/new"><IconUserPlus size={18} /> Add user</a></div>
          <section className="registration-panel"><div className="panel-heading"><div><p className="eyebrow">Registration</p><h2>New account policy</h2></div><IconSettings size={22} /></div><p>Choose whether public signups are active immediately, wait for approval, or are disabled.</p><div className="registration-modes">{([{ value: "open", label: "Open", description: "Signups become active immediately." }, { value: "approval", label: "Require approval", description: "Signups remain pending until reviewed." }, { value: "closed", label: "Closed", description: "Only administrators can create users." }] as const).map((mode) => <button type="button" className={studio?.registration?.mode === mode.value ? "active" : ""} key={mode.value} onClick={() => void saveRegistration(mode.value, studio?.registration?.default_role ?? "subscriber")}><IconShieldCheck size={19} /><span><b>{mode.label}</b><small>{mode.description}</small></span>{studio?.registration?.mode === mode.value && <IconCheck size={18} />}</button>)}</div><div className="registration-default"><span>Default signup role</span><ThemeSelect ariaLabel="Default signup role" value={studio?.registration?.default_role ?? "subscriber"} onChange={(value) => void saveRegistration(studio?.registration?.mode ?? "approval", value)} options={(studio?.roles ?? []).filter((role) => role.role_key !== "super_admin").map((role) => ({ value: role.role_key, label: role.name }))} /></div></section>
          <section className="users-list-panel"><div className="user-list-stats"><span><b>{studio?.users.length ?? 0}</b> total</span><span><b>{studio?.users.filter((user) => user.status === "active").length ?? 0}</b> active</span><span><b>{studio?.users.filter((user) => user.status === "pending").length ?? 0}</b> pending</span></div><div className="users-table" role="table" aria-label="Users"><div className="users-table-head" role="row"><span>User</span><span>Role</span><span>Status</span><span>Last sign-in</span><span /></div>{filteredUsers.map((user) => <a className="users-table-row" role="row" href={`/cms/users/${user.id}`} key={user.id}><span className="user-identity"><i>{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : user.name.slice(0, 1).toUpperCase()}</i><span><b>{user.name}</b><small>{user.email} · @{user.username}</small></span></span><span>{user.role}</span><span><em className={`user-status ${user.status}`}>{user.status === "pending" ? "Pending approval" : user.status}</em></span><span>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Never"}</span><IconChevronRight size={18} /></a>)}</div></section>
        </>}
        {(view === "userNew" || view === "userEdit") && <>{header(view === "userNew" ? "Create an account" : "Manage account", view === "userNew" ? "Add user" : userForm.display_name || "Loading…", false)}<div className="editor-breadcrumb"><a href="/cms/users">Users</a><IconChevronRight size={15} /><span>{view === "userNew" ? "New" : userForm.display_name || "Loading"}</span></div>{userEditor}</>}
      </section>
    </main>
  );
}
