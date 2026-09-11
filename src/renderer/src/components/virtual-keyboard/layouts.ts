/**
 * Definiciones de layouts para el teclado virtual.
 * Contiene el teclado numérico (calculadora) y los layouts QWERTY español e inglés.
 */

export interface KeyDef {
  /** Carácter o acción ('backspace', 'enter', 'shift', 'space', 'close', 'clear', 'confirm') */
  key: string
  /** Texto visible en la tecla (si difiere del key) */
  label?: string
  /** Multiplicador de ancho (1 = normal, 1.5 = ancho y medio, 2 = doble) */
  width?: number
  /** Tipo de tecla */
  type?: 'char' | 'action'
}

export type KeyboardRow = KeyDef[]
export type KeyboardLayout = KeyboardRow[]

/**
 * Layout numérico tipo calculadora.
 * Disposición (4 columnas × 4 filas), con un único botón ✓ grande
 * que ocupa las dos filas inferiores de la última columna:
 *   7  8  9  ⌫
 *   4  5  6  C
 *   1  2  3  ✓
 *   0(doble) ,  ✓
 *
 * La colocación de las teclas grandes (0 de doble ancho y ✓ de doble alto)
 * se resuelve en NumericKeypad.tsx mediante posicionamiento explícito en grid.
 * La tecla decimal usa el punto '.' como etiqueta e inserta un punto, en
 * coherencia con el formateo de precios de la app (ver pressKey y formatPrice).
 */
export const LAYOUT_NUMERIC: KeyboardLayout = [
  [
    { key: '7', type: 'char' },
    { key: '8', type: 'char' },
    { key: '9', type: 'char' },
    { key: 'backspace', label: '⌫', type: 'action' }
  ],
  [
    { key: '4', type: 'char' },
    { key: '5', type: 'char' },
    { key: '6', type: 'char' },
    { key: 'clear', label: 'C', type: 'action' }
  ],
  [
    { key: '1', type: 'char' },
    { key: '2', type: 'char' },
    { key: '3', type: 'char' }
  ],
  [
    { key: '0', type: 'char', width: 2 },
    { key: 'decimal', label: '.', type: 'char' }
  ]
]

/**
 * Layout QWERTY español con Ñ.
 * 5 filas: números, QWERTYUIOP, ASDFGHJKLÑ+Enter, Shift+ZXCVBNM,.+Shift, Espacio+símbolos+cerrar
 */
export const LAYOUT_ES: KeyboardLayout = [
  // Fila 1: Números + Backspace
  [
    { key: '1', type: 'char' },
    { key: '2', type: 'char' },
    { key: '3', type: 'char' },
    { key: '4', type: 'char' },
    { key: '5', type: 'char' },
    { key: '6', type: 'char' },
    { key: '7', type: 'char' },
    { key: '8', type: 'char' },
    { key: '9', type: 'char' },
    { key: '0', type: 'char' },
    { key: 'backspace', label: '⌫', width: 1.5, type: 'action' }
  ],
  // Fila 2: QWERTYUIOP
  [
    { key: 'Q', type: 'char' },
    { key: 'W', type: 'char' },
    { key: 'E', type: 'char' },
    { key: 'R', type: 'char' },
    { key: 'T', type: 'char' },
    { key: 'Y', type: 'char' },
    { key: 'U', type: 'char' },
    { key: 'I', type: 'char' },
    { key: 'O', type: 'char' },
    { key: 'P', type: 'char' }
  ],
  // Fila 3: ASDFGHJKLÑ + Enter
  [
    { key: 'A', type: 'char' },
    { key: 'S', type: 'char' },
    { key: 'D', type: 'char' },
    { key: 'F', type: 'char' },
    { key: 'G', type: 'char' },
    { key: 'H', type: 'char' },
    { key: 'J', type: 'char' },
    { key: 'K', type: 'char' },
    { key: 'L', type: 'char' },
    { key: 'Ñ', type: 'char' },
    { key: 'enter', label: 'Enter', width: 1.5, type: 'action' }
  ],
  // Fila 4: Shift + ZXCVBNM,. + Shift
  [
    { key: 'shift', label: '⇧', width: 1.5, type: 'action' },
    { key: 'Z', type: 'char' },
    { key: 'X', type: 'char' },
    { key: 'C', type: 'char' },
    { key: 'V', type: 'char' },
    { key: 'B', type: 'char' },
    { key: 'N', type: 'char' },
    { key: 'M', type: 'char' },
    { key: ',', type: 'char' },
    { key: '.', type: 'char' },
    { key: 'shift', label: '⇧', width: 1.5, type: 'action' }
  ],
  // Fila 5: Espacio + símbolos + cerrar
  [
    { key: '@', type: 'char' },
    { key: 'space', label: 'ESPACIO', width: 5, type: 'action' },
    { key: '-', type: 'char' },
    { key: '/', type: 'char' },
    { key: 'close', label: '✕', width: 1.5, type: 'action' }
  ]
]

