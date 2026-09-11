/**
 * NumericKeypad.tsx
 *
 * Teclado numérico compacto tipo calculadora para inputs type="number".
 * Se posiciona fijo en la mitad derecha de la ventana, ocupando la altura
 * completa de la pantalla en el hueco reservado a la derecha de la tabla
 * del kiosko.
 * Layout 4×4:
 *   7  8  9  ⌫
 *   4  5  6  C
 *   1  2  3  ✓ (grande, ocupa 2 filas)
 *   0 (doble ancho)  ,  ✓
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LAYOUT_NUMERIC, type KeyDef } from './layouts'
import { useVirtualKeyboard } from './VirtualKeyboardContext'
import { cn } from '@renderer/lib/utils'

interface NumericKeypadProps {
  /**
   * Cuando es true el teclado se integra en el layout que lo contiene
   * (ocupa su hueco con `relative w-full h-full`) en lugar de flotar `fixed`,
   * y no muestra el botón de cerrar. Usado por la vista Kiosko.
   */
  pinned?: boolean
}

export function NumericKeypad({ pinned = false }: NumericKeypadProps): React.JSX.Element {
  const { pressKey, pressBackspace, clearInput, hideKeyboard } = useVirtualKeyboard()
  const { t } = useTranslation()
  const [activeKey, setActiveKey] = useState<string | null>(null)

  // Clear activeKey on global mouseup/touchend (e.g. pointer leaves the key)
  const handleGlobalUp = useCallback(() => setActiveKey(null), [])

  useEffect(() => {
    window.addEventListener('mouseup', handleGlobalUp)
    window.addEventListener('touchend', handleGlobalUp)
    return () => {
      window.removeEventListener('mouseup', handleGlobalUp)
      window.removeEventListener('touchend', handleGlobalUp)
    }
  }, [handleGlobalUp])

  const handleKeyClick = useCallback(
    (keyDef: KeyDef): void => {
      switch (keyDef.key) {
        case 'backspace':
          pressBackspace()
          break
        case 'clear':
          clearInput()
          break
        case 'confirm':
          hideKeyboard()
          break
        case 'decimal':
          // La tecla decimal delega en pressKey, que resuelve el separador
          // adecuado (',' o '.') según el input activo.
          pressKey('decimal')
          break
        default:
          pressKey(keyDef.key)
          break
      }
    },
    [pressKey, pressBackspace, clearInput, hideKeyboard]
  )

  function ariaLabelFor(keyDef: KeyDef): string {
    switch (keyDef.key) {
      case 'backspace':
        return t('keyboard.backspace')
      case 'clear':
        return t('keyboard.clear')
      case 'confirm':
        return t('keyboard.confirm')
      case 'decimal':
        return `${t('keyboard.key')} ${keyDef.label}`
      default:
        return `${t('keyboard.key')} ${keyDef.key}`
    }
  }

  function keyClasses(keyDef: KeyDef, isPressed: boolean): string {
    return cn(
      'min-h-[44px] min-w-[44px] rounded-md font-semibold text-lg',
      'border border-gray-300 shadow-sm',
      'flex items-center justify-center',
      'select-none cursor-pointer',
      'transition-all duration-100',
      isPressed && 'scale-95 bg-blue-200',
      !isPressed &&
        (keyDef.type === 'action'
          ? 'bg-gray-300 hover:bg-gray-400 text-gray-700'
          : 'bg-white hover:bg-gray-50 text-gray-900')
    )
  }

  function renderKey(keyDef: KeyDef, keyId: string, extraStyle?: React.CSSProperties): React.JSX.Element {
    const isPressed = activeKey === keyId
    return (
      <button
        key={keyId}
        className={keyClasses(keyDef, isPressed)}
        style={extraStyle}
        onMouseDown={(e) => {
          e.preventDefault()
          setActiveKey(keyId)
        }}
        onMouseUp={() => setActiveKey(null)}
        onTouchStart={() => setActiveKey(keyId)}
        onTouchEnd={() => setActiveKey(null)}
        onClick={() => handleKeyClick(keyDef)}
        aria-label={ariaLabelFor(keyDef)}
      >
        {keyDef.label ?? keyDef.key}
      </button>
    )
  }

  // Definición del botón de confirmar unificado (grande).
  const confirmKey: KeyDef = { key: 'confirm', label: '✓', type: 'action' }

  return (
    <div
      data-virtual-keyboard="true"
      className={cn(
        'z-50 flex items-center justify-center bg-gray-100 border-gray-300 shadow-lg p-4',
        pinned
          ? 'relative w-full h-full rounded-lg border'
          : 'fixed bottom-0 left-0 right-0 h-[220px] border-t'
      )}
      role="group"
      aria-label={t('keyboard.numericKeyboard')}
    >
      {/* Close button — solo en modo flotante (no anclado) */}
      {!pinned && (
        <button
          className={cn(
            'absolute top-2 right-2 z-10',
            'w-[36px] h-[36px] rounded-full',
            'bg-gray-400 hover:bg-red-500 text-white',
            'flex items-center justify-center',
            'text-lg font-bold shadow-md',
            'transition-colors duration-150',
            'select-none cursor-pointer'
          )}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => hideKeyboard()}
          aria-label={t('keyboard.close')}
        >
          ✕
        </button>
      )}

      {/*
        Grid explícito de 4 columnas × 4 filas.
        - Fila 1: 7 8 9 ⌫
        - Fila 2: 4 5 6 C
        - Fila 3: 1 2 3  ┐
        - Fila 4: 0(x2) ,  ┘ ✓ (ocupa filas 3-4 en la columna 4)
      */}
      <div
        className={cn(
          'grid grid-cols-4 grid-rows-4 gap-2',
          pinned ? 'w-full h-full' : 'w-full max-w-[400px] h-full max-h-full'
        )}
      >
        {/* Fila 1 */}
        {renderKey(LAYOUT_NUMERIC[0][0], '0-0')}
        {renderKey(LAYOUT_NUMERIC[0][1], '0-1')}
        {renderKey(LAYOUT_NUMERIC[0][2], '0-2')}
        {renderKey(LAYOUT_NUMERIC[0][3], '0-3')}

        {/* Fila 2 */}
        {renderKey(LAYOUT_NUMERIC[1][0], '1-0')}
        {renderKey(LAYOUT_NUMERIC[1][1], '1-1')}
        {renderKey(LAYOUT_NUMERIC[1][2], '1-2')}
        {renderKey(LAYOUT_NUMERIC[1][3], '1-3')}

        {/* Fila 3: 1 2 3 */}
        {renderKey(LAYOUT_NUMERIC[2][0], '2-0')}
        {renderKey(LAYOUT_NUMERIC[2][1], '2-1')}
        {renderKey(LAYOUT_NUMERIC[2][2], '2-2')}

        {/* Botón ✓ grande: columna 4, filas 3-4 */}
        {renderKey(confirmKey, 'confirm', {
          gridColumn: '4',
          gridRow: '3 / span 2',
          fontSize: '1.75rem'
        })}

        {/* Fila 4: 0 (doble ancho) y , */}
        {renderKey(LAYOUT_NUMERIC[3][0], '3-0', { gridColumn: '1 / span 2' })}
        {renderKey(LAYOUT_NUMERIC[3][1], '3-1')}
      </div>
    </div>
  )
}
