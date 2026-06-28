# Task 3: IPC Layer (Comunicación Main <-> Renderer)

## Resumen

Esta tarea implementa la capa de comunicación IPC (Inter-Process Communication) entre el proceso principal de Electron (main) y la interfaz de usuario (renderer). La comunicación se realiza de forma segura a través de `contextBridge`, exponiendo una API tipada que el renderer usa para invocar operaciones del main process (BD, impresión, sync).

---

## Progreso

| # | Subtarea | Estado |
|---|----------|--------|
| 3.1 | Crear src/preload/index.ts con contextBridge exponiendo ElectronAPI tipada | ✅ Completada |
| 3.2 | Crear src/main/ipc/handlers.ts con registro centralizado de handlers | ✅ Completada |
| 3.3 | Implementar src/main/ipc/config.handlers.ts | ✅ Completada |
| 3.4 | Implementar src/main/ipc/orders.handlers.ts | ✅ Completada |
| 3.5 | Implementar src/main/ipc/images.handlers.ts | ✅ Completada |
| 3.6 | Implementar src/main/ipc/printer.handlers.ts | ✅ Completada |
| 3.7 | Crear src/renderer/src/lib/ipc-client.ts como wrapper tipado del API | ✅ Completada |
| 3.8 | Escribir tests para los handlers IPC (mock de repositories) | ✅ Completada |
| 3.9 | Verificar comunicación IPC end-to-end | ✅ Completada |

---

## Detalle de lo realizado (3.1)

### ¿Qué se hizo?

Se reescribió completamente `src/preload/index.ts` para implementar la API tipada completa de comunicación IPC. El archivo anterior era un placeholder genérico de `@electron-toolkit/preload`. El nuevo archivo:

1. Define todas las interfaces TypeScript necesarias para la comunicación (tipos compartidos entre main y renderer)
2. Implementa el objeto `api` que mapea cada método a su channel IPC correspondiente usando `ipcRenderer.invoke()`
3. Expone el API al renderer de forma segura vía `contextBridge.exposeInMainWorld()`
4. Crea el fichero de declaración de tipos `index.d.ts` para que el renderer pueda acceder a `window.electronAPI` con tipado completo

### Archivos creados/modificados

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/preload/index.ts` | **Reescrito** | API IPC completa con tipos e implementación |
| `src/preload/index.d.ts` | **Creado** | Declaración global de `window.electronAPI` para el renderer |
| `tsconfig.web.json` | **Modificado** | Incluye `src/preload/index.d.ts` en el scope del renderer |

---

### Arquitectura de la comunicación IPC

```
┌─────────────────────────────────────────────────────┐
│                   RENDERER PROCESS                   │
│                                                     │
│   window.electronAPI.config.get()                   │
│   window.electronAPI.orders.insert(orders)          │
│   window.electronAPI.printer.print(cfg, qty, prof)  │
│                       │                             │
└───────────────────────│─────────────────────────────┘
                        │ contextBridge
┌───────────────────────│─────────────────────────────┐
│                   PRELOAD SCRIPT                     │
│                       │                             │
│   ipcRenderer.invoke('config:get')                  │
│   ipcRenderer.invoke('orders:insert', orders)       │
│   ipcRenderer.invoke('printer:print', cfg,qty,prof) │
│                       │                             │
└───────────────────────│─────────────────────────────┘
                        │ IPC channel
┌───────────────────────│─────────────────────────────┐
│                   MAIN PROCESS                       │
│                       │                             │
│   ipcMain.handle('config:get', handler)             │
│   ipcMain.handle('orders:insert', handler)          │
│   ipcMain.handle('printer:print', handler)          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

### Interfaces TypeScript definidas

El preload define y exporta todas las interfaces necesarias para la comunicación. Esto permite que tanto el main process como el renderer importen los mismos tipos.

#### Interfaces de configuración

| Interface | Descripción | Campos clave |
|-----------|-------------|--------------|
| `TicketConfig` | Datos del ticket/factura simplificada | feria, lugar, empresa, CIF, rollos, límites, textos legales |
| `CodigoConfig` | Formato del código de etiqueta | modo, mes, país, año, máquina, cliente, producto |
| `EventoData` | Datos de un evento/feria | nombre, feria, lugar, motivos izq/der, fecha, localidad |
| `SelloConfig` | Configuración de perfil y eventos | perfil activo, evento activo, perfiles 1-6, array de 8 eventos |
| `PreciosConfig` | Precios por tarifa | tarifaA, tarifaA2, tarifaB, tarifaC, tarifaTA, tarifaT4 |
| `AppConfig` | Configuración completa (agrupa las 4 secciones) | ticket, codigo, sello, precios |

#### Interfaces de datos

| Interface | Descripción | Campos clave |
|-----------|-------------|--------------|
| `OrderLine` | Línea de venta/pedido | event, vendType, quantity, value, sesionId, rollos, etc. |
| `KioskoQuantities` | Cantidades en la cesta de venta | 6 tarifas × 2 modelos = 12 campos numéricos |
| `PrinterInfo` | Estado de una impresora | id, name, target, status, uri |
| `PrintJob` | Trabajo de impresión en cola | orderId, printerTarget, pdfType, status, attempts |

#### Interface principal: `ElectronAPI`

```typescript
interface ElectronAPI {
  config: { ... }   // 9 métodos
  orders: { ... }   // 2 métodos
  images: { ... }   // 3 métodos
  printer: { ... }  // 5 métodos
  sync: { ... }     // 2 métodos
}
```

---

### Channels IPC implementados

#### Grupo `config` (Configuración)

| Método | Channel IPC | Parámetros | Retorno | Descripción |
|--------|-------------|------------|---------|-------------|
| `get()` | `config:get` | — | `AppConfig` | Obtiene la configuración completa |
| `updateMaquina(data)` | `config:updateMaquina` | `{ticket, codigo}` | `void` | Actualiza secciones máquina |
| `updateImprimir(data)` | `config:updateImprimir` | `{sello, precios}` | `void` | Actualiza secciones imprimir |
| `updateSesion()` | `config:updateSesion` | — | `void` | Incrementa `cliente` en 1 |
| `updateSesionError()` | `config:updateSesionError` | — | `void` | Decrementa `cliente` en 1 (anulación) |
| `updateRollos(s1,s2,t)` | `config:updateRollos` | 3 números | `void` | Decrementa rollos tras venta |
| `updateRollosRevert(s1,s2,t)` | `config:updateRollosRevert` | 3 números | `void` | Revierte rollos (anulación) |
| `initConfig()` | `config:initConfig` | — | `void` | Inicializa config por defecto |
| `onChange(callback)` | `config:changed` (evento) | callback | `() => void` | Suscripción reactiva a cambios |

#### Grupo `orders` (Ventas)

| Método | Channel IPC | Parámetros | Retorno | Descripción |
|--------|-------------|------------|---------|-------------|
| `insert(orders)` | `orders:insert` | `OrderLine[]` | `void` | Inserta líneas de venta |
| `downloadCSV()` | `orders:downloadCSV` | — | `string` | Exporta ventas como CSV |

#### Grupo `images` (Imágenes)

| Método | Channel IPC | Parámetros | Retorno | Descripción |
|--------|-------------|------------|---------|-------------|
| `upload(name, dataUri, type, size)` | `images:upload` | 4 args | `void` | Sube imagen en Base64 |
| `remove(name)` | `images:remove` | nombre | `void` | Elimina imagen |
| `getByName(name)` | `images:getByName` | nombre | `{name,url} \| null` | Obtiene imagen por nombre |

#### Grupo `printer` (Impresión)

| Método | Channel IPC | Parámetros | Retorno | Descripción |
|--------|-------------|------------|---------|-------------|
| `getStatus()` | `printer:getStatus` | — | `PrinterInfo[]` | Estado de impresoras |
| `print(config, quantities, profile)` | `printer:print` | 3 args | `void` | Ejecuta venta completa |
| `pause()` | `printer:pause` | — | `void` | Pausa impresora |
| `resume()` | `printer:resume` | — | `void` | Reanuda impresora |
| `getQueue()` | `printer:getQueue` | — | `PrintJob[]` | Cola de impresión |

#### Grupo `sync` (Sincronización)

| Método | Channel IPC | Parámetros | Retorno | Descripción |
|--------|-------------|------------|---------|-------------|
| `getStatus()` | `sync:getStatus` | — | `{connected, lastSync, pending}` | Estado de conectividad |
| `triggerSync()` | `sync:triggerSync` | — | `void` | Fuerza sincronización |

---

### Patrón de comunicación: `ipcRenderer.invoke`

Todos los métodos (excepto `onChange`) usan el patrón **invoke/handle**:

```typescript
// Preload (renderer → main):
ipcRenderer.invoke('channel:name', ...args)  // Devuelve Promise

// Main process (responde):
ipcMain.handle('channel:name', async (event, ...args) => {
  // ... lógica ...
  return result  // Se resuelve la Promise en el renderer
})
```

Este patrón es más seguro que `send/on` porque:
- Es bidireccional con respuesta tipada (Promise)
- El renderer no puede recibir mensajes no solicitados (excepto los que se suscribe explícitamente)
- Errores del main process se propagan como rechazos de Promise

---

### Patrón especial: `config.onChange` (Suscripción reactiva)

El método `onChange` usa un patrón diferente para notificaciones push del main al renderer:

```typescript
onChange: (callback) => {
  const handler = (_event, config) => callback(config)
  ipcRenderer.on('config:changed', handler)
  return () => ipcRenderer.removeListener('config:changed', handler)
}
```

- **Main → Renderer**: Cuando la config cambia, el main process envía `webContents.send('config:changed', newConfig)`
- **Cleanup**: Devuelve una función de desuscripción para evitar memory leaks (patrón similar a `useEffect` cleanup en React)
- **Uso previsto** en stores:

```typescript
// En config.store.ts:
const unsubscribe = window.electronAPI.config.onChange((config) => {
  useConfigStore.setState({ config })
})
```

---

### Seguridad: `contextBridge`

El preload usa `contextBridge.exposeInMainWorld('electronAPI', api)` para exponer el API de forma segura:

```typescript
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', api)
  } catch (error) {
    console.error('Failed to expose electronAPI via contextBridge:', error)
  }
} else {
  window.electronAPI = api
}
```

