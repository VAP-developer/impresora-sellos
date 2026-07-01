# Task 13: Lógica de Venta Completa (Integración)

## Resumen

Esta tarea implementa el flujo completo de venta como una transacción atómica en el main process de Electron. Integra la generación de PDFs, el envío a impresoras y la anulación de ventas. La atomicidad garantiza que si cualquier paso falla, no queden inconsistencias en la base de datos.

---

## Progreso

| # | Subtarea | Estado |
|---|----------|--------|
| 13.1 | Implementar flujo completo de venta en main process: transacción atómica (sesión + rollos + órdenes) | ✅ Completada |
| 13.2 | Integrar generación de PDFs en el flujo de venta | ✅ Completada |
| 13.3 | Integrar envío a impresoras en el flujo de venta | ✅ Completada |
| 13.4 | Implementar anulación de venta (revert sesión + rollos + registro auditoría) | ⬜ Pendiente |
| 13.5 | Escribir property-based tests para atomicidad (Property 10) | ⬜ Pendiente |
| 13.6 | Escribir property-based tests para round-trip venta/anulación (Property 4) | ⬜ Pendiente |
| 13.7 | Escribir property-based tests para decremento de rollos (Property 5) | ⬜ Pendiente |
| 13.8 | Verificar flujo completo end-to-end: click en Kiosko → PDFs generados → enviados a impresora | ⬜ Pendiente |

---

## Detalle de lo realizado (13.1)

### ¿Qué se hizo?

Se implementó el servicio de venta atómica que ejecuta en una sola transacción SQLite los tres pasos críticos de una venta:

1. **Incremento de sesión** — `config.codigo.cliente` se incrementa en 1
2. **Decremento de rollos** — `rollo1`, `rollo2` y `tickets` se decrementan según las cantidades vendidas
3. **Inserción de órdenes** — Se generan e insertan los registros `OrderLine` en la tabla `orders`

Todo está envuelto en `database.transaction()` de better-sqlite3 (síncrono), garantizando rollback automático si cualquier paso lanza excepción.

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `src/main/sales/sale.service.ts` | Servicio principal de venta atómica |
| `src/main/ipc/sale.handlers.ts` | Handler IPC que expone el canal `sale:execute` al renderer |
| `src/main/sales/__tests__/sale.service.test.ts` | 31 tests unitarios para el servicio |

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/main/ipc/handlers.ts` | Añadido import y registro de `registerSaleHandlers()` |
| `src/preload/index.ts` | Añadidos tipos `SaleOutcome` y método `sale.execute()` en `ElectronAPI` |

---

## Arquitectura del servicio de venta

### Funciones exportadas (`sale.service.ts`)

| Función | Propósito |
|---------|-----------|
| `calcSellos1(q)` | Calcula sellos consumidos del rollo 1 (modelo izquierdo). Simples = 1, tiras = 4 |
| `calcSellos2(q)` | Calcula sellos consumidos del rollo 2 (modelo derecho). Simples = 1, tiras = 4 |
| `calcTicketsUsed(q)` | Calcula tickets consumidos: total de tiras + 2 (ticket principal + copia) |
| `generateOrderLines(config, q, profile, sesionId)` | Genera un `OrderLine` por cada combinación tarifa/modelo con cantidad > 0 |
| `executeSale(config, q, profile, db?)` | Ejecuta la transacción atómica completa. Devuelve `SaleOutcome` |

### Tipos principales

```typescript
interface KioskoQuantities {
  tarifaAS1: number;  tarifaA2S1: number;  tarifaBS1: number;  tarifaCS1: number
  tarifaAT1: number;  tarifa4T1: number
  tarifaAS2: number;  tarifaA2S2: number;  tarifaBS2: number;  tarifaCS2: number
  tarifaAT2: number;  tarifa4T2: number
}

type SaleOutcome = SaleResult | SaleError

interface SaleResult {
  success: true
  sesionId: number   // nuevo ID de cliente tras incremento
  sellos1: number    // sellos consumidos del rollo 1
  sellos2: number    // sellos consumidos del rollo 2
  tickets: number    // tickets consumidos
  orders: OrderLine[]
}

interface SaleError {
  success: false
  error: string
}
```

### Flujo de ejecución

```
Renderer (KioskoView)
  │
  ▼ sale:execute(config, quantities, profile)
  │
  ├─ Pre-validación (antes de transacción):
  │   • Cesta no vacía (sellos1 + sellos2 > 0)
  │   • Stock rollo1 suficiente (si rollo1 ≥ 0)
  │   • Stock rollo2 suficiente (si rollo2 ≥ 0)
  │   • Tickets suficientes
  │   • cliente ≤ 9999
  │
  ├─ Transacción SQLite (atómica):
  │   1. Lee config actual de BD (consistencia)
  │   2. Incrementa codigo.cliente
  │   3. Decrementa ticket.rollo1, ticket.rollo2, ticket.tickets
  │   4. Persiste config actualizada
  │   5. Genera OrderLines
  │   6. Inserta OrderLines en tabla orders
  │
  ├─ Si éxito → notifica config:changed al renderer
  └─ Si error → rollback automático, devuelve SaleError
