# Design Document: Fix Tariff Selection Persistence

## Overview

The current `TariffGroupsRepository.update()` method performs a DELETE + re-INSERT cycle for all tariffs/strips in a group. This regenerates database IDs, breaking references held by events in `selected_tariff_ids` and `selected_strip_ids`. The fix refactors the update logic to an in-place diff-based approach: existing entries are updated, new entries are inserted, and only removed entries are deleted — all within a single transaction that also cleans orphaned references from events.

## Architecture

The change spans three layers:

1. **Repository layer** (`TariffGroupsRepository`): Core logic for diff-based tariff persistence
2. **Repository layer** (`EventosRepository`): New method for orphaned ID cleanup
3. **Frontend** (`TariffGroupEditor` + types): Propagate existing IDs back to the backend

```
┌─────────────────────────────────────────────────────────┐
│  TariffGroupEditor (renderer)                           │
│  - Includes `id` field for existing tariffs/strips      │
└──────────────────────┬──────────────────────────────────┘
                       │ IPC: tariff-groups:update
                       ▼
┌─────────────────────────────────────────────────────────┐
│  TariffGroupsRepository.update()                        │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Transaction                                     │    │
│  │  1. Update group metadata                       │    │
│  │  2. Diff tariffs: UPDATE existing / INSERT new  │    │
│  │  3. DELETE omitted tariffs                      │    │
│  │  4. Diff strips: UPDATE existing / INSERT new   │    │
│  │  5. DELETE omitted strips + junction rows       │    │
│  │  6. Sync strip_tariffs junction for updated     │    │
│  │  7. Clean orphaned IDs from events              │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  EventosRepository.cleanOrphanedTariffIds()             │
│  - Removes deleted tariff IDs from selected_tariff_ids  │
│  - Removes deleted strip IDs from selected_strip_ids    │
│  - Updates updated_at for affected rows                 │
└─────────────────────────────────────────────────────────┘
```

## Component Changes

### 1. Type Changes (`TariffInput` / `StripInput`)

Add optional `id` field to both input types in the backend repository and the frontend `ipc-client.ts`:

```typescript
// src/main/database/repositories/tariff-groups.repository.ts
export interface TariffInput {
  id?: number          // <-- NEW: present for existing tariffs, absent for new ones
  name: string
  description: string
  local_price: number
  secondary_price: number
  position: number
}

export interface StripInput {
  id?: number          // <-- NEW: present for existing strips, absent for new ones
  name: string
  local_price: number
  secondary_price: number
  position: number
  tariff_ids: number[]
}
```

Mirrored change in `src/renderer/src/lib/ipc-client.ts`.

### 2. `TariffGroupsRepository.update()` Refactoring

The method will be refactored from DELETE+re-INSERT to a diff-based approach:

