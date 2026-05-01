#!/usr/bin/env bash
set -euo pipefail

# shellcheck disable=SC2034
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required but not installed. Install from https://astral.sh/uv/" >&2
  exit 1
fi

export UV_PROJECT="$PROJECT_ROOT"

echo "🔧 Syncing dependencies..."
uv sync --frozen

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"
RELOAD="${RELOAD:-true}"

echo "🚀 Starting API on ${HOST}:${PORT}"
if [ "$RELOAD" = "true" ]; then
  RELOAD_OPT="--reload"
else
  RELOAD_OPT=""
fi
uv run uvicorn src.main:app --host "$HOST" --port "$PORT" $RELOAD_OPT
