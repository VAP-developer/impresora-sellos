/**
 * CartControls.tsx
 *
 * Central control panel for the Kiosko view, positioned between the two stamp models.
 * Displays the basket total, remaining budget, active print mode/profile,
 * master set and copy ticket indicators, and action buttons for:
 *   - Filatelia (profile-specific print)
 *   - Protocolo (profile-specific print)
 *   - SPDE (profile-specific print)
 *   - Error impresión (cancel last sale)
 *   - Imprimir Normal (confirm sale / print)
 *   - Reset / Cancel (clear all quantities)
 *
 * Replicates the "center controls" section of the legacy KioskoView.vue.
 *
 * Validates: Requirements 1.3, 1.4, 1.5, 4.5, 7.3, 7.4, 7.5, 10.1, 13.4
 * Correctness Properties: 1 (total calculation display)
 */

import { useCallback, useMemo, useState } from 'react'
import { useConfigStore } from '@renderer/stores/config.store'
import { useKioskoStore } from '@renderer/stores/kiosko.store'
import { calcUsedRollo1, calcUsedRollo2, calcUsedTickets } from '@renderer/lib/tariff-calc'
import * as ipc from '@renderer/lib/ipc-client'
import type { OrderLine } from '@renderer/types/order'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CartControlsProps {
  /** Optional callback invoked after a successful "Imprimir Normal" sale. */
  onPrintNormal?: () => void
  /** Handler invoked after a successful "Imprimir Filatelia" (profile-specific sale). */
  onPrintFilatelia?: () => void
  /** Handler invoked after a successful "Imprimir Protocolo" (profile-specific sale). */
  onPrintProtocolo?: () => void
  /** Handler invoked after a successful "Imprimir SPDE" (profile-specific sale). */
  onPrintSPDE?: () => void
  /** Handler for "Error Impresión" (cancel/revert last sale). */
  onPrintError?: () => void
  /** Handler for "Reset" (clear all quantities to 0). */
  onReset?: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CartControls({
  onPrintNormal,
  onPrintFilatelia,
  onPrintProtocolo,
  onPrintSPDE,
  onPrintError,
  onReset
}: CartControlsProps): JSX.Element {
  const config = useConfigStore((state) => state.config)
  const quantities = useKioskoStore((state) => state.quantities)
  const lastSale = useKioskoStore((state) => state.lastSale)
  const getTotal = useKioskoStore((state) => state.getTotal)
  const getLimite = useKioskoStore((state) => state.getLimite)
  const validateSale = useKioskoStore((state) => state.validateSale)
  const recordLastSale = useKioskoStore((state) => state.recordLastSale)
  const clearLastSale = useKioskoStore((state) => state.clearLastSale)
  const reset = useKioskoStore((state) => state.reset)

  const [printing, setPrinting] = useState(false)

  // Derive computed values from config
  const precios = config?.precios
  const ticket = config?.ticket
  const sello = config?.sello

  // Total cost of the current basket
  const total = useMemo(() => {
    if (!precios) return 0
    return getTotal(precios)
  }, [precios, quantities, getTotal])

  // Spending limit based on active profile
  const limite = useMemo(() => {
    if (!ticket || !sello) return 0
    return getLimite(ticket, sello)
  }, [ticket, sello, getLimite])

  // Remaining budget
  const budgetRemaining = limite - total

  // Active print mode / profile name
  const profileName = useMemo(() => {
    if (!sello) return ''
    const perfil = sello.elperfil
    if (perfil >= 1 && perfil <= 5) {
      const key = `nperfil${perfil}` as keyof typeof sello
      return (sello[key] as string) ?? ''
    }
    // Profile 6 (FERIA) shows no special mode label
    return ''
  }, [sello])

  // Print config indicators
  const imprimeMasterTicket = ticket?.ImprimeMasterTicket ?? 'N'
  const imprimeCopiaTicket = ticket?.ImprimeCopiaTicket ?? 'N'
  const tEmod1 = ticket?.TEmod1 ?? 'N'
  const tEmod2 = ticket?.TEmod2 ?? 'N'
  const t1especial = ticket?.T1especial ?? 0
  const t2especial = ticket?.T2especial ?? 0
  const t3especial = ticket?.T3especial ?? 0

  /**
   * Core sale handler used by all print buttons (normal and profile-specific).
   * Validates, records consumption, triggers IPC print with the given profile,
   * resets quantities on success.
   *
   * @param profile - The profile identifier: 'normal', 'filatelia', 'protocolo', or 'spde'
   * @param onSuccess - Optional callback invoked after a successful sale
   *
   * Validates: Requirements 1.3, 1.4, 1.5, 4.5, 7.3, 7.4, 7.5, 13.4
   */
  const handlePrint = useCallback(
    async (profile: string, onSuccess?: () => void) => {
      if (!config || printing) return

      // 1. Validate the sale
      const error = validateSale(config)
      if (error) {
        // Empty basket: silent reject (legacy behavior)
        if (error === 'empty') return
        // Show validation error to the user
        window.alert(error)
        return
      }

      setPrinting(true)

      try {
        // 2. Record consumption for potential error reversal
        const sellos1 = calcUsedRollo1(quantities)
        const sellos2 = calcUsedRollo2(quantities)
        const ticketsUsed = 2 + calcUsedTickets(quantities)
        recordLastSale(sellos1, sellos2, ticketsUsed)

        // 3. Call IPC to trigger the full sale flow in main process
        // Main process handles: increment session, decrement rolls, insert orders,
        // generate PDFs, and send to printers.
        // The profile parameter modifies the ticket title:
        //   - 'filatelia' -> "Filatelia de: {titulo_base}"
        //   - 'protocolo' -> "Protocolo de: {titulo_base}"
        //   - 'spde' -> "SPDE de: {titulo_base}"
        //   - 'normal' -> unchanged titulo_base
        await ipc.print(config, quantities, profile)

        // 4. Reset all quantities to zero after successful sale
        reset()

        // Notify parent if callback provided
        onSuccess?.()
      } catch (err) {
        console.error('[CartControls] Error during print:', err)
        window.alert('Error al procesar la impresión')
      } finally {
        setPrinting(false)
      }
    },
    [config, quantities, printing, validateSale, recordLastSale, reset]
  )

  /**
   * Handle "Imprimir Normal" button click.
   * Triggers a sale with the default (normal) profile.
   *
   * Validates: Requirements 1.3, 1.4, 1.5, 4.5
   */
  const handlePrintNormal = useCallback(async () => {
    await handlePrint('normal', onPrintNormal)
  }, [handlePrint, onPrintNormal])

  /**
   * Handle "Imprimir Filatelia" button click.
   * Triggers a sale with profile 'filatelia', which modifies the ticket title
   * to "Filatelia de: {titulo_base}".
   *
   * Validates: Requirements 7.3, 13.4
   */
  const handlePrintFilatelia = useCallback(async () => {
    await handlePrint('filatelia', onPrintFilatelia)
  }, [handlePrint, onPrintFilatelia])

  /**
   * Handle "Imprimir Protocolo" button click.
   * Triggers a sale with profile 'protocolo', which modifies the ticket title
   * to "Protocolo de: {titulo_base}".
   *
   * Validates: Requirements 7.4, 13.4
   */
  const handlePrintProtocolo = useCallback(async () => {
    await handlePrint('protocolo', onPrintProtocolo)
  }, [handlePrint, onPrintProtocolo])

  /**
   * Handle "Imprimir SPDE" button click.
   * Triggers a sale with profile 'spde', which modifies the ticket title
   * to "SPDE de: {titulo_base}".
   *
   * Validates: Requirements 7.5, 13.4
   */
  const handlePrintSPDE = useCallback(async () => {
    await handlePrint('spde', onPrintSPDE)
  }, [handlePrint, onPrintSPDE])

  /**
   * Handle "Error Impresión" button click — anular (cancel) last sale.
   *
   * Flow:
   * 1. Ask for confirmation (window.confirm)
   * 2. Check if there is a previous sale to revert (lastSale.sellos1 or sellos2 > 0)
   * 3. Call IPC updateSesionError to decrement session ID (cliente -1)
   * 4. Call IPC updateRollosRevert to restore roll/ticket quantities
   * 5. Insert an audit order record with event="ELIMINAR ANTERIOR"
   * 6. Clear lastSale record and reset quantities
   *
   * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5
   */
  const handlePrintError = useCallback(async () => {
    if (!config || printing) return

    // 1. Ask for confirmation
    const confirmed = window.confirm(
      '¿Error de IMPRESIÓN? ¡Se procederá a ANULAR la VENTA ANTERIOR!'
    )
    if (!confirmed) {
      return
    }

    // 2. Check if there is a previous sale to revert
    if (lastSale.sellos1 <= 0 && lastSale.sellos2 <= 0) {
      window.alert('¡¡NINGUNA venta encontrada!!')
      return
    }

    setPrinting(true)

    try {
      // 3. Decrement session ID (revert the increment from last sale)
      await ipc.updateSesionError()

      // 4. Revert roll and ticket quantities
      await ipc.updateRollosRevert(lastSale.sellos1, lastSale.sellos2, lastSale.tickets)

      // 5. Insert audit order record with event="ELIMINAR ANTERIOR"
      const errorOrder: OrderLine = {
        event: 'ELIMINAR ANTERIOR',
        venue: ' ',
        machine: 'error de impresión',
        vendType: ' ',
        productName: ' ',
        transactionDate: '',
        quantity: 0,
        quantitySet: 0,
        totalStamps: 0,
        currency: ' ',
        value: 0,
        paymentStatus: 'Error',
        sesionId: config.codigo.cliente,
        etiquetasRollo1: 0,
        etiquetasRollo2: 0,
        etiquetaMes: ' ',
        tituloEvento: 'Error',
        feria: config.sello?.feria ?? '',
        lugar: config.sello?.lugar ?? '',
        fecha: 'Error',
        mes: 'Error',
        annio: 'Error',
        documento: 'Error'
      }

      await ipc.insertOrders([errorOrder])

      // 6. Clear last sale record and reset quantities
      clearLastSale()
      reset()

      // Notify parent if callback provided
      onPrintError?.()
    } catch (err) {
      console.error('[CartControls] Error during print error reversal:', err)
      window.alert('Error al anular la venta')
    } finally {
      setPrinting(false)
    }
  }, [config, printing, lastSale, clearLastSale, reset, onPrintError])

  return (
    <div
      className="flex items-center justify-center p-4"
      role="region"
      aria-label="Controles de cesta"
    >
      {/* Left column: Filatelia + Error buttons */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          className="w-[80px] h-[65px] bg-purple-700 hover:bg-purple-800 text-white rounded
                     flex items-center justify-center text-xs font-bold cursor-pointer
                     transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400
                     disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Imprimir Filatelia"
          disabled={printing}
          onClick={handlePrintFilatelia}
        >
          Filatelia
        </button>
        <button
          type="button"
          className="w-[70px] h-[70px] bg-red-600 hover:bg-red-700 text-white rounded-full
                     flex items-center justify-center cursor-pointer
                     transition-colors focus:outline-none focus:ring-2 focus:ring-red-400
                     disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Error impresión - anular última venta"
          disabled={printing}
          onClick={handlePrintError}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-8 h-8"
            aria-hidden="true"
          >
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            <line x1="4" y1="4" x2="22" y2="20" />
          </svg>
        </button>
      </div>

      {/* Center column: Budget, Total, Mode, Indicators */}
      <div className="flex flex-col items-center gap-1 mx-6">
        {/* Remaining budget */}
        <p className="text-center text-gray-500 text-sm font-bold" aria-label="Presupuesto restante">
          {budgetRemaining.toFixed(2)} €
        </p>

        {/* Basket total */}
        <h2
          className="text-center text-xl font-bold"
          aria-label="Total de la cesta"
          aria-live="polite"
        >
          Cesta {total.toFixed(2)}€
        </h2>

        {/* Active profile/mode */}
        {profileName && (
          <p className="text-center text-red-700 text-lg font-bold" aria-label="Modo de impresión activo">
            {profileName}
          </p>
        )}

        {/* Master set indicator */}
        <p className="text-center text-blue-600 text-xs font-bold">
          {imprimeMasterTicket}: MASTER SET
        </p>

        {/* Copy ticket + special tira indicators */}
        <p className="text-center text-red-700 text-[10px] font-bold leading-tight">
          {imprimeCopiaTicket}: COPIA TICKET
          <br />
          {tEmod1}/{tEmod2} (€: {t1especial}-{t2especial}-{t3especial})
        </p>
      </div>

      {/* Right column: Print Normal + Reset + Profile buttons */}
      <div className="flex flex-col items-center gap-2">
        {/* Print Normal (shopping cart icon) */}
        <button
          type="button"
          className="bg-transparent border-none cursor-pointer p-0
                     hover:opacity-80 transition-opacity
                     focus:outline-none focus:ring-2 focus:ring-[rgb(24,62,117)] rounded
                     disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Imprimir normal - confirmar venta"
          disabled={printing}
          onClick={handlePrintNormal}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgb(24,62,117)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-16 h-16"
            aria-hidden="true"
          >
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
        </button>

        {/* Reset / Cancel button */}
        <button
          type="button"
          className="w-[50px] h-[50px] bg-gray-200 hover:bg-gray-300 rounded-full
                     flex items-center justify-center cursor-pointer
                     transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
          aria-label="Reset - limpiar cantidades"
          onClick={() => {
            reset()
            onReset?.()
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-6 h-6 text-red-600"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Protocolo button */}
        <button
          type="button"
          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded
                     text-xs font-bold cursor-pointer transition-colors
                     focus:outline-none focus:ring-2 focus:ring-green-400
                     disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Imprimir Protocolo"
          disabled={printing}
          onClick={handlePrintProtocolo}
        >
          Protocolo
        </button>

        {/* SPDE button */}
        <button
          type="button"
          className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded
                     text-xs font-bold cursor-pointer transition-colors
                     focus:outline-none focus:ring-2 focus:ring-orange-400
                     disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Imprimir SPDE"
          disabled={printing}
          onClick={handlePrintSPDE}
        >
          SPDE
        </button>
      </div>
    </div>
  )
}
