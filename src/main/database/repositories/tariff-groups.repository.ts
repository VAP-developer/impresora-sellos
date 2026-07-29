import Database from 'better-sqlite3'
import { getDatabase } from '../connection'

// === Tariff Group Types ===

/** Tipo de tarifa: individual o tira */
export type TariffType = 'individual' | 'strip'

export interface Tariff {
  id?: number
  name: string
  description: string
  local_price: number
  secondary_price: number
  position: number
  type: TariffType
}

export interface Strip {
  id?: number
  name: string
  description: string
  local_price: number
  secondary_price: number
  position: number
  type: 'strip'
  tariff_ids: number[]
}

export interface TariffGroup {
  id: number
  year: number
  title: string
  local_currency: string
  complementary_currency: string
  tariffs: Tariff[]
  strips: Strip[]
  created_at: string
  updated_at: string
}

export interface TariffGroupInput {
  year: number
  title: string
  local_currency: string
  complementary_currency: string
  tariffs: TariffInput[]
  strips: StripInput[]
}

export interface TariffInput {
  name: string
  description: string
  local_price: number
  secondary_price: number
  position: number
}

export interface StripInput {
  name: string
  description: string
  local_price: number
  secondary_price: number
  position: number
  tariff_ids: number[]
}

export interface TariffGroupUpdateInput {
  year?: number
  title?: string
  local_currency?: string
  complementary_currency?: string
  tariffs: TariffInput[]
  strips: StripInput[]
}

// === Error Constants ===

export const TARIFF_GROUP_ERRORS = {
  DUPLICATE_YEAR: 'Ya existe un grupo para ese año',
  DUPLICATE_YEAR_TITLE: 'Ya existe un grupo con ese año y título',
  MIN_TARIFFS: 'Se requieren al menos 2 tarifas',
  MAX_TARIFFS: 'El máximo permitido es 10 tarifas',
  MIN_INDIVIDUAL_TARIFFS: 'Se requieren al menos 2 tarifas individuales',
  MAX_INDIVIDUAL_TARIFFS: 'El máximo permitido es 20 tarifas individuales',
  STRIP_COUNT_MIN: 'Una tira debe abarcar al menos 2 tarifas individuales',
  STRIP_COUNT_EXCEEDS_TOTAL: 'La tira no puede abarcar más tarifas de las existentes',
  STRIP_MIN_TARIFFS: 'Una tira debe referenciar al menos 2 tarifas individuales',
  EMPTY_TITLE: 'El título es obligatorio',
  EMPTY_CURRENCY: 'El tipo de moneda es obligatorio',
  EMPTY_TARIFF_NAME: 'El nombre de la tarifa es obligatorio',
  TARIFF_NAME_TOO_LONG: 'El nombre no puede exceder 16 caracteres',
  INVALID_PRICE: 'El precio debe ser un número positivo',
  INVALID_LOCAL_PRICE: 'El precio local debe ser un número positivo',
  INVALID_SECONDARY_PRICE: 'El precio complementario debe ser un número positivo',
  GROUP_IN_USE: 'No se puede eliminar: el grupo está asociado a eventos',
  NOT_FOUND: 'Grupo de tarifas no encontrado'
} as const

// === Internal Row Types ===

interface TariffGroupRow {
  id: number
  year: number
  title: string
  currency: string
  local_currency: string
  complementary_currency: string
  created_at: string
  updated_at: string
}

interface TariffRow {
  id: number
  group_id: number
  name: string
  description: string
  local_price: number
  secondary_price: number
  position: number
  type: string
  strip_count: number | null
}

/**
 * Repository for tariff_groups and tariffs tables.
 * Manages CRUD operations for tariff groups with their associated tariffs and strips.
 */
export class TariffGroupsRepository {
  private db: Database.Database

  constructor(db?: Database.Database) {
    this.db = db ?? getDatabase()
  }

