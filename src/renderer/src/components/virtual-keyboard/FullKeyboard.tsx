/**
 * FullKeyboard.tsx
 *
 * Teclado QWERTY completo para inputs type="text".
 * Se posiciona fijo en la parte inferior de la ventana ocupando todo el ancho
 * (280px de alto), con las teclas centradas horizontalmente.
 * Soporta layouts español (con Ñ) e inglés (QWERTY estándar).
 * Implementa toggle de Shift para mayúsculas/minúsculas.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getFullLayout, type KeyDef } from './layouts'
import { useVirtualKeyboard } from './VirtualKeyboardContext'
import { cn } from '@renderer/lib/utils'

interface FullKeyboardProps {
  language: 'es' | 'en'
}

export function FullKeyboard({ language }: FullKeyboardProps): React.JSX.Element {
  const { pressKey, pressBackspace, hideKeyboard } = useVirtualKeyboard()
  const { t } = useTranslation()
  const [shiftActive, setShiftActive] = useState(false)
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

  const layout = getFullLayout(language)

  function handleKeyClick(keyDef: KeyDef): void {
    switch (keyDef.key) {
      case 'backspace':
        pressBackspace()
        break
      case 'enter':
        hideKeyboard()
        break
      case 'shift':
        setShiftActive((prev) => !prev)
        break
      case 'space':
        pressKey(' ')
        break
      case 'close':
        hideKeyboard()
        break
      default:
        // Char keys: send uppercase if shift active, lowercase otherwise
        if (shiftActive) {
          pressKey(keyDef.key.toUpperCase())
        } else {
          pressKey(keyDef.key.toLowerCase())
        }
        break
    }
  }

  function getAriaLabel(keyDef: KeyDef): string {
    switch (keyDef.key) {
      case 'backspace':
        return t('keyboard.backspace')
      case 'enter':
        return t('keyboard.enter')
      case 'shift':
        return t('keyboard.shift')
      case 'space':
        return t('keyboard.space')
      case 'close':
        return t('keyboard.close')
      default:
        return `${t('keyboard.key')} ${shiftActive ? keyDef.key.toUpperCase() : keyDef.key.toLowerCase()}`
    }
  }

  function getKeyLabel(keyDef: KeyDef): string {
    if (keyDef.key === 'space') return t('keyboard.space')
    if (keyDef.label) return keyDef.label
    return shiftActive ? keyDef.key.toUpperCase() : keyDef.key.toLowerCase()
  }

  return (
    <div
      data-virtual-keyboard="true"
      className="fixed bottom-0 left-0 right-0 z-50 h-[340px] bg-gray-100 border-t border-gray-300 shadow-lg p-2"
      role="group"
      aria-label={t('keyboard.fullKeyboard')}
    >
      {/* Botón de cierre visible en esquina superior derecha */}
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
      <div className="flex flex-col gap-1 h-full">
        {layout.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-1 flex-1 justify-center">
            {row.map((keyDef, keyIndex) => {
              const keyId = `${rowIndex}-${keyIndex}`
              const isPressed = activeKey === keyId
              return (
                <button
                  key={keyId}
                  className={cn(
                    // Teclas grandes con relieve tipo botón físico (misma
                    // mejora de accesibilidad que el teclado del Kiosko),
                    // adaptadas al teclado QWERTY completo.
                    'min-h-[52px] min-w-[40px] rounded-lg font-bold text-2xl',
                    'border border-gray-400',
                    'select-none cursor-pointer',
                    'transition-all duration-75',
                    'flex items-center justify-center',
                    isPressed
                      ? 'translate-y-[3px] shadow-none bg-blue-200 border-blue-400'
                      : keyDef.type === 'action'
                        ? keyDef.key === 'shift' && shiftActive
                          ? 'bg-gradient-to-b from-blue-200 to-blue-400 text-blue-900 shadow-[0_4px_0_0_rgb(59,130,246)]'
                          : 'bg-gradient-to-b from-gray-200 to-gray-400 text-gray-800 shadow-[0_4px_0_0_rgb(120,120,120)] hover:from-gray-300 hover:to-gray-400'
                        : 'bg-gradient-to-b from-white to-gray-300 text-gray-900 shadow-[0_4px_0_0_rgb(160,160,160)] hover:from-gray-50 hover:to-gray-300'
                  )}
                  style={{ flex: keyDef.width ? `${keyDef.width}` : '1' }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setActiveKey(keyId)
                  }}
                  onMouseUp={() => setActiveKey(null)}
                  onTouchStart={() => setActiveKey(keyId)}
                  onTouchEnd={() => setActiveKey(null)}
                  onClick={() => handleKeyClick(keyDef)}
                  aria-label={getAriaLabel(keyDef)}
                  aria-pressed={keyDef.key === 'shift' ? shiftActive : undefined}
                >
                  {getKeyLabel(keyDef)}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
