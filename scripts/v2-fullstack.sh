#!/usr/bin/env bash
#
# Repo-level entrypoint for v2-fullstack dev commands.
#
# Goals:
# - Works from ANY current working directory (no fragile relative `cd` required)
# - Delegates to `packages/v2-fullstack/package.json` scripts (single source of truth)
#
# Usage:
#   bash scripts/v2-fullstack.sh help
#   bash scripts/v2-fullstack.sh doctor
#   bash scripts/v2-fullstack.sh infra
#   bash scripts/v2-fullstack.sh backend
#   bash scripts/v2-fullstack.sh frontend
#   bash scripts/v2-fullstack.sh full
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd -P)"
V2_DIR="${REPO_ROOT}/packages/v2-fullstack"

if [ ! -d "${V2_DIR}" ]; then
  printf '%s\n' "[v2-fullstack] ERROR: missing directory: ${V2_DIR}" 1>&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  printf '%s\n' "[v2-fullstack] ERROR: npm not found in PATH" 1>&2
  exit 1
fi

cmd="${1:-help}"
shift || true

case "${cmd}" in
  help|-h|--help)
    exec npm --prefix "${V2_DIR}" run dev:help
    ;;
  doctor)
    exec npm --prefix "${V2_DIR}" run dev:doctor
    ;;
  infra)
    exec npm --prefix "${V2_DIR}" run dev:infra
    ;;
  infra-wait)
    exec npm --prefix "${V2_DIR}" run dev:infra:wait
    ;;
  infra-ps)
    exec npm --prefix "${V2_DIR}" run dev:infra:ps
    ;;
  infra-logs)
    exec npm --prefix "${V2_DIR}" run dev:infra:logs -- "$@"
    ;;
  backend)
    exec npm --prefix "${V2_DIR}" run dev:backend
    ;;
  frontend)
    exec npm --prefix "${V2_DIR}" run dev:frontend
    ;;
  full)
    exec npm --prefix "${V2_DIR}" run dev:full
    ;;
  *)
    printf '%s\n' "[v2-fullstack] ERROR: unknown command '${cmd}'" 1>&2
    printf '%s\n' "[v2-fullstack] Try: bash scripts/v2-fullstack.sh help" 1>&2
    exit 1
    ;;
esac
