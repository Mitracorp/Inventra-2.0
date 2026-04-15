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
APP_DIR="${APP_DIR:-$HOME/inventra}"
BRANCH="${BRANCH:-main}"
PUBLIC_DIR="${PUBLIC_DIR:-$HOME/public_html}"
DEPLOY_FRONTEND_TO_PUBLIC_HTML="${DEPLOY_FRONTEND_TO_PUBLIC_HTML:-1}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-0}"
CPANEL_NODE_APP_ROOT="${CPANEL_NODE_APP_ROOT:-$APP_DIR/backend}"

need_cmd git
need_cmd npm
need_cmd rsync

log "Starting cPanel deploy"
log "APP_DIR=$APP_DIR"
log "BRANCH=$BRANCH"

if [[ ! -d "$APP_DIR/.git" ]]; then
	echo "APP_DIR is not a git repository: $APP_DIR" >&2
	exit 1
fi

cd "$APP_DIR"

export NODE_ENV=production

log "Pulling latest code"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

if [[ ! -f backend/.env ]]; then
	if [[ -f backend/env.production ]]; then
		log "Creating backend/.env from backend/env.production"
		cp backend/env.production backend/.env
	elif [[ -f env.production ]]; then
		log "Creating backend/.env from env.production"
		cp env.production backend/.env
	else
		echo "No environment template found. Create backend/.env manually." >&2
		exit 1
	fi
fi

log "Installing backend dependencies"
cd "$APP_DIR/backend"
npm ci --omit=dev || npm install --production

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
npm ci
npm run build

if [[ "$DEPLOY_FRONTEND_TO_PUBLIC_HTML" == "1" ]]; then
	log "Syncing frontend build to PUBLIC_DIR"
	mkdir -p "$PUBLIC_DIR"
	rsync -av --delete "$APP_DIR/frontend/build/" "$PUBLIC_DIR/"
else
	log "Skipping public_html sync (DEPLOY_FRONTEND_TO_PUBLIC_HTML=$DEPLOY_FRONTEND_TO_PUBLIC_HTML)"
fi

log "Triggering cPanel Passenger restart"
mkdir -p "$CPANEL_NODE_APP_ROOT/tmp"
touch "$CPANEL_NODE_APP_ROOT/tmp/restart.txt"

log "Deploy completed successfully"
