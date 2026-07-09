/**
 * Config types for the Stamp Sales Desktop App.
 * These replicate the MongoDB document structure from the legacy system,
 * now stored as JSON in SQLite.
 */

/** Datos de un evento (feria) configurable (índices 0-7) */
export interface EventoData {
  nevento: string // Nombre del evento
  nferia: string // Nombre feria para ticket
  nlugar: string // Lugar para ticket
  motivoi: string // Nombre imagen motivo izquierdo
  motivod: string // Nombre imagen motivo derecho
  fecha: string // Fecha para la etiqueta
  localidad: string // Localidad para la etiqueta
}

/** Configuración de ticket / factura simplificada y contadores de rollos */
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

/** Configuración del código de etiqueta impreso en cada sello */
export interface CodigoConfig {
  modo: string // "P", "F", etc.
  mes: number // 0 = auto (usa mes actual), 1-12 = manual
  annio: string // "auto" | year string (2 dígitos)
  pais: string // "ES", "AD", etc.
  maquina: string // "CH17", "FI01", etc.
  cliente: number // Auto-incrementing session ID (0-9999)
  producto: number
}

/** Configuración de perfil activo, evento activo y modelos de sello */
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

/** Precios por tarifa configurados para el evento activo */
export interface PreciosConfig {
  tarifaA: number
  tarifaA2: number
  tarifaB: number
  tarifaC: number
  tarifaTA?: number // Tira tarifa A (4 etiquetas)
  tarifaT4?: number // Tira 4 tarifas (A+A2+B+C)
}

/** Configuración de imágenes de ferias (persistida en SQLite config) */
export interface ImagenesConfig {
  printSello: boolean
  activeFair: { year: string; fairName: string } | null
}

/** Configuración completa de la aplicación (documento único en SQLite) */
export interface AppConfig {
  ticket: TicketConfig
  codigo: CodigoConfig
  sello: SelloConfig
  precios: PreciosConfig
  imagenes?: ImagenesConfig
}
