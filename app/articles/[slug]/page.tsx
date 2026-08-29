/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */
import type { Metadata } from "next";
import { formatCmsDate, getArticle, getEntryMeta, getEntrySeo } from "../../../lib/cms";
import { getSocialSharingSettings } from "../../../lib/cms-user-store";
import { NewsletterBox, ShareLinks } from "../../ArticleExtras";
import MarkdownContent from "../../MarkdownContent";
import SiteFooter from "../../SiteFooter";
import SiteHeader from "../../SiteHeader";

type ArticlePageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: "Article not found" };

  const seo = getEntrySeo(article);
  return {
    title: seo.title,
    description: seo.description,
    alternates: seo.canonicalUrl ? { canonical: seo.canonicalUrl } : undefined,
    openGraph: { title: seo.socialTitle, description: seo.socialDescription, type: "article", images: seo.image ? [seo.image] : [] },
    twitter: { card: "summary_large_image", title: seo.socialTitle, description: seo.socialDescription, images: seo.image ? [seo.image] : [] },
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

  const meta = getEntryMeta(article);
  const coverImage = typeof meta.cover_image === "string" ? meta.cover_image : "/images/clarity-context-control.webp";
  const sharing = await getSocialSharingSettings().catch(() => ({ networks: ["x", "linkedin", "facebook", "bluesky", "reddit", "whatsapp", "email", "pinterest"], content_types: ["article"], accounts: {} }));

  return (
    <main>
      <SiteHeader />
      <article className="article-detail">
        <a className="back-link" href="/articles">← All articles</a>
        {article.terms?.[0]?.name && <p className="eyebrow">{article.terms[0].name}</p>}
        <h1>{article.title}</h1>
        <div className="article-byline">
          <span>By {article.author_id}</span>
          <time>{formatCmsDate(article.published_at)}</time>
        </div>
        <img className="detail-image" src={coverImage} width="1672" height="941" fetchPriority="high" decoding="async" alt={`Editorial illustration for ${article.title}`} />
        <p className="article-deck">{article.excerpt}</p>
        <MarkdownContent markdown={article.body} />
        {sharing.content_types.includes("article") && <ShareLinks title={article.title} networks={sharing.networks} accounts={sharing.accounts} />}
        <NewsletterBox />
      </article>
      <SiteFooter />
    </main>
  );
}
