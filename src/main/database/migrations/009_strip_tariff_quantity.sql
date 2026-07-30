-- Migration 009: Support repeating the same tariff within a strip
--
-- Problem:
--   strip_tariffs has a UNIQUE(strip_id, tariff_id) index, so a strip that repeats
--   the same tariff (e.g. "4 x Tarifa A") could only store a single junction row.
--   The multiplicity chosen in the UI was silently lost on save.
--
-- Solution:
--   Keep one junction row per (strip_id, tariff_id) and store how many times the
--   tariff appears in the strip in a new `quantity` column. The application layer
--   expands this back into a repeated tariff_ids array when reading.

ALTER TABLE strip_tariffs ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;

-- Existing rows keep quantity = 1, which matches the previous (deduplicated) behaviour.
