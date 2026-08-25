import { getArticles, getPages } from "../lib/cms";
import SearchHeader, { type SearchItem } from "./SearchHeader";

export default async function SiteHeader() {
  let items: SearchItem[] = [];
  try {
    const [articles, pages] = await Promise.all([getArticles(), getPages()]);
    items = [
      ...articles.items.map((entry) => ({ id: `article-${entry.id}`, title: entry.title, excerpt: entry.excerpt, href: `/articles/${entry.slug}`, type: "Article" })),
      ...pages.items.map((entry) => ({ id: `page-${entry.id}`, title: entry.title, excerpt: entry.excerpt, href: `/pages/${entry.slug}`, type: "Page" })),
    ];
  } catch { items = []; }
  return <SearchHeader items={items} />;
}
