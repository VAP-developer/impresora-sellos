# Task 9: Vista Imprimir (Perfiles y Eventos)

## Resumen

Esta tarea implementa la vista **ImprimirView** — la pantalla de configuración de perfiles de venta, eventos y tarifas. Replica fielmente el layout y la funcionalidad del legacy `ImprimirView.vue`, permitiendo al vendedor seleccionar el perfil activo, gestionar los 8 eventos disponibles, editar nombres de perfiles y configurar precios de tarifas. Al guardar, los cambios se persisten vía IPC y la app navega al Kiosko con la nueva configuración activa.

---

## Progreso

| # | Subtarea | Estado |
|---|----------|--------|
| 9.1 | Crear componente `PerfilSection.tsx` (selector de perfil activo 1-6) | ✅ Completada |
| 9.2 | Crear componente `EventoSection.tsx` (selector de evento activo 0-7, previsualización de modelos) | ✅ Completada |
| 9.3 | Crear componente `EventoEditor.tsx` (edición de datos del evento seleccionado) | ✅ Completada |
| 9.4 | Crear componente `PerfilesSection.tsx` (edición de nombres de perfiles) | ✅ Completada |
| 9.5 | Crear componente `TarifaSection.tsx` (edición de precios por tarifa + plantillas estándar/américa/andorra) | ✅ Completada |
| 9.6 | Implementar botón Guardar + Activar que persiste y navega | ✅ Completada |
| 9.7 | Verificar que cambios de evento/perfil se reflejan en Kiosko | ✅ Completada |

---

## Arquitectura de la Vista

```
ImprimirView.tsx (vista principal)
├── Estado local: selectedPerfil, selectedEvento, localEventos, localProfileNames, localPrecios
├── Sync con config store via useEffect (carga inicial + cambios externos)
├── handleSave() → updateImprimir() → navigate('/kiosko')
│
├── PerfilSection.tsx
│   └── Select dropdown (perfiles 1-6)
│
├── EventoSection.tsx
│   ├── Select dropdown (eventos 0-7, bloqueado si rollos instalados)
│   └── Previsualización de modelos (carga imágenes vía IPC)
│
├── EventoEditor.tsx
│   ├── Radio buttons (seleccionar evento a editar)
│   └── Formulario: nombre, feria, lugar, fecha, localidad, motivoi, motivod
│
├── PerfilesSection.tsx (collapsible)
│   └── 6 inputs (solo perfil 4 es editable)
│
└── TarifaSection.tsx (collapsible)
    ├── Radio buttons (plantilla: estándar/américa/andorra)
    └── 6 inputs numéricos (A, A2, B, C, TiraA, Tira4T)
```

---

## Detalle de lo realizado (9.1)

### ¿Qué se hizo?

Se creó el componente **PerfilSection** que muestra un selector desplegable para elegir el perfil de venta activo (1-6). Replica la sección "PERFIL - MODO DE VENTA" del legacy.

### Archivo creado

| Archivo | Descripción |
|---------|-------------|
| `src/renderer/src/components/imprimir/PerfilSection.tsx` | Selector de perfil activo |

### Props

```typescript
interface PerfilSectionProps {
  sello: SelloConfig         // Config actual con nombres de perfiles
  selectedPerfil: number     // Perfil seleccionado (1-6)
  onPerfilChange: (perfil: number) => void  // Callback al cambiar
}
```

### Funcionalidad

- **Select con 6 opciones** derivadas de `sello.nperfil1`..`sello.nperfil6`
- **Fallback** a "Perfil N" si el nombre está vacío
- **Validación**: solo acepta valores entre 1 y 6
- **Header dorado** (`rgb(255,192,0)`) consistente con las otras secciones

### Mapeo con el legacy

| Legacy | Nuevo |
|--------|-------|
| `<select v-model="elperfil">` con opciones dinámicas | `<select value={selectedPerfil} onChange={handleChange}>` |
| Label "Ir a Menú MÁQUINA y GUARDAR" (texto rojo) | Idéntico, replicado |

