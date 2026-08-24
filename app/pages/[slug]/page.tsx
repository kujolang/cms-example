/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */
import type { Metadata } from "next";
import { getEntryMeta, getPage } from "../../../lib/cms";

type PageProps = { params: Promise<{ slug: string }> };

function renderBody(body: string) {
  return body.split(/\n{2,}/).map((block, index) => {
    if (block.startsWith("# ")) return <h2 key={index}>{block.slice(2)}</h2>;
    if (block.startsWith("## ")) return <h3 key={index}>{block.slice(3)}</h3>;
    return <p key={index}>{block}</p>;
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const page = await getPage((await params).slug);
  if (!page) return { title: "Page not found" };
  const meta = getEntryMeta(page);
  const coverImage = typeof meta.cover_image === "string" ? meta.cover_image : undefined;
  return {
    title: page.title,
    description: page.excerpt,
    openGraph: { title: page.title, description: page.excerpt, images: coverImage ? [coverImage] : [] },
  };
}

export default async function EditorialPage({ params }: PageProps) {
  const page = await getPage((await params).slug);
  if (!page) return <main className="narrow-page"><a className="back-link" href="/">← Field Notes</a><h1>Page not found.</h1></main>;
  const meta = getEntryMeta(page);
  const coverImage = typeof meta.cover_image === "string" ? meta.cover_image : "/images/field-notes-hero.webp";

  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="/">KUJO / FIELD NOTES</a>
        <nav aria-label="Primary navigation"><a href="/#articles">Articles</a><a href="/cms">CMS console</a></nav>
      </header>
      <article className="article-detail page-detail">
        <a className="back-link" href="/">← Field Notes</a>
        <p className="eyebrow">Published page from Kujo CMS</p>
        <h1>{page.title}</h1>
        <p className="article-deck">{page.excerpt}</p>
        <img className="detail-image" src={coverImage} width="1672" height="941" alt="Editorial illustration for this page" />
        <div className="article-body">{renderBody(page.body)}</div>
      </article>
      <footer><p>This standalone page is rendered from the CMS page model.</p><a href="/cms">Inspect the backend →</a></footer>
    </main>
  );
}