```

### Reglas de negocio implementadas

| Regla | Implementación |
|-------|----------------|
| Rollo1 se decrementa por sellos del modelo 1 | `sellos1 = simples_mod1 + (tiras_mod1 × 4)` |
| Rollo2 se decrementa por sellos del modelo 2 | `sellos2 = simples_mod2 + (tiras_mod2 × 4)` |
| Tickets se decrementan por tiras + 2 | `tickets = total_tiras + 2` |
| Rollo con valor -1 no se valida (no instalado) | Solo valida si `rollo >= 0` |
| Sesión se incrementa exactamente en 1 | `codigo.cliente + 1` |
| Venta vacía se rechaza | Error si `sellos1 === 0 && sellos2 === 0` |
| Cliente > 9999 bloquea ventas | Error antes de ejecutar transacción |

---

## Tests (31 tests, todos pasan)

### Categorías de tests

| Grupo | Tests | Cobertura |
|-------|-------|-----------|
| `calcSellos1()` | 5 | Vacío, simples, tiras, mixto, no cuenta modelo2 |
| `calcSellos2()` | 4 | Vacío, simples, tiras, no cuenta modelo1 |
| `calcTicketsUsed()` | 2 | Sin tiras (solo +2), con tiras de ambos modelos |
| `generateOrderLines()` | 5 | Una línea por tarifa/modelo, skip si qty=0, quantitySet=4 para tiras, valores correctos, datos evento |
| `executeSale()` | 15 | Cesta vacía, incremento sesión, decremento rollos (simples y tiras), tickets, inserción orders, stock insuficiente (rollo1/2/tickets), cliente>9999, atomicidad, mixto, ventas consecutivas, resultado con datos consumo, rollo -1 |

### Cómo ejecutar

```bash
npx vitest run src/main/sales/__tests__/sale.service.test.ts
```

---

## Canal IPC

| Canal | Dirección | Parámetros | Respuesta |
|-------|-----------|------------|-----------|
| `sale:execute` | Renderer → Main | `(config: AppConfig, quantities: KioskoQuantities, profile: string)` | `SaleOutcome` |

### Uso desde el renderer

```typescript
const result = await window.electronAPI.sale.execute(config, quantities, profile)
if (result.success) {
  // Venta exitosa: result.sesionId, result.sellos1, result.sellos2, result.tickets
} else {
  // Error: result.error (string con mensaje descriptivo)
}
```

---

## Requisitos validados

| Requisito | Criterio | Estado |
|-----------|----------|--------|
| Req 11.1 | Transacción atómica: sesión + rollos + órdenes | ✅ |
| Req 11.2 | Rollback si cualquier paso falla | ✅ |
| Req 11.3 | No genera PDFs si la transacción de datos no se completó | ✅ (por diseño: PDFs se generan después) |
| Req 3.2 | Incremento de cliente en 1 tras venta | ✅ |
| Req 4.1 | Decremento rollo1 por sellos modelo1 (simples + 4×tiras) | ✅ |
| Req 4.2 | Decremento rollo2 por sellos modelo2 (simples + 4×tiras) | ✅ |
| Req 4.3 | Decremento tickets por tiras + 2 | ✅ |
| Req 4.5 | Rechazo si stock insuficiente | ✅ |
| Req 4.6 | Rollo -1 indica no instalado | ✅ |

---

## Detalle de lo realizado (13.2)

### ¿Qué se hizo?

Se integró la generación de PDFs en el flujo de venta, de forma que **después** de que la transacción atómica SQLite se completa con éxito, se generan todos los PDFs de etiquetas y tickets necesarios. Si la transacción falla, no se genera ningún PDF (Requisito 11.3).

La integración sigue un patrón de "cache en proceso": los PDFs generados (buffers) se almacenan en memoria en el main process, listos para ser consumidos por la cola de impresión (tarea 13.3).

### Decisiones de diseño

| Decisión | Justificación |
|----------|---------------|
| PDFs se generan **después** de la transacción, no dentro | Requisito 11.3: si la transacción falla, no se generan PDFs. Además, `generateSalePdfs` es async y la transacción SQLite es síncrona |
| Si la generación de PDFs falla, la venta se mantiene committed | La transacción de datos ya ocurrió. Se reporta `pdfError` al renderer para que pueda informar al usuario |
| PDFs se almacenan en un `Map<sesionId, GeneratedPdf[]>` en el handler | Los `Buffer` no se pueden serializar por IPC. La cola de impresión los consume directamente desde el main process |
| El config pasado a `generateSalePdfs` usa el `cliente` actualizado | El código de etiqueta necesita el session ID incrementado (nuevo valor tras la venta) |
| Patrón consume-once (`consumePdfsForSession`) | Libera memoria tras enviar a la cola de impresión. Un segundo consumo devuelve `null` |

### Flujo actualizado

```
Renderer (KioskoView)
  │
  ▼ sale:execute(config, quantities, profile)
  │
  ├─ Paso 1: executeSale() — Transacción atómica SQLite
  │   • Incrementa codigo.cliente
  │   • Decrementa rollos
  │   • Inserta órdenes
  │   • Si falla → devuelve SaleError (NO genera PDFs) ← Req 11.3
  │
  ├─ Paso 2: notifyConfigChanged() — Notifica al renderer
  │
  ├─ Paso 3: generateSalePdfs(updatedConfig, quantities, profile)
  │   • Construye config con codigo.cliente = result.sesionId (actualizado)
  │   • Genera stamp PDFs (simples + tiras + especiales)
  │   • Genera ticket PDFs (principal + copia + master)
  │   • Si éxito → almacena en pdfCache, devuelve metadata
  │   • Si error → devuelve SaleResult con pdfError (venta ya committed)
  │
  └─ Respuesta al renderer:
      {
        success: true,
        sesionId, sellos1, sellos2, tickets, orders,
        pdfCount, stampCount, ticketCount,  // ← nuevos campos
        pdfError?                           // ← solo si generación falló
      }
