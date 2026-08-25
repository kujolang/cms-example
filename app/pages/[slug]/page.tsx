/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */
import type { Metadata } from "next";
import { getEntryMeta, getEntrySeo, getPage } from "../../../lib/cms";
import MarkdownContent from "../../MarkdownContent";
import SiteFooter from "../../SiteFooter";
import SiteHeader from "../../SiteHeader";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const page = await getPage((await params).slug);
  if (!page) return { title: "Page not found" };
  const seo = getEntrySeo(page);
  return {
    title: seo.title,
    description: seo.description,
    alternates: seo.canonicalUrl ? { canonical: seo.canonicalUrl } : undefined,
    openGraph: { title: seo.title, description: seo.description, images: seo.image ? [seo.image] : [] },
    twitter: { card: "summary_large_image", title: seo.title, description: seo.description, images: seo.image ? [seo.image] : [] },
  };
}

export default async function EditorialPage({ params }: PageProps) {
  const page = await getPage((await params).slug);
  if (!page) return <main className="narrow-page"><a className="back-link" href="/">← Field Notes</a><h1>Page not found.</h1></main>;
  const meta = getEntryMeta(page);
  const coverImage = typeof meta.cover_image === "string" ? meta.cover_image : "/images/field-notes-hero.webp";

  return (
    <main>
      <SiteHeader />
      <article className="article-detail page-detail">
        <a className="back-link" href="/">← Field Notes</a>
        <h1>{page.title}</h1>
        <p className="article-deck">{page.excerpt}</p>
        <img className="detail-image" src={coverImage} width="1672" height="941" fetchPriority="high" decoding="async" alt={`Editorial illustration for ${page.title}`} />
        <MarkdownContent markdown={page.body} />
      </article>
      <SiteFooter />
    </main>
  );
}
