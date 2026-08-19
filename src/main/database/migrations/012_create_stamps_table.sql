CREATE TABLE IF NOT EXISTS stamps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stamp_id TEXT NOT NULL UNIQUE,
  year TEXT NOT NULL,
  stamp_name TEXT NOT NULL,
  fondo_path TEXT,
  logo_path TEXT,
  status TEXT NOT NULL DEFAULT 'complete',
  synced_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_stamps_year ON stamps(year);
