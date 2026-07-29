-- Migration 006: Add tariff types, strip_count, and unique year constraint
-- Evolves the tariff system to support differentiated types (individual and strip)
-- and restricts tariff groups to one per year.

-- Step 1: Add type column to tariffs (default 'individual' for existing data)
ALTER TABLE tariffs ADD COLUMN type TEXT NOT NULL DEFAULT 'individual';

-- Step 2: Add strip_count column (nullable, only used for type='strip')
ALTER TABLE tariffs ADD COLUMN strip_count INTEGER;

-- Step 3: Drop the old year+title unique index and the non-unique year index,
-- then create a new year-only unique index
DROP INDEX IF EXISTS idx_tariff_groups_year_title;
DROP INDEX IF EXISTS idx_tariff_groups_year;
CREATE UNIQUE INDEX idx_tariff_groups_year ON tariff_groups(year);
