# Implementation Plan: Teclado Virtual

## Overview

Este plan implementa un teclado virtual para la aplicación Stamp Sales con dos variantes (numérico y completo), soporte para layouts en español e inglés, y configuración persistida. La implementación se divide en 7 fases incrementales, cada una validable de forma independiente.

La arquitectura se basa en un React Context global (VirtualKeyboardProvider) que detecta inputs enfocados y renderiza el teclado apropiado sin modificar los componentes existentes, usando el patrón `nativeInputValueSetter` para inyectar valores.

## Tasks

- [x] 1. Fase 1: Persistencia y Configuración (Backend)
  - [x] 1.1 Añadir campos en SQLite para configuración del teclado
    - Modificar el esquema de `user_config` en `src/main/database/` para añadir `virtual_keyboard_enabled` (INTEGER DEFAULT 0) y `virtual_keyboard_language` (TEXT DEFAULT 'es')
    - Crear migración si el proyecto usa migraciones, o añadir al schema inicial
    - _Requisitos: 1.5, 1.6, 1.7, 2.6_

  - [x] 1.2 Crear handlers IPC para configuración del teclado
    - En `src/main/ipc/` añadir handlers: `get-virtual-keyboard-enabled`, `set-virtual-keyboard-enabled`, `get-virtual-keyboard-language`, `set-virtual-keyboard-language`
    - Cada handler lee/escribe en la tabla `user_config` de SQLite
    - _Requisitos: 1.5, 2.6, 9.5_

  - [x] 1.3 Exponer API en preload bridge
    - En `src/preload/index.ts` añadir al objeto `config`: `getVirtualKeyboardEnabled()`, `setVirtualKeyboardEnabled(enabled)`, `getVirtualKeyboardLanguage()`, `setVirtualKeyboardLanguage(lang)`
    - Actualizar la interfaz TypeScript `ElectronAPI`
    - _Requisitos: 1.5, 9.5_

  - [x] 1.4 Extender el settings store con estado del teclado virtual
    - En `src/renderer/src/stores/settings.store.ts` añadir: `virtualKeyboardEnabled: boolean`, `virtualKeyboardLanguage: 'es' | 'en'`
    - Añadir acciones: `setVirtualKeyboardEnabled(enabled)`, `setVirtualKeyboardLanguage(lang)`
    - Cargar los valores en `loadSettings()` junto con los demás settings
    - _Requisitos: 1.5, 1.6, 2.6, 9.2_

- [x] 2. Fase 2: Sección de Configuración en UI (Settings)
  - [x] 2.1 Crear componente VirtualKeyboardSection
    - Crear `src/renderer/src/components/settings/VirtualKeyboardSection.tsx`
    - Renderizar toggle switch para activar/desactivar el teclado virtual
    - Renderizar selector de idioma (Español/Inglés) solo visible cuando el teclado está activado
    - Conectar con `useSettingsStore` para leer/escribir configuración
    - Usar mismo patrón de estilos que otras secciones de settings (Tailwind)
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

  - [x] 2.2 Integrar VirtualKeyboardSection en SettingsView
    - En `src/renderer/src/views/SettingsView.tsx` añadir nueva sección colapsable "TECLADO VIRTUAL"
    - Seguir el patrón existente: botón con checkbox + contenido colapsable
    - Posicionar después de la sección de Idioma (Language) por coherencia temática
    - Añadir estado `keyboardOpen` para controlar la sección colapsable
    - _Requisitos: 1.1, 9.1, 9.3_

  - [x] 2.3 Añadir traducciones i18n para la sección
    - En los archivos de traducción (`src/renderer/src/i18n/`) añadir claves: `settings.virtualKeyboard`, `settings.virtualKeyboardEnabled`, `settings.virtualKeyboardLanguage`, `settings.keyboardSpanish`, `settings.keyboardEnglish`
    - _Requisitos: 9.7_

- [x] 3. Checkpoint — Verificar persistencia y UI de configuración
  - Activar/desactivar teclado virtual desde Settings y verificar que persiste al reiniciar
  - Cambiar idioma del teclado y verificar que persiste
  - Verificar que el selector de idioma solo aparece cuando el teclado está activado
  - Preguntar al usuario si hay dudas.

- [x] 4. Fase 3: Layouts de Teclado (Datos)
  - [x] 4.1 Crear archivo de definición de layouts
    - Crear `src/renderer/src/components/virtual-keyboard/layouts.ts`
    - Definir interfaz `KeyDef`: `{ key: string, label?: string, width?: number, type?: 'char' | 'action' }`
    - Definir tipo `KeyboardLayout` como array de filas de teclas
    - Implementar `LAYOUT_NUMERIC`: disposición calculadora 4×4 (7-8-9-⌫ / 4-5-6-C / 1-2-3-✓ / 0-.)
    - Implementar `LAYOUT_ES`: QWERTY español con Ñ, 5 filas (números + 4 filas de letras)
    - Implementar `LAYOUT_EN`: QWERTY inglés sin Ñ, 5 filas
    - Exportar función `getFullLayout(lang: 'es' | 'en'): KeyboardLayout`
    - _Requisitos: 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 4.2 Crear utilidades de teclado
    - Crear `src/renderer/src/components/virtual-keyboard/keyboard-utils.ts`
    - Implementar `setNativeValue(input, value)`: inyecta valor usando nativeInputValueSetter + dispatch Event
    - Implementar `calculateNumericPosition(inputRect): { top, left }`: calcula posición del numpad relativa al input
    - Implementar `ensureInputVisible(input, keyboardHeight)`: scroll automático si el input queda oculto
    - _Requisitos: 5.1, 5.2, 5.3, 6.3, 6.4, 6.6_

