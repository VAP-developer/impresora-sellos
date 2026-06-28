# Task 4.12: Verificar que los stores cargan datos correctamente al iniciar la app

## Resumen

Esta subtarea verifica que al arrancar la aplicación, los stores Zustand se hidratan correctamente con los datos del main process (SQLite) vía IPC. Se actualizó `App.tsx` para disparar la carga de stores en el montaje y se creó un test de integración que valida el flujo completo.

---

## Estado: ✅ Completada

---

## ¿Qué se hizo?

1. **Actualización de `App.tsx`** — Se añadió la lógica de inicialización que llama a `loadConfig()` y `fetchStatus()` al montar el componente raíz, con estados intermedios de loading/error.

2. **Test de integración** — Se creó `src/renderer/src/__tests__/app-init.test.tsx` con 10 tests que verifican que todos los stores se hidratan correctamente al arrancar.

3. **Fix de compatibilidad de build** — Se corrigieron dos problemas de paths que impedían ejecutar la app:
   - `package.json` referenciaba `./out/main/index.mjs` pero el build genera `index.js`
   - `src/main/index.ts` referenciaba `../preload/index.mjs` pero el preload se genera como `index.js`

4. **Rebuild de módulo nativo** — Se recompiló `better-sqlite3` contra los headers de Electron (el módulo estaba compilado para Node.js del sistema, no para Electron).

5. **Script de rebuild** — Se añadió `npm run rebuild` a package.json para facilitar la recompilación de módulos nativos tras instalar dependencias.

---

## Archivos creados/modificados

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/renderer/src/App.tsx` | **Modificado** | Añadida inicialización de stores al montar + estados loading/error |
| `src/renderer/src/__tests__/app-init.test.tsx` | **Creado** | 10 tests de integración para verificar carga de stores |
| `package.json` | **Modificado** | Corregido `main` a `./out/main/index.js` + añadido script `rebuild` |
| `src/main/index.ts` | **Modificado** | Corregida ruta del preload a `../preload/index.js` |

---

## Detalle de cambios

### `src/renderer/src/App.tsx`

Se transformó de un componente estático placeholder a un componente que:

1. **Dispara la carga de stores** al montar via `useEffect`:
   - `useConfigStore.loadConfig()` — carga configuración desde SQLite
   - `usePrinterStore.fetchStatus()` — obtiene estado de impresoras

2. **Muestra estados intermedios**:
   - `loading = true` → "Cargando configuración..."
   - `error != null` → "Error al cargar la aplicación" + mensaje
   - `config == null` → "Inicializando..."
   - `config cargada` → contenido principal

```tsx
import { useEffect } from 'react'
import { useConfigStore } from '@renderer/stores/config.store'
import { usePrinterStore } from '@renderer/stores/printer.store'

function App(): JSX.Element {
  const loadConfig = useConfigStore((s) => s.loadConfig)
  const fetchStatus = usePrinterStore((s) => s.fetchStatus)
  const config = useConfigStore((s) => s.config)
  const loading = useConfigStore((s) => s.loading)
  const error = useConfigStore((s) => s.error)

  useEffect(() => {
    loadConfig()
    fetchStatus()
  }, [loadConfig, fetchStatus])

  if (loading) { /* ... "Cargando configuración..." */ }
  if (error) { /* ... "Error al cargar la aplicación" */ }
  if (!config) { /* ... "Inicializando..." */ }

  return (/* contenido principal */)
}
```

### Flujo de inicialización

```
App monta
  │
  ├── useEffect → loadConfig()
  │                  │
  │                  ├── ipc.getConfig() → main process → SQLite
  │                  │     └── set({ config, loading: false })
  │                  │
  │                  └── ipc.onConfigChange(callback)  ← suscripción reactiva
  │
  └── useEffect → fetchStatus()
                     │
                     └── ipc.getPrinterStatus() → main process
                           └── set({ printers, loading: false })
