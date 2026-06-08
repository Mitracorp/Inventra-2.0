Local development scripts and instructions

- Purpose: scripts in this file are intended for local development only and should not be used in production.

check_db.js
- Usage: from repo root run:

```bash
cd backend
node check_db.js
```

This script attempts to connect to the local MySQL instance and a remote test host. Adjust credentials in `backend/.env.development` if needed.