  /**
   * Validates tariff group input fields with type-aware rules.
   * Throws an error with a descriptive message if validation fails.
   */
  private validate(input: {
    title?: string
    local_currency?: string
    complementary_currency?: string
    tariffs: TariffInput[]
    strips: StripInput[]
  }): void {
    if (input.title !== undefined && !input.title.trim()) {
      throw new Error(TARIFF_GROUP_ERRORS.EMPTY_TITLE)
    }

    if (input.local_currency !== undefined && !input.local_currency.trim()) {
      throw new Error(TARIFF_GROUP_ERRORS.EMPTY_CURRENCY)
    }

    if (input.complementary_currency !== undefined && !input.complementary_currency.trim()) {
      throw new Error(TARIFF_GROUP_ERRORS.EMPTY_CURRENCY)
    }

    // Individual tariff cardinality validation [2, 20]
    const individualCount = input.tariffs.length

    if (individualCount < 2) {
      throw new Error(TARIFF_GROUP_ERRORS.MIN_INDIVIDUAL_TARIFFS)
    }

    if (individualCount > 20) {
      throw new Error(TARIFF_GROUP_ERRORS.MAX_INDIVIDUAL_TARIFFS)
    }

    // Validate each individual tariff
    for (const tariff of input.tariffs) {
      if (!tariff.name || !tariff.name.trim()) {
        throw new Error(TARIFF_GROUP_ERRORS.EMPTY_TARIFF_NAME)
      }
      if (tariff.name.length > 16) {
        throw new Error(TARIFF_GROUP_ERRORS.TARIFF_NAME_TOO_LONG)
      }
      if (
        typeof tariff.local_price !== 'number' ||
        isNaN(tariff.local_price) ||
        !isFinite(tariff.local_price) ||
        tariff.local_price <= 0
      ) {
        throw new Error(TARIFF_GROUP_ERRORS.INVALID_LOCAL_PRICE)
      }
      if (
        typeof tariff.secondary_price !== 'number' ||
        isNaN(tariff.secondary_price) ||
        !isFinite(tariff.secondary_price) ||
        tariff.secondary_price <= 0
      ) {
        throw new Error(TARIFF_GROUP_ERRORS.INVALID_SECONDARY_PRICE)
      }
      // description is allowed to be empty string — no validation needed
    }

    // Validate each strip
    for (const strip of input.strips) {
      if (!strip.name || !strip.name.trim()) {
        throw new Error(TARIFF_GROUP_ERRORS.EMPTY_TARIFF_NAME)
      }
      if (strip.name.length > 16) {
        throw new Error(TARIFF_GROUP_ERRORS.TARIFF_NAME_TOO_LONG)
      }
      if (
        typeof strip.local_price !== 'number' ||
        isNaN(strip.local_price) ||
        !isFinite(strip.local_price) ||
        strip.local_price <= 0
      ) {
        throw new Error(TARIFF_GROUP_ERRORS.INVALID_LOCAL_PRICE)
      }
      if (
        typeof strip.secondary_price !== 'number' ||
        isNaN(strip.secondary_price) ||
        !isFinite(strip.secondary_price) ||
        strip.secondary_price <= 0
      ) {
        throw new Error(TARIFF_GROUP_ERRORS.INVALID_SECONDARY_PRICE)
      }
      if (!strip.tariff_ids || strip.tariff_ids.length < 2) {
        throw new Error(TARIFF_GROUP_ERRORS.STRIP_MIN_TARIFFS)
      }
    }
  }

