/**
 * FullKeyboard.tsx
 *
 * Teclado QWERTY completo para inputs type="text".
 * Se posiciona fijo en la parte inferior de la ventana (full width, 280px de alto).
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
      className="fixed bottom-0 left-0 right-0 z-50 h-[280px] bg-gray-100 border-t border-gray-300 shadow-lg p-2"
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
                    'min-h-[40px] min-w-[40px] rounded-md font-semibold text-sm',
                    'border border-gray-300 shadow-sm',
                    'select-none cursor-pointer',
                    'transition-all duration-100',
                    'flex items-center justify-center',
                    isPressed && 'scale-95 bg-blue-200',
                    !isPressed &&
                      (keyDef.type === 'action'
                        ? keyDef.key === 'shift' && shiftActive
                          ? 'bg-blue-300 hover:bg-blue-400 text-blue-900'
                          : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
                        : 'bg-white hover:bg-gray-50 text-gray-900')
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
