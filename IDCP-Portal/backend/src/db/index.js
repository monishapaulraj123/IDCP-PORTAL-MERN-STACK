import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// SQLite is used as the default database because it is zero-config and
// ships with the project (no separate DB server to install for local
// review). It is a real, persistent, file-backed relational database —
// not mock/in-memory data. For production/cloud deployments, point
// DB_PATH at a persistent disk/volume (see README "Cloud Deployment"),
// or swap this file for a Postgres client — every query in this project
// goes through this single module, and the SQL used is plain ANSI SQL,
// so the rest of the codebase (routes, seed script) does not need to
// change to move to Postgres/MySQL later.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/idcp.sqlite3')

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

export const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

export function runMigrations() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8')
  db.exec(schema)
}

export default db
