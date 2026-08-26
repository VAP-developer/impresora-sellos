# Design Document: Teclado Virtual

## Overview

Este documento describe el diseño técnico del teclado virtual para la aplicación Stamp Sales. El sistema proporciona dos variantes de teclado (numérico reducido y QWERTY completo), con soporte para layouts en español e inglés, gestionado mediante un React Context global que detecta el tipo de input activo y muestra el teclado correspondiente.

### Principios de Diseño

1. **No-intrusivo**: El teclado solo aparece cuando la configuración está activada; no altera el comportamiento existente si está desactivado
2. **Detección automática**: El tipo de teclado se determina por el atributo `type` del input activo, sin intervención del usuario
3. **Zero dependencies**: Implementación custom sin librerías externas, usando el stack existente (React + Tailwind + Zustand)
4. **Coexistencia**: El teclado virtual no bloquea la entrada del teclado físico; ambos funcionan simultáneamente
5. **Mínima invasión**: La integración con componentes existentes se hace a nivel de Provider global, sin modificar los `<input>` individuales

### Objetivos de Diseño

- Ofrecer entrada táctil fluida en la vista Kiosko (teclado numérico) y vistas de configuración (teclado completo)
- Permitir al usuario elegir entre layout español (con Ñ) e inglés (QWERTY estándar)
- Persistir la configuración (activado/desactivado + idioma) en SQLite
- Animaciones suaves de aparición/desaparición sin degradar rendimiento

## Arquitectura

### Diagrama de Componentes

```
App.tsx
└── VirtualKeyboardProvider (Context global)
    ├── MainLayout
    │   ├── KioskoView
    │   │   ├── TariffRow (inputs type="number") → NumericKeypad
    │   │   └── DynamicTariffRow (inputs type="number") → NumericKeypad
    │   ├── MaquinaView (inputs type="text") → FullKeyboard
    │   ├── ImprimirView / EventoEditor (inputs type="text") → FullKeyboard
    │   └── SettingsView
    │       └── VirtualKeyboardSection (toggle + idioma)
    └── VirtualKeyboardOverlay (portal, renderizado condicionalmente)
        ├── NumericKeypad (cuando input type="number")
        └── FullKeyboard (cuando input type="text")
```

### Flujo de Datos

```
Usuario toca un <input>
  ↓
Focus event se captura globalmente (VirtualKeyboardProvider)
  ↓
Provider determina:
  - ¿Está el teclado activado? (desde settings store)
  - ¿Qué tipo de input es? (number → numérico, text → completo)
  - Referencia al input activo
  ↓
Se renderiza VirtualKeyboardOverlay con el teclado apropiado
  ↓
Usuario pulsa tecla en el teclado virtual
  ↓
Provider modifica el valor del input activo (via nativeInputValueSetter + dispatchEvent)
  ↓
El onChange del input se dispara normalmente → Zustand store se actualiza
  ↓
UI se re-renderiza con el nuevo valor
```

### Patrón de Inyección de Valor

Para que el teclado virtual funcione sin modificar los componentes existentes, usamos el patrón de `nativeInputValueSetter`:

```typescript
// Simula una entrada nativa en el input
function setNativeValue(input: HTMLInputElement, value: string): void {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  )!.set!

  nativeInputValueSetter.call(input, value)

  const event = new Event('input', { bubbles: true })
  input.dispatchEvent(event)
}
```

Este patrón permite que React detecte el cambio y ejecute los `onChange` handlers existentes sin necesidad de modificar `TariffRow`, `DynamicTariffRow`, ni ningún otro componente con inputs.

## Componentes e Interfaces

### VirtualKeyboardProvider

```typescript
interface VirtualKeyboardContextValue {
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
  /** Muestra el teclado para un input específico */
  showKeyboard(input: HTMLInputElement): void
  /** Oculta el teclado */
  hideKeyboard(): void
  /** Envía una pulsación de tecla al input activo */
  pressKey(key: string): void
  /** Borra el último carácter del input activo */
  pressBackspace(): void
  /** Limpia el input activo */
  clearInput(): void
}
```

**Responsabilidades**:
- Escuchar eventos de `focusin` a nivel de documento para detectar inputs
- Determinar el tipo de teclado según `input.type`
- Mantener referencia al input activo
- Escuchar clics fuera del teclado y del input para cerrar
- Proveer API para que los componentes de teclado envíen pulsaciones

