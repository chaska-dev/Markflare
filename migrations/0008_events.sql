-- Calendar events. One row per event: a wall-clock date plus optional
-- start/end times ("HH:MM"); NULL times mean an all-day event. No timezone
-- column on purpose — this is a single-user app, dates are local wall time.
--
-- CREATE TABLE IF NOT EXISTS so re-applying is a no-op; the Hono backend
-- (functions/api/[[route]].ts) creates the same table in ensureSchema for
-- fresh D1 databases, so both paths converge to the same shape.

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  event_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
