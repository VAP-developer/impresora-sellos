-- Migration 007: Restructure tariffs for dual-pricing, descriptions, and strip-tariff junction
--
-- Changes:
--   1. Add description column to tariffs
--   2. Rename price → local_price
--   3. Add secondary_price column to tariffs
--   4. Add local_currency and complementary_currency to tariff_groups
--   5. Migrate existing currency values to local_currency
--   6. Create strip_tariffs junction table
--   7. Migrate existing strip_count data to junction rows (best-effort)

-- Step 1: Add description column to tariffs
ALTER TABLE tariffs ADD COLUMN description TEXT NOT NULL DEFAULT '';

-- Step 2: Rename price → local_price (SQLite 3.25+ required; better-sqlite3 ships 3.40+)
ALTER TABLE tariffs RENAME COLUMN price TO local_price;

-- Step 3: Add secondary_price column to tariffs
ALTER TABLE tariffs ADD COLUMN secondary_price REAL NOT NULL DEFAULT 0;

-- Step 4: Add local_currency and complementary_currency columns to tariff_groups
ALTER TABLE tariff_groups ADD COLUMN local_currency TEXT NOT NULL DEFAULT 'EUR';
ALTER TABLE tariff_groups ADD COLUMN complementary_currency TEXT NOT NULL DEFAULT 'EUR';

-- Step 5: Migrate existing currency values to local_currency
UPDATE tariff_groups SET local_currency = currency WHERE currency IS NOT NULL AND currency != '';

-- Step 6: Create strip_tariffs junction table
CREATE TABLE IF NOT EXISTS strip_tariffs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    strip_id INTEGER NOT NULL,
    tariff_id INTEGER NOT NULL,
    FOREIGN KEY (strip_id) REFERENCES tariffs(id) ON DELETE CASCADE,
    FOREIGN KEY (tariff_id) REFERENCES tariffs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_strip_tariffs_strip_id ON strip_tariffs(strip_id);
CREATE INDEX IF NOT EXISTS idx_strip_tariffs_tariff_id ON strip_tariffs(tariff_id);

-- Unique constraint: a strip can reference a tariff only once
CREATE UNIQUE INDEX IF NOT EXISTS idx_strip_tariffs_unique ON strip_tariffs(strip_id, tariff_id);

-- Step 7: Migrate existing strip data (strip_count → junction entries).
-- Existing strips had strip_count indicating how many tariffs they cover.
-- Link them to the first N individual tariffs in the same group by position.
-- This is a best-effort migration for existing strips.
INSERT INTO strip_tariffs (strip_id, tariff_id)
SELECT s.id AS strip_id, t.id AS tariff_id
FROM tariffs s
JOIN tariffs t ON t.group_id = s.group_id
  AND t.type = 'individual'
  AND t.position <= s.strip_count
WHERE s.type = 'strip'
  AND s.strip_count IS NOT NULL
  AND s.strip_count >= 2;
