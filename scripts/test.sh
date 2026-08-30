#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -z "${CMS_API_TOKEN:-}" && -f "${PROJECT_DIR}/.data/cms-api-token" ]]; then
  CMS_API_TOKEN="$(<"${PROJECT_DIR}/.data/cms-api-token")"
  export CMS_API_TOKEN
fi

cd "${PROJECT_DIR}"
npm run brand:check
npm run build
node --test tests/rendered-html.test.mjs
