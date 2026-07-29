import Database from 'better-sqlite3'
import { getDatabase } from '../connection'

// === Tariff Group Types ===

/** Tipo de tarifa: individual o tira */
export type TariffType = 'individual' | 'strip'

export interface Tariff {
  id?: number
  name: string
  price: number
  position: number
  type: TariffType
  strip_count?: number
}

export interface TariffGroup {
  id: number
  year: number
  title: string
  currency: string
  tariffs: Tariff[]
  created_at: string
  updated_at: string
}

export interface TariffGroupInput {
  year: number
  title: string
  currency: string
  tariffs: TariffInput[]
}

export interface TariffInput {
  name: string
  price: number
  position: number
  type: TariffType
  strip_count?: number
}

export interface TariffGroupUpdateInput {
  year?: number
  title?: string
  currency?: string
  tariffs: TariffInput[]
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
  EMPTY_TITLE: 'El título es obligatorio',
  EMPTY_CURRENCY: 'El tipo de moneda es obligatorio',
  EMPTY_TARIFF_NAME: 'El nombre de la tarifa es obligatorio',
  TARIFF_NAME_TOO_LONG: 'El nombre no puede exceder 16 caracteres',
  INVALID_PRICE: 'El precio debe ser un número positivo',
  GROUP_IN_USE: 'No se puede eliminar: el grupo está asociado a eventos',
  NOT_FOUND: 'Grupo de tarifas no encontrado'
} as const

// === Internal Row Types ===

interface TariffGroupRow {
  id: number
  year: number
  title: string
  currency: string
  created_at: string
  updated_at: string
}

interface TariffRow {
  id: number
  group_id: number
  name: string
  price: number
  position: number
  type: string
  strip_count: number | null
}

