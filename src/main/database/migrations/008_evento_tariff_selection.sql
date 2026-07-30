-- Migration 008: Add tariff selection to eventos
--
-- Allows each event to select a subset of tariffs and strips from its associated tariff group
-- Maximum 6 individual tariffs and 2 strips can be selected per event

-- Add columns to store selected tariff and strip IDs as JSON arrays
ALTER TABLE eventos ADD COLUMN selected_tariff_ids TEXT DEFAULT '[]';
ALTER TABLE eventos ADD COLUMN selected_strip_ids TEXT DEFAULT '[]';

-- Add validation comment (enforced in application layer):
-- selected_tariff_ids: JSON array of up to 6 tariff IDs from the event's tariff_group_id
-- selected_strip_ids: JSON array of up to 2 strip IDs from the event's tariff_group_id