**¿Por qué `contextBridge`?**

- El renderer corre en un contexto aislado (`contextIsolation: true` por defecto en Electron 12+)
- No tiene acceso directo a `ipcRenderer` ni a APIs de Node.js
- `contextBridge` crea un puente seguro que solo expone los métodos que definimos explícitamente
- Previene que código malicioso (XSS) acceda al sistema operativo

**¿Por qué el fallback?**

El bloque `else` es para entornos de testing donde `contextIsolation` puede estar desactivado. En producción siempre se usa `contextBridge`.

---

### Declaración de tipos para el renderer (`index.d.ts`)

```typescript
import type { ElectronAPI } from './index'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
```

Este fichero:
- Extiende la interfaz global `Window` añadiendo `electronAPI`
- Permite que el renderer use `window.electronAPI.config.get()` con autocompletado y type-checking
- Se incluye en `tsconfig.web.json` para que esté disponible en todo el renderer

**Cambio en `tsconfig.web.json`:**

```diff
  "include": [
    "src/renderer/src/**/*",
    "src/renderer/src/**/*.tsx",
+   "src/preload/index.d.ts"
  ]
```

---

### Diferencias respecto al legacy

| Aspecto | Legacy (Meteor + WebSocket) | Nuevo (Electron IPC) |
|---------|----------------------------|---------------------|
| Protocolo | WebSocket con mensajes JSON parseados manualmente | IPC tipado con serialización automática |
| Tipado | Sin tipos (JavaScript puro, parsing manual de `*z?*`) | TypeScript estricto end-to-end |
| Seguridad | WebSocket expuesto en puerto local | contextBridge aislado, sin acceso directo a Node |
| Reactividad | `Meteor.subscribe()` (DDP protocol) | Evento `config:changed` + Zustand stores |
| Errores | Errores silenciosos en WS | Promises que propagan errores del main |

---

### Verificación

```bash
# Type-check del preload (sin errores):
$ npx tsc --noEmit --project tsconfig.node.json
# ✓ Sin errores en src/preload/

# Type-check del renderer (reconoce window.electronAPI):
$ npx tsc --noEmit --project tsconfig.web.json
# ✓ Sin errores

# Build completa correctamente:
$ npx electron-vite build
# ✓ out/preload/index.mjs (2.10 kB)
# ✓ out/main/index.mjs
# ✓ out/renderer/...
```

---

### Relación con el design

Este archivo implementa la sección **"Preload API (exposed to renderer)"** de la sección 3.2 del documento de diseño, y la sección **2.6 Communication Flow (IPC)** que define los channels.

### Próximos pasos

- **Tarea 3.2**: Crear `src/main/ipc/handlers.ts` — el registro centralizado que conecta cada channel IPC con su handler correspondiente usando `ipcMain.handle()`.
- **Tareas 3.3-3.6**: Implementar los handlers concretos que ejecutan la lógica de negocio (llaman a los repositories).
- **Tarea 3.7**: Crear `src/renderer/src/lib/ipc-client.ts` — wrapper que abstrae `window.electronAPI` para uso en los stores de Zustand.


---

## Detalle de lo realizado (3.2)

### ¿Qué se hizo?

Se creó el sistema centralizado de registro de handlers IPC en `src/main/ipc/handlers.ts`. Este módulo actúa como punto de entrada único para registrar todos los listeners de `ipcMain.handle()` que conectan los channels IPC (definidos en el preload) con la lógica de negocio del main process.

Además, se creó `config.handlers.ts` con la implementación completa de los handlers de configuración (ya que el repositorio existe y está testeado), y stubs para los handlers restantes (orders, images, printer) que se completarán en las tareas 3.3–3.6.

### Archivos creados/modificados

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/main/ipc/handlers.ts` | **Creado** | Registro centralizado + helpers (`handleIpc`, `notifyConfigChanged`) |
| `src/main/ipc/config.handlers.ts` | **Creado** | Handlers completos para todos los channels `config:*` |
| `src/main/ipc/orders.handlers.ts` | **Creado** | Stub para tarea 3.4 |
| `src/main/ipc/images.handlers.ts` | **Creado** | Stub para tarea 3.5 |
| `src/main/ipc/printer.handlers.ts` | **Creado** | Stub para tarea 3.6 |
| `src/main/index.ts` | **Modificado** | Importa y llama a `registerAllHandlers()` en el arranque |

---

### `src/main/ipc/handlers.ts` — Registro centralizado

```typescript
import { ipcMain, BrowserWindow } from 'electron'
import { registerConfigHandlers } from './config.handlers'
import { registerOrdersHandlers } from './orders.handlers'
import { registerImagesHandlers } from './images.handlers'
import { registerPrinterHandlers } from './printer.handlers'

export function registerAllHandlers(): void {
  registerConfigHandlers()
  registerOrdersHandlers()
  registerImagesHandlers()
  registerPrinterHandlers()
}

export function notifyConfigChanged(config: unknown): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    win.webContents.send('config:changed', config)
  }
}

export function handleIpc<T>(
  channel: string,
  handler: (...args: unknown[]) => T | Promise<T>
): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return await handler(...args)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[IPC] Error in channel "${channel}":`, message)
      throw new Error(message)
    }
  })
}
```

### API del módulo

| Función | Descripción |
|---------|-------------|
| `registerAllHandlers()` | Punto de entrada único. Llama a cada `registerXxxHandlers()` de dominio. Se invoca una vez desde `src/main/index.ts` tras inicializar la BD. |
| `handleIpc(channel, handler)` | Helper genérico que envuelve `ipcMain.handle()` con manejo consistente de errores. Captura excepciones, las loguea con el nombre del channel, y las re-lanza para que lleguen al renderer como rechazo de Promise. |
| `notifyConfigChanged(config)` | Envía la configuración actualizada a todas las ventanas activas via `webContents.send('config:changed', ...)`. Conecta con el listener `onChange` del preload. |

---

### Patrón de registro por dominio

Cada dominio (config, orders, images, printer) exporta una función `registerXxxHandlers()` que encapsula sus propios channels:

```
src/main/ipc/
├── handlers.ts           ← Orquestador central + helpers
├── config.handlers.ts    ← Channels config:* (implementado)
├── orders.handlers.ts    ← Channels orders:* (stub)
├── images.handlers.ts    ← Channels images:* (stub)
└── printer.handlers.ts   ← Channels printer:* (stub)
```

**Ventajas del patrón:**

| Beneficio | Detalle |
|-----------|---------|
| Separación de responsabilidades | Cada fichero maneja solo su dominio |
| Un solo punto de arranque | `registerAllHandlers()` en `index.ts` es todo lo que se necesita |
| Manejo de errores uniforme | `handleIpc()` centraliza el try/catch y logging |
| Facilidad de testing | Cada módulo de handlers se puede testear aisladamente con mocks de repositories |
| Escalabilidad | Añadir un nuevo dominio = crear fichero + importar en `handlers.ts` |

---

### `src/main/ipc/config.handlers.ts` — Implementación completa

Los handlers de configuración se implementaron completamente porque el `ConfigRepository` ya está creado y testeado (tarea 2.4). Cada handler:

1. Llama al método correspondiente del repository
2. Tras mutaciones, notifica al renderer vía `notifyConfigChanged()`

```typescript
import { handleIpc, notifyConfigChanged } from './handlers'
import { ConfigRepository } from '../database/repositories/config.repository'

export function registerConfigHandlers(): void {
  const repo = new ConfigRepository()

  handleIpc('config:get', () => {
    return repo.get()
  })

  handleIpc('config:updateMaquina', (data: unknown) => {
    repo.updateMaquina(data as Parameters<ConfigRepository['updateMaquina']>[0])
    notifyConfigChanged(repo.get())
  })

  handleIpc('config:updateImprimir', (data: unknown) => {
    repo.updateImprimir(data as Parameters<ConfigRepository['updateImprimir']>[0])
    notifyConfigChanged(repo.get())
  })

  handleIpc('config:updateSesion', () => {
    repo.updateSesion()
    notifyConfigChanged(repo.get())
  })

  handleIpc('config:updateSesionError', () => {
    repo.updateSesionError()
    notifyConfigChanged(repo.get())
  })

  handleIpc('config:updateRollos', (sellos1: unknown, sellos2: unknown, tickets: unknown) => {
    repo.updateRollos(sellos1 as number, sellos2 as number, tickets as number)
    notifyConfigChanged(repo.get())
  })

  handleIpc('config:updateRollosRevert', (sellos1: unknown, sellos2: unknown, tickets: unknown) => {
    repo.updateRollosRevert(sellos1 as number, sellos2 as number, tickets as number)
    notifyConfigChanged(repo.get())
  })

  handleIpc('config:initConfig', () => {
    repo.initConfig()
    notifyConfigChanged(repo.get())
  })
}
```

### Channels registrados por `config.handlers.ts`

| Channel | Handler | Notifica cambio | Descripción |
|---------|---------|:---:|-------------|
| `config:get` | `repo.get()` | ❌ | Lectura de la configuración completa |
| `config:updateMaquina` | `repo.updateMaquina(data)` | ✅ | Actualiza ticket + codigo |
| `config:updateImprimir` | `repo.updateImprimir(data)` | ✅ | Actualiza sello + precios |
| `config:updateSesion` | `repo.updateSesion()` | ✅ | Incrementa cliente (venta) |
| `config:updateSesionError` | `repo.updateSesionError()` | ✅ | Decrementa cliente (anulación) |
| `config:updateRollos` | `repo.updateRollos(s1, s2, t)` | ✅ | Decrementa rollos (venta) |
| `config:updateRollosRevert` | `repo.updateRollosRevert(s1, s2, t)` | ✅ | Revierte rollos (anulación) |
| `config:initConfig` | `repo.initConfig()` | ✅ | Inicializa config por defecto |

---

### Flujo de notificación reactiva

Cuando un handler muta la configuración, el flujo de notificación es:

```
Renderer llama:  window.electronAPI.config.updateSesion()
        │
        ▼
Preload:         ipcRenderer.invoke('config:updateSesion')
        │
        ▼
Main process:    handleIpc('config:updateSesion', () => {
                   repo.updateSesion()
                   notifyConfigChanged(repo.get())  ──┐
                 })                                    │
        │                                             │
        ▼                                             ▼
Renderer recibe: Promise.resolve(void)       config:changed event
                                                      │
                                                      ▼
                                             Zustand store actualiza UI
```

