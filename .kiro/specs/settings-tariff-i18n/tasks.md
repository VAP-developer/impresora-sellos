# Implementation Plan: Settings, Tariff Evolution & i18n

## Overview

This plan implements a centralized Settings view, evolves the tariff groups system to support differentiated types (individual and strip), adds a unique-per-year constraint, introduces a cut number for label grouping, and sets up internationalization (es/en). The implementation follows the existing architecture: SQLite → Repository → IPC Handlers → Preload Bridge → Zustand Store → React Components.

## Tasks

- [ ] 1. Database migration 006: tariff types, strip_count, and unique year constraint
  - [x] 1.1 Create migration file `src/main/database/migrations/006_tariff_types_and_settings.sql`
    - Add `type TEXT NOT NULL DEFAULT 'individual'` column to `tariffs` table
    - Add `strip_count INTEGER` nullable column to `tariffs` table
    - Drop existing `idx_tariff_groups_year_title` unique index
    - Create new `idx_tariff_groups_year` unique index on `tariff_groups(year)` only
    - Existing data migrates automatically via DEFAULT clause (all become 'individual')
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ]* 1.2 Write unit test for migration 006 application
    - Test in `src/main/database/__tests__/migration-006.test.ts`
    - Verify migration applies successfully on top of 005
    - Verify existing tariffs get type='individual' after migration
    - Verify unique year constraint rejects duplicate years
    - Verify strip_count column accepts NULL for individual tariffs
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 2. Evolve TariffGroupsRepository with type-aware validation
  - [x] 2.1 Update types and validation in `src/main/database/repositories/tariff-groups.repository.ts`
    - Add `TariffType = 'individual' | 'strip'` type export
    - Extend `Tariff` interface with `type: TariffType` and optional `strip_count?: number`
    - Extend `TariffInput` interface with `type: TariffType` and optional `strip_count?: number`
    - Update `TARIFF_GROUP_ERRORS` constant with new error codes: `DUPLICATE_YEAR`, `MIN_INDIVIDUAL_TARIFFS`, `MAX_INDIVIDUAL_TARIFFS`, `STRIP_COUNT_MIN`, `STRIP_COUNT_EXCEEDS_TOTAL`
    - Update `validate()` to count only individual tariffs (2-20 range), validate strip_count ≥ 2, validate strip_count ≤ total individuals
    - Update `_attachTariffs()` to include `type` and `strip_count` fields from DB
    - Update `create()` to insert `type` and `strip_count` columns
    - Update `update()` to insert `type` and `strip_count` on re-insert
    - Change UNIQUE constraint error to `DUPLICATE_YEAR` message
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.3, 3.5, 3.7, 4.1-4.9, 4.10_

  - [ ]* 2.2 Write property test: Uniqueness per year (Property 1)
    - **Property 1: Uniqueness per year (create and update)**
    - File: `src/main/database/__tests__/tariff-groups-evolved.property.test.ts`
    - For any year, creating two groups with the same year is rejected
    - For any existing group, updating year to match another group is rejected
    - Use fast-check with ≥100 iterations
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [ ]* 2.3 Write property test: Tariff type differentiation round-trip (Property 2)
    - **Property 2: Round trip consistency for mixed types**
    - File: `src/main/database/__tests__/tariff-groups-evolved.property.test.ts`
    - For any valid input with individual + strip tariffs, create then getById returns identical data
    - Verify type, strip_count, name, price, position, currency all preserved
    - Use fast-check with ≥100 iterations
    - **Validates: Requirements 3.1, 3.7, 5.5**

  - [ ]* 2.4 Write property test: Individual tariff cardinality bounds (Property 3)
    - **Property 3: Cardinality validation for individual tariffs**
    - File: `src/main/database/__tests__/tariff-groups-evolved.property.test.ts`
    - For any input with <2 or >20 individual tariffs, validation rejects
    - For any input with 2-20 individual tariffs (valid fields), validation passes
    - Use fast-check with ≥100 iterations
    - **Validates: Requirements 3.3, 3.4, 3.5**

  - [ ]* 2.5 Write property test: Name validation (Property 4)
    - **Property 4: Name validation for tariffs and strips**
    - File: `src/main/database/__tests__/tariff-groups-evolved.property.test.ts`
    - For any tariff/strip with empty name or name >16 chars, validation rejects
    - For any name 1-16 chars, name validation passes
    - Use fast-check with ≥100 iterations
    - **Validates: Requirements 4.1, 4.2, 4.5, 4.6**

  - [ ]* 2.6 Write property test: Price validation (Property 5)
    - **Property 5: Price validation for tariffs and strips**
    - File: `src/main/database/__tests__/tariff-groups-evolved.property.test.ts`
    - For any tariff/strip with price ≤ 0, NaN, or non-finite, validation rejects
    - For any positive finite price, validation passes
    - Use fast-check with ≥100 iterations
    - **Validates: Requirements 4.3, 4.4, 4.7**

  - [ ]* 2.7 Write property test: Strip count validation (Property 6)
    - **Property 6: Strip count bounds**
    - File: `src/main/database/__tests__/tariff-groups-evolved.property.test.ts`
    - For any strip with strip_count < 2, validation rejects
    - For any strip with strip_count > number of individuals in group, validation rejects
    - For strip_count in [2, N] where N = individual count, validation passes
    - Use fast-check with ≥100 iterations
    - **Validates: Requirements 4.8, 4.9**

