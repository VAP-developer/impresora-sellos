import Database from 'better-sqlite3'
import { getDatabase } from '../connection'

// === Config Types (replican la estructura MongoDB del legacy) ===

export interface TicketConfig {
  feria: string
  lugar: string
  fecha: string // "auto" | fecha manual
  hora: string // "auto" | hora manual
  titulo: string
  tituloCopia: string
  eltitulo?: string
  rollo1: number
  rollo2: number
  tickets: number
  limiteTickets: number
  limiteImporte: number
  NUEVOlimiteImporte?: number
  empresa: string
  cif: string
  cp: string
  l1: string
  l2: string
  l3: string
  T1especial?: number
  T2especial?: number
  T3especial?: number
  TEmod1?: string // "S" | "N"
  TEmod2?: string // "S" | "N"
  ImprimeCopiaTicket?: string // "S" | "N"
  ImprimeMasterTicket?: string // "S" | "N"
  bloqueado?: string // "BLOQUEADO" | "DESBLOQUEADO"
}

export interface CodigoConfig {
  modo: string // "P", "F", etc.
  mes: number // 0 = auto, 1-12 = manual
  annio: string // "auto" | year string
  pais: string // "ES", "AD", etc.
  maquina: string // "CH17", "FI01", etc.
  cliente: number // Auto-incrementing session ID
  producto: number
}

export interface EventoData {
  nevento: string // Nombre del evento
  nferia: string // Nombre feria para ticket
  nlugar: string // Lugar para ticket
  motivoi: string // Nombre imagen motivo izquierdo
  motivod: string // Nombre imagen motivo derecho
  fecha: string // Fecha para la etiqueta
  localidad: string // Localidad para la etiqueta
  codigo?: string // Código del evento
}

export interface SelloConfig {
  elperfil: number // 1-6 (perfil activo)
  elnperfil: string // Nombre del perfil activo
  elevento: number // 0-7 (evento activo)
  elnevento: string // Nombre del evento activo
  feria: string
  lugar: string
  modelo1: string
  modelo2: string
  modo: number
  nperfil1: string // "Filatelia"
  nperfil2: string // "Esporadicos"
  nperfil3: string // "SPDE"
  nperfil4: string // Editable
  nperfil5: string // "Abono/Envio"
  nperfil6: string // "FERIA"
  eventos: EventoData[] // Array de 8 eventos (0-7)
}

export interface PreciosConfig {
  tarifaA: number
  tarifaA2: number
  tarifaB: number
  tarifaC: number
  tarifaTA?: number // Tira tarifa A
  tarifaT4?: number // Tira 4 tarifas
}

export interface ImagenesConfig {
  printSello: boolean
  activeFair: { year: string; fairName: string } | null
}

export interface AppConfig {
  ticket: TicketConfig
  codigo: CodigoConfig
  sello: SelloConfig
  precios: PreciosConfig
  imagenes?: ImagenesConfig
}

// Default configuration (replicates legacy Meteor initConfig)
const DEFAULT_CONFIG: AppConfig = {
  ticket: {
    feria: 'XLIX Feria Nacional Sello',
    lugar: 'Plaza Mayor - Madrid',
    fecha: 'auto',
    hora: 'auto',
    titulo: 'Factura Simplificada',
    tituloCopia: 'COPIA Factura Simplificada',
    rollo1: 1500,
    rollo2: 1500,
    tickets: 450,
    limiteTickets: 450,
    limiteImporte: 399.99,
    NUEVOlimiteImporte: 399.99,
    empresa: 'S.E. Correos y Telégrafos S.A., S.M.E.',
    cif: 'A83052407',
    cp: '28042 Madrid',
    l1: 'Exento de impuestos',
    l2: 'Objeto de coleccionismo',
    l3: 'No se admiten devoluciones',
    T1especial: 0,
    T2especial: 0,
    T3especial: 0,
    TEmod1: 'N',
    TEmod2: 'N',
    ImprimeCopiaTicket: 'S',
    ImprimeMasterTicket: 'N',
    bloqueado: 'DESBLOQUEADO'
  },
  codigo: {
    modo: 'P',
    mes: 0,
    annio: 'auto',
    pais: 'ES',
    maquina: 'CH17',
    cliente: 1,
    producto: 1
  },
  sello: {
    elperfil: 6,
    elnperfil: 'FERIA',
    elevento: 0,
    elnevento: 'Feria Madrid 2025',
    feria: 'XLIX Feria Nacional Sello',
    lugar: 'Plaza Mayor Madrid',
    modelo1: '',
    modelo2: '',
    modo: 0,
    nperfil1: 'Filatelia',
    nperfil2: 'Esporadicos',
    nperfil3: 'SPDE',
    nperfil4: '',
    nperfil5: 'Abono/Envio',
    nperfil6: 'FERIA',
    eventos: [
      { nevento: 'Feria Madrid', nferia: 'XLIX Feria Nacional Sello', nlugar: 'Plaza Mayor Madrid', motivoi: '', motivod: '', fecha: '21-24 abril 2025', localidad: 'Madrid' },
      { nevento: '', nferia: '', nlugar: '', motivoi: '', motivod: '', fecha: '', localidad: '' },
      { nevento: '', nferia: '', nlugar: '', motivoi: '', motivod: '', fecha: '', localidad: '' },
      { nevento: '', nferia: '', nlugar: '', motivoi: '', motivod: '', fecha: '', localidad: '' },
      { nevento: '', nferia: '', nlugar: '', motivoi: '', motivod: '', fecha: '', localidad: '' },
      { nevento: '', nferia: '', nlugar: '', motivoi: '', motivod: '', fecha: '', localidad: '' },
      { nevento: '', nferia: '', nlugar: '', motivoi: '', motivod: '', fecha: '', localidad: '' },
      { nevento: '', nferia: '', nlugar: '', motivoi: '', motivod: '', fecha: '', localidad: '' }
    ]
  },
  precios: {
    tarifaA: 0.5,
    tarifaA2: 0.6,
    tarifaB: 1.25,
    tarifaC: 1.35,
    tarifaTA: 2.0,
    tarifaT4: 3.7
  }
}

