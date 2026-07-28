-- Migration 005: Create tariff_groups and tariffs tables

CREATE TABLE IF NOT EXISTS tariff_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    title TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'EUR',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Unicidad de año + título
CREATE UNIQUE INDEX IF NOT EXISTS idx_tariff_groups_year_title
    ON tariff_groups(year, title);

-- Índice para búsquedas por año
CREATE INDEX IF NOT EXISTS idx_tariff_groups_year
    ON tariff_groups(year);

CREATE TABLE IF NOT EXISTS tariffs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    position INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (group_id) REFERENCES tariff_groups(id) ON DELETE CASCADE
);

-- Índice para obtener tarifas de un grupo rápidamente
CREATE INDEX IF NOT EXISTS idx_tariffs_group_id
    ON tariffs(group_id);

-- Añadir columna tariff_group_id a eventos (nullable para compatibilidad)
ALTER TABLE eventos ADD COLUMN tariff_group_id INTEGER REFERENCES tariff_groups(id);
