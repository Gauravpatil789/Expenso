# Expenso — Enterprise Reimbursement Platform

An enterprise-grade expense reimbursement platform with configurable multi-step approval chains, OCR receipt scanning, real-time currency conversion, and role-based access control. Built with Express, PostgreSQL, and vanilla frontend JS.

## Quick Start

### Option A — Docker (recommended)

```bash
docker-compose up -d          # starts PostgreSQL 16
npm install
npm start                     # starts Express on http://localhost:3000
```

### Option B — Bring your own Postgres

1. Create a database and run `schema.sql` against it.
2. Set the connection string in `.env`:
   ```
   DATABASE_URL=postgresql://user:pass@localhost:5432/expenso
   PORT=3000
   ```
3. Install and start:
   ```bash
   npm install
   npm start
   ```

The server seeds demo data on first launch. Log in with any of these accounts:

| Role     | Email               | Password |
|----------|---------------------|----------|
| Admin    | admin@company.com   | admin    |
| Manager  | priya@company.com   | pass     |
| Employee | raj@company.com     | pass     |
| Employee | ananya@company.com  | pass     |

Alternatively, use the **Sign Up** flow to create a new company and admin account from scratch.

> **Note:** An internet connection is required for OCR (Tesseract.js CDN), currency conversion API, and the countries API used during signup and company setup.

## Features

### Authentication & Roles

- Email/password login with role-based routing (admin → dashboard, manager → approvals, employee → my expenses)
- Self-service company signup: creates a company, sets country/currency, and registers the founding admin — all in one step
- Three roles — **Admin**, **Manager**, **Employee** — each with a distinct sidebar and permission set
- Session persistence via `localStorage` user ID, validated against the server on reload

### Admin Panel

- **Company Setup**: country dropdown via REST Countries API with automatic base-currency detection
- **User Management**: full CRUD — add users, assign roles, set reporting managers, edit, or delete
- **Approval Chain Builder**: define an ordered sequence of approval steps (direct manager, named users) that every expense must pass through
- **Conditional Approval Rules**: configure rules that can auto-approve an expense early — by percentage of steps completed, by a specific approver's sign-off, or a hybrid of both
- **All Expenses**: view, filter, sort, and force-approve or force-reject any expense (logged as "Admin Override")

### Expense Submission

- Manual form with description, amount, currency (30+ currencies), category, date, and notes
- **Itemised line items**: add multiple description/amount rows per expense for granular breakdowns
- **OCR Receipt Scanner**: drag-and-drop or click-to-upload receipt images, powered by Tesseract.js v5 (client-side WebAssembly). Extracts merchant name, total amount, currency, date, and category, with a real-time progress bar. Parsed data auto-fills the expense form.
- **Live Currency Conversion**: real-time preview using ExchangeRate-API, with a 1-hour client-side cache and hardcoded fallback rates when the API is unreachable. Both original and converted amounts are stored.

### Multi-Step Approval Workflow

- Expenses flow through the company's approval chain step by step
- Each step is assigned to either the submitter's direct manager or a specific named user
- Approvers see a pending queue with a badge count and can approve or reject with optional comments
- Conditional rules can short-circuit the chain (e.g. auto-approve once 67% of steps are complete, or once a designated finance lead has signed off)
- Full approval log with timestamped actions (submitted, approved, rejected, auto-approved, admin override)
- Expense detail view shows the step-by-step approval timeline

### Manager Views

- **Pending Approvals**: queue of expenses awaiting the current user's action, with badge count in the sidebar
- **Team Expenses**: all expenses from direct reports, with status filters

### Dashboard

- Aggregate statistics: total, pending (with sum), approved (with sum), and rejected counts
- Recent activity table
- Category breakdown with progress bars
- Scope is role-aware: employees see only their own data, managers see their team, admins see the whole company

### Filtering & Sorting

- Filter by status (all, pending, approved, rejected) and category
- Sort by date (newest/oldest) or amount (highest/lowest)

### Design

- Clean dark UI with card-based layout and subtle accents
- Inter typeface throughout
- Toast notifications, loading spinners, and progress bars
- Responsive: desktop-first with a collapsible mobile sidebar

## Architecture

