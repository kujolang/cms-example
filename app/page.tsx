/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */
import {
  formatCmsDate,
  getArticles,
  getEntryMeta,
  type CmsEntry,
} from "../lib/cms";
import SiteFooter from "./SiteFooter";
import SiteHeader from "./SiteHeader";

const principles = [
  ["Clarity", "A public content API with predictable, inspectable responses."],
  ["Context", "Content models carry meaning across every frontend you build."],
  ["Control", "Publishing rules, credentials, and presentation stay in your hands."],
];

export default async function Home() {
  let articles: CmsEntry[] = [];
  let cmsOnline = true;

  try {
    articles = await getArticles().then((result) => result.items);
  } catch {
    cmsOnline = false;
  }

  return (
    <main>
      <SiteHeader />

      <section className="hero">
        <div className="hero-content">
          <p className="eyebrow">{cmsOnline ? "Live content from Kujo CMS" : "CMS connection unavailable"}</p>
          <h1>Ideas with enough room to become useful.</h1>
          <p className="hero-copy">
            Field Notes is an independent publication about building software with
            clarity, context, and control.
          </p>
          <a className="button" href="/articles">Read the latest</a>
        </div>
        <div className="hero-visual" aria-label="Abstract green, lime, and lavender studio composition">
          <span className="hero-orbit hero-orbit-large" />
          <span className="hero-orbit hero-orbit-small" />
          <img src="/images/field-notes-hero.webp" width="1586" height="992" fetchPriority="high" decoding="async" alt="Sculptural green and lime forms in a sunlit studio" />
        </div>
      </section>

      <section className="principles" aria-label="Publication principles">
        {principles.map(([title, copy], index) => (
          <article key={title}>
            <p className="principle-number">0{index + 1}</p>
            <h2>{title}</h2>
            <p>{copy}</p>
          </article>
        ))}
      </section>

      <section className="articles-section" id="articles">
        <div className="section-heading split-heading">
          <div>
            <p className="eyebrow">Published from the CMS</p>
            <h2>Latest field notes.</h2>
          </div>
          <p>{articles.length} published {articles.length === 1 ? "entry" : "entries"}</p>
        </div>

        {!cmsOnline && (
          <p className="connection-alert">
            Start the Kujo CMS API on port 4200, then refresh this page.
          </p>
        )}

        <div className="article-grid">
          {articles.map((article, index) => {
            const meta = getEntryMeta(article);
            const coverImage = typeof meta.cover_image === "string" ? meta.cover_image : "/images/clarity-context-control.webp";
            return (
            <a className="article-card" href={`/articles/${article.slug}`} key={article.id}>
              <div className="card-art">
                <img src={coverImage} width="1672" height="941" loading="lazy" decoding="async" alt={`${article.title} cover artwork`} />
                <span aria-hidden="true">0{index + 1}</span>
              </div>
              <div className="card-meta">
                <span>{article.terms?.[0]?.name ?? "Field Note"}</span>
                <time>{formatCmsDate(article.published_at)}</time>
              </div>
              <h3>{article.title}</h3>
              <p>{article.excerpt}</p>
              <span className="read-link">Read article →</span>
            </a>
          )})}
        </div>

        {cmsOnline && articles.length === 0 && (
          <p className="empty-note">Publish an `article` entry and it will appear here.</p>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