```

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/main/ipc/sale.handlers.ts` | Reescrito: ahora es async, integra `generateSalePdfs()` tras transacción exitosa, exporta `consumePdfsForSession()` y `getPdfCache()` |
| `src/main/sales/sale.service.ts` | Extendido `SaleResult` con campos opcionales: `pdfCount?`, `stampCount?`, `ticketCount?`, `pdfError?` |
| `src/preload/index.ts` | Añadidos los mismos campos opcionales en el tipo `SaleResult` del renderer |

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `src/main/ipc/__tests__/sale.handlers.test.ts` | 8 tests de integración para la generación de PDFs en el handler |

### Tipos actualizados

```typescript
// sale.service.ts — SaleResult extendido
interface SaleResult {
  success: true
  sesionId: number
  sellos1: number
  sellos2: number
  tickets: number
  orders: OrderLine[]
  // Nuevos campos (opcionales, se rellenan tras generar PDFs)
  pdfCount?: number     // Total PDFs generados (stamps + tickets)
  stampCount?: number   // PDFs de etiquetas
  ticketCount?: number  // PDFs de tickets
  pdfError?: string     // Mensaje de error si falló la generación
}
```

### Funciones exportadas nuevas (`sale.handlers.ts`)

| Función | Propósito |
|---------|-----------|
| `consumePdfsForSession(sesionId)` | Devuelve y elimina los PDFs cacheados para un sesionId. Devuelve `null` si ya fueron consumidos o no existen |
| `getPdfCache()` | Devuelve la referencia al Map de cache (para testing/inspección) |

### Tests (8 tests nuevos, todos pasan)

| Test | Verificación |
|------|-------------|
| Llama a `generateSalePdfs` con el `sesionId` actualizado | El config pasado tiene `codigo.cliente = result.sesionId` |
| Incluye metadata de PDFs en la respuesta | `pdfCount`, `stampCount`, `ticketCount` presentes |
| Almacena PDFs en cache por `sesionId` | `getPdfCache().get(sesionId)` devuelve los buffers |
| `consumePdfsForSession` funciona una sola vez | Segunda llamada devuelve `null` |
| Error de PDFs no falla la venta | `result.success === true` con `pdfError` presente |
| No genera PDFs si transacción falla (cesta vacía) | `generateSalePdfs` no se invoca |
| No genera PDFs si stock insuficiente | `generateSalePdfs` no se invoca |
| Pasa quantities y profile sin modificar | Los argumentos llegan idénticos a `generateSalePdfs` |

### Cómo ejecutar los tests

```bash
# Solo tests del handler (integración PDFs)
npx vitest run src/main/ipc/__tests__/sale.handlers.test.ts

# Todos los tests de venta (service + handler)
npx vitest run src/main/sales/ src/main/ipc/__tests__/sale.handlers.test.ts
```

### Resultado: 39 tests pasan (31 existentes + 8 nuevos)

---

### Requisitos validados (13.2)

