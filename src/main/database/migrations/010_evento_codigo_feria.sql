-- Migration 010: Add codigo_feria_1 and codigo_feria_2 columns to eventos table.
-- These fields store the configurable fair code that appears on stamp labels (line 1).
-- codigo_feria_1: up to 4 characters (e.g., "J26", "CH17")
-- codigo_feria_2: up to 3 characters (e.g., "8GI", "4ES")

ALTER TABLE eventos ADD COLUMN codigo_feria_1 TEXT NOT NULL DEFAULT '';
ALTER TABLE eventos ADD COLUMN codigo_feria_2 TEXT NOT NULL DEFAULT '';
