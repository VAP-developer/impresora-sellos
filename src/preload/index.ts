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

export interface AppConfig {
  ticket: TicketConfig
  codigo: CodigoConfig
  sello: SelloConfig
  precios: PreciosConfig
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

// === ElectronAPI Interface ===

export interface ElectronAPI {
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
  }
  printer: {
    getStatus(): Promise<PrinterInfo[]>
    print(config: AppConfig, quantities: KioskoQuantities, profile: string): Promise<void>
    pause(): Promise<void>
    resume(): Promise<void>
    getQueue(): Promise<PrintJob[]>
  }
  sync: {
    getStatus(): Promise<{ connected: boolean; lastSync: string | null; pending: number }>
    triggerSync(): Promise<void>
  }
}

// === IPC API Implementation ===

const api: ElectronAPI = {
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
    getByName: (name) => ipcRenderer.invoke('images:getByName', name)
  },
  printer: {
    getStatus: () => ipcRenderer.invoke('printer:getStatus'),
    print: (config, quantities, profile) =>
      ipcRenderer.invoke('printer:print', config, quantities, profile),
    pause: () => ipcRenderer.invoke('printer:pause'),
    resume: () => ipcRenderer.invoke('printer:resume'),
    getQueue: () => ipcRenderer.invoke('printer:getQueue')
  },
  sync: {
    getStatus: () => ipcRenderer.invoke('sync:getStatus'),
    triggerSync: () => ipcRenderer.invoke('sync:triggerSync')
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
