# Task 12: Módulo de Impresión

## Resumen

Esta tarea implementa el módulo de impresión completo de la aplicación: la capa de abstracción que permite imprimir etiquetas (55×25mm) y tickets (78mm×variable) tanto en Linux (desarrollo, via CUPS) como en Windows (producción, via IPP directo). Incluye gestión de cola con reintentos y descubrimiento automático de impresoras.

---

## Progreso

| # | Subtarea | Estado |
|---|----------|--------|
| 12.1 | Crear src/main/printing/printer-manager.ts con interfaz abstracta PrinterBackend | ✅ Completada |
| 12.2 | Implementar CupsBackend (Linux/Ubuntu) con comandos lp, cupsdisable, cupsenable | ✅ Completada |
| 12.3 | Implementar IppBackend (Windows) con protocolo IPP sobre HTTP | ✅ Completada |
| 12.4 | Implementar auto-detección de backend según SO | ✅ Completada |
| 12.5 | Crear src/main/printing/print-queue.service.ts (procesa cola con reintentos) | ✅ Completada |
| 12.6 | Implementar descubrimiento de impresoras (avahi-browse en Linux, escaneo IPP en Windows) | ✅ Completada |
| 12.7 | Escribir tests con mock de impresora (Property 9: enrutamiento correcto) | ⬜ Pendiente |
| 12.8 | Verificar impresión real con impresora Epson en Windows (test manual) | ⬜ Pendiente |

---

## Detalle de lo realizado (12.1)

### ¿Qué se hizo?

Se creó `src/main/printing/printer-manager.ts` con:

1. **Interfaz abstracta `PrinterBackend`** — Contrato que deben implementar los backends específicos de plataforma (CUPS para Linux, IPP para Windows)
2. **Clase `PrinterManager`** — Orquestador de alto nivel que gestiona asignaciones de impresora, enrutamiento de trabajos y estado de pausa
3. **Tipos compartidos** — `PrinterInfo`, `PrintOptions`, `PrintResult`, `DiscoveredPrinter`, `PrinterAssignments`
4. **Constantes de medios** — `STAMP_MEDIA` (DC55x25), orientaciones, función `buildTicketMedia()`
5. **Función factory** — `createPrinterManager()` y `detectPlatformBackend()`

### Archivo creado

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/main/printing/printer-manager.ts` | **Creado** | Interfaz abstracta + manager + types + factory |

---

### Arquitectura del módulo de impresión

```
┌─────────────────────────────────────────────────────────────┐
│                   IPC Handlers (printer.handlers.ts)         │
│                            │                                │
│        printer:print   printer:pause   printer:getStatus    │
└────────────────────────────│─────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      PrinterManager                          │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  assignments: { printer1: uri, printer2: uri,        │   │
│  │                  ticket: uri }                        │   │
│  │  paused: Set<PrinterTarget>                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                │
│   printStamp(target, pdf)  │  printTicket(pdf, height)     │
│   pause(target)            │  resume(target)               │
│   getStatus()              │  discover()                   │
│                            │                                │
└────────────────────────────│────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              PrinterBackend (interfaz abstracta)             │
│                                                             │
│   print(uri, buffer, options) → PrintResult                 │
│   getStatus(uri) → PrinterStatus                            │
│   pause(uri) → boolean                                      │
│   resume(uri) → boolean                                     │
│   discover() → DiscoveredPrinter[]                          │
│   cancelJob(uri, jobId) → boolean                           │
│                                                             │
└──────────────────┬──────────────────────┬───────────────────┘
                   │                      │
                   ▼                      ▼
        ┌──────────────────┐   ┌──────────────────┐
        │   CupsBackend    │   │    IppBackend    │
        │   (Linux/macOS)  │   │    (Windows)     │
        │                  │   │                  │
        │  lp, lpstat      │   │  IPP over HTTP   │
        │  cupsdisable     │   │  (port 631)      │
        │  cupsenable      │   │                  │
        │  avahi-browse    │   │  Network scan    │
        └──────────────────┘   └──────────────────┘
              (Task 12.2)            (Task 12.3)
```

---

### Interfaz `PrinterBackend`

Define el contrato que cada backend de plataforma debe implementar:

| Método | Parámetros | Retorno | Descripción |
|--------|------------|---------|-------------|
| `print` | `uri, pdfBuffer, options` | `Promise<PrintResult>` | Envía un PDF a la impresora |
| `getStatus` | `uri` | `Promise<PrinterStatus>` | Consulta el estado actual |
| `pause` | `uri` | `Promise<boolean>` | Pausa la cola de la impresora |
| `resume` | `uri` | `Promise<boolean>` | Reanuda la cola de la impresora |
| `discover` | — | `Promise<DiscoveredPrinter[]>` | Descubre impresoras disponibles |
| `cancelJob` | `uri, jobId` | `Promise<boolean>` | Cancela un trabajo específico |

**Implementaciones previstas:**

| Backend | SO | Herramientas | Tarea |
|---------|-----|-------------|-------|
| `CupsBackend` | Linux / macOS | `lp`, `lpstat`, `cupsdisable`, `cupsenable`, `avahi-browse` | 12.2 |
| `IppBackend` | Windows | Protocolo IPP sobre HTTP (puerto 631) | 12.3 |

---

### Tipos definidos

#### `PrinterTarget`

```typescript
type PrinterTarget = 'printer1' | 'printer2' | 'ticket'
```

Roles de impresora en el sistema:
- `printer1` — Impresora de etiquetas para modelo 1 (izquierdo)
- `printer2` — Impresora de etiquetas para modelo 2 (derecho)
- `ticket` — Impresora de tickets (factura simplificada)

#### `PrinterStatus`

```typescript
type PrinterStatus = 'ready' | 'busy' | 'error' | 'disconnected' | 'paused'
```

#### `PrinterInfo`

```typescript
interface PrinterInfo {
  id: string           // Identificador único
  name: string         // Nombre visible
  target: PrinterTarget // Rol asignado
  status: PrinterStatus // Estado actual
  uri: string          // URI de conexión
}
```

#### `PrintOptions`

```typescript
interface PrintOptions {
  media: string        // Tamaño de medio (ej: "DC55x25", "Custom.78x120mm")
  orientation: number  // 6 = landscape (sellos), 3 = portrait (tickets)
  copies?: number      // Copias (default 1)
  jobName?: string     // Nombre del trabajo para la cola
}
```

#### `PrintResult`

```typescript
interface PrintResult {
  success: boolean     // Si fue aceptado por la impresora/spooler
  jobId?: string       // ID del trabajo asignado por el sistema
  error?: string       // Mensaje de error si success = false
}
```

#### `DiscoveredPrinter`

```typescript
interface DiscoveredPrinter {
  name: string         // Nombre reportado por el sistema
  uri: string          // URI de conexión
  accepting: boolean   // Si acepta trabajos actualmente
  info?: string        // Info adicional (modelo, ubicación)
}
```

#### `PrinterAssignments`

```typescript
interface PrinterAssignments {
  printer1?: string    // URI impresora sellos modelo 1
  printer2?: string    // URI impresora sellos modelo 2
  ticket?: string      // URI impresora tickets
}
```

---

### Constantes de medios de impresión

| Constante | Valor | Uso |
|-----------|-------|-----|
| `STAMP_MEDIA` | `"DC55x25"` | Tamaño de medio para etiquetas (55mm × 25mm) |
| `STAMP_ORIENTATION` | `6` | Landscape (según spec IPP) |
| `TICKET_ORIENTATION` | `3` | Portrait (según spec IPP) |
| `buildTicketMedia(h)` | `"Custom.78x{h}mm"` | Genera string de medio para ticket de altura variable |

---

### Clase `PrinterManager`

Orquestador de alto nivel que encapsula un backend y gestiona:
- **Asignaciones** target → URI (qué impresora física corresponde a cada rol)
- **Estado de pausa** por target (impide envío de trabajos sin perder la cola)
- **Enrutamiento** automático de etiquetas y tickets

#### Métodos públicos

| Método | Descripción |
|--------|-------------|
| `print(target, buffer, options)` | Envía PDF al target con opciones explícitas |
| `printStamp(target, buffer, jobName?)` | Shortcut para sellos: aplica media DC55x25 + orientation 6 |
| `printTicket(buffer, heightMm, jobName?)` | Shortcut para tickets: aplica Custom.78x{h}mm + orientation 3 |
| `getStatus()` | Consulta estado de todas las impresoras asignadas |
| `pause(target)` | Pausa un target (backend + estado local) |
| `resume(target)` | Reanuda un target |
| `pauseAll()` | Pausa todas las impresoras |
| `resumeAll()` | Reanuda todas las impresoras |
| `isPaused(target)` | Consulta si un target está pausado |
| `discover()` | Descubre impresoras vía backend |
| `cancelJob(target, jobId)` | Cancela un trabajo en la impresora |
| `setAssignments(a)` | Actualiza asignaciones target → URI |
| `getAssignments()` | Devuelve las asignaciones actuales |
| `getUriForTarget(target)` | URI de un target específico |
| `getBackend()` | Referencia al backend activo |

#### Lógica de `print()`

```
print(target, buffer, options):
  1. Buscar URI asignada para el target
     → Si no hay URI: retorna { success: false, error: "No printer assigned" }
  2. Verificar si el target está pausado
     → Si pausado: retorna { success: false, error: "Printer is paused" }
  3. Delegar al backend: backend.print(uri, buffer, options)
     → Retorna el PrintResult del backend
