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
   * Returns all events for a given year, sorted by name.
   */
  getByYear(year: number): EventoRow[] {
    return this.db
      .prepare('SELECT * FROM eventos WHERE year = ? ORDER BY nevento ASC')
      .all(year) as EventoRow[]
  }

  /**
   * Returns a single event by ID.
   */
  getById(id: number): EventoRow | null {
    const row = this.db
      .prepare('SELECT * FROM eventos WHERE id = ?')
      .get(id) as EventoRow | undefined
    return row ?? null
  }

  /**
   * Creates a new event. Returns the created event with its ID.
   */
  create(input: EventoInput): EventoRow {
    const stmt = this.db.prepare(`
      INSERT INTO eventos (year, codigo, nevento, nferia, nlugar, motivoi, motivod, fecha, localidad)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      input.localidad
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
      nevento: input.nevento ?? existing.nevento,
      nferia: input.nferia ?? existing.nferia,
      nlugar: input.nlugar ?? existing.nlugar,
      motivoi: input.motivoi ?? existing.motivoi,
      motivod: input.motivod ?? existing.motivod,
      fecha: input.fecha ?? existing.fecha,
      localidad: input.localidad ?? existing.localidad
    }

    this.db.prepare(`
      UPDATE eventos SET
        year = ?, codigo = ?, nevento = ?, nferia = ?, nlugar = ?,
        motivoi = ?, motivod = ?, fecha = ?, localidad = ?,
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
    return this.db
      .prepare('SELECT * FROM eventos ORDER BY year DESC, nevento ASC')
      .all() as EventoRow[]
  }
}
