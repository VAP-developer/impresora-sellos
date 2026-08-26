/**
 * Utilidades para el teclado virtual.
 * - setNativeValue: inyecta valor en un input simulando entrada nativa
 * - calculateNumericPosition: calcula posición del numpad relativa al input
 * - ensureInputVisible: scroll automático si el input queda oculto por el teclado
 */

/**
 * Simula una entrada nativa en el input usando nativeInputValueSetter.
 * Esto permite que React detecte el cambio y ejecute los onChange handlers
 * existentes sin necesidad de modificar los componentes con inputs.
 */
export function setNativeValue(input: HTMLInputElement, value: string): void {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )!.set!

  nativeInputValueSetter.call(input, value)

  const event = new Event('input', { bubbles: true })
  input.dispatchEvent(event)
}

/**
 * Calcula la posición del teclado numérico relativa al input activo.
 * Intenta posicionar debajo del input; si no cabe, lo coloca arriba.
 * Ajusta horizontalmente para que no se salga de la ventana.
 */
export function calculateNumericPosition(inputRect: DOMRect): { top: number; left: number } {
  const KEYPAD_HEIGHT = 250
  const KEYPAD_WIDTH = 200
  const MARGIN = 8

  // Intentar posicionar debajo del input
  let top = inputRect.bottom + MARGIN
  let left = inputRect.left + inputRect.width / 2 - KEYPAD_WIDTH / 2

  // Si no cabe abajo, posicionar arriba
  if (top + KEYPAD_HEIGHT > window.innerHeight) {
    top = inputRect.top - KEYPAD_HEIGHT - MARGIN
  }

  // Ajustar horizontalmente si se sale de pantalla
  left = Math.max(MARGIN, Math.min(left, window.innerWidth - KEYPAD_WIDTH - MARGIN))

  return { top, left }
}

/**
 * Hace scroll automático para asegurar que el input activo sea visible
 * cuando el teclado completo (fixed bottom) lo oculta.
 */
export function ensureInputVisible(input: HTMLInputElement, keyboardHeight: number): void {
  const inputRect = input.getBoundingClientRect()
  const visibleBottom = window.innerHeight - keyboardHeight

  if (inputRect.bottom > visibleBottom) {
    const scrollAmount = inputRect.bottom - visibleBottom + 20 // 20px de margen
    window.scrollBy({ top: scrollAmount, behavior: 'smooth' })
  }
}