```

#### Lógica de `getStatus()`

```
getStatus():
  Para cada target (printer1, printer2, ticket):
    1. Si no tiene URI asignada → se omite
    2. Si está en el set de pausados → status = 'paused'
    3. Si no está pausado → llama backend.getStatus(uri)
       - Si el backend lanza error → status = 'disconnected'
    4. Construye PrinterInfo y lo añade al resultado
```

---

### Factory y detección de plataforma

#### `detectPlatformBackend()`

```typescript
function detectPlatformBackend(): 'cups' | 'ipp' {
  // Linux, macOS → 'cups'
  // Windows, otros → 'ipp'
}
```

Usa `os.platform()` para auto-seleccionar el backend adecuado según el SO del host.

#### `createPrinterManager(backend, assignments?)`

Función factory que instancia un `PrinterManager` con el backend proporcionado. Se actualizará en las tareas 12.2–12.4 para instanciar automáticamente el backend correcto.

---

### Flujo de impresión completo (previsto)

```
Venta confirmada en Kiosko
         │
         ▼
pdf-generator.ts genera PDFs con routing metadata
  → [{ buffer, target: 'printer1', pdfType: 'stamp_simple' }, ...]
         │
         ▼
print-queue.service.ts (Tarea 12.5)
  → Persiste trabajos en tabla print_queue
  → Procesa cola secuencialmente con reintentos
         │
         ▼
PrinterManager.printStamp(target, buffer)
  o PrinterManager.printTicket(buffer, height)
         │
         ▼
PrinterBackend.print(uri, buffer, options)
  → CupsBackend: ejecuta `lp -d {printer} -o media=DC55x25 -o orientation=6`
  → IppBackend: envía request IPP Print-Job al endpoint HTTP
         │
         ▼
Impresora física imprime la etiqueta/ticket
```

---

### Enrutamiento (Property 9)

El enrutamiento es determinista según el `target` del `GeneratedPdf`:

| Target del PDF | Impresora física | Media | Orientación |
|----------------|-----------------|-------|-------------|
| `printer1` | PRINTER_1 (sellos modelo izquierdo) | DC55x25 | 6 (landscape) |
| `printer2` | PRINTER_2 (sellos modelo derecho) | DC55x25 | 6 (landscape) |
| `ticket` | PRINTER_TICKET (tickets) | Custom.78x{h}mm | 3 (portrait) |

Esto garantiza que:
- Las etiquetas del modelo1 SIEMPRE van a printer1
- Las etiquetas del modelo2 SIEMPRE van a printer2
- Todos los tickets SIEMPRE van a la impresora de tickets
- Las opciones de media son correctas para cada tipo de documento

---

### Relación con el legacy

| Aspecto | Legacy (`printer_backend.py`) | Nuevo (`printer-manager.ts`) |
|---------|-------------------------------|------------------------------|
| Lenguaje | Python | TypeScript (Node.js) |
| Comunicación | WebSocket (demonio separado) | Integrado en main process |
| Backend Linux | CUPS via subprocess | CUPS via child_process (Tarea 12.2) |
| Backend Windows | IPP via Python requests | IPP via HTTP nativo (Tarea 12.3) |
| Detección SO | `platform.system()` | `os.platform()` |
| Cola | Sin persistencia | SQLite (tabla `print_queue`) |
| Pausa/Reanudar | `cupsdisable`/`cupsenable` | Mismo + estado local en manager |
| Tipado | Sin tipos | Interfaces TypeScript estrictas |

---

### Relación con el diseño

Implementa las secciones del documento de diseño:

- **2.4 Components** → "Printer Integration: Node.js (main process) — IPP/CUPS print commands"
- **3.1 Project Structure** → `src/main/printing/printer-manager.ts`
- **3.4 Technology Decisions** → "IPP directo + CUPS fallback: Replica la logica del legacy"
- **3.5 Development & Testing Environment** → "Printer abstraction layer"
- **3.6 Non-Functional Requirements** → "Impresión < 2 segundos", "Compatibilidad impresora"

### Requisitos validados

| Requisito | Aspecto cubierto |
|-----------|-----------------|
| Req 8 (Gestión de Impresión) | Enrutamiento correcto por target, media/orientación |
| Req 9 (Capa de Abstracción) | Interfaz abstracta, auto-detección, misma API para ambos SO |

---

### Verificación

```bash
# Diagnósticos del IDE — sin errores:
$ getDiagnostics src/main/printing/printer-manager.ts
# ✓ No diagnostics found

# Type-check del main process:
$ npx tsc --noEmit --project tsconfig.node.json
# ✓ Sin errores en printer-manager.ts
# (los errores existentes son de otros ficheros: unused vars en tests)
```

---

### Próximos pasos

- **Tarea 12.3**: Implementar `IppBackend` — Clase que implementa `PrinterBackend` usando protocolo IPP sobre HTTP para Windows
- **Tarea 12.4**: Actualizar `createPrinterManager()` para instanciar automáticamente el backend correcto según `detectPlatformBackend()`
- **Tarea 12.5**: Crear `print-queue.service.ts` — Servicio que procesa la cola de impresión con reintentos, usando `PrinterManager` para el envío
- **Tarea 12.6**: Integrar descubrimiento de impresoras en los handlers IPC (`printer:getStatus`)
- **Tarea 12.7**: Property-based tests que verifiquen el enrutamiento determinista (Property 9)
- **Tarea 12.8**: Test manual en Windows con impresora Epson real

---

## Detalle de lo realizado (12.2)

### ¿Qué se hizo?

Se implementó `CupsBackend`, la clase que implementa la interfaz `PrinterBackend` para Linux/macOS usando comandos CUPS del sistema. Usa inyección de dependencias para testabilidad.

### Archivos creados/modificados

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/main/printing/cups-backend.ts` | **Creado** | Implementación completa del backend CUPS |
| `src/main/printing/__tests__/cups-backend.test.ts` | **Creado** | 46 tests unitarios |

---

### Diseño del CupsBackend

#### Patrón de inyección de dependencias

Para facilitar el testing sin necesidad de mocks complejos de módulos Node.js, la clase acepta dos interfaces opcionales en el constructor:

```typescript
export interface CommandExecutor {
  exec(command: string): Promise<{ stdout: string; stderr: string }>
  execFile(file: string, args: string[]): Promise<{ stdout: string; stderr: string }>
}

export interface FileIO {
  writeFile(path: string, data: Buffer): Promise<void>
  unlink(path: string): Promise<void>
  createTempFilePath(): string
}
```

