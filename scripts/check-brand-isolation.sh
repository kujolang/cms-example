#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FORBIDDEN_TERM="word""press"
cd "${ROOT_DIR}"

if rg -ni --hidden --glob '!.git/**' --glob '!node_modules/**' --glob '!dist/**' --glob '!.next/**' --glob '!.vinext/**' --glob '!.wrangler/**' "${FORBIDDEN_TERM}" .; then
  printf '%s\n' 'Brand isolation check failed in the working tree.' >&2
  exit 1
fi
if git log --all --format='%H%x09%s%n%b' | rg -ni "${FORBIDDEN_TERM}"; then
  printf '%s\n' 'Brand isolation check failed in commit messages.' >&2
  exit 1
fi
for commit in $(git rev-list --all); do
  if git grep -Iin "${FORBIDDEN_TERM}" "${commit}" -- >/dev/null 2>&1; then
    printf '%s\n' "Brand isolation check failed in reachable commit ${commit}." >&2
    exit 1
  fi
done
printf '%s\n' 'Brand isolation check passed.'
