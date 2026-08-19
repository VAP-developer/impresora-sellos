-- Migration 013: Create app_state table for persistent application state flags
-- Used to store blocking state that survives app restarts (Req 6.3, 6.4)

CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);
