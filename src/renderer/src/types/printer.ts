/**
 * Printer types for the Stamp Sales Desktop App.
 * These define the printer status and print job structures
 * used for communication between renderer and main process.
 */

/** Información de una impresora conectada al sistema */
export interface PrinterInfo {
  id: string // Identificador único de la impresora
  name: string // Nombre visible de la impresora
  target: 'printer1' | 'printer2' | 'ticket' // Destino asignado (etiquetas modelo1, modelo2, o tickets)
  status: 'ready' | 'busy' | 'error' | 'disconnected' | 'paused' // Estado actual
  uri: string // URI de conexión (IPP o CUPS)
}

/** Trabajo de impresión en la cola */
export interface PrintJob {
  id: number
  orderId?: number // Referencia al pedido asociado (opcional)
  printerTarget: 'printer1' | 'printer2' | 'ticket' // Impresora destino
  pdfType: string // Tipo de PDF: "stamp_simple", "stamp_tira", "ticket", etc.
  status: 'pending' | 'printing' | 'completed' | 'error' // Estado del trabajo
  filePath?: string // Ruta al archivo PDF generado
  attempts: number // Número de intentos de impresión realizados
  errorMessage?: string // Mensaje de error si status = 'error'
}