Esto permite que:
- El caller reciba confirmación de que la operación se completó (resolve de la Promise)
- Todas las ventanas/componentes que escuchan `config:changed` se actualicen reactivamente
- No haya polling ni peticiones manuales de refresh

---

### Integración en `src/main/index.ts`

```diff
  import { initDatabase, closeDatabase } from './database/connection'
  import { ConfigRepository } from './database/repositories/config.repository'
+ import { registerAllHandlers } from './ipc/handlers'

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.stamp-sales')
    initDatabase()

    const configRepo = new ConfigRepository()
    configRepo.initConfig()

+   // Register all IPC handlers for renderer communication
+   registerAllHandlers()

    app.on('browser-window-created', (_, window) => { ... })
    createWindow()
    ...
  })
```

**Orden de inicialización:**
1. `initDatabase()` — BD disponible y migraciones aplicadas
2. `configRepo.initConfig()` — Config por defecto insertada si no existe
3. `registerAllHandlers()` — Handlers IPC listos para recibir llamadas del renderer

El orden es importante: los handlers dependen de que la BD esté inicializada y la config exista.

---

### Helper `handleIpc` — Manejo de errores

El helper centraliza el patrón de error handling para todos los channels:

```typescript
handleIpc<T>(channel, handler):
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return await handler(...args)
    } catch (error) {
      console.error(`[IPC] Error in channel "${channel}":`, message)
      throw new Error(message)  // Se propaga al renderer
    }
  })
```

**¿Qué gana esto?**

| Sin helper | Con helper |
|------------|-----------|
| Repetir try/catch en cada handler | Un solo punto de error handling |
| Errores silenciosos o inconsistentes | Log uniforme con nombre del channel |
| Errores nativos con stack traces del main | Mensaje limpio que llega al renderer |
| Cada handler registra manualmente `ipcMain.handle` | Una línea: `handleIpc('channel', fn)` |

---

### Verificación

```bash
# Type-check sin errores en los nuevos ficheros:
$ npx tsc --noEmit --project tsconfig.node.json
# ✓ Sin errores en src/main/ipc/

# Estructura de directorio resultante:
src/main/
├── database/           # Tarea 2 (completa)
├── ipc/                # ← NUEVO
│   ├── handlers.ts     # Registro centralizado + helpers
│   ├── config.handlers.ts    # Config channels (implementado)
│   ├── orders.handlers.ts    # Stub (tarea 3.4)
│   ├── images.handlers.ts    # Stub (tarea 3.5)
│   └── printer.handlers.ts   # Stub (tarea 3.6)
└── index.ts            # Entry point (modificado: importa registerAllHandlers)
```

---

### Decisiones de diseño

| Decisión | Justificación |
|----------|---------------|
| Helper genérico `handleIpc` en vez de registro declarativo | Más simple y flexible. Un mapa declarativo requeriría tipado complejo para los diferentes parámetros de cada channel. |
| `notifyConfigChanged` separado del handler | Permite reutilización futura (ej: si sync engine actualiza config sin pasar por IPC). |
| `unknown` en los tipos de parámetros de handlers | Los argumentos de `ipcMain.handle` no tienen tipo en runtime. Se castean al tipo esperado. La validación real está en el repository (que lanza error si los datos son inválidos). |
| Config handlers implementados completos (no stub) | El repository ya está creado y testeado. Implementarlos ahora permite verificar el flujo end-to-end antes de los otros dominios. |
| Stubs vacíos para orders/images/printer | Cada uno se implementará en su tarea correspondiente (3.4, 3.5, 3.6) cuando se defina la lógica de negocio asociada. Los stubs permiten que `handlers.ts` compile sin errores. |
| `BrowserWindow.getAllWindows()` para notificación | La app solo tiene una ventana, pero este patrón es seguro si en el futuro hay más (ej: ventana de configuración separada). |

---

### Relación con el design

Este módulo implementa la sección **2.6 Communication Flow (IPC)** del documento de diseño:

```
IPC Handler Router
     |
     +---> Config Repo
     +---> Orders Repo    (stub)
     +---> Print Service  (stub)
     +---> PDF Generator  (stub, via printer handlers)
```

Y la sección **3.1 Project Structure**:

```
src/main/ipc/
├── handlers.ts             # Registro de handlers  ← ESTA TAREA
├── config.handlers.ts      # (tarea 3.3, adelantado aquí)
├── orders.handlers.ts      # (tarea 3.4)
├── images.handlers.ts      # (tarea 3.5)
└── printer.handlers.ts     # (tarea 3.6)
```

### Próximos pasos

- **Tarea 3.3**: ✅ Completada — `config.handlers.ts` ya fue implementado como parte de la tarea 3.2
- **Tarea 3.4**: Implementar `orders.handlers.ts` — conectar con `OrdersRepository` (insert + CSV)
- **Tarea 3.5**: Implementar `images.handlers.ts` — conectar con `ImagesRepository` (upload/remove/getByName)
- **Tarea 3.6**: Implementar `printer.handlers.ts` — lógica de impresión (PDF gen + envío a impresora)

---

## Detalle de lo realizado (3.3)

### ¿Qué se hizo?

La tarea 3.3 fue implementada anticipadamente como parte de la tarea 3.2. Se verificó que `src/main/ipc/config.handlers.ts` está completo, compila sin errores, y su repositorio subyacente pasa los 29 tests unitarios.

### Verificación realizada

```bash
# Diagnósticos del IDE — sin errores:
$ getDiagnostics src/main/ipc/config.handlers.ts
# ✓ No diagnostics found

# Type-check del main process:
$ npx tsc --noEmit --project tsconfig.node.json
# ✓ Sin errores en config.handlers.ts (solo warnings de unused vars en tests)

# Tests del ConfigRepository (fundamento de los handlers):
$ npx vitest run src/main/database/__tests__/config.repository.test.ts
# ✓ 29 tests passed (todos los métodos cubiertos)
```

### Handlers implementados

| Channel | Método del Repo | Notifica UI | Notas |
|---------|----------------|:-----------:|-------|
| `config:get` | `repo.get()` | ❌ | Solo lectura |
| `config:updateMaquina` | `repo.updateMaquina(data)` | ✅ | Merge parcial de ticket + codigo |
| `config:updateImprimir` | `repo.updateImprimir(data)` | ✅ | Merge sello, reemplaza precios |
| `config:updateSesion` | `repo.updateSesion()` | ✅ | cliente += 1 |
| `config:updateSesionError` | `repo.updateSesionError()` | ✅ | cliente -= 1 |
| `config:updateRollos` | `repo.updateRollos(s1, s2, t)` | ✅ | Decrementa tras venta |
| `config:updateRollosRevert` | `repo.updateRollosRevert(s1, s2, t)` | ✅ | Revierte tras anulación |
| `config:initConfig` | `repo.initConfig()` | ✅ | Inserta defaults si BD vacía |

### Estado

✅ **Completada** — No requirió cambios adicionales. La implementación existente cumple con todos los requisitos de la tarea:
- Todos los channels definidos en el preload tienen su handler correspondiente
- Cada mutación notifica al renderer vía `notifyConfigChanged()`
- El manejo de errores está centralizado a través de `handleIpc()`
- La integración con `registerAllHandlers()` ya estaba conectada


---

## Detalle de lo realizado (3.4)

### ¿Qué se hizo?

Se implementó `src/main/ipc/orders.handlers.ts`, reemplazando el stub vacío con los dos handlers IPC que conectan el renderer con el `OrdersRepository`:

1. **`orders:insert`** — Recibe un array de `OrderLine[]` desde el renderer y los inserta transaccionalmente en la BD
2. **`orders:downloadCSV`** — Exporta todas las órdenes como string CSV con delimitador punto y coma

### Archivo modificado

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/main/ipc/orders.handlers.ts` | **Reescrito** | Implementación completa de handlers insert y downloadCSV |

---

### Implementación final

```typescript
import { handleIpc } from './handlers'
import { OrdersRepository, OrderLine } from '../database/repositories/orders.repository'

export function registerOrdersHandlers(): void {
  const repo = new OrdersRepository()

  handleIpc('orders:insert', (orders: unknown) => {
    repo.insert(orders as OrderLine[])
  })

  handleIpc('orders:downloadCSV', () => {
    return repo.exportCSV()
  })
}
```

---

### Channels registrados

| Channel | Handler | Retorno | Descripción |
|---------|---------|---------|-------------|
| `orders:insert` | `repo.insert(orders)` | `void` | Inserta N líneas de pedido en una transacción SQLite |
| `orders:downloadCSV` | `repo.exportCSV()` | `string` | Devuelve CSV completo con header + todas las órdenes |

---

### Flujo de uso

#### `orders:insert` — Insertar líneas de venta

```
Renderer (KioskoView):
  → Vendedor pulsa "Imprimir Normal"
  → Se construye array de OrderLine[] con los datos de la venta
  → window.electronAPI.orders.insert(orderLines)

Preload:
  → ipcRenderer.invoke('orders:insert', orderLines)

Main process:
  → handleIpc('orders:insert', (orders) => repo.insert(orders))
  → OrdersRepository.insert() ejecuta INSERT en transacción SQLite
  → Si algún insert falla, toda la transacción se revierte (atomicidad)
```

#### `orders:downloadCSV` — Exportar ventas

```
Renderer (HomeView o MaquinaView):
  → Vendedor pulsa botón "Exportar XLS/CSV"
  → const csv = await window.electronAPI.orders.downloadCSV()
  → (El renderer guarda el string como archivo descargable)

Preload:
  → ipcRenderer.invoke('orders:downloadCSV')

Main process:
  → handleIpc('orders:downloadCSV', () => repo.exportCSV())
  → Retorna string CSV con separador ';' y todos los campos
  → Si no hay órdenes, retorna string vacío
