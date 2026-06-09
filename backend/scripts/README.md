Runtime diagnostics for Inventra backend

Usage

1. Upload or place this repo on the server where Passenger runs (app root).
2. Ensure Node is the same version Passenger uses (use `alt-nodejs22` on CloudLinux if applicable).
3. From the backend folder run:

```bash
cd /home/ivmscom/public_html/inventra.ivms2006.com/main/backend
node scripts/diagnose_runtime.js
```

If you want DB checks, set environment variables first:

```bash
export DB_HOST=ivms2006.com
export DB_USER=someuser
export DB_PASS=somepass
export DB_NAME=ivmscom_Inventra
node scripts/diagnose_runtime.js
```

This script will:
- Verify key npm modules resolve under the running Node.
- Check presence/readability of critical utility files used by PM/Asset controllers.
- Optionally attempt DB connection and verify core tables exist.
