#!/usr/bin/env bash
#
# Igloo V2 Fullstack dev orchestrator
#
# Why this filename:
# - Avoid ambiguity with other packages' dev scripts
# - Still invoked via npm scripts (humans don't need to type it often)
#
# Goals:
# - One-command start for common local dev scenarios
# - No extra dependencies (no concurrently/nodemon required)
# - Works on macOS default bash (3.2+) and Linux
#
# Usage:
#   bash ./scripts/v2-fullstack-dev.sh help
#   bash ./scripts/v2-fullstack-dev.sh infra up|down|ps|logs|restart|reset|wait
#   bash ./scripts/v2-fullstack-dev.sh psql
#   bash ./scripts/v2-fullstack-dev.sh redis-cli
#   bash ./scripts/v2-fullstack-dev.sh backend
#   bash ./scripts/v2-fullstack-dev.sh frontend
#   bash ./scripts/v2-fullstack-dev.sh full
#   bash ./scripts/v2-fullstack-dev.sh full-worker
#   bash ./scripts/v2-fullstack-dev.sh worker
#   bash ./scripts/v2-fullstack-dev.sh beat
#   bash ./scripts/v2-fullstack-dev.sh migrate
#   bash ./scripts/v2-fullstack-dev.sh makemigrations
#   bash ./scripts/v2-fullstack-dev.sh seed
#   bash ./scripts/v2-fullstack-dev.sh e2e
#   bash ./scripts/v2-fullstack-dev.sh tools
#   bash ./scripts/v2-fullstack-dev.sh doctor
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
FRONTEND_DIR="${ROOT_DIR}/frontend"
BACKEND_DIR="${ROOT_DIR}/backend"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
NC=$'\033[0m'

log() {
  printf '%s\n' "$*"
}

info() {
  log "${BLUE}[igloo]${NC} $*"
}

warn() {
  log "${YELLOW}[igloo]${NC} $*"
}

err() {
  log "${RED}[igloo]${NC} $*" 1>&2
}

die() {
  err "$*"
  exit 1
}

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

compose() {
  (
    cd "${ROOT_DIR}"
    if docker compose version >/dev/null 2>&1; then
      docker compose "$@"
      return
    fi
    if has_cmd docker-compose; then
      docker-compose "$@"
      return
    fi
    die "Docker Compose not found. Please install Docker Desktop (macOS) or docker-compose."
  )
}

show_help() {
  cat <<'EOF'
Igloo V2 Fullstack dev helper

Common:
  npm run dev:help          # show all dev commands (recommended starting point)
  npm run dev:infra         # start postgres + redis (docker)
  npm run dev:backend       # start FastAPI (uvicorn --reload)
  npm run dev:frontend      # start Vite
  npm run dev:full          # start infra + backend + frontend
  npm run dev:full:worker   # start infra + backend + frontend + celery worker

Subcommands (bash ./scripts/v2-fullstack-dev.sh ...):
  help
  doctor

  infra up                  Start postgres + redis (detached)
  infra down                Stop containers (keep volumes)
  infra ps                  Show container status
  infra logs [svc...]       Follow logs (all services or selected)
  infra restart             Restart containers
  infra reset               Stop containers and REMOVE volumes (DANGEROUS)
  infra wait                Wait until postgres/redis are healthy

  backend                   Start backend dev server
  frontend                  Start frontend dev server
  full                      Start infra + backend + frontend (one terminal)
  full-worker               Start infra + backend + frontend + worker (one terminal)

  psql                      Open psql inside postgres container
  redis-cli                 Open redis-cli inside redis container

  worker                    Start Celery worker (requires celery app)
  beat                      Start Celery beat (requires celery app)
  migrate                   Run Alembic migrations (requires Alembic init)
  makemigrations            Create Alembic revision (requires Alembic init)
  seed                      Seed local data (optional; requires seed script)
  e2e                       Run Playwright E2E (optional; requires Playwright setup)

  tools                     Run setup-dev-tools.sh (DBeaver/Postman/RedisInsight)

Notes:
  - This script does NOT auto-activate conda/poetry envs. Ensure your Python env is ready.
  - Default ports: backend 8000, frontend 5173.
EOF
}