| Requisito | Criterio | Estado |
|-----------|----------|--------|
| Req 11.3 | No genera PDFs si la transacción de datos no se completó exitosamente | ✅ |
| Req 6 | Genera PDFs de etiquetas 55x25mm por cada tarifa con cantidad > 0 | ✅ (delegado a `generateSalePdfs`) |
| Req 7 | Genera ticket de factura simplificada con datos legales | ✅ (delegado a `generateSalePdfs`) |
| Req 8.1 | Enruta etiquetas modelo1 → printer1, modelo2 → printer2 | ✅ (metadata `target` en cada PDF) |
| Req 8.2 | Enruta tickets → printer_ticket | ✅ (metadata `target` en cada PDF) |


---

## Detalle de lo realizado (13.3)

### ¿Qué se hizo?

Se integró el envío a impresoras en el flujo de venta. Tras la generación de PDFs (tarea 13.2), los buffers se encolan en el `PrintQueueService` para ser procesados en segundo plano por un bucle de polling. El `PrintQueueService` persiste los trabajos en la tabla `print_queue` de SQLite y los envía a las impresoras correctas a través del `PrinterManager`.

Se creó un módulo de **registro de servicios** (`services.ts`) que proporciona instancias singleton de `PrinterManager` y `PrintQueueService`, con métodos de ciclo de vida para iniciar y detener el procesamiento en segundo plano.

### Decisiones de diseño

| Decisión | Justificación |
|----------|---------------|
| Singleton de servicios con inicialización lazy | Evita dependencias circulares. Los handlers acceden a los servicios bajo demanda via `getPrinterManager()` / `getPrintQueueService()` |
| Enqueue se ejecuta **después** de generar PDFs, no dentro de la transacción | La transacción SQLite es síncrona; el enqueue puede fallar sin invalidar la venta |
| Si el enqueue falla, la venta sigue siendo exitosa | Los PDFs quedan en cache (`pdfCache`) como fallback. Se devuelve `printJobIds: []` |
| `printer:print` se mantiene como no-op | La impresión ahora se dispara exclusivamente via el flujo `sale:execute` → queue. El canal legacy queda por compatibilidad |
| `printer:pause` pausa TODAS las impresoras | Refleja el comportamiento del legacy donde un solo botón pausa todo |
| `printer:resume` reanuda + reintenta errores | Llama `retryErrorsByTarget` para los 3 targets, reactivando trabajos fallidos |
| El bucle de polling arranca en `initServices()` | Se inicia después de registrar los handlers IPC, garantizando que la DB y config están listos |
| `shutdownServices()` en `will-quit` | Detiene el polling y limpia buffers antes de cerrar la app |

### Flujo completo actualizado