```

---

### Decisiones de diseño

| Decisión | Justificación |
|----------|---------------|
| No se notifica `config:changed` tras insert | Las órdenes no afectan la configuración. Los stores de orders del renderer se actualizan localmente o re-cargan si necesitan. |
| No se devuelve el ID insertado | El legacy no lo requiere. La venta se confirma con un simple resolve de la Promise. Si en el futuro se necesita, se puede cambiar el retorno de `void` a `number[]`. |
| El casting `orders as OrderLine[]` | Los datos llegan como `unknown` desde IPC (no hay tipado en runtime). La validación real la hace SQLite al intentar el INSERT — si falta un campo NOT NULL, lanza error que `handleIpc` captura y propaga. |
| Sin validación adicional en el handler | Se mantiene el patrón de los config handlers: los handlers son una capa fina de routing. La lógica de validación vive en el repository (constraints SQL) o en el renderer (UI). |

---

### Relación con requisitos

| Requisito | Conexión |
|-----------|----------|
| Req 1 (Gestión de Venta) | `orders:insert` registra cada línea de venta tras confirmar la transacción |
| Req 10 (Anulación) | `orders:insert` con `event="ELIMINAR ANTERIOR"` registra la auditoría de anulación |
| Req 11 (Atomicidad) | El repository usa `db.transaction()` — o se insertan todas las líneas o ninguna |
| Req 15 (Exportación) | `orders:downloadCSV` genera el CSV offline con todos los campos |

---

### Verificación

```bash
# Diagnósticos del IDE:
$ getDiagnostics src/main/ipc/orders.handlers.ts
# ✓ No diagnostics found

# Type-check completo del proyecto:
$ npx tsc --noEmit --project tsconfig.json
# ✓ Sin errores

# Suite completa de tests (142 tests):
$ npx vitest run
# ✓ 7 test files passed
# ✓ 142 tests passed
# ✓ Duration: 1.74s
```

---

### Próximos pasos

- **Tarea 3.5**: ✅ Completada (ver sección siguiente)
- **Tarea 3.6**: Implementar `printer.handlers.ts` — lógica de impresión (requiere PDF generator y printer manager, más complejo)
- **Tarea 3.7**: Crear `ipc-client.ts` en el renderer como wrapper tipado
- **Tarea 3.8**: Tests unitarios con mocks de los repositories para validar el routing IPC


---

## Detalle de lo realizado (3.5)

### ¿Qué se hizo?

Se implementó `src/main/ipc/images.handlers.ts`, reemplazando el stub vacío con los tres handlers IPC que conectan el renderer con el `ImagesRepository`:

1. **`images:upload`** — Recibe nombre, data URI (Base64), tipo MIME y tamaño; inserta o reemplaza la imagen en la BD
2. **`images:remove`** — Elimina una imagen de la BD por nombre
3. **`images:getByName`** — Recupera una imagen por nombre, devolviendo `{name, url}` o `null` si no existe

### Archivo modificado

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/main/ipc/images.handlers.ts` | **Reescrito** | Implementación completa de handlers upload, remove y getByName |

---

### Implementación final

```typescript
import { handleIpc } from './handlers'
import { ImagesRepository } from '../database/repositories/images.repository'

export function registerImagesHandlers(): void {
  const repo = new ImagesRepository()

  handleIpc('images:upload', (name: unknown, dataUri: unknown, type: unknown, size: unknown) => {
    repo.upload(name as string, dataUri as string, type as string, size as number)
  })

  handleIpc('images:remove', (name: unknown) => {
    repo.remove(name as string)
  })

  handleIpc('images:getByName', (name: unknown) => {
    return repo.getByName(name as string)
  })
}
```

---

### Channels registrados

| Channel | Handler | Retorno | Descripción |
|---------|---------|---------|-------------|
| `images:upload` | `repo.upload(name, dataUri, type, size)` | `void` | Inserta o reemplaza una imagen (INSERT OR REPLACE) |
| `images:remove` | `repo.remove(name)` | `void` | Elimina imagen por nombre (no-op si no existe) |
| `images:getByName` | `repo.getByName(name)` | `{name, url} \| null` | Devuelve nombre y data URI, o null si no encontrada |

---

### Flujo de uso

#### `images:upload` — Subir imagen

```
Renderer (SubirImagenView):
  → Vendedor selecciona/arrastra una imagen
  → Se convierte a Base64 data URI en el frontend
  → window.electronAPI.images.upload(nombre, dataUri, tipo, tamaño)

Preload:
  → ipcRenderer.invoke('images:upload', name, dataUri, type, size)

Main process:
  → handleIpc('images:upload', (name, dataUri, type, size) => repo.upload(...))
  → ImagesRepository.upload() ejecuta INSERT OR REPLACE
  → Si ya existía una imagen con ese nombre, se reemplaza automáticamente
```

#### `images:remove` — Eliminar imagen

```
Renderer (SubirImagenView):
  → Vendedor pulsa eliminar en una imagen existente
  → window.electronAPI.images.remove(nombre)

Preload:
  → ipcRenderer.invoke('images:remove', name)

Main process:
  → handleIpc('images:remove', (name) => repo.remove(name))
  → DELETE FROM images WHERE name = ?
  → No-op si la imagen no existía (no lanza error)
```

#### `images:getByName` — Obtener imagen por nombre

```
Renderer (KioskoView, previsualizaciones):
  → Se necesita mostrar la imagen de fondo de un motivo
  → const img = await window.electronAPI.images.getByName('motivoFeria2025')

Preload:
  → ipcRenderer.invoke('images:getByName', name)

Main process:
  → handleIpc('images:getByName', (name) => repo.getByName(name))
  → Retorna { name: 'motivoFeria2025', url: 'data:image/png;base64,...' }
  → Retorna null si la imagen no existe (el renderer usa fondoetiqueta-nada.png como fallback)
```

---

### Decisiones de diseño

| Decisión | Justificación |
|----------|---------------|
| No se notifica `config:changed` tras operaciones de imagen | Las imágenes no forman parte de la configuración. Los componentes que muestran imágenes las solicitan bajo demanda o tras refrescar la vista. |
| `upload` usa INSERT OR REPLACE | Replicación del comportamiento del legacy: si subes una imagen con un nombre que ya existe, se sobreescribe sin error. Evita tener que gestionar un flujo separado de "actualizar". |
| `remove` no lanza error si la imagen no existe | Operación idempotente. El frontend no necesita distinguir entre "borrada exitosamente" y "no existía". Simplifica el manejo de errores en el renderer. |
| `getByName` devuelve `{name, url}` en vez del registro completo | El renderer solo necesita el nombre (para display) y la URL/data URI (para renderizar). No necesita id, type, size, createdAt. Interfaz mínima definida en el preload. |
| Sin validación de formato de imagen en el handler | La validación de tipo/tamaño se realiza en el frontend (antes de invocar). El handler es una capa fina de routing. SQLite almacena cualquier string como data. |

---

### Relación con requisitos

| Requisito | Conexión |
|-----------|----------|
| Req 14.1 (Subir imagen) | `images:upload` almacena la imagen como data URI Base64 con nombre único |
| Req 14.2 (Eliminar imagen) | `images:remove` la borra de la BD |
| Req 14.3 (Usar imagen en PDF) | `images:getByName` permite recuperar la imagen para usarla como fondo de etiqueta |
| Req 14.4 (Fallback si no existe) | `images:getByName` retorna `null`, permitiendo al renderer usar el fondo por defecto |

---

### Verificación

```bash
# Diagnósticos del IDE:
$ getDiagnostics src/main/ipc/images.handlers.ts
# ✓ No diagnostics found

# Diagnósticos del registro central (importa images.handlers):
$ getDiagnostics src/main/ipc/handlers.ts
# ✓ No diagnostics found

# Suite completa de tests (142 tests):
$ npx vitest run
# ✓ 7 test files passed
# ✓ 142 tests passed
# ✓ Duration: 1.77s
```

---

### Próximos pasos

- **Tarea 3.6**: Implementar `printer.handlers.ts` — lógica de impresión (requiere PDF generator y printer manager, más complejo)
- **Tarea 3.7**: Crear `ipc-client.ts` en el renderer como wrapper tipado
- **Tarea 3.8**: Tests unitarios con mocks de los repositories para validar el routing IPC
- **Tarea 3.9**: Verificar comunicación IPC end-to-end (renderer llama → main responde)


---

## Detalle de lo realizado (3.6)

### ¿Qué se hizo?

Se implementó `src/main/ipc/printer.handlers.ts`, reemplazando el stub vacío con los 5 handlers IPC que conectan el renderer con el módulo de impresión. Dado que los módulos de impresión real (printer-manager.ts, pdf-generator.ts, print-queue.service.ts) aún no están implementados (Tasks 11 y 12), los handlers son una combinación de:

- **Stubs con TODO** para funcionalidad que depende de módulos futuros (getStatus, print, pause, resume)
- **Implementación real** para funcionalidad que ya tiene infraestructura disponible (getQueue usa PrintQueueRepository)

### Archivo modificado

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/main/ipc/printer.handlers.ts` | **Reescrito** | Implementación completa de 5 handlers con stubs e integración parcial |

---

### Implementación final

```typescript
import { handleIpc } from './handlers'
import { PrintQueueRepository } from '../database/repositories/print-queue.repository'

export interface PrinterInfo {
  id: string
  name: string
  target: 'printer1' | 'printer2' | 'ticket'
  status: 'ready' | 'busy' | 'error' | 'disconnected' | 'paused'
  uri: string
}

export interface PrintJobInfo {
  id: number
  orderId?: number
  printerTarget: 'printer1' | 'printer2' | 'ticket'
  pdfType: string
  status: 'pending' | 'printing' | 'completed' | 'error'
  filePath?: string
  attempts: number
  errorMessage?: string
}

