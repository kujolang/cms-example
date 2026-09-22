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
CMS_STUDIO_ALLOW_PASSWORD_LOGIN=true CMS_STUDIO_ALLOW_DEMO_USERS=true node --import ./tests/register-cloudflare-loader.mjs --test tests/rendered-html.test.mjs
node --import tsx --test tests/auth-boundaries.test.mjs
