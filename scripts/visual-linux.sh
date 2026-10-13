#!/usr/bin/env bash
# Runs the visual suite inside the official Playwright image, so the Linux
# baseline (e2e/visual/__screenshots__/react/linux/) can be recorded and
# checked from any machine with Docker. Arguments go to `playwright test`,
# e.g. `bun run test:visual:linux --update-snapshots=all`.
set -euo pipefail

image=mcr.microsoft.com/playwright:v1.63.0-noble
bun_version=1.4.2
root="$(cd "$(dirname "$0")/.." && pwd)"

# On Windows (Git Bash), Docker lives in WSL: hand the WSL path to it.
docker=(docker)
if ! command -v docker >/dev/null 2>&1; then
  docker=(wsl -e docker)
  root="$(wsl -e wslpath -a "$(cygpath -m "$root")" | tr -d '\r')"
fi

# node_modules stays in a volume: the host's native binaries do not run here.
MSYS_NO_PATHCONV=1 "${docker[@]}" run --rm --ipc=host --init \
  -v "$root":/work \
  -v tozzo-visual-node-modules:/work/node_modules \
  -w /work \
  -e CI \
  -e VISUAL_WORKERS \
  "$image" \
  bash -c 'npm install -g --silent bun@'"$bun_version"' && bun install --frozen-lockfile >/dev/null && bunx playwright test -c playwright.visual.config.ts "$@"' \
  -- "$@"
