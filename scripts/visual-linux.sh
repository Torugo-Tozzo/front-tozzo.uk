#!/usr/bin/env bash
# Runs the Solid visual suite inside the same Playwright image that recorded
# the React Linux baseline (e2e/visual/__screenshots__/react/linux/), so
# fonts and antialiasing match. Arguments go to `playwright test`.
set -euo pipefail

image=mcr.microsoft.com/playwright:v1.63.0-noble
bun_version=1.4.2
root="$(cd "$(dirname "$0")/.." && pwd)"

docker=(docker)
if ! command -v docker >/dev/null 2>&1; then
  docker=(wsl -e docker)
  root="$(wsl -e wslpath -a "$(cygpath -m "$root")" | tr -d '\r')"
fi

# Keep Linux dependencies separate from the host's native binaries.
MSYS_NO_PATHCONV=1 "${docker[@]}" run --rm --ipc=host --init \
  -v "$root":/work \
  -v tozzo-solid-node-modules:/work/node_modules \
  -w /work \
  -e CI \
  -e VISUAL_WORKERS \
  -e VISUAL_DEBUG \
  -e HOST_OWNER="$(id -u):$(id -g)" \
  "$image" \
  bash -c 'npm install -g --silent bun@'"$bun_version"' && bun install --frozen-lockfile >/dev/null && /work/node_modules/.bin/playwright test -c playwright.visual.config.ts "$@"; status=$?; chown -R "$HOST_OWNER" test-results 2>/dev/null; exit $status' \
  -- "$@"