```typescript
update(id: number, input: TariffGroupUpdateInput): TariffGroup | null {
  const existing = this.getById(id)
  if (!existing) return null

  // validate ...

  const updateTransaction = this.db.transaction(() => {
    // 1. Update group metadata (year, title, currencies)
    updateGroupStmt.run(...)

    // 2. Process individual tariffs
    const existingTariffIds = new Set(existing.tariffs.map(t => t.id!))
    const incomingTariffIds = new Set<number>()
    const positionToId = new Map<number, number>()

    for (const tariff of input.tariffs) {
      if (tariff.id && existingTariffIds.has(tariff.id)) {
        // UPDATE in-place
        updateTariffStmt.run(tariff.name, tariff.description, tariff.local_price,
                            tariff.secondary_price, tariff.position, tariff.id)
        incomingTariffIds.add(tariff.id)
        positionToId.set(tariff.position, tariff.id)
      } else {
        // INSERT new
        const result = insertTariffStmt.run(id, tariff.name, tariff.description,
                                            tariff.local_price, tariff.secondary_price,
                                            tariff.position, 'individual')
        const newId = Number(result.lastInsertRowid)
        positionToId.set(tariff.position, newId)
      }
    }

    // 3. DELETE tariffs not in the incoming set
    const deletedTariffIds: number[] = []
    for (const existingId of existingTariffIds) {
      if (!incomingTariffIds.has(existingId)) {
        deleteTariffStmt.run(existingId)
        deletedTariffIds.push(existingId)
      }
    }

    // 4. Process strips (similar logic)
    const existingStripIds = new Set(existing.strips.map(s => s.id!))
    const incomingStripIds = new Set<number>()

    for (const strip of input.strips) {
      if (strip.id && existingStripIds.has(strip.id)) {
        // UPDATE strip in-place
        updateTariffStmt.run(strip.name, '', strip.local_price,
                            strip.secondary_price, strip.position, strip.id)
        incomingStripIds.add(strip.id)
        // Re-sync junction rows
        deleteStripJunctionStmt.run(strip.id)
        for (const [tariffPosition, quantity] of countTariffOccurrences(strip.tariff_ids)) {
          const resolvedId = positionToId.get(tariffPosition)
          if (resolvedId != null) {
            insertStripTariffStmt.run(strip.id, resolvedId, quantity)
          }
        }
      } else {
        // INSERT new strip
        const result = insertTariffStmt.run(id, strip.name, '', strip.local_price,
                                            strip.secondary_price, strip.position, 'strip')
        const stripId = Number(result.lastInsertRowid)
        for (const [tariffPosition, quantity] of countTariffOccurrences(strip.tariff_ids)) {
          const resolvedId = positionToId.get(tariffPosition)
          if (resolvedId != null) {
            insertStripTariffStmt.run(stripId, resolvedId, quantity)
          }
        }
      }
    }

    // 5. DELETE strips not in the incoming set
    const deletedStripIds: number[] = []
    for (const existingId of existingStripIds) {
      if (!incomingStripIds.has(existingId)) {
        deleteStripJunctionStmt.run(existingId)
        deleteTariffStmt.run(existingId)
        deletedStripIds.push(existingId)
      }
    }

    // 6. Clean orphaned IDs from events (within same transaction)
    if (deletedTariffIds.length > 0 || deletedStripIds.length > 0) {
      cleanOrphanedIds(id, deletedTariffIds, deletedStripIds)
    }
  })

  updateTransaction()
  return this.getById(id)
}
```

### 3. `EventosRepository.cleanOrphanedTariffIds()`

New method on `EventosRepository` (or inline within `TariffGroupsRepository` using the same `db` instance):

```typescript
/**
 * Removes deleted tariff/strip IDs from all events that reference the
 * given tariff group. Updates `updated_at` for affected rows.
 */
cleanOrphanedIds(
  groupId: number,
  deletedTariffIds: number[],
  deletedStripIds: number[]
): void {
  const events = this.db
    .prepare('SELECT id, selected_tariff_ids, selected_strip_ids FROM eventos WHERE tariff_group_id = ?')
    .all(groupId) as Array<{ id: number; selected_tariff_ids: string | null; selected_strip_ids: string | null }>

  const updateStmt = this.db.prepare(`
    UPDATE eventos SET selected_tariff_ids = ?, selected_strip_ids = ?, updated_at = datetime('now')
    WHERE id = ?
  `)

  const deletedTariffSet = new Set(deletedTariffIds)
  const deletedStripSet = new Set(deletedStripIds)

  for (const event of events) {
    const currentTariffs: number[] = parseJsonArray(event.selected_tariff_ids)
    const currentStrips: number[] = parseJsonArray(event.selected_strip_ids)

    const filteredTariffs = currentTariffs.filter(id => !deletedTariffSet.has(id))
    const filteredStrips = currentStrips.filter(id => !deletedStripSet.has(id))

    const tariffChanged = filteredTariffs.length !== currentTariffs.length
    const stripChanged = filteredStrips.length !== currentStrips.length

    if (tariffChanged || stripChanged) {
      updateStmt.run(
        JSON.stringify(filteredTariffs),
        JSON.stringify(filteredStrips),
        event.id
      )
    }
  }
}
```

Since this logic needs to run within the same SQLite transaction as the tariff updates, it will be implemented as a private method in `TariffGroupsRepository` that operates on the same `this.db` instance. The `better-sqlite3` transaction wrapper ensures atomicity.

### 4. Frontend Changes (`TariffGroupEditor.tsx`)

The editor must propagate existing tariff/strip IDs when building the update payload.