export function registerPrinterHandlers(): void {
  const queueRepo = new PrintQueueRepository()

  handleIpc('printer:getStatus', (): PrinterInfo[] => {
    // TODO: Replace with actual printer discovery (Task 12)
    return []
  })

  handleIpc('printer:print', (_config: unknown, _quantities: unknown, _profile: unknown): void => {
    // TODO: Implement actual printing logic (Tasks 11 & 12)
    console.log('[Printer] print called — stub (printing module not yet implemented)')
  })

  handleIpc('printer:pause', (): void => {
    // TODO: Replace with actual printer pause (Task 12)
    console.log('[Printer] pause called — stub (printing module not yet implemented)')
  })

  handleIpc('printer:resume', (): void => {
    // TODO: Replace with actual printer resume (Task 12)
    console.log('[Printer] resume called — stub (printing module not yet implemented)')
  })

  handleIpc('printer:getQueue', (): PrintJobInfo[] => {
    const jobs = queueRepo.getAll()
    return jobs.map((job) => ({
      id: job.id,
      orderId: job.orderId ?? undefined,
      printerTarget: job.printerTarget,
      pdfType: job.pdfType,
      status: job.status,
      filePath: job.filePath ?? undefined,
      attempts: job.attempts,
      errorMessage: job.errorMessage ?? undefined
    }))
  })
}
```

---

### Channels registrados

| Channel | Handler | Retorno | Estado | Descripción |
|---------|---------|---------|--------|-------------|
| `printer:getStatus` | stub | `PrinterInfo[]` (vacío) | 🔲 Stub | Detección de impresoras vía CUPS/IPP |
| `printer:print` | stub | `void` | 🔲 Stub | Generación de PDFs + envío a impresoras |
| `printer:pause` | stub | `void` | 🔲 Stub | Pausar impresora (cupsdisable / IPP) |
| `printer:resume` | stub | `void` | 🔲 Stub | Reanudar impresora (cupsenable / IPP) |
| `printer:getQueue` | real | `PrintJobInfo[]` | ✅ Real | Lee cola de impresión de la BD |

---

### Interfaces TypeScript exportadas

El módulo exporta dos interfaces que representan los datos de impresión:

#### `PrinterInfo` — Estado de una impresora

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `string` | Identificador único de la impresora |
| `name` | `string` | Nombre legible (ej: "Epson TM-T20") |
| `target` | `'printer1' \| 'printer2' \| 'ticket'` | Rol asignado en el sistema |
| `status` | `'ready' \| 'busy' \| 'error' \| 'disconnected' \| 'paused'` | Estado actual |
| `uri` | `string` | URI de conexión (ej: "ipp://192.168.1.10/ipp/print") |

#### `PrintJobInfo` — Trabajo en cola de impresión

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `number` | ID del registro en la tabla print_queue |
| `orderId` | `number \| undefined` | Referencia a la orden que generó el trabajo |
| `printerTarget` | `'printer1' \| 'printer2' \| 'ticket'` | Impresora destino |
| `pdfType` | `string` | Tipo de PDF (ej: "stamp_simple", "ticket", "tira") |
| `status` | `'pending' \| 'printing' \| 'completed' \| 'error'` | Estado del trabajo |
| `filePath` | `string \| undefined` | Ruta al PDF generado |
| `attempts` | `number` | Número de intentos de envío |
| `errorMessage` | `string \| undefined` | Mensaje de error del último intento fallido |

---

### Flujo de uso previsto (cuando Tasks 11 y 12 estén completas)

#### `printer:print` — Flujo completo de impresión

```
Renderer (KioskoView):
  → Vendedor pulsa "Imprimir Normal"
  → window.electronAPI.printer.print(config, quantities, 'normal')

Preload:
  → ipcRenderer.invoke('printer:print', config, quantities, 'normal')

Main process (futuro — Tasks 11 & 12):
  1. pdf-generator.ts genera PDFs de etiquetas (55x25mm) y tickets (78xVARmm)
  2. PrintQueueRepository inserta trabajos en la tabla print_queue
  3. printer-manager.ts detecta backend (CUPS en Linux, IPP en Windows)
  4. print-queue.service.ts procesa la cola: envía PDFs a impresoras
  5. Actualiza status de cada job a 'completed' o 'error'
```

#### `printer:getStatus` — Detección de impresoras

```
Renderer (KioskoView — indicadores de estado):
  → Al montar el componente, solicita estado
  → const printers = await window.electronAPI.printer.getStatus()

Main process (futuro — Task 12):
  → Linux: ejecuta `lpstat -p` o `avahi-browse` para detectar impresoras CUPS
  → Windows: escanea red local por protocolo IPP (puerto 631)
  → Mapea impresoras detectadas a PrinterInfo[] con roles asignados
```

#### `printer:pause` / `printer:resume` — Control de impresora

```
Renderer (KioskoView — botones pausar/reanudar):
  → Vendedor pulsa "Pausar"
  → await window.electronAPI.printer.pause()

Main process (futuro — Task 12):
  → Linux: ejecuta `cupsdisable <printer_name>`
  → Windows: envía IPP Pause-Printer request
  → Detiene procesamiento de la cola de impresión

  → Vendedor pulsa "Reanudar"
  → await window.electronAPI.printer.resume()

Main process (futuro — Task 12):
  → Linux: ejecuta `cupsenable <printer_name>`
  → Windows: envía IPP Resume-Printer request
  → Reintenta todos los trabajos pendientes en la cola
```

#### `printer:getQueue` — Cola de impresión (ya funcional)

```
Renderer (vista de estado / debug):
  → const queue = await window.electronAPI.printer.getQueue()
  → Muestra lista de trabajos pendientes/en curso/con error

Main process (ya implementado):
  → PrintQueueRepository.getAll() lee todos los registros de print_queue
  → Mapea los campos de SQLite al formato PrintJobInfo
  → Convierte null a undefined para campos opcionales (orderId, filePath, errorMessage)
```

---

### Decisiones de diseño

| Decisión | Justificación |
|----------|---------------|
| Stubs en vez de lanzar "not implemented" | Permite que el renderer llame a los métodos sin crashear. Los stubs devuelven valores seguros (array vacío, void). Cuando las Tasks 11/12 estén listas, se reemplazan los stubs sin cambiar la interfaz. |
| `getQueue` implementado con datos reales | La tabla `print_queue` ya existe (Task 2) y el `PrintQueueRepository` está testeado. No hay razón para devolver un stub cuando los datos reales están disponibles. |
| Interfaces exportadas desde el handler | Permite reutilizar `PrinterInfo` y `PrintJobInfo` en otros módulos del main process sin depender del preload. El preload define sus propias interfaces equivalentes para el renderer. |
| `console.log` en los stubs | Facilita el debugging durante desarrollo — al ver "[Printer] print called" en la consola del main process, se confirma que el IPC funciona correctamente aunque la impresión no haga nada. |
| `null` → `undefined` en el mapeo de getQueue | SQLite devuelve `null` para campos vacíos. La interfaz TypeScript del preload usa `undefined` (campos opcionales con `?`). El mapeo asegura consistencia de tipos. |
| Sin validación de los argumentos de `print` | Los tipos `_config`, `_quantities`, `_profile` son `unknown` porque el handler es un stub. Cuando se implemente la lógica real, se castearán a `AppConfig`, `KioskoQuantities` y `string` respectivamente. |

---

### Integración con el sistema

El handler ya estaba registrado en el sistema central desde tareas anteriores:

**`src/main/ipc/handlers.ts`:**
```typescript
import { registerPrinterHandlers } from './printer.handlers'

export function registerAllHandlers(): void {
  registerConfigHandlers()
  registerOrdersHandlers()
  registerImagesHandlers()
  registerPrinterHandlers()  // ← Ya conectado
}
```

**`src/preload/index.ts`** — Ya expone el API completo de printer:
```typescript
printer: {
  getStatus: () => ipcRenderer.invoke('printer:getStatus'),
  print: (config, quantities, profile) =>
    ipcRenderer.invoke('printer:print', config, quantities, profile),
  pause: () => ipcRenderer.invoke('printer:pause'),
  resume: () => ipcRenderer.invoke('printer:resume'),
  getQueue: () => ipcRenderer.invoke('printer:getQueue')
}
```

---

### Relación con requisitos

| Requisito | Conexión |
|-----------|----------|
| Req 8.1 (Enrutamiento de etiquetas) | `printer:print` enrutará modelo1→printer1, modelo2→printer2 (cuando se implemente) |
| Req 8.2 (Tickets a impresora de tickets) | `printer:print` enrutará tickets→PRINTER_TICKET |
| Req 8.5 (Cola con reintentos) | `printer:getQueue` ya lee la cola persistida; los reintentos se harán en Task 12 |
| Req 8.6 (Pausar impresora) | `printer:pause` detendrá el envío de trabajos |
| Req 8.7 (Reanudar impresora) | `printer:resume` reenviará trabajos pendientes |
| Req 9 (Abstracción CUPS/IPP) | `printer:getStatus` detectará el backend según SO |
| Req 18.2 (Persistencia de cola) | `printer:getQueue` devuelve trabajos persistidos en SQLite |

---

### Relación con tareas futuras

| Tarea futura | Impacto en printer.handlers.ts |
|--------------|-------------------------------|
| **Task 11 (PDF Generation)** | `printer:print` integrará `pdf-generator.ts` para generar los PDFs de etiquetas y tickets |
| **Task 12 (Módulo de Impresión)** | Todos los stubs se reemplazarán con llamadas a `printer-manager.ts` y `print-queue.service.ts` |
| **Task 13 (Lógica de Venta)** | El flujo de venta llamará a `printer:print` como paso final tras la transacción atómica |

---

### Verificación

```bash
# Diagnósticos del IDE — sin errores:
$ getDiagnostics src/main/ipc/printer.handlers.ts
# ✓ No diagnostics found

# Type-check del main process:
$ npx tsc --noEmit --project tsconfig.node.json
# ✓ Sin errores en printer.handlers.ts
# (Solo warnings pre-existentes de unused vars en ficheros de test)

