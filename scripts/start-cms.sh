#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CMS_REPO="${CMS_REPO:-${PROJECT_DIR}/../cms}"
KUJO_BIN="${KUJO_BIN:-$(command -v kujo)}"
CMS_DATABASE_PATH="${CMS_DB_PATH:-${PROJECT_DIR}/.data/cms.db}"

if [[ -z "${KUJO_BIN}" || ! -x "${KUJO_BIN}" ]]; then
  echo "Kujo runtime not found. Set KUJO_BIN to the kujo executable." >&2
  exit 1
fi

mkdir -p "${PROJECT_DIR}/.data"
TOKEN_FILE="${CMS_DEMO_TOKEN_FILE:-${PROJECT_DIR}/.data/cms-api-token}"

if [[ -n "${CMS_API_TOKEN:-}" ]]; then
  DEMO_TOKEN="${CMS_API_TOKEN}"
elif [[ -f "${TOKEN_FILE}" ]]; then
  DEMO_TOKEN="$(<"${TOKEN_FILE}")"
else
  umask 077
  DEMO_TOKEN="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
  printf '%s\n' "${DEMO_TOKEN}" > "${TOKEN_FILE}"
fi

if [[ -z "${DEMO_TOKEN}" ]]; then
  echo "CMS demo token is empty. Set CMS_API_TOKEN or remove ${TOKEN_FILE} so it can be regenerated." >&2
  exit 1
fi

cd "${CMS_REPO}"

CMS_API_HOST=127.0.0.1 \
CMS_API_PORT=4200 \
CMS_SITE_URL=http://127.0.0.1:4200 \
CMS_DB_PATH="${CMS_DATABASE_PATH}" \
CMS_CORS_ORIGIN=http://localhost:3000 \
CMS_API_TOKEN="${DEMO_TOKEN}" \
CMS_ENV=development \
"${KUJO_BIN}" run --interpreter backend/runtime/main.kujo
