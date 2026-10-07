# IDCP Portal — Backend

Express + SQLite REST API for the IDCP Portal frontend. See the project
root `README.md` for full setup/run/deploy instructions — this file is a
quick API reference.

## Scripts

| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm run seed` | Create tables (if missing) + seed sample data + test accounts (no-op if data already exists) |
| `npm run seed:fresh` | Drop all tables and reseed from scratch |
| `npm start` | Start the API server |
| `npm run dev` | Start with auto-restart on file changes |

## Auth

All routes below except `/api/health` and `/api/auth/login` require
`Authorization: Bearer <token>`, obtained from `POST /api/auth/login`.

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/api/auth/login` | — | `{ email, password }` → `{ token, user }` |
| GET | `/api/auth/me` | any | Validates the current token |
| POST | `/api/auth/logout` | any | Stateless — frontend just discards the token |

## Core resources

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET/POST/DELETE | `/api/customers` | admin, designer (read); admin (write) | |
| GET/POST/PATCH | `/api/projects`, `/api/projects/:id/advance`, `/:id/revert` | role-scoped read; admin/designer write | |
| GET/POST/DELETE | `/api/designers` | any (read); admin (write) | |
| GET/POST/DELETE | `/api/contractors` | any (read); admin (write) | |
| GET/POST/DELETE | `/api/suppliers` | any (read); admin (write) | |
| GET/POST/DELETE | `/api/materials` | admin/designer/contractor (read); admin (write) | |
| GET/POST/PATCH | `/api/quotations` | admin/designer/customer, role-scoped | |
| GET/POST/PATCH | `/api/appointments`, `/availability`, `/:id/status`, `/:id/reschedule` | role-scoped | see below |
| GET/POST | `/api/payments`, `/order`, `/:id/verify`, `/:id/mock-confirm`, `/record` | admin/customer, role-scoped | see below |
| GET | `/api/reports/revenue-trend`, `/customer-growth` | any | computed live from the database |

## Appointments in detail

- `GET /api/appointments/availability?designer=<name>&date=YYYY-MM-DD` —
  returns the day's 30-minute slots (09:00–18:00) with `available: true/false`,
  based on real bookings + past-time checks.
- `POST /api/appointments` — books a slot; re-validates on the server
  (past date, business hours, conflicting booking) regardless of what the
  UI already filtered out.
- `PATCH /api/appointments/:id/status` — `{ status }` one of `Confirmed`,
  `Rejected`, `Cancelled`, `Completed`. Designers/admins may confirm,
  reject, or complete; customers may only cancel their own.
- `PATCH /api/appointments/:id/reschedule` — `{ date, time }`, moves the
  appointment and sets status to `Rescheduled`.

## Payments in detail

- `POST /api/payments/order` — `{ projectId, amount, method }`, creates a
  `Pending` payment row + a gateway order (real Razorpay test order, or a
  mock order if no keys are configured).
- `POST /api/payments/:id/verify` — used after a **real** Razorpay
  checkout completes; verifies the HMAC signature server-side before
  marking the payment `Paid`.
- `POST /api/payments/:id/mock-confirm` — used only for payments created
  on the offline mock gateway (no real third-party signature exists in
  that case); still ownership/role-checked.
- `POST /api/payments/record` — admin-only, logs an already-settled
  offline payment (bank transfer/cash) directly.

No endpoint anywhere accepts or stores a card number or CVV.
