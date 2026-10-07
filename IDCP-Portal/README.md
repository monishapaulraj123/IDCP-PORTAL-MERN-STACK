# IDCP Portal — Interior Designer Coordination Portal

A full-stack web app coordinating **Customers**, **Interior Designers**,
**Contractors**, and **Administrators** around projects, appointments,
quotations, materials and payments.

```
React Frontend (Vite)  →  Express REST API (JWT + RBAC)  →  SQLite database
                                     │
                                     └──  Razorpay (TEST/SANDBOX mode),
                                          with an offline mock-gateway
                                          fallback when no keys are set
```

This project began as a frontend-only React/Vite demo (static sample
data, no backend). It has since been connected to a real backend +
database while **keeping the existing UI, routes, and role-based login
screen untouched** — only the data source and access control moved from
"local sample data" to "real API + database".

## What changed vs. the original frontend-only version

- **Backend added** (`backend/`): Express + SQLite, JWT auth, bcrypt
  password hashing, RBAC middleware, input validation, rate limiting,
  centralized error handling, CORS.
- **Every page's data** now comes from the database via the API instead
  of `src/data/sampleData.js` (customers, projects, designers,
  contractors, suppliers, materials, quotations, appointments, payments,
  reports).
- **Appointments** now have real slot availability, double-booking
  prevention, past-date blocking, and a full status lifecycle (Pending →
  Confirmed/Rejected → Completed, plus Cancelled/Rescheduled).
- **Payments** now go through a real order → checkout → server-side
  verification flow (Razorpay test mode, or an offline mock gateway if no
  keys are configured), with a payment history and no card data ever
  stored.
- **A small rule-based (non-AI) chatbot** was added as a floating widget
  on every dashboard page, with role-aware answers about login,
  appointments, and payments.
- **RBAC is enforced on the backend**, not just by hiding routes in the
  UI — every API route re-checks the caller's role/ownership.

## Project layout

```
IDCP-Portal/
├── src/                    React frontend (routes/pages/components UNCHANGED in
│                             structure — only their data source changed)
│   ├── lib/api.js           New: fetch wrapper (JWT attach, error handling)
│   ├── components/Chatbot.jsx   New: rule-based floating assistant
│   ├── context/AuthContext.jsx  Now calls the real backend (JWT) instead of
│   │                             matching an in-memory demo user list
│   ├── context/DataContext.jsx  Now fetches every list from the API instead
│   │                             of src/data/sampleData.js
│   └── data/sampleData.js       Left in place, no longer imported anywhere
│                                  (kept only for historical reference)
├── backend/                 New: Express API + SQLite database
│   ├── src/db/schema.sql     Table definitions
│   ├── src/db/seed.js        Seeds sample data + 4 test accounts
│   ├── src/routes/           One file per resource (auth, appointments, payments, …)
│   ├── src/middleware/       requireAuth (JWT), requireRole (RBAC), validation, errors
│   └── src/utils/paymentGateway.js   Razorpay test mode + offline mock fallback
├── .env.example              Frontend env vars
└── backend/.env.example      Backend env vars (DB path, JWT secret, gateway keys)
```

---

