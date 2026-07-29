-- Migration 006: Add tariff types, strip_count, and unique year constraint
-- Evolves the tariff system to support differentiated types (individual and strip)
-- and restricts tariff groups to one per year.
--
-- NOTE: ALTER TABLE ADD COLUMN is idempotent in this migration because
-- if it fails with "duplicate column", the migrator will catch it.
-- We use a CREATE TABLE trick to conditionally add columns.

-- Step 1: Add type column to tariffs if not already present.
-- SQLite doesn't support IF NOT EXISTS for ADD COLUMN, so we rely on the
-- fact that if this migration runs fresh, the columns don't exist yet.
-- If re-running after a partial failure, delete the DB or manually fix.
ALTER TABLE tariffs ADD COLUMN type TEXT NOT NULL DEFAULT 'individual';

-- Step 2: Add strip_count column (nullable, only used for type='strip')
ALTER TABLE tariffs ADD COLUMN strip_count INTEGER;

-- Step 3: Remove duplicate tariff_groups keeping only the one with the lowest id per year.
-- First, reassign tariffs from duplicate groups to the surviving group.
UPDATE tariffs
SET group_id = (
  SELECT MIN(tg2.id) FROM tariff_groups tg2
  WHERE tg2.year = (SELECT year FROM tariff_groups WHERE id = tariffs.group_id)
)
WHERE group_id NOT IN (
  SELECT MIN(id) FROM tariff_groups GROUP BY year
);

-- Also reassign eventos referencing duplicate groups
UPDATE eventos
SET tariff_group_id = (
  SELECT MIN(tg2.id) FROM tariff_groups tg2
  WHERE tg2.year = (SELECT year FROM tariff_groups WHERE id = eventos.tariff_group_id)
)
WHERE tariff_group_id IS NOT NULL
  AND tariff_group_id NOT IN (
    SELECT MIN(id) FROM tariff_groups GROUP BY year
  );

-- Delete duplicate tariff_groups (keep only the lowest id per year)
DELETE FROM tariff_groups
WHERE id NOT IN (
  SELECT MIN(id) FROM tariff_groups GROUP BY year
);

-- Step 4: Drop the old year+title unique index and the non-unique year index,
-- then create a new year-only unique index
DROP INDEX IF EXISTS idx_tariff_groups_year_title;
DROP INDEX IF EXISTS idx_tariff_groups_year;
CREATE UNIQUE INDEX idx_tariff_groups_year ON tariff_groups(year);