### Requisitos validados

- **Req 13.1**: Soporta hasta 6 perfiles con nombres editables
- **Req 13.4**: Cambiar perfil afecta el Límite_Importe (FERIA usa `limiteImporte`, otros usan `NUEVOlimiteImporte`)

---

## Detalle de lo realizado (9.2)

### ¿Qué se hizo?

Se creó el componente **EventoSection** que muestra el selector de evento activo (0-7) y previsualiza los dos modelos (imágenes de fondo de las etiquetas) del evento seleccionado. Cuando los rollos están instalados (BLOQUEADO), el selector se deshabilita para evitar mezcla de configuraciones.

### Archivo creado

| Archivo | Descripción |
|---------|-------------|
| `src/renderer/src/components/imprimir/EventoSection.tsx` | Selector + previsualización de evento |

### Props

```typescript
interface EventoSectionProps {
  sello: SelloConfig          // Config con datos de eventos
  ticket: TicketConfig        // Config ticket (para estado bloqueado)
  selectedEvento: number      // Evento seleccionado (0-7)
  onEventoChange: (evento: number) => void  // Callback al cambiar
}
```

### Funcionalidad

1. **Header** muestra estado: "EVENTO: BLOQUEADO" o "EVENTO: DESBLOQUEADO"
2. **Select con 8 opciones** (eventos 0-7), deshabilitado si `ticket.bloqueado === 'BLOQUEADO'`
3. **Botón ACTIVAR** visible solo cuando desbloqueado
4. **Texto del evento** (feria + lugar) centrado debajo del selector
5. **Previsualización de modelos**: Dos cajas de 350×160px que cargan las imágenes de `motivoi` y `motivod` vía IPC (`getImageByName`)
6. **Overlay**: Fecha y localidad superpuestas en cada previsualización (replica el layout de la etiqueta real)
7. **Cancelación de efectos**: Usa flag `cancelled` para evitar actualizaciones de estado en componentes desmontados

### Carga de imágenes

```typescript
useEffect(() => {
  let cancelled = false
  async function loadImages() {
    const img = await getImageByName(currentEvento.motivoi)
    if (!cancelled) setModelo1Url(img?.url ?? null)
    // ... idem para motivod
  }
  loadImages()
  return () => { cancelled = true }
}, [currentEvento.motivoi, currentEvento.motivod])
```

### Requisitos validados

- **Req 5**: Bloqueo de evento cuando rollos instalados
- **Req 13.2**: Soporta hasta 8 eventos
- **Req 13.3**: Cambiar evento actualiza modelos en Kiosko

---

## Detalle de lo realizado (9.3)

### ¿Qué se hizo?

Se creó el componente **EventoEditor** que permite editar los datos de cualquiera de los 8 eventos. El usuario selecciona un evento con radio buttons y edita sus campos: nombre, feria, lugar, fecha, localidad, motivo izquierda y motivo derecha.

### Archivo creado

| Archivo | Descripción |
|---------|-------------|
| `src/renderer/src/components/imprimir/EventoEditor.tsx` | Editor de datos de eventos |

### Props

```typescript
interface EventoEditorProps {
  eventos: EventoData[]       // Array de 8 eventos
  onEventoDataChange: (index: number, field: keyof EventoData, value: string) => void
}
```

### Funcionalidad

1. **Radio buttons** para seleccionar evento a editar (+ opción "Ninguno")
2. **Formulario** con 7 campos de texto:
   - `nevento` — Nombre del evento (texto grande rojo, como el legacy)
   - `nferia` — Nombre de la feria (para el ticket)
   - `nlugar` — Lugar (para el ticket)
   - `fecha` — Fechas (para la etiqueta)
   - `localidad` — Localidad (para la etiqueta)
   - `motivoi` — Nombre de imagen motivo izquierda
   - `motivod` — Nombre de imagen motivo derecha