```
Renderer (KioskoView)
  │
  ▼ sale:execute(config, quantities, profile)
  │
  ├─ Paso 1: executeSale() — Transacción atómica SQLite
  │   • Incrementa codigo.cliente
  │   • Decrementa rollos
  │   • Inserta órdenes
  │   • Si falla → devuelve SaleError (NO genera PDFs ni encola)
  │
  ├─ Paso 2: notifyConfigChanged() — Notifica al renderer
  │
  ├─ Paso 3: generateSalePdfs(updatedConfig, quantities, profile)
  │   • Genera stamp PDFs + ticket PDFs
  │   • Si error → devuelve SaleResult con pdfError (NO encola)
  │
  ├─ Paso 4: pdfCache.set(sesionId, pdfs) — Cache local (backward compat)
  │
  ├─ Paso 5: printQueueService.enqueue(pdfs) ← NUEVO (Req 18.2)
  │   • Persiste cada PDF como job en tabla print_queue
  │   • Almacena buffer en memoria del PrintQueueService
  │   • Si falla → printJobIds = [] (no fatal)
  │
  └─ Respuesta al renderer:
      {
        success: true,
        sesionId, sellos1, sellos2, tickets, orders,
        pdfCount, stampCount, ticketCount,
        printJobIds,    // ← NUEVO: IDs de trabajos encolados
        pdfError?
      }

              ┌──── En segundo plano (polling cada 1s) ────┐
              │                                            │
              │  PrintQueueService.processQueue()          │
              │    │                                       │
              │    ├─ Lee jobs pendientes de print_queue   │
              │    ├─ Salta los de impresoras pausadas     │
              │    ├─ Envía buffer a PrinterManager.print()│
              │    │   → printer1: stamps modelo1          │
              │    │   → printer2: stamps modelo2          │
              │    │   → ticket: tickets                   │
              │    ├─ Si éxito → marca completed           │
              │    └─ Si error → reintenta (max 3 veces)  │
              │                                            │
              └────────────────────────────────────────────┘
```

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `src/main/services.ts` | Registro de servicios singleton: `getPrinterManager()`, `getPrintQueueService()`, `initServices()`, `shutdownServices()`, helpers de testing |
| `src/main/ipc/__tests__/printer.handlers.test.ts` | 10 tests de integración para los handlers de impresora actualizados |

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/main/ipc/sale.handlers.ts` | Tras generar PDFs, llama `getPrintQueueService().enqueue(pdfs)`. Devuelve `printJobIds` en el resultado. Manejo graceful de errores de enqueue |
| `src/main/ipc/printer.handlers.ts` | Reescrito: usa `getPrinterManager()` y `getPrintQueueService()` reales para `getStatus`, `pause`, `resume`. `print` queda como no-op |
| `src/main/index.ts` | Añadido `import { initServices, shutdownServices }`. Llama `initServices()` tras `registerAllHandlers()`. Llama `shutdownServices()` en `will-quit` |
| `src/main/sales/sale.service.ts` | Añadido campo opcional `printJobIds?: number[]` a `SaleResult` |
| `src/preload/index.ts` | Añadido campo opcional `printJobIds?: number[]` al tipo `SaleResult` del renderer |

### Funciones exportadas nuevas (`services.ts`)

| Función | Propósito |
|---------|-----------|
| `getPrinterManager()` | Devuelve singleton de `PrinterManager` (lazy init, auto-detecta plataforma) |
| `getPrintQueueService()` | Devuelve singleton de `PrintQueueService` (con el printer manager) |
| `initServices()` | Arranca el bucle de procesamiento en segundo plano de la cola |
| `shutdownServices()` | Detiene el bucle y limpia buffers en memoria |
| `resetServices()` | Para testing: resetea singletons |
| `setServices(manager, queue)` | Para testing: inyecta instancias mock |

### Tipos actualizados

```typescript
// sale.service.ts — SaleResult extendido (nuevo campo)
interface SaleResult {
  success: true
  sesionId: number
  sellos1: number
  sellos2: number
  tickets: number
  orders: OrderLine[]
  pdfCount?: number
  stampCount?: number
  ticketCount?: number
  pdfError?: string
  printJobIds?: number[]  // ← NUEVO: IDs de trabajos en la cola de impresión
}
```

### Tests (15 tests nuevos, 54 totales pasan)

#### sale.handlers.test.ts (5 tests nuevos para la integración con print queue)

| Test | Verificación |
|------|-------------|
| Encola PDFs en la print queue tras generación exitosa (Req 18.2) | `mockEnqueue` se llama con los PDFs generados |
| Incluye `printJobIds` en el resultado de la venta | IDs devueltos por `enqueue()` presentes en response |
| NO encola PDFs cuando la transacción falla | `mockEnqueue` no se invoca si cesta vacía |
| NO encola PDFs cuando la generación de PDFs falla | `mockEnqueue` no se invoca si `generateSalePdfs` lanza |
| Venta exitosa incluso si enqueue lanza excepción | `result.success === true`, `printJobIds = []`, PDFs en cache |

#### printer.handlers.test.ts (10 tests nuevos)

| Test | Verificación |
|------|-------------|
| Registra todos los canales IPC esperados | 5 canales: getStatus, print, pause, resume, getQueue |
| `printer:getStatus` devuelve info del PrinterManager | Llama `printerManager.getStatus()` y mapea resultado |
| `printer:getStatus` devuelve array vacío sin impresoras | Sin asignaciones → `[]` |
| `printer:print` no lanza error | No-op, compatibilidad |
| `printer:pause` llama `printerManager.pauseAll()` | Verifica invocación |
| `printer:resume` llama `resumeAll()` y reintenta errores | `retryErrorsByTarget` para printer1, printer2, ticket |
| `printer:getQueue` devuelve jobs mapeados | Campos correctamente transformados (null → undefined) |
| `printer:getQueue` devuelve array vacío | Sin jobs → `[]` |
| `printer:getQueue` maneja orderId/filePath null | Transformación a undefined correcta |
| `printer:getQueue` propaga errores del repositorio | Lanza si la DB falla |

### Cómo ejecutar los tests

```bash
# Tests del handler de venta (incluye integración con print queue)
npx vitest run src/main/ipc/__tests__/sale.handlers.test.ts

# Tests del handler de impresora
npx vitest run src/main/ipc/__tests__/printer.handlers.test.ts

