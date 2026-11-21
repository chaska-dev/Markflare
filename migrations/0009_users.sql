-- Akun user. Dibuat admin; tidak ada pendaftaran mandiri.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 100000,
  is_admin INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Kolom pemilik. Nullable karena SQLite tidak bisa ADD COLUMN NOT NULL tanpa default.
-- Diisi oleh kode saat startup (lihat langkah 4).
ALTER TABLE pages ADD COLUMN owner_user_id TEXT;
ALTER TABLE events ADD COLUMN owner_user_id TEXT;
ALTER TABLE files ADD COLUMN owner_user_id TEXT;
ALTER TABLE api_tokens ADD COLUMN user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_pages_owner ON pages(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_events_owner ON events(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id);