doctor() {
  info "Workspace: ${ROOT_DIR}"

  if ! has_cmd docker; then
    die "docker not found. Install Docker Desktop first."
  fi
  if ! docker info >/dev/null 2>&1; then
    die "docker daemon not running. Start Docker Desktop."
  fi

  if ! compose ps >/dev/null 2>&1; then
    die "docker compose is not functional for this project."
  fi

  if [ ! -f "${ROOT_DIR}/docker-compose.yml" ]; then
    die "Missing docker-compose.yml at ${ROOT_DIR}/docker-compose.yml"
  fi
  if [ ! -d "${BACKEND_DIR}" ]; then
    die "Missing backend directory at ${BACKEND_DIR}"
  fi
  if [ ! -d "${FRONTEND_DIR}" ]; then
    die "Missing frontend directory at ${FRONTEND_DIR}"
  fi

  if ! has_cmd npm; then
    die "npm not found. Install Node.js first."
  fi

  if ! has_cmd uvicorn; then
    warn "uvicorn not found in PATH. If you use poetry: run via 'poetry run uvicorn ...'."
  fi

  if [ ! -f "${BACKEND_DIR}/.env" ]; then
    warn "backend/.env not found. If you haven't set env yet, copy from templates."
  fi
  if [ ! -f "${FRONTEND_DIR}/.env" ]; then
    warn "frontend/.env not found. If you haven't set env yet, copy from templates."
  fi

  info "Doctor OK."
}

infra_up() {
  info "Starting docker services (postgres, redis)..."
  compose up -d postgres redis
  compose ps
}

infra_wait() {
  local timeout_s="${IGLOO_INFRA_WAIT_TIMEOUT_S:-60}"
  local start_ts
  start_ts="$(date +%s)"

  info "Waiting for docker services to become healthy (timeout=${timeout_s}s)..."

  while true; do
    if compose ps | grep -q "igloo-postgres.*healthy" && compose ps | grep -q "igloo-redis.*healthy"; then
      info "Infra is healthy."
      return 0
    fi

    local now_ts
    now_ts="$(date +%s)"
    if [ $((now_ts - start_ts)) -ge "${timeout_s}" ]; then
      err "Timed out waiting for infra."
      compose ps || true
      err "Tip: check logs via: bash ./scripts/v2-fullstack-dev.sh infra logs"
      return 1
    fi

    sleep 1
  done
}

infra_down() {
  info "Stopping docker services..."
  compose down
}

infra_ps() {
  compose ps
}

infra_logs() {
  info "Following docker logs..."
  if [ "$#" -gt 0 ]; then
    compose logs -f "$@"
  else
    compose logs -f
  fi
}

infra_restart() {
  info "Restarting docker services..."
  compose restart
  compose ps
}

infra_reset() {
  warn "This will remove docker volumes (ALL local data)."
  warn "If you are sure, rerun with: I_AM_SURE=1 bash ./scripts/v2-fullstack-dev.sh infra reset"
  if [ "${I_AM_SURE:-0}" != "1" ]; then
    die "Aborted."
  fi
  info "Stopping and removing volumes..."
  compose down -v
}

backend_dev() {
  local host="${IGLOO_BACKEND_HOST:-0.0.0.0}"
  local port="${IGLOO_BACKEND_PORT:-8000}"

  info "Starting backend (host=${host}, port=${port})..."
  (
    cd "${BACKEND_DIR}"
    if has_cmd poetry && [ -f "${BACKEND_DIR}/pyproject.toml" ]; then
      exec poetry run uvicorn app.main:app --reload --host "${host}" --port "${port}"
    fi
    exec uvicorn app.main:app --reload --host "${host}" --port "${port}"
  )
}

frontend_dev() {
  info "Starting frontend (Vite)..."
  (
    cd "${FRONTEND_DIR}"
    exec npm run dev
  )
}

psql_shell() {
  infra_up
  infra_wait
  info "Opening psql inside postgres container..."
  compose exec postgres psql -U igloo -d igloo_index
}

redis_cli_shell() {
  infra_up
  infra_wait
  info "Opening redis-cli inside redis container..."
  compose exec redis redis-cli
}

run_backend_cmd() {
  (
    cd "${BACKEND_DIR}"
    if has_cmd poetry && [ -f "${BACKEND_DIR}/pyproject.toml" ]; then
      exec poetry run "$@"
    fi
    exec "$@"
  )
}

