#!/bin/bash
# cpanel_deploy.sh
# Template deployment script for Inventra main site on cPanel (run on the server as the cPanel user).
# Edit the variables below to match your server paths and run this script via SSH.

set -euo pipefail

# === Configuration: adjust these paths as needed ===
CPANEL_USER="ivmscom"
APP_ROOT="/home/${CPANEL_USER}/public_html/inventra.ivms2006.com/main"
NODEVENV_LIB="/home/${CPANEL_USER}/nodevenv/public_html/inventra.ivms2006.com/main/backend/22/lib"

# === Frontend: copy built files to public frontend folder ===
# Option A: build locally and rsync the build/ directory to the server.
# Option B: build on the server (uncomment the server-side build block below).

echo "Deploying frontend to ${APP_ROOT}/frontend"

# If you already have a local build, use rsync from your machine instead of running this on the server.
# Example local command (run on your dev machine):
# rsync -avz frontend/build/ ${CPANEL_USER}@your-server:${APP_ROOT}/frontend/

# Server-side build (run on server inside repo copy):
if [ -d "${APP_ROOT}/frontend" ]; then
  cd "${APP_ROOT}/frontend"
  echo "Installing frontend dependencies (production)..."
  npm ci --omit=dev --no-audit --no-fund || npm install --production --no-audit --no-fund
  echo "Building frontend..."
  npm run build
  # Keep source public/ intact; CRA reads index.html from public/ during build.
  # Deploy the generated build/ output separately if you need a static bundle.
  if [ -d "build" ]; then
    echo "Build completed successfully. Generated bundle is in ${APP_ROOT}/frontend/build"
  fi
else
  echo "Warning: frontend directory not found at ${APP_ROOT}/frontend"
fi

# === Backend: ensure modules are installed into alt-nodejs nodevenv used by Passenger ===
echo "Installing backend modules into nodevenv: ${NODEVENV_LIB}"
export PATH=/opt/alt/alt-nodejs22/root/usr/bin:$PATH
hash -r

npm install --prefix "${NODEVENV_LIB}" --omit=dev --no-audit --no-fund

# Create a symlink so the app can require modules from local node_modules
if [ -d "${APP_ROOT}/backend" ]; then
  cd "${APP_ROOT}/backend"
  rm -rf node_modules || true
  ln -s "${NODEVENV_LIB}/node_modules" node_modules || true
  chown -h ${CPANEL_USER}:${CPANEL_USER} node_modules || true
  chown -R ${CPANEL_USER}:${CPANEL_USER} "${NODEVENV_LIB}/node_modules" || true
else
  echo "Warning: backend directory not found at ${APP_ROOT}/backend"
fi

# === Restart Passenger (touch restart file) ===
if [ -d "${APP_ROOT}" ]; then
  cd "${APP_ROOT}"
  mkdir -p tmp
  touch tmp/restart.txt
  echo "Touched tmp/restart.txt to restart Passenger"
fi

echo "Deployment steps completed. Check logs and health endpoint to confirm." 
echo "Tail passenger log: tail -n 200 /home/${CPANEL_USER}/logs/passenger.log"
echo "Check health: curl -i https://inventra.ivms2006.com/api/health"

exit 0
