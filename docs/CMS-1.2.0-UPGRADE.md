# CMS 1.2.0 backend alignment

`cms-backend.json` pins the backend release verified by this adapter. Check out CMS v1.2.0, run `kennel install` there, and restart the backend. `npm run local:start` and the test harness query `/v1/contract` and reject a different service version.

The public frontend and Studio share this backend. The Field Notes manifest remains 1.0.2; theme versions and the CMS service version are independent. The one-time Ability approval flow stays server-side and does not proxy an agent's execution through the Studio bootstrap token.

## Dependency audit

On October 12, 2026, the full `npm run check` audit found 13 high-severity dependency findings. Updating the Cloudflare Vite plugin to 1.63.1, Wrangler to 4.149.0, the Next.js lint plugin to 16.4.0, and the source-map-js lock resolution to 1.2.2 reduced that count to seven.

The remaining findings share one upstream cause: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), recursive stack exhaustion in `braces` through 3.0.3. The advisory has no patched release. `fast-glob`, `micromatch`, the Next.js lint plugin, and Vinext's CommonJS/dynamic-import build plugins inherit the finding. This is a build/lint dependency path; no unauthenticated application exploit was demonstrated in this review.

The dependency-audit gate remains enabled and fails. Do not call the full gate green or publish an unqualified clean-audit claim. Update the dependency when a reviewed fix exists and rerun `npm run check`. The backend CMS release has its own separate release gate and no npm runtime dependency on this toolchain.
