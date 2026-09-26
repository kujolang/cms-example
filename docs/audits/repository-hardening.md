# Repository hardening audit

## Repository

- Name: `cms-example`
- Purpose: CMS-backed publication frontend and authenticated Studio adapter
- Branch: `main`
- Starting SHA: `2c6ed9c8e58548a71c01dc47a78c66f7658d2f7e`
- Ending implementation SHA: `8a3fc792fa88dc4c8f8caa8fb38b8b863794d58f`
- Important integrations: sibling `../cms`, Kujo runtime, Vinext/Vite,
  React, Cloudflare runtime adapter, Drizzle/D1 support

## Baseline

The starting tree was clean and synchronized with `origin/main`. `npm run lint`
and `npm run build` passed. The build output occupied 2,840 KiB. A clean
`npm test` with no developer CMS running failed 6 of 10 rendered tests with
`ECONNREFUSED 127.0.0.1:4200`; the documented suite therefore depended on
ambient developer state and could give different results on different machines.
The dependency audit reported 0 vulnerabilities across 656 installed
dependencies. Existing view-scoped Studio loading, server-rendered initial data,
request deduplication, and bounded concurrency were inspected and preserved.

## Findings

| ID | Priority | Area | Finding | Evidence | Action | Status |
|---|---|---|---|---|---|---|
| EX-001 | P1 | Determinism/regression | `npm test` required an already-running backend and persistent seeded database. | Clean baseline: 4/10 rendered tests passed and 6 failed with `ECONNREFUSED`. | Start an isolated CMS on an available loopback port, seed a temporary DB, and clean it on exit. | Fixed |
| EX-002 | P1 | Security | Privileged server adapters silently used the published development bootstrap token in production. | Four implementations defaulted to `change-me-in-production`. | Centralize the server client and reject the default token before fetch in production. | Fixed |
| EX-003 | P1 | Resource/security | Authentication rate-limit maps had no key bound or stale-key reclamation. | Module-global `Map` instances only removed successful keys. | Add a tested 2,048-key bounded limiter with expiry reclamation and oldest-key eviction. | Fixed |
| EX-004 | P2 | Complexity/errors | CMS URL, authorization, envelope parsing, and error behavior were duplicated across server adapters. | 13 repeated client declarations in the starting tree. | Introduce one typed server client with consistent malformed-response handling. | Fixed |
| EX-005 | P2 | Agent/CI ergonomics | Validation required several undocumented commands and tests produced weak auth setup diagnostics. | No aggregate verification script; status-only setup assertions. | Add `npm run check`, precise response diagnostics, and update the agent/readme guidance. | Fixed |
| EX-006 | Needs more evidence | Browser performance | Core Web Vitals could not be traced in this environment. | Chrome DevTools MCP was unavailable. | Run browser traces when that integration is available. | Open |

## Changes implemented

### Deterministic integration harness

- Problem/root cause: rendered tests reused port 4200 and `.data` implicitly.
- Implementation: allocate a free loopback port, launch the sibling CMS with a
  temporary database and generated token, readiness-poll `/health`, seed content,
  run the build and tests, then terminate and remove temporary state.
- Files: `scripts/test.sh`, `tests/rendered-html.test.mjs`, `package.json`,
  `README.md`, `AGENTS.md`.
- Tests: 10 rendered, 4 auth-boundary, and 3 unit-boundary tests now run from one
  command with no pre-existing servers.
- Compatibility: local start commands and production runtime are unchanged.

### Server boundary consolidation and hardening

- Problem/root cause: four copies of privileged fetch/envelope logic drifted;
  production could reach the backend with the known development token.
- Implementation: central `cmsServerRequest`, fail-closed production-token
  validation, consistent JSON/error handling, shared use by identity, users,
  Studio data, and extension administration.
- Files: `lib/cms-server-client.ts`, `lib/cms-auth.ts`,
  `lib/cms-user-store.ts`, `lib/cms-studio-data.ts`,
  `app/api/cms/extensions/route.ts`.
- Tests: default production token and malformed upstream payload regressions.
- Compatibility: request paths, headers, envelopes, and public browser APIs are
  unchanged when correctly configured.

### Bounded authentication attempts

- Problem/root cause: attacker-controlled rate keys accumulated without a cap.
- Implementation: 2,048-key bound, expired-key sweep, deterministic oldest-key
  eviction, and success clearing.
- Files: `lib/bounded-rate-limit.ts`, `app/api/cms/auth/route.ts`.
- Tests: limit enforcement, expiry, and capacity bounds.

## Performance and efficiency

- Build output: 2,840 KiB before and after (no bundle-size regression).
- Duplicated server-client declarations: 13 before; 3 declarations in the one
  centralized module after.
- Authentication limiter memory: unbounded keys before; maximum 2,048 keys per
  limiter after.
- Studio data remains view-scoped and concurrency remains capped at three reads;
  no unsupported latency percentage is claimed for this pass.

## Security

Manual review covered server-only credential flow, session cookies, platform
identity header authentication, password derivation, login/signup throttling,
same-origin checks, extension archive traversal/decompression bounds, media
signature/size validation, secret exposure, dependency advisories, and error
payloads. Fixed production default-token use and unbounded auth state. Existing
platform identity requires a separate constant-time-checked ingress secret and
demo accounts remain denied in production. The user explicitly asked to skip
Codex DeepScan; this report does not claim a DeepScan result.

## Compatibility

- Public APIs changed: no.
- CLI behavior changed: `npm test` is now self-contained; `npm run check` is new.
- File formats or schemas changed: no.
- Configuration changed: no required changes. `CMS_REPO`, `KUJO_BIN`, and
  `CMS_TEST_PORT` remain optional test overrides.
- Environment safety changed: production now requires a non-default
  `CMS_API_TOKEN`, matching the backend's production contract.
- External consumers affected: none when production was already configured
  securely.

## Cross-repository follow-ups

None required. The isolated suite consumes the existing sibling CMS contract.

## Remaining work

- P0/P1/P2: none validated and left unfixed.
- Needs more evidence: browser Core Web Vitals and production Cloudflare traces.
- Not worth changing: replacing `fflate`, Drizzle, or framework dependencies
  without bundle/runtime evidence.

## Verification receipt

| Command | Result |
|---|---|
| `npm run lint` | Passed |
| `npm test` | 10/10 rendered, 4/4 auth, 3/3 unit tests passed |
| `npm audit --json` | 0 vulnerabilities |
| `npm run check` | Passed |
| `git diff --check` | Passed |

Verbose build/test evidence was retained in command output; no generated runtime
database, token, or log was committed.
