Deployment notes for CloudLinux / Node.js Selector

This repo must NOT contain `node_modules` directories in the app folders. CloudLinux / cPanel's Node.js Selector (or any host-level Node environment) should provide a shared location for installed modules and a `node_modules` symlink in each app folder.

Frontend example (your app path):

  USER=ivmscom
  APP_FRONTEND=/home/$USER/public_html/inventra.ivms2006.com/main/frontend
  VENV_BASE=/home/$USER/nodevenvs

  # create a dedicated install folder for frontend deps
  mkdir -p $VENV_BASE/inventra-frontend

  # Install packages into that folder (run where `npm` is available)
  npm --prefix $VENV_BASE/inventra-frontend install --production

  # In the frontend app, remove any local node_modules and symlink to the venv
  cd $APP_FRONTEND
  rm -rf node_modules
  ln -s $VENV_BASE/inventra-frontend/node_modules node_modules

Backend (same pattern): choose a different target folder like `$VENV_BASE/inventra-backend` and repeat the steps for the `backend` app folder.

Notes and troubleshooting
- Replace `ivmscom` with the actual system username when running commands (your prompt shows `ivmscom`).
- If `npm` is not found, enable Node.js via cPanel → "Setup Node.js App" for the application and use the environment that cPanel creates to run `npm install`, or install Node system-wide (requires root).
- Ensure ownership and permissions allow the app user to read the installed modules:
  chown -R ivmscom:ivmscom $VENV_BASE/inventra-frontend

- If cPanel/Node Selector places the environment in a different path, point the symlink to that `node_modules` folder instead.

Example one-liner to create the symlink (run as the app user):

  ln -s /home/ivmscom/nodevenvs/inventra-frontend/node_modules /home/ivmscom/public_html/inventra.ivms2006.com/main/frontend/node_modules
