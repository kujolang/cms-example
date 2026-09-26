# CMS example: quick context

This is the frontend and Studio adapter for the sibling `../cms` Kujo backend. Keep backend API contracts and database migrations in `../cms`; keep presentation and Studio UI here. Read only the part relevant to your task:

- Public pages: `app/page.tsx`, `app/articles/`, `app/pages/`, shared reads in `lib/cms.ts` and navigation in `app/SiteHeader.tsx`.
- Studio UI: `app/cms/`; admin API actions: `app/api/cms/route.ts`; extensions: `app/api/cms/extensions/route.ts`.
- Identity boundary: `lib/cms-auth.ts`, `lib/cms-user-store.ts`, `app/api/cms/auth/`. Never trust inbound platform identity headers without the ingress secret; never pass the backend bootstrap token to browsers.
- Local runtime: `scripts/start-cms.sh` starts port 4200; `scripts/run-app.sh` starts port 3000. `.data/` is private runtime state, not source.
- Verification: `npm run check` (lint, isolated CMS, build, rendered HTML, auth regressions, dependency audit). Check both public and Studio routes against live local servers for runtime changes.

Prefer reading these files and their direct imports over loading the whole repository or generated directories (`node_modules`, `.vinext`, `.next`, `dist`, `.data`). Preserve existing API shapes and test authenticated and unauthenticated behavior whenever changing Studio routes.
