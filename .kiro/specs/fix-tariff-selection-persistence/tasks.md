# Implementation Plan: Fix Tariff Selection Persistence

## Overview

Refactor the tariff group update flow from DELETE+re-INSERT to a diff-based approach that preserves existing tariff/strip database IDs. This involves adding an optional `id` field to input types, rewriting the repository's `update()` method with in-place logic, adding orphaned reference cleanup for events, and propagating IDs from the frontend editor.

## Tasks

- [x] 1. Add optional `id` field to TariffInput and StripInput types
  - [x] 1.1 Update `TariffInput` and `StripInput` interfaces in `src/main/database/repositories/tariff-groups.repository.ts`
    - Add `id?: number` field to `TariffInput` interface
    - Add `id?: number` field to `StripInput` interface
    - _Requirements: 4.3_

  - [x] 1.2 Update `TariffInput` and `StripInput` interfaces in `src/renderer/src/lib/ipc-client.ts`
    - Mirror the same `id?: number` additions in the frontend type definitions
    - _Requirements: 4.1, 4.2_

- [x] 2. Refactor `TariffGroupsRepository.update()` to diff-based logic
  - [x] 2.1 Implement in-place UPDATE for existing individual tariffs
    - Collect existing tariff IDs from the current group
    - For each incoming tariff with a valid `id` that exists in the group, run an UPDATE statement preserving the row's primary key
    - Build a `positionToId` map for resolving strip references later
    - _Requirements: 1.1, 1.3, 5.1_

  - [x] 2.2 Implement INSERT for new individual tariffs and DELETE for omitted tariffs
    - For incoming tariffs without an `id` (or with an `id` not in the existing set), INSERT a new row
    - Add newly inserted tariff IDs to the `positionToId` map
    - DELETE tariffs whose IDs exist in the DB but are absent from the incoming set
    - Track deleted tariff IDs for orphan cleanup
    - _Requirements: 1.3, 1.5, 5.1_

  - [x] 2.3 Implement in-place UPDATE, INSERT, and DELETE for strips
    - For existing strips with a matching `id`, UPDATE the strip row in-place
    - Re-sync `strip_tariffs` junction rows: delete old junction rows for the strip, insert new ones using the `positionToId` map with quantity collapsing
    - For new strips (no `id`), INSERT and create junction rows
    - DELETE strips whose IDs are absent from the incoming set (including their junction rows)
    - Track deleted strip IDs for orphan cleanup
    - _Requirements: 1.2, 1.4, 1.6, 3.1, 3.2, 3.3, 5.1_

  - [x] 2.4 Implement `cleanOrphanedIds()` private method
    - Query all events referencing the tariff group (`tariff_group_id`)
    - For each event, parse `selected_tariff_ids` and `selected_strip_ids` JSON arrays
    - Filter out any deleted tariff/strip IDs
    - Update affected event rows with the filtered arrays and refresh `updated_at`
    - Skip events where no IDs were removed
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 2.5 Wire diff-based logic into a single transaction
    - Wrap all operations (metadata update, tariff upserts, strip upserts, junction sync, orphan cleanup) inside `this.db.transaction()`
    - Call `cleanOrphanedIds()` only when `deletedTariffIds` or `deletedStripIds` are non-empty
    - On any error, `better-sqlite3` transaction wrapper automatically rolls back
    - Remove the old DELETE+re-INSERT logic
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 2.6 Write property tests for the diff-based update logic
    - **Property 1: ID Preservation on In-Place Update**
    - **Property 2: New Entry Insertion**
    - **Property 3: Deletion of Omitted Entries**
    - **Property 4: Orphaned ID Cleanup**
    - **Property 5: Non-Deletion Preserves Event Selections**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.5, 2.1, 2.2, 2.4**

  - [ ]* 2.7 Write unit tests for strip junction synchronization
    - **Property 6: Strip Junction Synchronization**
    - **Property 7: Position-to-ID Resolution**
    - **Property 8: Quantity Collapsing for Repeated Tariffs**
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 3. Checkpoint - Verify backend logic
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update TariffGroupEditor to propagate existing IDs
  - [x] 4.1 Add `id` field to the internal `TariffFormRow` interface and strip form state
    - Add `id?: number` to `TariffFormRow` interface
    - Add `id?: number` to the strip form state type
    - In edit mode, initialize form rows from `group.tariffs` and `group.strips` including their `id` values
    - _Requirements: 4.1, 4.2_

  - [x] 4.2 Propagate `id` in the `handleSave` / update payload builder
    - When building `tariffInputs` for the update call, include `id: t.id` from the form row (will be `undefined` for newly added tariffs)
    - When building `stripInputs` for the update call, include `id: s.id` from the form row
    - _Requirements: 4.1, 4.2_

- [x] 5. Final checkpoint - End-to-end verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The IPC handler (`tariff-groups.handlers.ts`) needs no changes — it already passes the input object through transparently
- The `better-sqlite3` transaction wrapper guarantees automatic rollback on any thrown error, satisfying Requirement 5

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "4.1"] },
    { "id": 2, "tasks": ["2.2", "2.3"] },
    { "id": 3, "tasks": ["2.4", "2.5"] },
    { "id": 4, "tasks": ["2.6", "2.7", "4.2"] }
  ]
}
```
