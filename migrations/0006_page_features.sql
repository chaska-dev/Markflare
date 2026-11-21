-- Page features: trash (soft delete), favorites, full-width layout, projects
-- and covers. Projects/covers used to live only in each browser's
-- localStorage, so they never followed the user across devices.
--
-- Keep this file to plain ALTERs + the index: the local runner (server/db.ts)
-- skips a whole file on "duplicate column", and healSchema() there re-adds
-- whatever a half-applied local DB is missing.

-- NULL = live page. A timestamp = in Trash since then.
ALTER TABLE pages ADD COLUMN deleted_at TEXT;
ALTER TABLE pages ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pages ADD COLUMN full_width INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pages ADD COLUMN is_project INTEGER NOT NULL DEFAULT 0;
-- Gradient CSS string or image URL (whatever CoverBanner stores); NULL = none.
ALTER TABLE pages ADD COLUMN cover TEXT;

CREATE INDEX IF NOT EXISTS idx_pages_deleted_at ON pages(deleted_at);
