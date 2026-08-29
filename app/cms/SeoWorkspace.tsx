"use client";

import { useEffect, useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconBrandBluesky,
  IconBrandFacebook,
  IconBrandLinkedin,
  IconBrandReddit,
  IconBrandWhatsapp,
  IconBrandX,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconEdit,
  IconMail,
  IconSearch,
  IconSelector,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";

type ContentType = { type_key: string; label: string };
export type SocialSharingSettings = { networks: string[]; content_types: string[]; accounts: Record<string, string> };
type SeoFields = { title: string; description: string; focus_keyword: string; canonical_url: string; og_image_url: string; social_title: string; social_description: string; schema_type: string; robots: string; title_length: number; description_length: number };
type SeoItem = { id: number; content_type_key: string; title: string; slug: string; status: string; author_id: string; updated_at: string | number; word_count: number; term_count: number; url: string; readiness: "ready" | "needs_work"; score: number; issues: string[]; seo: SeoFields };
type SeoReport = { items: SeoItem[]; total: number; limit: number; offset: number; summary: { total: number; missing_titles: number; missing_descriptions: number; missing_keywords: number; missing_social_images: number; missing_terms: number } };

const emptyReport: SeoReport = { items: [], total: 0, limit: 25, offset: 0, summary: { total: 0, missing_titles: 0, missing_descriptions: 0, missing_keywords: 0, missing_social_images: 0, missing_terms: 0 } };
const networkOptions = [
  { value: "x", label: "X", icon: IconBrandX },
  { value: "linkedin", label: "LinkedIn", icon: IconBrandLinkedin },
  { value: "facebook", label: "Facebook", icon: IconBrandFacebook },
  { value: "bluesky", label: "Bluesky", icon: IconBrandBluesky },
  { value: "reddit", label: "Reddit", icon: IconBrandReddit },
  { value: "whatsapp", label: "WhatsApp", icon: IconBrandWhatsapp },
  { value: "email", label: "Email", icon: IconMail },
] as const;
const issueLabels: Record<string, string> = {
  missing_title: "Missing title",
  title_too_short: "Short title",
  title_too_long: "Long title",
  missing_description: "Missing description",
  description_too_short: "Short description",
  description_too_long: "Long description",
  missing_keyword: "No focus keyword",
  missing_canonical: "No canonical URL",
  missing_social_image: "No social image",
  missing_terms: "No taxonomy terms",
};

async function api<T>(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const payload = await response.json() as { ok: boolean; data?: T; error?: string };
  if (response.status === 401) {
    window.location.assign(`/cms/login?returnTo=${encodeURIComponent(window.location.pathname)}`);
    throw new Error("Sign in required.");
  }
  if (!response.ok || !payload.ok || payload.data === undefined) throw new Error(payload.error ?? "CMS request failed");
  return payload.data;
}

function formatIssue(issue: string) {
  return issueLabels[issue] ?? issue.replace(/_/g, " ");
}

function editState(item: SeoItem) {
  return { title: item.seo.title, description: item.seo.description, focus_keyword: item.seo.focus_keyword, canonical_url: item.seo.canonical_url, og_image_url: item.seo.og_image_url, social_title: item.seo.social_title, social_description: item.seo.social_description, schema_type: item.seo.schema_type || (item.content_type_key === "page" ? "WebPage" : "Article"), robots: item.seo.robots || "index,follow" };
}

export default function SeoWorkspace({ contentTypes, initialSharing }: { contentTypes: ContentType[]; initialSharing: SocialSharingSettings | null }) {
  const [report, setReport] = useState(emptyReport);
  const [filters, setFilters] = useState({ q: "", content_type: "", status: "", readiness: "", issue: "" });
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [editing, setEditing] = useState<SeoItem | null>(null);
  const [editForm, setEditForm] = useState<ReturnType<typeof editState> | null>(null);
  const [bulkField, setBulkField] = useState("focus_keyword");
  const [bulkValue, setBulkValue] = useState("");
  const [sharing, setSharing] = useState<SocialSharingSettings>(initialSharing ?? { networks: ["x", "linkedin", "facebook", "bluesky", "reddit", "whatsapp", "email"], content_types: ["article"], accounts: { x: "", bluesky: "" } });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams({ resource: "seo", limit: "25", offset: String(offset), sort_by: "updated_at", sort_dir: "desc" });
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    return params.toString();
  }, [filters, offset]);

  const loadReport = async () => {
    try {
      const next = await api<SeoReport>(`/api/cms?${query}`);
      setReport(next);
      setSelected((current) => current.filter((id) => next.items.some((item) => item.id === id)));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "SEO report unavailable");
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadReport(); }, 180);
    return () => window.clearTimeout(timer);
    // query is the complete request identity; loadReport intentionally remains local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const updateFilter = (key: keyof typeof filters, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setOffset(0); setSelected([]); };
  const allVisibleSelected = report.items.length > 0 && report.items.every((item) => selected.includes(item.id));

  const saveQuickEdit = async () => {
    if (!editing || !editForm) return;
    setBusy(true); setNotice("Saving SEO fields…");
    try {
      await api("/api/cms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "updateSeo", id: editing.id, changes: editForm }) });
      setEditing(null); setEditForm(null); setNotice(`Updated search and sharing metadata for “${editing.title}”.`); await loadReport();
    } catch (error) { setNotice(error instanceof Error ? error.message : "SEO update failed"); } finally { setBusy(false); }
  };

  const applyBulk = async () => {
    if (selected.length === 0 || !bulkValue.trim()) { setNotice("Select content and enter a value to apply."); return; }
    setBusy(true); setNotice(`Updating ${selected.length} selected items…`);
    try {
      const result = await api<{ updated_count: number; errors: unknown[] }>("/api/cms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "bulkUpdateSeo", entry_ids: selected, changes: { [bulkField]: bulkValue.trim() } }) });
      setNotice(`Updated ${result.updated_count} items${result.errors.length ? `; ${result.errors.length} could not be changed` : ""}.`); setSelected([]); setBulkValue(""); await loadReport();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Bulk update failed"); } finally { setBusy(false); }
  };

  const saveSharing = async () => {
    setBusy(true); setNotice("Saving sharing settings…");
    try {
      await api("/api/cms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "updateSocialSharing", ...sharing }) });
      setNotice("Social networks and account handles saved.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Sharing settings could not be saved"); } finally { setBusy(false); }
  };

  const totalPages = Math.max(1, Math.ceil(report.total / report.limit));
  const currentPage = Math.floor(report.offset / report.limit) + 1;

  return <>
    {notice && <p className="studio-notice seo-notice" aria-live="polite">{notice}</p>}
    <div className="seo-overview seo-overview-rich">
      <article><span>Total inventory</span><b>{report.summary.total ?? 0}</b><small>Across every content model</small></article>
      <article><span>Missing keywords</span><b>{report.summary.missing_keywords ?? 0}</b><small>Pages without a search intent</small></article>
      <article><span>Missing social cards</span><b>{report.summary.missing_social_images ?? 0}</b><small>Shares without a chosen image</small></article>
      <article><span>Unclassified</span><b>{report.summary.missing_terms ?? 0}</b><small>Content without taxonomy terms</small></article>
    </div>

    <section className="sharing-settings sharing-settings-rich">
      <div><p className="eyebrow">Distribution defaults</p><h2>Sharing channels</h2><p>Choose the actions readers see. Handles are appended where a network supports attribution.</p><div className="social-account-fields"><label><span>X account</span><div className="handle-input"><b>@</b><input value={sharing.accounts?.x ?? ""} onChange={(event) => setSharing({ ...sharing, accounts: { ...sharing.accounts, x: event.target.value.replace(/^@+/, "") } })} placeholder="fieldnotes" /></div></label><label><span>Bluesky account</span><input value={sharing.accounts?.bluesky ?? ""} onChange={(event) => setSharing({ ...sharing, accounts: { ...sharing.accounts, bluesky: event.target.value.replace(/^@+/, "") } })} placeholder="fieldnotes.bsky.social" /></label></div><button className="button sharing-save" type="button" disabled={busy} onClick={() => void saveSharing()}><IconCheck size={17} /> Save sharing setup</button></div>
      <div><fieldset><legend>Networks</legend><div className="network-grid">{networkOptions.map(({ value, label, icon: Icon }) => <label className="network-toggle" key={value}><input type="checkbox" checked={sharing.networks.includes(value)} onChange={(event) => setSharing({ ...sharing, networks: event.target.checked ? [...sharing.networks, value] : sharing.networks.filter((item) => item !== value) })} /><span><Icon size={18} /><b>{label}</b>{sharing.networks.includes(value) && <IconCheck size={15} />}</span></label>)}</div></fieldset><fieldset><legend>Show on</legend>{contentTypes.map((type) => <label className="setting-check" key={type.type_key}><input type="checkbox" checked={sharing.content_types.includes(type.type_key)} onChange={(event) => setSharing({ ...sharing, content_types: event.target.checked ? [...sharing.content_types, type.type_key] : sharing.content_types.filter((item) => item !== type.type_key) })} /><span>{type.label}</span></label>)}</fieldset></div>
    </section>

    <section className="seo-inventory">
      <div className="seo-inventory-head"><div><p className="eyebrow">Search inventory</p><h2>Find the work that matters</h2></div><span>{report.total} matching items</span></div>
      <div className="seo-filter-bar">
        <label className="seo-query"><IconSearch size={18} /><input aria-label="Search SEO inventory" value={filters.q} onChange={(event) => updateFilter("q", event.target.value)} placeholder="Search titles, slugs, and excerpts" /></label>
        <select aria-label="Filter by content model" value={filters.content_type} onChange={(event) => updateFilter("content_type", event.target.value)}><option value="">All models</option>{contentTypes.map((type) => <option value={type.type_key} key={type.type_key}>{type.label}</option>)}</select>
        <select aria-label="Filter by status" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="">All statuses</option>{["draft", "published", "scheduled", "archived"].map((value) => <option value={value} key={value}>{value}</option>)}</select>
        <select aria-label="Filter by readiness" value={filters.readiness} onChange={(event) => updateFilter("readiness", event.target.value)}><option value="">Any readiness</option><option value="ready">Ready</option><option value="needs_work">Needs work</option></select>
        <select aria-label="Filter by SEO issue" value={filters.issue} onChange={(event) => updateFilter("issue", event.target.value)}><option value="">Any issue</option>{["missing_title", "missing_description", "missing_keyword", "missing_social_image", "missing_canonical", "missing_terms"].map((value) => <option value={value} key={value}>{formatIssue(value)}</option>)}</select>
      </div>

      {selected.length > 0 && <div className="seo-bulk-bar"><span><IconSelector size={18} /><b>{selected.length}</b> selected</span><select aria-label="Bulk SEO field" value={bulkField} onChange={(event) => setBulkField(event.target.value)}><option value="focus_keyword">Focus keyword</option><option value="schema_type">Schema type</option><option value="robots">Robots directive</option><option value="social_title">Social title</option><option value="social_description">Social description</option></select><input aria-label="Bulk value" value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} placeholder="Value to apply" /><button type="button" disabled={busy} onClick={() => void applyBulk()}><IconSparkles size={17} /> Apply to selection</button><button className="bulk-clear" type="button" onClick={() => setSelected([])} aria-label="Clear selection"><IconX size={17} /></button></div>}

      <div className="seo-table" role="table" aria-label="SEO content inventory">
        <div className="seo-table-head" role="row"><span><input type="checkbox" aria-label="Select all visible content" checked={allVisibleSelected} onChange={(event) => setSelected(event.target.checked ? report.items.map((item) => item.id) : [])} /></span><span>Content</span><span>Score</span><span>Focus keyword</span><span>Signals</span><span>Updated</span><span /></div>
        {report.items.map((item) => <div className="seo-table-row" role="row" key={item.id}><span><input type="checkbox" aria-label={`Select ${item.title}`} checked={selected.includes(item.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /></span><span className="seo-content-cell"><b>{item.title}</b><small>{item.content_type_key} · {item.status} · /{item.slug}</small><em>{item.seo.title || "No custom search title"}</em></span><span><i className={`seo-score ${item.readiness}`}>{item.score}</i><small>{item.readiness === "ready" ? "Ready" : "Needs work"}</small></span><span className="keyword-cell">{item.seo.focus_keyword ? <b>{item.seo.focus_keyword}</b> : <em>Not set</em>}<small>{item.term_count} terms · {item.word_count} words</small></span><span className="seo-issues">{item.issues.slice(0, 3).map((issue) => <i key={issue}><IconAlertTriangle size={13} />{formatIssue(issue)}</i>)}{item.issues.length === 0 && <i className="clear"><IconCheck size={13} /> Core fields complete</i>}{item.issues.length > 3 && <small>+{item.issues.length - 3} more</small>}</span><span className="seo-updated">{new Date(item.updated_at).toLocaleDateString()}<small>{item.seo.title_length}/60 title</small><small>{item.seo.description_length}/160 description</small></span><button type="button" aria-label={`Quick edit SEO for ${item.title}`} onClick={() => { setEditing(item); setEditForm(editState(item)); }}><IconEdit size={18} /></button></div>)}
        {report.items.length === 0 && <div className="seo-empty"><IconSearch size={24} /><b>No content matches these filters.</b><span>Clear a filter or try a broader search.</span></div>}
      </div>
      <footer className="seo-pagination"><span>Page {currentPage} of {totalPages}</span><div><button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - report.limit))}><IconChevronLeft size={17} /> Previous</button><button type="button" disabled={offset + report.limit >= report.total} onClick={() => setOffset(offset + report.limit)}>Next <IconChevronRight size={17} /></button></div></footer>
    </section>

    {editing && editForm && <div className="seo-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setEditing(null); setEditForm(null); } }}><section className="seo-modal" role="dialog" aria-modal="true" aria-labelledby="seo-modal-title"><header><div><p className="eyebrow">Quick edit</p><h2 id="seo-modal-title">{editing.title}</h2><span>/{editing.slug}</span></div><button type="button" aria-label="Close quick editor" onClick={() => { setEditing(null); setEditForm(null); }}><IconX size={20} /></button></header><div className="seo-modal-fields"><label className="wide"><span>Search title <small>{editForm.title.length}/60</small></span><input value={editForm.title} maxLength={70} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} /></label><label className="wide"><span>Meta description <small>{editForm.description.length}/160</small></span><textarea value={editForm.description} maxLength={180} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} /></label><label><span>Focus keyword</span><input value={editForm.focus_keyword} onChange={(event) => setEditForm({ ...editForm, focus_keyword: event.target.value })} /></label><label><span>Schema type</span><input value={editForm.schema_type} onChange={(event) => setEditForm({ ...editForm, schema_type: event.target.value })} /></label><label className="wide"><span>Canonical URL</span><input type="url" value={editForm.canonical_url} onChange={(event) => setEditForm({ ...editForm, canonical_url: event.target.value })} /></label><label className="wide"><span>Social image URL</span><input type="url" value={editForm.og_image_url} onChange={(event) => setEditForm({ ...editForm, og_image_url: event.target.value })} /></label><label><span>Social title</span><input value={editForm.social_title} onChange={(event) => setEditForm({ ...editForm, social_title: event.target.value })} /></label><label><span>Robots</span><input value={editForm.robots} onChange={(event) => setEditForm({ ...editForm, robots: event.target.value })} /></label><label className="wide"><span>Social description</span><textarea value={editForm.social_description} onChange={(event) => setEditForm({ ...editForm, social_description: event.target.value })} /></label></div><footer><a href={`/cms/content/${editing.id}`}>Open full editor</a><button className="button" type="button" disabled={busy} onClick={() => void saveQuickEdit()}><IconCheck size={17} />{busy ? "Saving…" : "Save SEO changes"}</button></footer></section></div>}
  </>;
}
