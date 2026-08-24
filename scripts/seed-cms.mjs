const base = process.env.CMS_BASE_URL ?? "http://127.0.0.1:4200";
const token = process.env.CMS_API_TOKEN ?? "change-me-in-production";

async function request(path, options = {}) {
  const response = await fetch(new URL(path, base), {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.method && options.method !== "GET"
        ? { Authorization: `Bearer ${token}` }
        : {}),
      ...(options.headers ?? {}),
    },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${path}: ${payload.error?.message ?? response.status}`);
  return payload.data;
}

const contentTypes = await request("/v1/content-types?sort_by=type_key&sort_dir=asc");
if (!contentTypes.items.some((item) => item.type_key === "article")) {
  await request("/v1/content-types", {
    method: "POST",
    headers: { "Idempotency-Key": "setup-article-content-type-v1" },
    body: JSON.stringify({
      type_key: "article",
      label: "Articles",
      singular_label: "Article",
      description: "Long-form editorial content",
      supports: { excerpt: true, seo: true },
    }),
  });
}

let article;
try {
  article = await request("/v1/entries/by-slug/article/hello-kujo");
} catch {
  article = await request("/v1/entries", {
    method: "POST",
    headers: { "Idempotency-Key": "publish-hello-kujo-v1" },
    body: JSON.stringify({
      content_type_key: "article",
      title: "Hello from Kujo CMS",
      slug: "hello-kujo",
      status: "published",
      excerpt: "Our first article from a frontend-agnostic CMS.",
      body: "# Hello, world!\n\nThis body is stored by the CMS and rendered by the frontend.",
      author_id: "editorial-team",
      meta: { featured: true },
      seo: {
        title: "Hello from Kujo CMS",
        description: "A first site powered by Kujo CMS.",
        schema_type: "Article",
      },
    }),
  });
}

const taxonomies = await request("/v1/taxonomies?sort_by=taxonomy_key&sort_dir=asc");
let topic = taxonomies.items.find((item) => item.taxonomy_key === "topic");
if (!topic) {
  topic = await request("/v1/taxonomies", {
    method: "POST",
    headers: { "Idempotency-Key": "setup-topic-taxonomy-v1" },
    body: JSON.stringify({
      taxonomy_key: "topic",
      label: "Topics",
      description: "Editorial subject areas",
    }),
  });
}

const terms = await request(`/v1/taxonomies/${topic.id}/terms`);
let term = terms.items.find((item) => item.slug === "agentic-systems");
if (!term) {
  term = await request(`/v1/taxonomies/${topic.id}/terms`, {
    method: "POST",
    headers: { "Idempotency-Key": "setup-agentic-systems-term-v1" },
    body: JSON.stringify({
      name: "Agentic Systems",
      slug: "agentic-systems",
      description: "Tools and workflows designed for agents and humans",
    }),
  });
}

await request(`/v1/entries/${article.id}/terms`, {
  method: "POST",
  headers: { "Idempotency-Key": "assign-hello-kujo-agentic-systems-v1" },
  body: JSON.stringify({ term_ids: [term.id] }),
});

console.log(`CMS seeded: ${article.title} (${article.slug})`);