```

---

### Test de integración: `app-init.test.tsx`

| # | Test | Qué verifica |
|---|------|-------------|
| 1 | `should load config store on app mount` | Config se carga del IPC al montar App |
| 2 | `should load printer status on app mount` | Estado de impresoras se obtiene al montar |
| 3 | `should display loading state while config is being fetched` | UI muestra "Cargando..." mientras espera |
| 4 | `should display error state when config load fails` | UI muestra error si IPC falla |
| 5 | `should render main content after successful load` | Contenido principal aparece tras carga exitosa |
| 6 | `should subscribe to config changes from main process` | Se registra listener de cambios reactivos |
| 7 | `should have kiosko store initialized with zero quantities` | Kiosko arranca con cantidades en 0 |
| 8 | `should have orders store in clean initial state` | Orders arranca sin errores ni datos previos |
| 9 | `should allow kiosko store to compute totals after config is loaded` | Los cálculos de tarifa funcionan con la config cargada |
| 10 | `should handle printer status load failure gracefully` | Fallo de impresoras no bloquea la app |

---

## Problemas encontrados y resueltos

### 1. Entry point mismatch (`.mjs` vs `.js`)

**Problema**: `package.json` declaraba `"main": "./out/main/index.mjs"` pero electron-vite genera `out/main/index.js`.

**Síntoma**: `Error: No electron app entry file found: .../out/main/index.mjs`

**Solución**: Cambiar a `"main": "./out/main/index.js"` en `package.json`.

### 2. Preload path mismatch

**Problema**: `src/main/index.ts` referenciaba `../preload/index.mjs` pero el preload se genera como `index.js`.

**Síntoma**: `electronAPI is not available. Make sure the app is running inside Electron.`

**Solución**: Cambiar a `join(__dirname, '../preload/index.js')` en la config de `BrowserWindow`.

### 3. Native module ABI mismatch (better-sqlite3)

**Problema**: `better-sqlite3` estaba compilado contra Node.js del sistema (NODE_MODULE_VERSION 115) pero Electron 30 usa NODE_MODULE_VERSION 123.

**Síntoma**: `The module was compiled against a different Node.js version using NODE_MODULE_VERSION 115. This version of Node.js requires NODE_MODULE_VERSION 123.`

**Solución**:
```bash
npx electron-rebuild -f -w better-sqlite3
```

**Prevención**: Se añadió script `"rebuild"` en package.json:
```json
"rebuild": "npx @electron/rebuild -f -w better-sqlite3"
```

---

## Cómo ejecutar la app tras `npm install`

```bash
# 1. Recompilar módulos nativos contra Electron
npm run rebuild

# 2. Arrancar en modo desarrollo
ELECTRON_DISABLE_SANDBOX=1 npm run dev
```

> **Nota**: `ELECTRON_DISABLE_SANDBOX=1` es necesario en Linux cuando el sandbox de Chrome no está configurado con permisos SUID.

---

## Verificación

```bash
# Tests pasan (358 tests, 18 archivos):
$ npm test
# → Test Files  18 passed (18)
# → Tests  358 passed (358)

# Build compila sin errores:
$ npm run build
# → ✓ built in XXXms (3 bundles: main, preload, renderer)
```

---

## Relación con requisitos

| Comportamiento verificado | Requisitos |
|--------------------------|-----------|
| Config se carga al arrancar | Req 16 (offline-first), Req 17 (arranque rápido) |
| Estado de impresoras disponible | Req 8 (gestión de impresión) |
| Kiosko con cantidades en 0 al inicio | Req 1 (gestión de venta) |
| Límites calculables tras carga | Req 2 (cálculo de límites) |
| Fallo de impresoras no bloquea la app | Req 16 (100% funcional offline) |

---

## Próximo paso

Con los stores cargándose correctamente, la siguiente tarea es **Task 5: Navegación y Layout** — instalar react-router-dom y crear las 5 vistas con navegación funcional.
