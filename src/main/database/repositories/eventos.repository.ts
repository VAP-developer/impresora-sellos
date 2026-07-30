import Database from 'better-sqlite3'
import { getDatabase } from '../connection'

// === Evento Types ===

export interface EventoRow {
  id: number
  year: number
  codigo: string
  nevento: string
  nferia: string
  nlugar: string
  motivoi: string
  motivod: string
  fecha: string
  localidad: string
  tariff_group_id: number | null
  selected_tariff_ids: number[]
  selected_strip_ids: number[]
  created_at: string
  updated_at: string
}

export interface EventoInput {
  year: number
  codigo: string
  nevento: string
  nferia: string
  nlugar: string
  motivoi: string
  motivod: string
  fecha: string
  localidad: string
  tariff_group_id?: number | null
  selected_tariff_ids?: number[]
  selected_strip_ids?: number[]
}

/**
 * Repository for the eventos table.
 * Manages CRUD operations for events organized by year.
 */
export class EventosRepository {
  private db: Database.Database

  constructor(db?: Database.Database) {
    this.db = db ?? getDatabase()
  }

  /**
   * Returns all distinct years that have events, sorted descending.
   */
  getYears(): number[] {
    const rows = this.db
      .prepare('SELECT DISTINCT year FROM eventos ORDER BY year DESC')
      .all() as Array<{ year: number }>
    return rows.map((r) => r.year)
  }

  /**
   * Parse JSON arrays from database rows for selected IDs.
   */
  private parseEventoRow(row: any): EventoRow {
    return {
      ...row,
      selected_tariff_ids: this.parseJsonArray(row.selected_tariff_ids),
      selected_strip_ids: this.parseJsonArray(row.selected_strip_ids)
    }
  }

  private parseJsonArray(jsonStr: string | null): number[] {
    if (!jsonStr) return []
    try {
      const parsed = JSON.parse(jsonStr)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  /**
   * Returns all events for a given year, sorted by name.
   */
  getByYear(year: number): EventoRow[] {
    const rows = this.db
      .prepare('SELECT * FROM eventos WHERE year = ? ORDER BY nevento ASC')
      .all(year)
    return rows.map((row) => this.parseEventoRow(row))
  }

  /**
   * Returns a single event by ID.
   */
  getById(id: number): EventoRow | null {
    const row = this.db
      .prepare('SELECT * FROM eventos WHERE id = ?')
      .get(id)
    return row ? this.parseEventoRow(row) : null
  }

  /**
   * Validates tariff selection constraints.
   */
  private validateTariffSelection(input: { selected_tariff_ids?: number[]; selected_strip_ids?: number[] }): void {
    const tariffCount = input.selected_tariff_ids?.length ?? 0
    const stripCount = input.selected_strip_ids?.length ?? 0

    if (tariffCount > 6) {
      throw new Error('Máximo 6 tarifas individuales por evento')
    }
    if (stripCount > 2) {
      throw new Error('Máximo 2 tiras por evento')
    }
  }

  /**
   * Creates a new event. Returns the created event with its ID.
   */
  create(input: EventoInput): EventoRow {
    this.validateTariffSelection(input)

    const selectedTariffIds = JSON.stringify(input.selected_tariff_ids ?? [])
    const selectedStripIds = JSON.stringify(input.selected_strip_ids ?? [])

    const stmt = this.db.prepare(`
      INSERT INTO eventos (year, codigo, nevento, nferia, nlugar, motivoi, motivod, fecha, localidad, tariff_group_id, selected_tariff_ids, selected_strip_ids)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      input.year,
      input.codigo,
      input.nevento,
      input.nferia,
      input.nlugar,
      input.motivoi,
      input.motivod,
      input.fecha,
      input.localidad,
      input.tariff_group_id ?? null,
      selectedTariffIds,
      selectedStripIds
    )
    return this.getById(Number(result.lastInsertRowid))!
  }

  /**
   * Updates an existing event by ID. Returns the updated event.
   */
  update(id: number, input: Partial<EventoInput>): EventoRow | null {
    const existing = this.getById(id)
    if (!existing) return null

    this.validateTariffSelection(input)

    const updated = {
      year: input.year ?? existing.year,
      codigo: input.codigo ?? existing.codigo,
      nevento: input.nevento ?? existing.nevento,
      nferia: input.nferia ?? existing.nferia,
      nlugar: input.nlugar ?? existing.nlugar,
      motivoi: input.motivoi ?? existing.motivoi,
      motivod: input.motivod ?? existing.motivod,
      fecha: input.fecha ?? existing.fecha,
      localidad: input.localidad ?? existing.localidad,
      tariff_group_id: input.tariff_group_id !== undefined ? input.tariff_group_id : existing.tariff_group_id,
      selected_tariff_ids: input.selected_tariff_ids !== undefined ? input.selected_tariff_ids : existing.selected_tariff_ids,
      selected_strip_ids: input.selected_strip_ids !== undefined ? input.selected_strip_ids : existing.selected_strip_ids
    }

    const selectedTariffIds = JSON.stringify(updated.selected_tariff_ids)
    const selectedStripIds = JSON.stringify(updated.selected_strip_ids)

    this.db.prepare(`
      UPDATE eventos SET
        year = ?, codigo = ?, nevento = ?, nferia = ?, nlugar = ?,
        motivoi = ?, motivod = ?, fecha = ?, localidad = ?,
        tariff_group_id = ?,
        selected_tariff_ids = ?,
        selected_strip_ids = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      updated.year,
      updated.codigo,
      updated.nevento,
      updated.nferia,
      updated.nlugar,
      updated.motivoi,
      updated.motivod,
      updated.fecha,
      updated.localidad,
      updated.tariff_group_id ?? null,
      selectedTariffIds,
      selectedStripIds,
      id
    )

    return this.getById(id)
  }

  /**
   * Deletes an event by ID. Returns true if deleted.
   */
  delete(id: number): boolean {
    const result = this.db.prepare('DELETE FROM eventos WHERE id = ?').run(id)
    return result.changes > 0
  }

  /**
   * Returns all events (all years).
   */
  getAll(): EventoRow[] {
    const rows = this.db
      .prepare('SELECT * FROM eventos ORDER BY year DESC, nevento ASC')
      .all()
    return rows.map((row) => this.parseEventoRow(row))
  }
}