require_celery_app() {
  local celery_app="${IGLOO_CELERY_APP:-app.tasks.celery_app:celery_app}"
  local default_hint_file="${BACKEND_DIR}/app/tasks/celery_app.py"

  if [ ! -f "${default_hint_file}" ]; then
    err "Celery app entrypoint not found (expected: ${default_hint_file})."
    err "Please implement Step 14 first, then rerun."
    err "Suggested default: create ${default_hint_file} and expose 'celery_app'."
    err "Or override via env: IGLOO_CELERY_APP='your.module:app'"
    return 1
  fi

  printf '%s' "${celery_app}"
}

celery_worker() {
  infra_up
  infra_wait
  local celery_app
  celery_app="$(require_celery_app)" || exit 1
  info "Starting Celery worker (-A ${celery_app})..."
  run_backend_cmd celery -A "${celery_app}" worker -l info
}

celery_beat() {
  infra_up
  infra_wait
  local celery_app
  celery_app="$(require_celery_app)" || exit 1
  info "Starting Celery beat (-A ${celery_app})..."
  run_backend_cmd celery -A "${celery_app}" beat -l info
}

require_alembic() {
  if [ ! -f "${BACKEND_DIR}/alembic.ini" ] || [ ! -d "${BACKEND_DIR}/alembic" ]; then
    err "Alembic is not initialized in backend/ yet (missing alembic.ini or alembic/)."
    err "When you reach Step 05+ (DB models), initialize once:"
    err "  (cd backend && alembic init alembic)"
    return 1
  fi
}

alembic_migrate() {
  infra_up
  infra_wait
  require_alembic || exit 1
  info "Running Alembic migrations (upgrade head)..."
  run_backend_cmd alembic upgrade head
}

alembic_makemigrations() {
  infra_up
  infra_wait
  require_alembic || exit 1
  local msg="${IGLOO_MIGRATION_MSG:-auto}"
  info "Creating Alembic revision (autogenerate, message='${msg}')..."
  run_backend_cmd alembic revision --autogenerate -m "${msg}"
}

seed_data() {
  local seed_script="${BACKEND_DIR}/app/scripts/seed.py"
  if [ ! -f "${seed_script}" ]; then
    err "Seed script not found at ${seed_script}."
    err "Optional: create it when you need local demo data."
    return 1
  fi
  infra_up
  infra_wait
  info "Seeding local data..."
  run_backend_cmd python "${seed_script}"
}

run_e2e() {
  local pw_config_ts="${FRONTEND_DIR}/playwright.config.ts"
  local pw_config_js="${FRONTEND_DIR}/playwright.config.js"
  if [ ! -f "${pw_config_ts}" ] && [ ! -f "${pw_config_js}" ]; then
    err "Playwright config not found in frontend/."
    err "This is planned for Phase 4 Step 47. Add Playwright first, then rerun."
    return 1
  fi
  info "Running Playwright E2E..."
  (cd "${FRONTEND_DIR}" && exec npm run e2e)
}

full_dev() {
  infra_up

  info "Starting backend + frontend in one terminal..."

  local backend_pid=""
  local frontend_pid=""

  cleanup() {
    local exit_code=$?
    set +e
    if [ -n "${backend_pid}" ] && kill -0 "${backend_pid}" >/dev/null 2>&1; then
      info "Stopping backend (pid=${backend_pid})..."
      kill "${backend_pid}" >/dev/null 2>&1 || true
    fi
    if [ -n "${frontend_pid}" ] && kill -0 "${frontend_pid}" >/dev/null 2>&1; then
      info "Stopping frontend (pid=${frontend_pid})..."
      kill "${frontend_pid}" >/dev/null 2>&1 || true
    fi
    wait >/dev/null 2>&1 || true
    exit "${exit_code}"
  }

  trap cleanup INT TERM EXIT

  backend_dev &
  backend_pid="$!"

  frontend_dev &
  frontend_pid="$!"

  # bash 3.2 has no 'wait -n'. Poll for the first exit and stop the other.
  while true; do
    if ! kill -0 "${backend_pid}" >/dev/null 2>&1; then
      warn "Backend exited. Stopping frontend..."
      kill "${frontend_pid}" >/dev/null 2>&1 || true
      wait "${backend_pid}" || true
      wait "${frontend_pid}" || true
      exit 1
    fi
    if ! kill -0 "${frontend_pid}" >/dev/null 2>&1; then
      warn "Frontend exited. Stopping backend..."
      kill "${backend_pid}" >/dev/null 2>&1 || true
      wait "${frontend_pid}" || true
      wait "${backend_pid}" || true
      exit 1
    fi
    sleep 0.5
  done
}