# Todos los tests de la tarea 13
npx vitest run src/main/sales/ src/main/ipc/__tests__/sale.handlers.test.ts src/main/ipc/__tests__/printer.handlers.test.ts
```

### Resultado: 54 tests pasan (31 sale.service + 13 sale.handlers + 10 printer.handlers)

---

### Requisitos validados (13.3)

| Requisito | Criterio | Estado |
|-----------|----------|--------|
| Req 8.1 | Enruta etiquetas modelo1 → printer1, modelo2 → printer2 | ✅ (target en GeneratedPdf → enqueue → PrinterManager.print) |
| Req 8.2 | Enruta tickets → printer_ticket | ✅ (target 'ticket' en GeneratedPdf) |
| Req 8.5 | Si impresora falla, registra error en cola para reintento | ✅ (PrintQueueService reintenta hasta 3 veces) |
| Req 8.6 | Pausa impresora detiene envío sin perder trabajos | ✅ (`pauseAll()` + jobs quedan pendientes en cola) |
| Req 8.7 | Reanudar impresora reenvía trabajos pendientes | ✅ (`resumeAll()` + `retryErrorsByTarget()`) |
| Req 18.2 | Persiste trabajos antes de enviar (no se pierden) | ✅ (`enqueue()` escribe en print_queue antes de que el polling procese) |

---

## Detalle de lo realizado (13.4)

### ¿Qué se hizo?

Se implementó la **anulación de venta** como una **transacción atómica** en el main process. Anteriormente, la anulación se ejecutaba en el renderer mediante 3 llamadas IPC independientes (`updateSesionError`, `updateRollosRevert`, `insertOrders`), lo que podía dejar el sistema inconsistente si una de ellas fallaba a mitad del proceso.

Ahora toda la lógica se ejecuta en una sola transacción SQLite (`cancelSale()`), análoga a `executeSale()`: si cualquier paso falla, el rollback es automático.

### Decisiones de diseño

| Decisión | Justificación |
|----------|---------------|
| Transacción atómica para la anulación | Garantiza que sesión, rollos y auditoría se revierten como una unidad. Sin atomicidad, un fallo intermedio dejaría estado inconsistente |
| Nuevo canal IPC `sale:cancel` | Simetría con `sale:execute`. Un solo punto de entrada para cancelar |
| Validación en main process (no solo renderer) | El main valida que `sellos1 > 0 OR sellos2 > 0` antes de proceder, evitando anulaciones vacías |
| Renderer usa `cancelSale()` en vez de 3 llamadas separadas | Simplifica el código del frontend, delega responsabilidad al backend |
| El registro de auditoría se inserta dentro de la transacción | Garantiza que si el registro falla, no se modifica la sesión ni los rollos |

### Flujo de anulación (nuevo)

```
Renderer (CartControls)
  │
  ▼ "Error Impresión" button click
  │
  ├─ 1. window.confirm() — Pide confirmación al vendedor
  │     • Si cancela → no hace nada
  │
  ├─ 2. Valida lastSale (sellos1 > 0 || sellos2 > 0)
  │     • Si no hay venta → alert("¡¡NINGUNA venta encontrada!!")
  │
  ├─ 3. sale:cancel({ sellos1, sellos2, tickets })
  │     │
  │     ▼ Main Process — cancelSale() [Transacción atómica SQLite]
  │     │
  │     ├─ Valida que sellos1 > 0 || sellos2 > 0
  │     ├─ Lee config actual de BD
  │     ├─ Decrementa codigo.cliente en 1
  │     ├─ Restaura ticket.rollo1 += sellos1
  │     ├─ Restaura ticket.rollo2 += sellos2
  │     ├─ Restaura ticket.tickets += tickets
  │     ├─ Persiste config actualizada
  │     ├─ Inserta OrderLine con event="ELIMINAR ANTERIOR"
  │     └─ Devuelve { success: true, sesionId }
  │         (o { success: false, error } si falla → rollback automático)
  │
  ├─ 4. Si éxito:
  │     • notifyConfigChanged() → renderer actualiza estado
  │     • clearLastSale() — Limpia registro de última venta
  │     • reset() — Resetea cantidades a 0
  │
  └─ 5. Si error:
        • alert("Error al anular la venta")
```

### Archivos creados

Ninguno (se extendieron los existentes).

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/main/sales/sale.service.ts` | Añadida función `cancelSale()` + tipos `CancelSaleInput`, `CancelSaleResult`, `CancelSaleError`, `CancelSaleOutcome` |
| `src/main/ipc/sale.handlers.ts` | Añadido handler IPC `sale:cancel` que ejecuta `cancelSale()` y notifica config change |
| `src/preload/index.ts` | Añadidos tipos de cancelación + método `sale.cancel(input)` en `ElectronAPI` |
| `src/renderer/src/lib/ipc-client.ts` | Añadida función exportada `cancelSale()` + tipos |
| `src/renderer/src/components/kiosko/CartControls.tsx` | `handlePrintError` reescrito: usa `ipc.cancelSale()` atómico en vez de 3 llamadas separadas. Eliminado import `OrderLine` (ya no se necesita) |
| `src/main/sales/__tests__/sale.service.test.ts` | Añadidos 10 tests para `cancelSale()` |
| `src/renderer/src/components/kiosko/__tests__/CartControls.test.tsx` | Actualizado mock (`mockCancelSale`) y assertions para reflejar la nueva API atómica |

