-- Generic per-block properties: a JSON object stored as text. Images use it
-- for width/align/caption; later block features (colors, ...) can add keys
-- without another migration. '{}' = no properties.
--
-- Plain ALTER only, same convention as 0006: the local runner (server/db.ts)
-- skips a whole file on "duplicate column", and healSchema() there re-adds the
-- column to a half-migrated local DB.

ALTER TABLE blocks ADD COLUMN props TEXT NOT NULL DEFAULT '{}';
