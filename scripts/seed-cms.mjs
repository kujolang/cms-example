const base = process.env.CMS_BASE_URL ?? "http://127.0.0.1:4200";
const token = process.env.CMS_API_TOKEN ?? "change-me-in-production";

async function request(path, options = {}) {
  const response = await fetch(new URL(path, base), {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.method && options.method !== "GET" ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${path}: ${payload.error?.message ?? response.status}`);
  return payload.data;
}

async function upsertEntry(entry) {
  let current;
  try {
    current = await request(`/v1/entries/by-slug/${entry.content_type_key}/${entry.slug}`);
  } catch {
    return request("/v1/entries", {
      method: "POST",
      headers: { "Idempotency-Key": `field-notes-${entry.content_type_key}-${entry.slug}-v2` },
      body: JSON.stringify(entry),
    });
  }
  return request(`/v1/entries/${current.id}`, {
    method: "PATCH",
    body: JSON.stringify(entry),
  });
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

const entries = [
  {
    content_type_key: "article",
    title: "Welcome to Field Notes",
    slug: "welcome",
    status: "published",
    excerpt: "Why this publication exists, what we will explore, and how the site itself demonstrates a more flexible way to publish.",
    body: `# A working publication, not a placeholder

Field Notes is where we examine the systems behind modern digital products: the content contracts, operational boundaries, and agentic workflows that determine whether a platform remains useful after the first demo.

This site is also part of the story. Its articles and standalone pages live in Kujo CMS, while the reading experience is built as an independent frontend. The CMS supplies structure and delivery without prescribing a template, framework, or hosting provider.

## What to expect

We will publish practical essays about headless architecture, content modeling, agent-ready APIs, approval boundaries, and the quiet operational details that make automation dependable. Each piece aims to connect a technical decision to the experience it creates for a team.

The examples will be concrete. When we discuss discoverability, we will point to a machine-readable endpoint. When we discuss frontend freedom, we will show the same content rendered through a custom interface. When a documented path proves inaccurate, we will correct the guide.

## Why clarity comes first

Powerful software is difficult to use when people cannot form a reliable model of it. We care about names that explain themselves, contracts that can be inspected, and errors that make recovery possible.

That clarity serves developers, editors, and agents at the same time. Everyone works from a shared description of what the system can do.

## Context and control complete the picture

Content needs surrounding information to remain meaningful: publication state, authorship, taxonomy, dates, and relationships. Automation needs boundaries: scoped credentials, explicit transitions, and visible approvals.

Together, clarity, context, and control create a system that can move quickly without becoming opaque. That is the territory Field Notes will keep exploring.`,
    author_id: "field-notes",
    meta: { cover_image: "/images/clarity-context-control.webp", reading_time: "5 min" },
    seo: { title: "Welcome to Field Notes", description: "An introduction to the CMS-backed publication and what it explores.", schema_type: "Article" },
  },
  {
    content_type_key: "article",
    title: "Hello from Kujo CMS",
    slug: "hello-kujo",
    status: "published",
    excerpt: "A practical tour of a content system designed for humans, agents, and any frontend you can imagine.",
    body: `# A CMS that stays out of the frontend

Kujo CMS owns the durable parts of publishing: structured content, editorial state, taxonomy, access rules, and a predictable delivery API. It does not decide whether the final experience should be a Next.js publication, a native app, a kiosk, a voice interface, or something that has not been invented yet.

That separation is the point. Editors get a reliable place to manage ideas while product teams keep complete control of presentation, interaction, performance, and deployment.

## Start with a clear contract

The content model is explicit, the public routes are inspectable, and machine-readable discovery is built in. A developer can inspect the API. An agent can inspect the same API. Both can understand which fields exist and which actions require authorization.

Clarity turns integration work into ordinary engineering. There is less guessing, less hidden state, and fewer assumptions trapped inside a theme.

## Give every workflow enough context

Entries are more than blobs of text. Status, authorship, dates, taxonomies, metadata, and relationships travel with the content. That context makes search better, previews more useful, migrations safer, and automated workflows easier to verify.

## Keep control where it belongs

Public delivery remains read-only. Write credentials stay on the server. Publishing is an intentional state transition, and the frontend can be replaced without moving the editorial system. Kujo provides the content foundation; your team decides everything the audience sees.`,
    author_id: "editorial-team",
    meta: { featured: true, cover_image: "/images/field-notes-hero.webp", reading_time: "6 min" },
    seo: { title: "Hello from Kujo CMS", description: "A practical tour of a frontend-agnostic, agent-ready CMS.", schema_type: "Article" },
  },
  {
    content_type_key: "article",
    title: "Designing content systems for agents",
    slug: "designing-content-systems-for-agents",
    status: "published",
    excerpt: "Agentic workflows become dependable when capabilities, context, and boundaries are visible by design.",
    body: `# Agents need a map, not a maze

Most content platforms were designed around a person clicking through an interface. An agent approaches the same system through contracts, descriptions, and permissions. If those surfaces are incomplete, the agent has to guess—and guessing is where reliability disappears.

An agent-ready CMS makes its capabilities discoverable. It explains what content exists, how records are shaped, which operations are public, and where approval is required. The result is not autonomous publishing at any cost. It is automation with legible boundaries.

## Context is part of the interface

A title and body are rarely enough. Useful context includes status, author, taxonomy, timestamps, relationships, and the reason a piece of content exists. That information helps an agent retrieve the right record, propose a safe change, and explain what it plans to do.

The richer the contract, the less orchestration code has to smuggle assumptions between steps.

## Separate proposing from publishing

The strongest workflows give agents room to research, draft, classify, and validate while preserving a clear approval boundary for publication. Drafting can be automated. Publishing can still require a human decision or a narrowly scoped credential.

This distinction is control in practice: automation accelerates the work without quietly expanding its authority.

## Make every run inspectable

Idempotency keys prevent duplicate writes. Structured errors make recovery possible. Audit-friendly state changes help people understand what happened after the fact. Together, these details turn a clever demo into a system a team can trust.

Agentic-first design is ultimately ordinary good systems design: clear inputs, useful context, explicit authority, and observable outcomes.`,
    author_id: "systems-desk",
    meta: { cover_image: "/images/agentic-systems.webp", reading_time: "7 min" },
    seo: { title: "Designing content systems for agents", description: "How clear contracts and approval boundaries make agentic CMS workflows reliable.", schema_type: "Article" },
  },
  {
    content_type_key: "article",
    title: "Clarity, context, and control are product features",
    slug: "clarity-context-and-control",
    status: "published",
    excerpt: "The best infrastructure feels understandable before it feels powerful—and stays governable as it grows.",
    body: `# Three qualities that compound

Infrastructure is often evaluated by its feature list. Teams feel its quality differently: through the speed of understanding, the availability of relevant information, and the confidence that important boundaries will hold. That is why clarity, context, and control belong in the product itself.

## Clarity reduces coordination cost

A clear system names things consistently. Routes behave predictably. Errors say what failed. Documentation matches the running software. These details shorten onboarding and make incidents less mysterious because the team shares the same map.

Clarity also creates leverage for agents. A machine-readable contract is useful because it removes ambiguity for every consumer, human or otherwise.

## Context improves decisions

A content record should carry enough surrounding information to be interpreted correctly. Publication status changes what can be shown. Taxonomy changes where it belongs. Timestamps and authorship change how it should be reviewed.

Context prevents automation from treating every record as interchangeable. It gives both interfaces and workflows the material they need to make relevant decisions.

## Control protects intent

Control is not a wall around the system. It is the ability to decide who can do what, which transitions are allowed, and where the final experience runs. A headless architecture protects frontend choice. Server-side credentials protect write access. Explicit publishing states protect editorial intent.

## Use all three together

Clarity without control can expose a system that is easy to misuse. Control without context creates rigid workflows that cannot adapt. Context without clarity becomes undocumented complexity. Together, the three qualities make a platform easier to understand, safer to automate, and simpler to evolve.`,
    author_id: "product-studio",
    meta: { cover_image: "/images/clarity-context-control.webp", reading_time: "6 min" },
    seo: { title: "Clarity, context, and control are product features", description: "Why understandable, contextual, governable infrastructure works better.", schema_type: "Article" },
  },
  {
    content_type_key: "article",
    title: "The complete Markdown field guide",
    slug: "markdown-field-guide",
    status: "published",
    excerpt: "A visual test of headings, lists, quotations, links, inline code, and syntax-highlighted code blocks in the publication theme.",
    body: `# Markdown should feel editorial, not unfinished

Markdown gives writers a compact format and gives agents a predictable content contract. The frontend still has to turn that source into a reading experience with deliberate hierarchy, spacing, and interaction.

## Headings establish the outline

Every document starts with a useful hierarchy. The article title supplies the page-level heading, so content usually begins with a section heading.

### A third-level heading introduces a focused idea

Body copy should remain comfortable beside stronger headings. **Bold text** creates emphasis, _italics add voice_, and inline code such as \`CMS_BASE_URL\` identifies commands or symbols without interrupting the paragraph.

#### Fourth-level headings work inside longer sections

They should be distinct without overwhelming the article. A [well-labeled link](https://kujo.dev) should be recognizable and accessible.

##### Fifth-level heading

This level is useful for deeply structured reference material.

###### Sixth-level heading

If an article needs this depth, the hierarchy should still remain legible.

## Lists make sequences scannable

- Model content explicitly
- Keep publishing credentials on trusted servers
- Attach taxonomy and metadata to the entry
- Render the same contract through any frontend

1. Draft the content
2. Review its context and metadata
3. Publish through an authorized workflow
4. Verify the public delivery path

> A content system becomes dependable when its contracts are clear, its context travels with the record, and its authority remains visible.

## Code deserves a professional surface

The copy control uses a Tabler icon and the highlighter distinguishes keywords, strings, comments, and numbers.

\`\`\`typescript
export async function getPublishedArticle(slug: string) {
  const response = await fetch(\`/v1/entries/by-slug/article/\${slug}\`);
  if (!response.ok) return null;

  const payload = await response.json();
  return payload.data;
}
\`\`\`

The same component supports command-line examples without pretending every language needs a heavyweight runtime highlighter.

\`\`\`bash
curl http://127.0.0.1:4200/v1/entries?content_type=article
\`\`\`

---

## The goal is confidence

This article is both documentation and a visual fixture. It ensures common Markdown structures stay polished as the theme evolves, while the source remains readable to editors, developers, and agents.`,
    author_id: "editorial-team",
    meta: { cover_image: "/images/agentic-systems.webp", reading_time: "7 min" },
    seo: { title: "The complete Markdown field guide", description: "See headings, lists, blockquotes, links, inline code, and highlighted code blocks rendered by Field Notes.", schema_type: "Article" },
  },
  {
    content_type_key: "page",
    title: "About",
    slug: "about",
    status: "published",
    excerpt: "Field Notes documents how thoughtful systems are designed, operated, and improved.",
    body: `# A publication about useful systems

Field Notes is a small editorial project about software infrastructure, content architecture, and the changing relationship between people and agents. We focus on the practical decisions that make systems understandable and durable.

The publication itself is a demonstration. Every article and page is stored in Kujo CMS, delivered through its public API, and rendered by an independent frontend. The design can change without rebuilding the content operation underneath it.

## What we cover

We write about agent-ready interfaces, content modeling, authorization boundaries, structured delivery, operational discipline, and the craft of giving complex tools a clear shape.

Our standard is usefulness. An idea should leave the reader with a sharper model, a concrete pattern, or a better question to bring back to their own work.

## How this site works

The frontend makes read-only requests to Kujo CMS. Publishing credentials never ship to the browser. Entries carry metadata and taxonomy alongside their prose, and the same content could power another web framework, a mobile application, or an automated research workflow.

That architecture reflects our editorial premise: presentation should be expressive, content should be portable, and control should remain explicit.`,
    author_id: "field-notes",
    meta: { cover_image: "/images/field-notes-hero.webp" },
    seo: { title: "About Field Notes", description: "What Field Notes covers and how the CMS-backed publication works.", schema_type: "AboutPage" },
  },
  {
    content_type_key: "page",
    title: "Principles",
    slug: "principles",
    status: "published",
    excerpt: "The editorial and technical principles behind every Field Notes story.",
    body: `# Build for understanding

A system is not truly simple when its complexity is merely hidden. We prefer explicit contracts, inspectable behavior, and language that helps readers build an accurate mental model.

## Preserve useful context

Details matter when they change a decision. We keep provenance, state, relationships, and constraints close to the content so people and agents can act with better information.

## Make authority visible

Automation should never quietly inherit more power than the task requires. Public delivery is separate from authenticated mutation, publication is deliberate, and credentials remain on trusted servers.

## Keep the frontend free

Content should not force a visual system, runtime, or deployment model. Kujo CMS provides durable structure and delivery; each product remains free to choose the experience that best serves its audience.

## Test the real path

Documentation is only trustworthy when someone follows it. This example exists to exercise the complete path from model creation and seeding through public delivery and browser rendering. When reality disagrees with the guide, the guide changes.

These principles are less about a particular stack than a way of working: make the system clear, bring the right context forward, and keep meaningful control in the hands of the people responsible for the outcome.`,
    author_id: "field-notes",
    meta: { cover_image: "/images/clarity-context-control.webp" },
    seo: { title: "Field Notes principles", description: "Clarity, context, control, frontend freedom, and real-path testing.", schema_type: "WebPage" },
  },
];

const savedEntries = [];
for (const entry of entries) savedEntries.push(await upsertEntry(entry));

const taxonomies = await request("/v1/taxonomies?sort_by=taxonomy_key&sort_dir=asc");
let topic = taxonomies.items.find((item) => item.taxonomy_key === "topic");
if (!topic) {
  topic = await request("/v1/taxonomies", {
    method: "POST",
    headers: { "Idempotency-Key": "setup-topic-taxonomy-v1" },
    body: JSON.stringify({ taxonomy_key: "topic", label: "Topics", description: "Editorial subject areas" }),
  });
}

const termSpecs = [
  ["Agentic Systems", "agentic-systems", "Tools and workflows designed for agents and humans"],
  ["Product Thinking", "product-thinking", "Principles for understandable, durable products"],
];
const existingTerms = (await request(`/v1/taxonomies/${topic.id}/terms`)).items;
const topicTerms = [];
for (const [name, slug, description] of termSpecs) {
  let term = existingTerms.find((item) => item.slug === slug);
  if (!term) {
    term = await request(`/v1/taxonomies/${topic.id}/terms`, {
      method: "POST",
      headers: { "Idempotency-Key": `field-notes-topic-${slug}-v1` },
      body: JSON.stringify({ name, slug, description }),
    });
  }
  topicTerms.push(term);
}

const tagTaxonomy = taxonomies.items.find((item) => item.taxonomy_key === "tag");
const tagTerms = [];
if (tagTaxonomy) {
  const existingTags = (await request(`/v1/taxonomies/${tagTaxonomy.id}/terms`)).items;
  for (const [name, slug, description] of [["AI", "ai", "Artificial intelligence"], ["Determinism", "determinism", "Deterministic systems and workflows"]]) {
    let term = existingTags.find((item) => item.slug === slug);
    if (!term) term = await request(`/v1/taxonomies/${tagTaxonomy.id}/terms`, { method: "POST", headers: { "Idempotency-Key": `field-notes-tag-${slug}-v1` }, body: JSON.stringify({ name, slug, description }) });
    tagTerms.push(term);
  }
}

for (const entry of savedEntries.filter((item) => item.content_type_key === "article")) {
  const term = entry.slug === "clarity-context-and-control" ? topicTerms[1] : topicTerms[0];
  await request(`/v1/entries/${entry.id}/terms`, {
    method: "POST",
    body: JSON.stringify({ term_ids: entry.slug === "markdown-field-guide" ? [term.id, ...tagTerms.map((tag) => tag.id)] : [term.id] }),
  });
}

console.log(`CMS seeded: ${savedEntries.length} complete entries (${savedEntries.filter((entry) => entry.content_type_key === "article").length} articles, ${savedEntries.filter((entry) => entry.content_type_key === "page").length} pages)`);
