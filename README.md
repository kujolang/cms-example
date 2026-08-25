# Kujo CMS Example

This project is a working example of the site-building flow in the Kujo CMS `HOWTO.md`.

It includes:

- A public editorial frontend at `http://localhost:3000/`
- Full article detail routes at `http://localhost:3000/articles/:slug`
- Standalone CMS page routes at `http://localhost:3000/pages/:slug`
- A browser-friendly CMS console at `http://localhost:3000/cms`
- The raw Kujo CMS backend at `http://127.0.0.1:4200/v1`
- An isolated SQLite database in `.data/`

The frontend is a separate application. It only reads published content from the CMS public API; write credentials stay in the local seed script.

The CMS Studio provides a familiar multi-page administration flow: `/cms` is a dashboard, `/cms/content` is a browse-first content list, and creation, editing, taxonomies, SEO reporting, and users/roles each have dedicated routes. Editors can create articles or pages, edit Markdown with a rendered preview, choose a configured user as the author, manage status and scheduling, assign taxonomy terms, create custom taxonomies and terms, edit SEO and custom metadata, upload social images, and save revision snapshots before updates. Every select control and icon is styled as part of the same site kit, with icons supplied by Tabler Icons.

The administration API is authenticated and capability-gated. Local development demonstrates signed, HTTP-only, SameSite session cookies with Administrator and Editor accounts. Hosted Sites use the platform-provided authenticated-user headers and default unknown identities to Viewer unless explicitly allowlisted. The browser never receives the CMS write token, configured passwords, or signing secret. Image uploads are resized and converted to WebP in the browser, then persisted through the CMS media library; replace the local media adapter with object storage for a public deployment.

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

Seed three complete articles, two complete pages, their metadata, taxonomy, and image references in a second terminal:

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
- Raw backend API: `http://127.0.0.1:4200/v1`

Local CMS Studio demonstration accounts:

- Administrator: `admin@fieldnotes.local` / `fieldnotes-demo`
- Editor: `editor@fieldnotes.local` / `editor-demo`

These fallback accounts exist only on loopback hosts when `CMS_STUDIO_USERS_JSON` is not configured. Set a 32+ character `CMS_STUDIO_SESSION_SECRET` and server-managed users before using the studio beyond the local demonstration.

## Configuration

The local defaults assume the sibling Kujo CMS repository is at `../cms` and the `kujo` binary is available on `PATH`.

Override either path when needed:

```bash
CMS_REPO=/path/to/cms KUJO_BIN=/path/to/kujo npm run cms:start
```

The frontend uses `CMS_BASE_URL=http://127.0.0.1:4200` by default. Copy `.env.example` to `.env` when you need a different backend URL, a rotated session secret, or server-managed users and roles.

The bootstrap token in the scripts is for local development only. Rotate it and apply the production hardening guidance in the CMS HOWTO before deployment.

## Validate

```bash
npm test
```

The backend repository remains the source of truth for API behavior and its release gate.

