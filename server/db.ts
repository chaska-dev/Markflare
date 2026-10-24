// Local SQLite + migration runner. Uses better-sqlite3 (sync API, prebuilt
// Windows binaries). The DB file lives at data/markflare.db (gitignored).

import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseBlockProps } from './shared/blockProps';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = process.env.markflare_DB_PATH || path.join(DATA_DIR, 'markflare.db');
const MIGRATIONS_DIR = path.resolve(process.cwd(), 'migrations');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Row types returned by db.prepare(...).all(). Kept loose because each table
// has its own shape; services use `any` and normalize at the shared layer.
export type Row = Record<string, any>;

// Apply ALL migrations in lexicographic order. Each file runs in a
// transaction. Idempotent at the file level (CREATE TABLE/INDEX use IF NOT
// EXISTS; ALTER TABLE on existing columns fails silently because D1 doesn't
// have DROP COLUMN, so re-running them is a no-op).
export function runMigrations(): { applied: string[]; skipped: string[] } {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.warn(`[db] missing ${MIGRATIONS_DIR}, skipping migrations`);
    return { applied: [], skipped: [] };
  }
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  // Bookkeeping table to avoid re-applying migrations.
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations_applied (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const applied: string[] = [];
  const skipped: string[] = [];
  const alreadyApplied = new Set(
    db.prepare('SELECT name FROM _migrations_applied').all().map((r: any) => r.name)
  );

  for (const file of files) {
    if (alreadyApplied.has(file)) {
      skipped.push(file);
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const tx = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations_applied (name) VALUES (?)').run(file);
    });
    try {
      tx();
      applied.push(file);
    } catch (e: any) {
      // If the error is for duplicate columns/indexes, log it but keep going.
      // For anything else, propagate.
      const msg = String(e?.message || e);
      if (/duplicate column|already exists/i.test(msg)) {
        db.prepare('INSERT OR IGNORE INTO _migrations_applied (name) VALUES (?)').run(file);
        skipped.push(file);
      } else {
        throw e;
      }
    }
  }
  healSchema();
  return { applied, skipped };
}

// Columns that later migrations added to existing tables, with the exact
// definition each one uses. SQLite has no ADD COLUMN IF NOT EXISTS and the
// runner above marks a whole file applied on the first "duplicate column", so
// a local DB can end up with a migration recorded but only partly applied (or
// created by an older build). Re-adding what is missing keeps such a DB usable
// instead of failing at query time with "no such column".
const EXPECTED_COLUMNS: { table: string; column: string; ddl: string }[] = [
  // Local uploads live on disk (see POST /api/files/upload in server/index.ts).
  { table: 'files', column: 'storage', ddl: "storage TEXT NOT NULL DEFAULT 'disk'" },
  { table: 'pages', column: 'deleted_at', ddl: 'deleted_at TEXT' },
  { table: 'pages', column: 'is_favorite', ddl: 'is_favorite INTEGER NOT NULL DEFAULT 0' },
  { table: 'pages', column: 'full_width', ddl: 'full_width INTEGER NOT NULL DEFAULT 0' },
  { table: 'pages', column: 'is_project', ddl: 'is_project INTEGER NOT NULL DEFAULT 0' },
  { table: 'pages', column: 'cover', ddl: 'cover TEXT' },
  { table: 'blocks', column: 'props', ddl: "props TEXT NOT NULL DEFAULT '{}'" },
];

function healSchema(): void {
  for (const { table, column, ddl } of EXPECTED_COLUMNS) {
    // Table names come from the constant above, never from user input.
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (cols.length === 0) continue; // table itself missing: nothing to heal
    if (cols.some(c => c.name === column)) continue;
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    console.warn(`[db] healed schema: added ${table}.${column}`);
  }
  // The index from 0006 is lost if that file was skipped on a duplicate column.
  db.exec('CREATE INDEX IF NOT EXISTS idx_pages_deleted_at ON pages(deleted_at)');
}

// Helper: converts the 0/1 flags SQLite stores on a page into booleans, so the
// API returns the same shape as the Hono backend.
export function normalizePage(p: Row | undefined): Row | undefined {
  if (!p) return p;
  return {
    ...p,
    is_favorite: Boolean(p.is_favorite),
    full_width: Boolean(p.full_width),
    is_project: Boolean(p.is_project),
  };
}

// Helper: converts `checked` (which SQLite stores as 0/1) to boolean and
// parses `props` (JSON text) into an object. Used by every endpoint that
// returns blocks.
export function normalizeBlock(b: Row | undefined): Row | undefined {
  if (!b) return b;
  return { ...b, checked: Boolean(b.checked), collapsed: Boolean(b.collapsed), props: parseBlockProps(b.props) };
}
