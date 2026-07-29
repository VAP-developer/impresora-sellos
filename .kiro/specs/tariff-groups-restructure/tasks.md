# Implementation Plan: Tariff Groups Restructure

## Overview

Restructure the tariff groups system to support dual-currency pricing, tariff descriptions, and strip-tariff associations via a junction table. Implementation follows the established architecture: SQLite migration → Repository → IPC Handlers → TypeScript types → Zustand Store → React UI → i18n.

## Tasks

- [x] 1. Database migration 007: Restructure schema for dual-pricing and strip references
  - [x] 1.1 Create migration file `src/main/database/migrations/007_tariff_groups_restructure.sql`
    - Add `description` column (TEXT NOT NULL DEFAULT '') to `tariffs` table
    - Rename `price` column to `local_price` via ALTER TABLE RENAME COLUMN
    - Add `secondary_price` column (REAL NOT NULL DEFAULT 0) to `tariffs` table
    - Add `local_currency` (TEXT NOT NULL DEFAULT 'EUR') and `complementary_currency` (TEXT NOT NULL DEFAULT 'EUR') columns to `tariff_groups` table
    - Migrate existing `currency` values to `local_currency`
    - Create `strip_tariffs` junction table with `strip_id`, `tariff_id`, foreign keys with CASCADE delete, unique index on (strip_id, tariff_id)
    - Best-effort migration of existing strip data (strip_count → junction rows linking first N tariffs by position)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 1.2 Write unit tests for migration 007
    - Test migration applies cleanly on top of 006
    - Test existing price data is preserved as local_price
    - Test secondary_price defaults to 0 for existing rows
    - Test strip_count data migrated to strip_tariffs junction rows
    - Test cascade delete behavior on strip_tariffs
    - Create test file: `src/main/database/__tests__/migration-007.test.ts`
    - _Requirements: 5.2, 5.6, 5.7_

- [x] 2. Update repository layer with new data model
  - [x] 2.1 Restructure TypeScript types in `src/main/database/repositories/tariff-groups.repository.ts`
    - Update `Tariff` interface: add `description`, rename `price` to `local_price`, add `secondary_price`, remove `strip_count`
    - Add `Strip` interface with `name`, `description`, `local_price`, `secondary_price`, `position`, `type: 'strip'`, `tariff_ids: number[]`
    - Update `TariffGroup` interface: replace `currency` with `local_currency` + `complementary_currency`, separate `tariffs: Tariff[]` and `strips: Strip[]`
    - Update `TariffGroupInput`: add `local_currency`, `complementary_currency`, `strips: StripInput[]`, update tariff fields
    - Update `TariffGroupUpdateInput` similarly
    - Add `StripInput` interface with `name`, `description`, `local_price`, `secondary_price`, `position`, `tariff_ids: number[]`
    - Update error constants for new validation rules (INVALID_LOCAL_PRICE, INVALID_SECONDARY_PRICE, STRIP_MIN_TARIFFS)
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 2.2 Update validation logic in `TariffGroupsRepository.validate()`
    - Accept `strips: StripInput[]` parameter
    - Validate `local_currency` and `complementary_currency` (non-empty)
    - Validate tariff `description` (allowed to be empty string)
    - Validate `local_price` and `secondary_price` separately (both must be positive)
    - Validate each strip: name (1-16 chars), local_price > 0, secondary_price > 0, tariff_ids.length >= 2
    - Keep individual tariff cardinality validation [2, 20]
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 3.3, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [x] 2.3 Update `create()` method in TariffGroupsRepository
    - Insert group with `local_currency` and `complementary_currency`
    - Insert individual tariffs with `description`, `local_price`, `secondary_price`
    - Insert strip tariffs with `description`, `local_price`, `secondary_price`, type='strip'
    - Insert `strip_tariffs` junction rows linking each strip to its referenced tariffs
    - All within a single transaction
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 2.4 Update `update()` method in TariffGroupsRepository
    - Update group header with new currency fields
    - Delete existing tariffs and strip_tariffs rows (CASCADE handles junction)
    - Re-insert tariffs, strips, and junction rows
    - All within a single transaction
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 2.5 Update `_attachTariffs()` / read methods to return separate tariffs and strips
    - Query `strip_tariffs` for each strip to populate `tariff_ids`
    - Return `tariffs` (type='individual' only) and `strips` (type='strip' with tariff_ids) separately in the TariffGroup object
    - Update `getAll()`, `getById()`, `getByYear()` accordingly
    - _Requirements: 6.4_

  - [ ]* 2.6 Write property tests for repository (Properties 1-9)
    - **Property 1: TariffGroup data round-trip** — create group, retrieve by ID, verify all header and tariff fields preserved
    - **Validates: Requirements 1.2, 1.3, 2.2, 6.1, 6.3**
    - **Property 2: Strip-tariff association round-trip** — create group with strips referencing tariffs, verify tariff_ids match
    - **Validates: Requirements 3.4, 6.2, 6.4**
    - **Property 3: Year uniqueness enforcement** — attempt duplicate year, verify rejection
    - **Validates: Requirements 1.6**
    - **Property 4: Name validation** — test empty/whitespace/over-16-char names rejected, valid names pass
    - **Validates: Requirements 2.3, 2.4, 3.5, 3.6**
    - **Property 5: Price validation** — test ≤0, NaN, non-finite prices rejected for both local and secondary
    - **Validates: Requirements 2.5, 2.6, 3.7, 3.8**
    - **Property 6: Individual tariff cardinality bounds** — <2 rejected, >20 rejected, [2,20] passes
    - **Validates: Requirements 2.7, 2.8**
    - **Property 7: Strip minimum tariff selection** — <2 tariff_ids rejected, ≥2 passes
    - **Validates: Requirements 3.3, 3.9, 4.3, 4.4**
    - **Property 8: CASCADE deletion of strip-tariff references** — delete tariff, verify junction rows removed
    - **Validates: Requirements 4.2, 5.6, 6.5**
    - **Property 9: Year field validation** — non-integer rejected, valid integer passes
    - **Validates: Requirements 1.4**
    - Create test file: `src/main/database/__tests__/tariff-groups-restructure.property.test.ts`

