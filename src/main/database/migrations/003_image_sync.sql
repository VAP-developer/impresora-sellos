-- Migration 003: Image sync table
-- Stores synchronization metadata for fair images scanned from bbdd-ferias/ folders.
-- Links to the images table via image_name → images.name

CREATE TABLE IF NOT EXISTS image_sync (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year TEXT NOT NULL,
    fair_name TEXT NOT NULL,
    image_type TEXT NOT NULL CHECK(image_type IN ('fondo', 'sello')),
    file_path TEXT NOT NULL UNIQUE,
    mtime INTEGER NOT NULL,
    image_name TEXT NOT NULL,
    synced_at TEXT DEFAULT (datetime('now')),
    UNIQUE(year, fair_name, image_type)
);

CREATE INDEX IF NOT EXISTS idx_image_sync_fair
    ON image_sync(year, fair_name);
