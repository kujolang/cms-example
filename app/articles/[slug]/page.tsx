import type { Metadata } from "next";
import { formatCmsDate, getArticle } from "../../../lib/cms";

type ArticlePageProps = { params: Promise<{ slug: string }> };

function renderBody(body: string) {
  return body.split(/\n{2,}/).map((block, index) => {
    if (block.startsWith("# ")) return <h2 key={index}>{block.slice(2)}</h2>;
    if (block.startsWith("## ")) return <h3 key={index}>{block.slice(3)}</h3>;
    return <p key={index}>{block}</p>;
  });
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: "Article not found" };

  const title = article.title;
  const description = article.excerpt;
  return {
    title,
    description,
    openGraph: { title, description, type: "article", images: [] },
    twitter: { card: "summary", title, description, images: [] },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) {
    return (
      <main className="narrow-page">
        <a className="back-link" href="/">← Field Notes</a>
        <h1>Article not found.</h1>
      </main>
    );
  }

  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="/">KUJO / FIELD NOTES</a>
        <nav aria-label="Primary navigation"><a href="/cms">CMS console</a></nav>
      </header>
      <article className="article-detail">
        <a className="back-link" href="/">← All field notes</a>
        <p className="eyebrow">{article.terms?.[0]?.name ?? "Published article"}</p>
        <h1>{article.title}</h1>
        <div className="article-byline">
          <span>By {article.author_id}</span>
          <time>{formatCmsDate(article.published_at)}</time>
        </div>
        <p className="article-deck">{article.excerpt}</p>
        <div className="article-body">{renderBody(article.body)}</div>
      </article>
      <footer>
        <p>This page is rendered from a published Kujo CMS entry.</p>
        <a href="/cms">Inspect the backend →</a>
      </footer>
    </main>
  );
}
