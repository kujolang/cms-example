"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconCheck,
  IconDownload,
  IconExternalLink,
  IconPalette,
  IconPlug,
  IconRefresh,
  IconShieldCheck,
  IconUpload,
  IconX,
} from "@tabler/icons-react";

type Kind = "theme" | "plugin";
type Manifest = {
  key: string;
  name: string;
  version: string;
  description?: string;
  author?: { name?: string };
  distribution?: { repository?: string; homepage?: string };
  supports?: string[];
  capabilities?: string[];
  runtime?: string;
};
type InstalledExtension = {
  id: number;
  status: "active" | "inactive";
  manifest: Manifest;
  package?: { filename?: string; size_bytes?: number; sha256?: string } | null;
  updated_at?: string | number;
};
type ExtensionData = {
  catalog: { themes: InstalledExtension[]; plugins: InstalledExtension[]; counts: { themes: number; plugins: number } };
  contracts: { package?: { max_archive_bytes?: number; max_files?: number } };
};

async function extensionRequest<T>(options?: RequestInit) {
  const response = await fetch("/api/cms/extensions", options);
  const payload = await response.json() as { ok: boolean; data?: T; error?: string };
  if (response.status === 401) {
    window.location.assign(`/cms/login?returnTo=${encodeURIComponent("/cms/extensions")}`);
    throw new Error("Sign in required.");
  }
  if (!response.ok || !payload.ok || payload.data === undefined) throw new Error(payload.error ?? "The extension request failed.");
  return payload.data;
}

function formatBytes(value = 0) {
  if (!value) return "Manifest install";
  return value < 1024 * 1024 ? `${Math.ceil(value / 1024)} KB package` : `${(value / 1024 / 1024).toFixed(1)} MB package`;
}

