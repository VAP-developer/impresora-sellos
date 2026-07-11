import { contextBridge, ipcRenderer } from 'electron'

// === Config Types ===

export interface TicketConfig {
  feria: string
  lugar: string
  fecha: string
  hora: string
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
  TEmod1?: string
  TEmod2?: string
  ImprimeCopiaTicket?: string
  ImprimeMasterTicket?: string
  bloqueado?: string
}

export interface CodigoConfig {
  modo: string
  mes: number
  annio: string
  pais: string
  maquina: string
  cliente: number
  producto: number
}

export interface EventoData {
  nevento: string
  nferia: string
  nlugar: string
  motivoi: string
  motivod: string
  fecha: string
  localidad: string
  codigo?: string
}

export interface SelloConfig {
  elperfil: number
  elnperfil: string
  elevento: number
  elnevento: string
  feria: string
  lugar: string
  modelo1: string
  modelo2: string
  modo: number
  nperfil1: string
  nperfil2: string
  nperfil3: string
  nperfil4: string
  nperfil5: string
  nperfil6: string
  eventos: EventoData[]
}

export interface PreciosConfig {
  tarifaA: number
  tarifaA2: number
  tarifaB: number
  tarifaC: number
  tarifaTA?: number
  tarifaT4?: number
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

// === Order Types ===

export interface OrderLine {
  id?: number
  event: string
  venue: string
  machine: string
  vendType: string
  productName: string
  transactionDate: string
  quantity: number
  quantitySet: number
  totalStamps: number
  currency: string
  value: number
  paymentStatus: string
  sesionId: number
  etiquetasRollo1: number
  etiquetasRollo2: number
  etiquetaMes: string
  tituloEvento: string
  feria: string
  lugar: string
  fecha: string
  mes: number | string
  annio: string
  documento: string
}

// === Kiosko Types ===

export interface KioskoQuantities {
  tarifaAS1: number
  tarifaA2S1: number
  tarifaBS1: number
  tarifaCS1: number
  tarifaAT1: number
  tarifa4T1: number
  tarifaAS2: number
  tarifaA2S2: number
  tarifaBS2: number
  tarifaCS2: number
  tarifaAT2: number
  tarifa4T2: number
}

// === Printer Types ===

export interface PrinterInfo {
  id: string
  name: string
  target: 'printer1' | 'printer2' | 'ticket'
  status: 'ready' | 'busy' | 'error' | 'disconnected' | 'paused'
  uri: string
}

export interface DiscoveredPrinter {
  name: string
  uri: string
  accepting: boolean
  info?: string
}

export interface PrintJob {
  id: number
  orderId?: number
  printerTarget: 'printer1' | 'printer2' | 'ticket'
  pdfType: string
  status: 'pending' | 'printing' | 'completed' | 'error'
  filePath?: string
  attempts: number
  errorMessage?: string
}

// === Sale Types ===

export interface SaleResult {
  success: true
  sesionId: number
  sellos1: number
  sellos2: number
  tickets: number
  orders: OrderLine[]
  /** Total number of PDFs generated (stamps + tickets), undefined if PDF generation not yet run */
  pdfCount?: number
  /** Number of stamp PDFs generated */
  stampCount?: number
  /** Number of ticket PDFs generated */
  ticketCount?: number
  /** Error message if PDF generation failed (sale data still committed) */
  pdfError?: string
  /** IDs of jobs created in the print queue */
  printJobIds?: number[]
}

export interface SaleError {
  success: false
  error: string
}

export type SaleOutcome = SaleResult | SaleError

// === Cancel Sale Types ===

export interface CancelSaleInput {
  /** Number of stamps consumed from rollo1 in the sale being cancelled */
  sellos1: number
  /** Number of stamps consumed from rollo2 in the sale being cancelled */
  sellos2: number
  /** Number of tickets consumed in the sale being cancelled */
  tickets: number
}

export interface CancelSaleResult {
  success: true
  /** The session ID after decrementing (the reverted value) */
  sesionId: number
}

export interface CancelSaleError {
  success: false
  error: string
}

export type CancelSaleOutcome = CancelSaleResult | CancelSaleError

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

// === ElectronAPI Interface ===

// === Sale Image Flags ===

/** Flags passed from frontend to control image layer composition during PDF generation */
export interface SaleImageFlags {
  printFondo: boolean
  printSello: boolean
}

// === ElectronAPI Interface ===

export interface ElectronAPI {
  sale: {
    execute(config: AppConfig, quantities: KioskoQuantities, profile: string, imageFlags?: SaleImageFlags): Promise<SaleOutcome>
    cancel(input: CancelSaleInput): Promise<CancelSaleOutcome>
  }
  config: {
    get(): Promise<AppConfig>
    updateMaquina(data: {
      ticket: Partial<TicketConfig>
      codigo: Partial<CodigoConfig>
    }): Promise<void>
    updateImprimir(data: {
      sello: Partial<SelloConfig>
      precios: PreciosConfig
    }): Promise<void>
    updateSesion(): Promise<void>
    updateSesionError(): Promise<void>
    updateRollos(sellos1: number, sellos2: number, tickets: number): Promise<void>
    updateRollosRevert(sellos1: number, sellos2: number, tickets: number): Promise<void>
    initConfig(): Promise<void>
    getImagenes(): Promise<ImagenesConfig>
    updateImagenes(data: ImagenesConfig): Promise<void>
    onChange(callback: (config: AppConfig) => void): () => void
  }
  orders: {
    insert(orders: OrderLine[]): Promise<void>
    downloadCSV(): Promise<string>
  }
  images: {
    upload(name: string, dataUri: string, type: string, size: number): Promise<void>
    remove(name: string): Promise<void>
    getByName(name: string): Promise<{ name: string; url: string } | null>
    getFairList(): Promise<Array<{ year: string; fairName: string }>>
    getByFair(
      year: string,
      fairName: string
    ): Promise<{ fondo: string | null; sello: string | null }>
    getSyncStatus(): Promise<{
      inserted: number
      updated: number
      deleted: number
      unchanged: number
      errors: Array<{ path: string; error: string }>
    } | null>
    resync(): Promise<{
      inserted: number
      updated: number
      deleted: number
      unchanged: number
      errors: Array<{ path: string; error: string }>
    }>
  }
  printer: {
    getStatus(): Promise<PrinterInfo[]>
    print(config: AppConfig, quantities: KioskoQuantities, profile: string): Promise<void>
    pause(): Promise<void>
    resume(): Promise<void>
    getQueue(): Promise<PrintJob[]>
    discover(): Promise<DiscoveredPrinter[]>
    assign(target: 'printer1' | 'printer2' | 'ticket', uri: string): Promise<{ success: boolean; error?: string }>
    getAssignments(): Promise<Record<string, string | undefined>>
  }
  sync: {
    getStatus(): Promise<{ connected: boolean; lastSync: string | null; pending: number }>
    triggerSync(): Promise<void>
  }
  autoLaunch: {
    get(): Promise<boolean>
    set(enabled: boolean): Promise<boolean>
  }
  eventos: {
    getYears(): Promise<number[]>
    getByYear(year: number): Promise<EventoRow[]>
    getById(id: number): Promise<EventoRow | null>
    create(input: EventoInput): Promise<EventoRow>
    update(id: number, input: Partial<EventoInput>): Promise<EventoRow | null>
    delete(id: number): Promise<boolean>
  }
}

// === IPC API Implementation ===

const api: ElectronAPI = {
  sale: {
    execute: (config, quantities, profile, imageFlags) =>
      ipcRenderer.invoke('sale:execute', config, quantities, profile, imageFlags),
    cancel: (input) => ipcRenderer.invoke('sale:cancel', input)
  },
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    updateMaquina: (data) => ipcRenderer.invoke('config:updateMaquina', data),
    updateImprimir: (data) => ipcRenderer.invoke('config:updateImprimir', data),
    updateSesion: () => ipcRenderer.invoke('config:updateSesion'),
    updateSesionError: () => ipcRenderer.invoke('config:updateSesionError'),
    updateRollos: (sellos1, sellos2, tickets) =>
      ipcRenderer.invoke('config:updateRollos', sellos1, sellos2, tickets),
    updateRollosRevert: (sellos1, sellos2, tickets) =>
      ipcRenderer.invoke('config:updateRollosRevert', sellos1, sellos2, tickets),
    initConfig: () => ipcRenderer.invoke('config:initConfig'),
    getImagenes: () => ipcRenderer.invoke('config:getImagenes'),
    updateImagenes: (data) => ipcRenderer.invoke('config:updateImagenes', data),
    onChange: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, config: AppConfig): void => {
        callback(config)
      }
      ipcRenderer.on('config:changed', handler)
      return () => {
        ipcRenderer.removeListener('config:changed', handler)
      }
    }
  },
  orders: {
    insert: (orders) => ipcRenderer.invoke('orders:insert', orders),
    downloadCSV: () => ipcRenderer.invoke('orders:downloadCSV')
  },
  images: {
    upload: (name, dataUri, type, size) =>
      ipcRenderer.invoke('images:upload', name, dataUri, type, size),
    remove: (name) => ipcRenderer.invoke('images:remove', name),
    getByName: (name) => ipcRenderer.invoke('images:getByName', name),
    getFairList: () => ipcRenderer.invoke('images:getFairList'),
    getByFair: (year, fairName) => ipcRenderer.invoke('images:getByFair', year, fairName),
    getSyncStatus: () => ipcRenderer.invoke('images:getSyncStatus'),
    resync: () => ipcRenderer.invoke('images:resync')
  },
  printer: {
    getStatus: () => ipcRenderer.invoke('printer:getStatus'),
    print: (config, quantities, profile) =>
      ipcRenderer.invoke('printer:print', config, quantities, profile),
    pause: () => ipcRenderer.invoke('printer:pause'),
    resume: () => ipcRenderer.invoke('printer:resume'),
    getQueue: () => ipcRenderer.invoke('printer:getQueue'),
    discover: () => ipcRenderer.invoke('printer:discover'),
    assign: (target, uri) => ipcRenderer.invoke('printer:assign', target, uri),
    getAssignments: () => ipcRenderer.invoke('printer:getAssignments')
  },
  sync: {
    getStatus: () => ipcRenderer.invoke('sync:getStatus'),
    triggerSync: () => ipcRenderer.invoke('sync:triggerSync')
  },
  autoLaunch: {
    get: () => ipcRenderer.invoke('autoLaunch:get'),
    set: (enabled) => ipcRenderer.invoke('autoLaunch:set', enabled)
  },
  eventos: {
    getYears: () => ipcRenderer.invoke('eventos:getYears'),
    getByYear: (year) => ipcRenderer.invoke('eventos:getByYear', year),
    getById: (id) => ipcRenderer.invoke('eventos:getById', id),
    create: (input) => ipcRenderer.invoke('eventos:create', input),
    update: (id, input) => ipcRenderer.invoke('eventos:update', id, input),
    delete: (id) => ipcRenderer.invoke('eventos:delete', id)
  }
}

// Expose the typed API to the renderer via contextBridge
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', api)
  } catch (error) {
    console.error('Failed to expose electronAPI via contextBridge:', error)
  }
} else {
  // Fallback for non-isolated contexts (development/testing)
  // @ts-ignore (define in dts)
  window.electronAPI = api
}