- [ ] 3. Extend ConfigRepository with cutNumber and language settings
  - [x] 3.1 Add settings methods to `src/main/database/repositories/config.repository.ts`
    - Add `AppLanguage = 'es' | 'en'` type export
    - Add `GlobalSettings` interface with `cutNumber` and `language` fields
    - Add `getCutNumber(): number` method (returns `settings.cutNumber` from JSON, default 4)
    - Add `setCutNumber(value: number): void` method (validates 2-16 range)
    - Add `getLanguage(): AppLanguage` method (returns `settings.language` from JSON, default 'es')
    - Add `setLanguage(value: AppLanguage): void` method (validates 'es' or 'en')
    - Add `CONFIG_ERRORS` constant with `CUT_NUMBER_OUT_OF_RANGE` and `INVALID_LANGUAGE`
    - Reads/writes only the `settings` sub-object of the config JSON blob
    - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.6_

  - [ ]* 3.2 Write property test: Cut number persistence and range (Property 7)
    - **Property 7: Cut number persistence and range validation**
    - File: `src/main/database/__tests__/config-settings.property.test.ts`
    - For any integer in [2, 16], setCutNumber then getCutNumber returns same value
    - For any integer outside [2, 16], setCutNumber throws error, stored value unchanged
    - Use fast-check with ≥100 iterations
    - **Validates: Requirements 6.4, 8.1, 11.2, 11.5**

  - [ ]* 3.3 Write property test: Language config validation (Property 9)
    - **Property 9: Language config round-trip and rejection**
    - File: `src/main/database/__tests__/config-settings.property.test.ts`
    - For any string not "es"/"en", setLanguage throws error
    - For "es" or "en", setLanguage then getLanguage returns the set value
    - Use fast-check with ≥100 iterations
    - **Validates: Requirements 7.4, 8.2, 11.4, 11.6**

- [x] 4. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. IPC handler updates for new config channels
  - [x] 5.1 Add new IPC handlers to `src/main/ipc/config.handlers.ts`
    - Add handler for `config:getCutNumber` channel
    - Add handler for `config:setCutNumber` channel (with validation)
    - Add handler for `config:getLanguage` channel
    - Add handler for `config:setLanguage` channel (with validation)
    - Follow existing pattern: call repo method, return result
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [ ]* 5.2 Write integration test for new config IPC channels
    - File: `src/main/ipc/__tests__/config-settings.handlers.test.ts`
    - Test getCutNumber returns default 4 when unset
    - Test setCutNumber persists and getCutNumber retrieves it
    - Test setCutNumber rejects out-of-range values
    - Test getLanguage returns default 'es' when unset
    - Test setLanguage persists and getLanguage retrieves it
    - Test setLanguage rejects invalid values
    - _Requirements: 11.1-11.6_

