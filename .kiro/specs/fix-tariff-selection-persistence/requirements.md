# Requirements Document

## Introduction

When a user edits tariffs in the "Configuración" tab (TariffGroupEditor), the current `TariffGroupsRepository.update()` method performs a DELETE + re-INSERT of all tariffs associated with the group. This generates new database IDs for every tariff and strip, causing events that store `selected_tariff_ids` and `selected_strip_ids` (referencing the old IDs) to become orphaned. This feature fixes the persistence issue by updating tariffs in-place (preserving IDs) and cleaning up orphaned references when tariffs are actually removed from a group.

## Glossary

- **TariffGroupsRepository**: The backend repository class responsible for CRUD operations on tariff groups and their associated tariffs and strips in the SQLite database.
- **EventosRepository**: The backend repository class responsible for CRUD operations on events (eventos), including their tariff selection fields.
- **Tariff**: An individual pricing entry within a tariff group, stored in the `tariffs` table with type `'individual'`.
- **Strip**: A composite pricing entry within a tariff group (type `'strip'`) that references multiple individual tariffs via the `strip_tariffs` junction table.
- **TariffGroup**: A named collection of tariffs and strips for a given year, stored in the `tariff_groups` table.
- **Event**: An entry in the `eventos` table representing a configured event/fair, which references a tariff group and stores selected tariff/strip IDs.
- **selected_tariff_ids**: A JSON array column in the `eventos` table containing the database IDs of individual tariffs selected for that event.
- **selected_strip_ids**: A JSON array column in the `eventos` table containing the database IDs of strips selected for that event.
- **In-place update**: Modifying an existing database row (preserving its primary key ID) rather than deleting and re-inserting it.

## Requirements

### Requirement 1: In-Place Tariff Update

**User Story:** As a kiosk operator, I want to edit tariff names and prices without losing the tariff selections already assigned to my active events, so that my event configuration remains intact after editing tariff details.

#### Acceptance Criteria

1. WHEN a tariff group is updated and an existing individual tariff has its name, description, local_price, or secondary_price modified, THE TariffGroupsRepository SHALL update the tariff row in-place, preserving the original database ID.
2. WHEN a tariff group is updated and an existing strip has its name, local_price, secondary_price, or tariff_ids composition modified, THE TariffGroupsRepository SHALL update the strip row in-place, preserving the original database ID.
3. WHEN a tariff group is updated and a new individual tariff is added that did not exist previously, THE TariffGroupsRepository SHALL insert a new row in the `tariffs` table for that tariff.
4. WHEN a tariff group is updated and a new strip is added that did not exist previously, THE TariffGroupsRepository SHALL insert a new row in the `tariffs` table for that strip and create corresponding `strip_tariffs` junction rows.
5. WHEN a tariff group is updated and an existing individual tariff is removed from the group, THE TariffGroupsRepository SHALL delete that tariff row from the `tariffs` table.
6. WHEN a tariff group is updated and an existing strip is removed from the group, THE TariffGroupsRepository SHALL delete that strip row and its associated `strip_tariffs` junction rows from the database.

### Requirement 2: Orphaned Reference Cleanup

**User Story:** As a kiosk operator, I want deleted tariffs to be automatically removed from my event selections, so that my events do not reference non-existent tariffs.

#### Acceptance Criteria

1. WHEN a tariff is deleted from a tariff group during an update, THE System SHALL remove that tariff's ID from the `selected_tariff_ids` JSON array in all events that reference it.
2. WHEN a strip is deleted from a tariff group during an update, THE System SHALL remove that strip's ID from the `selected_strip_ids` JSON array in all events that reference it.
3. WHEN orphaned IDs are cleaned from an event's selection arrays, THE System SHALL update the `updated_at` timestamp of the affected event rows.
4. WHEN no tariffs or strips are deleted during a tariff group update, THE System SHALL leave all event `selected_tariff_ids` and `selected_strip_ids` arrays unchanged.

### Requirement 3: Strip Junction Synchronization

**User Story:** As a kiosk operator, I want the composition of a strip (which individual tariffs it contains) to be updated correctly when I modify it, so that the strip accurately reflects its component tariffs.

#### Acceptance Criteria

1. WHEN a strip's tariff_ids composition changes during an update, THE TariffGroupsRepository SHALL delete the existing `strip_tariffs` junction rows for that strip and re-insert the new composition.
2. WHEN a strip's tariff_ids references individual tariffs by position, THE TariffGroupsRepository SHALL resolve positions to the correct database IDs (including IDs of newly inserted tariffs within the same transaction).
3. WHEN a strip references repeated tariffs (e.g., 4 copies of the same tariff), THE TariffGroupsRepository SHALL store a single `strip_tariffs` junction row with the appropriate `quantity` value.

### Requirement 4: Frontend Tariff Identity Propagation

**User Story:** As a kiosk operator, I want the tariff editor to send existing tariff IDs to the backend when saving, so that the backend can determine which tariffs to update in-place versus which to create new.

#### Acceptance Criteria

1. WHEN the TariffGroupEditor submits an update for an existing tariff group, THE TariffGroupEditor SHALL include the database `id` field for each tariff and strip that already exists in the database.
2. WHEN a new tariff or strip is added in the editor (not yet persisted), THE TariffGroupEditor SHALL omit the `id` field or set it to `undefined` for that entry.
3. WHEN the update input is received by the TariffGroupsRepository, THE TariffGroupsRepository SHALL treat entries with a valid existing `id` as in-place updates and entries without an `id` as new insertions.

### Requirement 5: Transactional Integrity

**User Story:** As a system administrator, I want tariff group updates (including orphan cleanup) to execute atomically, so that a partial failure does not leave the database in an inconsistent state.

#### Acceptance Criteria

1. THE TariffGroupsRepository SHALL execute all operations within the update method (in-place updates, insertions, deletions, and orphan cleanup) inside a single database transaction.
2. IF an error occurs during any step of the tariff group update transaction, THEN THE TariffGroupsRepository SHALL roll back all changes and leave the database in its pre-update state.
3. THE TariffGroupsRepository SHALL complete the orphaned reference cleanup within the same transaction as the tariff deletions, ensuring no window exists where events reference deleted tariffs.
