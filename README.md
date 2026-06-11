# Zoho CRM Clone — Next.js + Node.js + PostgreSQL

A full-stack CRM application with:
- **Frontend**: Next.js 14 + Tailwind CSS
- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL
- **Auth**: JWT tokens

## Features
- Login / register with JWT authentication
- Dashboard with charts and pipeline overview
- Leads management (create, edit, delete, filter, search, pagination)
- Contacts management with avatar initials
- Deals — Table view AND Kanban board view
- Accounts management
- Pre-seeded demo data with Indian companies

---

## Prerequisites

Install these first if you don't have them:
- [Node.js 18+](https://nodejs.org)
- [PostgreSQL 14+](https://postgresql.org/download)

---

## Setup (Step by step)

### Step 1 — Create the PostgreSQL database

Open your terminal and run:
```bash
psql -U postgres
```
Then inside psql:
```sql
CREATE DATABASE zoho_crm;
\q
```

### Step 2 — Set up the Backend

```bash
cd backend

# Copy environment file
cp .env.example .env
```

Now open `backend/.env` and update:
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/zoho_crm
JWT_SECRET=pick_any_long_random_string_here
```

Then run:
```bash
npm install

# Initialize database tables + seed demo data
npm run db:init

# Start the backend server
npm run dev
```

Backend runs at: **http://localhost:5000**

### Step 3 — Set up the Frontend

Open a new terminal:
```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: **http://localhost:3000**

---

## Demo Login

| Field    | Value            |
|----------|------------------|
| Email    | disha@demo.com   |
| Password | demo1234         |

---

## Project Structure

```
zoho-crm/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── pool.js          # PostgreSQL connection
│   │   │   └── init.js          # DB schema + seed data
│   │   ├── middleware/
│   │   │   └── auth.js          # JWT middleware
│   │   ├── routes/
│   │   │   ├── auth.js          # Login / Register
│   │   │   ├── leads.js         # Leads CRUD
│   │   │   ├── contacts.js      # Contacts CRUD
│   │   │   ├── deals.js         # Deals CRUD + pipeline
│   │   │   ├── accounts.js      # Accounts CRUD
│   │   │   └── dashboard.js     # Stats + activity feed
│   │   └── index.js             # Express app entry
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── dashboard/page.js  # Dashboard with charts
    │   │   ├── leads/page.js      # Leads table + CRUD
    │   │   ├── contacts/page.js   # Contacts table + CRUD
    │   │   ├── deals/page.js      # Deals table + Kanban
    │   │   ├── accounts/page.js   # Accounts table + CRUD
    │   │   ├── login/page.js      # Auth page
    │   │   ├── layout.js          # Root layout
    │   │   └── globals.css        # Tailwind + component classes
    │   ├── components/
    │   │   ├── layout/
    │   │   │   ├── Sidebar.js     # Nav sidebar
    │   │   │   └── CRMLayout.js   # Auth-guarded wrapper
    │   │   └── ui/
    │   │       ├── Modal.js       # Reusable modal
    │   │       └── Badge.js       # Status badge
    │   ├── hooks/
    │   │   └── useAuth.js         # Auth context + hook
    │   └── lib/
    │       └── api.js             # Axios client with JWT
    ├── next.config.js             # API proxy to backend
    └── tailwind.config.js
```

## API Endpoints

| Method | Endpoint                  | Description           |
|--------|---------------------------|-----------------------|
| POST   | /api/auth/login           | Login                 |
| POST   | /api/auth/register        | Register              |
| GET    | /api/dashboard/stats      | Dashboard stats       |
| GET    | /api/leads                | List leads            |
| POST   | /api/leads                | Create lead           |
| PUT    | /api/leads/:id            | Update lead           |
| DELETE | /api/leads/:id            | Delete lead           |
| GET    | /api/contacts             | List contacts         |
| POST   | /api/contacts             | Create contact        |
| GET    | /api/deals                | List deals            |
| GET    | /api/deals/pipeline       | Pipeline by stage     |
| POST   | /api/deals                | Create deal           |
| GET    | /api/accounts             | List accounts         |
| POST   | /api/accounts             | Create account        |

All routes except `/api/auth/*` require `Authorization: Bearer <token>` header.