/**
 * Repository for the config table.
 * The config table stores a single row (id=1) with a JSON blob
 * containing the full application configuration.
 */
export class ConfigRepository {
  private db: Database.Database

  constructor(db?: Database.Database) {
    this.db = db ?? getDatabase()
  }

  /**
   * Retrieves the current application configuration.
   * Returns null if no config exists yet.
   */
  get(): AppConfig | null {
    const row = this.db.prepare('SELECT data FROM config WHERE id = 1').get() as
      | { data: string }
      | undefined

    if (!row) {
      return null
    }

    return JSON.parse(row.data) as AppConfig
  }

  /**
   * Replaces the entire configuration with the given data.
   * Uses INSERT OR REPLACE to handle both initial insert and updates.
   */
  set(config: AppConfig): void {
    const data = JSON.stringify(config)
    this.db
      .prepare('INSERT OR REPLACE INTO config (id, data) VALUES (1, ?)')
      .run(data)
  }

  /**
   * Updates the "maquina" sections (ticket + codigo) of the configuration.
   * Merges partial updates into existing config.
   */
  updateMaquina(updates: {
    ticket: Partial<TicketConfig>
    codigo: Partial<CodigoConfig>
  }): void {
    const config = this.get()
    if (!config) {
      throw new Error('Config not initialized. Call initConfig() first.')
    }

    config.ticket = { ...config.ticket, ...updates.ticket }
    config.codigo = { ...config.codigo, ...updates.codigo }
    this.set(config)
  }

  /**
   * Updates the "imprimir" sections (sello + precios) of the configuration.
   * Merges partial sello updates; replaces precios entirely.
   */
  updateImprimir(updates: {
    sello: Partial<SelloConfig>
    precios: PreciosConfig
  }): void {
    const config = this.get()
    if (!config) {
      throw new Error('Config not initialized. Call initConfig() first.')
    }

    config.sello = { ...config.sello, ...updates.sello }
    config.precios = updates.precios
    this.set(config)
  }

  /**
   * Increments the session ID (codigo.cliente) by 1.
   */
  updateSesion(): void {
    const config = this.get()
    if (!config) {
      throw new Error('Config not initialized. Call initConfig() first.')
    }

    config.codigo.cliente += 1
    this.set(config)
  }

  /**
   * Decrements the session ID (codigo.cliente) by 1 (for error reversal).
   */
  updateSesionError(): void {
    const config = this.get()
    if (!config) {
      throw new Error('Config not initialized. Call initConfig() first.')
    }

    config.codigo.cliente -= 1
    this.set(config)
  }

  /**
   * Decrements roll counters after a sale.
   * @param sellos1 - Number of labels consumed from rollo1
   * @param sellos2 - Number of labels consumed from rollo2
   * @param tickets - Number of tickets consumed
   */
  updateRollos(sellos1: number, sellos2: number, tickets: number): void {
    const config = this.get()
    if (!config) {
      throw new Error('Config not initialized. Call initConfig() first.')
    }

    config.ticket.rollo1 -= sellos1
    config.ticket.rollo2 -= sellos2
    config.ticket.tickets -= tickets
    this.set(config)
  }

  /**
   * Reverts roll counters after an error/cancellation.
   * @param sellos1 - Number of labels to restore to rollo1
   * @param sellos2 - Number of labels to restore to rollo2
   * @param tickets - Number of tickets to restore
   */
  updateRollosRevert(sellos1: number, sellos2: number, tickets: number): void {
    const config = this.get()
    if (!config) {
      throw new Error('Config not initialized. Call initConfig() first.')
    }

    config.ticket.rollo1 += sellos1
    config.ticket.rollo2 += sellos2
    config.ticket.tickets += tickets
    this.set(config)
  }

  /**
   * Initializes the configuration with default values if no config exists.
   * Only inserts the default configuration when the config table is empty (id=1 not present).
   * Called at app startup after migrations to ensure configuration is always available.
   * Replicates the legacy Meteor initConfig() behavior.
   */
  initConfig(): void {
    const existing = this.db
      .prepare('SELECT id FROM config WHERE id = 1')
      .get()

    if (!existing) {
      this.set(structuredClone(DEFAULT_CONFIG))
    }
  }

  /**
   * Retrieves the imagenes section of the config.
   * Returns defaults ({ printSello: false, activeFair: null }) if not yet set.
   */
  getImagenes(): ImagenesConfig {
    const config = this.get()
    return config?.imagenes ?? { printSello: false, activeFair: null }
  }

  /**
   * Updates only the imagenes section of the config.
   * Creates the section if it doesn't exist yet.
   */
  updateImagenes(imagenes: ImagenesConfig): void {
    const config = this.get()
    if (!config) {
      throw new Error('Config not initialized. Call initConfig() first.')
    }
    config.imagenes = imagenes
    this.set(config)
  }

  /**
   * Resets the configuration to factory defaults.
   * Deletes any existing config and inserts the default.
   * Use this for a full reset (destructive operation).
   */
  resetConfig(): void {
    this.db.prepare('DELETE FROM config').run()
    this.set(structuredClone(DEFAULT_CONFIG))
  }
}

/**
 * Returns the default configuration object.
 * Useful for testing and reference.
 */
export function getDefaultConfig(): AppConfig {
  return structuredClone(DEFAULT_CONFIG)
}