- [x] 5. Fase 4: VirtualKeyboardProvider (Context Global)
  - [x] 5.1 Crear el context y provider
    - Crear `src/renderer/src/components/virtual-keyboard/VirtualKeyboardContext.tsx`
    - Definir `VirtualKeyboardContextValue` con: `enabled`, `keyboardLanguage`, `activeInput`, `keyboardType`, `isVisible`, `showKeyboard()`, `hideKeyboard()`, `pressKey()`, `pressBackspace()`, `clearInput()`
    - Implementar `VirtualKeyboardProvider` como componente funcional con `useState` y `useCallback`
    - Leer `virtualKeyboardEnabled` y `virtualKeyboardLanguage` desde `useSettingsStore`
    - _Requisitos: 1.3, 1.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 9.2_

  - [x] 5.2 Implementar detección de focus global
    - Dentro del Provider, añadir `useEffect` que escucha `focusin` en `document`
    - Filtrar solo elementos `<input>` (ignorar checkboxes, radios, buttons)
    - Determinar tipo: `input.type === 'number'` → 'numeric', `input.type === 'text' || !input.type` → 'full'
    - Guardar referencia al input activo (`activeInput`)
    - Añadir listener `mousedown` para detectar clics fuera y cerrar el teclado
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.6_

  - [x] 5.3 Implementar lógica de pulsación de teclas
    - `pressKey(key)`: obtener valor actual del activeInput, insertar carácter en la posición del cursor, llamar `setNativeValue()`, respetar `maxLength`
    - `pressBackspace()`: eliminar último carácter (o carácter antes del cursor), llamar `setNativeValue()`
    - `clearInput()`: llamar `setNativeValue(input, '')` o `setNativeValue(input, '0')` para numéricos
    - Verificar que el input sigue en el DOM antes de cada operación
    - _Requisitos: 6.3, 6.4, 7.4, 7.5, 8.6_

  - [x] 5.4 Integrar Provider en App.tsx
    - Envolver el contenido de `App.tsx` (o `MainLayout`) con `<VirtualKeyboardProvider>`
    - El Provider debe estar por encima de todas las vistas que contienen inputs
    - _Requisitos: 9.1_

- [x] 6. Fase 5: Componentes de Teclado (UI)
  - [x] 6.1 Crear componente NumericKeypad
    - Crear `src/renderer/src/components/virtual-keyboard/NumericKeypad.tsx`
    - Renderizar grid 4×4 con teclas del `LAYOUT_NUMERIC`
    - Cada tecla: `<button>` con `onMouseDown={e => e.preventDefault()}` y `onClick` para enviar la pulsación
    - Estilos: fondo gris claro, teclas redondeadas con sombra, 44×44px mínimo, gap de 4px
    - Posicionamiento: `position: fixed` con coordenadas calculadas por `calculateNumericPosition`
    - Atributo `data-virtual-keyboard="true"` en el contenedor raíz
    - Dimensiones: ~200×250px
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 8.1, 8.3, 8.7_

  - [x] 6.2 Crear componente FullKeyboard
    - Crear `src/renderer/src/components/virtual-keyboard/FullKeyboard.tsx`
    - Aceptar prop `language: 'es' | 'en'` y renderizar layout correspondiente
    - Implementar estado local `shiftActive` para toggle mayúsculas/minúsculas
    - Renderizar cada fila como flex row con teclas de ancho variable (según `key.width`)
    - Teclas de acción (Shift, Backspace, Enter, Space, Close) con estilos diferenciados
    - Posicionamiento: `position: fixed; bottom: 0; left: 0; right: 0; height: 280px; z-index: 50`
    - Atributo `data-virtual-keyboard="true"` en el contenedor raíz
    - Todas las teclas con `onMouseDown={e => e.preventDefault()}` para no robar foco
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12, 8.1, 8.3, 8.7_

  - [x] 6.3 Crear componente VirtualKeyboardOverlay
    - Crear `src/renderer/src/components/virtual-keyboard/VirtualKeyboardOverlay.tsx`
    - Renderizar usando React Portal (`createPortal` al `document.body`)
    - Leer del context: `isVisible`, `keyboardType`, `keyboardLanguage`, `activeInput`
    - Renderizar `NumericKeypad` o `FullKeyboard` según `keyboardType`
    - Aplicar animación de entrada/salida: translate-y + opacity con transition 200ms
    - No renderizar nada si `!isVisible`
    - _Requisitos: 5.5, 8.5_

  - [x] 6.4 Implementar feedback visual de pulsación
    - En ambos teclados, añadir estado local para tecla presionada (`activeKey`)
    - Al hacer `mousedown`/`touchstart` en una tecla: aplicar clase `scale-95 bg-blue-200` (o similar)
    - Al hacer `mouseup`/`touchend`: quitar la clase
    - Transición de 100ms para el efecto
    - _Requisitos: 8.1_

