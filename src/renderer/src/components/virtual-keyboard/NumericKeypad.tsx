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
    // Estilo mejorado para el teclado anclado del Kiosko: teclas grandes con
    // relieve (fondo gris + sombra que simula un botón físico) para que sea
    // evidente que son pulsables en pantalla táctil.
    if (pinned) {
      return cn(
        'min-h-[64px] min-w-[64px] rounded-xl font-bold',
        'text-4xl',
        'flex items-center justify-center',
        'select-none cursor-pointer',
        'border border-gray-400',
        'transition-all duration-75',
        isPressed
          ? 'translate-y-[3px] shadow-none bg-blue-200 border-blue-400'
          : keyDef.type === 'action'
            ? 'bg-gradient-to-b from-gray-200 to-gray-400 text-gray-800 shadow-[0_4px_0_0_rgb(120,120,120)] hover:from-gray-300 hover:to-gray-400'
            : 'bg-gradient-to-b from-white to-gray-300 text-gray-900 shadow-[0_4px_0_0_rgb(160,160,160)] hover:from-gray-50 hover:to-gray-300'
      )
    }

    // Teclado flotante general: mismas mejoras de accesibilidad que el modo
    // anclado del Kiosko (números grandes + relieve tipo botón físico),
    // adaptadas a un tamaño algo más compacto.
    return cn(
      'min-h-[56px] min-w-[56px] rounded-xl font-bold text-3xl',
      'flex items-center justify-center',
      'select-none cursor-pointer',
      'border border-gray-400',
      'transition-all duration-75',
      isPressed
        ? 'translate-y-[3px] shadow-none bg-blue-200 border-blue-400'
        : keyDef.type === 'action'
          ? 'bg-gradient-to-b from-gray-200 to-gray-400 text-gray-800 shadow-[0_4px_0_0_rgb(120,120,120)] hover:from-gray-300 hover:to-gray-400'
          : 'bg-gradient-to-b from-white to-gray-300 text-gray-900 shadow-[0_4px_0_0_rgb(160,160,160)] hover:from-gray-50 hover:to-gray-300'
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

  // Teclas usadas por el layout compacto solo-enteros (modo anclado/Kiosko):
  // sin separador decimal ni confirmar.
  const clearKey: KeyDef = { key: 'clear', label: 'C', type: 'action' }
  const zeroKey: KeyDef = { key: '0', type: 'char' }
  const backspaceKey: KeyDef = { key: 'backspace', label: '⌫', type: 'action' }

  return (
    <div
      data-virtual-keyboard="true"
      className={cn(
        'z-50 flex bg-gray-100 border-gray-300 shadow-lg p-4',
        pinned
          ? // Anclado (Kiosko): ocupa todo el alto disponible pero alinea su
            // contenido arriba, para que el teclado nunca se estire por debajo
            // de su tamaño natural. El espacio sobrante queda en blanco abajo.
            'relative w-full h-full rounded-lg border items-start justify-center'
          : 'fixed bottom-0 left-0 right-0 h-[300px] border-t items-center justify-center'
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

      {pinned ? (
        /*
          Layout compacto solo-enteros para la vista Kiosko (modo anclado).
          Grid 3 columnas × 4 filas, sin separador decimal ni confirmar:
            7  8  9
            4  5  6
            1  2  3
            C  0  ⌫
        */
        <div className="grid grid-cols-3 grid-rows-4 gap-2 w-full h-full max-h-full">
          {/* Fila 1: 7 8 9 */}
          {renderKey(LAYOUT_NUMERIC[0][0], '0-0')}
          {renderKey(LAYOUT_NUMERIC[0][1], '0-1')}
          {renderKey(LAYOUT_NUMERIC[0][2], '0-2')}

          {/* Fila 2: 4 5 6 */}
          {renderKey(LAYOUT_NUMERIC[1][0], '1-0')}
          {renderKey(LAYOUT_NUMERIC[1][1], '1-1')}
          {renderKey(LAYOUT_NUMERIC[1][2], '1-2')}

          {/* Fila 3: 1 2 3 */}
          {renderKey(LAYOUT_NUMERIC[2][0], '2-0')}
          {renderKey(LAYOUT_NUMERIC[2][1], '2-1')}
          {renderKey(LAYOUT_NUMERIC[2][2], '2-2')}

          {/* Fila 4: C 0 ⌫ */}
          {renderKey(clearKey, '3-clear')}
          {renderKey(zeroKey, '3-zero')}
          {renderKey(backspaceKey, '3-backspace')}
        </div>
      ) : (
        /*
          Grid explícito de 4 columnas × 4 filas (teclado flotante general).
          - Fila 1: 7 8 9 ⌫
          - Fila 2: 4 5 6 C
          - Fila 3: 1 2 3  ┐
          - Fila 4: 0(x2) ,  ┘ ✓ (ocupa filas 3-4 en la columna 4)
        */
        <div className="grid grid-cols-4 grid-rows-4 gap-2 w-full max-w-[400px] h-full max-h-full">
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
            gridRow: '3 / span 2'
          })}

          {/* Fila 4: 0 (doble ancho) y , */}
          {renderKey(LAYOUT_NUMERIC[3][0], '3-0', { gridColumn: '1 / span 2' })}
          {renderKey(LAYOUT_NUMERIC[3][1], '3-1')}
        </div>
      )}
    </div>
  )
}