## 1. How to run it

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Open .env and set a strong JWT_SECRET (e.g. `openssl rand -base64 48`)
# and, optionally, SEED_*_PASSWORD values for repeatable logins.
npm run seed        # creates tables + sample data + 4 test accounts
npm start            # http://localhost:4000
```

Use `npm run dev` instead of `npm start` for auto-restart on file changes.

### Frontend

In a second terminal, from the project root:

```bash
npm install
cp .env.example .env     # VITE_API_URL=http://localhost:4000/api
npm run dev                # http://localhost:5173
```

Build for production with `npm run build` (outputs to `dist/`); preview
that build locally with `npm run preview`.

---

## 2. Database setup

- **Engine:** SQLite (via `better-sqlite3`) — a real, persistent,
  file-backed relational database, not mock/in-memory data. Zero
  external services to install for local development/review.
- **Location:** controlled by `DB_PATH` in `backend/.env` (defaults to
  `backend/data/idcp.sqlite3`).
- **Schema:** `backend/src/db/schema.sql` — plain ANSI SQL, applied
  automatically on server start (`runMigrations()`).
- **Seeding:** `npm run seed` populates customers, projects, designers,
  contractors, suppliers, materials, quotations, appointments, payments,
  and the 4 role-based test accounts. Use `npm run seed:fresh` to wipe
  and reseed.
- **Moving to Postgres/MySQL later:** every query goes through the single
  `backend/src/db/index.js` module using plain SQL, so swapping the
  driver there (and adjusting `schema.sql`'s few SQLite-specific bits,
  e.g. `AUTOINCREMENT`) is the only change needed — no route files need
  to change.

---

## 3. Required environment variables

### `backend/.env` (see `backend/.env.example` for the full annotated list)

| Variable | Purpose |
|---|---|
| `PORT` | Port the API listens on (default `4000`) |
| `FRONTEND_URL` | Allowed CORS origin(s), comma-separated |
| `DB_PATH` | Path to the SQLite database file |
| `JWT_SECRET` | **Required.** Long random string used to sign session tokens |
| `JWT_EXPIRES_IN` | Session lifetime (default `8h`) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay **test-mode** keys. Leave blank to use the built-in offline mock payment gateway instead |
| `MOCK_GATEWAY_SECRET` | Secret used only by the mock gateway fallback |
| `SEED_*_EMAIL` / `SEED_*_PASSWORD` | Credentials used by `npm run seed` to create the 4 test accounts |

### project root `.env` (see `.env.example`)

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Base URL of the backend API the frontend calls |

**Nothing above is hard-coded in source** — passwords, the JWT secret,
and gateway keys all come from environment variables, and `.env` files
are git-ignored.

---

## 4. Cloud deployment

This is a standard two-service deployment (API + static frontend):

1. **Backend** — deploy `backend/` to any Node host (Render, Railway,
   Fly.io, a VM, etc.):
   - Build/start commands: `npm install` then `npm run seed` (first
     deploy only) then `npm start`.
   - Set all `backend/.env.example` variables in the host's environment
     variable settings — **never commit a real `.env`**.
   - Point `DB_PATH` at a persistent disk/volume the platform provides
     (SQLite is a single file — without a persistent volume it resets on
     every redeploy). For a fully managed database instead, swap the
     driver in `backend/src/db/index.js` for Postgres/MySQL and use the
     platform's managed DB add-on.
   - Set `FRONTEND_URL` to your deployed frontend's origin (for CORS).

2. **Frontend** — deploy the project root to any static host (Vercel,
   Netlify, Cloudflare Pages, etc.):
   - Build command: `npm install && npm run build`
   - Output directory: `dist/`
   - Set `VITE_API_URL` (build-time env var) to your deployed backend's
     `/api` URL, e.g. `https://your-api.onrender.com/api`.

3. **Payments** — once ready to move off test mode, replace the
   `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` test keys with live keys (this
   also requires completing Razorpay KYC) — no code changes needed, the
   same order/verify flow is used either way.

---

## 5. Test accounts

Test credentials are **not** included in this README, source code, or
any other project file, per the request that produced this build — they
were provided separately in the delivery message. To (re)create your
own, set `SEED_*_EMAIL` / `SEED_*_PASSWORD` in `backend/.env` and run
`npm run seed:fresh`.

---

## Original React-concepts reference (still accurate for the frontend layer)

| Hook / Feature | Where it's used |
|---|---|
| `useState` | Form fields, modal open/close, theme, language, font size, filters |
| `useEffect` | Session restore on load, fetching lists from the API, focusing inputs |
| `useContext` | `ThemeContext`, `AuthContext` (now backend-backed), `DataContext` (now backend-backed) |
| `useRef` | Focusing search inputs |
| `useMemo` | Filtered/derived lists, dashboard + report stats |
| `useCallback` | Form submit/reset handlers, API mutators |
| React Router | `BrowserRouter`, `Routes`, `Route`, `NavLink`, `useNavigate`, catch-all 404 |