### NumericKeypad

```typescript
interface NumericKeypadProps {
  /** Posición calculada relativa al input activo */
  position: { top: number; left: number }
  /** Callback para cerrar el keypad */
  onClose(): void
  /** Callback para enviar una tecla */
  onKeyPress(key: string): void
  /** Callback para borrar */
  onBackspace(): void
  /** Callback para limpiar */
  onClear(): void
}
```

**Layout**:
```
┌─────────────────────┐
│  7  │  8  │  9  │ ⌫ │
│─────│─────│─────│───│
│  4  │  5  │  6  │ C │
│─────│─────│─────│───│
│  1  │  2  │  3  │   │
│─────│─────│─────│ ✓ │
│     0     │  .  │   │
└─────────────────────┘
```

- Dimensiones: ~200px ancho × ~250px alto
- Teclas: mínimo 44×44px
- Posicionamiento: Popover cerca del input (arriba o abajo según espacio disponible)

### FullKeyboard

```typescript
interface FullKeyboardProps {
  /** Idioma del layout */
  language: 'es' | 'en'
  /** Estado de shift/mayúsculas */
  shiftActive: boolean
  /** Callback para tecla */
  onKeyPress(key: string): void
  /** Callback para borrar */
  onBackspace(): void
  /** Callback para espacio */
  onSpace(): void
  /** Callback para enter */
  onEnter(): void
  /** Callback para toggle shift */
  onShiftToggle(): void
  /** Callback para cerrar */
  onClose(): void
}
```

**Layout Español**:
```
┌──────────────────────────────────────────────────────┐
│ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │ 7 │ 8 │ 9 │ 0 │    ⌫     │
│───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───────────│
│ Q │ W │ E │ R │ T │ Y │ U │ I │ O │ P │           │
│───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───────────│
│ A │ S │ D │ F │ G │ H │ J │ K │ L │ Ñ │  Enter    │
│───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───────────│
│ ⇧ │ Z │ X │ C │ V │ B │ N │ M │ , │ . │     ⇧    │
│───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───────────│
│       │          ESPACIO          │ - │ / │    ✕    │
└──────────────────────────────────────────────────────┘
```

**Layout Inglés**:
```
┌──────────────────────────────────────────────────────┐
│ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │ 7 │ 8 │ 9 │ 0 │    ⌫     │
│───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───────────│
│ Q │ W │ E │ R │ T │ Y │ U │ I │ O │ P │           │
│───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───────────│
│ A │ S │ D │ F │ G │ H │ J │ K │ L │   │  Enter    │
│───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───────────│
│ ⇧ │ Z │ X │ C │ V │ B │ N │ M │ , │ . │     ⇧    │
│───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───────────│
│       │          SPACE            │ - │ / │    ✕    │
└──────────────────────────────────────────────────────┘
```

- Posición: Fijo en la parte inferior de la ventana (`position: fixed; bottom: 0`)
- Ancho: 100% de la ventana
- Altura: ~280px
- Teclas: mínimo 40×44px con 4px de gap

### VirtualKeyboardOverlay

```typescript
interface VirtualKeyboardOverlayProps {
  /** Tipo de teclado a renderizar */
  type: 'numeric' | 'full'
  /** Si debe mostrarse */
  visible: boolean
}
```

**Responsabilidades**:
- Renderizado mediante React Portal (al `document.body`)
- Animación de entrada/salida (slide-up 200ms)
- Gestión de z-index (por encima de todo el contenido: z-50)
- Prevenir que clics en el teclado cierren el propio teclado (stopPropagation)

### VirtualKeyboardSection (Settings)

```typescript
interface VirtualKeyboardSectionProps {
  // No props — lee directamente del settings store
}
```

**Renderizado**:
- Toggle switch para activar/desactivar
- Select/radio para idioma (solo visible si activado)
- Usa el patrón de sección colapsable existente en SettingsView

## Modelos de Datos

### Configuración Persistida

Nuevo campo en la tabla `user_config` de SQLite:

