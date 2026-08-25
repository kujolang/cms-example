"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { useEffect, useMemo, useRef, useState } from "react";
import { IconArrowRight, IconSearch, IconX } from "@tabler/icons-react";

export type SearchItem = { id: string; title: string; excerpt: string; href: string; type: string };

export default function SearchHeader({ items }: { items: SearchItem[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items.slice(0, 5);
    return items.filter((item) => `${item.title} ${item.excerpt} ${item.type}`.toLowerCase().includes(normalized)).slice(0, 8);
  }, [items, query]);
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return <>
    <header className="site-header">
      <a className="wordmark" href="/">KUJO / FIELD NOTES</a>
      <nav aria-label="Primary navigation">
        <a href="/articles">Articles</a>
        <a href="/pages/principles">Principles</a>
        <a href="/pages/about">About</a>
        <a className="button button-small" href="/cms">CMS console</a>
        <button className="header-search-button" type="button" aria-label="Search Field Notes" onClick={() => setOpen(true)}><IconSearch size={20} stroke={1.8} /></button>
      </nav>
    </header>
    <div className={`search-drawer ${open ? "open" : ""}`} aria-hidden={!open}>
      <button className="search-scrim" type="button" aria-label="Close search" onClick={() => setOpen(false)} />
      <section className="search-panel" role="dialog" aria-modal="true" aria-label="Search Field Notes">
        <div className="search-panel-head"><span>Search Field Notes</span><button type="button" aria-label="Close search" onClick={() => setOpen(false)}><IconX size={22} /></button></div>
        <label className="site-search-field"><IconSearch size={22} /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search articles and pages…" /></label>
        <div className="search-results" aria-live="polite">
          <p>{query ? `${results.length} results` : "Recent content"}</p>
          {results.map((item) => <a href={item.href} key={item.id}><span><small>{item.type}</small><b>{item.title}</b><em>{item.excerpt}</em></span><IconArrowRight size={19} /></a>)}
          {results.length === 0 && <div className="search-empty">No content matches “{query}”.</div>}
        </div>
      </section>
    </div>
  </>;
}
