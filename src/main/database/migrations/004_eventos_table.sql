-- Migration 004: Create eventos table for persistent event storage organized by year
-- Events are now stored individually with year association instead of as a fixed array in config JSON

CREATE TABLE IF NOT EXISTS eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    codigo TEXT NOT NULL DEFAULT '',
    nevento TEXT NOT NULL DEFAULT '',
    nferia TEXT NOT NULL DEFAULT '',
    nlugar TEXT NOT NULL DEFAULT '',
    motivoi TEXT NOT NULL DEFAULT '',
    motivod TEXT NOT NULL DEFAULT '',
    fecha TEXT NOT NULL DEFAULT '',
    localidad TEXT NOT NULL DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Index for quick lookup by year
CREATE INDEX IF NOT EXISTS idx_eventos_year ON eventos(year);