- [ ] 6. Update preload bridge with new config methods
  - [x] 6.1 Extend `ElectronAPI` interface and implementation in `src/preload/index.ts`
    - Add `getCutNumber(): Promise<number>` to `config` section of `ElectronAPI`
    - Add `setCutNumber(value: number): Promise<void>` to `config` section
    - Add `getLanguage(): Promise<string>` to `config` section
    - Add `setLanguage(value: string): Promise<void>` to `config` section
    - Add corresponding `ipcRenderer.invoke` calls in the `api` implementation
    - _Requirements: 11.1-11.4, 8.4_

- [ ] 7. Implement label grouping utility function
  - [x] 7.1 Create `src/main/printing/label-grouping.ts`
    - Export `groupLabels<T>(items: T[], cutNumber: number): T[][]` function
    - Splits array into chunks of size `cutNumber`
    - Last chunk may be smaller if not evenly divisible
    - Validates cutNumber is in [2, 16] range
    - Concatenation of all groups equals original array in order
    - _Requirements: 6.5, 6.6, 9.1, 9.2_

  - [ ]* 7.2 Write property test: Label grouping (Property 8)
    - **Property 8: Label grouping correctness**
    - File: `src/main/printing/__tests__/label-grouping.property.test.ts`
    - For any array of N items (N ≥ 1) and any K in [2, 16]:
      - Produces exactly ⌈N/K⌉ groups
      - Each group except last has K elements
      - Last group has N mod K elements (or K if divisible)
      - Concatenation of groups equals original array
    - Use fast-check with ≥100 iterations
    - **Validates: Requirements 6.5, 6.6, 9.1, 9.2**

- [ ] 8. Integrate label grouping into PDF generator
  - [x] 8.1 Update `src/main/printing/pdf-generator.ts` to use `groupLabels`
    - Import `groupLabels` from `./label-grouping`
    - Import `ConfigRepository` to read `cutNumber` at generation time
    - For dynamic tariff stamp generation: group stamps by cutNumber before calling `renderStampMultiPage`
    - Each group becomes a separate multi-page PDF (with cut marks between groups)
    - Legacy static tariff flow: apply groupLabels to simple stamp arrays similarly
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 9. Checkpoint - Ensure all backend + printing tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Set up i18n with react-i18next
  - [x] 10.1 Install react-i18next and i18next dependencies
    - Add `i18next` and `react-i18next` packages
    - _Requirements: 7.1, 12.1_

  - [x] 10.2 Create i18n configuration at `src/renderer/src/i18n/i18n.ts`
    - Initialize i18next with react-i18next plugin
    - Configure with resources from es.json and en.json
    - Default language 'es', fallback 'es'
    - Set `parseMissingKeyHandler` to return key as fallback
    - Export initialized i18n instance
    - _Requirements: 7.1, 7.5, 7.6, 12.3_

  - [x] 10.3 Create Spanish translation file `src/renderer/src/i18n/locales/es.json`
    - Define hierarchical keys: nav, settings, validation, errors sections
    - Include all static UI text translations in Spanish
    - _Requirements: 7.7, 12.1, 12.2_

  - [x] 10.4 Create English translation file `src/renderer/src/i18n/locales/en.json`
    - Mirror all keys from es.json with English translations
    - _Requirements: 7.7, 12.1, 12.2, 12.5_

  - [x] 10.5 Import i18n setup in renderer entry point
    - Import `./i18n/i18n` in the main renderer file to initialize i18n
    - _Requirements: 7.5, 12.4_

  - [ ]* 10.6 Write property test: i18n missing key fallback (Property 10)
    - **Property 10: Missing key returns key as fallback**
    - File: `src/renderer/src/__tests__/i18n-fallback.property.test.ts`
    - For any key string not in translation file, t(key) returns the key itself
    - Use fast-check with ≥100 iterations
    - **Validates: Requirements 12.3**

