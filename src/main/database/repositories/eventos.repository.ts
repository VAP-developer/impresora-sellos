import Database from 'better-sqlite3'
import { getDatabase } from '../connection'

// === Evento Types ===

export interface EventoRow {
  id: number
  year: number
  codigo: string
  codigo_feria_1: string
  codigo_feria_2: string
  nevento: string
  nferia: string
  nlugar: string
  motivoi: string
  motivod: string
  layout_modelo1: string
  layout_modelo2: string
  fecha: string
  localidad: string
  tariff_group_id: number | null
  selected_tariff_ids: number[]
  selected_strip_ids: number[]
  created_at: string
  updated_at: string
}

// === Selection Limits ===
//
// There is no upper limit on how many tariffs or strips an event can select.
// The kiosko table renders rows dynamically from the selection, so the user is
// free to pick as many as the tariff group offers.

export interface EventoInput {
  year: number
  codigo: string
  codigo_feria_1: string
  codigo_feria_2: string
  nevento: string
  nferia: string
  nlugar: string
  motivoi: string
  motivod: string
  layout_modelo1: string
  layout_modelo2: string
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
   * Creates a new event. Returns the created event with its ID.
   */
  create(input: EventoInput): EventoRow {
    const selectedTariffIds = JSON.stringify(input.selected_tariff_ids ?? [])
    const selectedStripIds = JSON.stringify(input.selected_strip_ids ?? [])

    const stmt = this.db.prepare(`
      INSERT INTO eventos (year, codigo, codigo_feria_1, codigo_feria_2, nevento, nferia, nlugar, motivoi, motivod, layout_modelo1, layout_modelo2, fecha, localidad, tariff_group_id, selected_tariff_ids, selected_strip_ids)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      input.year,
      input.codigo,
      input.codigo_feria_1,
      input.codigo_feria_2,
      input.nevento,
      input.nferia,
      input.nlugar,
      input.motivoi,
      input.motivod,
      input.layout_modelo1,
      input.layout_modelo2,
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

    const updated = {
      year: input.year ?? existing.year,
      codigo: input.codigo ?? existing.codigo,
      codigo_feria_1: input.codigo_feria_1 ?? existing.codigo_feria_1,
      codigo_feria_2: input.codigo_feria_2 ?? existing.codigo_feria_2,
      nevento: input.nevento ?? existing.nevento,
      nferia: input.nferia ?? existing.nferia,
      nlugar: input.nlugar ?? existing.nlugar,
      motivoi: input.motivoi ?? existing.motivoi,
      motivod: input.motivod ?? existing.motivod,
      layout_modelo1: input.layout_modelo1 ?? existing.layout_modelo1,
      layout_modelo2: input.layout_modelo2 ?? existing.layout_modelo2,
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
        year = ?, codigo = ?, codigo_feria_1 = ?, codigo_feria_2 = ?,
        nevento = ?, nferia = ?, nlugar = ?,
        motivoi = ?, motivod = ?, layout_modelo1 = ?, layout_modelo2 = ?,
        fecha = ?, localidad = ?,
        tariff_group_id = ?,
        selected_tariff_ids = ?,
        selected_strip_ids = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      updated.year,
      updated.codigo,
      updated.codigo_feria_1,
      updated.codigo_feria_2,
      updated.nevento,
      updated.nferia,
      updated.nlugar,
      updated.motivoi,
      updated.motivod,
      updated.layout_modelo1,
      updated.layout_modelo2,
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