  /**
   * Attaches tariffs and strips (with tariff_ids) to an array of group rows,
   * returning full TariffGroup objects with separate tariffs and strips arrays.
   */
  private _attachTariffs(groups: TariffGroupRow[]): TariffGroup[] {
    const getStripTariffIds = this.db.prepare(
      'SELECT tariff_id FROM strip_tariffs WHERE strip_id = ?'
    )

    return groups.map((group) => {
      const rows = this.db
        .prepare(
          'SELECT id, group_id, name, description, local_price, secondary_price, position, type, strip_count FROM tariffs WHERE group_id = ? ORDER BY position ASC'
        )
        .all(group.id) as TariffRow[]

      const tariffs: Tariff[] = []
      const strips: Strip[] = []

      for (const row of rows) {
        if (row.type === 'strip') {
          const junctionRows = getStripTariffIds.all(row.id) as Array<{ tariff_id: number }>
          strips.push({
            id: row.id,
            name: row.name,
            description: row.description ?? '',
            local_price: row.local_price,
            secondary_price: row.secondary_price,
            position: row.position,
            type: 'strip',
            tariff_ids: junctionRows.map((r) => r.tariff_id)
          })
        } else {
          tariffs.push({
            id: row.id,
            name: row.name,
            description: row.description ?? '',
            local_price: row.local_price,
            secondary_price: row.secondary_price,
            position: row.position,
            type: row.type as TariffType
          })
        }
      }

      return {
        id: group.id,
        year: group.year,
        title: group.title,
        local_currency: group.local_currency ?? 'EUR',
        complementary_currency: group.complementary_currency ?? 'EUR',
        tariffs,
        strips,
        created_at: group.created_at,
        updated_at: group.updated_at
      }
    })
  }

  /**
   * Returns all distinct years that have tariff groups, sorted descending.
   */
  getYears(): number[] {
    const rows = this.db
      .prepare('SELECT DISTINCT year FROM tariff_groups ORDER BY year DESC')
      .all() as Array<{ year: number }>
    return rows.map((r) => r.year)
  }

  /**
   * Returns all tariff groups with their tariffs and strips included.
   */
  getAll(): TariffGroup[] {
    const groups = this.db
      .prepare('SELECT * FROM tariff_groups ORDER BY year DESC, title ASC')
      .all() as TariffGroupRow[]
    return this._attachTariffs(groups)
  }

  /**
   * Returns tariff groups for a given year with their tariffs and strips.
   */
  getByYear(year: number): TariffGroup[] {
    const groups = this.db
      .prepare('SELECT * FROM tariff_groups WHERE year = ? ORDER BY title ASC')
      .all(year) as TariffGroupRow[]
    return this._attachTariffs(groups)
  }

  /**
   * Returns a single tariff group by ID with its tariffs and strips, or null if not found.
   */
  getById(id: number): TariffGroup | null {
    const group = this.db
      .prepare('SELECT * FROM tariff_groups WHERE id = ?')
      .get(id) as TariffGroupRow | undefined

    if (!group) return null

    return this._attachTariffs([group])[0]
  }