```sql
-- Ya existe la tabla, se añaden dos campos:
virtual_keyboard_enabled INTEGER DEFAULT 0  -- 0 = desactivado, 1 = activado
virtual_keyboard_language TEXT DEFAULT 'es'  -- 'es' | 'en'
```

### IPC API (Preload Bridge)

Extensión del `electronAPI.config`:

```typescript
interface ConfigAPI {
  // ... campos existentes ...
  getVirtualKeyboardEnabled(): Promise<boolean>
  setVirtualKeyboardEnabled(enabled: boolean): Promise<void>
  getVirtualKeyboardLanguage(): Promise<'es' | 'en'>
  setVirtualKeyboardLanguage(lang: 'es' | 'en'): Promise<void>
}
```

### Extensión del Settings Store

```typescript
// Añadir al SettingsState existente:
interface SettingsState {
  // ... campos existentes ...
  virtualKeyboardEnabled: boolean
  virtualKeyboardLanguage: 'es' | 'en'

  setVirtualKeyboardEnabled(enabled: boolean): Promise<void>
  setVirtualKeyboardLanguage(lang: 'es' | 'en'): Promise<void>
}
```

### Layouts de Teclado (Constantes)

```typescript
// src/renderer/src/components/virtual-keyboard/layouts.ts

export interface KeyDef {
  key: string           // Carácter o acción ('backspace', 'enter', 'shift', 'space', 'close', 'clear')
  label?: string        // Texto visible en la tecla (si difiere del key)
  width?: number        // Multiplicador de ancho (1 = normal, 1.5 = ancho y medio, 2 = doble)
  type?: 'char' | 'action'  // Tipo de tecla
}

export type KeyboardRow = KeyDef[]
export type KeyboardLayout = KeyboardRow[]

export const LAYOUT_ES: KeyboardLayout = [/* ... */]
export const LAYOUT_EN: KeyboardLayout = [/* ... */]
export const LAYOUT_NUMERIC: KeyboardLayout = [/* ... */]
```

## Posicionamiento del Teclado

### Teclado Numérico (Popover)

El teclado numérico se posiciona como popover relativo al input activo:

```typescript
function calculateNumericPosition(inputRect: DOMRect): { top: number; left: number } {
  const KEYPAD_HEIGHT = 250
  const KEYPAD_WIDTH = 200
  const MARGIN = 8

  // Intentar posicionar debajo del input
  let top = inputRect.bottom + MARGIN
  let left = inputRect.left + (inputRect.width / 2) - (KEYPAD_WIDTH / 2)

  // Si no cabe abajo, posicionar arriba
  if (top + KEYPAD_HEIGHT > window.innerHeight) {
    top = inputRect.top - KEYPAD_HEIGHT - MARGIN
  }

  // Ajustar horizontalmente si se sale de pantalla
  left = Math.max(MARGIN, Math.min(left, window.innerWidth - KEYPAD_WIDTH - MARGIN))

  return { top, left }
}
```

### Teclado Completo (Fixed Bottom)

El teclado completo se fija en la parte inferior:

```typescript
// Estilos del contenedor del teclado completo
const fullKeyboardStyles = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  height: '280px',
  zIndex: 50
}
```

**Scroll del contenido**: Cuando el teclado completo se muestra, si el input activo queda oculto por el teclado, se hace scroll automático:

```typescript
function ensureInputVisible(input: HTMLInputElement, keyboardHeight: number): void {
  const inputRect = input.getBoundingClientRect()
  const visibleBottom = window.innerHeight - keyboardHeight

  if (inputRect.bottom > visibleBottom) {
    const scrollAmount = inputRect.bottom - visibleBottom + 20 // 20px de margen
    window.scrollBy({ top: scrollAmount, behavior: 'smooth' })
  }
}
```

## Gestión de Eventos (Focus/Blur)

### Captura Global de Focus

