/**
 * NumericKeypad.tsx
 *
 * Teclado numérico compacto tipo calculadora para inputs type="number".
 * Se posiciona fijo en la parte inferior de la ventana (full width, 220px de alto).
 * Layout 4×4: 7-8-9-⌫ / 4-5-6-C / 1-2-3-✓ / 0(doble)-.-✓
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LAYOUT_NUMERIC, type KeyDef } from './layouts'
import { useVirtualKeyboard } from './VirtualKeyboardContext'
import { cn } from '@renderer/lib/utils'

export function NumericKeypad(): React.JSX.Element {
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

  function handleKeyClick(keyDef: KeyDef): void {
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
      default:
        pressKey(keyDef.key)
        break
    }
  }

  return (
    <div
      data-virtual-keyboard="true"
      className="fixed bottom-0 left-0 right-0 z-50 h-[220px] bg-gray-100 border-t border-gray-300 shadow-lg p-2"
      role="group"
      aria-label={t('keyboard.numericKeyboard')}
    >
      {/* Close button */}
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

      <div className="max-w-[400px] mx-auto h-full grid grid-rows-4 gap-1">
        {LAYOUT_NUMERIC.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-flow-col gap-1 auto-cols-fr">
            {row.map((keyDef, keyIndex) => {
              const keyId = `${rowIndex}-${keyIndex}`
              const isPressed = activeKey === keyId
              return (
                <button
                  key={keyId}
                  className={cn(
                    'min-h-[44px] min-w-[44px] rounded-md font-semibold text-lg',
                    'border border-gray-300 shadow-sm',
                    'select-none cursor-pointer',
                    'transition-all duration-100',
                    isPressed && 'scale-95 bg-blue-200',
                    !isPressed &&
                      (keyDef.type === 'action'
                        ? 'bg-gray-300 hover:bg-gray-400 text-gray-700'
                        : 'bg-white hover:bg-gray-50 text-gray-900')
                  )}
                  style={keyDef.width ? { gridColumn: `span ${keyDef.width}` } : undefined}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setActiveKey(keyId)
                  }}
                  onMouseUp={() => setActiveKey(null)}
                  onTouchStart={() => setActiveKey(keyId)}
                  onTouchEnd={() => setActiveKey(null)}
                  onClick={() => handleKeyClick(keyDef)}
                  aria-label={
                    keyDef.key === 'backspace'
                      ? t('keyboard.backspace')
                      : keyDef.key === 'clear'
                        ? t('keyboard.clear')
                        : keyDef.key === 'confirm'
                          ? t('keyboard.confirm')
                          : `${t('keyboard.key')} ${keyDef.key}`
                  }
                >
                  {keyDef.label ?? keyDef.key}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
