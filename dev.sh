#!/usr/bin/env bash
set -euo pipefail

CYAN='\033[0;36m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$REPO_ROOT/.env"

cleanup() {
  echo ""
  echo -e "${BOLD}[dev]${RESET} Stopping containers..."
  docker compose -f "$REPO_ROOT/docker-compose.yml" down --remove-orphans
  exit 0
}
trap cleanup SIGINT SIGTERM

if ! command -v docker &>/dev/null; then
  echo -e "${RED}[error]${RESET} docker not found." >&2
  exit 1
fi

if ! docker compose version &>/dev/null; then
  echo -e "${RED}[error]${RESET} docker compose v2 required." >&2
  exit 1
fi

if ! docker info &>/dev/null; then
  echo -e "${RED}[error]${RESET} Docker daemon is not running." >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  cp "$ENV_FILE.example" "$ENV_FILE"
  echo -e "${YELLOW}[warn]${RESET} Created .env from .env.example — fill in values and re-run."
  exit 1
fi

echo ""
echo -e "  ${CYAN}▐${RESET}${BOLD} Carrier Sales — Dev (Docker)${RESET}"
echo -e "  ${CYAN}▐${RESET}  backend   → http://localhost:8000"
echo -e "  ${CYAN}▐${RESET}  dashboard → http://localhost:3000"
echo -e "  ${CYAN}▐${RESET}  Ctrl+C to stop and clean up"
echo ""

exec docker compose -f "$REPO_ROOT/docker-compose.yml" up --build
