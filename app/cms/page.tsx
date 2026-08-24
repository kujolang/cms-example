/* eslint-disable @next/next/no-html-link-for-pages */
import type { Metadata } from "next";
import {
  CMS_BASE_URL,
  getArticles,
  getCmsHealth,
  getContentTypes,
  getPages,
  getTaxonomies,
  type CmsEntry,
} from "../../lib/cms";

export const metadata: Metadata = {
  title: "CMS Console",
  description: "A live view of the Kujo CMS backend, content models, entries, and API discovery surfaces.",
};

const endpoints = [
  ["Capabilities", "/v1"],
  ["API contract", "/v1/openapi.json"],
  ["LLM discovery", "/.well-known/llms.txt"],
  ["Sitemap", "/sitemap.xml"],
  ["RSS feed", "/rss.xml"],
];

export default async function CmsConsole() {
  let dashboard: null | {
    health: Awaited<ReturnType<typeof getCmsHealth>>;
    entries: CmsEntry[];
    contentTypes: Awaited<ReturnType<typeof getContentTypes>>;
    taxonomies: Awaited<ReturnType<typeof getTaxonomies>>;
  } = null;

  try {
    const [health, articles, pages, contentTypes, taxonomies] = await Promise.all([
      getCmsHealth(),
      getArticles(),
      getPages(),
      getContentTypes(),
      getTaxonomies(),
    ]);
    dashboard = { health, entries: [...articles.items, ...pages.items], contentTypes, taxonomies };
  } catch {
    return (
      <main className="narrow-page">
        <a className="back-link" href="/">← Field Notes</a>
        <p className="eyebrow">Backend unavailable</p>
        <h1>Start Kujo CMS on port 4200.</h1>
        <p className="hero-copy">The console will reconnect when the API is available.</p>
      </main>
    );
  }

  const { health, entries, contentTypes, taxonomies } = dashboard;

  return (
      <main className="console-shell">
        <aside className="console-sidebar">
          <a className="wordmark console-wordmark" href="/">KUJO / CMS</a>
          <nav aria-label="CMS navigation">
            <a className="active" href="#overview">Overview</a>
            <a href="#content">Content</a>
            <a href="#models">Models</a>
            <a href="#api">API surface</a>
          </nav>
          <a className="view-site-link" href="/">← View publication</a>
        </aside>

        <div className="console-content">
          <header className="console-header" id="overview">
            <div>
              <p className="eyebrow">Backend overview</p>
              <h1>Content, clearly.</h1>
            </div>
            <span className="health-pill"><span className="status-dot" /> API connected</span>
          </header>

          <section className="metric-grid" aria-label="CMS metrics">
            <article><span>Published entries</span><strong>{entries.length}</strong></article>
            <article><span>Content models</span><strong>{contentTypes.total}</strong></article>
            <article><span>Taxonomies</span><strong>{taxonomies.total}</strong></article>
            <article><span>Schema status</span><strong>{health.db}</strong></article>
          </section>

          <section className="console-section" id="content">
            <div className="console-section-heading">
              <div><p className="eyebrow">Public delivery</p><h2>Published content</h2></div>
              <a href={`${CMS_BASE_URL}/v1/entries`} target="_blank" rel="noreferrer">Raw JSON ↗</a>
            </div>
            <div className="content-table" role="table" aria-label="Published content">
              <div className="table-row table-head" role="row">
                <span>Title</span><span>Type</span><span>Status</span><span>Slug</span>
              </div>
              {entries.map((entry) => (
                <a className="table-row" href={`/${entry.content_type_key === "page" ? "pages" : "articles"}/${entry.slug}`} role="row" key={`${entry.content_type_key}-${entry.id}`}>
                  <strong>{entry.title}</strong>
                  <span>{entry.content_type_key}</span>
                  <span className="published-label">{entry.status}</span>
                  <code>{entry.slug}</code>
                </a>
              ))}
            </div>
          </section>

          <section className="console-section" id="models">
            <div className="console-section-heading">
              <div><p className="eyebrow">Reusable structure</p><h2>Content models</h2></div>
            </div>
            <div className="model-grid">
              {contentTypes.items.map((model) => (
                <article key={model.id}>
                  <code>{model.type_key}</code>
                  <h3>{model.label}</h3>
                  <p>{model.description}</p>
                  <span>{model.is_system ? "System model" : "Custom model"}</span>
                </article>
              ))}
              {taxonomies.items.map((taxonomy) => (
                <article key={`taxonomy-${taxonomy.id}`}>
                  <code>{taxonomy.taxonomy_key}</code>
                  <h3>{taxonomy.label}</h3>
                  <p>{taxonomy.description}</p>
                  <span>Taxonomy</span>
                </article>
              ))}
            </div>
          </section>

          <section className="console-section" id="api">
            <div className="console-section-heading">
              <div><p className="eyebrow">Agent-ready discovery</p><h2>API surface</h2></div>
            </div>
            <div className="endpoint-list">
              {endpoints.map(([label, path]) => (
                <a href={`${CMS_BASE_URL}${path}`} target="_blank" rel="noreferrer" key={path}>
                  <span>{label}</span><code>GET {path}</code><b>↗</b>
                </a>
              ))}
            </div>
          </section>
        </div>
      </main>
  );
}
