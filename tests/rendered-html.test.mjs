import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/", init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, { ...init, headers: { accept: "text/html", ...(init.headers ?? {}) } }),
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

async function cmsSessionCookie() {
  const response = await render("/api/cms/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({ action: "login", email: "admin@fieldnotes.local", password: "fieldnotes-demo" }),
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
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
  assert.match(html, /http:\/\/localhost:3000\/og\.webp/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("server-renders the CMS console, article details, and standalone pages", async () => {
  const cookie = await cmsSessionCookie();
  const [consoleResponse, articleResponse, pageResponse] = await Promise.all([
    render("/cms", { headers: { cookie } }),
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
  assert.match(consoleHtml, /Dashboard/);
  assert.match(consoleHtml, /Human-friendly\. Agent-ready\./);
  assert.match(consoleHtml, /SEO &amp; sharing/);
  assert.match(articleHtml, /<title>Hello from Kujo CMS — Field Notes<\/title>/i);
  assert.match(articleHtml, /A CMS that stays out of the frontend/);
  assert.match(articleHtml, /Keep control where it belongs/);
  assert.match(articleHtml, /Share this article/);
  assert.match(articleHtml, /Share via email/);
  assert.match(articleHtml, /Useful ideas, delivered without the noise/);
  assert.doesNotMatch(articleHtml, /Published article/);
  assert.match(articleHtml, /property="og:image"/i);
  assert.match(pageHtml, /<title>Field Notes principles — Field Notes<\/title>/i);
  assert.match(pageHtml, /Build for understanding/);
  assert.match(pageHtml, /Keep the frontend free/);
  assert.doesNotMatch(pageHtml, /Published page from Kujo CMS/);
});

test("renders the article archive, shared navigation, search, and rich Markdown", async () => {
  const [archiveResponse, guideResponse, aboutResponse] = await Promise.all([render("/articles"), render("/articles/markdown-field-guide"), render("/pages/about")]);
  assert.equal(archiveResponse.status, 200);
  assert.equal(guideResponse.status, 200);
  assert.equal(aboutResponse.status, 200);
  const [archive, guide, about] = await Promise.all([archiveResponse.text(), guideResponse.text(), aboutResponse.text()]);
  assert.match(archive, /Field Notes archive/);
  assert.match(archive, /The complete Markdown field guide/);
  assert.match(archive, /Search Field Notes/);
  assert.match(guide, /Copy code/);
  assert.match(guide, /code-block/);
  assert.match(guide, /blockquote/);
  for (const html of [archive, guide, about]) {
    assert.match(html, /href="\/articles"/);
    assert.match(html, /href="\/pages\/principles"/);
    assert.match(html, /href="\/pages\/about"/);
    assert.match(html, /Browse/);
    assert.match(html, /Company/);
    assert.match(html, /Contact/);
  }
});

test("server-renders separate CMS administration routes", async () => {
  const cookie = await cmsSessionCookie();
  const responses = await Promise.all([
    render("/cms/content", { headers: { cookie } }),
    render("/cms/content/new", { headers: { cookie } }),
    render("/cms/content/1", { headers: { cookie } }),
    render("/cms/taxonomies", { headers: { cookie } }),
    render("/cms/seo", { headers: { cookie } }),
    render("/cms/ai", { headers: { cookie } }),
    render("/cms/extensions", { headers: { cookie } }),
    render("/cms/users", { headers: { cookie } }),
    render("/cms/users/new", { headers: { cookie } }),
    render("/cms/users/1", { headers: { cookie } }),
  ]);
  responses.forEach((response) => assert.equal(response.status, 200));
  const [content, create, edit, taxonomies, seo, ai, extensions, users, newUser, editUser] = await Promise.all(responses.map((response) => response.text()));
  assert.match(content, /Search by title or slug/);
  assert.match(content, /Filter by content model/);
  assert.match(content, /Filter by taxonomy term/);
  assert.doesNotMatch(content, /Markdown content/);
  assert.match(create, /Create content/);
  assert.match(edit, /Edit content/);
  assert.match(taxonomies, /Organize the publication/);
  assert.match(seo, /Search and social presentation/);
  assert.match(seo, /Sharing channels/);
  assert.match(seo, /Pinterest/);
  assert.match(seo, /Edit X account/);
  assert.match(seo, /Find the work that matters/);
  assert.match(ai, /Agent-ready infrastructure/);
  assert.match(ai, /Discoverable capabilities, guarded execution/);
  assert.match(ai, /Kujo ecosystem/);
  assert.match(extensions, /Themes &amp; plugins/);
  assert.match(extensions, /Your site, without the setup tax/);
  assert.match(extensions, /cms-field-notes-theme/);
  assert.match(users, /People, roles, and access/);
  assert.match(users, /New account policy/);
  assert.match(newUser, /Temporary password/);
  assert.match(editUser, /Web presence/);
  assert.match(content, /tabler-icon/);
});

test("supports approval-based signup and self-service accounts", async () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const signup = await render("/api/cms/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({ action: "signup", display_name: "Test Subscriber", username: `test-${suffix}`, email: `test-${suffix}@example.com`, password: "subscriber-test-password" }),
  });
  assert.equal(signup.status, 201);
  const signupPayload = await signup.json();
  assert.equal(signupPayload.data.pending, true);
  const signupPage = await render("/signup");
  assert.equal(signupPage.status, 200);
  assert.match(await signupPage.text(), /Create your account/);

  const adminCookie = await cmsSessionCookie();
  const account = await render("/account", { headers: { cookie: adminCookie } });
  assert.equal(account.status, 200);
  const accountHtml = await account.text();
  assert.match(accountHtml, /Personal details/);
  assert.match(accountHtml, /Change password/);
});

test("protects CMS pages and API behind an authenticated session", async () => {
  const [page, api, login] = await Promise.all([render("/cms"), render("/api/cms"), render("/cms/login")]);
  assert.ok([302, 307, 308].includes(page.status));
  assert.match(page.headers.get("location") ?? "", /^\/cms\/login/);
  assert.equal(api.status, 401);
  assert.equal(login.status, 200);
  assert.match(await login.text(), /Sign in to Kujo CMS/);
});

test("supports native sign-in and consistent icon-button alignment", async () => {
  const login = await render("/api/cms/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", origin: "http://localhost" },
    body: new URLSearchParams({ email: "admin@fieldnotes.local", password: "fieldnotes-demo", returnTo: "/cms/seo" }),
    redirect: "manual",
  });
  assert.equal(login.status, 303);
  assert.equal(new URL(login.headers.get("location") ?? "", "http://localhost").pathname, "/cms/seo");
  assert.match(login.headers.get("set-cookie") ?? "", /kujo_cms_session=/);

  const invalid = await render("/api/cms/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", origin: "http://localhost" },
    body: new URLSearchParams({ email: "admin@fieldnotes.local", password: "incorrect-password", returnTo: "/cms/seo" }),
    redirect: "manual",
  });
  assert.equal(invalid.status, 303);
  assert.equal(new URL(invalid.headers.get("location") ?? "", "http://localhost").searchParams.get("reason"), "credentials");

  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.button\s*\{[^}]*align-items:\s*center[^}]*gap:\s*8px/s);
  assert.match(css, /:where\(button, a\.button, a\.hosted-login\)\s*>\s*svg\s*\{[^}]*align-self:\s*center/s);
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