3. **Previsualización de motivos**: Dos cajas de 300×140px con la imagen cargada vía IPC
4. **Estado local**: `editingEvent` controla qué evento se está editando (-1 = ninguno)

### Mapeo con el legacy

| Legacy | Nuevo |
|--------|-------|
| Inputs por separado para cada `nevento0`..`nevento7` | Array de EventoData con selección por radio button |
| Campos flat `motivoi0`..`motivoi7` | Campo `motivoi` en `EventoData[index]` |
| Sin previsualización de motivos en editor | Previsualización de imágenes añadida |

### Requisitos validados

- **Req 13.2**: Datos editables por cada evento (nombre, feria, lugar, modelos, fecha, localidad)

---

## Detalle de lo realizado (9.4)

### ¿Qué se hizo?

Se creó el componente **PerfilesSection** con una sección colapsable para editar los nombres de los 6 perfiles. En el sistema legacy (y en este), solo el perfil 4 es realmente editable; los demás tienen nombres fijos.

### Archivo creado

| Archivo | Descripción |
|---------|-------------|
| `src/renderer/src/components/imprimir/PerfilesSection.tsx` | Editor de nombres de perfiles (collapsible) |

### Props

```typescript
interface PerfilesSectionProps {
  sello: SelloConfig
  onProfileNameChange: (profileIndex: number, value: string) => void
}
```

### Funcionalidad

1. **Checkbox toggle** para expandir/colapsar la sección
2. **6 inputs de texto**, uno por perfil
3. **Perfiles read-only** (1, 2, 3, 5, 6): deshabilitados con fondo gris
4. **Perfil 4**: único editable por el usuario
5. **Accesibilidad**: `aria-expanded`, `aria-controls`, `role="region"`

### Perfiles y sus nombres

| Perfil | Nombre por defecto | Editable |
|--------|-------------------|----------|
| 1 | Filatelia | ❌ |
| 2 | Esporádicos | ❌ |
| 3 | SPDE | ❌ |
| 4 | *(vacío)* | ✅ |
| 5 | Abono/Envío | ❌ |
| 6 | FERIA | ❌ |

### Requisitos validados

- **Req 13.1**: 6 perfiles con nombres editables (solo perfil 4 en la práctica)

---

## Detalle de lo realizado (9.5)

### ¿Qué se hizo?

Se creó el componente **TarifaSection** con una sección colapsable para editar los precios de cada tarifa. Incluye un selector de plantilla (Estándar, América, Andorra) que cambia las etiquetas de los campos de precio.

### Archivo creado

| Archivo | Descripción |
|---------|-------------|
| `src/renderer/src/components/imprimir/TarifaSection.tsx` | Editor de precios + plantillas |

### Props

```typescript
interface TarifaSectionProps {
  precios: PreciosConfig
  onPreciosChange: (field: keyof PreciosConfig, value: number) => void
}
```

### Funcionalidad

1. **Checkbox toggle** para expandir/colapsar
2. **Selector de plantilla** (radio buttons):
   - **Estándar**: A, A2, B, C
   - **América**: A, A2, B, D
   - **Andorra**: A, B, C, D
3. **4 inputs numéricos** para tarifas simples (campos A, A2, B, C del modelo)
4. **2 inputs numéricos** fijos para tiras (Tira Tarifa A, Tira 4 Tarifas)
5. **Validación**: Valores negativos o no numéricos se normalizan a 0
6. **Step 0.01**: Permite centimos de euro

### Plantillas de tarifas

```typescript
const TARIFA_LABELS: Record<TarifaTemplate, [string, string, string, string]> = {
  standard: ['Tarifa A', 'Tarifa A2', 'Tarifa B', 'Tarifa C'],
  america:  ['Tarifa A', 'Tarifa A2', 'Tarifa B', 'Tarifa D'],
  andorra:  ['Tarifa A', 'Tarifa B', 'Tarifa C', 'Tarifa D']
}
```

