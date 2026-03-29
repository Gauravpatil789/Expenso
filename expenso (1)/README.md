# ⚡ Expenso — Enterprise Reimbursement Platform

A fully functional, enterprise-grade expense reimbursement platform built with vanilla HTML/CSS/JS. Features role-based access control, OCR receipt scanning, real-time currency conversion, and manager approval workflows.

## 🚀 Quick Start

1. Open `index.html` in any modern browser (Chrome, Edge, Firefox, Safari)
2. Login with a demo account:

| Role     | Email               | Password |
|----------|---------------------|----------|
| Admin    | admin@company.com   | admin    |
| Manager  | priya@company.com   | pass     |
| Employee | raj@company.com     | pass     |
| Employee | ananya@company.com  | pass     |

> **Note:** An internet connection is required for OCR (Tesseract.js CDN), currency conversion API, and countries API.

## ✨ Features

### Authentication & Roles
- Email/password login with role-based routing
- Three roles: **Admin**, **Manager**, **Employee**
- Role-specific sidebar navigation and permissions
- Session persistence via localStorage

### Admin Panel
- **Company Setup**: Country dropdown via [REST Countries API](https://restcountries.com/v3.1/all?fields=name,currencies) — auto-sets base currency
- **User Management**: Full CRUD — add, edit roles/reporting managers, delete users
- **All Expenses**: View, filter, sort, force-approve or force-reject any expense
- Seed data pre-populated on first load

### Expense Submission
- Manual form: description, amount, currency (30+ currencies), category, date, notes
- **OCR Receipt Scanner**: Drag-and-drop or click-to-upload receipt images
  - Powered by [Tesseract.js v5](https://github.com/naptha/tesseract.js) (client-side OCR)
  - Extracts: merchant name, total amount, currency symbol, date, category
  - Real-time progress bar with status updates
  - Auto-fills the expense form with parsed data
- **Live Currency Conversion**: Real-time preview using [ExchangeRate-API](https://api.exchangerate-api.com/v4/latest/{BASE})
  - 1-hour cache to minimize API calls
  - Hardcoded fallback rates if API is unavailable
  - Stores both original + converted amounts

### Manager Approval Workflow
- Pending approval queue with badge count
- Approve/reject with optional comments
- Team Expenses view for all direct reports
- Approval timeline on expense detail

### Dashboard
- Statistics: total, pending, approved, rejected counts with totals
- Recent activity table
- Category breakdown with progress bars

### Filtering & Sorting
- Filter by status and category
- Sort by date (newest/oldest) or amount (highest/lowest)

### Design
- Dark glassmorphic UI with cyan neon accents
- Typography: Outfit (headings) + General Sans (body)
- Toast notifications, loading overlays, progress bars
- Responsive: desktop-first with mobile sidebar
- Smooth animations and transitions

## 🏗 Architecture

```
expenso/
├── index.html          # App shell, login screen, modal, toast container
├── css/
│   └── styles.css      # Complete design system (~800 lines)
├── js/
│   ├── store.js        # localStorage data layer + seed data
│   ├── api.js          # REST Countries + Exchange Rate API integration
│   ├── ocr.js          # Tesseract.js OCR engine + receipt text parsing
│   ├── components.js   # Reusable UI: formatters, badges, icons, timeline
│   ├── pages.js        # All page renderers (dashboard, forms, tables)
│   └── app.js          # Main controller: auth, routing, sidebar, toast
└── README.md
```

## 🔌 APIs Used

| API | URL | Auth | Purpose |
|-----|-----|------|---------|
| REST Countries | `https://restcountries.com/v3.1/all?fields=name,currencies` | None | Country/currency dropdown |
| ExchangeRate-API | `https://api.exchangerate-api.com/v4/latest/{BASE}` | None (free tier) | Currency conversion |
| Tesseract.js | CDN (`jsdelivr`) | None | Client-side OCR |

## 📦 Tech Stack

- **Vanilla JavaScript** (ES6+) — no frameworks
- **CSS** — custom properties, grid, flexbox, glassmorphism
- **Tesseract.js v5** — WebAssembly OCR engine
- **localStorage** — full client-side persistence

## 🔒 Data Persistence

All data (users, expenses, company settings, exchange rate cache) is stored in `localStorage` and survives page reloads. Clear browser storage to reset to seed data.
