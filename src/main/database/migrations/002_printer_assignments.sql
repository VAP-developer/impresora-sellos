-- Migration 002: Printer assignments persistence
-- Stores printer-to-target role assignments so they survive app restarts.

CREATE TABLE IF NOT EXISTS printer_assignments (
    target TEXT PRIMARY KEY CHECK(target IN ('printer1', 'printer2', 'ticket')),
    uri TEXT NOT NULL,
    name TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);