### Requisitos validados

- **Req 12.4**: Precios de tarifas son valores numéricos positivos
- **Req 13**: Configuración de tarifas como parte de la vista Imprimir

---

## Detalle de lo realizado (9.6)

### ¿Qué se hizo?

Se implementó la lógica completa de **Guardar + Activar** en `ImprimirView.tsx`. Al pulsar el botón, la vista:
1. Recopila todo el estado local (perfil, evento, eventos editados, nombres de perfiles, precios)
2. Construye el payload para `updateImprimir` del config store
3. Persiste vía IPC (main process → SQLite)
4. Navega al Kiosko con la configuración actualizada

### Archivo creado/modificado

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/renderer/src/views/ImprimirView.tsx` | Creado | Vista completa con toda la orquestación |

### Flujo de handleSave()

```
handleSave()
  ├── Determinar elnperfil desde localProfileNames[selectedPerfil]
  ├── Derivar modelo1/modelo2 desde localEventos[selectedEvento].motivoi/motivod
  ├── Construir selloUpdate (Partial<SelloConfig>):
  │   ├── elperfil, elnperfil, elevento, elnevento
  │   ├── feria, lugar, modelo1, modelo2
  │   ├── nperfil1..nperfil6
  │   └── eventos (array completo de 8 EventoData)
  ├── Construir preciosUpdate (PreciosConfig completo)
  ├── await updateImprimir({ sello: selloUpdate, precios: preciosUpdate })
  ├── navigate('/kiosko')
  └── catch → setSaveError(message)