- [ ] 11. Create Settings Zustand store
  - [x] 11.1 Create `src/renderer/src/stores/settings.store.ts`
    - Define `SettingsState` interface with `cutNumber`, `language`, `loading`, `error`
    - Implement `loadSettings()` action: calls getCutNumber and getLanguage via preload bridge
    - Implement `setCutNumber(value)` action: calls setCutNumber via preload bridge
    - Implement `setLanguage(value)` action: calls setLanguage via preload bridge, then `i18n.changeLanguage(value)`
    - Follow existing store patterns (Zustand create)
    - _Requirements: 1.3, 7.3, 7.4, 8.3_

- [ ] 12. Build Settings view and components
  - [x] 12.1 Create `CurrencySelector` component at `src/renderer/src/components/settings/CurrencySelector.tsx`
    - Use Radix Select component (already installed)
    - Render predefined CURRENCIES list (EUR, USD, GBP, CHF, JPY, CNY, MXN, ARS, COP, BRL)
    - Each option shows code + symbol (e.g., "EUR €")
    - Preselect current currency value from props
    - Only allow selection from list (no free text)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

  - [x] 12.2 Create `CutNumberSection` component at `src/renderer/src/components/settings/CutNumberSection.tsx`
    - Numeric input field for cut number (2-16)
    - Client-side validation with translated error messages
    - Save button that calls store action
    - Display current value from store
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 12.3 Create `LanguageSection` component at `src/renderer/src/components/settings/LanguageSection.tsx`
    - Selector with "Español" and "English" options
    - On change: call store setLanguage action (persists + changes i18n)
    - No app restart needed
    - _Requirements: 7.2, 7.3_

  - [x] 12.4 Create `TariffGroupSection` component at `src/renderer/src/components/settings/TariffGroupSection.tsx`
    - List existing tariff groups organized by year
    - Show which years have groups assigned
    - Create/edit/delete actions
    - Integrate `CurrencySelector` for currency selection
    - Support differentiated types: individual tariffs and strips
    - Show strip_count selector for strip type tariffs
    - Client-side validation (2-20 individuals, name 1-16, price > 0, strip_count 2-N)
    - _Requirements: 1.4, 2.4, 3.2, 3.4, 3.5, 3.6, 4.1-4.9_

  - [x] 12.5 Create `SettingsView` at `src/renderer/src/views/SettingsView.tsx`
    - Main view with three clearly differentiated sections
    - Section 1: Tariff Groups (TariffGroupSection)
    - Section 2: Cut Number (CutNumberSection)
    - Section 3: Language (LanguageSection)
    - Load current values on mount via stores
    - Use `useTranslation` hook for all static text
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 12.6 Add Settings route and navigation link
    - Add `/settings` route in the router configuration
    - Add navigation link to Settings in the sidebar/navigation component
    - Use translated label from i18n
    - _Requirements: 1.1_

- [x] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Final wiring and integration
  - [x] 14.1 Load persisted language on app startup
    - On renderer mount, call `settingsStore.loadSettings()` to fetch language from backend
    - Call `i18n.changeLanguage(language)` with the persisted value
    - Ensures language persists between sessions
    - _Requirements: 7.4, 7.5, 7.6_

  - [x] 14.2 Apply i18n translations to existing navigation and view titles
    - Update existing navigation component to use `t()` for labels
    - Update existing view titles to use translated strings
    - Keep dynamic user data untranslated (event names, tariff names, group titles)
    - _Requirements: 7.7, 7.8_

  - [ ]* 14.3 Write integration tests for Settings view
    - Test SettingsView renders all 3 sections
    - Test CurrencySelector shows all 10 required currencies
    - Test language selector changes i18n language without reload
    - Test cut number input validates range
    - _Requirements: 1.2, 1.3, 5.3, 7.3_

- [x] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit/integration tests validate specific examples and edge cases
- The project uses TypeScript with React, Zustand, and Radix UI components
- fast-check v4.8.0 is already installed as a dev dependency
- Vitest is the test runner (`vitest run` for single execution)
