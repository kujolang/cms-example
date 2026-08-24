import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the CMS-backed publication", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Field Notes — Powered by Kujo CMS<\/title>/i);
  assert.match(html, /Ideas with enough room to become useful\./);
  assert.match(html, /Live content from Kujo CMS/);
  assert.match(html, /Hello from Kujo CMS/);
  assert.match(html, /Designing content systems for agents/);
  assert.match(html, /Clarity, context, and control are product features/);
  assert.match(html, /About/);
  assert.match(html, /Principles/);
  assert.match(html, /images\/field-notes-hero\.webp/);
  assert.match(html, /http:\/\/localhost:3000\/og\.png/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("server-renders the CMS console, article details, and standalone pages", async () => {
  const [consoleResponse, articleResponse, pageResponse] = await Promise.all([
    render("/cms"),
    render("/articles/hello-kujo"),
    render("/pages/principles"),
  ]);

  assert.equal(consoleResponse.status, 200);
  assert.equal(articleResponse.status, 200);
  assert.equal(pageResponse.status, 200);

  const [consoleHtml, articleHtml, pageHtml] = await Promise.all([
    consoleResponse.text(),
    articleResponse.text(),
    pageResponse.text(),
  ]);
  assert.match(consoleHtml, /Content, clearly\./);
  assert.match(consoleHtml, /API connected/);
  assert.match(consoleHtml, /Agent-ready discovery/);
  assert.match(articleHtml, /<title>Hello from Kujo CMS — Field Notes<\/title>/i);
  assert.match(articleHtml, /A CMS that stays out of the frontend/);
  assert.match(articleHtml, /Keep control where it belongs/);
  assert.match(articleHtml, /property="og:image"/i);
  assert.match(pageHtml, /<title>Principles — Field Notes<\/title>/i);
  assert.match(pageHtml, /Build for understanding/);
  assert.match(pageHtml, /Keep the frontend free/);
});

test("removes the disposable starter surface", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /getArticles/);
  assert.match(layout, /Field Notes — Powered by Kujo CMS/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});