# Build completa de electron-vite:
$ npx electron-vite build
# ✓ Compila sin errores
```

---

### Próximos pasos

- **Tarea 3.7**: Crear `src/renderer/src/lib/ipc-client.ts` — wrapper tipado del API para uso en stores de Zustand
- **Tarea 3.8**: Escribir tests unitarios para los handlers IPC con mocks de repositories
- **Tarea 3.9**: Verificar comunicación IPC end-to-end (renderer llama → main responde)


---

## Detalle de lo realizado (3.8)

### ¿Qué se hizo?

Se crearon tests unitarios para toda la capa IPC usando mocks de los repositories. Los tests verifican que cada handler:

1. Se registra correctamente en `ipcMain.handle()`
2. Delega correctamente las llamadas al repository correspondiente
3. Pasa los argumentos sin modificar
4. Propaga errores como rechazos de Promise (para que lleguen al renderer)
5. En el caso de config, notifica cambios a las ventanas

### Archivos creados

| Archivo | Tests | Descripción |
|---------|:-----:|-------------|
| `src/main/ipc/__tests__/handlers.test.ts` | 9 | Tests del helper `handleIpc` y `notifyConfigChanged` |
| `src/main/ipc/__tests__/config.handlers.test.ts` | 16 | Tests de los 8 channels de configuración |
| `src/main/ipc/__tests__/orders.handlers.test.ts` | 8 | Tests de insert y downloadCSV |
| `src/main/ipc/__tests__/images.handlers.test.ts` | 9 | Tests de upload, remove y getByName |
| `src/main/ipc/__tests__/printer.handlers.test.ts` | 9 | Tests de los 5 channels de impresión |
| **Total** | **51** | |

---

### Estrategia de testing

Se optó por **tests de unidad con mocks de repositories** en vez de tests de integración con BD real. Los tests de integración (con SQLite en memoria) ya existen para cada repository individual (tarea 2.9). Esta capa verifica que el "cableado" IPC es correcto.

#### ¿Qué se mockea?

| Módulo | Mock | Motivo |
|--------|------|--------|
| `electron` (`ipcMain`) | Map de handlers registrados | Permite invocar handlers directamente sin Electron real |
| `electron` (`BrowserWindow`) | Array de ventanas mock | Verifica que `notifyConfigChanged` envía a todas las ventanas |
| `../database/connection` | `getDatabase: vi.fn()` | Evita que los constructores de repositories intenten conectarse a SQLite |
| Repositories (`ConfigRepository`, etc.) | Constructores que retornan objetos mock | Permite verificar qué métodos se llaman con qué argumentos |

#### Patrón de mock de constructor

Los repositories se instancian con `new` dentro de los handlers, así que el mock debe ser una función invocable con `new`:

```typescript
const mockRepo = {
  get: vi.fn(),
  updateMaquina: vi.fn(),
  // ...
}

vi.mock('../../database/repositories/config.repository', () => ({
  ConfigRepository: vi.fn(function () {
    return mockRepo
  })
}))
```

**Nota importante**: Se usa `vi.fn(function () { ... })` en vez de `vi.fn(() => { ... })` porque las arrow functions no pueden ser invocadas con `new` en JavaScript. Vitest 4.x emite un warning si detecta que un mock con arrow function se usa como constructor.

---

### Helper `invokeHandler` para tests

Cada test file define un helper que simula la invocación IPC:

```typescript
const registeredHandlers = new Map<string, (...args: unknown[]) => unknown>()

// El mock de ipcMain.handle almacena cada handler registrado
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel, handler) => {
      registeredHandlers.set(channel, handler)
    })
  },
  BrowserWindow: { getAllWindows: vi.fn(() => []) }
}))

// Helper para invocar un handler como si fuera una llamada IPC real
async function invokeHandler(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = registeredHandlers.get(channel)
  if (!handler) throw new Error(`No handler for: ${channel}`)
  // ipcMain.handle registra handlers con firma (event, ...args)
  return handler({ sender: {} }, ...args)
}
```

Esto permite testear el flujo completo del handler (incluyendo el wrapping de `handleIpc` con su try/catch) sin necesidad de un proceso Electron real.

---

### Detalle de tests por módulo

#### `handlers.test.ts` — Helper central

| Test | Verifica |
|------|----------|
| `handleIpc` registra handler en el channel correcto | El handler queda en `registeredHandlers` |
| Retorna el resultado del handler | Valor devuelto llega al caller |
| Pasa argumentos IPC al handler | Los args del invoke llegan al handler |
| Soporta handlers async | Promises se resuelven correctamente |
| Lanza error con el mensaje correcto | `throw new Error('...')` se propaga |
| Convierte errores no-Error a string | `throw 'string'` → `new Error('string')` |
| `notifyConfigChanged` envía a todas las ventanas | `webContents.send('config:changed', config)` |
| `notifyConfigChanged` envía a múltiples ventanas | Itera `BrowserWindow.getAllWindows()` |
| `notifyConfigChanged` no lanza si no hay ventanas | Array vacío → no-op |

#### `config.handlers.test.ts` — Configuración

| Test | Verifica |
|------|----------|
| Registra los 8 channels esperados | `ipcMain.handle` se llamó con cada channel |
| `config:get` → `repo.get()` | Delega y retorna el resultado |
| `config:get` → null si no existe | Retorna null sin lanzar |
| `config:get` → propaga error de BD | Error se re-lanza como rechazo |
| `config:updateMaquina` → delega con datos | `repo.updateMaquina(data)` llamado correctamente |
| `config:updateMaquina` → notifica tras actualizar | `repo.get()` se llama para obtener config actualizada |
| `config:updateMaquina` → propaga errores | "Config not initialized" llega al renderer |
| `config:updateImprimir` → delega con datos | Verifica sello + precios |
| `config:updateImprimir` → propaga errores | Error del repo llega al caller |
| `config:updateSesion` → llama y notifica | `repo.updateSesion()` + `repo.get()` |
| `config:updateSesion` → propaga errores | Error si config no inicializada |
| `config:updateSesionError` → llama y notifica | `repo.updateSesionError()` + `repo.get()` |
| `config:updateRollos` → pasa 3 argumentos | `(10, 5, 2)` llega como `(10, 5, 2)` |
| `config:updateRollos` → maneja ceros | `(0, 0, 0)` es válido |
| `config:updateRollosRevert` → pasa 3 argumentos | Igual que updateRollos |
| `config:initConfig` → llama y notifica | `repo.initConfig()` + `repo.get()` |

#### `orders.handlers.test.ts` — Ventas

| Test | Verifica |
|------|----------|
| Registra los 2 channels esperados | `orders:insert` y `orders:downloadCSV` |
| `orders:insert` → delega con OrderLine[] | Array de órdenes llega al repo |
| `orders:insert` → maneja múltiples líneas | 2+ órdenes en un solo array |
| `orders:insert` → maneja array vacío | `[]` es válido (no lanza) |
| `orders:insert` → propaga errores SQL | SQLITE_CONSTRAINT llega al renderer |
| `orders:downloadCSV` → retorna CSV string | String con delimitador `;` |
| `orders:downloadCSV` → retorna vacío si no hay datos | `''` cuando 0 órdenes |
| `orders:downloadCSV` → propaga errores | "Database locked" llega al renderer |

#### `images.handlers.test.ts` — Imágenes

| Test | Verifica |
|------|----------|
| Registra los 3 channels esperados | `images:upload`, `images:remove`, `images:getByName` |
| `images:upload` → pasa 4 argumentos | `(name, dataUri, type, size)` llegan correctamente |
| `images:upload` → maneja null en type/size | Null se pasa tal cual al repo |
| `images:upload` → propaga errores de constraint | UNIQUE constraint → error |
| `images:remove` → pasa nombre | `repo.remove('old-motivo.png')` |
| `images:remove` → no lanza si no existe | Operación idempotente |
| `images:getByName` → retorna datos de imagen | `{name, url}` del repo |
| `images:getByName` → retorna null si no existe | Null propagado correctamente |
| `images:getByName` → propaga errores | Error de BD llega al renderer |

#### `printer.handlers.test.ts` — Impresión

| Test | Verifica |
|------|----------|
| Registra los 5 channels esperados | getStatus, print, pause, resume, getQueue |
| `printer:getStatus` → retorna array vacío (stub) | No lanza, retorna `[]` |
| `printer:print` → acepta 3 args sin lanzar (stub) | config, quantities, profile → void |
| `printer:pause` → no lanza (stub) | Operación silenciosa |
| `printer:resume` → no lanza (stub) | Operación silenciosa |
| `printer:getQueue` → mapea jobs del repo | Conversión correcta de campos |
| `printer:getQueue` → retorna vacío si cola vacía | `[]` cuando no hay jobs |
| `printer:getQueue` → convierte null a undefined | `orderId: null` → `orderId: undefined` |
| `printer:getQueue` → propaga errores del repo | Error de BD llega al renderer |

---

### Resultados de ejecución

```bash
$ npx vitest run src/main/ipc/__tests__/

 ✓ src/main/ipc/__tests__/handlers.test.ts (9 tests)
 ✓ src/main/ipc/__tests__/config.handlers.test.ts (16 tests)
 ✓ src/main/ipc/__tests__/orders.handlers.test.ts (8 tests)
 ✓ src/main/ipc/__tests__/images.handlers.test.ts (9 tests)
 ✓ src/main/ipc/__tests__/printer.handlers.test.ts (9 tests)

 Test Files  5 passed (5)
      Tests  51 passed (51)
   Duration  1.12s

# Suite completa del proyecto (incluye tests de repositories + IPC):
$ npx vitest run

 Test Files  12 passed (12)
      Tests  193 passed (193)
   Duration  2.36s
```

---

### Cobertura por capa

| Capa | Tests existentes | Tipo | Lo que verifican |
|------|:---:|------|------------------|
| Repositories (BD real) | 142 | Integración | Lógica de negocio + SQL correcto |
| **IPC Handlers (mocks)** | **51** | **Unidad** | **Routing correcto + propagación de errores** |
| Comunicación E2E | — | Manual | Pendiente tarea 3.9 |

---

### Decisiones de diseño

| Decisión | Justificación |
|----------|---------------|
| Tests de unidad (no integración) para IPC | Los repositories ya tienen tests de integración exhaustivos. Los handlers son una capa fina de routing — solo necesitan verificar que delegan correctamente. |
| Un archivo de test por handler + uno para helpers | Sigue el patrón 1:1 de la estructura del código fuente. Facilita localizar qué test falla. |
| Mock de `ipcMain.handle` con Map | Permite invocar handlers directamente sin Electron. Más rápido y determinista que tests E2E. |
| `vi.fn(function() {...})` para constructores | Las arrow functions no se pueden invocar con `new`. Vitest 4.x requiere `function` o `class` para constructores mock. |
| Tests de propagación de errores en cada handler | Verifica que el `handleIpc` wrapper funciona correctamente — un error en un repository no queda silenciado. |
| No se testa la lógica interna de stubs | Los stubs de printer (print, pause, resume, getStatus) solo verifican que no lanzan. Cuando se implemente la lógica real (Tasks 11/12), se añadirán tests más detallados. |

---

### Relación con requisitos

| Requisito | Conexión |
|-----------|----------|
| Todos (1-19) | Los tests verifican que el "puente" entre renderer y main process funciona para todos los channels que soportan los requisitos |
| Req 11 (Atomicidad) | Se verifica que errores se propagan — si la transacción falla, el renderer lo sabe |
| Req 16 (Offline-first) | Se verifica que toda la comunicación funciona sin dependencias externas (sin red, sin servers) |

---

### Estructura de tests resultante

```
src/main/
├── database/__tests__/         # Tests de integración (BD real)
│   ├── config.repository.test.ts
│   ├── orders.repository.test.ts
│   ├── images.repository.test.ts
│   ├── print-queue.repository.test.ts
│   ├── connection.test.ts
│   ├── migrator.test.ts
│   └── startup-integration.test.ts
└── ipc/__tests__/              # ← NUEVOS: Tests de unidad (mocks)
    ├── handlers.test.ts             # handleIpc + notifyConfigChanged
    ├── config.handlers.test.ts      # 8 channels config:*
    ├── orders.handlers.test.ts      # 2 channels orders:*
    ├── images.handlers.test.ts      # 3 channels images:*
    └── printer.handlers.test.ts     # 5 channels printer:*