```
expenso/
├── server.js                 # Express app — REST API, auth, approval engine
├── db.js                     # PostgreSQL pool, schema init, demo seed
├── schema.sql                # Full database schema (9 tables, indexes)
├── .env                      # DATABASE_URL + PORT
├── docker-compose.yml        # PostgreSQL 16 (Alpine) with auto-schema init
├── package.json              # Express, pg, cors, dotenv
│
├── public/                   # Static frontend served by Express
│   ├── index.html            # App shell — auth screens, modal, toast container
│   ├── css/
│   │   └── styles.css        # Design system (~620 lines)
│   └── js/
│       ├── store.js          # API client — all data flows through REST endpoints
│       ├── api.js            # External services (REST Countries, ExchangeRate-API)
│       ├── ocr.js            # Tesseract.js OCR engine + receipt text parser
│       ├── components.js     # Reusable UI helpers: formatters, badges, icons
│       ├── pages.js          # Page renderers (dashboard, forms, tables, admin)
│       └── app.js            # Auth, routing, sidebar, toast notifications
│
├── index.html                # (legacy v1 — standalone, localStorage-only)
├── css/styles.css            # (legacy v1 styles)
└── js/                       # (legacy v1 scripts)
```

### Database Schema

| Table                    | Purpose                                           |
|--------------------------|---------------------------------------------------|
| `companies`              | Company profile, country, base currency, settings |
| `users`                  | Employees with role, email, manager reference     |
| `approval_chain_steps`   | Ordered approval steps (company-level config)     |
| `approval_rules`         | Conditional auto-approve rules                    |
| `expenses`               | Submitted expenses with status and current step   |
| `expense_lines`          | Itemised line items per expense                   |
| `expense_approval_steps` | Per-expense snapshot of each approval step         |
| `approval_log`           | Timestamped audit trail of every action            |

## API Endpoints

### Auth
| Method | Path               | Description                       |
|--------|--------------------|------------------------------------|
| POST   | `/api/auth/login`  | Email/password login               |
| POST   | `/api/auth/signup` | Create company + admin account     |

### Company & Users
| Method | Path              | Description                        |
|--------|-------------------|------------------------------------|
| GET    | `/api/company`    | Get company details                |
| PUT    | `/api/company`    | Update company (admin only)        |
| GET    | `/api/users`      | List all users in company          |
| POST   | `/api/users`      | Create user (admin only)           |
| PUT    | `/api/users/:id`  | Update user (admin only)           |
| DELETE | `/api/users/:id`  | Delete user (admin only)           |

### Approval Configuration
| Method | Path                   | Description                          |
|--------|------------------------|--------------------------------------|
| GET    | `/api/approval-chain`  | Get approval chain steps             |
| PUT    | `/api/approval-chain`  | Replace approval chain (admin only)  |
| GET    | `/api/approval-rules`  | Get conditional approval rules       |
| PUT    | `/api/approval-rules`  | Replace approval rules (admin only)  |

### Expenses
| Method | Path                          | Description                              |
|--------|-------------------------------|------------------------------------------|
| GET    | `/api/expenses?scope=`        | List expenses (my / team / pending / all)|
| GET    | `/api/expenses/:id`           | Get single expense with full details     |
| POST   | `/api/expenses`               | Submit new expense                       |
| POST   | `/api/expenses/:id/action`    | Approve or reject an expense             |
| GET    | `/api/expenses/pending-count` | Count of expenses awaiting current user  |
| GET    | `/api/dashboard`              | Aggregated dashboard statistics          |

## External Services

| Service         | URL                                                        | Auth        | Purpose                       |
|-----------------|------------------------------------------------------------|-------------|-------------------------------|
| REST Countries  | `https://restcountries.com/v3.1/all?fields=name,currencies`| None        | Country/currency dropdowns    |
| ExchangeRate-API| `https://api.exchangerate-api.com/v4/latest/{BASE}`        | None (free) | Real-time currency conversion |
| Tesseract.js    | CDN via jsDelivr                                           | None        | Client-side OCR               |

## Tech Stack

- **Backend**: Node.js, Express 4, PostgreSQL 16 (via `pg`)
- **Frontend**: Vanilla JavaScript (ES6+), CSS custom properties, grid, flexbox
- **OCR**: Tesseract.js v5 (WebAssembly, runs entirely in the browser)
- **Infra**: Docker Compose for the database, `.env` for configuration

## Data Persistence

All application data is stored in PostgreSQL and survives server restarts. The database is seeded with a demo company, six users, and six sample expenses on first launch. To reset, drop and recreate the database (or remove the Docker volume: `docker-compose down -v && docker-compose up -d`).

The legacy root-level files (`index.html`, `js/`, `css/`) are a standalone localStorage-only version of the app included for reference. The production app is served from `public/`.
