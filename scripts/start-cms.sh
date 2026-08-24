#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CMS_REPO="${CMS_REPO:-${PROJECT_DIR}/../cms}"
KUJO_BIN="${KUJO_BIN:-$(command -v kujo)}"

if [[ -z "${KUJO_BIN}" || ! -x "${KUJO_BIN}" ]]; then
  echo "Kujo runtime not found. Set KUJO_BIN to the kujo executable." >&2
  exit 1
fi

mkdir -p "${PROJECT_DIR}/.data"
cd "${CMS_REPO}"

CMS_API_HOST=127.0.0.1 \
CMS_API_PORT=4200 \
CMS_SITE_URL=http://127.0.0.1:4200 \
CMS_DB_PATH="${PROJECT_DIR}/.data/cms.db" \
CMS_CORS_ORIGIN=http://localhost:3000 \
CMS_API_TOKEN="${CMS_API_TOKEN:-change-me-in-production}" \
CMS_ENV=development \
"${KUJO_BIN}" run --interpreter backend/runtime/main.kujo