/**
 * Layout QWERTY inglés sin Ñ.
 * 5 filas: números, QWERTYUIOP, ASDFGHJKL+Enter, Shift+ZXCVBNM,.+Shift, Space+símbolos+cerrar
 */
export const LAYOUT_EN: KeyboardLayout = [
  // Fila 1: Números + Backspace
  [
    { key: '1', type: 'char' },
    { key: '2', type: 'char' },
    { key: '3', type: 'char' },
    { key: '4', type: 'char' },
    { key: '5', type: 'char' },
    { key: '6', type: 'char' },
    { key: '7', type: 'char' },
    { key: '8', type: 'char' },
    { key: '9', type: 'char' },
    { key: '0', type: 'char' },
    { key: 'backspace', label: '⌫', width: 1.5, type: 'action' }
  ],
  // Fila 2: QWERTYUIOP
  [
    { key: 'Q', type: 'char' },
    { key: 'W', type: 'char' },
    { key: 'E', type: 'char' },
    { key: 'R', type: 'char' },
    { key: 'T', type: 'char' },
    { key: 'Y', type: 'char' },
    { key: 'U', type: 'char' },
    { key: 'I', type: 'char' },
    { key: 'O', type: 'char' },
    { key: 'P', type: 'char' }
  ],
  // Fila 3: ASDFGHJKL + Enter (sin Ñ)
  [
    { key: 'A', type: 'char' },
    { key: 'S', type: 'char' },
    { key: 'D', type: 'char' },
    { key: 'F', type: 'char' },
    { key: 'G', type: 'char' },
    { key: 'H', type: 'char' },
    { key: 'J', type: 'char' },
    { key: 'K', type: 'char' },
    { key: 'L', type: 'char' },
    { key: 'enter', label: 'Enter', width: 1.5, type: 'action' }
  ],
  // Fila 4: Shift + ZXCVBNM,. + Shift
  [
    { key: 'shift', label: '⇧', width: 1.5, type: 'action' },
    { key: 'Z', type: 'char' },
    { key: 'X', type: 'char' },
    { key: 'C', type: 'char' },
    { key: 'V', type: 'char' },
    { key: 'B', type: 'char' },
    { key: 'N', type: 'char' },
    { key: 'M', type: 'char' },
    { key: ',', type: 'char' },
    { key: '.', type: 'char' },
    { key: 'shift', label: '⇧', width: 1.5, type: 'action' }
  ],
  // Fila 5: Space + símbolos + cerrar
  [
    { key: '@', type: 'char' },
    { key: 'space', label: 'SPACE', width: 5, type: 'action' },
    { key: '-', type: 'char' },
    { key: '/', type: 'char' },
    { key: 'close', label: '✕', width: 1.5, type: 'action' }
  ]
]

/**
 * Devuelve el layout completo (QWERTY) según el idioma seleccionado.
 */
export function getFullLayout(lang: 'es' | 'en'): KeyboardLayout {
  return lang === 'es' ? LAYOUT_ES : LAYOUT_EN
}
