# Zoho CRM Clone — Next.js Frontend

A Zoho-style CRM UI built with **Next.js 14** and **Tailwind CSS**. The frontend talks directly to the external [Sales CRM API](https://api-salescrm.duckdns.org/docs) — no local backend required for normal development.

## Features

- JWT login with token refresh
- Dashboard with KPI cards and report-driven charts
- **Leads**, **Contacts**, **Accounts**, **Deals** (list + detail + Kanban)
- Lead conversion, notes, recycle bin
- Reports (leads, deals, accounts, campaigns, weekly admin reports)
- Role-based UI (viewer read-only)
- Mobile-friendly collapsible sidebar

---

## Prerequisites

- [Node.js 18+](https://nodejs.org)

---

## Quick Start

```bash
cd frontend
npm install
cp .env.example .env.local   # optional — defaults to production API
npm run dev
```

Open **http://localhost:3002**

### Environment

| Variable | Default |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | `https://api-salescrm.duckdns.org/api/v1` |

For **Vercel**, set `NEXT_PUBLIC_API_URL` in project settings (root directory: `frontend`).

---

## Login

Use credentials from your **Sales CRM API** administrator (not the old local demo DB).

Example (if provisioned on the API server):

| Email | Password |
|-------|----------|
| `admin@company.com` | *(ask your API admin)* |

---

## Architecture

```
frontend/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # Layout, UI, forms
│   ├── hooks/            # useAuth, usePermissions, debounce
│   ├── lib/
│   │   ├── api.js        # Axios client + JWT refresh
│   │   ├── services/     # API modules (leads, deals, reports…)
│   │   └── *Helpers.js   # Field normalization
│   └── middleware.js     # Route guard via session cookie
└── package.json
```

- **Auth:** Tokens in `localStorage` + `crm_session` cookie for middleware route protection
- **API docs:** https://api-salescrm.duckdns.org/docs

---

## Integrated API Modules

| Module | Status |
|--------|--------|
| Auth, Leads, Contacts, Accounts, Deals | Live |
| Recycle Bin, Reports, Weekly Reports | Live |
| Tasks, Meetings, Calls, Campaigns, Documents, Feeds, Visits, Projects | UI stub (API pending) |

---

## Optional Local Backend

The repo includes a legacy `backend/` (Express + PostgreSQL) for local development. The **frontend no longer proxies to it** by default. To use it, you would need to point `NEXT_PUBLIC_API_URL` at your local server and run PostgreSQL separately — see `backend/README` if present.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server on port **3002** |
| `npm run build` | Production build |
| `npm start` | Serve production build |
