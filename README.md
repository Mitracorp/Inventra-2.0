# Inventra - Full-Stack Asset Management System

A comprehensive full-stack asset management system built with React frontend and Node.js/Express backend for complete asset lifecycle tracking, user management, and enterprise-grade operations.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18.x-61DAFB.svg)
![Node](https://img.shields.io/badge/Node-16+-339933.svg)
![Express](https://img.shields.io/badge/Express-4.x-000000.svg)
![MySQL](https://img.shields.io/badge/MySQL-8.0+-4479A1.svg)

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [System Architecture](#system-architecture)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Development](#development)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

Inventra is a full-stack asset management system built with React (frontend) and Node.js/Express (backend) with MySQL database. Designed for companies that lease equipment to clients, providing complete asset lifecycle tracking, project management, and preventive maintenance scheduling with PDF report generation.

### Key Capabilities
- **Asset Tracking**: Complete inventory management with search, filter, and categorization
- **Project Management**: Client project tracking with support levels and asset assignments
- **Preventive Maintenance**: Bi-annual maintenance scheduling with automated PDF report generation
- **Dashboard Analytics**: Real-time insights into assets, customers, and device distribution
- **User Authentication**: JWT-based authentication with role management

## ✨ Features

### 🏠 Dashboard (Default Landing Page)
- **Asset & Customer Statistics**: Real-time counts and metrics
- **Device Analytics Chart**: Visual distribution of devices by customer
- **Recent Assets Overview**: Quick access to latest asset entries
- **Modern UI Cards**: Professional stat cards with icons and hover effects

### 📋 Project Management
- **Project Portfolio View**: Card-based layout displaying all active projects
- **Client Information**: Comprehensive client details and contact management
- **Post-Support Tracking**: Support level management (Basic, Standard, Premium, Extended)
- **Asset Assignment**: Track which assets are deployed to each project
- **Status Management**: Color-coded project status (Active, In Progress, Planning, Completed)
- **Timeline Tracking**: Project start/end dates with duration calculations

### 📦 Asset Management (Previously Inventory)
- **Complete Asset Registry**: All company-owned assets in one location
- **Advanced Search & Filtering**: Multi-criteria filtering by name, category, status, location
- **Import/Export Functionality**: CSV import and export for bulk operations
- **Asset Lifecycle Tracking**: Purchase value, current value, depreciation
- **Location Management**: Track asset locations and movements
- **Category Organization**: Organize assets by type (Electronics, Furniture, etc.)
- **Status Monitoring**: Active, Maintenance, Inactive status tracking

### 🔧 Preventive Maintenance System
- **Bi-Annual Scheduling**: Automatic maintenance scheduling twice yearly
- **Smart Dashboard**: Overview of scheduled, overdue, and completed maintenance
- **Priority Management**: High, Medium, Low priority classification
- **Technician Assignment**: Assign and track maintenance technicians
- **Maintenance Checklists**: Detailed task lists for each maintenance type (Yes/No checkboxes)
- **PDF Report Generation**: Auto-generate professional A4 reports with customer name, asset serial, and checklist
- **Smart File Handling**: Auto-regeneration when files missing, relative path storage for team collaboration
- **Timeline Alerts**: Visual warnings for upcoming and overdue maintenance
- **Customer Integration**: Link maintenance to customer assets and contracts

### ⚙️ Account Settings
- **Profile Management**: Personal and company information management
- **Security Center**: Password changes and two-factor authentication
- **Notification Preferences**: Customizable alert settings for maintenance, assets, and system updates
- **Theme Customization**: Light/dark mode, accent colors, and layout preferences
- **User Preferences**: Compact mode, sidebar settings, and display options

## 🏗️ System Architecture

### Tech Stack

**Frontend:**
- React 18.x with functional components and hooks
- React Router v6 for client-side routing
- Lucide React for icons
- Axios for API communication

**Backend:**
- Node.js with Express.js
- MySQL2 with connection pooling
- JWT for authentication
- Puppeteer for PDF generation
- Handlebars for PDF templating

**Database:**
- MySQL 8.0+
- Tables: ASSET, INVENTORY, CUSTOMER, PROJECT, PMAINTENANCE, PM_RESULT, PM_CHECKLIST, USER

### Project Structure
```
Inventra/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.js                    # Main navigation
│   │   │   ├── PMReportDownload.js           # Smart PDF download button
│   │   │   ├── SearchableDropdown.js         # Dropdown with search
│   │   │   └── Pagination.js                 # Table pagination
│   │   ├── pages/
│   │   │   ├── Dashboard.js                  # Analytics dashboard
│   │   │   ├── Assets.js                     # Asset management
│   │   │   ├── Projects.js                   # Project management
│   │   │   ├── PreventiveMaintenance.js      # PM scheduling
│   │   │   ├── PMDetail.js                   # PM record details
│   │   │   ├── Login.js                      # Authentication
│   │   │   └── AccountSettings.js            # User preferences
│   │   ├── services/
│   │   │   └── apiService.js                 # API communication layer
│   │   ├── App.js                            # Main app component
│   │   └── index.js                          # Entry point
│   └── package.json
├── backend/
│   ├── controllers/
│   │   ├── pmController.js                   # PM business logic
│   │   ├── assetController.js                # Asset operations
│   │   ├── authController.js                 # Authentication
│   │   └── projectController.js              # Project operations
│   ├── models/
│   │   ├── PMaintenance.js                   # PM data access
│   │   ├── Asset.js                          # Asset data access
│   │   └── User.js                           # User data access
│   ├── routes/
│   │   ├── pm.js                             # PM endpoints
│   │   ├── assets.js                         # Asset endpoints
│   │   ├── auth.js                           # Auth endpoints
│   │   └── projects.js                       # Project endpoints
│   ├── middleware/
│   │   ├── auth.js                           # JWT verification
│   │   └── validation.js                     # Request validation
│   ├── utils/
│   │   ├── pdfGenerator.js                   # PDF generation logic
│   │   └── logger.js                         # Logging utility
│   ├── templates/
│   │   └── pm-report-template.html           # PDF template (A4, B&W)
│   ├── uploads/
│   │   └── pm-reports/                       # Generated PDFs (local)
│   ├── config/
│   │   └── database.js                       # MySQL connection pool
│   ├── server.js                             # Express server
│   └── package.json
└── README.md
```

### Database Relationships
```
USER (User_ID) ────┐
                   │
CUSTOMER (Customer_ID) ────┐
                           │
PROJECT (Project_ID, Customer_ID) ────┐
                                      │
INVENTORY (Inventory_ID, Customer_ID, Asset_ID)
                                      │
ASSET (Asset_ID) ─────────────────────┤
                                      │
PMAINTENANCE (PM_ID, Asset_ID, file_path) ────┐
                                               │
PM_RESULT (Result_ID, PM_ID, Checklist_ID) ───┤
                                               │
PM_CHECKLIST (Checklist_ID, Checklist_Name) ──┘
```

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn package manager
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/Makrozzz/Inventra.git
   cd Inventra
   ```

2. **Install Backend Dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Configure Database**
   - Create `.env` file in `backend/` folder:
   ```env
   DB_HOST=your_mysql_host
   DB_USER=your_mysql_user
   DB_PASSWORD=your_mysql_password
   DB_NAME=ivmscom_Inventra
   JWT_SECRET=your_secret_key
   PORT=5000
   ```

4. **Setup Database Schema**
   ```bash
   # Import database schema from config/setup.sql
   mysql -u your_user -p ivmscom_Inventra < config/setup.sql
   ```

5. **Start Backend Server**
   ```bash
   # In backend folder
   npm start
   # Server runs on http://localhost:5000
   ```

6. **Install Frontend Dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

7. **Start Frontend Development Server**
   ```bash
   npm start
   # Frontend runs on http://localhost:3000
   ```

8. **Access the Application**
   - Open browser to `http://localhost:3000`
   - Login with registered credentials

### Build for Production
```bash
# Frontend
cd frontend
npm run build

# Backend
cd backend
# Use PM2 or similar process manager
pm2 start server.js
```

## 📖 Usage Guide

### Getting Started
1. **Register**: Create a new account or use existing credentials
2. **Login**: JWT-based authentication with secure token storage
3. **Dashboard**: Review your asset and customer statistics
4. **Navigation**: Use the sidebar to navigate between different sections

### Managing Assets
1. **View Assets**: Click "Assets" in the sidebar
2. **Add New Asset**: Click "Add New Asset" button
3. **Search & Filter**: Use the search bar and filter dropdowns
4. **Import Data**: Use "Import CSV" for bulk asset uploads
5. **Export Data**: Use "Export CSV" to download asset data

### Project Management
1. **View Projects**: Click "Projects" in the sidebar
2. **Project Details**: Each card shows client info, timeline, and asset count
3. **Status Tracking**: Projects are color-coded by status
4. **Support Levels**: Track post-project support commitments

### Maintenance Scheduling
1. **Access Maintenance**: Click "Preventive Maintenance" in sidebar
2. **View Dashboard**: See scheduled, overdue, and completed maintenance
3. **Priority Management**: High priority items are highlighted
4. **Technician Tracking**: See assigned technicians and estimated duration
5. **Checklist Management**: Review maintenance task lists
6. **PM Reports**: Generate and download PDF reports for completed maintenance

#### PM Report File Handling

**System Logic Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│ USER CLICKS BUTTON (Generate Form / Download Form)         │
└────────────────────────┬────────────────────────────────────┘
                         ↓
                ┌─────────────────────┐
                │ Check Database      │
                │ file_path column    │
                └─────────┬───────────┘
                          ↓
                  ┌───────────────┐
                  │ file_path =   │
                  │ NULL?         │
                  └───┬───────┬───┘
                     YES      NO
                      ↓        ↓
            ┌─────────────┐   │
            │ Generate    │   │
            │ New PDF     │   │
            │ (~3 sec)    │   │
            └──────┬──────┘   │
                   ↓          ↓
            ┌──────────────────────────┐
            │ Build Absolute Path:     │
            │ backend/uploads/...      │
            └──────────┬───────────────┘
                       ↓
            ┌──────────────────────┐
            │ Check: Does file     │
            │ exist on THIS        │
            │ computer?            │
            └────┬────────┬────────┘
                YES       NO
                 ↓         ↓
                 │   ┌─────────────┐
                 │   │ Auto-       │
                 │   │ Regenerate  │
                 │   │ (~3 sec)    │
                 │   └──────┬──────┘
                 ↓          ↓
            ┌─────────────────────┐
            │ Download PDF File   │
            └─────────────────────┘
```

**Key Points:**

1. **First Generation:**
   - `file_path = NULL` in database
   - Button displays: "Generate Form"
   - Click → Generate PDF → Save to `backend/uploads/pm-reports/`
   - Store **relative path** in database: `uploads/pm-reports/PM_Report_NADMA_123.pdf`

2. **Subsequent Downloads:**
   - `file_path` has value (relative path)
   - Button displays: "Download Form"
   - System builds absolute path from relative path
   - Checks if file exists locally:
     - **EXISTS**: Instant download ⚡ (< 100ms)
     - **MISSING**: Auto-regenerate (~3 seconds) → Download

3. **Team Collaboration (Development):**
   - PDF files are **NOT committed to Git** (`.gitignore`)
   - Database **IS committed** (contains relative paths)
   - Each team member auto-generates their own local copies
   - Content is identical (same database = same PDF)
   - Why relative path? Works on any computer regardless of username/directory

4. **File Storage:**
   - **Development**: Local file system (`backend/uploads/pm-reports/`)
   - **Production**: Cloud storage recommended (see Deployment section)

**Example Scenario:**

```
Developer A:
  Generate PM Report #1 → File: C:\Users\Amirul\...\backend\uploads\pm-reports\PM_Report_NADMA_123.pdf
  Database stores: "uploads/pm-reports/PM_Report_NADMA_123.pdf"
  Commit & push → GitHub (code + database, NO PDF)

Developer B:
  Pull from GitHub → Database has path, but NO local PDF file
  Click "Download Form" → System checks local file → Not found
  Auto-regenerate → File: C:\Users\Teammate\...\backend\uploads\pm-reports\PM_Report_NADMA_123.pdf
  Download succeeds! ✅
  Next time: Instant download (cached locally)
```

### User Settings
1. **Profile Settings**: Update personal and company information
2. **Security**: Change passwords and enable two-factor authentication
3. **Notifications**: Customize email and system notifications
4. **Appearance**: Adjust theme, colors, and layout preferences

## 📁 API Endpoints

### Authentication
- `POST /api/auth/login` - User login (returns JWT token)
- `POST /api/auth/register` - User registration
- `GET /api/auth/verify` - Verify JWT token

### Assets
- `GET /api/assets` - Get all assets (with filters)
- `GET /api/assets/:id` - Get asset details
- `POST /api/assets` - Create new asset
- `PUT /api/assets/:id` - Update asset
- `DELETE /api/assets/:id` - Delete asset

### Projects
- `GET /api/projects` - Get all projects
- `GET /api/projects/:id` - Get project details
- `POST /api/projects` - Create new project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Preventive Maintenance
- `GET /api/pm` - Get all PM records
- `GET /api/pm/:id` - Get PM details with checklist
- `POST /api/pm` - Create new PM record
- `PUT /api/pm/:id` - Update PM record
- `GET /api/pm/:id/report` - Generate/Download PDF report
- `GET /api/pm/statistics` - Get PM statistics (scheduled, overdue, completed)

## 🚀 Deployment

### Development Environment
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`
- Database: Local MySQL or remote MySQL server
- PDF Storage: Local file system (`backend/uploads/pm-reports/`)

### Production Deployment on cPanel (Git Version Control)

This repository ships with a `.cpanel.yml` file that automates backend dependency
installation each time cPanel pulls a new commit.  Follow the one-time setup
below and then every subsequent push to the `staging` branch will deploy cleanly.

#### Prerequisites
- cPanel account with Node.js (Passenger) support
- MySQL/MariaDB database provisioned in cPanel
- SSH or Terminal access (for the first-time env setup)
- Domain pointed to the cPanel account

---

#### One-time server setup

**Step 1 – Create the MySQL database**
1. cPanel → **MySQL Databases** → create a database, a user, and grant ALL PRIVILEGES.
2. Note down: host (`localhost`), database name, username, password.
3. Import the schema: **phpMyAdmin** → select the database → **Import** → `backend/config/setup.sql`.

**Step 2 – Connect cPanel Git Version Control**
1. cPanel → **Git™ Version Control** → **Create** (or **Manage** if already cloned).
2. Set **Repository Path** to the directory where the app should live, e.g.  
   `/home/ivms2006/public_html/inventra.ivms2006.com/app`
3. Set **Clone URL** to `https://github.com/Mitracorp/Inventra-2.0`
4. Set **Branch** to `staging`.
5. Click **Create** – cPanel will clone the repo and run `.cpanel.yml` automatically.

**Step 3 – Create the production `.env` file (SSH / Terminal)**
```bash
# Navigate to the deployed repo root on the server
cd /home/ivms2006/public_html/inventra.ivms2006.com/app

# Copy the example template
cp backend/.env.example backend/.env

# Edit with your real values
nano backend/.env
```
Fill in every `<REQUIRED>` field in `backend/.env` (DB credentials, JWT secret, etc.).
See `backend/.env.example` for the full list of supported variables.

> ⚠️ **Never commit `backend/.env`** – it is listed in `.gitignore` and must stay
> on the server only.

**Step 4 – Configure the Node.js application**
1. cPanel → **Setup Node.js App** → **Create Application**.
2. Settings:
   | Field | Value |
   |---|---|
   | Node.js version | 18.x (or 20.x) |
   | Application mode | **Production** |
   | Application root | `/home/ivms2006/public_html/inventra.ivms2006.com/app/backend` |
   | Application URL | `inventra.ivms2006.com` (or your domain) |
   | Application startup file | `server.js` |
3. Click **Create** then **Run NPM Install** → **Start App**.

**Step 5 – Enable SSL**
- cPanel → **SSL/TLS** → **AutoSSL** or **Let's Encrypt** for your domain.

---

#### How `.cpanel.yml` keeps deployments clean

Every time you push to `staging` and click **Deploy HEAD Commit** in cPanel:

1. cPanel fetches & checks out the new commit (fast-forward).
2. cPanel runs the tasks in `.cpanel.yml`:
   - Creates `backend/logs/` and `backend/uploads/` sub-directories if missing.
   - Runs `npm install --production --no-package-lock` inside `backend/`.  
     The `--no-package-lock` flag prevents npm from writing a new
     `package-lock.json`, which would otherwise leave tracked files modified
     and block the *next* deployment with "uncommitted changes exist".
   - Fixes directory permissions.
3. Passenger auto-restarts the Node.js process.

> The pre-built React bundle (`frontend/build/`) is committed to the repo,
> so no frontend build step is needed on the server.

---

#### Deploying a new version

```bash
# On your local machine – push to staging
git push origin staging
```

Then in cPanel → **Git™ Version Control** → your repo → **Update** →
**Deploy HEAD Commit**.

---

#### Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "The system cannot deploy" | `.cpanel.yml` missing or malformed | Ensure `.cpanel.yml` exists in repo root with valid YAML |
| "Uncommitted changes exist" | `npm install` wrote a lockfile | Use `--no-package-lock` in `.cpanel.yml` (already set) |
| "Database error" on login | `backend/.env` missing or wrong credentials | SSH → check/recreate `backend/.env` from `backend/.env.example` |
| App crashes on start | `backend/logs/` doesn't exist | `.cpanel.yml` creates it; or run `mkdir -p backend/logs` via SSH |
| Cannot write to uploads | Wrong permissions | Run `chmod -R 755 backend/uploads` via SSH |

**PDF Storage on cPanel:**
- ✅ Uses file system: `backend/uploads/pm-reports/` (relative to app root)
- ✅ Files persist between deployments
- 🔴 **Important**: Set up automatic backups in cPanel → Backup Wizard

## 🚦 Development Status

### ✅ Completed Features
- [x] Full-stack architecture (React + Node.js + MySQL)
- [x] JWT authentication system
- [x] Responsive sidebar navigation
- [x] Dashboard with real-time analytics
- [x] Complete asset management with CRUD operations
- [x] Project management with customer integration
- [x] Preventive maintenance scheduling system
- [x] PDF report generation with Puppeteer
- [x] Smart file handling with auto-regeneration
- [x] Checklist management (Yes/No format)
- [x] Search and filtering systems
- [x] User account settings

### 🎯 Future Enhancements
- [ ] Cloud storage integration (Cloudflare R2/AWS S3) for production
- [ ] Role-based access control (Admin/Manager/Technician)
- [ ] Email notifications for PM schedules
- [ ] Advanced analytics and charts
- [ ] Mobile-responsive improvements
- [ ] Barcode/QR code scanning for assets
- [ ] Audit trail and activity logging
- [ ] CSV import/export for all modules

## 📄 License

This project is licensed under the MIT License.

## 📞 Support

For issues and questions:
- **GitHub Issues**: [Report bugs or request features](https://github.com/Makrozzz/Inventra/issues)
- **Documentation**: See README and inline code comments

---

**Inventra** - Asset Management System with Preventive Maintenance  
Built with React + Node.js + MySQL

  -Test push readme.md-