export default function ExtensionsWorkspace() {
  const [data, setData] = useState<ExtensionData | null>(null);
  const [tab, setTab] = useState<Kind>("theme");
  const [installKind, setInstallKind] = useState<Kind | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [activate, setActivate] = useState(true);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    try { setData(await extensionRequest<ExtensionData>()); setNotice(""); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Themes and plugins are unavailable."); }
  };

  useEffect(() => {
    let active = true;
    void extensionRequest<ExtensionData>().then((next) => { if (active) setData(next); }).catch((error) => { if (active) setNotice(error instanceof Error ? error.message : "Themes and plugins are unavailable."); });
    return () => { active = false; };
  }, []);

  const openInstaller = (kind: Kind) => {
    setInstallKind(kind);
    setFile(null);
    setActivate(true);
    setNotice("");
  };

  const install = async () => {
    if (!file || !installKind) { setNotice("Choose a ZIP package first."); return; }
    setWorking(true);
    try {
      const form = new FormData();
      form.set("package", file);
      form.set("kind", installKind);
      form.set("activate", String(activate));
      await extensionRequest({ method: "POST", body: form });
      setInstallKind(null);
      setNotice(`${installKind === "theme" ? "Theme" : "Plugin"} installed${activate ? " and activated" : ""}.`);
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The package could not be installed.");
    } finally { setWorking(false); }
  };

  const action = async (actionName: "activateTheme" | "setPluginStatus", item: InstalledExtension, status?: "active" | "inactive") => {
    setWorking(true);
    try {
      await extensionRequest({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: actionName, id: item.id, status }) });
      setNotice(actionName === "activateTheme" ? `${item.manifest.name} is now the active theme.` : `${item.manifest.name} is now ${status}.`);
      await refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "The extension could not be updated."); }
    finally { setWorking(false); }
  };

  const items = tab === "theme" ? data?.catalog.themes ?? [] : data?.catalog.plugins ?? [];
  return <div className="extensions-workspace">
    <section className="extensions-intro">
      <div><span className="extensions-kicker"><IconShieldCheck size={17} /> Verified packages</span><h2>Your site, without the setup tax.</h2><p>Upload a portable ZIP and the CMS checks its structure, manifest, size, paths, and integrity before installation.</p></div>
      <button type="button" className="button button-secondary" disabled={working} onClick={() => void refresh()}><IconRefresh size={17} className={working ? "spin" : ""} /><span>Refresh</span></button>
    </section>

    {notice && <div className="extensions-notice" role="status">{notice}</div>}

    <section className="extension-library">
      <div className="extension-library-head">
        <div className="extension-tabs" role="tablist" aria-label="Extension type">
          <button type="button" role="tab" aria-selected={tab === "theme"} className={tab === "theme" ? "active" : ""} onClick={() => setTab("theme")}><IconPalette size={18} /><span>Themes</span><b>{data?.catalog.counts.themes ?? 0}</b></button>
          <button type="button" role="tab" aria-selected={tab === "plugin"} className={tab === "plugin" ? "active" : ""} onClick={() => setTab("plugin")}><IconPlug size={18} /><span>Plugins</span><b>{data?.catalog.counts.plugins ?? 0}</b></button>
        </div>
        <button type="button" className="button" onClick={() => openInstaller(tab)}><IconUpload size={18} /><span>Upload {tab} ZIP</span></button>
      </div>

      <div className="extension-grid">
        {items.map((item) => {
          const active = item.status === "active";
          const repository = item.manifest.distribution?.repository || item.manifest.distribution?.homepage;
          const tags = tab === "theme" ? item.manifest.supports ?? [] : item.manifest.capabilities ?? [];
          return <article className={`extension-card ${active ? "active" : ""}`} key={`${tab}-${item.id}`}>
            <div className="extension-card-icon">{tab === "theme" ? <IconPalette size={25} /> : <IconPlug size={25} />}</div>
            <div className="extension-card-body">
              <div className="extension-title"><div><h3>{item.manifest.name}</h3><span>v{item.manifest.version}</span></div>{active && <em><IconCheck size={14} /> Active</em>}</div>
              <p>{item.manifest.description || `A portable ${tab} package.`}</p>
              <div className="extension-tags">{tags.slice(0, 4).map((tag) => <span key={tag}>{tag.replace(/_/g, " ")}</span>)}</div>
              <small>By {item.manifest.author?.name || "Independent creator"} · {formatBytes(item.package?.size_bytes)}</small>
              <div className="extension-card-actions">
                {tab === "theme" && !active && <button type="button" className="button button-small" disabled={working} onClick={() => void action("activateTheme", item)}><IconCheck size={16} /><span>Activate</span></button>}
                {tab === "plugin" && <button type="button" className={`button button-small ${active ? "button-secondary" : ""}`} disabled={working} onClick={() => void action("setPluginStatus", item, active ? "inactive" : "active")}><IconPlug size={16} /><span>{active ? "Deactivate" : "Activate"}</span></button>}
                {repository && <a className="button button-small button-quiet" href={repository} target="_blank" rel="noreferrer"><IconExternalLink size={16} /><span>Source</span></a>}
              </div>
            </div>
          </article>;
        })}
        {items.length === 0 && <div className="extensions-empty"><div>{tab === "theme" ? <IconPalette size={28} /> : <IconPlug size={28} />}</div><h3>No {tab}s installed yet</h3><p>Upload a portable ZIP to add one without touching the command line.</p><button type="button" className="button" onClick={() => openInstaller(tab)}><IconUpload size={17} /><span>Choose ZIP</span></button></div>}
      </div>
    </section>

    <section className="extension-maker-panel"><div><span className="eyebrow">Build once. Share anywhere.</span><h2>Create your own {tab}</h2><p>Every package has a small, documented manifest and stays in its own repository. Fork the bundled Field Notes theme or the contact form plugin, remix it, and distribute the ZIP yourself.</p></div><div><a className="button button-secondary" href={tab === "theme" ? "https://github.com/kujolang/cms-field-notes-theme" : "https://github.com/kujolang/cms-contact-form"} target="_blank" rel="noreferrer"><IconDownload size={17} /><span>Open starter repository</span></a></div></section>

    {installKind && <div className="extension-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !working) setInstallKind(null); }}>
      <section className="extension-modal" role="dialog" aria-modal="true" aria-labelledby="extension-install-title">
        <header><div><span className="eyebrow">One-click setup</span><h2 id="extension-install-title">Install {installKind}</h2></div><button type="button" className="icon-button" aria-label="Close installer" disabled={working} onClick={() => setInstallKind(null)}><IconX size={19} /></button></header>
        <p>Upload the ZIP you downloaded from a creator. The package is checked before anything is registered with your CMS.</p>
        <button type="button" className={`extension-dropzone ${dragging ? "dragging" : ""}`} onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); setFile(event.dataTransfer.files[0] ?? null); }}>
          <IconUpload size={29} /><strong>{file ? file.name : "Drop a ZIP here"}</strong><span>{file ? formatBytes(file.size) : "or click to choose a package up to 16 MB"}</span>
        </button>
        <input ref={inputRef} className="visually-hidden" type="file" accept=".zip,application/zip" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        <div className="extension-activate-option"><input id="activate-extension-after-install" type="checkbox" checked={activate} onChange={(event) => setActivate(event.target.checked)} /><label htmlFor="activate-extension-after-install"><b>Activate after installing</b><small>{installKind === "theme" ? "This becomes the site’s selected theme." : "The plugin can begin providing its declared features."}</small></label></div>
        <footer><button type="button" className="button button-secondary" disabled={working} onClick={() => setInstallKind(null)}>Cancel</button><button type="button" className="button" disabled={!file || working} onClick={() => void install()}><IconUpload size={17} /><span>{working ? "Checking package…" : "Install now"}</span></button></footer>
      </section>
    </div>}
  </div>;
}