- **En producción**: Se usan `defaultExecutor` (wraps `child_process`) y `defaultFileIO` (wraps `fs/promises`)
- **En tests**: Se inyectan mocks directamente sin necesidad de `vi.mock()`

```typescript
// Uso en producción (sin argumentos → usa defaults)
const backend = new CupsBackend()

// Uso en tests (inyecta mocks)
const backend = new CupsBackend(mockExecutor, mockFileIO)
```

---

### Comandos CUPS utilizados

| Método | Comando | Descripción |
|--------|---------|-------------|
| `print()` | `lp -d <queue> -o media=... -o orientation-requested=... [-n copies] [-t jobName] <file>` | Envía un archivo PDF a la cola de impresión |
| `getStatus()` | `lpstat -p <queue>` | Consulta el estado de una impresora específica |
| `pause()` | `cupsdisable <queue>` | Deshabilita la cola (la impresora deja de procesar trabajos) |
| `resume()` | `cupsenable <queue>` | Rehabilita la cola (reanuda procesamiento) |
| `discover()` | `lpstat -a` | Lista todas las impresoras disponibles en el sistema |
| `cancelJob()` | `cancel <jobId>` | Cancela un trabajo específico de la cola |

---

### Flujo de `print()`

```
print(printerUri, pdfBuffer, options):
  1. Extraer nombre de cola CUPS del URI
     → extractQueueName("ipp://host/printers/Epson") → "Epson"
     → extractQueueName("MyPrinter") → "MyPrinter"
  2. Crear archivo temporal para el PDF
     → /tmp/stamp-print-{random8hex}.pdf
  3. Escribir pdfBuffer al archivo temporal
  4. Construir argumentos para `lp`:
     → [-d queue] [-o media=X] [-o orientation-requested=N] [-n copies] [-t jobName] [file]
  5. Ejecutar `lp` con execFile (más seguro que exec para args)
  6. Parsear job ID del stdout: "request id is Printer-42 (1 file(s))"
  7. Retornar { success: true, jobId: "Printer-42" }
  8. (finally) Eliminar archivo temporal
```

---

### Funciones de parsing (exportadas para tests)

#### `extractQueueName(uri)`

Extrae el nombre de cola CUPS desde diversos formatos de URI:

| Input | Output |
|-------|--------|
| `"MyPrinter"` | `"MyPrinter"` |
| `"ipp://localhost/printers/Epson"` | `"Epson"` |
| `"ipp://192.168.1.5/printers/Brother_QL/"` | `"Brother_QL"` |
| `"/printers/TestPrinter"` | `"TestPrinter"` |

#### `parseLpstatStatus(output)`

Parsea la salida de `lpstat -p` para determinar el estado:

| Salida contiene | Estado retornado |
|-----------------|-----------------|
| `"disabled"` / `"not accepting"` | `'paused'` |
| `"printing"` | `'busy'` |
| `"idle"` / `"enabled"` | `'ready'` |
| `"error"` / `"fault"` | `'error'` |
| (otro) | `'ready'` (default) |

#### `parseLpstatDiscovery(output)`

Parsea la salida de `lpstat -a` para descubrir impresoras:

```
Epson_ET2850 accepting requests since Mon 01 Jan
Brother_QL820 not accepting requests since Tue 02 Jan
```

→ `[{ name: "Epson_ET2850", uri: "Epson_ET2850", accepting: true, info: "..." }, ...]`

#### `parseJobId(output)`

Extrae el ID del trabajo de la salida de `lp`:

```
"request id is MyPrinter-123 (1 file(s))" → "MyPrinter-123"
```

---

### Manejo de errores

| Escenario | Comportamiento |
|-----------|---------------|
| `lp` falla (impresora no existe) | Retorna `{ success: false, error: "CUPS print failed: ..." }` |
| `lpstat` falla (impresora desconectada) | Retorna `'disconnected'` |
| `cupsdisable`/`cupsenable` falla (permisos) | Retorna `false` |
| `cancel` falla (trabajo no existe) | Retorna `false` |
| Error al borrar temp file | Se ignora silenciosamente (en `finally`) |
| Excepción no-Error (ej: string) | Se convierte a string en el mensaje |

---

### Tests (46 tests, todos pasan)

```
✓ extractQueueName (5 tests)
  - simple queue names, IPP URI, trailing slash, path segments, fallback

✓ parseLpstatStatus (7 tests)
  - idle, printing, disabled, not accepting, fault, enabled, unrecognized

✓ parseLpstatDiscovery (5 tests)
  - accepting, not accepting, multiple printers, empty, unrecognized lines

✓ parseJobId (4 tests)
  - standard output, different names, unrecognized, empty

✓ CupsBackend.print (7 tests)
  - correct options, copies, error handling, URI extraction, temp file cleanup

✓ CupsBackend.getStatus (5 tests)
  - idle, busy, paused, disconnected, URI extraction

✓ CupsBackend.pause (3 tests)
  - cupsdisable call, URI extraction, failure

✓ CupsBackend.resume (3 tests)
  - cupsenable call, URI extraction, failure

✓ CupsBackend.discover (3 tests)
  - lpstat -a parsing, empty, command failure

✓ CupsBackend.cancelJob (3 tests)
  - cancel call, failure, ignores printerUri
```

---

### Verificación

```bash
# Tests unitarios:
$ npx vitest run src/main/printing/__tests__/cups-backend.test.ts
# ✓ Test Files  1 passed (1)
# ✓ Tests  46 passed (46)

# Diagnósticos del IDE:
$ getDiagnostics src/main/printing/cups-backend.ts
# ✓ No diagnostics found

$ getDiagnostics src/main/printing/__tests__/cups-backend.test.ts
# ✓ No diagnostics found
```

---

### Relación con el legacy

El `CupsBackend` replica la funcionalidad del archivo `printer_backend.py` del sistema legacy para la parte de Linux/CUPS:

| Aspecto | Legacy (`printer_backend.py`) | Nuevo (`cups-backend.ts`) |
|---------|-------------------------------|---------------------------|
| Envío de trabajos | `subprocess.run(['lp', ...])` | `execFile('lp', [...])` |
| Consulta estado | `subprocess.run(['lpstat', ...])` | `exec('lpstat -p <queue>')` |
| Pausar | `subprocess.run(['cupsdisable', ...])` | `execFile('cupsdisable', [...])` |
| Reanudar | `subprocess.run(['cupsenable', ...])` | `execFile('cupsenable', [...])` |
| Cancelar | `subprocess.run(['cancel', ...])` | `execFile('cancel', [...])` |
| Temp files | Python `tempfile` | Node.js `os.tmpdir()` + `crypto.randomBytes()` |
| Seguridad args | `subprocess` (no shell) | `execFile` (no shell, evita injection) |

### Requisitos validados

| Requisito | Aspecto cubierto |
|-----------|-----------------|
| Req 9.1 | CUPS como backend en Linux: `lp`, `cupsdisable`, `cupsenable` |
| Req 9.4 | Misma estructura de datos (`PrintResult`, `PrinterStatus`) independiente del backend |
| Req 8.3 | Media DC55x25 + orientation 6 pasados correctamente a `lp` |
| Req 8.4 | Media Custom.78x{h}mm pasado correctamente a `lp` |
| Req 8.6 | Pausa implementada via `cupsdisable` |
| Req 8.7 | Reanudación implementada via `cupsenable` |


---

## Detalle de lo realizado (12.3)

### ¿Qué se hizo?

Se implementó `IppBackend`, la clase que implementa la interfaz `PrinterBackend` para Windows usando el protocolo IPP (Internet Printing Protocol) sobre HTTP. Comunica directamente con impresoras IPP-compatible via HTTP POST al puerto 631, sin depender de drivers del sistema.