### Tipos nuevos

```typescript
// sale.service.ts

interface CancelSaleInput {
  sellos1: number   // Sellos consumidos del rollo 1 en la venta a anular
  sellos2: number   // Sellos consumidos del rollo 2 en la venta a anular
  tickets: number   // Tickets consumidos en la venta a anular
}

interface CancelSaleResult {
  success: true
  sesionId: number  // ID de sesión tras decrementar (valor revertido)
}

interface CancelSaleError {
  success: false
  error: string
}

type CancelSaleOutcome = CancelSaleResult | CancelSaleError
```

### Canal IPC

| Canal | Dirección | Parámetros | Respuesta |
|-------|-----------|------------|-----------|
| `sale:cancel` | Renderer → Main | `(input: CancelSaleInput)` | `CancelSaleOutcome` |

### Uso desde el renderer

```typescript
const result = await window.electronAPI.sale.cancel({
  sellos1: lastSale.sellos1,
  sellos2: lastSale.sellos2,
  tickets: lastSale.tickets
})

if (result.success) {
  // Anulación exitosa: result.sesionId contiene el ID revertido
} else {
  // Error: result.error (string con mensaje descriptivo)
}
```

### Reglas de negocio implementadas

| Regla | Implementación |
|-------|----------------|
| Req 10.1: Pedir confirmación antes de anular | `window.confirm()` en el renderer antes de llamar al IPC |
| Req 10.2: Revertir incremento de sesión | `codigo.cliente -= 1` dentro de la transacción |
| Req 10.3: Restaurar rollos y tickets | `rollo1 += sellos1`, `rollo2 += sellos2`, `tickets += tickets` |
| Req 10.4: Insertar registro de auditoría | `OrderLine` con `event="ELIMINAR ANTERIOR"`, `machine="error de impresión"` |
| Req 10.5: Rechazar si no hay venta anterior | Error si `sellos1 <= 0 && sellos2 <= 0` |
| Req 11.1: Atomicidad | Toda la operación en `database.transaction()` |
| Req 11.2: Rollback si falla | better-sqlite3 revierte automáticamente |
| Req 3.3: Decrementar cliente en anulación | `codigo.cliente -= 1` |
| Req 4.4: Restaurar cantidades exactas | Se restauran los mismos valores que se decrementaron en la venta |

### Tests (10 tests nuevos, 96 totales pasan)

| Test | Verificación |
|------|-------------|
| Retorna error si no hay venta anterior (sellos1=0, sellos2=0) | Req 10.5 |
| Decrementa session ID (codigo.cliente) en 1 | Req 10.2 |
| Restaura rollo1 correctamente | Req 10.3 |
| Restaura rollo2 correctamente | Req 10.3 |
| Restaura tickets correctamente | Req 10.3 |
| Inserta audit order con event="ELIMINAR ANTERIOR" | Req 10.4 |
| Atomicidad: revierte todo si la transacción falla | Req 11.2 |
| Round-trip: venta + anulación restaura estado original | Req 3.2/3.3, 4.1-4.4 |
| Usa el sesionId correcto en el registro de auditoría | Req 10.4 |
| Funciona con solo sellos2 > 0 (modelo 2 only) | Req 10.2/10.3 |

### Cómo ejecutar los tests

```bash
# Tests del servicio de venta (incluye cancelSale)
npx vitest run src/main/sales/__tests__/sale.service.test.ts

# Tests de CartControls (incluye flujo de anulación)
npx vitest run src/renderer/src/components/kiosko/__tests__/CartControls.test.tsx

# Todos los tests relevantes a la tarea 13
npx vitest run src/main/sales/__tests__/sale.service.test.ts src/main/ipc/__tests__/sale.handlers.test.ts src/renderer/src/components/kiosko/__tests__/CartControls.test.tsx
```

### Resultado: 96 tests pasan (41 sale.service + 13 sale.handlers + 42 CartControls)

---

### Requisitos validados (13.4)

