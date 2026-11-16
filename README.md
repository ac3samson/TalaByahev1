# TalaByahe

**Offline-first mobile ticketing system** for provincial bus operations.

This repo now has a live **PostgreSQL-backed admin website**, plus the Expo conductor app (mobile wiring comes next).

| App | Folder | Run command |
|-----|--------|-------------|
| **Admin (web)** | `admin/` | `npm run dev` (port `43123`) |
| **API + Postgres** | `server/` | `npm run dev` (port `43124`) |
| **Conductor (mobile)** | `conductor/` | `npm start` → APK via EAS |

## Prerequisites

1. [Node.js LTS](https://nodejs.org/) (v18+)
2. PostgreSQL 16+ running locally
3. Free [Expo account](https://expo.dev) (only for APK builds)

Default local database URL:

```text
postgres://talabyahe:talabyahe@127.0.0.1:5432/talabyahe
```

## Quick start — Admin + database

```bash
# one-time: create DB user/database in Postgres, then:
npm run setup

# terminal 1 — API
npm run dev:api

# terminal 2 — Admin website
npm run dev:admin
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123). Sign in with the single admin account:

- **Username:** `admin@talabyahe.ph`
- **Password:** `talabyahe14`

Adding an employee requires an **employee password** (for the mobile app) and the **admin password**. Seeded conductors can sign into the mobile app with:

- **Employee ID:** `EMP-001` (Juan) / `EMP-002` (Maria) / …
- **Password:** `conductor14`

The sidebar shows a live **Postgres status** pill (table counts + latency). Add/edit/delete on Employees, Routes, and Fares writes straight to PostgreSQL — refresh the page and the data stays.

**Admin screens:** Dashboard, Employees, Routes, Fares, Monitoring, Reports

### Useful DB commands

```bash
cd server
npm run db:setup          # apply schema
node src/setupDb.js --reset   # wipe + reseed demo data
```

Health check: [http://127.0.0.1:43124/api/health](http://127.0.0.1:43124/api/health)

## Quick start — Conductor mobile

The conductor app is on **Expo SDK 58** and logs in against the same PostgreSQL employees table (Employee ID + password). Use an Expo Go build that supports SDK 58.

```bash
# terminal 1 — API must be running
npm run dev:api

# terminal 2 — Expo (ngrok tunnel so a phone can reach the API via Metro proxy)
cd conductor
npm install
npm run start:tunnel
```

Scan the QR code / open the shown `exp://…` URL in Expo Go (SDK 58). Sign in with a seeded employee ID + `conductor14`, or an employee you created in Admin.

## Project structure

```text
TalaByahe/
├── shared/mockData.js    # Original mock seed reference
├── server/               # Express API + PostgreSQL
├── admin/                # Web dashboard (DB-backed)
└── conductor/            # Mobile app for bus conductors
```

## Capstone alignment

| Objective | Implemented in |
|-----------|----------------|
| Admin: employee onboarding, routes, fares, monitoring, reports | `admin/` + `server/` |
| Conductor: passenger monitoring, auto fare, digital tickets, earnings | `conductor/` (mobile sync next) |

---

*Admin website is connected to PostgreSQL. Mobile sync is the next slice.*
