/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { formatCmsDate, getArticles, getEntryMeta } from "../../lib/cms";
import SiteFooter from "../SiteFooter";
import SiteHeader from "../SiteHeader";

export const metadata: Metadata = { title: "Articles", description: "Browse every Field Notes article." };

export default async function ArticlesPage() {
  const articles = await getArticles().then((result) => result.items).catch(() => []);
  return <main><SiteHeader /><section className="articles-index"><p className="eyebrow">Field Notes archive</p><h1>Articles</h1><p className="articles-index-intro">Practical essays about clear systems, useful context, explicit control, and agent-ready publishing.</p><div className="article-stack">{articles.map((article) => { const meta = getEntryMeta(article); const image = typeof meta.cover_image === "string" ? meta.cover_image : "/images/clarity-context-control.webp"; return <a href={`/articles/${article.slug}`} key={article.id}><img src={image} width="1672" height="941" loading="lazy" alt="" /><span><small>{article.terms?.[0]?.name ?? "Field Note"} · {formatCmsDate(article.published_at)}</small><h2>{article.title}</h2><p>{article.excerpt}</p><b>Read article →</b></span></a>; })}</div></section><SiteFooter /></main>;
}
