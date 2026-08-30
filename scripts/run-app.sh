#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMMAND="${1:-dev}"

if [[ -z "${CMS_API_TOKEN:-}" && -f "${PROJECT_DIR}/.data/cms-api-token" ]]; then
  CMS_API_TOKEN="$(<"${PROJECT_DIR}/.data/cms-api-token")"
  export CMS_API_TOKEN
fi

export WRANGLER_LOG_PATH="${WRANGLER_LOG_PATH:-.wrangler/wrangler.log}"
cd "${PROJECT_DIR}"
exec npx vinext "${COMMAND}"