full_worker_dev() {
  infra_up
  infra_wait

  info "Starting backend + frontend + worker in one terminal..."

  local backend_pid=""
  local frontend_pid=""
  local worker_pid=""

  cleanup() {
    local exit_code=$?
    set +e
    if [ -n "${worker_pid}" ] && kill -0 "${worker_pid}" >/dev/null 2>&1; then
      info "Stopping worker (pid=${worker_pid})..."
      kill "${worker_pid}" >/dev/null 2>&1 || true
    fi
    if [ -n "${backend_pid}" ] && kill -0 "${backend_pid}" >/dev/null 2>&1; then
      info "Stopping backend (pid=${backend_pid})..."
      kill "${backend_pid}" >/dev/null 2>&1 || true
    fi
    if [ -n "${frontend_pid}" ] && kill -0 "${frontend_pid}" >/dev/null 2>&1; then
      info "Stopping frontend (pid=${frontend_pid})..."
      kill "${frontend_pid}" >/dev/null 2>&1 || true
    fi
    wait >/dev/null 2>&1 || true
    exit "${exit_code}"
  }

  trap cleanup INT TERM EXIT

  backend_dev &
  backend_pid="$!"

  frontend_dev &
  frontend_pid="$!"

  celery_worker &
  worker_pid="$!"

  while true; do
    if ! kill -0 "${backend_pid}" >/dev/null 2>&1; then
      warn "Backend exited. Stopping others..."
      kill "${frontend_pid}" >/dev/null 2>&1 || true
      kill "${worker_pid}" >/dev/null 2>&1 || true
      wait "${backend_pid}" || true
      wait "${frontend_pid}" || true
      wait "${worker_pid}" || true
      exit 1
    fi
    if ! kill -0 "${frontend_pid}" >/dev/null 2>&1; then
      warn "Frontend exited. Stopping others..."
      kill "${backend_pid}" >/dev/null 2>&1 || true
      kill "${worker_pid}" >/dev/null 2>&1 || true
      wait "${frontend_pid}" || true
      wait "${backend_pid}" || true
      wait "${worker_pid}" || true
      exit 1
    fi
    if ! kill -0 "${worker_pid}" >/dev/null 2>&1; then
      warn "Worker exited. Stopping others..."
      kill "${backend_pid}" >/dev/null 2>&1 || true
      kill "${frontend_pid}" >/dev/null 2>&1 || true
      wait "${worker_pid}" || true
      wait "${backend_pid}" || true
      wait "${frontend_pid}" || true
      exit 1
    fi
    sleep 0.5
  done
}

run_tools_setup() {
  local setup_script="${ROOT_DIR}/setup-dev-tools.sh"
  if [ ! -f "${setup_script}" ]; then
    die "Missing ${setup_script}"
  fi
  infra_up
  info "Running dev tools setup..."
  (cd "${ROOT_DIR}" && exec bash "${setup_script}")
}

main() {
  local cmd="${1:-help}"
  shift || true

  case "${cmd}" in
    help|-h|--help)
      show_help
      ;;
    doctor)
      doctor
      ;;
    infra)
      local sub="${1:-ps}"
      shift || true
      case "${sub}" in
        up) infra_up ;;
        down) infra_down ;;
        ps) infra_ps ;;
        logs) infra_logs "$@" ;;
        restart) infra_restart ;;
        reset) infra_reset ;;
        wait) infra_wait ;;
        *) die "Unknown: infra ${sub}. Run: bash ./scripts/v2-fullstack-dev.sh help" ;;
      esac
      ;;
    backend)
      backend_dev
      ;;
    frontend)
      frontend_dev
      ;;
    full)
      full_dev
      ;;
    full-worker)
      full_worker_dev
      ;;
    psql)
      psql_shell
      ;;
    redis-cli)
      redis_cli_shell
      ;;
    worker)
      celery_worker
      ;;
    beat)
      celery_beat
      ;;
    migrate)
      alembic_migrate
      ;;
    makemigrations)
      alembic_makemigrations
      ;;
    seed)
      seed_data
      ;;
    e2e)
      run_e2e
      ;;
    tools)
      run_tools_setup
      ;;
    *)
      die "Unknown command: ${cmd}. Run: bash ./scripts/v2-fullstack-dev.sh help"
      ;;
  esac
}

main "$@"