```typescript
// In handleSave, when building tariffInputs for edit mode:
const tariffInputs = tariffs.map((t, i) => ({
  id: t.id,            // <-- propagate existing ID (undefined for new tariffs)
  name: t.name.trim(),
  description: t.description ?? '',
  local_price: parseFloat(t.localPrice),
  secondary_price: parseFloat(t.secondaryPrice),
  position: i + 1
}))

const stripInputs = strips.map((s, i) => ({
  id: s.id,            // <-- propagate existing ID (undefined for new strips)
  name: s.name.trim(),
  local_price: parseFloat(s.localPrice),
  secondary_price: parseFloat(s.secondaryPrice),
  position: i + 1,
  tariff_ids: s.tariff_ids
}))
```

The internal `TariffFormRow` type needs an optional `id` field, and in edit mode it should be initialized from the group's tariff data.

### 5. IPC Layer

No changes needed to `tariff-groups.handlers.ts`. The handler already passes the `TariffGroupUpdateInput` object through. The type change (adding optional `id` to `TariffInput`/`StripInput`) is transparent.

## Data Model

No schema changes. The existing tables are:

- `tariff_groups` (id, year, title, currency, local_currency, complementary_currency, created_at, updated_at)
- `tariffs` (id, group_id, name, description, local_price, secondary_price, position, type)
- `strip_tariffs` (id, strip_id, tariff_id, quantity)
- `eventos` (..., tariff_group_id, selected_tariff_ids [JSON], selected_strip_ids [JSON], updated_at)

The fix changes only the write logic, not the schema.

## Error Handling

- **Validation errors**: Thrown before the transaction starts (same as today). No DB changes on validation failure.
- **UNIQUE constraint violations**: Caught within the transaction for the group metadata update. The entire transaction rolls back.
- **Any unexpected error**: The `this.db.transaction()` wrapper in `better-sqlite3` automatically rolls back on throw.
- **Missing tariff IDs in incoming set**: If a `tariff.id` is provided but doesn't exist in the current group's tariffs (stale data), it is treated as a new insertion (defensive behavior).

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: ID Preservation on In-Place Update

*For any* existing tariff or strip in a group, if the update input includes that entry with a matching `id`, the database row after the update SHALL retain the same primary key ID regardless of what fields were modified.

**Validates: Requirements 1.1, 1.2**

### Property 2: New Entry Insertion

*For any* tariff or strip entry in the update input that lacks an `id` (or has an `id` not present in the existing group), the update SHALL create a new database row, and the total tariff/strip count after the update SHALL equal the count of entries in the input.

**Validates: Requirements 1.3, 1.4**

### Property 3: Deletion of Omitted Entries

*For any* tariff or strip that exists in the group before the update but whose `id` does not appear in the update input, the database row SHALL be deleted and no longer queryable after the update completes.

**Validates: Requirements 1.5, 1.6**

### Property 4: Orphaned ID Cleanup

*For any* tariff or strip deleted during a group update, all events referencing that group SHALL have the deleted ID removed from their `selected_tariff_ids` or `selected_strip_ids` JSON arrays respectively.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 5: Non-Deletion Preserves Event Selections

*For any* tariff group update where no tariffs or strips are removed (all existing IDs are present in the input), the `selected_tariff_ids` and `selected_strip_ids` arrays of all associated events SHALL remain unchanged.

**Validates: Requirements 2.4**

### Property 6: Strip Junction Synchronization

*For any* strip that is updated in-place, the `strip_tariffs` junction rows for that strip SHALL exactly match the new `tariff_ids` composition after the update, with each unique tariff represented by exactly one junction row.

**Validates: Requirements 3.1**

### Property 7: Position-to-ID Resolution

*For any* strip whose `tariff_ids` reference tariff positions, the resulting `strip_tariffs` junction rows SHALL contain the correct database IDs corresponding to those positions — including IDs of tariffs newly inserted within the same transaction.

**Validates: Requirements 3.2**

### Property 8: Quantity Collapsing for Repeated Tariffs

*For any* strip referencing the same tariff position N times, the `strip_tariffs` table SHALL contain a single junction row for that tariff with `quantity = N`.

**Validates: Requirements 3.3**

### Property 9: Transactional Rollback on Error

*For any* error occurring at any step of the update method (metadata update, tariff upsert, strip upsert, junction sync, or orphan cleanup), the database state SHALL be identical to its state before the update was attempted — no partial changes SHALL persist.

**Validates: Requirements 5.1, 5.2, 5.3**