```typescript
// Dentro de VirtualKeyboardProvider
useEffect(() => {
  if (!enabled) return

  function handleFocusIn(e: FocusEvent): void {
    const target = e.target as HTMLElement
    if (target.tagName !== 'INPUT') return

    const input = target as HTMLInputElement
    const type = input.type

    if (type === 'number') {
      showKeyboard(input, 'numeric')
    } else if (type === 'text' || type === '' || !type) {
      showKeyboard(input, 'full')
    }
    // Ignorar otros tipos (checkbox, radio, etc.)
  }

  function handleClickOutside(e: MouseEvent): void {
    const target = e.target as HTMLElement
    // No cerrar si el clic fue en el teclado o en un input
    if (target.closest('[data-virtual-keyboard]') || target.tagName === 'INPUT') return
    hideKeyboard()
  }

  document.addEventListener('focusin', handleFocusIn)
  document.addEventListener('mousedown', handleClickOutside)

  return () => {
    document.removeEventListener('focusin', handleFocusIn)
    document.removeEventListener('mousedown', handleClickOutside)
  }
}, [enabled])
```

### Prevención de Pérdida de Foco

Un problema común con teclados virtuales: al hacer clic en una tecla del teclado, el input pierde el foco. Solución:

```typescript
// En cada botón del teclado:
<button
  onMouseDown={(e) => e.preventDefault()} // Previene que el input pierda foco
  onClick={() => onKeyPress('A')}
  data-virtual-keyboard="true"
>
  A
</button>
```

El `preventDefault()` en `mouseDown` evita que el navegador mueva el foco al botón, manteniendo el foco en el input activo.

## Animaciones

### Entrada del Teclado (Slide Up)

```css
/* Teclado completo */
.keyboard-enter {
  transform: translateY(100%);
  opacity: 0;
}
.keyboard-enter-active {
  transform: translateY(0);
  opacity: 1;
  transition: transform 200ms ease-out, opacity 150ms ease-out;
}

/* Teclado numérico */
.numpad-enter {
  transform: scale(0.95);
  opacity: 0;
}
.numpad-enter-active {
  transform: scale(1);
  opacity: 1;
  transition: transform 150ms ease-out, opacity 100ms ease-out;
}
```

### Implementación con Tailwind

```tsx
// Usando clases de Tailwind para la animación
<div className={cn(
  "transition-all duration-200 ease-out",
  visible
    ? "translate-y-0 opacity-100"
    : "translate-y-full opacity-0 pointer-events-none"
)}>
  {/* Contenido del teclado */}
</div>
```

## Manejo de Errores

### Edge Cases

1. **Input desaparece del DOM durante edición**
   - El Provider escucha `MutationObserver` o valida `document.contains(activeInput)` antes de enviar teclas
   - Si el input ya no existe, se oculta el teclado

2. **Múltiples inputs reciben foco rápidamente**
   - Debounce de 50ms en el handler de `focusin` para evitar parpadeo
   - El último input enfocado siempre gana

3. **Valor del input excede maxLength**
   - Antes de insertar un carácter, verificar `input.maxLength`
   - Si se alcanzó el límite, la tecla se ignora (sin feedback de error)

4. **Input con transformaciones (toUpperCase)**
   - El teclado virtual inyecta el carácter tal cual
   - El `onChange` handler del componente aplica la transformación como siempre
   - El Provider no necesita conocer las transformaciones

5. **Teclado físico y virtual simultáneos**
   - No hay conflicto: ambos modifican `input.value` y disparan `onChange`
   - El teclado virtual permanece visible mientras el input tenga foco

### Validación

- El teclado numérico no permite caracteres no numéricos (solo 0-9 y punto decimal)
- El teclado completo permite cualquier carácter del layout actual
- La validación final la hace el componente propietario del input (como siempre)

## Estrategia de Testing

### Tests Unitarios

1. **VirtualKeyboardProvider**
   - Verifica que `showKeyboard` se llama al enfocar un input cuando está habilitado
   - Verifica que no se muestra cuando está deshabilitado
   - Verifica detección correcta de tipo (number → numeric, text → full)
   - Verifica ocultación al clic fuera

2. **NumericKeypad**
   - Renderiza layout correcto (0-9, ⌫, C, ✓)
   - Dispara `onKeyPress` con el dígito correcto
   - Dispara `onBackspace` al pulsar ⌫
   - Dispara `onClear` al pulsar C

3. **FullKeyboard**
   - Renderiza layout español con Ñ
   - Renderiza layout inglés sin Ñ
   - Toggle de shift cambia entre mayúsculas/minúsculas
   - Teclas especiales disparan callbacks correctos

