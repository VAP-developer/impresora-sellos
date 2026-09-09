-- Migration 014: Add currency symbol position flags to tariff_groups
--
-- These booleans control whether the currency symbol is printed BEFORE the
-- price (e.g. "$10.00") or AFTER it (e.g. "10.00$") in the kiosko tab and the
-- printed tickets.
--
-- 0 = symbol AFTER the price (legacy behavior, e.g. "10.00€")
-- 1 = symbol BEFORE the price (e.g. "€10.00")
--
-- Default 0 preserves the existing symbol-after rendering for all groups.

ALTER TABLE tariff_groups ADD COLUMN local_currency_symbol_before INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tariff_groups ADD COLUMN complementary_currency_symbol_before INTEGER NOT NULL DEFAULT 0;
