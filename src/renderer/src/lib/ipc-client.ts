/**
 * ipc-client.ts
 *
 * Typed wrapper over the ElectronAPI exposed via contextBridge.
 * Renderer code should import from here instead of accessing window.electronAPI directly.
 * This provides a single import point, better testability (mockable), and runtime safety.
 */

// Types are available globally via src/preload/index.d.ts (included in tsconfig.web.json).
// We re-declare the type alias here so consumers can import from this module.
type ElectronAPI = Window['electronAPI']
type AppConfig = Awaited<ReturnType<ElectronAPI['config']['get']>>
type PrinterInfo = Awaited<ReturnType<ElectronAPI['printer']['getStatus']>>[number]
type PrintJob = Awaited<ReturnType<ElectronAPI['printer']['getQueue']>>[number]

type OrderLine = Parameters<ElectronAPI['orders']['insert']>[0][number]
type KioskoQuantities = Parameters<ElectronAPI['printer']['print']>[1]

type TicketConfig = Parameters<ElectronAPI['config']['updateMaquina']>[0]['ticket'] extends
  Partial<infer T>
  ? T
  : never
type CodigoConfig = Parameters<ElectronAPI['config']['updateMaquina']>[0]['codigo'] extends
  Partial<infer T>
  ? T
  : never
type SelloConfig = Parameters<ElectronAPI['config']['updateImprimir']>[0]['sello'] extends
  Partial<infer T>
  ? T
  : never
type PreciosConfig = Parameters<ElectronAPI['config']['updateImprimir']>[0]['precios']

export type {
  AppConfig,
  CodigoConfig,
  ElectronAPI,
  KioskoQuantities,
  OrderLine,
  PreciosConfig,
  PrinterInfo,
  PrintJob,
  SelloConfig,
  TicketConfig
}

function getAPI(): ElectronAPI {
  const api = window.electronAPI
  if (!api) {
    throw new Error(
      'electronAPI is not available. Make sure the app is running inside Electron.'
    )
  }
  return api
}

// === Config ===

export async function getConfig(): Promise<AppConfig> {
  return getAPI().config.get()
}

export async function updateMaquina(data: {
  ticket: Partial<TicketConfig>
  codigo: Partial<CodigoConfig>
}): Promise<void> {
  return getAPI().config.updateMaquina(data)
}

export async function updateImprimir(data: {
  sello: Partial<SelloConfig>
  precios: PreciosConfig
}): Promise<void> {
  return getAPI().config.updateImprimir(data)
}

export async function updateSesion(): Promise<void> {
  return getAPI().config.updateSesion()
}

export async function updateSesionError(): Promise<void> {
  return getAPI().config.updateSesionError()
}

export async function updateRollos(
  sellos1: number,
  sellos2: number,
  tickets: number
): Promise<void> {
  return getAPI().config.updateRollos(sellos1, sellos2, tickets)
}

export async function updateRollosRevert(
  sellos1: number,
  sellos2: number,
  tickets: number
): Promise<void> {
  return getAPI().config.updateRollosRevert(sellos1, sellos2, tickets)
}

export async function initConfig(): Promise<void> {
  return getAPI().config.initConfig()
}

/**
 * Subscribe to config changes pushed from main process.
 * Returns an unsubscribe function.
 */
export function onConfigChange(callback: (config: AppConfig) => void): () => void {
  return getAPI().config.onChange(callback)
}

// === Orders ===

export async function insertOrders(orders: OrderLine[]): Promise<void> {
  return getAPI().orders.insert(orders)
}

export async function downloadCSV(): Promise<string> {
  return getAPI().orders.downloadCSV()
}

// === Images ===

export async function uploadImage(
  name: string,
  dataUri: string,
  type: string,
  size: number
): Promise<void> {
  return getAPI().images.upload(name, dataUri, type, size)
}

export async function removeImage(name: string): Promise<void> {
  return getAPI().images.remove(name)
}

export async function getImageByName(
  name: string
): Promise<{ name: string; url: string } | null> {
  return getAPI().images.getByName(name)
}

// === Printer ===

export async function getPrinterStatus(): Promise<PrinterInfo[]> {
  return getAPI().printer.getStatus()
}

export async function print(
  config: AppConfig,
  quantities: KioskoQuantities,
  profile: string
): Promise<void> {
  return getAPI().printer.print(config, quantities, profile)
}

export async function pausePrinter(): Promise<void> {
  return getAPI().printer.pause()
}

export async function resumePrinter(): Promise<void> {
  return getAPI().printer.resume()
}

export async function getPrintQueue(): Promise<PrintJob[]> {
  return getAPI().printer.getQueue()
}

export type DiscoveredPrinter = Awaited<ReturnType<ElectronAPI['printer']['discover']>>[number]

export async function discoverPrinters(): Promise<DiscoveredPrinter[]> {
  return getAPI().printer.discover()
}

export async function assignPrinter(
  target: 'printer1' | 'printer2' | 'ticket',
  uri: string
): Promise<{ success: boolean; error?: string }> {
  return getAPI().printer.assign(target, uri)
}

export async function getPrinterAssignments(): Promise<Record<string, string | undefined>> {
  return getAPI().printer.getAssignments()
}

// === Sync ===

export async function getSyncStatus(): Promise<{
  connected: boolean
  lastSync: string | null
  pending: number
}> {
  return getAPI().sync.getStatus()
}

export async function triggerSync(): Promise<void> {
  return getAPI().sync.triggerSync()
}

// === Sale ===

export type SaleOutcome = Awaited<ReturnType<ElectronAPI['sale']['execute']>>
export type CancelSaleOutcome = Awaited<ReturnType<ElectronAPI['sale']['cancel']>>
export type CancelSaleInput = Parameters<ElectronAPI['sale']['cancel']>[0]

export async function executeSale(
  config: AppConfig,
  quantities: KioskoQuantities,
  profile: string
): Promise<SaleOutcome> {
  return getAPI().sale.execute(config, quantities, profile)
}

export async function cancelSale(input: CancelSaleInput): Promise<CancelSaleOutcome> {
  return getAPI().sale.cancel(input)
}

// === Auto Launch ===

/**
 * Get the current auto-launch setting (Windows only).
 * Returns false on non-Windows platforms.
 */
export async function getAutoLaunchEnabled(): Promise<boolean> {
  return getAPI().autoLaunch.get()
}

/**
 * Enable or disable auto-launch on Windows startup.
 * Returns the new state after applying the change.
 */
export async function setAutoLaunchEnabled(enabled: boolean): Promise<boolean> {
  return getAPI().autoLaunch.set(enabled)
}
