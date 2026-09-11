/**
 * VirtualKeyboardContext.tsx
 *
 * Context global para el teclado virtual. Gestiona:
 * - Estado de visibilidad y tipo de teclado (numérico/completo)
 * - Referencia al input activo
 * - API para pulsaciones de teclas (pressKey, pressBackspace, clearInput)
 * - Lectura de configuración desde el settings store
 *
 * La detección de focus (focusin/mousedown) se implementa en la tarea 5.2.
 * La lógica avanzada de pulsación con posición de cursor se implementa en la tarea 5.3.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { setNativeValue } from './keyboard-utils'

// ─── Context Value Interface ──────────────────────────────────────────────────

export interface VirtualKeyboardContextValue {
  /** Si el teclado virtual está habilitado globalmente */
  enabled: boolean
  /** Idioma del layout del teclado completo */
  keyboardLanguage: 'es' | 'en'
  /** Referencia al input actualmente enfocado */
  activeInput: HTMLInputElement | null
  /** Tipo de teclado a mostrar */
  keyboardType: 'numeric' | 'full' | null
  /** Si el teclado está visible en pantalla */
  isVisible: boolean
  /**
   * Modo anclado: cuando está activo el teclado numérico permanece siempre
   * visible ocupando un espacio fijo (usado en la vista Kiosko). No se oculta
   * al hacer click fuera y el overlay flotante global queda suprimido.
   */
  pinned: boolean
  /** Activa/desactiva el modo anclado */
  setPinned(pinned: boolean): void
  /** Muestra el teclado para un input específico */
  showKeyboard(input: HTMLInputElement, type: 'numeric' | 'full'): void
  /** Oculta el teclado */
  hideKeyboard(): void
  /** Envía una pulsación de tecla al input activo */
  pressKey(key: string): void
  /** Borra el último carácter del input activo */
  pressBackspace(): void
  /** Limpia el input activo */
  clearInput(): void
}

// ─── Context Creation ─────────────────────────────────────────────────────────

