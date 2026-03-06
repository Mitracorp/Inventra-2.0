# Inventra — System Architecture & Feature Overview

This document provides a brief, high-level overview of Inventra’s architecture, tech stack, and core functions for supervisory review. It intentionally avoids sensitive implementation details.

## System Architecture
- Client–Server Model: React frontend (served from production domain) communicating with a Node.js/Express backend and a MySQL database.
- Communication: RESTful API over HTTPS using JSON. CORS is restricted to the production frontend domain (see [.env.production](.env.production)).
- Backend Structure: Express routes and controllers map requests to domain services and models; entrypoint at [backend/server.js](backend/server.js). Database connectivity is configured in [backend/config/database.js](backend/config/database.js).
- Data Storage: MySQL for relational data; file uploads stored on the server filesystem (upload directory configured via env). Scheduled maintenance jobs (e.g., audit log cleanup) reside under [backend/schedulers/](backend/schedulers/).

## Tech Stack
- Frontend: React, Axios, standard React build tooling.
- Backend: Node.js, Express, MySQL driver/pool, request validation and error handling middleware.
- Database: MySQL (production credentials and settings in [.env.production](.env.production)).
- Supporting Modules: PDF generation and PM report flows, activity/audit logging, simple schedulers for maintenance tasks.

## Database Hosting & Access
- Hosting: MySQL provisioned via cPanel in production.
- Access: Backend connects using environment variables in [.env.production](.env.production) and handles queries through model/service layers.

## Runtime & Configuration
- Environment: `NODE_ENV=production`, backend port `PORT=5000`.
- URLs & CORS: `FRONTEND_URL` and `CORS_ORIGIN` restrict allowed origins.
- Secrets: `SESSION_SECRET`, `JWT_SECRET` (must be strong, private values).
- Uploads: `UPLOAD_DIR` and `MAX_FILE_SIZE` control file storage limits.

## Key Modules & Functions (Surface Level)
- Authentication & Profiles: Basic login and JWT-secured endpoints; profile retrieval/update via dedicated routes (see backend `auth` and `profile` routes/controllers).
- Asset Management: Create, update, view, and flag assets; related domains include categories, models, and peripherals (see [backend/routes/assets.js](backend/routes/assets.js)).
- Inventory & Projects: Track inventory items and associate them with projects; typical list/detail operations with filtering (see [backend/routes/inventory.js](backend/routes/inventory.js), [backend/routes/projects.js](backend/routes/projects.js)).
- Preventive Maintenance (PM): Schedule PM tasks, maintain checklists, and generate PM reports/PDFs; includes PM schedules and maintenance endpoints (see [backend/routes/pm.js](backend/routes/pm.js), [backend/routes/pmSchedule.js](backend/routes/pmSchedule.js)).
- Audit Logs & Activity: Record key user actions for traceability; includes cleanup scheduler for log retention (see [backend/routes/activity.js](backend/routes/activity.js), [backend/schedulers/auditLogCleanup.js](backend/schedulers/auditLogCleanup.js)).
- File Handling & PDF: Upload documents/reports to the server; generate and serve PDFs for PM and related modules; templates under [backend/templates/](backend/templates/).

## Typical Request Flow
1. Frontend triggers an action (e.g., create asset).
2. Request hits an Express route, which calls the appropriate controller.
3. Controller validates input, interacts with the model/database.
4. JSON response returns to the frontend; errors are routed through centralized middleware.

## Deployment Notes
- Backend runs as a Node.js app on port 5000; frontend is deployed as a static React build on the production domain.
- Production settings and credentials are managed via environment variables in [.env.production](.env.production).

## Note on Scope
This is a concise, non-exhaustive overview intended for supervisory understanding. Detailed implementation, security configurations, and internal processes are intentionally restricted.