/**
 * Repository for tariff_groups and tariffs tables.
 * Manages CRUD operations for tariff groups with their associated tariffs.
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
  private validate(input: { title?: string; currency?: string; tariffs: TariffInput[] }): void {
    if (input.title !== undefined && !input.title.trim()) {
      throw new Error(TARIFF_GROUP_ERRORS.EMPTY_TITLE)
    }

    if (input.currency !== undefined && !input.currency.trim()) {
      throw new Error(TARIFF_GROUP_ERRORS.EMPTY_CURRENCY)
    }

    // Count individual tariffs for cardinality validation
    const individualTariffs = input.tariffs.filter((t) => t.type === 'individual')
    const individualCount = individualTariffs.length

    if (individualCount < 2) {
      throw new Error(TARIFF_GROUP_ERRORS.MIN_INDIVIDUAL_TARIFFS)
    }

    if (individualCount > 20) {
      throw new Error(TARIFF_GROUP_ERRORS.MAX_INDIVIDUAL_TARIFFS)
    }

    // Validate each tariff (both individual and strip)
    for (const tariff of input.tariffs) {
      if (!tariff.name || !tariff.name.trim()) {
        throw new Error(TARIFF_GROUP_ERRORS.EMPTY_TARIFF_NAME)
      }
      if (tariff.name.length > 16) {
        throw new Error(TARIFF_GROUP_ERRORS.TARIFF_NAME_TOO_LONG)
      }
      if (
        typeof tariff.price !== 'number' ||
        isNaN(tariff.price) ||
        !isFinite(tariff.price) ||
        tariff.price <= 0
      ) {
        throw new Error(TARIFF_GROUP_ERRORS.INVALID_PRICE)
      }

      // Strip-specific validations
      if (tariff.type === 'strip') {
        if (tariff.strip_count === undefined || tariff.strip_count === null || tariff.strip_count < 2) {
          throw new Error(TARIFF_GROUP_ERRORS.STRIP_COUNT_MIN)
        }
        if (tariff.strip_count > individualCount) {
          throw new Error(TARIFF_GROUP_ERRORS.STRIP_COUNT_EXCEEDS_TOTAL)
        }
      }
    }
  }

  /**
   * Attaches tariffs to an array of group rows, returning full TariffGroup objects.
   */
  private _attachTariffs(groups: TariffGroupRow[]): TariffGroup[] {
    return groups.map((group) => {
      const tariffs = this.db
        .prepare(
          'SELECT id, group_id, name, price, position, type, strip_count FROM tariffs WHERE group_id = ? ORDER BY position ASC'
        )
        .all(group.id) as TariffRow[]

      return {
        ...group,
        tariffs: tariffs.map((t) => {
          const tariff: Tariff = {
            id: t.id,
            name: t.name,
            price: t.price,
            position: t.position,
            type: t.type as TariffType
          }
          if (t.strip_count !== null) {
            tariff.strip_count = t.strip_count
          }
          return tariff
        })
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
   * Returns all tariff groups with their tariffs included.
   */
  getAll(): TariffGroup[] {
    const groups = this.db
      .prepare('SELECT * FROM tariff_groups ORDER BY year DESC, title ASC')
      .all() as TariffGroupRow[]
    return this._attachTariffs(groups)
  }

  /**
   * Returns tariff groups for a given year with their tariffs.
   */
  getByYear(year: number): TariffGroup[] {
    const groups = this.db
      .prepare('SELECT * FROM tariff_groups WHERE year = ? ORDER BY title ASC')
      .all(year) as TariffGroupRow[]
    return this._attachTariffs(groups)
  }

  /**
   * Returns a single tariff group by ID with its tariffs, or null if not found.
   */
  getById(id: number): TariffGroup | null {
    const group = this.db
      .prepare('SELECT * FROM tariff_groups WHERE id = ?')
      .get(id) as TariffGroupRow | undefined

    if (!group) return null

    return this._attachTariffs([group])[0]
  }

  /**
   * Creates a new tariff group with its tariffs atomically in a transaction.
   * Returns the created group with its tariffs.
   */
  create(input: TariffGroupInput): TariffGroup {
    this.validate({ title: input.title, currency: input.currency, tariffs: input.tariffs })

    const insertGroup = this.db.prepare(`
      INSERT INTO tariff_groups (year, title, currency)
      VALUES (?, ?, ?)
    `)

    const insertTariff = this.db.prepare(`
      INSERT INTO tariffs (group_id, name, price, position, type, strip_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const createTransaction = this.db.transaction(() => {
      let result: Database.RunResult
      try {
        result = insertGroup.run(input.year, input.title, input.currency)
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
          throw new Error(TARIFF_GROUP_ERRORS.DUPLICATE_YEAR)
        }
        throw err
      }

      const groupId = Number(result.lastInsertRowid)

      for (const tariff of input.tariffs) {
        insertTariff.run(
          groupId,
          tariff.name,
          tariff.price,
          tariff.position,
          tariff.type,
          tariff.strip_count ?? null
        )
      }

      return groupId
    })

    const groupId = createTransaction()
    return this.getById(groupId)!
  }

  /**
   * Updates an existing tariff group and syncs its tariffs (delete + re-insert) atomically.
   * Returns the updated group or null if not found.
   */
  update(id: number, input: TariffGroupUpdateInput): TariffGroup | null {
    const existing = this.getById(id)
    if (!existing) return null

    const title = input.title ?? existing.title
    const currency = input.currency ?? existing.currency

    this.validate({ title, currency, tariffs: input.tariffs })

    const updateGroup = this.db.prepare(`
      UPDATE tariff_groups SET
        year = ?, title = ?, currency = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `)

    const deleteTariffs = this.db.prepare('DELETE FROM tariffs WHERE group_id = ?')

    const insertTariff = this.db.prepare(`
      INSERT INTO tariffs (group_id, name, price, position, type, strip_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const updateTransaction = this.db.transaction(() => {
      const year = input.year ?? existing.year

      try {
        updateGroup.run(year, title, currency, id)
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
          throw new Error(TARIFF_GROUP_ERRORS.DUPLICATE_YEAR)
        }
        throw err
      }

      deleteTariffs.run(id)

      for (const tariff of input.tariffs) {
        insertTariff.run(
          id,
          tariff.name,
          tariff.price,
          tariff.position,
          tariff.type,
          tariff.strip_count ?? null
        )
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