const VirtualKeyboardContext = createContext<VirtualKeyboardContextValue | null>(null)

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVirtualKeyboard(): VirtualKeyboardContextValue {
  const context = useContext(VirtualKeyboardContext)
  if (!context) {
    throw new Error('useVirtualKeyboard must be used within a VirtualKeyboardProvider')
  }
  return context
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface VirtualKeyboardProviderProps {
  children: ReactNode
}

export function VirtualKeyboardProvider({ children }: VirtualKeyboardProviderProps): React.JSX.Element {
  // Leer configuración desde el settings store
  const virtualKeyboardEnabled = useSettingsStore((s) => s.virtualKeyboardEnabled)
  const virtualKeyboardLanguage = useSettingsStore((s) => s.virtualKeyboardLanguage)

  // Estado local del teclado
  const [activeInput, setActiveInput] = useState<HTMLInputElement | null>(null)
  const [keyboardType, setKeyboardType] = useState<'numeric' | 'full' | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [pinned, setPinned] = useState(false)

  // Ref espejo de `pinned` para leerlo dentro de callbacks/handlers estables
  // (hideKeyboard y los listeners del effect) sin recrearlos.
  const pinnedRef = useRef(pinned)
  useEffect(() => {
    pinnedRef.current = pinned
    if (pinned) {
      // Al anclar, mostrar el teclado numérico de inmediato aunque no haya
      // ningún input enfocado todavía.
      setKeyboardType('numeric')
      setIsVisible(true)
    } else {
      // Al desanclar (p. ej. al salir de la vista Kiosko), ocultar y limpiar el
      // teclado para que no quede visible en la siguiente pestaña. Solo se
      // volverá a abrir cuando el usuario enfoque un input.
      setIsVisible(false)
      setActiveInput(null)
      setKeyboardType(null)
    }
  }, [pinned])

  // ─── Callbacks ────────────────────────────────────────────────────────────

  const showKeyboard = useCallback((input: HTMLInputElement, type: 'numeric' | 'full') => {
    setActiveInput(input)
    setKeyboardType(type)
    setIsVisible(true)
  }, [])

  const hideKeyboard = useCallback(() => {
    // En modo anclado el teclado nunca se oculta; solo se limpia el input activo
    // para que la siguiente pulsación no escriba en un campo obsoleto.
    if (pinnedRef.current) {
      setActiveInput(null)
      return
    }
    setIsVisible(false)
    setActiveInput(null)
    setKeyboardType(null)
  }, [])

  const pressKey = useCallback((key: string) => {
    if (!activeInput || !document.contains(activeInput)) return

    // Los campos decimales son inputs de texto con inputMode="decimal"
    // (precios de tarifa, etc.). El resto de campos numéricos son enteros
    // (nº de corte, unidades del kiosko, rollos...) y no admiten separador.
    const allowsDecimal = activeInput.inputMode === 'decimal'

    // En campos enteros, la tecla decimal no debe hacer nada: en un
    // input type="number" insertar "." descartaría el valor (lo vaciaría).
    if (key === 'decimal' && !allowsDecimal) return

    // Resolver la tecla decimal. Siempre se inserta un PUNTO como separador,
    // porque toda la app formatea y muestra los precios con punto
    // (formatPrice usa value.toFixed(2) → "12.50"). Así lo que escribe el
    // usuario coincide con lo que ve en el resto de la interfaz.
    let charToInsert = key
    if (key === 'decimal') {
      charToInsert = '.'
    }

    const currentValue = activeInput.value
    // selectionStart/selectionEnd are null for input type="number"
    const selStart = activeInput.selectionStart ?? currentValue.length
    const selEnd = activeInput.selectionEnd ?? currentValue.length
    const hasSelection = selStart !== selEnd

    // Evitar un segundo separador decimal si ya existe uno en el valor
    if (key === 'decimal' && !hasSelection) {
      if (currentValue.includes('.') || currentValue.includes(',')) return
    }

    // Respetar maxLength: si no hay selección que reemplazar, no insertar
    const maxLength = activeInput.maxLength
    if (maxLength > 0 && currentValue.length >= maxLength && !hasSelection) return

    // Sustituir el "0" inicial: si el valor es exactamente "0" y se pulsa un
    // dígito (no el separador decimal), el dígito reemplaza al 0 en lugar de
    // anteponerse (evita "04"). Un valor real como "2" no se ve afectado, y
    // pulsar "." sobre "0" sí conserva el 0 → "0.".
    if (currentValue === '0' && !hasSelection && key !== 'decimal') {
      setNativeValue(activeInput, charToInsert)
      try {
        activeInput.setSelectionRange(charToInsert.length, charToInsert.length)
      } catch {
        // setSelectionRange throws on input type="number" — ignore
      }
      return
    }

    // Insertar carácter en posición del cursor (o reemplazar selección)
    const before = currentValue.slice(0, selStart)
    const after = currentValue.slice(selEnd)
    const newValue = before + charToInsert + after

    setNativeValue(activeInput, newValue)

    // Restaurar cursor justo después del carácter insertado
    const inserted = newValue.length - (currentValue.length - (selEnd - selStart))
    const newPos = selStart + inserted
    try {
      activeInput.setSelectionRange(newPos, newPos)
    } catch {
      // setSelectionRange throws on input type="number" — ignore
    }
  }, [activeInput])

  const pressBackspace = useCallback(() => {
    if (!activeInput || !document.contains(activeInput)) return

    const currentValue = activeInput.value
    // selectionStart/selectionEnd are null for input type="number"
    const selStart = activeInput.selectionStart ?? currentValue.length
    const selEnd = activeInput.selectionEnd ?? currentValue.length
    const hasSelection = selStart !== selEnd

    if (hasSelection) {
      // Eliminar el texto seleccionado
      const before = currentValue.slice(0, selStart)
      const after = currentValue.slice(selEnd)
      setNativeValue(activeInput, before + after)

      try {
        activeInput.setSelectionRange(selStart, selStart)
      } catch {
        // setSelectionRange throws on input type="number" — ignore
      }
    } else {
      // Sin selección: borrar carácter antes del cursor
      if (selStart === 0) return

      const before = currentValue.slice(0, selStart - 1)
      const after = currentValue.slice(selStart)
      setNativeValue(activeInput, before + after)

      const newPos = selStart - 1
      try {
        activeInput.setSelectionRange(newPos, newPos)
      } catch {
        // setSelectionRange throws on input type="number" — ignore
      }
    }
  }, [activeInput])

  const clearInput = useCallback(() => {
    if (!activeInput || !document.contains(activeInput)) return

    const clearValue = activeInput.type === 'number' ? '0' : ''
    setNativeValue(activeInput, clearValue)

    // Posicionar cursor al final del valor limpiado
    try {
      activeInput.setSelectionRange(clearValue.length, clearValue.length)
    } catch {
      // setSelectionRange throws on input type="number" — ignore
    }
  }, [activeInput])

  // ─── Focus Detection ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!virtualKeyboardEnabled) return

    const ignoredTypes = ['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'hidden']

    function handleFocusIn(e: FocusEvent): void {
      const target = e.target as HTMLElement
      if (target.tagName !== 'INPUT') return

      const input = target as HTMLInputElement
      if (ignoredTypes.includes(input.type)) return

      // En modo anclado (Kiosko) el teclado siempre es numérico y ya está
      // visible: solo actualizamos el input activo para saber dónde escribir.
      if (pinnedRef.current) {
        setActiveInput(input)
        setKeyboardType('numeric')
        return
      }

      // Mostrar el teclado numérico para inputs number y para inputs de texto
      // que declaren inputMode numérico/decimal (inputs de precio, etc.).
      const numericInputMode =
        input.inputMode === 'numeric' || input.inputMode === 'decimal'
      const isNumeric = input.type === 'number' || numericInputMode
      const type: 'numeric' | 'full' = isNumeric ? 'numeric' : 'full'
      showKeyboard(input, type)
    }

    function handleMouseDown(e: MouseEvent): void {
      // En modo anclado el teclado nunca se cierra por clicks fuera.
      if (pinnedRef.current) return

      const target = e.target as HTMLElement

      // Don't close if the click is on the keyboard itself
      if (target.closest('[data-virtual-keyboard]')) return

      // Don't close if the click is on an input (focusin will handle it)
      if (target.tagName === 'INPUT') return

      hideKeyboard()
    }

    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('mousedown', handleMouseDown)

    return () => {
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [virtualKeyboardEnabled, showKeyboard, hideKeyboard])

  // ─── Context Value ────────────────────────────────────────────────────────

  const contextValue: VirtualKeyboardContextValue = {
    enabled: virtualKeyboardEnabled,
    keyboardLanguage: virtualKeyboardLanguage,
    activeInput,
    keyboardType,
    isVisible,
    pinned,
    setPinned,
    showKeyboard,
    hideKeyboard,
    pressKey,
    pressBackspace,
    clearInput
  }

  return (
    <VirtualKeyboardContext.Provider value={contextValue}>
      {children}
    </VirtualKeyboardContext.Provider>
  )
}