### Archivos creados/modificados

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/main/printing/ipp-backend.ts` | **Creado** | Implementación completa del backend IPP |
| `src/main/printing/__tests__/ipp-backend.test.ts` | **Creado** | 50 tests unitarios |

---

### Diseño del IppBackend

#### ¿Qué es IPP?

IPP (Internet Printing Protocol, RFC 8011) es un protocolo estándar donde:
- Las peticiones son HTTP POST con `Content-Type: application/ipp`
- El cuerpo contiene atributos codificados en binario + datos del documento opcional
- Las respuestas también son `application/ipp` con código de estado y atributos
- Puerto estándar: 631

#### Patrón de inyección de dependencias

Igual que `CupsBackend` usa `CommandExecutor` y `FileIO`, el `IppBackend` acepta un `HttpTransport` inyectable:

```typescript
export interface HttpTransport {
  post(
    hostname: string,
    port: number,
    path: string,
    body: Buffer,
    timeoutMs: number
  ): Promise<Buffer>
}
```

- **En producción**: Se usa `defaultHttpTransport` (wraps Node.js `http.request`)
- **En tests**: Se inyecta un mock directamente sin necesidad de `vi.mock()`

```typescript
// Uso en producción (sin argumentos → usa defaults)
const backend = new IppBackend()