  /**
   * Creates a new tariff group with its tariffs and strips atomically in a transaction.
   * Returns the created group with its tariffs and strips.
   */
  create(input: TariffGroupInput): TariffGroup {
    this.validate({
      title: input.title,
      local_currency: input.local_currency,
      complementary_currency: input.complementary_currency,
      tariffs: input.tariffs,
      strips: input.strips
    })

    const insertGroup = this.db.prepare(`
      INSERT INTO tariff_groups (year, title, currency, local_currency, complementary_currency)
      VALUES (?, ?, ?, ?, ?)
    `)

    const insertTariff = this.db.prepare(`
      INSERT INTO tariffs (group_id, name, description, local_price, secondary_price, position, type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    const insertStripTariff = this.db.prepare(`
      INSERT INTO strip_tariffs (strip_id, tariff_id)
      VALUES (?, ?)
    `)

    const createTransaction = this.db.transaction(() => {
      let result: Database.RunResult
      try {
        result = insertGroup.run(
          input.year,
          input.title,
          input.local_currency, // also set deprecated currency column
          input.local_currency,
          input.complementary_currency
        )
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
          throw new Error(TARIFF_GROUP_ERRORS.DUPLICATE_YEAR)
        }
        throw err
      }

      const groupId = Number(result.lastInsertRowid)

      // Insert individual tariffs
      for (const tariff of input.tariffs) {
        insertTariff.run(
          groupId,
          tariff.name,
          tariff.description ?? '',
          tariff.local_price,
          tariff.secondary_price,
          tariff.position,
          'individual'
        )
      }

      // Insert strips and their junction rows
      for (const strip of input.strips) {
        const stripResult = insertTariff.run(
          groupId,
          strip.name,
          strip.description ?? '',
          strip.local_price,
          strip.secondary_price,
          strip.position,
          'strip'
        )
        const stripId = Number(stripResult.lastInsertRowid)

        for (const tariffId of strip.tariff_ids) {
          insertStripTariff.run(stripId, tariffId)
        }
      }

      return groupId
    })

    const groupId = createTransaction()
    return this.getById(groupId)!
  }

  /**
   * Updates an existing tariff group and syncs its tariffs/strips (delete + re-insert) atomically.
   * Returns the updated group or null if not found.
   */
  update(id: number, input: TariffGroupUpdateInput): TariffGroup | null {
    const existing = this.getById(id)
    if (!existing) return null

    const title = input.title ?? existing.title
    const localCurrency = input.local_currency ?? existing.local_currency
    const complementaryCurrency = input.complementary_currency ?? existing.complementary_currency

    this.validate({
      title,
      local_currency: localCurrency,
      complementary_currency: complementaryCurrency,
      tariffs: input.tariffs,
      strips: input.strips
    })

    const updateGroup = this.db.prepare(`
      UPDATE tariff_groups SET
        year = ?, title = ?, currency = ?, local_currency = ?, complementary_currency = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `)

    const deleteTariffs = this.db.prepare('DELETE FROM tariffs WHERE group_id = ?')

    const insertTariff = this.db.prepare(`
      INSERT INTO tariffs (group_id, name, description, local_price, secondary_price, position, type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    const insertStripTariff = this.db.prepare(`
      INSERT INTO strip_tariffs (strip_id, tariff_id)
      VALUES (?, ?)
    `)

    const updateTransaction = this.db.transaction(() => {
      const year = input.year ?? existing.year

      try {
        updateGroup.run(year, title, localCurrency, localCurrency, complementaryCurrency, id)
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
          throw new Error(TARIFF_GROUP_ERRORS.DUPLICATE_YEAR)
        }
        throw err
      }

      // Delete existing tariffs (CASCADE handles strip_tariffs junction rows)
      deleteTariffs.run(id)

      // Re-insert individual tariffs
      for (const tariff of input.tariffs) {
        insertTariff.run(
          id,
          tariff.name,
          tariff.description ?? '',
          tariff.local_price,
          tariff.secondary_price,
          tariff.position,
          'individual'
        )
      }

      // Re-insert strips and their junction rows
      for (const strip of input.strips) {
        const stripResult = insertTariff.run(
          id,
          strip.name,
          strip.description ?? '',
          strip.local_price,
          strip.secondary_price,
          strip.position,
          'strip'
        )
        const stripId = Number(stripResult.lastInsertRowid)

        for (const tariffId of strip.tariff_ids) {
          insertStripTariff.run(stripId, tariffId)
        }
      }
    })

    updateTransaction()
    return this.getById(id)
  }

  /**
   * Deletes a tariff group by ID.
   * Verifies no events reference the group before deleting.
   * Returns { success: true } on success, or { success: false, error } if the group is in use.
   */
  delete(id: number): { success: boolean; error?: string } {
    const existing = this.getById(id)
    if (!existing) {
      return { success: false, error: TARIFF_GROUP_ERRORS.NOT_FOUND }
    }

    const events = this.getEventsByGroupId(id)
    if (events.length > 0) {
      return { success: false, error: TARIFF_GROUP_ERRORS.GROUP_IN_USE }
    }

    this.db.prepare('DELETE FROM tariff_groups WHERE id = ?').run(id)
    return { success: true }
  }

  /**
   * Returns IDs of events that reference the given tariff group.
   */
  getEventsByGroupId(groupId: number): number[] {
    const rows = this.db
      .prepare('SELECT id FROM eventos WHERE tariff_group_id = ?')
      .all(groupId) as Array<{ id: number }>
    return rows.map((r) => r.id)
  }
}