- [x] 7. Checkpoint — Verificar teclados funcionando de forma aislada
  - Activar teclado virtual en configuración
  - Hacer clic en un input numérico en KioskoView → debe aparecer teclado numérico
  - Hacer clic en un input de texto en MaquinaView → debe aparecer teclado completo
  - Verificar que las pulsaciones modifican el valor del input
  - Verificar que el store de Zustand se actualiza correctamente
  - Verificar layouts ES y EN cambiando la configuración
  - Preguntar al usuario si hay dudas.

- [x] 8. Fase 6: Integración y Pulido
  - [x] 8.1 Ajustar posicionamiento del numpad en KioskoView
    - Testear con la tabla de tarifas (scroll, tabs) y asegurar que el numpad no tapa el input activo
    - Si es necesario, recalcular posición en scroll events
    - Verificar que las pestañas de la tabla de tarifas siguen funcionando con el teclado visible
    - _Requisitos: 6.5, 6.6_

  - [x] 8.2 Implementar scroll automático para teclado completo
    - Cuando el teclado completo aparece, llamar `ensureInputVisible()` para hacer scroll si el input queda tapado
    - Aplicar `padding-bottom` temporal al contenido de la página cuando el teclado está visible (280px)
    - Restaurar padding al cerrar el teclado
    - _Requisitos: 4.12_

  - [x] 8.3 Añadir botón de cierre visible en ambos teclados
    - Numpad: El botón ✓ (confirmar) cierra el teclado
    - Full keyboard: Añadir botón ✕ en esquina superior derecha o como tecla en la última fila
    - El botón debe ser claramente visible e intuitivo
    - _Requisitos: 8.4_

  - [x] 8.4 Deshabilitar teclado nativo del SO en Electron (opcional)
    - En `src/main/index.ts`, añadir `app.commandLine.appendSwitch(...)` si se detecta que la configuración de teclado virtual está activada
    - Esto previene que Windows muestre su teclado en pantalla además del nuestro
    - Marcar como configurable por si el usuario lo necesita
    - _Requisitos: 8.6_

- [x] 9. Fase 7: Accesibilidad
  - [x] 9.1 Añadir atributos ARIA a las teclas
    - Cada `<button>` de tecla: `aria-label` descriptivo (ej: "Tecla A", "Borrar", "Espacio", "Cerrar teclado")
    - Contenedor del teclado: `role="group"`, `aria-label="Teclado virtual numérico"` o `"Teclado virtual"`
    - Tecla Shift: `aria-pressed={shiftActive}` para indicar estado
    - _Requisitos: 8.7_

  - [x] 9.2 Verificar coexistencia con teclado físico
    - Confirmar que al escribir con teclado físico mientras el virtual está visible, ambos inputs se procesan
    - Confirmar que Tab, Enter y Escape del teclado físico funcionan para navegar
    - El teclado virtual no debe capturar ni bloquear eventos del teclado físico
    - _Requisitos: 8.2, 8.6_

  - [x] 9.3 Añadir soporte i18n para etiquetas de teclas especiales
    - Las teclas de acción (Espacio/Space, Borrar/Delete, Mayúsculas/Shift) deben usar las traducciones de i18n
    - Actualizar los archivos de traducción con las claves necesarias
    - _Requisitos: 9.7_

- [~] 10. Checkpoint Final — Verificación completa
  - Verificar que la configuración persiste correctamente (activado/desactivado + idioma)
  - Verificar teclado numérico en KioskoView: cantidades se actualizan, subtotales correctos
  - Verificar teclado completo en MaquinaView y EventoEditor: texto se escribe correctamente
  - Verificar cambio de layout ES → EN: Ñ aparece/desaparece
  - Verificar que desactivar el teclado lo oculta completamente
  - Verificar animaciones de aparición/desaparición
  - Verificar que teclado físico sigue funcionando con el virtual activado
  - Verificar feedback visual al pulsar teclas
  - Hacer build de producción y verificar que no hay errores
  - Preguntar al usuario si hay dudas.

## Notes

- La implementación usa el patrón `nativeInputValueSetter` para no modificar componentes existentes (TariffRow, DynamicTariffRow, EventoEditor, etc.)
- El teclado numérico usa posicionamiento tipo popover (cerca del input); el completo usa fixed-bottom
- Cada fase se puede desarrollar y testear de forma independiente
- La tarea 8.4 (deshabilitar teclado del SO) es opcional y depende del entorno de despliegue
- El esfuerzo estimado total es de ~7 días de desarrollo
- El esfuerzo adicional por soporte dual ES/EN es mínimo (~0.5-1 día extra, ~15% del total)
- Los layouts se definen como datos (arrays de objetos), lo que facilita añadir más idiomas en el futuro