- [ ] 3. Checkpoint - Ensure all database and repository tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update IPC handlers and preload types
  - [x] 4.1 Update IPC handlers in `src/main/ipc/tariff-groups.handlers.ts`
    - Same channels (`tariff-groups:create`, `tariff-groups:update`, etc.) with updated payload types
    - Import new `TariffGroupInput`, `TariffGroupUpdateInput` types from repository
    - No channel signature changes needed (handlers pass through to repository)
    - _Requirements: 6.6_

  - [x] 4.2 Update preload type definitions for the tariffGroups bridge
    - Update the `tariffGroups` section in `src/preload/index.d.ts` (or equivalent) to reflect new input/output types
    - Ensure `TariffGroup` response includes `local_currency`, `complementary_currency`, `tariffs`, `strips`
    - _Requirements: 6.6_

  - [ ]* 4.3 Write integration tests for IPC with new structure
    - Test create with dual pricing and strips via IPC channel
    - Test update with modified strips
    - Test read returns separate tariffs and strips with tariff_ids
    - Create test file: `src/main/ipc/__tests__/tariff-groups-restructure.integration.test.ts`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6_

- [x] 5. Update renderer TypeScript types in ipc-client
  - [x] 5.1 Update types in `src/renderer/src/lib/ipc-client.ts`
    - Update `Tariff` interface: add `description`, replace `price` with `local_price` and `secondary_price`
    - Add `Strip` interface with `name`, `description`, `local_price`, `secondary_price`, `position`, `type: 'strip'`, `tariff_ids: number[]`
    - Update `TariffGroup`: replace `currency` with `local_currency` + `complementary_currency`, add `strips: Strip[]`
    - Update `TariffGroupInput`: add `local_currency`, `complementary_currency`, `strips: StripInput[]`
    - Add `StripInput` interface
    - Update `TariffGroupUpdateInput` accordingly
    - Export all new types
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 6. Update Zustand store for new data shape
  - [x] 6.1 Update `src/renderer/src/stores/tariff-groups.store.ts`
    - Update state type to use new `TariffGroup` interface (with `tariffs` and `strips` arrays)
    - No logic changes needed — store is a thin layer over IPC calls
    - Ensure type compatibility with new `TariffGroupInput` and `TariffGroupUpdateInput`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 7. Checkpoint - Ensure type changes compile without errors
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Refactor TariffGroupSection UI component
  - [x] 8.1 Update form state and types in `TariffGroupSection.tsx`
    - Replace `TariffFormRow` with separate `TariffFormRow` (name, description, local_price, secondary_price) and `StripFormRow` (name, description, local_price, secondary_price, selected_tariff_indices)
    - Update `FormState` to have `local_currency`, `complementary_currency`, `tariffs: TariffFormRow[]`, `strips: StripFormRow[]`
    - Update `groupToFormState()` to map new TariffGroup shape
    - Update `initialFormState()` with dual currency and empty strips array
    - _Requirements: 1.1, 1.2, 7.1_

  - [x] 8.2 Implement TariffListPanel section
    - Render individual tariffs in a visually distinct section with header
    - Each row: name input (max 16), description input, local_price input, secondary_price input
    - Display currency labels from form header (local_currency / complementary_currency)
    - Add/remove individual tariff buttons
    - Enforce [2, 20] cardinality constraints in UI
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 7.1, 7.4_

  - [x] 8.3 Create TariffMultiSelect component
    - Create `src/renderer/src/components/settings/TariffMultiSelect.tsx`
    - Checkbox-based multi-select displaying all current individual tariffs by name
    - Props: `tariffs: TariffFormRow[]`, `selectedIndices: number[]`, `onChange: (indices: number[]) => void`
    - Show validation error when fewer than 2 selected
    - Accessible with keyboard navigation (tabbing through checkboxes)
    - _Requirements: 3.2, 7.2, 7.5_

  - [x] 8.4 Implement StripListPanel section
    - Render strips in a visually distinct section (separate from tariffs)
    - Each row: name input, description input, local_price, secondary_price, TariffMultiSelect
    - Add/remove strip buttons
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 7.1_

  - [x] 8.5 Implement dual currency selectors in form header
    - Replace single CurrencySelector with two: one for local_currency, one for complementary_currency
    - Labels: translated "Local Currency" and "Complementary Currency"
    - _Requirements: 1.1, 1.3, 7.4_

  - [x] 8.6 Update client-side validation logic
    - Validate dual prices (local_price > 0, secondary_price > 0) for tariffs and strips
    - Validate strip tariff selection (≥ 2 per strip)
    - When a tariff is removed, filter it from all strip selections and show warning if strip drops below 2
    - Disable save when any strip has < 2 tariffs
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 8.7 Update `handleSave()` to build new input shape
    - Build `TariffGroupInput` / `TariffGroupUpdateInput` with `local_currency`, `complementary_currency`, `tariffs` (with description, local_price, secondary_price), and `strips` (with tariff_ids resolved from indices)
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 8.8 Update list mode rendering for new data shape
    - Display `local_currency` / `complementary_currency` instead of single currency
    - Show tariff count and strip count separately
    - _Requirements: 7.1_

  - [ ]* 8.9 Write property test for strip tariff picker (Property 10)
    - **Property 10: Strip tariff picker reflects current tariff list**
    - For any form state with N tariffs, derived picker options === those N tariffs
    - Adding/removing a tariff updates picker options immediately
    - **Validates: Requirements 3.2, 7.2, 7.3**
    - Create test file: `src/renderer/src/__tests__/strip-picker-options.property.test.ts`

- [x] 9. Update i18n translation keys
  - [x] 9.1 Add new translation keys for dual-currency and strip fields
    - Add keys for: `settings.localCurrency`, `settings.complementaryCurrency`, `settings.description`, `settings.localPrice`, `settings.secondaryPrice`, `settings.strips`, `settings.addStrip`, `settings.selectTariffs`, `settings.stripTariffWarning`
    - Add validation keys: `validation.localPricePositive`, `validation.secondaryPricePositive`, `validation.stripMinTariffs`, `validation.localCurrencyRequired`, `validation.complementaryCurrencyRequired`
    - Update both `es` and `en` translation objects
    - _Requirements: 7.6_

- [x] 10. Final checkpoint - Ensure all tests pass and no type errors
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The migration preserves all existing data (price → local_price, secondary_price = 0)
- The deprecated `currency` and `strip_count` columns are kept for backward compatibility