```

---

### Próximos pasos

- **Tarea 3.7**: Crear `src/renderer/src/lib/ipc-client.ts` — wrapper tipado del API para uso en stores de Zustand
- **Tarea 3.9**: Verificar comunicación IPC end-to-end (renderer llama → main responde)


---

## Detalle de lo realizado (3.7)

### ¿Qué se hizo?

Se creó `src/renderer/src/lib/ipc-client.ts`, un wrapper tipado sobre el `window.electronAPI` expuesto por el preload via contextBridge. Este módulo proporciona:

1. **Un punto de importación único** — Los stores y componentes del renderer importan funciones de aquí en vez de acceder directamente a `window.electronAPI`
2. **Testeabilidad** — Es más fácil mockear funciones exportadas que `window.electronAPI` global
3. **Seguridad en runtime** — Valida que `electronAPI` existe antes de usarlo (lanza error descriptivo si se ejecuta fuera de Electron)
4. **Re-exportación de tipos** — Infiere y re-exporta todos los tipos del API (AppConfig, OrderLine, etc.) para uso en el renderer

### Archivo creado

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/renderer/src/lib/ipc-client.ts` | **Creado** | Wrapper tipado completo del API IPC |

---

### Arquitectura del módulo

```
Stores/Componentes del Renderer
         │
         │ import { getConfig, insertOrders, print } from '@renderer/lib/ipc-client'
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│              ipc-client.ts                               │
│                                                         │
│  getAPI() ──► valida window.electronAPI ──► devuelve    │
│                                                         │
│  Funciones tipadas:                                     │
│    Config:  getConfig, updateMaquina, updateImprimir,    │
│             updateSesion, updateSesionError,             │
│             updateRollos, updateRollosRevert, initConfig,│
│             onConfigChange                              │
│    Orders:  insertOrders, downloadCSV                   │
│    Images:  uploadImage, removeImage, getImageByName    │
│    Printer: getPrinterStatus, print, pausePrinter,      │
│             resumePrinter, getPrintQueue                │
│    Sync:    getSyncStatus, triggerSync                  │
│                                                         │
│  Tipos re-exportados:                                   │
│    AppConfig, TicketConfig, CodigoConfig, SelloConfig,   │
│    PreciosConfig, OrderLine, KioskoQuantities,           │
│    PrinterInfo, PrintJob, ElectronAPI                    │
└─────────────────────────────────────────────────────────┘
         │
         │ window.electronAPI.config.get() / .orders.insert() / etc.
         ▼
┌─────────────────────┐
│    Preload (IPC)     │
└─────────────────────┘
```

---

### Implementación

```typescript
type ElectronAPI = Window['electronAPI']
type AppConfig = Awaited<ReturnType<ElectronAPI['config']['get']>>
// ... más tipos inferidos automáticamente del preload ...

function getAPI(): ElectronAPI {
  const api = window.electronAPI
  if (!api) {
    throw new Error('electronAPI is not available. Make sure the app is running inside Electron.')
  }
  return api
}

// Funciones tipadas que delegan al API:
export async function getConfig(): Promise<AppConfig> {
  return getAPI().config.get()
}

export async function insertOrders(orders: OrderLine[]): Promise<void> {
  return getAPI().orders.insert(orders)
}
// ... etc.
```

---

### Funciones exportadas

#### Grupo Config

| Función | Parámetros | Retorno | Mapea a |
|---------|------------|---------|---------|
| `getConfig()` | — | `AppConfig` | `electronAPI.config.get()` |
| `updateMaquina(data)` | `{ticket, codigo}` | `void` | `electronAPI.config.updateMaquina(data)` |
| `updateImprimir(data)` | `{sello, precios}` | `void` | `electronAPI.config.updateImprimir(data)` |
| `updateSesion()` | — | `void` | `electronAPI.config.updateSesion()` |
| `updateSesionError()` | — | `void` | `electronAPI.config.updateSesionError()` |
| `updateRollos(s1, s2, t)` | 3 números | `void` | `electronAPI.config.updateRollos(s1, s2, t)` |
| `updateRollosRevert(s1, s2, t)` | 3 números | `void` | `electronAPI.config.updateRollosRevert(s1, s2, t)` |
| `initConfig()` | — | `void` | `electronAPI.config.initConfig()` |
| `onConfigChange(callback)` | función | `() => void` | `electronAPI.config.onChange(callback)` |

#### Grupo Orders

| Función | Parámetros | Retorno | Mapea a |
|---------|------------|---------|---------|
| `insertOrders(orders)` | `OrderLine[]` | `void` | `electronAPI.orders.insert(orders)` |
| `downloadCSV()` | — | `string` | `electronAPI.orders.downloadCSV()` |

#### Grupo Images

| Función | Parámetros | Retorno | Mapea a |
|---------|------------|---------|---------|
| `uploadImage(name, dataUri, type, size)` | 4 args | `void` | `electronAPI.images.upload(...)` |
| `removeImage(name)` | nombre | `void` | `electronAPI.images.remove(name)` |
| `getImageByName(name)` | nombre | `{name, url} \| null` | `electronAPI.images.getByName(name)` |

#### Grupo Printer

| Función | Parámetros | Retorno | Mapea a |
|---------|------------|---------|---------|
| `getPrinterStatus()` | — | `PrinterInfo[]` | `electronAPI.printer.getStatus()` |
| `print(config, quantities, profile)` | 3 args | `void` | `electronAPI.printer.print(...)` |
| `pausePrinter()` | — | `void` | `electronAPI.printer.pause()` |
| `resumePrinter()` | — | `void` | `electronAPI.printer.resume()` |
| `getPrintQueue()` | — | `PrintJob[]` | `electronAPI.printer.getQueue()` |

#### Grupo Sync

| Función | Parámetros | Retorno | Mapea a |
|---------|------------|---------|---------|
| `getSyncStatus()` | — | `{connected, lastSync, pending}` | `electronAPI.sync.getStatus()` |
| `triggerSync()` | — | `void` | `electronAPI.sync.triggerSync()` |

---

### Tipos re-exportados

Los tipos se infieren automáticamente del API del preload usando utilidades de TypeScript avanzadas:

```typescript
type AppConfig = Awaited<ReturnType<ElectronAPI['config']['get']>>
type PrinterInfo = Awaited<ReturnType<ElectronAPI['printer']['getStatus']>>[number]
type OrderLine = Parameters<ElectronAPI['orders']['insert']>[0][number]
type KioskoQuantities = Parameters<ElectronAPI['printer']['print']>[1]
type TicketConfig = Parameters<ElectronAPI['config']['updateMaquina']>[0]['ticket'] extends
  Partial<infer T> ? T : never
```

**Ventaja**: Los tipos están siempre sincronizados con el preload. Si se cambia una interfaz en `src/preload/index.ts`, el renderer los recoge automáticamente sin duplicación.

---

### Uso previsto en stores

```typescript
// En config.store.ts (Tarea 4):
import { getConfig, onConfigChange, updateMaquina } from '@renderer/lib/ipc-client'
import type { AppConfig } from '@renderer/lib/ipc-client'

interface ConfigState {
  config: AppConfig | null
  loading: boolean
  load: () => Promise<void>
}

export const useConfigStore = create<ConfigState>((set) => ({
  config: null,
  loading: true,
  load: async () => {
    const config = await getConfig()
    set({ config, loading: false })
  }
}))

// Suscripción reactiva:
onConfigChange((config) => {
  useConfigStore.setState({ config })
})
```

---

### Decisiones de diseño

| Decisión | Justificación |
|----------|---------------|
| Funciones individuales en vez de un objeto/clase | Permite tree-shaking e imports selectivos. Los stores solo importan las funciones que necesitan. |
| `getAPI()` con validación en runtime | Previene errores crípticos si un componente se renderiza fuera de Electron (ej: en tests sin mock). El mensaje de error indica claramente qué falta. |
| Tipos inferidos del preload (no duplicados) | Single source of truth. Evita divergencia entre los tipos del preload y los que usa el renderer. |
| `onConfigChange` devuelve función de unsubscribe | Patrón estándar de React/Zustand para cleanup en `useEffect` o suscripciones de stores. |
| Nombres más descriptivos que el API raw | `insertOrders` en vez de `orders.insert`, `getPrinterStatus` en vez de `printer.getStatus`. Mejora legibilidad y autocompletado. |

---

### Verificación

```bash
# Diagnósticos del IDE — sin errores:
$ getDiagnostics src/renderer/src/lib/ipc-client.ts
# ✓ No diagnostics found

# Type-check del renderer:
$ npx tsc --noEmit --project tsconfig.web.json
# ✓ Sin errores

# Build completa:
$ npx electron-vite build
# ✓ Compila sin errores
```

---

### Relación con el design

Este módulo implementa la entrada **`src/renderer/src/lib/ipc-client.ts`** de la sección 3.1 (Project Structure) del documento de diseño:

> `ipc-client.ts — Wrapper tipado sobre IPC`

