#!/usr/bin/env bash
# dev.sh — full local stack with hot reload.
#
#   postgres  (docker container, persistent)
#   backend   (uvicorn --reload, port 8000)
#   dashboard (next dev --turbopack, port 3000)
#
# Ctrl+C stops everything cleanly.

set -euo pipefail

# ─── pretty ──────────────────────────────────────────────────────────────────
B='\033[1;33m'   # backend
D='\033[1;36m'   # dashboard
P='\033[1;35m'   # postgres / dev meta
G='\033[0;32m'
R='\033[0;31m'
Y='\033[1;33m'
RST='\033[0m'

dev_say()  { printf "${P}[dev]${RST} %s\n" "$*"; }
dev_warn() { printf "${Y}[dev]${RST} %s\n" "$*" >&2; }
dev_die()  { printf "${R}[error]${RST} %s\n" "$*" >&2; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ROOT/.env"
PG_CONTAINER="carrier-sales-postgres"

# ─── cleanup on exit ─────────────────────────────────────────────────────────
cleanup() {
  trap - INT TERM EXIT
  echo
  dev_say "stopping backend + dashboard…"
  # Kill the whole process group (script + all children).
  kill 0 2>/dev/null || true
}
trap cleanup INT TERM EXIT

# ─── prereqs ─────────────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || dev_die "docker not found"
command -v uv     >/dev/null 2>&1 || dev_die "uv not found — install: curl -LsSf https://astral.sh/uv/install.sh | sh"
command -v npm    >/dev/null 2>&1 || dev_die "npm not found"
docker info >/dev/null 2>&1       || dev_die "docker daemon is not running"

# ─── .env ────────────────────────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  cp "$ENV_FILE.example" "$ENV_FILE"
  dev_warn "created .env from .env.example"
fi

# Make sure DASHBOARD_PASSWORD has a value — login won't work without one.
# Default to "dev" for local-only convenience.
if ! grep -qE '^DASHBOARD_PASSWORD=.+' "$ENV_FILE"; then
  if grep -q '^DASHBOARD_PASSWORD=' "$ENV_FILE"; then
    sed -i 's|^DASHBOARD_PASSWORD=.*|DASHBOARD_PASSWORD=dev|' "$ENV_FILE"
  else
    echo "DASHBOARD_PASSWORD=dev" >> "$ENV_FILE"
  fi
  dev_warn "DASHBOARD_PASSWORD was empty — set to 'dev' for local. Edit .env to change."
fi

# ─── postgres ────────────────────────────────────────────────────────────────
if ! docker ps -a --format '{{.Names}}' | grep -q "^${PG_CONTAINER}$"; then
  dev_say "first run — creating postgres container via docker compose…"
  docker compose -f "$ROOT/docker-compose.yml" up -d postgres
elif [ "$(docker inspect -f '{{.State.Running}}' "$PG_CONTAINER" 2>/dev/null)" != "true" ]; then
  dev_say "starting existing postgres container…"
  docker start "$PG_CONTAINER" >/dev/null
fi

printf "${P}[dev]${RST} waiting for postgres "
for _ in $(seq 1 30); do
  if docker exec "$PG_CONTAINER" pg_isready -U carrier -d carrier_sales >/dev/null 2>&1; then
    printf "${G}ready${RST}\n"
    break
  fi
  printf "."
  sleep 1
done

# ─── deps (idempotent, fast on rerun) ────────────────────────────────────────
dev_say "syncing backend deps (uv)…"
( cd "$ROOT/backend" && uv sync --quiet )

if [ ! -d "$ROOT/dashboard/node_modules" ]; then
  dev_say "installing dashboard deps (npm)…"
  ( cd "$ROOT/dashboard" && npm install --no-audit --no-fund )
fi

# ─── dashboard env ───────────────────────────────────────────────────────────
# NEXT_PUBLIC_* is read at next-dev start; rewrite every run so the dashboard
# always points at the local backend regardless of what's in Railway-style
# .env.local from a previous deploy session.
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > "$ROOT/dashboard/.env.local"

# Get passcode for the banner (read from .env at runtime, with fallback).
PASSCODE="$(grep -E '^DASHBOARD_PASSWORD=' "$ENV_FILE" | head -n1 | cut -d= -f2-)"
PASSCODE="${PASSCODE:-dev}"

# ─── banner ──────────────────────────────────────────────────────────────────
echo
printf "  ${P}▐${RST}  ${G}carrier-sales — dev stack${RST}\n"
printf "  ${P}▐${RST}  postgres  → localhost:5432  (carrier/carrier/carrier_sales)\n"
printf "  ${P}▐${RST}  backend   → http://localhost:8000  (hot reload)\n"
printf "  ${P}▐${RST}  dashboard → http://localhost:3000  (turbopack)\n"
printf "  ${P}▐${RST}  passcode  → ${G}${PASSCODE}${RST}\n"
printf "  ${P}▐${RST}  Ctrl+C to stop\n"
echo

# ─── run backend + dashboard, prefix each line with a colored tag ────────────
(
  cd "$ROOT/backend"
  exec uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
) 2>&1 | sed -u "s|^|$(printf "${B}[backend]  ${RST}")|" &

(
  cd "$ROOT/dashboard"
  exec npm run dev -- --hostname 0.0.0.0 --port 3000
) 2>&1 | sed -u "s|^|$(printf "${D}[dashboard]${RST} ")|" &

wait
