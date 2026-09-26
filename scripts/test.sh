#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CMS_REPO="${CMS_REPO:-${PROJECT_DIR}/../cms}"
KUJO_BIN="${KUJO_BIN:-$(command -v kujo || true)}"
if [[ -z "${KUJO_BIN}" && -x "${HOME}/.local/bin/kujo" ]]; then
  KUJO_BIN="${HOME}/.local/bin/kujo"
fi
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/kujo-cms-example-test.XXXXXX")"
CMS_PID=""

cleanup() {
  if [[ -n "${CMS_PID}" ]] && kill -0 "${CMS_PID}" 2>/dev/null; then
    kill "${CMS_PID}" 2>/dev/null || true
    wait "${CMS_PID}" 2>/dev/null || true
  fi
  if [[ -n "${TEST_DIR}" && "${TEST_DIR}" == *kujo-cms-example-test.* ]]; then
    rm -rf "${TEST_DIR}"
  fi
}
trap cleanup EXIT INT TERM

if [[ ! -x "${KUJO_BIN}" ]]; then
  echo "Kujo runtime not found. Set KUJO_BIN to the kujo executable." >&2
  exit 1
fi
if [[ ! -f "${CMS_REPO}/backend/runtime/main.kujo" ]]; then
  echo "CMS repository not found at ${CMS_REPO}. Set CMS_REPO explicitly." >&2
  exit 1
fi

CMS_TEST_PORT="${CMS_TEST_PORT:-$(node -e 'const net=require("node:net");const s=net.createServer();s.listen(0,"127.0.0.1",()=>{process.stdout.write(String(s.address().port));s.close()})')}"
export CMS_BASE_URL="http://127.0.0.1:${CMS_TEST_PORT}"
export CMS_API_TOKEN="${CMS_API_TOKEN:-cms-example-test-token-$(node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("hex"))')}"
export CMS_STUDIO_ALLOW_PASSWORD_LOGIN=true
export CMS_STUDIO_ALLOW_DEMO_USERS=true

(
  cd "${CMS_REPO}"
  CMS_API_HOST=127.0.0.1 \
  CMS_API_PORT="${CMS_TEST_PORT}" \
  CMS_SITE_URL="${CMS_BASE_URL}" \
  CMS_DB_PATH="${TEST_DIR}/cms.db" \
  CMS_CORS_ORIGIN=http://localhost \
  CMS_API_TOKEN="${CMS_API_TOKEN}" \
  CMS_MAX_BODY_BYTES=24000000 \
  CMS_EXTENSION_INBOX_DIR="${TEST_DIR}/extensions/inbox" \
  CMS_EXTENSION_STORE_DIR="${TEST_DIR}/extensions/installed" \
  CMS_MEDIA_INBOX_DIR="${TEST_DIR}/media/inbox" \
  CMS_MEDIA_STORE_DIR="${TEST_DIR}/media/store" \
  CMS_ENV=development \
  "${KUJO_BIN}" run --interpreter backend/runtime/main.kujo
) >"${TEST_DIR}/cms.log" 2>&1 &
CMS_PID=$!

ready=false
for _ in {1..80}; do
  if curl --fail --silent --show-error "${CMS_BASE_URL}/health" >/dev/null 2>&1; then
    ready=true
    break
  fi
  if ! kill -0 "${CMS_PID}" 2>/dev/null; then break; fi
  sleep 0.1
done
if [[ "${ready}" != true ]]; then
  echo "Test CMS failed to start; log follows:" >&2
  tail -80 "${TEST_DIR}/cms.log" >&2
  exit 1
fi

cd "${PROJECT_DIR}"
npm run cms:seed >/dev/null
npm run brand:check
npm run build
node --import ./tests/register-cloudflare-loader.mjs --test tests/rendered-html.test.mjs
env -u CMS_STUDIO_ALLOW_PASSWORD_LOGIN -u CMS_STUDIO_ALLOW_DEMO_USERS node --import tsx --test tests/auth-boundaries.test.mjs
env -u CMS_STUDIO_ALLOW_PASSWORD_LOGIN -u CMS_STUDIO_ALLOW_DEMO_USERS node --import tsx --test tests/unit-boundaries.test.mjs