4. **Posicionamiento**
   - Teclado numérico se posiciona debajo del input
   - Teclado numérico se posiciona arriba si no hay espacio abajo
   - Teclado completo siempre está en `bottom: 0`

### Tests de Integración

1. **Con KioskoView**: Input numérico → aparece numpad → se modifica cantidad → store se actualiza
2. **Con EventoEditor**: Input texto → aparece teclado completo → se escribe texto → campo se actualiza
3. **Toggle en Settings**: Activar → inputs muestran teclado → Desactivar → inputs no muestran teclado

### Testing Manual

- Probar en pantalla táctil real
- Verificar que las teclas son lo suficientemente grandes
- Verificar que no hay pulsaciones accidentales
- Verificar que el scroll automático funciona correctamente

## Estimación de Esfuerzo

### Desglose por Componente

| Componente | Esfuerzo | Complejidad |
|---|---|---|
| Persistencia (IPC + SQLite) | 0.5 días | Baja |
| Settings Store (extensión) | 0.5 días | Baja |
| VirtualKeyboardSection (UI settings) | 0.5 días | Baja |
| VirtualKeyboardProvider (Context) | 1 día | Media |
| NumericKeypad | 1 día | Baja-Media |
| FullKeyboard + Layouts ES/EN | 1.5 días | Media |
| VirtualKeyboardOverlay + animaciones | 0.5 días | Baja |
| Posicionamiento + scroll | 0.5 días | Media |
| Integración + testing | 1 día | Media |
| **Total** | **~7 días** | **Media** |

### Esfuerzo Adicional por Dual Layout (ES/EN)

El soporte de dos idiomas añade aproximadamente **0.5-1 día extra** respecto a un solo layout:
- Definir el array de teclas para cada idioma: ~2 horas
- Lógica condicional para seleccionar layout: ~1 hora
- UI del selector en settings: ~2 horas
- Testing de ambos layouts: ~3 horas

**Conclusión**: El esfuerzo adicional por tener ES + EN es mínimo (~15% del total) porque la lógica de rendering es idéntica; solo cambian los datos del layout.

## Riesgos y Mitigaciones

### Riesgo 1: Compatibilidad con React Synthetic Events
**Preocupación**: El patrón `nativeInputValueSetter` podría no disparar correctamente los eventos de React
**Mitigación**: 
- Usar `new Event('input', { bubbles: true })` que React intercepta correctamente
- Alternativa: dispatch un `InputEvent` con `inputType: 'insertText'`
- Testear exhaustivamente con cada tipo de input en la app

### Riesgo 2: Rendimiento con Re-renders
**Preocupación**: El Provider podría causar re-renders innecesarios en toda la app
**Mitigación**:
- Usar `useMemo` y `useCallback` en el value del context
- Separar el estado del teclado (frecuente) del estado de configuración (raro)
- El overlay se renderiza via Portal, fuera del árbol de la app

### Riesgo 3: Posicionamiento del Numpad en Kiosko
**Preocupación**: Los inputs de TariffRow están en una tabla con scroll; el popover podría quedar desalineado
**Mitigación**:
- Usar `getBoundingClientRect()` que da coordenadas viewport (no de scroll)
- Recalcular posición en cada apertura
- Considerar `position: fixed` para el numpad también

### Riesgo 4: Pérdida de Foco en Dispositivos Táctiles
**Preocupación**: En touch, los eventos de focus/blur se comportan diferente
**Mitigación**:
- `preventDefault()` en `mouseDown` y `touchStart` de las teclas
- Testear en dispositivo táctil real o emulador

### Riesgo 5: Conflicto con Teclado Nativo del SO
**Preocupación**: En Windows con pantalla táctil, el SO podría mostrar su propio teclado
**Mitigación**:
- Electron permite deshabilitar el teclado del SO: `app.commandLine.appendSwitch('disable-features', 'InputPaneOnScreenKeyboard')`
- Documentar esta opción como configuración avanzada

## Mejoras Futuras

- Soporte de más idiomas (francés, alemán, portugués)
- Modo "arrastrar" para mover el teclado numérico a otra posición
- Haptic feedback (vibración) en dispositivos que lo soporten
- Teclado de caracteres especiales extendido (€, £, ¥, ©, etc.)
- Predicción de texto / autocompletado para campos de eventos
- Tema oscuro para el teclado
