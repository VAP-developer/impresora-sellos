/**
 * KioskoView.tsx
 *
 * Vista principal de venta. Layout dividido en dos mitades:
 * - Izquierda: Sello A (Modelo 1 / printer1) con su imagen y tabla de tarifas
 * - Derecha: Sello B (Modelo 2 / printer2) con su imagen y tabla de tarifas
 * - Abajo: Controles de impresión y contadores de rollos
 *
 * Dynamically loads the tariff group associated with the active event.
 * Falls back to static TariffTableSplit when no dynamic group is active.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useConfigStore } from '@renderer/stores/config.store'
import { useKioskoStore } from '@renderer/stores/kiosko.store'
import { getEventoById, getTariffGroupById } from '@renderer/lib/ipc-client'
import StampModelSingle from '@renderer/components/kiosko/StampModelSingle'
import TariffTableSplit from '@renderer/components/kiosko/TariffTableSplit'
import DynamicTariffTable from '@renderer/components/kiosko/DynamicTariffTable'
import CartControls from '@renderer/components/kiosko/CartControls'
import { useVirtualKeyboard } from '@renderer/components/virtual-keyboard/VirtualKeyboardContext'
import { NumericKeypad } from '@renderer/components/virtual-keyboard/NumericKeypad'
import logoSvvs from '@renderer/assets/logo-gibraltar.svg'

export default function KioskoView(): JSX.Element {
  const { t } = useTranslation()
  const config = useConfigStore((state) => state.config)
  const activeTariffGroup = useKioskoStore((state) => state.activeTariffGroup)
  const setActiveTariffGroup = useKioskoStore((state) => state.setActiveTariffGroup)
  const setActiveEvento = useKioskoStore((state) => state.setActiveEvento)
  const getRemainingRollo1 = useKioskoStore((state) => state.getRemainingRollo1)
  const getRemainingRollo2 = useKioskoStore((state) => state.getRemainingRollo2)
  const quantities = useKioskoStore((state) => state.quantities)

  const ticket = config?.ticket

  // Roll remaining values for display next to stamps
  const remainingRollo1 = useMemo(() => {
    if (!ticket) return 0
    return getRemainingRollo1(ticket)
  }, [ticket, quantities, getRemainingRollo1])

  const remainingRollo2 = useMemo(() => {
    if (!ticket) return 0
    return getRemainingRollo2(ticket)
  }, [ticket, quantities, getRemainingRollo2])

  const rollo1Installed = (ticket?.rollo1 ?? 0) !== -1
  const rollo2Installed = (ticket?.rollo2 ?? 0) !== -1

  // El teclado numérico anclado no debe superar nunca la altura real del
  // contenido de la tabla de tarifas. Medimos la altura de la tabla con un
  // ResizeObserver y la usamos como tope (max-height) para la columna del
  // teclado. Si sobra espacio, queda en blanco debajo del teclado.
  const tableRef = useRef<HTMLDivElement | null>(null)
  const [tableHeight, setTableHeight] = useState<number | null>(null)

  useEffect(() => {
    const el = tableRef.current
    if (!el) return

    const measure = (): void => {
      // Medimos la altura del CONTENIDO real de la tabla (el primer hijo de la
      // columna), no la columna en sí: la columna tiene h-full y siempre ocupa
      // todo el alto disponible, mientras que su hijo (la tarjeta blanca de la
      // tabla) mide solo lo que necesita su contenido.
      const content = el.firstElementChild as HTMLElement | null
      const h = content ? content.getBoundingClientRect().height : el.scrollHeight
      setTableHeight(h)
    }

    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(el)
    const child = el.firstElementChild
    if (child) observer.observe(child)

    return () => observer.disconnect()
  }, [activeTariffGroup])

  // En la vista Kiosko el teclado numérico se ancla: ocupa un espacio fijo en
  // la mitad derecha y permanece siempre visible (no aparece/desaparece al
  // enfocar un input). Se desancla al salir de la vista para que el resto de
  // la app mantenga el teclado flotante dinámico.
  const { enabled: keyboardEnabled, setPinned } = useVirtualKeyboard()

  useEffect(() => {
    if (!keyboardEnabled) return
    setPinned(true)
    return () => setPinned(false)
  }, [keyboardEnabled, setPinned])

  // Load the tariff group from the active event when the view mounts
  // or when the active event changes (config.sello.elevento)
  const activeEventId = config?.sello.elevento ?? 0

  useEffect(() => {
    let cancelled = false

    async function loadTariffGroup(): Promise<void> {
      if (!activeEventId || activeEventId <= 0) {
        setActiveTariffGroup(null)
        setActiveEvento(null)
        return
      }

      try {
        const evento = await getEventoById(activeEventId)
        if (cancelled) return

        if (!evento || !evento.tariff_group_id) {
          setActiveTariffGroup(null)
          setActiveEvento(null)
          return
        }

        const group = await getTariffGroupById(evento.tariff_group_id)
        if (cancelled) return

        setActiveTariffGroup(group)
        setActiveEvento(evento)
      } catch {
        // If loading fails, fall back to no dynamic group
        if (!cancelled) {
          setActiveTariffGroup(null)
          setActiveEvento(null)
        }
      }
    }

    loadTariffGroup()

    return () => {
      cancelled = true
    }
  }, [activeEventId, setActiveTariffGroup, setActiveEvento])

  return (
    <div className="flex flex-col h-full min-h-0 p-2 gap-2">
      {/* Top: Roll1 counter | Sello A | Cart Controls | Sello B | Roll2 counter */}
      <div className="flex items-stretch gap-2 bg-white rounded py-3 shrink-0">
        {/*
          Left 75% (encima de la tabla). Usamos el MISMO grid de columnas que
          TariffTableContent (1.2fr 3fr 4fr 3fr 1.2fr 2fr) para que el centro de
          cada elemento quede alineado con el centro de su columna en la tabla:
            col1 Límite    -> Rollo 1
            col2 Cantidad  -> Sello A
            col3 Modalidad -> Logo
            col4 Cantidad  -> Sello B
            col5 Límite    -> Rollo 2
            col6 Precio    -> (vacío)
        */}
        <div className="w-[75%] min-w-0 grid grid-cols-[1.2fr_3fr_4fr_3fr_1.2fr_2fr] items-center">
          {/* Col 1 (Límite): Rollo 1 */}
          <div className="flex flex-col items-center justify-center">
            <span className="text-xs text-gray-500 font-medium">{t('kiosko.roll')}</span>
            <span className={`text-2xl font-bold ${rollo1Installed ? 'text-[rgb(24,62,117)]' : 'text-gray-400'}`}>
              {rollo1Installed ? remainingRollo1 : 0}
            </span>
          </div>

          {/* Col 2 (Cantidad): Sello A */}
          <div className="flex justify-center">
            <StampModelSingle model="A" />
          </div>

          {/* Col 3 (Modalidad): Logo SvvS */}
          <div className="flex justify-center">
            <img src={logoSvvs} alt={t('kiosko.logoAlt')} className="h-[7.5rem] w-auto object-contain" />
          </div>

          {/* Col 4 (Cantidad): Sello B */}
          <div className="flex justify-center">
            <StampModelSingle model="B" />
          </div>

          {/* Col 5 (Límite): Rollo 2 */}
          <div className="flex flex-col items-center justify-center">
            <span className="text-xs text-gray-500 font-medium">{t('kiosko.roll')}</span>
            <span className={`text-2xl font-bold ${rollo2Installed ? 'text-[rgb(24,62,117)]' : 'text-gray-400'}`}>
              {rollo2Installed ? remainingRollo2 : 0}
            </span>
          </div>

          {/* Col 6 (Precio): vacío para mantener la alineación */}
          <div aria-hidden="true" />
        </div>

        {/* Right 25% (encima del teclado): cesta con botones y precios */}
        <div className="w-[25%] min-w-0 flex items-center justify-center">
          <CartControls />
        </div>
      </div>

      {/*
        Middle: tariff table on the LEFT half. The RIGHT half is a fixed area
        that permanently hosts the numeric keyboard while this view is mounted
        (pinned mode), so it never overlaps the table and is always available.
      */}
      <div className="flex items-stretch gap-2 flex-1 min-h-0">
        {/* Left 75%: tariff table (scrolls internally if it doesn't fit) */}
        <div ref={tableRef} className="w-[75%] min-w-0 h-full overflow-auto">
          {activeTariffGroup ? <DynamicTariffTable /> : <TariffTableSplit />}
        </div>

        {/*
          Right 25%: numeric keyboard. Se alinea arriba y su altura se limita a
          la altura real de la tabla (tableHeight), de modo que el teclado nunca
          sea más alto que la tabla. El espacio sobrante queda en blanco abajo.
        */}
        <div
          className="w-[25%] min-w-0 self-start min-h-0 max-h-full"
          data-keyboard-slot="true"
          style={{ height: tableHeight != null ? tableHeight : '100%' }}
        >
          {keyboardEnabled && <NumericKeypad pinned />}
        </div>
      </div>
    </div>
  )
}
