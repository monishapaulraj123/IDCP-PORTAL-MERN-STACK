-- IDCP Portal database schema (SQLite / ANSI-SQL compatible)

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'designer', 'customer', 'contractor')),
  role_label TEXT NOT NULL,
  avatar_initial TEXT NOT NULL,
  customer_id INTEGER,
  designer_id INTEGER,
  contractor_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_code TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  location TEXT,
  property_type TEXT,
  project_type TEXT,
  budget REAL,
  start_date TEXT,
  end_date TEXT,
  requirements TEXT,
  designer TEXT,
  contractor TEXT,
  status TEXT DEFAULT 'Active',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS designers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  designer_code TEXT UNIQUE,
  name TEXT NOT NULL,
  specialization TEXT,
  experience TEXT,
  availability TEXT DEFAULT 'Available',
  rating REAL DEFAULT 4.5,
  active_projects INTEGER DEFAULT 0,
  phone TEXT,
  email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contractors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contractor_code TEXT UNIQUE,
  name TEXT NOT NULL,
  contact_person TEXT,
  specialization TEXT,
  status TEXT DEFAULT 'Active',
  experience TEXT,
  rating REAL DEFAULT 4.5,
  phone TEXT,
  email TEXT,
  current_project TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_code TEXT UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  contact_person TEXT,
  rating REAL DEFAULT 4.5,
  phone TEXT,
  email TEXT,
  delivery_status TEXT,
  materials_supplied TEXT, -- JSON array as text
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  supplier TEXT,
  unit_price REAL,
  unit TEXT,
  stock TEXT,
  quantity_available INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_code TEXT UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  name TEXT NOT NULL,
  customer_name TEXT,
  project_type TEXT,
  designer TEXT,
  contractor TEXT,
  location TEXT,
  budget REAL,
  start_date TEXT,
  end_date TEXT,
  priority TEXT DEFAULT 'Medium',
  current_stage_index INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Ongoing',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quotation_code TEXT UNIQUE,
  project_id INTEGER REFERENCES projects(id),
  customer_name TEXT,
  project_name TEXT,
  project_type TEXT,
  amount REAL,
  status TEXT DEFAULT 'Pending',
  date TEXT,
  valid_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Appointments: the core scheduling table.
-- status lifecycle: Pending -> Confirmed -> Completed
--                          -> Rejected
--                          -> Cancelled
--                    Confirmed/Pending -> Rescheduled (then a fresh Pending row date/time)
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  customer_name TEXT NOT NULL,
  project_name TEXT NOT NULL,
  designer TEXT NOT NULL,
  designer_id INTEGER REFERENCES designers(id),
  date TEXT NOT NULL,            -- ISO date, e.g. 2026-07-20
  time TEXT NOT NULL,            -- 24h HH:MM, e.g. 10:30 (used for slot math)
  time_label TEXT NOT NULL,      -- display label, e.g. "10:30 AM"
  mode TEXT NOT NULL DEFAULT 'In Person',
  location TEXT,
  tag TEXT,
  status TEXT NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Pending', 'Confirmed', 'Rejected', 'Cancelled', 'Completed', 'Rescheduled')),
  notes TEXT,
  created_by_user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_appointments_designer_date_time
  ON appointments (designer, date, time);

-- Payments: never stores card number / CVV, only gateway references.
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id TEXT UNIQUE NOT NULL,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  customer_name TEXT NOT NULL,
  project_name TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  method TEXT,
  payment_date TEXT,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Paid', 'Pending', 'Overdue', 'Failed', 'Refunded')),
  transaction_id TEXT,          -- our own internal reference, always present once paid
  gateway TEXT,                 -- 'razorpay' or 'mock'
  gateway_order_id TEXT,
  gateway_payment_id TEXT,
  created_by_user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payments_project ON payments (project_id);
