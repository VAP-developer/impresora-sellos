/**
 * Order types for the Stamp Sales Desktop App.
 * These replicate the OrderLine structure from the legacy system (Orders collection).
 */

/** Línea de pedido/venta registrada en la base de datos */
export interface OrderLine {
  id?: number
  event: string // Nombre del evento o "ELIMINAR ANTERIOR" para anulaciones
  venue: string // Lugar del evento
  machine: string // Código de máquina (ej. "CH17")
  vendType: string // "Tarifa A Tira 4" | "Tira de 4 Tarifas" | "Etiqueta individual"
  productName: string // Nombre del producto/tarifa
  transactionDate: string // Fecha y hora de la transacción
  quantity: number // Cantidad de unidades vendidas
  quantitySet: number // 1 para simple, 4 para tiras
  totalStamps: number // quantity * quantitySet
  currency: string // "EUR"
  value: number // Importe total de la línea
  paymentStatus: string // Modo de impresión / perfil activo
  sesionId: number // ID de sesión (campo `cliente`)
  etiquetasRollo1: number // Etiquetas consumidas del rollo 1
  etiquetasRollo2: number // Etiquetas consumidas del rollo 2
  etiquetaMes: string // Mes formateado para código de etiqueta
  tituloEvento: string // Título del evento activo
  feria: string // Nombre de la feria
  lugar: string // Lugar de la feria
  fecha: string // Fecha del evento
  mes: number | string // Mes configurado (0 = auto)
  annio: string // Año configurado ("auto" o 2 dígitos)
  documento: string // Código de documento generado
}
