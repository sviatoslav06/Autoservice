# AutoService — Auto Repair Shop Management System

A full-stack web application for managing an auto repair shop: work orders, services, parts inventory, employees, and finances — all in one place.

**Live Demo:** [autoservice-flax.vercel.app](https://autoservice-flax.vercel.app/)

---

## Key Features

- **Work Order Management** — create, assign, and track repair orders with real-time status updates
- **Service Bays** — manage bay assignments and workload distribution across mechanics
- **Parts & Inventory** — catalog of spare parts with categories, pricing, and stock tracking
- **Employee Management** — staff profiles, rates, and work logs tied to individual orders
- **Payments & Finance** — record payments and generate financial reports
- **Role-Based Access** — five roles out of the box: Client, Manager, Mechanic, Accountant, Administrator

---

## Tech Stack

| Layer | Technologies |
|---|---|
| Backend | Node.js, Express, TypeScript, Prisma ORM |
| Frontend | React, Vite, TypeScript, Tailwind CSS |
| Database | PostgreSQL (via Prisma) |
| Auth | JWT |

---

## Infrastructure (already deployed)

| Service | Provider | URL |
|---|---|---|
| Frontend | Vercel | https://autoservice-flax.vercel.app/ |
| Backend API | Render | https://autoservice-2h6l.onrender.com |
| Database | Neon (serverless Postgres) | https://console.neon.tech/app/projects/mute-math-20499422 |

Everything is live and running — no setup required to evaluate the product.

---

## Local Development

**Requirements:** Node.js 18+, npm or yarn, PostgreSQL

### 1. Clone the repository

```bash
git clone <repo-url>
cd autoservice-project
```

### 2. Set up the backend

```bash
cd backend
npm install
npm run generate        # Generate Prisma Client
npx prisma migrate dev  # Run database migrations
npx prisma db seed      # (Optional) Seed initial data
npm run dev             # Start development server
```

### 3. Set up the frontend

```bash
cd ../frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` and the backend at `http://localhost:5001` (or as configured in `.env`).

---

## Environment Variables

Create a `.env` file inside `backend/`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/autoservice_db
PORT=5001
JWT_SECRET=your_jwt_secret_here
NODE_ENV=development
```

---

## Available Scripts

**Backend** (`backend/`):

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload (tsx) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run generate` | Regenerate Prisma Client after schema changes |
| `npm start` | Run compiled production build |
| `npm run import:external` | Import data from external sources |

**Frontend** (`frontend/`):

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build locally |

---

## Project Structure

```
autoservice-project/
├── backend/
│   ├── prisma/          # Schema & migrations
│   └── src/
│       ├── routes/      # Express API routes
│       ├── controllers/ # Business logic
│       └── tools/       # Utility scripts (e.g. data import)
└── frontend/
    └── src/
        ├── api/         # Axios client & API calls
        ├── components/  # Reusable UI components
        └── pages/       # Route-level page components
```

---

## Deployment

The project is already deployed across three managed services:

- **Vercel** (frontend) — set `VITE_API_URL=https://autoservice-2h6l.onrender.com/api` in project settings
- **Render** (backend) — set `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`
- **Neon** (database) — serverless Postgres, configure access permissions for the Render IP

---

## Roadmap

- [ ] Unit and end-to-end test coverage
- [ ] CI/CD via GitHub Actions (lint, build, test)
- [ ] Docker Compose setup for one-command local development
- [ ] SMS / email notifications for order status updates
- [ ] Customer-facing portal for order tracking
