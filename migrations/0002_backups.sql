-- Site-content backups made from the admin page (Back up now, and automatically before a
-- new year). `data` is the gzip-compressed backup JSON (see src/lib/backup.js).
CREATE TABLE IF NOT EXISTS backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  commit_sha TEXT,
  summary TEXT,
  size INTEGER NOT NULL,
  data BLOB NOT NULL
);
CREATE INDEX IF NOT EXISTS backups_created_at ON backups (created_at DESC);