test("ships WebP-only raster assets and keeps CMS media private from studio payloads", async () => {
  const publicRoot = new URL("../public/", import.meta.url);
  const imageRoot = new URL("../public/images/", import.meta.url);
  const assets = [...await readdir(publicRoot), ...await readdir(imageRoot)];
  const legacyRaster = assets.filter((name) => /\.(?:png|jpe?g)$/i.test(name));
  assert.deepEqual(legacyRaster, []);
  assert.ok(assets.filter((name) => /\.webp$/i.test(name)).length >= 4);

  const cmsRoute = await readFile(new URL("../app/api/cms/route.ts", import.meta.url), "utf8");
  assert.match(cmsRoute, /key !== "meta_json"/);
  assert.match(cmsRoute, /Cache-Control.*max-age=31536000, immutable/);
  assert.match(cmsRoute, /Sign in to access CMS Studio/);
  const studio = await readFile(new URL("../app/cms/CmsStudio.tsx", import.meta.url), "utf8");
  const seoWorkspace = await readFile(new URL("../app/cms/SeoWorkspace.tsx", import.meta.url), "utf8");
  assert.match(studio, /theme-select-menu/);
  assert.doesNotMatch(studio, /<select\b|StyledSelect/);
  assert.doesNotMatch(studio, /All changes save to the live CMS API|Authenticated CMS API/);
  assert.match(studio, /split\(","\)/);
  assert.match(seoWorkspace, /bulkUpdateSeo/);
  assert.match(seoWorkspace, /focus_keyword/);
  assert.match(seoWorkspace, /Pinterest account/);
  assert.match(seoWorkspace, /network-account-editor/);
  assert.match(cmsRoute, /\/v1\/seo\/entries\/bulk/);
});

test("ships guarded theme and plugin ZIP administration", async () => {
  const [manager, route, inspector, manifest] = await Promise.all([
    readFile(new URL("../app/cms/ExtensionsWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cms/extensions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/extension-package.ts", import.meta.url), "utf8"),
    readFile(new URL("../kujo-theme.json", import.meta.url), "utf8"),
  ]);
  assert.match(manager, /Install now/);
  assert.match(manager, /Activate after installing/);
  assert.match(route, /manage_extensions/);
  assert.match(route, /\/v1\/extensions\/manage/);
  assert.match(inspector, /Encrypted ZIP packages are not supported/);
  assert.match(inspector, /SHA-256/);
  assert.equal(JSON.parse(manifest).distribution.repository, "https://github.com/kujolang/cms-field-notes-theme");
});
