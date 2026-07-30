# Zoho CRM Clone

A Zoho-style CRM UI built with **Next.js 14** and **Tailwind CSS**. Talks directly to the [Sales CRM API](https://salescrm-api.duckdns.org/docs).

## Features

- JWT login with token refresh
- Dashboard with KPI cards and report-driven charts
- **Leads**, **Contacts**, **Accounts**, **Deals** (list + detail + Kanban)
- Lead conversion, notes, recycle bin
- Reports (leads, deals, accounts, campaigns, weekly admin reports)
- Role-based UI (viewer read-only)
- Mobile-friendly collapsible sidebar
- Optional CloudTalk click-to-call dialer

---

## Prerequisites

- [Node.js 18+](https://nodejs.org)

---

## Quick Start

```bash
npm install
cp .env.example .env.local   # optional — defaults to production API
npm run dev
```

Open **http://localhost:3002**

### Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `https://salescrm-api.duckdns.org/api/v1` | Sales CRM API base URL |
| `NEXT_PUBLIC_CLOUDTALK_ENABLED` | *(unset)* | Set to `false` to disable the embedded CloudTalk dialer |
| `NEXT_PUBLIC_CLOUDTALK_PARTNER` | `sale-crm` | Partner identifier for the embedded CloudTalk Phone iframe |

For **Vercel**, deploy from the repo root and set `NEXT_PUBLIC_API_URL` in project settings.

---

## Login

Use credentials from your Sales CRM API administrator.

| Email | Password |
|-------|----------|
| `admin@company.com` | *(ask your API admin)* |

---

## Project Structure

```
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # Layout, UI, forms
│   ├── hooks/            # useAuth, usePermissions, debounce
│   └── lib/
│       ├── api.js        # Axios client + JWT refresh
│       ├── services/     # API modules (leads, deals, reports…)
│       └── *Helpers.js   # Field normalization
├── public/
├── package.json
├── next.config.js
├── tailwind.config.js
└── vercel.json
```

- **Auth:** Tokens in `localStorage`; `crm_session` cookie is set alongside them but route protection is enforced client-side in `CRMLayout.js`, which redirects to `/login` once `useAuth()` resolves with no signed-in user (there is no server/edge middleware in this app)
- **API docs:** https://salescrm-api.duckdns.org/docs

---

## Integrated API Modules

| Module | Status |
|--------|--------|
| Auth, Leads, Contacts, Accounts, Deals | Live |
| Recycle Bin, Reports, Weekly Reports | Live |
| Tasks, Meetings, Calls, Campaigns, Documents, Feeds, Visits, Projects | UI stub (API pending) |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server on port **3002** |
| `npm run build` | Production build |
| `npm start` | Serve production build on port **3002** |
