#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${PROJECT_DIR}/.data"
BACKEND_LOG="${DATA_DIR}/cms-backend.log"
FRONTEND_LOG="${DATA_DIR}/cms-frontend.log"

listener_pid() {
  lsof -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null | head -n 1
}

wait_for_url() {
  local label="$1"
  local url="$2"
  local log_path="$3"

  for _attempt in {1..60}; do
    if curl -fsS --max-time 2 -o /dev/null "${url}" 2>/dev/null; then
      printf '%s ready: %s\n' "${label}" "${url}"
      return 0
    fi
    sleep 0.5
  done

  printf '%s did not become ready. Recent log output:\n' "${label}" >&2
  tail -n 30 "${log_path}" >&2 || true
  return 1
}

mkdir -p "${DATA_DIR}"

backend_pid="$(listener_pid 4200 || true)"
if [[ -n "${backend_pid}" ]]; then
  printf 'Backend already running on port 4200 (PID %s).\n' "${backend_pid}"
else
  kujo_bin="${KUJO_BIN:-$(command -v kujo || true)}"
  if [[ -z "${kujo_bin}" && -x "${HOME}/.local/bin/kujo" ]]; then
    kujo_bin="${HOME}/.local/bin/kujo"
  fi
  if [[ -z "${kujo_bin}" || ! -x "${kujo_bin}" ]]; then
    echo "Kujo runtime not found. Set KUJO_BIN to the kujo executable." >&2
    exit 1
  fi
  : > "${BACKEND_LOG}"
  nohup env KUJO_BIN="${kujo_bin}" bash "${PROJECT_DIR}/scripts/start-cms.sh" \
    </dev/null >>"${BACKEND_LOG}" 2>&1 &
  printf '%s\n' "$!" > "${DATA_DIR}/cms-backend.pid"
  printf 'Starting backend (launcher PID %s). Log: %s\n' "$!" "${BACKEND_LOG}"
fi

frontend_pid="$(listener_pid 3000 || true)"
if [[ -n "${frontend_pid}" ]]; then
  printf 'Frontend and Studio already running on port 3000 (PID %s).\n' "${frontend_pid}"
else
  : > "${FRONTEND_LOG}"
  nohup bash "${PROJECT_DIR}/scripts/run-app.sh" dev \
    </dev/null >>"${FRONTEND_LOG}" 2>&1 &
  printf '%s\n' "$!" > "${DATA_DIR}/cms-frontend.pid"
  printf 'Starting frontend and Studio (launcher PID %s). Log: %s\n' "$!" "${FRONTEND_LOG}"
fi

wait_for_url "Backend" "http://127.0.0.1:4200/health" "${BACKEND_LOG}"
wait_for_url "Frontend" "http://localhost:3000/" "${FRONTEND_LOG}"
printf 'Studio ready: http://localhost:3000/cms\n'
