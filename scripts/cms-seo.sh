#!/usr/bin/env bash
set -euo pipefail

CMS_EXAMPLE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CMS_REPO_PATH="${CMS_REPO:-${CMS_EXAMPLE_ROOT}/../cms}"
if [[ -z "${CMS_API_TOKEN:-}" && -f "${CMS_EXAMPLE_ROOT}/.data/cms-api-token" ]]; then
  CMS_API_TOKEN="$(<"${CMS_EXAMPLE_ROOT}/.data/cms-api-token")"
  export CMS_API_TOKEN
fi
export CMS_BASE_URL="${CMS_BASE_URL:-http://127.0.0.1:4200}"
exec bash "${CMS_REPO_PATH}/scripts/cms-seo.sh" "$@"