```

### Estado local de ImprimirView

| Estado | Tipo | Sincronización |
|--------|------|----------------|
| `selectedPerfil` | `number` | Inicializado desde `config.sello.elperfil` |
| `selectedEvento` | `number` | Inicializado desde `config.sello.elevento` |
| `localEventos` | `EventoData[]` | Synced via useEffect cuando `config.sello.eventos` cambia |
| `localProfileNames` | `Record<number, string>` | Synced via useEffect desde `nperfil1..6` |
| `localPrecios` | `PreciosConfig` | Synced via useEffect desde `config.precios` |

### Botones de acción

| Botón | Posición | Acción |
|-------|----------|--------|
| "GUARDAR e ir al KIOSKO" | Header (arriba) | `handleSave()` |
| "Cancelar" | Footer (izquierda) | `navigate('/home')` |
| "GUARDAR + ACTIVAR" | Footer (derecha) | `handleSave()` |

### Mapeo con el legacy ImprimirView.vue

| Legacy | Nuevo |
|--------|-------|
| `guardar()` que actualiza Meteor Collections | `handleSave()` que llama `updateImprimir()` |
| `Meteor.call('Config.updateSello', ...)` | `ipc.updateImprimir({ sello, precios })` |
| `this.$router.push('/kiosko')` | `navigate('/kiosko')` |
| Estado reactivo Vue 3 (composables) | Estado local React + Zustand config store |
| Sincronización automática Meteor | `useEffect` que sincroniza desde config store |

### Decisiones de diseño

#### ¿Por qué estado local + sync desde store?

La vista Imprimir necesita un "borrador" editable que no se persista hasta que el usuario pulse Guardar. Usar estado local permite:
- Editar sin afectar al Kiosko hasta confirmar
- Cancelar descartando cambios (simplemente navegar sin guardar)
- Detectar cambios externos (otro proceso actualiza config) y sincronizar

#### ¿Por qué dos botones de Guardar?

El legacy tiene un botón arriba y otro abajo de la vista. Es una vista larga con scroll, así que tener Guardar accesible tanto al inicio como al final mejora la experiencia del vendedor.

---

## Detalle de lo realizado (9.7)

### ¿Qué se hizo?

Se creó un test de integración que verifica la conexión entre la vista Imprimir y el Kiosko a nivel de stores. Confirma que los cambios de evento y perfil guardados desde Imprimir se reflejan correctamente en los cálculos del Kiosko.

### Archivo creado

| Archivo | Descripción |
|---------|-------------|
| `src/renderer/src/stores/__tests__/imprimir-kiosko-integration.test.ts` | 12 tests de integración |

### Categorías de tests

#### 1. Cambiar evento activo → modelos en Kiosko (4 tests)

| Test | Qué verifica |
|------|--------------|
| Evento 0 activo → modelos CornamusaAzul / PlazaMayorNar | Los motivos del evento se reflejan como modelo1/modelo2 |
| Cambiar a evento 1 → GiraldaSevilla / TorredelOro | `updateImprimir` actualiza los modelos en el store |
| Cambiar a evento 2 → SagradaFamilia / CasaBatllo | Funciona con cualquier evento (0-7) |
| Evento 1 → fecha "10-13 mayo 2025" + localidad "Sevilla" | Datos de etiqueta accesibles desde Kiosko |

#### 2. Cambiar perfil activo → límite en Kiosko (4 tests)

| Test | Qué verifica |
|------|--------------|
| Perfil 6 (FERIA) → usa `limiteImporte` (399.99€) | La función `calcLimite` devuelve el límite correcto |
| Perfil 1 (Filatelia) → usa `NUEVOlimiteImporte` (150€) | Perfiles non-FERIA usan el nuevo límite |
| Cambio de perfil afecta `calcAllLimits` en el carrito | Los límites por tarifa se recalculan con el nuevo importe |
| Perfiles 1-5 todos usan `NUEVOlimiteImporte` | Validación exhaustiva de todos los perfiles |

#### 3. Persistencia de config a través del store (4 tests)

| Test | Qué verifica |
|------|--------------|
| `updateImprimir` actualiza el store atómicamente | Perfil, evento, modelos y precios se actualizan en una sola operación |
| Precios nuevos afectan el total del Kiosko | `calcTotal` usa los precios actualizados |
| `onConfigChange` callback actualiza store | Cambios externos se propagan correctamente |
| Error en save no corrompe el estado del Kiosko | Cantidades y configuración intactas tras error |

### Ejecución

```bash
$ npx vitest run src/renderer/src/stores/__tests__/imprimir-kiosko-integration.test.ts

 ✓ Imprimir → Kiosko Integration (12 tests)
   ✓ Cambiar evento activo actualiza modelos en Kiosko (4 tests)
   ✓ Cambiar perfil activo actualiza límite en Kiosko (4 tests)
   ✓ Cambios de config persisten y son accesibles desde ambas vistas (4 tests)

 Test Files  1 passed (1)
      Tests  12 passed (12)
```

Suite completa de stores (sin regresiones):

```bash
$ npx vitest run src/renderer/src/stores/

 Test Files  5 passed (5)
      Tests  87 passed (87)
```

### Requisitos validados

- **Req 13.3**: Cambiar evento actualiza modelos en Kiosko
- **Req 13.4**: Cambiar perfil ajusta Límite_Importe según corresponda

---

## Estructura de archivos creados en Task 9

```
src/renderer/src/
├── views/
│   └── ImprimirView.tsx                          # Vista principal (9.6)
├── components/
│   └── imprimir/
│       ├── PerfilSection.tsx                     # Selector de perfil (9.1)
│       ├── EventoSection.tsx                     # Selector + preview de evento (9.2)
│       ├── EventoEditor.tsx                      # Editor de datos de evento (9.3)
│       ├── PerfilesSection.tsx                   # Editor de nombres de perfiles (9.4)
│       └── TarifaSection.tsx                     # Editor de precios + plantillas (9.5)
└── stores/
    └── __tests__/
        └── imprimir-kiosko-integration.test.ts   # Tests de integración (9.7)
