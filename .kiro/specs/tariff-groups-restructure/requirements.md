# Requirements Document

## Introduction

This feature restructures the tariff groups creation and editing workflow in the Settings view. The current system models tariffs with a single name and price, and strips as a count of individual tariffs. The new model introduces richer tariff entities (with description and dual pricing), strips that reference specific tariffs by selection, and tariff groups with dual currency headers. Changes to tariffs (rename, deletion) must propagate to any strips that reference them.

## Glossary

- **Tariff_Group**: A container entity identified by year, title, local currency, and complementary currency. It holds a set of Tariffs and Strips.
- **Tariff**: An individual pricing item within a Tariff_Group. Has a name, description, local price, and secondary price.
- **Strip**: A composite pricing item within a Tariff_Group. It references a subset of existing Tariffs and has its own name, description, local price, and secondary price.
- **Local_Currency**: The primary currency denomination for the Tariff_Group (e.g., EUR).
- **Complementary_Currency**: A secondary currency denomination for the Tariff_Group (e.g., USD).
- **Settings_View**: The application view where users manage configuration, including tariff groups.
- **TariffGroupSection**: The React component responsible for rendering and managing tariff group CRUD operations within the Settings_View.

## Requirements

### Requirement 1: Tariff Group Header Fields

**User Story:** As an administrator, I want to define a tariff group with year, title, local currency, and complementary currency, so that I can configure dual-currency pricing for an event year.

#### Acceptance Criteria

1. WHEN creating a Tariff_Group, THE TariffGroupSection SHALL present input fields for year, title, local currency, and complementary currency.
2. WHEN editing a Tariff_Group, THE TariffGroupSection SHALL display the existing year, title, local currency, and complementary currency values pre-filled in the form.
3. THE TariffGroupSection SHALL persist the local currency and complementary currency as separate fields in the Tariff_Group record.
4. IF the year field is empty or not a valid integer, THEN THE TariffGroupSection SHALL display a validation error message for the year field.
5. IF the title field is empty, THEN THE TariffGroupSection SHALL display a validation error message for the title field.
6. IF a Tariff_Group already exists for the specified year, THEN THE TariffGroupSection SHALL display a duplicate year validation error.

### Requirement 2: Individual Tariff Entity Fields

**User Story:** As an administrator, I want to define individual tariffs with name, description, local price, and secondary price, so that I can configure detailed pricing information for each tariff.

#### Acceptance Criteria

1. WHEN adding an individual Tariff, THE TariffGroupSection SHALL present input fields for name, description, local price, and secondary price.
2. THE TariffGroupSection SHALL persist name, description, local price, and secondary price for each Tariff in the database.
3. IF the name field is empty, THEN THE TariffGroupSection SHALL display a validation error indicating the name is required.
4. IF the name exceeds 16 characters, THEN THE TariffGroupSection SHALL display a validation error indicating the maximum length.
5. IF the local price is not a positive number, THEN THE TariffGroupSection SHALL display a validation error for the local price field.
6. IF the secondary price is not a positive number, THEN THE TariffGroupSection SHALL display a validation error for the secondary price field.
7. THE TariffGroupSection SHALL require at least 2 individual Tariffs per Tariff_Group.
8. THE TariffGroupSection SHALL allow a maximum of 20 individual Tariffs per Tariff_Group.

### Requirement 3: Strip Entity Fields

**User Story:** As an administrator, I want to define strips that reference a selection of existing tariffs and have their own pricing, so that I can create composite pricing packages.

#### Acceptance Criteria

1. WHEN adding a Strip, THE TariffGroupSection SHALL present input fields for name, description, local price, and secondary price.
2. WHEN adding a Strip, THE TariffGroupSection SHALL present a multi-select control listing all Tariffs currently defined in the same Tariff_Group.
3. THE TariffGroupSection SHALL require at least 2 Tariffs to be selected in a Strip's tariff set.
4. THE TariffGroupSection SHALL persist the association between a Strip and its selected Tariffs in the database.
5. IF the name field of a Strip is empty, THEN THE TariffGroupSection SHALL display a validation error indicating the name is required.
6. IF the name of a Strip exceeds 16 characters, THEN THE TariffGroupSection SHALL display a validation error indicating the maximum length.
7. IF the local price of a Strip is not a positive number, THEN THE TariffGroupSection SHALL display a validation error for the local price field.
8. IF the secondary price of a Strip is not a positive number, THEN THE TariffGroupSection SHALL display a validation error for the secondary price field.
9. IF fewer than 2 Tariffs are selected for a Strip, THEN THE TariffGroupSection SHALL display a validation error indicating insufficient tariff selection.

