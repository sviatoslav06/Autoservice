# AutoService — Auto Repair Shop Management System

A full-stack web application for managing an auto repair shop end-to-end: work orders, service bays, parts inventory, employee workload, payments, and analytics — all behind a role-based access system.

**Live Demo:** [autoservice-flax.vercel.app](https://autoservice-flax.vercel.app/)

---

## Screenshots

<img width="5088" height="3378" alt="image" src="https://github.com/user-attachments/assets/4925d01d-5f95-4775-b67d-a23a7f6e5e8e" />
<p><em>Dashboard — overview of created orders (different role - different view)</em></p>

<img width="5088" height="3378" alt="image" src="https://github.com/user-attachments/assets/c1f525aa-717a-4f73-a899-f37e0b9a5b9c" />
<p><em>Last page of order creation</em></p>

<img width="5088" height="3378" alt="image" src="https://github.com/user-attachments/assets/b9130ca9-106c-4c25-ba46-1a703438fae9" />
<p><em>Mechanics workplace - page where mechanic can manage orders</em></p>

<img width="5088" height="3378" alt="image" src="https://github.com/user-attachments/assets/2b364f41-937c-456e-9fe0-c8136aa2b1e4" />
<p><em>Admin panel - page where admin can manage everything</em></p>

---

## Features

### Role-Based Access (5 roles)

| Role | Access |
|---|---|
| **Client** | Register vehicles, book services, track own orders |
| **Manager** | Manage orders, service bays, parts catalog, services |
| **Mechanic** | Personal workplace — view assigned work, log time |
| **Accountant** | Finance module, payment records, analytics |
| **Admin** | Full access including user management and data import |

### Core Modules

**Orders & Bays**
- Create orders linked to a client, vehicle, and specific service bay
- Order lifecycle: `Planned → In Progress → Ready for Delivery → Completed / Canceled`
- Assign multiple services and parts to a single order
- Track actual vs. estimated duration per service

**Parts & Inventory**
- Parts catalog with categories and stock quantities
- Custom fields per category (text, number, date, boolean) — flexible enough for any part type
- Supplier tracking and per-part pricing
- Parts consumed per order with quantity and unit price recorded

**Services**
- Service catalog with standard price and estimated duration
- Each service on an order is assigned to a specific mechanic with actual duration and cost logged

**Vehicles**
- Clients register their vehicles: make, model, year, VIN, license plate, kilometrage
- Full order history per vehicle

**Payments & Finance**
- Payments linked to orders: cash, card, or bank transfer
- Payment status tracking (pending / completed)
- Finance overview for accountants

**Analytics**
- Analytics dashboard accessible to Admins and Accountants

**Data Import**
- Admin-only module for importing external data into the system

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | Node.js, Express, TypeScript |
| **ORM** | Prisma (PostgreSQL) |
| **Frontend** | React, React Router v6, TypeScript, Vite, Tailwind CSS |
| **Auth** | JWT (access token, role-based route guards) |
| **Security** | Helmet, CORS |
| **Logging** | Morgan |

---

## API Modules

The backend exposes a RESTful API at `/api/`:

| Endpoint | Description |
|---|---|
| `/api/auth` | Login, registration, JWT |
| `/api/users` | User management |
| `/api/workers` | Worker profiles and rates |
| `/api/vehicles` | Client vehicles |
| `/api/boxes` | Service bays |
| `/api/services` | Service catalog |
| `/api/parts` | Parts catalog |
| `/api/part-categories` | Part categories |
| `/api/part-fields` | Custom fields per category |
| `/api/orders` | Orders (full CRUD + status management) |
| `/api/payments` | Payments per order |
| `/api/analytics` | Aggregated financial/operational stats |
| `/api/data-import` | Bulk data import (Admin only) |

---

## Database Schema (key relationships)

```
User ──< Client ──< Vehicle
                 └──< Order >──< OrderService >── Service
                            >──< OrderPart    >── Part ──< PartCategory
                            └──< Payment
User ──< Worker ──< OrderService
Box ──────────────< Order
```

Full schema and migrations live in `backend/prisma/`.

---

## Project Structure

```
autoservice-project/
├── backend/
│   ├── prisma/               # Schema, migrations, seed
│   └── src/
│       ├── modules/          # Feature modules (auth, order, payment, analytics, …)
│       ├── middleware/        # Error handling, auth guard
│       └── config/           # Env config
└── frontend/
    └── src/
        ├── pages/             # Route-level pages (Dashboard, BookingFlow, MechanicWorkplace, …)
        ├── context/           # AuthContext (JWT + role state)
        └── api/               # Axios client
```

---

## Deployed Infrastructure

| Service | Provider | URL |
|---|---|---|
| Frontend | Vercel | https://autoservice-flax.vercel.app |
| Backend API | Render | https://autoservice-2h6l.onrender.com |
| Database | Neon (serverless Postgres) | — |

Everything is live — no setup required to evaluate the product.

---

## Local Development

**Requirements:** Node.js 18+, PostgreSQL

### 1. Clone

```bash
git clone https://github.com/sviatoslav06/Autoservice.git
cd Autoservice
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env        # fill in DATABASE_URL and JWT_SECRET
npm run generate            # generate Prisma Client
npx prisma migrate dev      # run migrations
npx prisma db seed          # optional: seed demo data
npm run dev
```

### 3. Frontend

```bash
cd ../frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`, backend at `http://localhost:5001`.

---

## Environment Variables

`backend/.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/autoservice_db
PORT=5001
JWT_SECRET=your_jwt_secret_here
NODE_ENV=development
```

`frontend/.env`:

```env
VITE_API_URL=http://localhost:5001/api
```

---

## Scripts

**Backend:**

| Command | Description |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run generate` | Regenerate Prisma Client |
| `npm run import:external` | Run external data import tool |
| `npm start` | Run compiled production build |

**Frontend:**

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build locally |

---

## Roadmap

- [ ] Unit and end-to-end tests
- [ ] CI/CD via GitHub Actions
- [ ] Docker Compose for one-command local setup
- [ ] Email / SMS notifications on order status change
- [ ] Customer-facing order tracking portal
- [ ] PDF invoice generation per order
