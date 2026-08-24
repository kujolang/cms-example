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

## Configuration

The local defaults assume the sibling Kujo CMS repository is at `../cms` and the `kujo` binary is available on `PATH`.

Override either path when needed:

```bash
CMS_REPO=/path/to/cms KUJO_BIN=/path/to/kujo npm run cms:start
```

The frontend uses `CMS_BASE_URL=http://127.0.0.1:4200` by default. Copy `.env.example` to `.env` only when you need a different backend URL.

The bootstrap token in the scripts is for local development only. Rotate it and apply the production hardening guidance in the CMS HOWTO before deployment.

## Validate

```bash
npm test
```

The backend repository remains the source of truth for API behavior and its release gate.