### Requirement 4: Tariff-Strip Referential Integrity

**User Story:** As an administrator, I want strips to automatically reflect changes to the tariffs they reference, so that my data stays consistent without manual updates.

#### Acceptance Criteria

1. WHEN a Tariff is renamed, THE System SHALL update the Tariff name as displayed in all Strips that reference the renamed Tariff.
2. WHEN a Tariff is deleted from a Tariff_Group, THE System SHALL remove the Tariff from the tariff set of all Strips that reference the deleted Tariff.
3. WHEN a Tariff deletion causes a Strip to have fewer than 2 Tariffs in its set, THE TariffGroupSection SHALL display a validation warning on the affected Strip.
4. WHILE the form contains a Strip with fewer than 2 referenced Tariffs, THE TariffGroupSection SHALL prevent saving the Tariff_Group.

### Requirement 5: Database Schema Migration

**User Story:** As a developer, I want the database schema to support the new tariff structure with descriptions, dual prices, and tariff-strip relationships, so that data integrity is enforced at the storage level.

#### Acceptance Criteria

1. THE System SHALL add a description column to the tariffs table.
2. THE System SHALL rename the existing price column to local_price in the tariffs table.
3. THE System SHALL add a secondary_price column to the tariffs table.
4. THE System SHALL add a local_currency column and a complementary_currency column to the tariff_groups table, replacing the single currency column.
5. THE System SHALL create a strip_tariffs junction table to store the many-to-many relationship between Strips and Tariffs.
6. THE System SHALL enforce a foreign key constraint from strip_tariffs to the tariffs table with CASCADE delete behavior.
7. WHEN a migration is applied to an existing database, THE System SHALL preserve existing tariff data by mapping the old price to local_price and setting secondary_price to 0.

### Requirement 6: IPC and Repository Layer Updates

**User Story:** As a developer, I want the IPC handlers and repository to support the new tariff structure, so that the frontend can create and edit tariffs with descriptions, dual prices, and strip-tariff associations.

#### Acceptance Criteria

1. THE TariffGroupsRepository SHALL accept and persist description, local_price, and secondary_price for each Tariff.
2. THE TariffGroupsRepository SHALL accept and persist description, local_price, secondary_price, and a list of referenced tariff IDs for each Strip.
3. THE TariffGroupsRepository SHALL accept and persist local_currency and complementary_currency for each Tariff_Group.
4. WHEN retrieving a Tariff_Group, THE TariffGroupsRepository SHALL include the full list of referenced Tariff IDs for each Strip.
5. WHEN deleting a Tariff that is referenced by a Strip, THE System SHALL remove the reference from the strip_tariffs junction table via CASCADE.
6. THE IPC handlers SHALL expose the updated create, update, and read operations with the new field structure.

### Requirement 7: UI Presentation and Interaction

**User Story:** As an administrator, I want a clear visual separation between individual tariffs and strips in the form, so that I can easily manage each type of pricing entity.

#### Acceptance Criteria

1. THE TariffGroupSection SHALL display individual Tariffs and Strips in visually distinct sections within the form.
2. WHEN the user adds a Strip, THE TariffGroupSection SHALL display the multi-select tariff picker populated with all current Tariffs in the group.
3. WHEN the list of Tariffs changes (addition or removal), THE TariffGroupSection SHALL update the available options in all Strip tariff pickers immediately.
4. THE TariffGroupSection SHALL display currency labels for price fields using the local_currency and complementary_currency values from the group header.
5. THE TariffGroupSection SHALL support all user interactions via keyboard navigation for accessibility.
6. THE TariffGroupSection SHALL use react-i18next translation keys for all user-visible text.