| Requisito | Criterio | Estado |
|-----------|----------|--------|
| Req 3.3 | Decrementar `cliente` en 1 al anular | ✅ |
| Req 4.4 | Restaurar cantidades exactas de rollos y tickets | ✅ |
| Req 10.1 | Pedir confirmación antes de proceder | ✅ (renderer) |
| Req 10.2 | Revertir incremento de sesión | ✅ |
| Req 10.3 | Restaurar rollos y tickets consumidos | ✅ |
| Req 10.4 | Insertar registro de auditoría con event="ELIMINAR ANTERIOR" | ✅ |
| Req 10.5 | Rechazar si no hay venta anterior | ✅ |
| Req 11.1 | Transacción atómica (sesión + rollos + auditoría) | ✅ |
| Req 11.2 | Rollback si cualquier paso falla | ✅ |

---

## Detalle de lo realizado (13.5)

### ¿Qué se hizo?

Se escribieron **property-based tests** para la **Property 10: Atomicidad de transacciones de venta** usando `fast-check` (v4.8.0) con Vitest. Los tests validan formalmente que la transacción SQLite en `executeSale()` es verdaderamente atómica: si cualquier paso falla dentro de la transacción, **todos** los cambios previos se revierten y no queda ningún efecto observable en la base de datos.

### Decisiones de diseño

| Decisión | Justificación |
|----------|---------------|
| 100 iteraciones por propiedad (500 total) | Balance entre cobertura exhaustiva y velocidad de ejecución. Cada iteración genera combinaciones aleatorias únicas |
| Simular fallos eliminando config o corrompiendo tabla orders | Estas son las dos formas de inyectar fallos **dentro** de la transacción (no en pre-validación). Borrar config causa "Config not initialized" al leer; corromper orders causa error en INSERT |
| Arbitraries con rangos acotados (qty 0-50, rollos 100-2000, tickets 50-500) | Evita overflow y mantiene los tests realistas. Se usa `Math.max()` para garantizar stock suficiente y que el fallo NO sea por pre-validación |
| `snapshotDbState()` para comparar antes/después | Permite verificar que NO hay efectos secundarios observables tras un fallo |
| Incluir test de venta exitosa | Verifica la otra cara de la atomicidad: si la transacción tiene éxito, **todos** los cambios ocurren (all-or-nothing) |

### Archivo creado

| Archivo | Descripción |
|---------|-------------|
| `src/main/sales/__tests__/sale.atomicity.property.test.ts` | 5 property-based tests para Property 10 |

### Arbitraries (generadores de datos aleatorios)

| Arbitrary | Rango | Descripción |
|-----------|-------|-------------|
| `arbQuantities` | 0-50 por campo × 12 campos | KioskoQuantities con filtro: al menos 1 sello (cesta no vacía) |
| `arbRollo` | 100-2000 | Valor inicial de rollo1/rollo2 |
| `arbTickets` | 50-500 | Valor inicial de tickets |
| `arbCliente` | 1-9000 | Valor inicial de `codigo.cliente` (bajo 9999 para no activar bloqueo) |
| `arbProfile` | 5 valores | Uno de: Filatelia, Esporadicos, SPDE, Abono/Envio, FERIA |

### Tests (5 properties, todas pasan)

| # | Test | Técnica de inyección de fallo | Verificación |
|---|------|-------------------------------|-------------|
| 1 | `failed transaction leaves DB state identical (config deleted)` | `DELETE FROM config` antes de llamar a `executeSale` | No se insertan orders |
| 2 | `failed transaction due to corrupted orders table rolls back all changes` | `DROP TABLE orders` + recrear con schema incorrecto | `codigo.cliente`, `rollo1`, `rollo2`, `tickets` permanecen sin cambiar |
| 3 | `successful sale is all-or-nothing` | Ninguno (venta exitosa) | Session +1, rollos decrementados exactamente, orders insertadas |
| 4 | `no orders on failure implies no PDFs (Req 11.3)` | `DELETE FROM config` | 0 orders nuevas → imposible generar PDFs (por diseño) |
| 5 | `DB state is byte-for-byte identical after failed sale` | `DROP TABLE orders` + recrear | Config JSON serializado es idéntico antes y después |

### Cómo ejecutar

```bash
# Solo tests de atomicidad (Property 10)
npx vitest run src/main/sales/__tests__/sale.atomicity.property.test.ts

# Todos los tests de venta (service + atomicity)
npx vitest run src/main/sales/__tests__/
```

### Resultado: 5 tests pasan (500 iteraciones totales, ~900ms)

---

### Requisitos validados (13.5)

| Requisito | Criterio | Estado |
|-----------|----------|--------|
| Req 11.1 | Transacción atómica: sesión + rollos + órdenes se ejecutan como unidad | ✅ (test 3: éxito → todo cambia) |
| Req 11.2 | Rollback si cualquier paso falla: todos los cambios previos revertidos | ✅ (tests 1, 2, 4, 5: fallo → nada cambia) |
| Req 11.3 | No genera PDFs si la transacción no completó exitosamente | ✅ (test 4: sin orders → sin datos para PDFs) |