```

---

## Mapeo completo con el legacy ImprimirView.vue

| Sección Legacy | Componente Nuevo | Notas |
|----------------|-----------------|-------|
| `<select v-model="elperfil">` | `PerfilSection.tsx` | Misma UI, controlado por prop |
| Bloque EVENTO + previews | `EventoSection.tsx` | Añade carga async de imágenes |
| Campos `nevento0`..`nevento7` (flat) | `EventoEditor.tsx` | Normalizado a array `EventoData[]` |
| Campos `nperfil1`..`nperfil6` | `PerfilesSection.tsx` | Collapsible, solo perfil 4 editable |
| Campos de precio + botones plantilla | `TarifaSection.tsx` | Collapsible, 3 plantillas con radio |
| Botón `guardar()` | `ImprimirView.handleSave()` | Misma lógica: persist + navigate |
| `Meteor.subscribe('config')` | `useConfigStore + useEffect` sync | Zustand reactivo en vez de DDP |

---

## Flujo de datos completo

```
┌─────────────────────────────────────────────────────────────────────┐
│  ImprimirView (estado local editable)                               │
│  ├── selectedPerfil, selectedEvento                                 │
│  ├── localEventos[0..7]                                            │
│  ├── localProfileNames{1..6}                                       │
│  └── localPrecios{A, A2, B, C, TA, T4}                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ handleSave()
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  config.store.ts → updateImprimir({ sello, precios })               │
│  ├── ipc.updateImprimir() → main process → SQLite                   │
│  ├── ipc.getConfig() → refresh canonical state                      │
│  └── set({ config: updatedConfig })                                 │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ Zustand reactivity
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  KioskoView (lee desde config store)                                 │
│  ├── config.sello.modelo1 / modelo2 → StampModels.tsx               │
│  ├── config.sello.elperfil → calcLimite() → CartControls.tsx        │
│  ├── config.precios → calcTotal() / calcAllLimits()                 │
│  └── config.sello.eventos[elevento] → fecha, localidad              │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Requisitos cubiertos por Task 9

| Requisito | Criterios verificados |
|-----------|----------------------|
| Req 5 (Bloqueo de Evento) | Selector deshabilitado cuando `bloqueado === 'BLOQUEADO'` |
| Req 12.4 (Validación precios) | Inputs numéricos con normalización a 0 para negativos/NaN |
| Req 13.1 (6 perfiles editables) | PerfilSection + PerfilesSection con los 6 perfiles |
| Req 13.2 (8 eventos editables) | EventoSection + EventoEditor con datos completos |
| Req 13.3 (Evento → modelos Kiosko) | Test de integración confirma propagación |
| Req 13.4 (Perfil → límite Kiosko) | Test de integración confirma cálculo correcto |

---

## Dependencias utilizadas

| Paquete | Uso en Task 9 |
|---------|---------------|
| `react` | useState, useCallback, useEffect |
| `react-router-dom` | useNavigate (Guardar → /kiosko, Cancelar → /home) |
| `zustand` | useConfigStore (lectura de config + updateImprimir) |
| `vitest` | Tests unitarios e integración |

---

## Notas

- La vista Imprimir usa **estado local** como borrador. Los cambios no afectan al Kiosko hasta que el vendedor pulse Guardar.
- Las **imágenes de motivos** se cargan asincrónicamente vía IPC. Si una imagen no existe, se muestra "Sin imagen" (placeholder gris).
- El **bloqueo de evento** (Req 5) previene cambios de evento cuando hay rollos instalados, evitando inconsistencias entre configuración y papel cargado.
- Las **plantillas de tarifa** (estándar/américa/andorra) solo cambian las etiquetas visuales de los campos; los precios subyacentes siguen siendo los mismos campos `tarifaA`, `tarifaA2`, `tarifaB`, `tarifaC`.
- El botón "GUARDAR + ACTIVAR" y "GUARDAR e ir al KIOSKO" ejecutan la misma acción (`handleSave`). Se mantienen ambos para replicar el layout del legacy que tenía el botón accesible tanto arriba como abajo de la vista.
