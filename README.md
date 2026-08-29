# Kujo CMS Example

This project is a working example of the site-building flow in the Kujo CMS `HOWTO.md`.

It includes:

- A public editorial frontend at `http://localhost:3000/`
- A stacked article archive at `http://localhost:3000/articles`
- Full article detail routes at `http://localhost:3000/articles/:slug`
- Standalone CMS page routes at `http://localhost:3000/pages/:slug`
- A browser-friendly CMS console at `http://localhost:3000/cms`
- The raw Kujo CMS backend at `http://127.0.0.1:4200/v1`
- An isolated SQLite database in `.data/`

The frontend is a separate application. It only reads published content from the CMS public API; write credentials stay in the local seed script.

The publication includes a consistent site header and footer, a live slide-out search, responsive article archive, configurable Tabler-powered share links, newsletter callouts, and a rich Markdown renderer with syntax-highlighted code and copy controls.

The CMS Studio provides a familiar multi-page administration flow: `/cms` is a dashboard, `/cms/content` is a browse-first, filterable content list, and creation, editing, taxonomies, SEO reporting, social-sharing controls, user management, and registration settings each have dedicated routes. The SEO workspace is paginated and filterable, exposes issue-level content signals and metadata lengths, supports focused quick edits and checkbox-driven bulk updates, and stores optional X and Bluesky account handles for share attribution. Editors can create articles or pages, edit Markdown with a rendered preview, choose an active author, manage status and scheduling, assign taxonomy terms, create custom taxonomies and comma-separated term batches, edit SEO and custom metadata, upload social images, and save revision snapshots before updates. Every menu, select control, and icon is part of the same responsive site kit, with icons supplied by Tabler Icons.

The administration API is authenticated and capability-gated. Users, profiles, roles, approval state, social links, and PBKDF2 password credentials are durable records in the Kujo CMS database. Administrators can create and edit users, approve or reject registrations, suspend accounts, reset passwords, and choose whether public signup is open, approval-based, or closed. Every signed-in user has a self-service `/account` page. Local development demonstrates signed, HTTP-only, SameSite session cookies; hosted Sites can use platform-provided authenticated-user headers. The browser never receives password hashes, the CMS write token, or the signing secret. Image uploads are resized and converted to WebP in the browser, then persisted through the CMS media library; replace the local media adapter with object storage for a public deployment.

All shipped raster assets use WebP. Public article cards lazy-load images, while above-the-fold and detail images carry explicit dimensions and priority hints.

## Run It

Install dependencies once:

```bash
npm install
```

Start the CMS backend in the first terminal:

```bash
npm run cms:start
```

Seed five complete articles, two complete pages, their metadata, taxonomy, and image references in a second terminal:

```bash
npm run cms:seed
```

Start the frontend:

```bash
npm run dev
```

Open:

- Frontend: `http://localhost:3000/`
- CMS console: `http://localhost:3000/cms`
- Account signup: `http://localhost:3000/signup`
- User profile: `http://localhost:3000/account`
- Raw backend API: `http://127.0.0.1:4200/v1`

Local CMS Studio demonstration accounts:

- Administrator: `admin@fieldnotes.local` / `fieldnotes-demo`
- Editor: `editor@fieldnotes.local` / `editor-demo`

These accounts are bootstrapped into the local CMS database on first use. Set a 32+ character `CMS_STUDIO_SESSION_SECRET` and use an appropriate production identity path before exposing the studio publicly.

Agent and terminal access mirrors the SEO workspace through the backend API and CLI. With the local backend running, use `npm run cms:seo -- help`, `npm run cms:seo -- report 'readiness=needs_work&limit=25'`, or the documented update and bulk commands. The wrapper reads the local development token without exposing it to browser code.

## Configuration

The local defaults assume the sibling Kujo CMS repository is at `../cms` and the `kujo` binary is available on `PATH`.

Override either path when needed:

```bash
CMS_REPO=/path/to/cms KUJO_BIN=/path/to/kujo npm run cms:start
```

The frontend uses `CMS_BASE_URL=http://127.0.0.1:4200` by default. Copy `.env.example` to `.env` when you need a different backend URL or a rotated session secret.

Local startup generates a private bootstrap token in `.data/cms-api-token`, and the seed script reads the same token. Override `CMS_API_TOKEN` when needed and apply the production hardening guidance in the CMS HOWTO before deployment.

## Validate

```bash
npm test
```

The backend repository remains the source of truth for API behavior and its release gate. This example stays in its own repository: the reusable user, role, registration, and API work belongs to the backend repository, while the publication frontend and custom administration interface remain here.