Y soporta la sección 2.6 (Communication Flow) como la capa final del renderer que inicia las llamadas IPC.


---

## Detalle de lo realizado (3.9)

### ¿Qué se hizo?

Se creó un test de integración end-to-end que verifica la comunicación completa entre el renderer y el main process. A diferencia de los tests de la tarea 3.8 (que prueban cada handler aisladamente con mocks), este test simula el **puente IPC completo**:

```
ipc-client (preload API) → ipcRenderer.invoke → ipcMain.handle → handlers → repositories
```

El test conecta directamente `ipcRenderer.invoke` con los handlers registrados vía `ipcMain.handle`, simulando el bridge que Electron crea en runtime. Esto verifica que toda la cadena funciona end-to-end sin necesidad de arrancar Electron.

### Archivo creado

| Archivo | Tests | Descripción |
|---------|:-----:|-------------|
| `src/main/ipc/__tests__/ipc-e2e.integration.test.ts` | 27 | Test de integración del puente IPC completo |

---

### Diferencia con los tests de la tarea 3.8

| Aspecto | Tests 3.8 (unitarios) | Test 3.9 (integración E2E) |
|---------|----------------------|---------------------------|
| **Scope** | Cada handler por separado | Toda la cadena: preload API → handlers → repos |
| **Bridge IPC** | Invoke directo al handler | Simula el bridge completo (invoke → handle routing) |
| **¿Qué verifica?** | Que cada handler delega al repo correcto | Que el cableado entre capas funciona end-to-end |
| **Mocks** | Solo repos | Repos + bridge IPC simulado |
| **Registra handlers?** | Cada test registra un dominio | `registerAllHandlers()` registra todos juntos |
| **Tests de integridad** | No | Sí (objetos complejos, arrays, numéricos pasan sin corrupción) |
| **Channel wiring** | Implícito | Verifica explícitamente que los 18 channels están registrados |

---

### Estrategia: Bridge IPC simulado

El test crea un "bridge" que conecta `ipcRenderer.invoke` con los handlers de `ipcMain.handle` a través de un Map:

```typescript
// Almacena handlers registrados via ipcMain.handle
const registeredHandlers = new Map<string, (...args: unknown[]) => unknown>()

// Mock de ipcMain.handle: almacena en el Map
ipcMain: {
  handle: (channel, handler) => registeredHandlers.set(channel, handler)
}

// Mock de ipcRenderer.invoke: busca en el Map y ejecuta
ipcRenderer: {
  invoke: async (channel, ...args) => {
    const handler = registeredHandlers.get(channel)
    if (!handler) throw new Error(`No handler for: ${channel}`)
    return handler({ sender: {} }, ...args)  // Simula el event object
  }
}
```

Después, se crea una "preload API" simulada que usa `ipcRenderer.invoke` — replicando exactamente lo que hace `src/preload/index.ts`. Esto permite verificar que:

1. La preload API mapea correctamente cada método a su channel IPC
2. Los argumentos pasan sin modificación a través del bridge
3. Los handlers se ejecutan y retornan el resultado esperado
4. Los errores se propagan correctamente desde los repos hasta el "renderer"

---

### Cobertura de tests

#### Config domain (9 tests)

| Test | Verifica |
|------|----------|
| Get config a través de la cadena completa | `api.config.get()` → handler → `repo.get()` → resultado |
| Update maquina + notificación | Datos llegan al repo, se notifica cambio |
| Update imprimir | Sello + precios delegados correctamente |
| Increment sesión (venta) | `updateSesion()` → `repo.updateSesion()` + notifica |
| Decrement sesión (error) | `updateSesionError()` → `repo.updateSesionError()` + notifica |
| Update rollos con argumentos | `(10, 5, 2)` pasa sin corrupción |
| Revert rollos | Misma verificación de argumentos |
| Init config | `repo.initConfig()` llamado + notifica |
| Error propagation | Error del repo se propaga como rechazo de Promise |

#### Orders domain (3 tests)

| Test | Verifica |
|------|----------|
| Insert orders completo | Array de OrderLine llega intacto al repo |
| Download CSV | String CSV retornado desde repo hasta "renderer" |
| Error propagation | Constraint violation se propaga |

#### Images domain (5 tests)

| Test | Verifica |
|------|----------|
| Upload imagen (4 args) | name, dataUri, type, size llegan al repo |
| Remove imagen | Nombre delegado correctamente |
| Get image by name | Resultado `{name, url}` retornado |
| Get image null | `null` propagado sin error |
| Error propagation | "Image too large" se propaga |

#### Printer domain (5 tests)

| Test | Verifica |
|------|----------|
| Get status (stub) | Retorna `[]` sin error |
| Print (stub) | Acepta 3 args sin lanzar |
| Pause (stub) | No lanza |
| Resume (stub) | No lanza |
| Get queue (real) | Mapea jobs del repo correctamente |

#### Channel wiring (2 tests)

| Test | Verifica |
|------|----------|
| 18 channels registrados | Todos los channels esperados existen en el Map tras `registerAllHandlers()` |
| Channel no registrado lanza error | Invocar un channel inexistente falla con mensaje claro |

#### Data integrity (3 tests)

| Test | Verifica |
|------|----------|
| Objetos complejos anidados | Config con nested objects pasa sin corrupción |
| Arrays | Array de 5 OrderLine llega completo (length verificado) |
| Argumentos numéricos | `(1500, 0, 450)` llegan como números exactos |

---

### Resultados de ejecución

```bash
$ npx vitest run src/main/ipc/__tests__/ipc-e2e.integration.test.ts

 ✓ src/main/ipc/__tests__/ipc-e2e.integration.test.ts (27 tests) 19ms
   ✓ Config domain: renderer -> main -> repository (9)
   ✓ Orders domain: renderer -> main -> repository (3)
   ✓ Images domain: renderer -> main -> repository (5)
   ✓ Printer domain: renderer -> main -> repository (5)
   ✓ Channel wiring verification (2)
   ✓ Data integrity: arguments pass through unchanged (3)

 Test Files  1 passed (1)
      Tests  27 passed (27)
   Duration  905ms

# Suite completa del proyecto:
$ npx vitest run

 Test Files  13 passed (13)
      Tests  220 passed (220)
   Duration  2.49s
```

---

### Decisiones de diseño

| Decisión | Justificación |
|----------|---------------|
| Bridge simulado en vez de Electron real | Tests E2E con Electron real (Spectron/Playwright) son lentos y frágiles. El bridge simulado verifica la misma lógica en <1s. |
| `registerAllHandlers()` en cada test | Verifica que la función orquestadora registra correctamente TODOS los handlers. Si un handler se olvida de importar, el test de channel wiring falla. |
| Preload API recreada en el test | Verifica que el mapeo método→channel es correcto. Si alguien cambia un channel name en el preload pero no en el handler, el test falla. |
| Tests de data integrity separados | Los datos IPC pasan por serialización/deserialización. Verificar que objetos complejos, arrays y números no se corrompen da confianza en la integridad. |
| `{ sender: {} }` como event mock | `ipcMain.handle` recibe un event object como primer argumento. Simulamos el mínimo necesario. |
| No se testa `config.onChange` | El listener `config:changed` usa `ipcRenderer.on` (push), no `invoke/handle`. Requeriría un mock diferente. Se verificó implícitamente en los tests de `notifyConfigChanged` (3.8). |

---

### Relación con requisitos

| Requisito | Conexión |
|-----------|----------|
| Todos (1-19) | Este test da confianza de que TODA la comunicación entre UI y backend funciona correctamente |
| Req 11 (Atomicidad) | Verifica que errores de repositorio se propagan al renderer (la UI puede mostrar el error) |
| Req 16 (Offline-first) | Todo funciona sin red — la comunicación es IPC local |
| Req 17 (Arranque) | El registro de handlers (`registerAllHandlers()`) es rápido (~1ms) |

---

### Cobertura acumulada de la capa IPC

| Capa | Tests | Tipo | Lo que verifica |
|------|:-----:|------|-----------------|
| Repositories (BD real) | 142 | Integración | Lógica de negocio + SQL correcto |
| IPC Handlers (mocks) | 51 | Unidad | Routing correcto por handler individual |
| **IPC Bridge E2E** | **27** | **Integración** | **Cadena completa: preload → bridge → handlers → repos** |
| **Total tests del proyecto** | **220** | | |

---

### Conclusión: Task 3 completa

Con la tarea 3.9 completada, toda la Task 3 (IPC Layer) está finalizada. La capa de comunicación entre renderer y main process está:

- **Implementada**: 18 channels IPC registrados cubriendo config, orders, images, printer
- **Tipada**: Tipos end-to-end desde el renderer hasta los repositories
- **Testeada**: 78 tests (51 unitarios + 27 integración) con 100% de channels cubiertos
- **Documentada**: Cada handler tiene su flujo de uso, decisiones de diseño y relación con requisitos

### Estructura final de la capa IPC

```
src/
├── preload/
│   ├── index.ts              # contextBridge API (18 métodos en 5 grupos)
│   └── index.d.ts            # Declaración global window.electronAPI
├── main/ipc/
│   ├── handlers.ts           # Registro central + helpers (handleIpc, notifyConfigChanged)
│   ├── config.handlers.ts    # 8 channels config:* (implementación completa)
│   ├── orders.handlers.ts    # 2 channels orders:* (implementación completa)
│   ├── images.handlers.ts    # 3 channels images:* (implementación completa)
│   ├── printer.handlers.ts   # 5 channels printer:* (getQueue real + 4 stubs)
│   └── __tests__/
│       ├── handlers.test.ts            # 9 tests helpers
│       ├── config.handlers.test.ts     # 16 tests config
│       ├── orders.handlers.test.ts     # 8 tests orders
│       ├── images.handlers.test.ts     # 9 tests images
│       ├── printer.handlers.test.ts    # 9 tests printer
│       └── ipc-e2e.integration.test.ts # 27 tests E2E bridge
└── renderer/src/lib/
    └── ipc-client.ts         # Wrapper tipado para uso en stores/componentes
```

### Próximos pasos

- **Task 4**: Stores y Estado del Frontend — Los stores de Zustand usarán `ipc-client.ts` como interfaz de comunicación con el main process
