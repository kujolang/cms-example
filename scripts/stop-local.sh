#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

stop_listener() {
  local label="$1"
  local port="$2"
  local pids=()

  while IFS= read -r pid; do
    [[ -n "${pid}" ]] && pids+=("${pid}")
  done < <(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)

  if (( ${#pids[@]} == 0 )); then
    printf '%s is not running on port %s.\n' "${label}" "${port}"
    return 0
  fi

  kill -TERM "${pids[@]}"
  for _attempt in {1..20}; do
    if ! lsof -tiTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
      printf '%s stopped (port %s).\n' "${label}" "${port}"
      return 0
    fi
    sleep 0.25
  done

  printf '%s did not stop cleanly; listener remains on port %s.\n' "${label}" "${port}" >&2
  return 1
}

stop_listener "Frontend and Studio" 3000
stop_listener "Backend" 4200
rm -f "${PROJECT_DIR}/.data/cms-frontend.pid" "${PROJECT_DIR}/.data/cms-backend.pid"