// Uso en tests (inyecta mock de transporte)
const backend = new IppBackend(mockTransport, 5000)
```

---

### Operaciones IPP implementadas

| Método | Operación IPP | Op ID | Descripción |
|--------|---------------|-------|-------------|
| `print()` | Print-Job | 0x0002 | Envía un PDF como trabajo de impresión |
| `getStatus()` | Get-Printer-Attributes | 0x000b | Consulta el estado de la impresora |
| `pause()` | Pause-Printer | 0x0010 | Pausa la cola de la impresora |
| `resume()` | Resume-Printer | 0x0011 | Reanuda la cola de la impresora |
| `cancelJob()` | Cancel-Job | 0x0008 | Cancela un trabajo específico |
| `discover()` | — | — | Retorna `[]` (delegado a Tarea 12.6 con mDNS/DNS-SD) |

---

### Formato binario IPP

Cada petición IPP tiene esta estructura:

```
┌──────────────────────────────────────┐
│ Header (8 bytes)                     │
│  - version-major (1 byte): 1        │
│  - version-minor (1 byte): 1        │
│  - operation-id (2 bytes)            │
│  - request-id (4 bytes)             │
├──────────────────────────────────────┤
│ Operation Attributes Group           │
│  - delimiter tag: 0x01              │
│  - attributes-charset: utf-8        │
│  - attributes-natural-language: en  │
│  - printer-uri: ipp://...           │
│  - requesting-user-name: ...        │
│  - document-format: application/pdf │
├──────────────────────────────────────┤
│ Job Attributes Group (Print-Job)     │
│  - delimiter tag: 0x02              │
│  - media: "DC55x25"                 │
│  - orientation-requested: 6         │
│  - copies: N (si > 1)              │
├──────────────────────────────────────┤
│ End of Attributes: 0x03             │
├──────────────────────────────────────┤
│ Document Data (solo Print-Job)       │
│  - El PDF completo como bytes       │
└──────────────────────────────────────┘
```

Cada atributo se codifica como:

```
[value-tag: 1 byte] [name-length: 2 bytes] [name: N bytes] [value-length: 2 bytes] [value: M bytes]
```

---

### Flujo de `print()`

```
print(printerUri, pdfBuffer, options):
  1. Parsear URI (ipp://host:port/path → hostname, port, path)
  2. Generar request-id incremental
  3. Construir petición IPP Print-Job:
     → Header (versión 1.1, operation=0x0002, request-id)
     → Operation attributes (charset, language, printer-uri, user, doc-format)
     → Job attributes (media, orientation, copies)
     → End of attributes marker (0x03)
  4. Concatenar petición IPP + pdfBuffer como body HTTP
  5. Enviar HTTP POST a hostname:port/path con Content-Type: application/ipp
  6. Parsear respuesta IPP:
     → Si statusCode ≤ 0x00FF → éxito, extraer job-id
     → Si statusCode > 0x00FF → error IPP
  7. Retornar { success, jobId, error }
```

---

### Parsing de URI (`parseIppUri`)

Soporta múltiples formatos de URI para flexibilidad de configuración:

| Input | hostname | port | path | printerUri generado |
|-------|----------|------|------|---------------------|
| `ipp://192.168.1.100:631/ipp/print` | 192.168.1.100 | 631 | /ipp/print | ipp://192.168.1.100:631/ipp/print |
| `ipp://192.168.1.100/ipp/print` | 192.168.1.100 | 631 | /ipp/print | ipp://192.168.1.100:631/ipp/print |
| `http://printer.local:631/ipp/print` | printer.local | 631 | /ipp/print | ipp://printer.local:631/ipp/print |
| `ipp://192.168.1.5/printers/Epson` | 192.168.1.5 | 631 | /printers/Epson | ipp://192.168.1.5:631/printers/Epson |
| `192.168.1.50` (solo hostname) | 192.168.1.50 | 631 | /ipp/print | ipp://192.168.1.50:631/ipp/print |

---

### Mapeo de estado de impresora

IPP define `printer-state` como un enum (RFC 8011 §5.4.11):

| Valor IPP | Constante | Estado mapeado (`PrinterStatus`) |
|-----------|-----------|----------------------------------|
| 3 | `IDLE` | `'ready'` |
| 4 | `PROCESSING` | `'busy'` |
| 5 | `STOPPED` | `'paused'` |
| undefined/otro | — | `'disconnected'` |

Si la petición Get-Printer-Attributes retorna un status-code de error (> 0x00FF), se retorna `'error'`.
Si la conexión HTTP falla, se retorna `'disconnected'`.

---

### Manejo de errores

| Escenario | Comportamiento |
|-----------|---------------|
| Impresora no responde (ECONNREFUSED) | Retorna `{ success: false, error: "IPP print failed: ECONNREFUSED" }` |
| Timeout de conexión | Retorna `{ success: false, error: "IPP print failed: IPP request timed out" }` |
| IPP status-code de error (ej: 0x0406) | Retorna `{ success: false, error: "IPP error: status code 0x0406" }` |
| Job ID no numérico en cancelJob | Retorna `false` sin hacer petición HTTP |
| Respuesta IPP truncada (< 8 bytes) | Se parsea como error interno (status 0x0500) |
| Excepción no-Error (ej: string) | Se convierte a string en el mensaje |

---

### Constantes IPP exportadas

```typescript
export const IPP_OPERATIONS = {
  PRINT_JOB: 0x0002,
  GET_PRINTER_ATTRIBUTES: 0x000b,
  GET_JOBS: 0x000a,
  CANCEL_JOB: 0x0008,
  PAUSE_PRINTER: 0x0010,
  RESUME_PRINTER: 0x0011
}

export const IPP_TAGS = {
  OPERATION_ATTRIBUTES: 0x01,
  JOB_ATTRIBUTES: 0x02,
  END_OF_ATTRIBUTES: 0x03,
  PRINTER_ATTRIBUTES: 0x04,
  INTEGER: 0x21,
  BOOLEAN: 0x22,
  ENUM: 0x23,
  TEXT_WITHOUT_LANGUAGE: 0x41,
  NAME_WITHOUT_LANGUAGE: 0x42,
  KEYWORD: 0x44,
  URI: 0x45,
  CHARSET: 0x47,
  NATURAL_LANGUAGE: 0x48,
  MIME_MEDIA_TYPE: 0x49
}

export const IPP_PRINTER_STATE = {
  IDLE: 3,
  PROCESSING: 4,
  STOPPED: 5
}
```

---

### Funciones exportadas (para tests y reutilización)

| Función | Descripción |
|---------|-------------|
| `parseIppUri(uri)` | Parsea URI a componentes (hostname, port, path) |
| `parseIppResponse(buffer)` | Extrae status, request-id, printer-state, job-id de respuesta IPP |
| `mapPrinterState(state)` | Convierte enum IPP a `PrinterStatus` |
| `buildPrintJobRequest(uri, options, reqId)` | Construye petición Print-Job (sin datos del PDF) |
| `buildGetPrinterAttributesRequest(uri, reqId)` | Construye petición Get-Printer-Attributes |
| `buildPausePrinterRequest(uri, reqId)` | Construye petición Pause-Printer |
| `buildResumePrinterRequest(uri, reqId)` | Construye petición Resume-Printer |
| `buildCancelJobRequest(uri, jobId, reqId)` | Construye petición Cancel-Job |

---

### Tests (50 tests, todos pasan)

```
✓ parseIppUri (7 tests)
  - full ipp:// URI, default port, http:// URI, simple hostname,
    custom port, custom path, fallback

✓ parseIppResponse (5 tests)
  - success with job-id, success with printer-state, error response,
    too-short response, no attributes

✓ mapPrinterState (5 tests)
  - IDLE→ready, PROCESSING→busy, STOPPED→paused, undefined→disconnected,
    unknown→disconnected

✓ buildPrintJobRequest (3 tests)
  - valid buffer, includes copies when >1, omits copies when default

✓ buildGetPrinterAttributesRequest (1 test)
  - valid Get-Printer-Attributes request

✓ buildPausePrinterRequest (1 test)
  - valid Pause-Printer request

✓ buildResumePrinterRequest (1 test)
  - valid Resume-Printer request

✓ buildCancelJobRequest (1 test)
  - valid Cancel-Job request with job-id

✓ IppBackend.print (7 tests)
  - correct options, simple hostname, IPP error, network failure,
    timeout, non-Error exception, no job-id in response

✓ IppBackend.getStatus (6 tests)
  - idle, busy, paused, IPP error→error, network failure→disconnected,
    correct endpoint

✓ IppBackend.pause (3 tests)
  - success, IPP error, network failure

✓ IppBackend.resume (3 tests)
  - success, IPP error, network failure

✓ IppBackend.discover (1 test)
  - returns empty (deferred to Task 12.6)

✓ IppBackend.cancelJob (4 tests)
  - success, non-numeric ID, IPP error, network failure

✓ request ID incrementing (1 test)
  - IDs increment across calls (1, 2, 3...)
```

---

### Verificación

```bash
# Tests unitarios:
$ npx vitest run src/main/printing/__tests__/ipp-backend.test.ts
# ✓ Test Files  1 passed (1)
# ✓ Tests  50 passed (50)

# Diagnósticos del IDE:
$ getDiagnostics src/main/printing/ipp-backend.ts
# ✓ No diagnostics found

$ getDiagnostics src/main/printing/__tests__/ipp-backend.test.ts
# ✓ No diagnostics found

# Tests del CupsBackend siguen pasando (no se rompió nada):
$ npx vitest run src/main/printing/__tests__/cups-backend.test.ts
# ✓ Test Files  1 passed (1)
# ✓ Tests  46 passed (46)
```

---

### Diferencias con CupsBackend

| Aspecto | CupsBackend (Linux) | IppBackend (Windows) |
|---------|---------------------|----------------------|
| Transporte | Subprocesos (`lp`, `lpstat`) | HTTP POST directo |
| Dependencias SO | Requiere CUPS instalado | Solo requiere red (TCP) |
| Temp files | Sí (lp necesita archivo) | No (buffer directo en body HTTP) |
| Parsing de estado | Texto libre de `lpstat` | Enum binario IPP (3/4/5) |
| Job IDs | Strings (`Printer-123`) | Enteros (42) |
| Discovery | `lpstat -a` (local) | Delegado a Task 12.6 (mDNS) |
| Pause/Resume | `cupsdisable`/`cupsenable` | Operaciones IPP nativas |
| Timeout | Depende del subproceso | Configurable (default 10s) |

---

### Relación con el legacy

El `IppBackend` replica la funcionalidad del archivo `printer_backend.py` del sistema legacy para la parte de Windows/IPP:

| Aspecto | Legacy (`printer_backend.py`) | Nuevo (`ipp-backend.ts`) |
|---------|-------------------------------|--------------------------|
| Lenguaje | Python + `requests` | TypeScript + Node.js `http` |
| Protocolo | IPP sobre HTTP | IPP sobre HTTP (idéntico) |
| Codificación | Binaria manual con `struct.pack` | Binaria manual con `Buffer` |
| Puerto | 631 | 631 (configurable vía URI) |
| Timeout | Sin timeout explícito | 10s configurable |
| Tipado | Sin tipos | Interfaces TypeScript estrictas |
| Testing | Sin tests unitarios | 50 tests con mock de transporte |

### Requisitos validados

| Requisito | Aspecto cubierto |
|-----------|-----------------|
| Req 9.2 | IPP directo como backend en Windows |
| Req 9.4 | Misma estructura de datos (`PrintResult`, `PrinterStatus`) independiente del backend |
| Req 8.3 | Media DC55x25 + orientation 6 enviados como atributos IPP |
| Req 8.4 | Media Custom.78x{h}mm enviado como atributo IPP |
| Req 8.5 | Errores registrados con mensaje descriptivo para la cola |
| Req 8.6 | Pausa implementada via operación IPP Pause-Printer |
| Req 8.7 | Reanudación implementada via operación IPP Resume-Printer |

---

### Próximos pasos

- **Tarea 12.5**: Crear `print-queue.service.ts` — Servicio que procesa la cola de impresión con reintentos
- **Tarea 12.6**: Implementar descubrimiento de impresoras (mDNS/DNS-SD en Windows, avahi en Linux)
- **Tarea 12.7**: Property-based tests para enrutamiento determinista (Property 9)
- **Tarea 12.8**: Test manual en Windows con impresora Epson real


---

## Detalle de lo realizado (12.5)

### ¿Qué se hizo?

Se creó `src/main/printing/print-queue.service.ts`, el servicio que procesa la cola de impresión con lógica de reintentos. Gestiona el ciclo de vida completo de los trabajos: desde que los PDFs son generados por `pdf-generator.ts` hasta que son enviados exitosamente a las impresoras vía `PrinterManager`.

### Archivos creados

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/main/printing/print-queue.service.ts` | **Creado** | Servicio de cola de impresión con reintentos |
| `src/main/printing/__tests__/print-queue.service.test.ts` | **Creado** | 26 tests unitarios |

---

### Diseño del PrintQueueService

#### Responsabilidades

1. **Encolar** PDFs generados: persiste metadatos en la tabla `print_queue` y cachea buffers en memoria
2. **Procesar** trabajos pendientes: envía a la impresora correcta vía `PrinterManager`
3. **Reintentar** trabajos fallidos: hasta un máximo configurable de intentos
4. **Respetar pausas**: omite trabajos destinados a impresoras pausadas
5. **Ciclo de vida**: loop de background con start/stop

#### Relación con otros módulos

```
pdf-generator.ts                     print-queue.service.ts              printer-manager.ts
─────────────────                    ──────────────────────              ──────────────────
generateSalePdfs()                         │                                    │
  → GeneratedPdf[]  ──── enqueue() ───→ print_queue (SQLite)                    │
                                           │                                    │
                                     processQueue()                             │
                                           │                                    │
                                    para cada job pending:                       │
                                      1. markPrinting()                         │
                                      2. buildPrintOptions() ──── print() ────→ backend
                                      3. markCompleted() o markError()          │
                                           │                                    │
                                    si error y attempts < max:                  │
                                      → retry() (reset a pending)              │
```

---

### Configuración (`PrintQueueServiceOptions`)

| Opción | Default | Descripción |
|--------|---------|-------------|
| `maxAttempts` | 3 | Máximo de reintentos por trabajo antes de dejarlo en 'error' |
| `pollIntervalMs` | 1000 | Intervalo entre ciclos de procesamiento del loop de background |
| `retryDelayMs` | 2000 | Espera antes de reintentar un trabajo fallido |
| `defaultTicketHeightMm` | 200 | Altura por defecto del ticket cuando no se especifica |

---

### API pública

| Método | Retorno | Descripción |
|--------|---------|-------------|
| `enqueue(pdfs, orderId?)` | `number[]` | Encola PDFs y retorna IDs de los jobs creados |
| `processQueue()` | `Promise<number>` | Procesa todos los pendientes, retorna cantidad exitosos |
| `start()` | `void` | Inicia el loop de background |
| `stop()` | `void` | Detiene el loop de background |
| `isRunning()` | `boolean` | Estado del loop |
| `retryErrorsByTarget(target)` | `void` | Resetea errores de un target a pending |
| `getStatus()` | `{pending, printing, completed, error}` | Resumen de la cola |
| `getQueue()` | `PrintJob[]` | Todos los jobs |
| `getPendingByTarget(target)` | `PrintJob[]` | Pendientes de un target |
| `purgeCompleted(days?)` | `number` | Elimina completados antiguos |
| `clearBufferCache()` | `void` | Limpia caché de buffers |
| `getBufferCacheSize()` | `number` | Buffers en memoria |

---

### Flujo de `enqueue()`

```
enqueue(pdfs: GeneratedPdf[], orderId?: number):
  Para cada PDF:
    1. Insertar en print_queue (status='pending'):
       → { orderId, printerTarget, pdfType, filePath: null }
    2. Cachear buffer en memoria: bufferCache.set(jobId, pdf.buffer)
    3. Añadir jobId al array de resultados
  Retornar array de IDs creados
```

Importante: los PDFs se persisten primero en la BD (metadatos) y los buffers se mantienen en memoria. Esto garantiza que **no se pierden trabajos ante un fallo** (Req 18.2), aunque si la app se reinicia los buffers en memoria se pierden y el job pasa a 'error' con mensaje descriptivo.

---

### Flujo de `processQueue()`

```
processQueue():
  1. Si ya hay un ciclo en progreso → retornar 0 (prevenir overlap)
  2. Obtener todos los jobs con status='pending' (ordenados por ID)
  3. Para cada job:
     a. Si la impresora del target está pausada → skip
     b. Si attempts >= maxAttempts → skip
     c. Procesar el job:
        i.   Buscar buffer en caché
             → Si no existe: markError("PDF buffer not found") y continuar
        ii.  markPrinting(jobId)
        iii. Construir PrintOptions según tipo (stamp vs ticket)
        iv.  Llamar printerManager.print(target, buffer, options)
             → Si success: markCompleted() + borrar buffer de caché
             → Si error: markError(msg) + scheduleRetry()
  4. Retornar cantidad de jobs procesados exitosamente
```

---

### Lógica de reintentos

```
scheduleRetry(job):
  1. Leer job actualizado de la BD (para verificar attempts)
  2. Si attempts < maxAttempts:
     → Esperar retryDelayMs
     → retry(jobId) — resetea status a 'pending', limpia error
  3. Si attempts >= maxAttempts:
     → Dejar en estado 'error' para intervención manual
```

El flujo de reintentos respeta el contrato de la cola:
- **Primer intento**: job se crea con `status='pending'`, `attempts=0`
- **Fallo**: `markError()` incrementa `attempts` a 1 y pone `status='error'`
- **Retry**: `retry()` vuelve a `status='pending'` (sin cambiar attempts)
- **Segundo intento**: si falla de nuevo, `attempts` sube a 2
- **maxAttempts alcanzado**: el job queda permanentemente en 'error'

---

### Asignación de PrintOptions

El servicio determina automáticamente las opciones de impresión según el tipo de trabajo:

| printerTarget | media | orientation | Constante usada |
|---------------|-------|-------------|-----------------|
| `printer1` | `DC55x25` | 6 (landscape) | `STAMP_MEDIA`, `STAMP_ORIENTATION` |
| `printer2` | `DC55x25` | 6 (landscape) | `STAMP_MEDIA`, `STAMP_ORIENTATION` |
| `ticket` | `Custom.78x{h}mm` | 3 (portrait) | `buildTicketMedia()`, `TICKET_ORIENTATION` |

---

### Prevención de concurrencia

El servicio usa un flag `processing` para evitar que dos ciclos de procesamiento se ejecuten simultáneamente:

```typescript
async processQueue(): Promise<number> {
  if (this.processing) return 0  // ← previene overlap
  this.processing = true
  try {
    // ... procesar jobs
  } finally {
    this.processing = false
  }
}
```

Esto es importante porque el loop de background y llamadas manuales a `processQueue()` podrían solaparse.

---

### Loop de background

```
start():
  running = true
  schedulePoll()

schedulePoll():
  setTimeout(() => {
    processQueue()
    schedulePoll()  // re-programa el siguiente ciclo
  }, pollIntervalMs)

stop():
  running = false
  clearTimeout(pollTimer)
```

El loop usa `setTimeout` recursivo (no `setInterval`) para garantizar que el siguiente ciclo no empieza hasta que el anterior termina. Esto evita acumulación de ciclos si el procesamiento es lento.

---

### Interacción con pausas de impresora

Cuando una impresora está pausada:
- Los jobs destinados a esa impresora se **omiten** (no se borran ni pasan a error)
- Permanecen en `status='pending'` esperando que la impresora se reanude
- Cuando se reanuda, `retryErrorsByTarget(target)` también resetea los jobs con error

Flujo de pausa/reanudación:
```
1. Usuario pulsa "Pausar" en Kiosko
2. printer.handlers.ts → printerManager.pause(target)
3. Jobs para ese target se saltan en processQueue()
4. Usuario pulsa "Reanudar"
5. printer.handlers.ts → printerManager.resume(target)
6. print-queue.service.retryErrorsByTarget(target)
7. Próximo ciclo de processQueue() envía los jobs pendientes
```

---

### Tests (26 tests, todos pasan)

```
✓ enqueue (5 tests)
  - inserts jobs and returns IDs
  - stores buffers in cache
  - associates order ID when provided
  - passes null orderId when not provided
  - correctly maps pdfType and printerTarget

✓ processQueue (8 tests)
  - processes all pending jobs successfully
  - marks jobs as printing before sending
  - removes buffer from cache after success
  - skips jobs for paused printers
  - processes non-paused printers when some are paused
  - handles printer errors by marking as error
  - handles exceptions from printer backend
  - marks error for jobs with no buffer in cache
  - skips jobs exceeding maxAttempts
  - prevents concurrent processing cycles

✓ print options (2 tests)
  - sends stamps with DC55x25 media and landscape orientation
  - sends tickets with custom media and portrait orientation

✓ retry logic (2 tests)
  - retries a failed job by resetting to pending
  - retryErrorsByTarget resets error jobs for the target

✓ lifecycle (2 tests)
  - starts and stops the background processing loop
  - does not start twice

✓ queue management (5 tests)
  - returns queue status from repository
  - returns all jobs
  - returns pending jobs by target
  - purges completed jobs
  - clears the buffer cache
```

---

### Verificación

```bash
# Tests unitarios del servicio:
$ npx vitest run src/main/printing/__tests__/print-queue.service.test.ts
# ✓ Test Files  1 passed (1)
# ✓ Tests  26 passed (26)
# Duration  1.09s

# Tests del printer-manager siguen pasando:
$ npx vitest run src/main/printing/__tests__/printer-manager.test.ts
# ✓ Test Files  1 passed (1)
# ✓ Tests  17 passed (17)

# Diagnósticos del IDE:
# ✓ print-queue.service.ts — No diagnostics found
# ✓ print-queue.service.test.ts — No diagnostics found
```

---

### Relación con el legacy

| Aspecto | Legacy (Meteor + Python daemon) | Nuevo (`print-queue.service.ts`) |
|---------|--------------------------------|----------------------------------|
| Persistencia de cola | Sin persistencia (solo en memoria) | SQLite (tabla `print_queue`) |
| Reintentos | Sin reintentos automáticos | Hasta 3 reintentos con delay configurable |
| Estado de jobs | No se rastreaba | `pending → printing → completed/error` |
| Pausa | Solo en impresora física | Estado local + impresora física |
| Concurrencia | Un job a la vez (Python GIL) | Flag `processing` + setTimeout recursivo |
| Recuperación ante fallo | Pérdida total de trabajos | Metadatos persistidos antes de enviar |

---

### Requisitos validados

| Requisito | Aspecto cubierto |
|-----------|-----------------|
| Req 8.5 | Si impresora devuelve error → registra en Cola_Impresión y mantiene para reintento |
| Req 8.6 | Cuando se pausa → detiene envío sin perder pendientes |
| Req 8.7 | Cuando se reanuda → reenvía trabajos pendientes acumulados |
| Req 18.2 | Persiste trabajos en la cola ANTES de enviarlos, garantizando no-pérdida ante fallo |

---

### Próximos pasos

- **Tarea 12.6**: Implementar descubrimiento de impresoras (avahi-browse en Linux, escaneo IPP en Windows)
- **Tarea 12.7**: Property-based tests para enrutamiento determinista (Property 9)
- **Tarea 12.8**: Test manual en Windows con impresora Epson real
- **Integración**: Conectar el servicio con `printer.handlers.ts` para que `printer:print` use `enqueue()` + `processQueue()`


---

## Detalle de lo realizado (12.6)

### ¿Qué se hizo?

Se implementó el descubrimiento automático de impresoras para ambas plataformas:
- **Linux**: Usa `avahi-browse` (mDNS/DNS-SD) para encontrar impresoras IPP en la red local, complementado con `lpstat -a` para impresoras CUPS configuradas localmente.
- **Windows**: Escanea la subred local (vía tabla ARP) probando endpoints IPP comunes en cada host descubierto.

Se creó un módulo dedicado `printer-discovery.ts` y se integraron los backends existentes (`CupsBackend.discover()` y `IppBackend.discover()`) para usar esta lógica.

### Archivos creados/modificados

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/main/printing/printer-discovery.ts` | **Creado** | Módulo de descubrimiento con lógica Linux (avahi) y Windows (subnet scan) |
| `src/main/printing/__tests__/printer-discovery.test.ts` | **Creado** | 29 tests unitarios |
| `src/main/printing/cups-backend.ts` | **Modificado** | `discover()` ahora usa `discoverLinuxPrinters()` |
| `src/main/printing/ipp-backend.ts` | **Modificado** | `discover()` ahora usa `discoverWindowsPrinters()` |
| `src/main/printing/__tests__/cups-backend.test.ts` | **Modificado** | Test de discover actualizado para reflejar nuevo flujo |

---

### Arquitectura del descubrimiento

```
┌─────────────────────────────────────────────────────────────┐
│                    PrinterManager.discover()                  │
│                            │                                │
└────────────────────────────│────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
┌──────────────────────┐       ┌──────────────────────┐
│ CupsBackend.discover │       │ IppBackend.discover  │
│    (Linux/macOS)     │       │     (Windows)        │
└──────────┬───────────┘       └──────────┬───────────┘
           │                              │
           ▼                              ▼
┌──────────────────────┐       ┌──────────────────────┐
│ discoverLinuxPrinters│       │discoverWindowsPrinters│
│                      │       │                      │
│ 1. avahi-browse      │       │ 1. arp -a            │
│    _ipp._tcp         │       │    (lista hosts)     │
│ 2. avahi-browse      │       │ 2. Probe IPP         │
│    _ipps._tcp        │       │    puerto 631        │
│ 3. lpstat -a         │       │    /ipp/print        │
│    (fallback)        │       │    /ipp/printer      │
│                      │       │    /                 │
│ Dedup por URI        │       │ Dedup por host:port  │
└──────────────────────┘       └──────────────────────┘
```

---

### Linux: Descubrimiento con avahi-browse

#### Comando utilizado

```bash
avahi-browse -tpr _ipp._tcp 2>/dev/null
avahi-browse -tpr _ipps._tcp 2>/dev/null
```

Flags:
- `-t` — Terminar después de recibir todos los resultados (no queda escuchando)
- `-p` — Parseable output (campos separados por `;`)
- `-r` — Resolver inmediatamente (incluye IP y puerto)

#### Formato de salida de avahi-browse

```
=;eth0;IPv4;Brother QL-820NWB;_ipp._tcp;local;BRN123456.local;192.168.1.50;631;"rp=ipp/print" "ty=Brother QL-820NWB"
│  │    │    │                 │         │     │               │            │    └─ TXT record
│  │    │    │                 │         │     │               │            └─ Puerto
│  │    │    │                 │         │     │               └─ IP address
│  │    │    │                 │         │     └─ Hostname
│  │    │    │                 │         └─ Dominio
│  │    │    │                 └─ Tipo de servicio
│  │    │    └─ Nombre del servicio (nombre visible de la impresora)
│  │    └─ Protocolo (IPv4/IPv6)
│  └─ Interfaz de red
└─ Tipo de entrada (= = resuelto, + = encontrado, - = eliminado)
```

Solo se procesan líneas que empiezan con `=` (entradas resueltas con IP y puerto).

#### TXT Record

El registro TXT de mDNS contiene metadatos clave:
- `rp` — Resource path (ruta del endpoint IPP, ej: `ipp/print`, `printers/label`)
- `ty` — Tipo/modelo de la impresora (ej: `Brother QL-820NWB`)
- `product` — Producto (alternativa a `ty`)

La URI final se construye como: `ipp://{ip}:{port}/{rp}`

#### Deduplicación

Una impresora puede aparecer en múltiples interfaces (eth0, wlan0) con la misma IP:puerto. Se deduplica por `hostname:port`.

#### Flujo completo (Linux)

```
discoverLinuxPrinters():
  1. avahi-browse _ipp._tcp → parsear → añadir con URI ipp://
  2. avahi-browse _ipps._tcp → parsear → añadir con URI ipps://
  3. lpstat -a → parsear → añadir (nombre de cola como URI)
  4. Deduplicar por URI
  5. Retornar DiscoveredPrinter[]
```

---

### Windows: Descubrimiento por escaneo IPP

#### Estrategia

Windows no tiene un equivalente directo a avahi-browse. La estrategia es:

1. **Obtener hosts conocidos** — Se lee la tabla ARP (`arp -a`) para encontrar dispositivos en la red local que han comunicado recientemente
2. **Probar endpoints IPP** — Para cada host, se envía una petición IPP `Get-Printer-Attributes` mínima
3. **Si responde** — Se registra como impresora descubierta

#### Comando ARP

```bash
arp -a
```

Salida típica en Windows:
```
Interface: 192.168.1.5 --- 0x4
  Internet Address      Physical Address      Type
  192.168.1.1            aa-bb-cc-dd-ee-ff     dynamic
  192.168.1.50           11-22-33-44-55-66     dynamic
  192.168.1.255          ff-ff-ff-ff-ff-ff     static
```

Se extraen las IPs y se filtran:
- Se excluyen direcciones `.0` (network) y `.255` (broadcast)
- Se excluye `255.255.255.255`

#### Endpoints probados

Para cada host, se prueban en orden (y se para al primer éxito):

| Puerto | Path | Descripción |
|--------|------|-------------|
| 631 | `/ipp/print` | Endpoint IPP estándar |
| 631 | `/ipp/printer` | Alternativa común |
| 631 | `/` | Fallback genérico |

#### Probe IPP

La prueba consiste en enviar una petición `Get-Printer-Attributes` mínima:
- Si la impresora responde con status 0x0000-0x00FF → es una impresora válida
- Si no responde o devuelve error HTTP → no es una impresora (o no acepta IPP)
- Timeout configurable (default 2000ms por probe)

#### Control de concurrencia

Las pruebas se ejecutan en batches con concurrencia limitada (default: 20 simultáneos) para no saturar la red. Dentro de cada batch, los hosts se prueban en paralelo, pero las paths de un mismo host:port se prueban secuencialmente (para con el primer éxito).

#### Flujo completo (Windows)

```
discoverWindowsPrinters(config):
  1. Obtener targets:
     - Si config.targets proporcionados → usar esos
     - Si no → arp -a → extraer IPs → filtrar broadcast/network
  2. Generar lista de probes: host × port × path
  3. Agrupar por host:port (probar paths secuencialmente)
  4. Para cada grupo (con concurrency limit):
     a. Probar paths en orden
     b. Si una responde → registrar como impresora
     c. Si ninguna responde → descartar
  5. Retornar DiscoveredPrinter[]
```

---

### Inyección de dependencias

El módulo usa interfaces inyectables para testabilidad:

#### `DiscoveryCommandExecutor`

```typescript
interface DiscoveryCommandExecutor {
  exec(command: string): Promise<{ stdout: string; stderr: string }>
}
```

Usada por ambas plataformas para ejecutar comandos del sistema (`avahi-browse`, `lpstat`, `arp`).

#### `DiscoveryHttpProbe`

```typescript
interface DiscoveryHttpProbe {
  probe(hostname: string, port: number, path: string, timeoutMs: number): Promise<string | null>
}
```

Usada por Windows para verificar si un host tiene una impresora IPP escuchando.

---

### Configuración del escaneo (`SubnetScanConfig`)

```typescript
interface SubnetScanConfig {
  targets?: string[]       // IPs a escanear (auto-detect si vacío)
  ports?: number[]         // Puertos (default: [631])
  paths?: string[]         // Paths IPP (default: ['/ipp/print', '/ipp/printer', '/'])
  timeoutMs?: number       // Timeout por probe (default: 2000ms)
  concurrency?: number     // Probes simultáneos (default: 20)
}
```

---

### Integración con los backends

#### CupsBackend (antes vs después)

**Antes:**
```typescript
async discover(): Promise<DiscoveredPrinter[]> {
  const { stdout } = await this.cmd.exec('lpstat -a')
  return parseLpstatDiscovery(stdout)
}
```

**Después:**
```typescript
async discover(): Promise<DiscoveredPrinter[]> {
  const discoveryExecutor = { exec: (cmd) => this.cmd.exec(cmd) }
  return discoverLinuxPrinters(discoveryExecutor)
}
```

Ahora descubre tanto impresoras de red (avahi) como locales (lpstat), con deduplicación.

#### IppBackend (antes vs después)

**Antes:**
```typescript
async discover(): Promise<DiscoveredPrinter[]> {
  return [] // Deferred to Task 12.6
}
```

**Después:**
```typescript
async discover(): Promise<DiscoveredPrinter[]> {
  const probe = { ... } // Usa this.transport para probar endpoints
  const executor = { ... } // Para leer tabla ARP
  return discoverWindowsPrinters({}, executor, probe)
}
```

Ahora escanea la subred buscando impresoras IPP activas.

---

### Funciones exportadas

| Función | Descripción |
|---------|-------------|
| `parseAvahiBrowse(output)` | Parsea salida de avahi-browse en `AvahiPrinter[]` |
| `discoverLinuxPrinters(executor?)` | Descubrimiento completo en Linux (avahi + lpstat) |
| `getSubnetTargets(executor?)` | Obtiene IPs de la tabla ARP |
| `discoverWindowsPrinters(config?, executor?, probe?)` | Descubrimiento completo en Windows |

---

### Tests (29 tests, todos pasan)

```
✓ parseAvahiBrowse (8 tests)
  - single entry, multiple entries, deduplication by host:port,
    ignores non-resolved lines, empty output, non-standard ports,
    missing TXT fields, invalid port

✓ discoverLinuxPrinters (7 tests)
  - discovers via avahi-browse _ipp._tcp
  - combines avahi and lpstat without duplicates
  - discovers IPPS printers with ipps:// URI
  - falls back to lpstat when avahi-browse fails
  - returns empty when all methods fail
  - handles empty avahi output
  - uses rp from TXT record for URI path

✓ getSubnetTargets (5 tests)
  - extracts IPs from ARP table
  - deduplicates IPs
  - returns empty on command failure
  - returns empty for empty ARP output
  - excludes .0 network addresses

✓ discoverWindowsPrinters (9 tests)
  - discovers printers by probing targets
  - discovers multiple printers on different hosts
  - returns empty when no targets found and ARP fails
  - returns empty when no printers respond
  - auto-detects targets from ARP table
  - deduplicates results from same host:port
  - respects concurrency limit
  - handles probe errors gracefully
```

---

### Verificación

```bash
# Tests del módulo de descubrimiento:
$ npx vitest run src/main/printing/__tests__/printer-discovery.test.ts
# ✓ Test Files  1 passed (1)
# ✓ Tests  29 passed (29)

# Tests del CupsBackend (actualizado):
$ npx vitest run src/main/printing/__tests__/cups-backend.test.ts
# ✓ Test Files  1 passed (1)
# ✓ Tests  46 passed (46)

# Tests del IppBackend (integrado):
$ npx vitest run src/main/printing/__tests__/ipp-backend.test.ts
# ✓ Test Files  1 passed (1)
# ✓ Tests  50 passed (50)

# Suite completa de printing:
$ npx vitest run src/main/printing/
# ✓ Test Files  10 passed (10)
# ✓ Tests  301 passed (301)

# Diagnósticos del IDE:
# ✓ printer-discovery.ts — No diagnostics found
# ✓ cups-backend.ts — No diagnostics found
# ✓ ipp-backend.ts — No diagnostics found
```

---

### Gestión de múltiples impresoras

El sistema soporta hasta 3 impresoras simultáneas, cada una con un rol asignado:

| Target | Rol | Qué imprime |
|--------|-----|-------------|
| `printer1` | Impresora sellos izquierda | Etiquetas del modelo 1 (55×25mm) |
| `printer2` | Impresora sellos derecha | Etiquetas del modelo 2 (55×25mm) |
| `ticket` | Impresora tickets | Facturas simplificadas (78mm×variable) |

El flujo de asignación es:
1. `discover()` encuentra impresoras disponibles en la red
2. El usuario (o la configuración) asigna cada impresora a un target
3. `PrinterManager.setAssignments({ printer1: uri1, printer2: uri2, ticket: uri3 })`
4. El enrutamiento automático se encarga del resto en cada venta

Si solo se tiene una impresora de sellos, se puede asignar la misma URI a `printer1` y `printer2`.

---

### Relación con el legacy

| Aspecto | Legacy (`printer_backend.py`) | Nuevo (`printer-discovery.ts`) |
|---------|-------------------------------|-------------------------------|
| Linux | `subprocess(['avahi-browse'])` en Python | `exec('avahi-browse -tpr ...')` en Node.js |
| Windows | Hardcoded IP de impresora | Escaneo ARP + probing IPP |
| Red | Solo impresoras pre-configuradas | Descubrimiento automático |
| Protocolos | Solo _ipp._tcp | _ipp._tcp + _ipps._tcp |
| Fallback | Sin fallback | avahi → lpstat (Linux) |
| Timeout | Sin timeout | Configurable (2s default) |
| Concurrencia | Secuencial | Batches paralelos (20 max) |

---

### Requisitos validados

| Requisito | Aspecto cubierto |
|-----------|-----------------|
| Req 9.1 | Descubrimiento CUPS en Linux vía avahi-browse + lpstat |
| Req 9.2 | Descubrimiento IPP en Windows vía subnet scan |
| Req 9.3 | Auto-detección: CupsBackend usa discoverLinux, IppBackend usa discoverWindows |
| Req 9.4 | Misma interfaz `DiscoveredPrinter[]` independiente de la plataforma |

---

### Próximos pasos

- **Tarea 12.7**: Property-based tests para enrutamiento determinista (Property 9)
- **Tarea 12.8**: Test manual en Windows con impresora Epson real
- **Integración IPC**: Actualizar `printer:getStatus` en `printer.handlers.ts` para usar `PrinterManager.discover()` y devolver impresoras reales
