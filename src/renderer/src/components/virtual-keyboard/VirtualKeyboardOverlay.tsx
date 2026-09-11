/**
 * VirtualKeyboardOverlay.tsx
 *
 * Renderiza el teclado virtual apropiado (NumericKeypad o FullKeyboard)
 * usando React Portal al document.body. Aplica animaciones de entrada/salida
 * con translate-y + opacity (200ms).
 */

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useVirtualKeyboard } from './VirtualKeyboardContext'
import { NumericKeypad } from './NumericKeypad'
import { FullKeyboard } from './FullKeyboard'
import { cn } from '@renderer/lib/utils'

export function VirtualKeyboardOverlay(): React.JSX.Element | null {
  const { isVisible, keyboardType, keyboardLanguage, pinned } = useVirtualKeyboard()

  // Keep the component mounted briefly during exit animation
  const [shouldRender, setShouldRender] = useState(false)
  const [animateIn, setAnimateIn] = useState(false)

  useEffect(() => {
    if (isVisible) {
      // Mount the component, then trigger animation on next frame
      setShouldRender(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimateIn(true)
        })
      })
    } else {
      // Start exit animation, then unmount after transition
      setAnimateIn(false)
      const timer = setTimeout(() => {
        setShouldRender(false)
      }, 200) // Match transition duration
      return () => clearTimeout(timer)
    }
  }, [isVisible])

  // En modo anclado el teclado se renderiza fijo dentro de la vista (Kiosko),
  // así que el overlay flotante global no debe mostrarse.
  if (pinned) return null

  if (!shouldRender || !keyboardType) return null

  const overlay = (
    <div
      className={cn(
        'transition-all duration-200 ease-out',
        animateIn
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-full'
      )}
    >
      {keyboardType === 'numeric' ? (
        <NumericKeypad />
      ) : (
        <FullKeyboard language={keyboardLanguage} />
      )}
    </div>
  )

  return createPortal(overlay, document.body)
}
