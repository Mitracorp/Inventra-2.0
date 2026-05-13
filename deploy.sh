#!/usr/bin/env bash

set -Eeuo pipefail

log() {
	printf '[deploy] %s\n' "$1"
}

need_cmd() {
	if ! command -v "$1" >/dev/null 2>&1; then
		echo "Missing required command: $1" >&2
		exit 1
	fi
}

# Configuration (override in cPanel terminal before running the script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$SCRIPT_DIR}"
BRANCH="${BRANCH:-main}"
PUBLIC_DIR="${PUBLIC_DIR:-$HOME/public_html/inventra.ivms2006.com}"
DEPLOY_FRONTEND_TO_PUBLIC_HTML="${DEPLOY_FRONTEND_TO_PUBLIC_HTML:-1}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-0}"
CPANEL_NODE_APP_ROOT="${CPANEL_NODE_APP_ROOT:-$APP_DIR/backend}"
NPM_CACHE_ROOT="${NPM_CACHE_ROOT:-/tmp/inventra-npm-cache}"

need_cmd git
need_cmd npm

have_cmd() {
	command -v "$1" >/dev/null 2>&1
}

log "Starting cPanel deploy"
log "APP_DIR=$APP_DIR"
log "BRANCH=$BRANCH"

if [[ ! -d "$APP_DIR/.git" ]]; then
	echo "APP_DIR is not a git repository: $APP_DIR" >&2
	exit 1
fi

cd "$APP_DIR"

export NODE_ENV=production

mkdir -p "$NPM_CACHE_ROOT/frontend"

log "Pulling latest code"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

if [[ ! -f backend/.env ]]; then
	if [[ -f backend/.env.production ]]; then
		log "Creating backend/.env from backend/.env.production"
		cp backend/.env.production backend/.env
	elif [[ -f .env.production ]]; then
		log "Creating backend/.env from .env.production"
		cp .env.production backend/.env
	else
		echo "No environment template found. Create backend/.env manually." >&2
		exit 1
	fi
fi

log "Installing backend dependencies"
cd "$APP_DIR/backend"
log "Skipping backend npm install here; cPanel Node selector manages backend node_modules"

log "Ensuring runtime directories"
mkdir -p uploads logs
mkdir -p uploads/pm-reports uploads/project-logo uploads/signature-staff uploads/signed-pm-reports
chmod 755 uploads logs || true

if [[ "$RUN_MIGRATIONS" == "1" ]]; then
	log "Running database migrations"
	cd "$APP_DIR"
	node database/run_migration.js
	node database/run_add_indexes.js
fi

log "Building frontend"
cd "$APP_DIR/frontend"
export npm_config_cache="$NPM_CACHE_ROOT/frontend"
npm ci --omit=dev || npm install --production
npm run build

if [[ "$DEPLOY_FRONTEND_TO_PUBLIC_HTML" == "1" ]]; then
	log "Syncing frontend build to PUBLIC_DIR"
	mkdir -p "$PUBLIC_DIR"
	if have_cmd rsync; then
		rsync -av --delete "$APP_DIR/frontend/build/" "$PUBLIC_DIR/"
	else
		log "rsync not found; using cp fallback"
		cp -a "$APP_DIR/frontend/build/." "$PUBLIC_DIR/"
	fi
else
	log "Skipping public_html sync (DEPLOY_FRONTEND_TO_PUBLIC_HTML=$DEPLOY_FRONTEND_TO_PUBLIC_HTML)"
fi

log "Triggering cPanel Passenger restart"
mkdir -p "$CPANEL_NODE_APP_ROOT/tmp"
touch "$CPANEL_NODE_APP_ROOT/tmp/restart.txt"

log "Deploy completed successfully"
