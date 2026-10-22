# CMS 1.2.1 backend alignment

`cms-backend.json` pins the backend release verified by this adapter. Check out CMS v1.2.1, run `kennel install` there, and restart the backend. `npm run local:start` and the test harness query `/v1/contract` and reject a different service version.

The public frontend and Studio share this backend. The Field Notes manifest remains 1.0.2; theme versions and the CMS service version are independent. The one-time Ability approval flow stays server-side and does not proxy an agent's execution through the Studio bootstrap token.

## Dependency audit

On October 12, 2026, the full `npm run check` audit found 13 high-severity dependency findings. Updating the Cloudflare Vite plugin to 1.63.1, Wrangler to 4.149.0, the Next.js lint plugin to 16.4.0, and the source-map-js lock resolution to 1.2.2 reduced that count to seven.

The remaining findings share one upstream cause: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), recursive stack exhaustion in `braces` through 3.0.3. The advisory has no patched release. `fast-glob`, `micromatch`, the Next.js lint plugin, and Vinext's CommonJS/dynamic-import build plugins inherit the finding. This is a build/lint dependency path; no unauthenticated application exploit was demonstrated in this review.

At that point, the enabled dependency-audit gate still failed. The backend CMS release has its own separate release gate and no npm runtime dependency on this toolchain.

## October 21 dependency remediation

Vite 8.3.5 replaces 8.3.0 to address the launch-editor advisories. Upstream braces still has no published fix, so the root override installs the private `@kujolang/braces-depth-guard` 3.0.3-kujo.1 fork from `vendor/braces`. Its MIT provenance is preserved; parser stack growth and all recursive AST walkers reject excessive nesting before stack exhaustion, including direct AST/library calls. The fixed 128-level AST bound cannot be disabled by caller options. See the fork security note for maintenance responsibility and the intended upstream replacement.

An upstream compile call with 4,999 balanced parentheses reproduces native stack exhaustion within the character limit. The installed fork rejects it with `ERR_BRACES_DEPTH`. Regression tests also cover braces, unclosed blocks, direct ASTs, normal expansion/escaping/ranges, and actual micromatch/fast-glob use. Independent review compared 228 ordinary/malformed operations against upstream without a behavior difference. A clean `npm ci --ignore-scripts` resolves the local fork correctly.

`npm run check` passes with patched Node 24.22.1: dependency-security tests, lint (existing warnings only), isolated CMS, build, rendered public HTML, authenticated/unauthenticated Studio boundaries, unit tests, and audit. The audit reports zero vulnerabilities; the fork regression tests remain a separate mandatory check because registry audit does not validate local patch correctness.

## October 22 release verification

CMS Example 1.2.0 is released against CMS 1.2.1. The full check passed on Node 26.12.1, including the isolated backend, rendered frontend and Studio, authorization boundaries, dependency regression checks and a zero-vulnerability audit. The separately versioned embedded theme manifest remains 1.0.2.
