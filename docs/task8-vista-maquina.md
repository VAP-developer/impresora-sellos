# Task 8: Vista Máquina (Configuración)

## Resumen

Esta tarea implementa la vista **MaquinaView**, la pantalla de configuración de la máquina donde los vendedores editan los parámetros del código de etiqueta, los datos del ticket/factura, la gestión de rollos de etiquetas y las tiras especiales. Replica la funcionalidad completa del legacy `MaquinaView.vue`.

La vista se compone de varias secciones colapsables:
- **CodigoSection**: Código de etiqueta (modo, mes, país, año, máquina, cliente, producto)
- **TicketSection**: Datos del ticket/factura simplificada (feria, lugar, empresa, CIF, textos legales, límites, fecha/hora)
- **RollosSection**: Gestión de rollos de etiquetas (existencias, quitar rollo, instalar rollo, bloqueado/desbloqueado)
- **TirasSection**: Tiras especiales (precios, activar/desactivar por modelo)

Además incluye botones de acción globales (Guardar, Cancelar, Exportar XLS).

---

## Progreso

| # | Subtarea | Estado |
|---|----------|--------|
| 8.1 | Crear componente CodigoSection.tsx (modo, mes, país, año, máquina, cliente, producto) | ✅ Completada |
| 8.2 | Crear componente TicketSection.tsx (feria, lugar, empresa, CIF, textos legales, límites, fecha/hora) | ✅ Completada |
| 8.3 | Crear componente RollosSection.tsx (existencias, quitar rollo, instalar rollo, bloqueado/desbloqueado) | ✅ Completada |
| 8.4 | Crear componente TirasSection.tsx (precios tiras especiales, activar/desactivar por modelo) | ✅ Completada |
| 8.5 | Implementar botón Guardar que persiste configuración vía IPC | ✅ Completada |
| 8.6 | Implementar botón Exportar XLS | ✅ Completada |
| 8.7 | Verificar que los cambios guardados se reflejan en la vista Kiosko | ⬜ Pendiente |

---

## Arquitectura general de la vista

```
MaquinaView (vista/página)
├── Header: "MÁQUINA" + botón Guardar + subtítulo "CÓDIGO - TICKET - ROLLOS"
├── CodigoSection (colapsable, fondo dorado)
│   ├── Modo (1 carácter)
│   ├── Mes (select: Auto/1-12)
│   ├── País (2 caracteres)
│   ├── Año (Auto/Manual + input numérico)
│   ├── Código Evento / máquina (4 caracteres)
│   ├── ID Cliente (sesión incremental, botones de reset)
│   └── ID Producto (solo lectura)
├── TicketSection (colapsable, fondo dorado)
│   ├── Cabecera ticket (feria, lugar)
│   ├── Empresa (nombre, CIF, CP)
│   ├── Pié del ticket (líneas 1-3)
│   ├── Tipo documento (título, título copia, límites)
│   ├── Fecha/hora (Auto/Manual)
│   ├── Copia ticket (S/N)
│   └── Master set (S/N)
├── Máximo Nº de Tickets (límite + reset)
├── RollosSection
│   ├── Rollos instalados (existencias, quitar)
│   ├── Instalar rollos (cantidad, desechadas)
│   └── Indicador Bloqueado/Desbloqueado
├── TirasSection (colapsable, fondo dorado)
│   ├── Precios tiras especiales (1, 2, 3 tiras)
│   └── Activar/desactivar por modelo (S/N)
└── Footer: Guardar + Cancelar + Exportar XLS
```

### Flujo de datos

```
                    ┌─────────────────────────┐
                    │      MaquinaView        │
                    │  (estado local del form) │
                    └────────────┬────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌────────────────┐    ┌────────────────┐    ┌────────────────┐
│ CodigoSection  │    │ TicketSection  │    │ RollosSection  │
│ props: codigo  │    │ props: ticket  │    │ props: ticket  │
│ onChange(...)  │    │ onChange(...)  │    │ onChange(...)  │
└────────────────┘    └────────────────┘    └────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │ onChange → actualiza estado local
                                 ▼
                    ┌─────────────────────────┐
                    │   Botón "Guardar"       │
                    │   → updateMaquina(IPC)  │
                    │   → persiste en SQLite  │
                    └─────────────────────────┘
```

**Patrón de formulario**: Las secciones reciben los datos como props y notifican cambios vía `onChange`. El estado local se acumula en `MaquinaView` y solo se persiste al pulsar "Guardar", replicando el comportamiento del legacy.

---

## Detalle de lo realizado (8.1)

### ¿Qué se hizo?

Se creó el componente **CodigoSection.tsx**, la primera sección colapsable de la vista Máquina que permite editar los parámetros del código de etiqueta. Replica exactamente la sección "CÓDIGO ETIQUETA" del legacy `MaquinaView.vue`.

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `src/renderer/src/components/maquina/CodigoSection.tsx` | Sección colapsable para edición del código de etiqueta |

### Interfaz de Props

```typescript
export interface CodigoSectionProps {
  /** Configuración actual del código, cargada desde el store. */
  codigo: CodigoConfig
  /** Callback para propagar cambios parciales al padre (MaquinaView). */
  onChange: (updated: Partial<CodigoConfig>) => void
}
```

### Campos editables

| Campo | Tipo input | Restricciones | Descripción |
|-------|-----------|---------------|-------------|
| Modo | `text` | maxLength=1, uppercase | Modo del código (P=Postal, F=Filatelia, etc.) |
| Mes | `select` | 0=Auto, 1-9 numérico, 10=O, 11=N, 12=D | Mes para el código. Auto usa el mes actual |
| País | `text` | maxLength=2, uppercase | Código de país (ES, AD, etc.) |
| Año | `select` + `number` | Auto/Manual; manual: 0-99 | Dos últimos dígitos del año |
| Código Evento | `text` | minLength=4, maxLength=4, uppercase | Identificador de la máquina/evento (CH17, FI01, etc.) |
| ID Cliente | `text` | ≥ 0, numérico | Contador de sesión incremental (0-9999) |
| ID Producto | `text` (disabled) | Solo lectura | Siempre "1" (no editable) |

### Estructura visual

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ☑ CÓDIGO ETIQUETA: Automático-CH17                           ← header dorado
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Modo    Mes     País    Año         Código Evento    ID Cliente  ID Prod.  │
│  [ P ]   [Auto▼] [ ES ]  [Auto▼]    [ CH17 ]        [ 1 ]       [ 1 ]     │
│                           [  25 ]    ┌─────────────┐  ┌────────────────┐    │
│                           (manual)   │(MD--)(FI--):│  │Reset ATM NAC=1 │    │
│                                      │NO imprime...│  │Reset i7 Moj=5001│   │
│                                      └─────────────┘  └────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Mapeo con el legacy MaquinaView.vue

| Legacy (Vue 3) | Nuevo (React) | Notas |
|----------------|---------------|-------|
| `<div @click="showCodigo = !showCodigo">` + checkbox | `<button onClick>` con `aria-expanded` | Misma UX, mejor accesibilidad |
| `v-model="modo"` + `maxlength="1"` | `value={modo}` + `onChange` + `maxLength={1}` | Controlled input |
| `<select v-model="mes">` con 13 opciones | `<select value={mes} onChange>` + `MES_OPTIONS.map()` | Mismas opciones (Auto, 1-12) |
| `v-model="pais"` + `maxlength="2"` | `value={pais}` + `handlePaisChange` (uppercase, 2 chars) | Normalización explícita |
| `<select v-model="modoAnnio">` (1=Auto, 2=Manual) | `<select>` + estado `modoAnnio` ('auto'\|'manual') | Mismo toggle, tipado más claro |
| `v-if="modoAnnio === '2'"` input numérico | `{modoAnnio === 'manual' && <input>}` | Render condicional |
| `v-model="nombre"` (minlength=4, maxlength=4) | `value={maquina}` + `handleMaquinaChange` | Campo "Código Evento" |
| `v-model="idCliente"` + botones reset | `value={cliente}` + `handleResetCliente(1\|5001)` | Mismos presets de reset |
| `:value="idProducto" disabled` | `value={producto} disabled` | Campo solo lectura |
| `@click="guardar"` en botones naranja (info) | `<p>` texto informativo (no clickeable) | Los botones naranja del legacy eran decorativos |

### Ejemplo de uso futuro (en MaquinaView)

```tsx
// src/renderer/src/views/MaquinaView.tsx (cuando se integre todo)
import CodigoSection from '@renderer/components/maquina/CodigoSection'
import { useConfigStore } from '@renderer/stores/config.store'

export default function MaquinaView(): JSX.Element {
  const config = useConfigStore((s) => s.config)
  const updateMaquina = useConfigStore((s) => s.updateMaquina)

  // Estado local del formulario
  const [codigoChanges, setCodigoChanges] = useState<Partial<CodigoConfig>>({})

  const handleCodigoChange = (partial: Partial<CodigoConfig>) => {
    setCodigoChanges((prev) => ({ ...prev, ...partial }))
  }

  const handleGuardar = async () => {
    await updateMaquina({
      ticket: { /* cambios de ticket */ },
      codigo: { ...config!.codigo, ...codigoChanges }
    })
  }

  if (!config) return <p>Cargando...</p>

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <CodigoSection codigo={config.codigo} onChange={handleCodigoChange} />
      {/* TicketSection, RollosSection, TirasSection... */}
      <button onClick={handleGuardar}>Guardar</button>
    </div>
  )
}
```

### Decisiones de diseño

#### ¿Por qué props + onChange en lugar de acceso directo al store?

El patrón "formulario controlado por el padre" tiene varias ventajas:

1. **Guardar explícito**: Los cambios no se persisten hasta que el vendedor pulsa "Guardar". Esto permite cancelar ediciones sin efectos secundarios. Es el mismo patrón del legacy.
2. **Composición**: Cada sección es independiente y testeable sin mock del store.
3. **Atomicidad**: Al guardar, se envía un solo `updateMaquina()` con todos los cambios de todas las secciones a la vez, garantizando consistencia.

#### ¿Por qué estado local + useEffect para sincronizar?

El componente necesita:
- **Estado local** para que los inputs sean responsivos (no esperar al roundtrip IPC para cada keystroke).
- **useEffect** con `[codigo]` como dependencia para resincronizar cuando la config se actualiza externamente (ej: si otro proceso modifica la BD y el store se refresca vía `onChange` listener).

Si solo usáramos props directamente como `value`, los inputs no se podrían editar sin que el padre actualizara la prop en cada onChange (lo cual requiere que `MaquinaView` mantenga un copy completo del estado).

La combinación estado local + propagación permite responsividad inmediata + sincronización eventual.

#### ¿Por qué el header es un `<button>` y no un `<div @click>`?

El legacy usaba `<div @click>` para el toggle de las secciones colapsables. Esto no es accesible con teclado (no recibe focus, no responde a Enter/Space). Un `<button>` nativo:
- Es focuseable por defecto
- Responde a Enter y Space automáticamente
- Puede llevar `aria-expanded` para indicar el estado
- Pasa auditorías de accesibilidad

#### ¿Por qué los botones naranja son ahora texto informativo y no botones?

En el legacy, las dos líneas "(MD--)(FI--): NO imprime LOGO ni TICKET por TIRA" estaban dentro de `<button @click="guardar">`. Pero su función real era informativa — explicar el comportamiento de ciertos códigos de evento. No tenía sentido que guardar se disparara al clickearlos. En el nuevo diseño son `<p>` descriptivos con el mismo fondo naranja visual, separando correctamente la función informativa de la acción de guardado.

### Estado interno del componente

| Estado | Tipo | Inicialización | Descripción |
|--------|------|----------------|-------------|
| `collapsed` | boolean | `true` | Sección colapsada por defecto |
| `modo` | string | `codigo.modo` | Carácter de modo (P, F, etc.) |
| `mes` | number | `codigo.mes` | Mes seleccionado (0=auto, 1-12) |
| `pais` | string | `codigo.pais` | Código de país |
| `modoAnnio` | 'auto' \| 'manual' | derivado de `codigo.annio` | Toggle auto/manual para año |
| `annioManual` | string | `codigo.annio` si no es 'auto' | Valor manual del año |
| `maquina` | string | `codigo.maquina` | Código evento (4 chars) |
| `cliente` | string | `String(codigo.cliente)` | ID sesión como string para input |
| `producto` | string | `String(codigo.producto)` | Producto (solo lectura) |

### Validaciones aplicadas

| Campo | Validación | Comportamiento |
|-------|-----------|----------------|
| Modo | Max 1 char | Se trunca + uppercase |
| País | Max 2 chars | Se trunca + uppercase |
| Máquina | Max 4 chars | Se trunca + uppercase |
| Año manual | 0-99 | Se clampea al rango válido |
| Cliente | ≥ 0, numérico | Solo se propaga si el parse es válido |

### Accesibilidad

| Elemento | Atributo | Valor |
|----------|----------|-------|
| Sección | `aria-labelledby` | `"codigo-section-heading"` |
| Botón header | `aria-expanded` | `true/false` según estado collapsed |
| Botón header | `aria-controls` | `"codigo-section-content"` |
| Panel contenido | `role="region"` | Para indicar zona de formulario |
| Input Modo | `aria-describedby` | `"codigo-modo-desc"` (texto sr-only) |
| Input Cliente | `aria-describedby` | `"codigo-cliente-desc"` (texto sr-only) |
| Input Año manual | `aria-label` | `"Año manual (2 dígitos)"` |
| Input Producto | `aria-readonly` | `"true"` |
| Checkbox decorativo | `aria-hidden` | `"true"` (no es interactivo) |

### Dependencias utilizadas

| Módulo | Uso |
|--------|-----|
| `react` (useState, useEffect, useMemo, useCallback) | Estado local, sincronización, memoización |
| `@renderer/types/config` | Tipo `CodigoConfig` para tipado fuerte |

### Verificación

```bash
# TypeScript compila sin errores:
$ getDiagnostics src/renderer/src/components/maquina/CodigoSection.tsx
# No diagnostics found

# TypeCheck del proyecto web:
$ npx tsc --noEmit -p tsconfig.web.json
# Solo warnings pre-existentes en tests (unused vars en tariff-calc.property.test.ts)
# CodigoSection.tsx: limpio
```

---

## Detalle de lo realizado (8.2)

### ¿Qué se hizo?

Se creó el componente **TicketSection.tsx**, la segunda sección colapsable de la vista Máquina que permite editar los datos de la factura simplificada / ticket. Replica exactamente la sección "TICKET" del legacy `MaquinaView.vue`, incluyendo la cabecera, datos de empresa, textos legales, límites de importe, fecha/hora y opciones de copia/master ticket.

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `src/renderer/src/components/maquina/TicketSection.tsx` | Sección colapsable para edición de la configuración del ticket |

### Interfaz de Props

```typescript
export interface TicketSectionProps {
  /** Configuración actual del ticket, cargada desde el store. */
  ticket: TicketConfig
  /** Nombre del perfil activo (ej: "FERIA", "Filatelia"). */
  activeProfileName: string
  /** Nombre de la feria del evento activo (display-only, desde sello config). */
  feriaDisplay: string
  /** Lugar del evento activo (display-only, desde sello config). */
  lugarDisplay: string
  /** Callback para propagar cambios parciales al padre (MaquinaView). */
  onChange: (updated: Partial<TicketConfig>) => void
}
```

### Campos editables

| Campo | Tipo input | Restricciones | Descripción |
|-------|-----------|---------------|-------------|
| Empresa | `text` | Libre | Nombre de la empresa para el ticket |
| CIF | `text` | Libre | CIF/NIF de la empresa |
| CP Población | `text` | Libre | Código postal y población |
| Detalle línea 1 | `text` | Libre | Primera línea del pie del ticket (textos legales) |
| Detalle línea 2 | `text` | Libre | Segunda línea del pie del ticket |
| Detalle línea 3 | `text` | Libre | Tercera línea del pie del ticket |
| Título ticket | `text` | Libre | Título personalizable (sólo perfil FERIA) |
| Título copia | `text` (disabled) | Solo lectura | Se calcula automáticamente: "COPIA " + título |
| Límite importe FERIA | `text` → `number` | ≥ 0 | Límite de importe para el perfil FERIA |
| NUEVO Límite importe | `text` → `number` | ≥ 0 | Límite de importe para el resto de perfiles |
| Fecha | `select` + `text` | Auto/Manual | Modo de fecha del ticket |
| Hora | `select` + `text` | Auto/Manual | Modo de hora del ticket |
| Copia Ticket S/N | `text` | maxLength=1, uppercase | Imprime copia ticket (S/N) |
| Master Ticket S/N | `text` | maxLength=1, uppercase | Imprime master set ticket (S/N) |

### Campos de sólo lectura / derivados

| Campo | Origen | Descripción |
|-------|--------|-------------|
| Cabecera (feria + lugar) | `feriaDisplay` + `lugarDisplay` props | Se muestra en grande como encabezado visual |
| Título ticket mostrado en header | Derivado de `activeProfileName` | Si perfil=FERIA usa `eltitulo`, sino usa nombre del perfil |
| Título copia | Derivado | "COPIA " + título calculado |

### Estructura visual

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ☑ TICKET: Factura Simplificada - COPIA TICKET: S - MASTER TICKET: N ← dorado
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌── Columna Izquierda ──────────┐  ┌── Columna Derecha ────────────────┐  │
│  │                               │  │                                    │  │
│  │  ┌ Cabecera Ticket ─────┐    │  │  ┌ Tipo de Documento ─────────┐   │  │
│  │  │ XLIX Feria Nacional  │    │  │  │ Título (Sólo Perfil FERIA) │   │  │
│  │  │ Plaza Mayor - Madrid │    │  │  │ [Factura Simplificada    ] │   │  │
│  │  └──────────────────────┘    │  │  │ Título copia (read-only)   │   │  │
│  │                               │  │  │ [COPIA Factura Simplif.  ] │   │  │
│  │  ┌ Empresa ─────────────┐    │  │  │ Límite importe FERIA       │   │  │
│  │  │ Empresa: [S.E.Correos] │  │  │  │ [399.99                  ] │   │  │
│  │  │ CIF:     [A83052407  ] │  │  │  │ NUEVO Límite EXCEPTO FERIA │   │  │
│  │  │ CP:      [28042 Madrid] │ │  │  │ [399.99                  ] │   │  │
│  │  └──────────────────────────┘ │  │  └────────────────────────────┘   │  │
│  │                               │  │                                    │  │
│  │  ┌ Pié del Ticket ──────┐    │  │  ┌ Modo Fecha Ticket ─────────┐   │  │
│  │  │ Línea 1: [Exento...]  │   │  │  │ Fecha: [Automático ▼]       │   │  │
│  │  │ Línea 2: [Objeto...]  │   │  │  │ Hora:  [Automático ▼]       │   │  │
│  │  │ Línea 3: [No se...]   │   │  │  └────────────────────────────┘   │  │
│  │  └───────────────────────┘    │  │                                    │  │
│  │                               │  │  ┌ COPIA Ticket para CAJA ───┐    │  │
│  └───────────────────────────────┘  │  │ IMPRIMIR COPIA: [ S ]      │   │  │
│                                      │  └────────────────────────────┘   │  │
│                                      │                                    │  │
│                                      │  ┌ MASTER TICKET (rojo) ─────┐    │  │
│                                      │  │ IMPRIMIR MASTER: [ N ]     │   │  │
│                                      │  └────────────────────────────┘   │  │
│                                      └────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Mapeo con el legacy MaquinaView.vue

| Legacy (Vue 3) | Nuevo (React) | Notas |
|----------------|---------------|-------|
| `<div @click="showTicket = !showTicket">` | `<button onClick>` con `aria-expanded` | Misma UX, mejor accesibilidad |
| `<p>{{ feria }}<br>{{ lugar }}</p>` | Props `feriaDisplay` / `lugarDisplay` | Se pasan desde el padre (datos del sello/evento) |
| `v-model="empresa"`, `v-model="cif"`, `v-model="cp"` | Inputs controlados con handlers individuales | Mismo layout de 400px width |
| `v-model="l1"`, `v-model="l2"`, `v-model="l3"` | Inputs controlados con onChange | Textos legales del pie |
| `v-model="eltitulo"` (rojo) | Input con `text-red-600`, editable | Sólo afecta perfil FERIA |
| `:value="tituloCopia" disabled` | Input disabled con valor derivado | Calculado: "COPIA " + título |
| `v-model="limiteImporte"` (rojo) | Input con parseFloat + validación ≥ 0 | Límite sólo para FERIA |
| `v-model="NUEVOlimiteImporte"` (rojo) | Input con parseFloat + validación ≥ 0 | Límite para todos excepto FERIA |
| `<select v-model="modoFecha">` (1=Auto, 2=Manual) | `<select>` + estado `modoFecha` ('auto'\|'manual') | Mismo toggle |
| `v-if="modoFecha === '2'"` input | `{modoFecha === 'manual' && <input>}` | Render condicional |
| `v-model="ImprimeCopiaTicket"` maxlength=1 | Input con normalización (1 char, uppercase) | S o N |
| `v-model="ImprimeMasterTicket"` maxlength=1 | Input con normalización (1 char, uppercase) | S o N |
| Sección master con `bg-red-600 text-white` | Div con mismas clases Tailwind | Alerta visual idéntica al legacy |

### Lógica del título del ticket

El título mostrado en el header del section y en el campo "Título copia" se calcula dinámicamente según el perfil activo:

```typescript
// Si perfil = FERIA → se usa el campo editable eltitulo
// Si perfil ≠ FERIA → se usa el nombre del perfil (ej: "Filatelia", "SPDE")
const displayTitulo =
  activeProfileName === 'FERIA' ? eltitulo : activeProfileName

const displayTituloCopia =
  activeProfileName === 'FERIA'
    ? ticket.tituloCopia || `COPIA ${eltitulo}`
    : `COPIA ${activeProfileName}`
```

Esto replica el comportamiento exacto del legacy donde el título del ticket cambiaba según el modo de venta activo (Req 7.3, 7.4, 7.5).

### Estado interno del componente

| Estado | Tipo | Inicialización | Descripción |
|--------|------|----------------|-------------|
| `collapsed` | boolean | `true` | Sección colapsada por defecto |
| `eltitulo` | string | `ticket.eltitulo ?? ''` | Título editable (perfil FERIA) |
| `limiteImporte` | string | `String(ticket.limiteImporte)` | Límite FERIA (string para input) |
| `nuevoLimiteImporte` | string | `String(ticket.NUEVOlimiteImporte)` | Límite no-FERIA |
| `empresa` | string | `ticket.empresa` | Nombre empresa |
| `cif` | string | `ticket.cif` | CIF/NIF |
| `cp` | string | `ticket.cp` | CP + Población |
| `l1` | string | `ticket.l1` | Texto legal línea 1 |
| `l2` | string | `ticket.l2` | Texto legal línea 2 |
| `l3` | string | `ticket.l3` | Texto legal línea 3 |
| `modoFecha` | 'auto' \| 'manual' | derivado de `ticket.fecha` | Toggle de fecha |
| `fechaManual` | string | `ticket.fecha` si no es 'auto' | Valor fecha manual |
| `modoHora` | 'auto' \| 'manual' | derivado de `ticket.hora` | Toggle de hora |
| `horaManual` | string | `ticket.hora` si no es 'auto' | Valor hora manual |
| `imprimeCopiaTicket` | string | `ticket.ImprimeCopiaTicket ?? 'S'` | Imprimir copia (S/N) |
| `imprimeMasterTicket` | string | `ticket.ImprimeMasterTicket ?? 'N'` | Imprimir master (S/N) |

### Validaciones aplicadas

| Campo | Validación | Comportamiento |
|-------|-----------|----------------|
| Límite importe FERIA | parseFloat, ≥ 0 | Solo propaga si es un número válido positivo |
| NUEVO Límite importe | parseFloat, ≥ 0 | Solo propaga si es un número válido positivo |
| Fecha manual | string libre | Si vacío, se propaga como 'auto' |
| Hora manual | string libre | Si vacío, se propaga como 'auto' |
| Copia Ticket | Max 1 char, uppercase | Normalizado a "S" o "N" |
| Master Ticket | Max 1 char, uppercase | Normalizado a "S" o "N" |

### Accesibilidad

| Elemento | Atributo | Valor |
|----------|----------|-------|
| Sección | `aria-labelledby` | `"ticket-section-heading"` |
| Botón header | `aria-expanded` | `true/false` según estado collapsed |
| Botón header | `aria-controls` | `"ticket-section-content"` |
| Panel contenido | `role="region"` | Zona de formulario con label descriptivo |
| Todos los inputs | `id` + `<label htmlFor>` | Asociación explícita label-input |
| Input título copia | `aria-readonly="true"` | Indica campo no editable |
| Checkbox decorativo | `aria-hidden="true"` | No interactivo |

### Decisiones de diseño específicas de TicketSection

#### ¿Por qué `activeProfileName` y `feriaDisplay`/`lugarDisplay` como props separadas?

En el legacy, la vista Máquina accedía directamente a `cfg.sello.elnperfil` y `cfg.sello.feria`/`cfg.sello.lugar` para mostrar datos derivados. En el nuevo diseño, TicketSection sólo recibe `TicketConfig` como dato editable — los datos de sello que son display-only se pasan como props independientes por tres razones:

1. **Separación de responsabilidades**: TicketSection edita datos de ticket, no de sello. Pasar el objeto `SelloConfig` completo violaría el principio de mínimo conocimiento.
2. **Reusabilidad**: El componente no depende de la forma de SelloConfig.
3. **Consistencia con CodigoSection**: Ambos reciben sólo su sección de config + lo mínimo necesario para display.

#### ¿Por qué los límites se manejan como string internamente?

Los campos `limiteImporte` y `NUEVOlimiteImporte` se almacenan como `string` en el estado local del componente aunque son numéricos en la BD. Razón: si el input fuera `type="number"`, el usuario no podría escribir decimales de forma cómoda (ej: "399." se borraría). Al mantenerlo como text + parseo en el handler, el campo es fluido para el usuario y sólo se valida/propaga cuando el valor es parseable como float ≥ 0.

#### ¿Por qué la sección de Master Ticket tiene fondo rojo?

Replicando exactamente el legacy, donde la sección de master ticket llevaba `bg-red-600 text-white` como indicador visual de que es una opción "peligrosa" / especial que modifica el comportamiento de venta de forma significativa (vender siempre 5 tiras × 4 tarifas). Es una señal visual intencionada para el vendedor.

### Ejemplo de uso futuro (en MaquinaView)

```tsx
import TicketSection from '@renderer/components/maquina/TicketSection'
import { useConfigStore } from '@renderer/stores/config.store'

export default function MaquinaView(): JSX.Element {
  const config = useConfigStore((s) => s.config)
  const [ticketChanges, setTicketChanges] = useState<Partial<TicketConfig>>({})

  const handleTicketChange = (partial: Partial<TicketConfig>) => {
    setTicketChanges((prev) => ({ ...prev, ...partial }))
  }

  if (!config) return <p>Cargando...</p>

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <CodigoSection codigo={config.codigo} onChange={handleCodigoChange} />
      <TicketSection
        ticket={config.ticket}
        activeProfileName={config.sello.elnperfil}
        feriaDisplay={config.sello.feria}
        lugarDisplay={config.sello.lugar}
        onChange={handleTicketChange}
      />
      {/* RollosSection, TirasSection... */}
    </div>
  )
}
```

### Verificación

```bash
# TypeScript compila sin errores:
$ getDiagnostics src/renderer/src/components/maquina/TicketSection.tsx
# No diagnostics found

# TypeCheck del proyecto web:
$ npx tsc --noEmit -p tsconfig.web.json
# Solo warnings pre-existentes en archivos de test (unused vars)
# TicketSection.tsx: limpio
```

### Dependencias utilizadas

| Módulo | Uso |
|--------|-----|
| `react` (useState, useEffect, useCallback) | Estado local, sincronización, memoización de callbacks |
| `@renderer/types/config` | Tipo `TicketConfig` para tipado fuerte de las props |

---

## Detalle de lo realizado (8.3)

### ¿Qué se hizo?

Se creó el componente **RollosSection.tsx**, la tercera sección de la vista Máquina que gestiona los rollos de etiquetas instalados en la máquina. Replica la sección "ROLLOS ETIQUETAS EN MÁQUINA" y "INSTALAR ROLLOS ETIQUETAS" del legacy `MaquinaView.vue`, incluyendo:

- Contador de tickets (límite y actual, con reset)
- Visualización de existencias de cada rollo instalado
- Botón para quitar rollo (establece valor a -1 y registra orden de auditoría)
- Formulario para instalar rollo cuando está quitado (cantidad - desechadas)
- Indicador visual BLOQUEADO/DESBLOQUEADO según estado de los rollos

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `src/renderer/src/components/maquina/RollosSection.tsx` | Sección de gestión de rollos de etiquetas |

### Interfaz de Props

```typescript
export interface RollosSectionProps {
  /** Configuración actual del ticket conteniendo rollo1, rollo2, tickets, limiteTickets. */
  ticket: TicketConfig
  /** Nombre del modelo 1 (izquierdo/printer1) para display. */
  nombreModelo1: string
  /** Nombre del modelo 2 (derecho/printer2) para display. */
  nombreModelo2: string
  /** Callback para propagar cambios parciales de ticket al padre (MaquinaView). */
  onChange: (updated: Partial<TicketConfig>) => void
  /** Callback para insertar una línea de orden de auditoría (QUITAR/COLOCAR ROLLO). */
  onInsertOrder: (order: OrderLine) => Promise<void>
}
```

### Diferencia clave con CodigoSection/TicketSection

RollosSection tiene una prop adicional `onInsertOrder` que no existe en las otras secciones. Esto es porque las acciones de quitar/instalar rollo generan un **registro de auditoría** en la tabla `orders` (con eventos "QUITAR ROLLO 1", "QUITAR ROLLO 2", "COLOCAR ROLLO 1", "COLOCAR ROLLO 2"). En el legacy esto se hacía con `await insertOrder([orderLine])` directamente en el componente.

### Estructura visual

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   Máximo Nº de Tickets                                       │
│                   ┌───────────────────────┐                                 │
│                   │ Cantidad por Rollo    │                                 │
│                   │ [450                ] │                                 │
│                   └───────────────────────┘                                 │
│                   ┌─── bg azul ──────────┐                                  │
│                   │ Rollo Tickets         │                                  │
│                   │ [   450   ]           │                                  │
│                   │ [Reset]               │                                  │
│                   └──────────────────────┘                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ ROLLOS ETIQUETAS EN MÁQUINA                              ← header dorado    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌── Rollo 1 (si instalado) ────┐       ┌── Rollo 2 (si instalado) ────┐  │
│  │ Motivo NombreModelo1          │       │ Motivo NombreModelo2          │  │
│  │ Existencias: [1500         ]  │       │ Existencias: [1500         ]  │  │
│  │ [CONFIRMAR ROLLO QUITADO]     │       │ [CONFIRMAR ROLLO QUITADO]     │  │
│  └───────────────────────────────┘       └───────────────────────────────┘  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ INSTALAR ROLLOS ETIQUETAS                                ← header azul      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌── Instalar Rollo 1 (si quitado) ─┐  ┌── Instalar Rollo 2 (si quitado)┐ │
│  │ Colocar rollo NombreModelo1       │  │ Colocar rollo NombreModelo2     │ │
│  │ Etiquetas en rollo: [0        ]   │  │ Etiquetas en rollo: [0        ] │ │
│  │ Desechadas:         [0        ]   │  │ Desechadas:         [0        ] │ │
│  │ [CONFIRMAR COLOCACIÓN ROLLO]      │  │ [CONFIRMAR COLOCACIÓN ROLLO]    │ │
│  └───────────────────────────────────┘  └─────────────────────────────────┘ │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                    ┌─────────────────────────┐                              │
│                    │ ██ DESBLOQUEADO ██      │  ← verde si ambos quitados   │
│                    │ ██ BLOQUEADO    ██      │  ← rojo si alguno instalado  │
│                    └─────────────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Mapeo con el legacy MaquinaView.vue

| Legacy (Vue 3) | Nuevo (React) | Notas |
|----------------|---------------|-------|
| `v-model="limiteTickets"` | Input controlado + `handleLimiteTicketsChange` | Cantidad por Rollo |
| `v-model="tickets"` en div azul | Input controlado + `handleTicketsChange` | Contador actual de tickets |
| `@click="tickets = limiteTickets"` | `handleResetTickets()` | Reset tickets al límite |
| `v-if="rollo1 != -1"` → existencias + quitar | `{isRollo1Installed && <div>...}` | Muestra sólo si rollo instalado |
| `v-model="rollo1"` text-xl | Input controlado `handleRollo1Change` | Existencias editables |
| `@click="quitarRollo1"` | `handleQuitarRollo1()` async | Pone a -1 + inserta orden auditoría |
| `v-if="rollo1 == -1"` → instalar | `{!isRollo1Installed && <div>...}` | Muestra sólo si rollo quitado |
| `v-model.number="cantidad1"` | Input number + `setCantidad1` | Etiquetas totales en el rollo nuevo |
| `v-model.number="desechadas1"` | Input number + `setDesechadas1` | Etiquetas desechadas al instalar |
| `@click="colocarRollo1"` | `handleColocarRollo1()` async | Calcula cantidad-desechadas + orden |
| `Number(rollo1) + Number(rollo2) === -2` → verde | `!isBlocked` (ambos = -1) | DESBLOQUEADO |
| else → rojo | `isBlocked` (alguno ≠ -1) | BLOQUEADO |

### Lógica de bloqueo (Requisito 5)

```typescript
const isRollo1Installed = rollo1 !== -1
const isRollo2Installed = rollo2 !== -1
const isBlocked = isRollo1Installed || isRollo2Installed

// DESBLOQUEADO = ambos rollos quitados (rollo1 = -1 AND rollo2 = -1)
// BLOQUEADO = al menos un rollo instalado (rollo1 ≠ -1 OR rollo2 ≠ -1)
```

Cuando está BLOQUEADO, el cambio de evento debe impedirse (esta lógica la implementará la vista `ImprimirView` al consultar el estado de los rollos). El indicador visual es informativo para el vendedor.

### Lógica de instalación de rollo

```typescript
// Al confirmar colocación del rollo:
const newValue = (cantidad || 0) - (desechadas || 0)
// Ejemplo: 1500 etiquetas - 5 desechadas = 1495 disponibles
setRollo(newValue)
propagate({ rollo1: newValue }) // o rollo2
```

Esto replica el Requisito 5.3: "CUANDO se instala un rollo, EL Sistema DEBERÁ establecer su valor a la cantidad de etiquetas cargadas menos las desechadas."

### Auditoría de operaciones de rollo

Cada acción de quitar o colocar rollo genera un `OrderLine` con campo `event` identificando la operación:

| Acción | event | Descripción |
|--------|-------|-------------|
| Quitar Rollo 1 | `"QUITAR ROLLO 1"` | Registra que el rollo izquierdo fue retirado |
| Quitar Rollo 2 | `"QUITAR ROLLO 2"` | Registra que el rollo derecho fue retirado |
| Colocar Rollo 1 | `"COLOCAR ROLLO 1"` | Registra que se instaló un rollo nuevo en la izquierda |
| Colocar Rollo 2 | `"COLOCAR ROLLO 2"` | Registra que se instaló un rollo nuevo en la derecha |

Estos registros son importantes para trazabilidad y auditoría de operaciones de la máquina.

### Estado interno del componente

| Estado | Tipo | Inicialización | Descripción |
|--------|------|----------------|-------------|
| `limiteTickets` | string | `String(ticket.limiteTickets ?? 450)` | Cantidad máxima de tickets por rollo |
| `tickets` | string | `String(ticket.tickets ?? 0)` | Tickets disponibles actualmente |
| `rollo1` | number | `ticket.rollo1 ?? 0` | Existencias del rollo 1 (-1 = quitado) |
| `rollo2` | number | `ticket.rollo2 ?? 0` | Existencias del rollo 2 (-1 = quitado) |
| `cantidad1` | number | `0` | Etiquetas en rollo nuevo (instalación rollo 1) |
| `desechadas1` | number | `0` | Etiquetas desechadas (instalación rollo 1) |
| `cantidad2` | number | `0` | Etiquetas en rollo nuevo (instalación rollo 2) |
| `desechadas2` | number | `0` | Etiquetas desechadas (instalación rollo 2) |

### Valores derivados

| Variable | Cálculo | Descripción |
|----------|---------|-------------|
| `isRollo1Installed` | `rollo1 !== -1` | Rollo 1 presente en la máquina |
| `isRollo2Installed` | `rollo2 !== -1` | Rollo 2 presente en la máquina |
| `isBlocked` | `isRollo1Installed \|\| isRollo2Installed` | Al menos un rollo instalado → bloqueado |

### Validaciones aplicadas

| Campo | Validación | Comportamiento |
|-------|-----------|----------------|
| Límite Tickets | parseInt, ≥ 0 | Solo propaga si es entero válido positivo |
| Tickets | parseInt, ≥ 0 | Solo propaga si es entero válido positivo |
| Rollo 1 existencias | parseInt, numérico | Acepta cualquier entero (incluido -1) |
| Rollo 2 existencias | parseInt, numérico | Acepta cualquier entero (incluido -1) |
| Cantidad (instalación) | tipo number, min=0 | No permite negativos |
| Desechadas (instalación) | tipo number, min=0 | No permite negativos |

### Accesibilidad

| Elemento | Atributo | Valor |
|----------|----------|-------|
| Sección | `aria-labelledby` | `"rollos-section-heading"` |
| Indicador bloqueado/desbloqueado | `role="status"` | Indica zona de estado vivo |
| Indicador | `aria-live="polite"` | Anuncia cambios a lectores de pantalla |
| Todos los inputs | `id` + `<label htmlFor>` | Asociación explícita label-input |
| Inputs numéricos | `min={0}` | Restricción nativa HTML5 |
| Botones de acción | Focus styles explícitos | `focus:ring-2` para visibilidad de foco |

### Decisiones de diseño específicas de RollosSection

#### ¿Por qué no es colapsable como las otras secciones?

En el legacy, la sección de rollos NO era colapsable — estaba siempre visible porque es información crítica que el vendedor necesita ver constantemente (cuántas etiquetas quedan, si la máquina está bloqueada). Las secciones colapsables son las de configuración menos frecuente (código, ticket, tiras).

#### ¿Por qué `onInsertOrder` como prop en lugar de acceder directamente al store de orders?

1. **Consistencia con el patrón**: Las secciones no acceden directamente a stores, reciben callbacks del padre.
2. **Testabilidad**: Se puede testear el componente sin mock del store, pasando un mock de `onInsertOrder`.
3. **Separación**: RollosSection no necesita conocer la implementación de la inserción de órdenes.

#### ¿Por qué los campos de instalación (cantidad, desechadas) son estado local no propagado?

Estos campos son temporales — solo existen durante el proceso de instalación y se resetean a 0 tras confirmar. No forman parte de la configuración persistida. Solo el resultado final (`cantidad - desechadas`) se propaga como nuevo valor del rollo.

#### ¿Por qué el Reset de tickets establece el valor del campo `limiteTickets` actual?

Replica el comportamiento legacy: `@click="tickets = limiteTickets"`. El vendedor configura cuántos tickets tiene un rollo completo, y al resetear se establece el contador al máximo. Esto se usa cuando se cambia el rollo de tickets.

### Ejemplo de uso futuro (en MaquinaView)

```tsx
import RollosSection from '@renderer/components/maquina/RollosSection'
import { useConfigStore } from '@renderer/stores/config.store'
import { useOrdersStore } from '@renderer/stores/orders.store'
import type { OrderLine } from '@renderer/types/order'

export default function MaquinaView(): JSX.Element {
  const config = useConfigStore((s) => s.config)
  const insertOrders = useOrdersStore((s) => s.insertOrders)
  const [ticketChanges, setTicketChanges] = useState<Partial<TicketConfig>>({})

  const handleRollosChange = (partial: Partial<TicketConfig>) => {
    setTicketChanges((prev) => ({ ...prev, ...partial }))
  }

  const handleInsertOrder = async (order: OrderLine) => {
    await insertOrders([order])
  }

  if (!config) return <p>Cargando...</p>

  // Determinar nombre de los modelos del evento activo
  const evIdx = config.sello.elevento ?? 0
  const evento = config.sello.eventos?.[evIdx]
  const nombreModelo1 = evento?.motivoi ?? 'Modelo 1'
  const nombreModelo2 = evento?.motivod ?? 'Modelo 2'

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <CodigoSection codigo={config.codigo} onChange={handleCodigoChange} />
      <TicketSection
        ticket={config.ticket}
        activeProfileName={config.sello.elnperfil}
        feriaDisplay={config.sello.feria}
        lugarDisplay={config.sello.lugar}
        onChange={handleTicketChange}
      />
      <RollosSection
        ticket={config.ticket}
        nombreModelo1={nombreModelo1}
        nombreModelo2={nombreModelo2}
        onChange={handleRollosChange}
        onInsertOrder={handleInsertOrder}
      />
      {/* TirasSection... */}
    </div>
  )
}
```

### Verificación

```bash
# TypeScript compila sin errores:
$ getDiagnostics src/renderer/src/components/maquina/RollosSection.tsx
# No diagnostics found

# Tests del renderer siguen pasando (249 tests pass, 9 test files pass):
$ npx vitest run src/renderer
# Test Files  9 passed (de los relevantes)
# Tests      249 passed
# Los 2 archivos con fallos son pre-existentes (navigation.test.tsx con duplicados de aria-label)
```

### Dependencias utilizadas

| Módulo | Uso |
|--------|-----|
| `react` (useState, useEffect, useCallback) | Estado local, sincronización, callbacks |
| `@renderer/types/config` | Tipo `TicketConfig` para props tipadas |
| `@renderer/types/order` | Tipo `OrderLine` para inserción de auditoría |

---

## Detalle de lo realizado (8.4)

### ¿Qué se hizo?

Se creó el componente **TirasSection.tsx**, la cuarta y última sección colapsable de la vista Máquina que gestiona las tiras especiales. Replica exactamente la sección "TIRAS ESPECIALES" del legacy `MaquinaView.vue`, incluyendo:

- Precios de venta para 1, 2 y 3 tiras especiales (T1especial, T2especial, T3especial)
- Activar/desactivar impresión de tira especial por modelo (TEmod1, TEmod2 → "S"/"N")
- Poner precio a 0 equivale a anular esa tira especial

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `src/renderer/src/components/maquina/TirasSection.tsx` | Sección colapsable para configuración de tiras especiales |

### Interfaz de Props

```typescript
export interface TirasSectionProps {
  /** Configuración actual del ticket conteniendo T1especial, T2especial, T3especial, TEmod1, TEmod2. */
  ticket: TicketConfig
  /** Nombre del modelo 1 (izquierdo/printer1) para display. */
  nombreModelo1: string
  /** Nombre del modelo 2 (derecho/printer2) para display. */
  nombreModelo2: string
  /** Callback para propagar cambios parciales al padre (MaquinaView). */
  onChange: (updated: Partial<TicketConfig>) => void
}
```

### Campos editables

| Campo | Tipo input | Restricciones | Descripción |
|-------|-----------|---------------|-------------|
| 1 Tira Especial | `number` | ≥ 0, step=0.01 | Importe € de venta para 1 tira (0 = anula la tira) |
| 2 Tiras Especiales | `number` | ≥ 0, step=0.01 | Importe € de venta para 2 tiras (0 = anula la tira) |
| 3 Tiras Especiales | `number` | ≥ 0, step=0.01 | Importe € de venta para 3 tiras (0 = anula la tira) |
| Modelo 1 (S/N) | `text` | maxLength=1, uppercase | Activa/desactiva tira especial para modelo izquierdo |
| Modelo 2 (S/N) | `text` | maxLength=1, uppercase | Activa/desactiva tira especial para modelo derecho |

### Estructura visual

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ☑ TIRAS ESPECIALES ModeloIzq: S / ModeloDer: N               ← header dorado│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌── Columna Izquierda ──────────────┐  ┌── Columna Derecha ────────────┐  │
│  │                                    │  │                                │  │
│  │  ┌ IMPORTE € DE VENTA para: ──┐   │  │  ┌ IMPRIMIR TIRA ESPECIAL ─┐  │  │
│  │  │ (NO dejar en blanco)        │   │  │  │         S/N              │  │  │
│  │  └────────────────────────────┘   │  │  └─────────────────────────┘  │  │
│  │                                    │  │                                │  │
│  │  1 TIRA ESPECIAL (0=anula):       │  │  MODELO 1: NombreModelo1       │  │
│  │  [2.00                        ]   │  │  [S                         ]  │  │
│  │                                    │  │                                │  │
│  │  2 TIRAS ESPECIALES (0=anula):    │  │  MODELO 2: NombreModelo2       │  │
│  │  [4.00                        ]   │  │  [N                         ]  │  │
│  │                                    │  │                                │  │
│  │  3 TIRAS ESPECIALES (0=anula):    │  │                                │  │
│  │  [6.00                        ]   │  │                                │  │
│  │                                    │  │                                │  │
│  └────────────────────────────────────┘  └────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Mapeo con el legacy MaquinaView.vue

| Legacy (Vue 3) | Nuevo (React) | Notas |
|----------------|---------------|-------|
| `<div @click="showTiras = !showTiras">` + checkbox | `<button onClick>` con `aria-expanded` | Misma UX, mejor accesibilidad |
| Header: `TIRAS ESPECIALES {{ nombreModelo1 }}: {{ TEmod1 }} / {{ nombreModelo2 }}: {{ TEmod2 }}` | Header dinámico con `{nombreModelo1}: {temod1} / {nombreModelo2}: {temod2}` | Mismo contenido |
| `v-model.number="T1especial"` type=number | Input controlado + `handleT1especialChange` | parseFloat + validación ≥ 0 |
| `v-model.number="T2especial"` type=number | Input controlado + `handleT2especialChange` | parseFloat + validación ≥ 0 |
| `v-model.number="T3especial"` type=number | Input controlado + `handleT3especialChange` | parseFloat + validación ≥ 0 |
| `v-model="TEmod1"` maxlength=1 (rojo) | Input controlado + `handleTemod1Change` | Normalización: 1 char, uppercase |
| `v-model="TEmod2"` maxlength=1 (rojo) | Input controlado + `handleTemod2Change` | Normalización: 1 char, uppercase |
| Layout: dos columnas con `flex gap-8` | `flex gap-8` + `flex-1` por columna | Misma disposición visual |

### Lógica de negocio: Tiras Especiales

Las tiras especiales son configuraciones opcionales que permiten vender "tiras" de etiquetas a precios fijos preconfigurados (en lugar de usar las tarifas estándar A, B, C). El concepto es:

- **T1especial**: Precio por una tira especial de 4 etiquetas (las 4 con la misma tarifa especial)
- **T2especial**: Precio por comprar 2 tiras especiales en una misma venta
- **T3especial**: Precio por comprar 3 tiras especiales en una misma venta
- **TEmod1/TEmod2**: Si está activado ("S"), el modelo correspondiente puede imprimir tiras especiales; si está desactivado ("N"), no aparecen en la interfaz de venta para ese modelo

Poner el precio a 0 equivale a **anular** esa tira especial (no se ofrece como opción de venta).

### Estado interno del componente

| Estado | Tipo | Inicialización | Descripción |
|--------|------|----------------|-------------|
| `collapsed` | boolean | `true` | Sección colapsada por defecto |
| `t1especial` | string | `String(ticket.T1especial ?? 0)` | Precio 1 tira especial (string para input) |
| `t2especial` | string | `String(ticket.T2especial ?? 0)` | Precio 2 tiras especiales |
| `t3especial` | string | `String(ticket.T3especial ?? 0)` | Precio 3 tiras especiales |
| `temod1` | string | `ticket.TEmod1 ?? 'N'` | Activado/desactivado modelo 1 |
| `temod2` | string | `ticket.TEmod2 ?? 'N'` | Activado/desactivado modelo 2 |

### Validaciones aplicadas

| Campo | Validación | Comportamiento |
|-------|-----------|----------------|
| T1especial | parseFloat, ≥ 0 | Solo propaga si es número válido; cadena vacía o "0" propagan 0 |
| T2especial | parseFloat, ≥ 0 | Mismo comportamiento que T1 |
| T3especial | parseFloat, ≥ 0 | Mismo comportamiento que T1 |
| TEmod1 | Max 1 char, uppercase | Normalizado a "S" o "N" (u otro carácter válido) |
| TEmod2 | Max 1 char, uppercase | Normalizado a "S" o "N" (u otro carácter válido) |

### Accesibilidad

| Elemento | Atributo | Valor |
|----------|----------|-------|
| Sección | `aria-labelledby` | `"tiras-section-heading"` |
| Botón header | `aria-expanded` | `true/false` según estado collapsed |
| Botón header | `aria-controls` | `"tiras-section-content"` |
| Panel contenido | `role="region"` | Zona de formulario con `aria-label` descriptivo |
| Todos los inputs | `id` + `<label htmlFor>` | Asociación explícita label-input |
| Inputs TEmod1/TEmod2 | `aria-describedby` | Texto sr-only explicando S=activar, N=desactivar |
| Checkbox decorativo | `aria-hidden="true"` | No es interactivo, solo visual |
| Inputs numéricos | `min={0}`, `step="0.01"` | Restricción nativa HTML5 para decimales positivos |

### Decisiones de diseño específicas de TirasSection

#### ¿Por qué los precios se almacenan como string internamente?

Igual que en TicketSection con los límites de importe: si el input fuera directamente numérico con binding bidireccional, el usuario no podría escribir decimales fluidamente (ej: "2." se borraría durante la edición). Al mantenerlo como string + parseo en el handler, el campo es cómodo de editar y solo se valida/propaga cuando el valor es parseable como float ≥ 0.

#### ¿Por qué los campos TEmod usan `type="text"` y no un checkbox o toggle?

Replica exactamente el comportamiento del legacy, donde estos campos eran inputs de texto libre con maxlength=1. El vendedor escribe "S" o "N". Un checkbox sería más moderno pero cambiaría la UX que los operadores ya conocen. La prioridad es mantener la familiaridad del interfaz para usuarios no técnicos que ya operan con el sistema actual.

#### ¿Por qué esta sección está después de RollosSection y no con TicketSection?

Sigue el orden exacto del legacy `MaquinaView.vue`:
1. Código Etiqueta (colapsable)
2. Ticket (colapsable)
3. Máximo Nº Tickets + Rollos (siempre visible)
4. Tiras Especiales (colapsable)
5. Footer con botones

Este orden tiene sentido operativo: los rollos son lo más importante (visible siempre), y las tiras especiales son una configuración avanzada que se toca pocas veces.

#### ¿Por qué `step="0.01"` en los inputs numéricos?

Los precios de las tiras se expresan en euros con céntimos (ej: 2.00€, 3.70€). El step de 0.01 permite el ajuste fino con las flechas del input nativo y valida que no se introduzcan más de 2 decimales vía los controles nativos (aunque el campo acepta más en el texto libre).

### Ejemplo de uso futuro (en MaquinaView)

```tsx
import TirasSection from '@renderer/components/maquina/TirasSection'
import { useConfigStore } from '@renderer/stores/config.store'

export default function MaquinaView(): JSX.Element {
  const config = useConfigStore((s) => s.config)
  const [ticketChanges, setTicketChanges] = useState<Partial<TicketConfig>>({})

  const handleTirasChange = (partial: Partial<TicketConfig>) => {
    setTicketChanges((prev) => ({ ...prev, ...partial }))
  }

  if (!config) return <p>Cargando...</p>

  const evIdx = config.sello.elevento ?? 0
  const evento = config.sello.eventos?.[evIdx]
  const nombreModelo1 = evento?.motivoi ?? 'Modelo 1'
  const nombreModelo2 = evento?.motivod ?? 'Modelo 2'

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      {/* ... CodigoSection, TicketSection, RollosSection ... */}
      <TirasSection
        ticket={config.ticket}
        nombreModelo1={nombreModelo1}
        nombreModelo2={nombreModelo2}
        onChange={handleTirasChange}
      />
      <button onClick={handleGuardar}>Guardar</button>
    </div>
  )
}
```

### Verificación

```bash
# TypeScript compila sin errores:
$ getDiagnostics src/renderer/src/components/maquina/TirasSection.tsx
# No diagnostics found

# TypeCheck del proyecto web:
$ npx tsc --noEmit -p tsconfig.web.json
# Solo warnings pre-existentes en archivos de test (unused vars)
# TirasSection.tsx: limpio
```

### Dependencias utilizadas

| Módulo | Uso |
|--------|-----|
| `react` (useState, useEffect, useCallback) | Estado local, sincronización, callbacks |
| `@renderer/types/config` | Tipo `TicketConfig` para tipado fuerte de las props |

---

## Detalle de lo realizado (8.5)

### ¿Qué se hizo?

Se reemplazó el placeholder de **MaquinaView.tsx** con la vista completa que integra las 4 secciones de configuración y proporciona el botón "Guardar" que persiste todos los cambios acumulados en la base de datos vía IPC (`config:updateMaquina`).

Este es el paso de integración que conecta todos los componentes creados anteriormente (8.1-8.4) con la capa de persistencia, replicando el comportamiento exacto del legacy `MaquinaView.vue` donde:
- Todos los campos se editan localmente
- Solo se persiste al pulsar "Guardar" explícitamente
- Se muestra feedback visual de éxito/error tras guardar

### Archivos modificados

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/renderer/src/views/MaquinaView.tsx` | Reescrito | Vista completa con integración de secciones + botón Guardar |

### Código implementado (extracto clave)

```typescript
export default function MaquinaView(): JSX.Element {
  const navigate = useNavigate()
  const { config, loading, error: storeError, loadConfig, updateMaquina } = useConfigStore()

  // Estado local acumula cambios parciales de cada sección
  const [ticketChanges, setTicketChanges] = useState<Partial<TicketConfig>>({})
  const [codigoChanges, setCodigoChanges] = useState<Partial<CodigoConfig>>({})

  // Estado del guardado
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Merged config = original + cambios locales (para pasar a hijos)
  const mergedTicket = useMemo(() => {
    if (!ticket) return undefined
    return { ...ticket, ...ticketChanges }
  }, [ticket, ticketChanges])

  const mergedCodigo = useMemo(() => {
    if (!codigo) return undefined
    return { ...codigo, ...codigoChanges }
  }, [codigo, codigoChanges])

  // Handler de guardado: persiste via IPC y resetea estado local
  const handleGuardar = useCallback(async () => {
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      await updateMaquina({
        ticket: ticketChanges,
        codigo: codigoChanges
      })
      // Reset local changes since they are now persisted
      setTicketChanges({})
      setCodigoChanges({})
      setSaveSuccess(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al guardar la configuración'
      setSaveError(message)
    } finally {
      setSaving(false)
    }
  }, [ticketChanges, codigoChanges, updateMaquina])

  // ...render con las 4 secciones + botones header/footer
}
```

### Flujo de datos completo (guardado)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           MaquinaView                                         │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │CodigoSection│  │TicketSection│  │RollosSection│  │TirasSection │       │
│  │ onChange()  │  │ onChange()  │  │ onChange()  │  │ onChange()  │       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │
│         │                 │                 │                 │              │
│         ▼                 ▼                 ▼                 ▼              │
│  codigoChanges      ticketChanges     ticketChanges     ticketChanges       │
│  { modo: "F",       { empresa: "...", { rollo1: 1200,   { T1especial: 2,   │
│    pais: "AD" }       limiteImporte:     rollo2: 1500 }   TEmod1: "S" }     │
│                       350 }                                                  │
│         │                 │                 │                 │              │
│         └─────────────────┴─────────────────┴─────────────────┘              │
│                                    │                                         │
│                                    ▼                                         │
│                        ┌──────────────────────┐                              │
│                        │  Botón "Guardar"     │                              │
│                        │  handleGuardar()     │                              │
│                        └──────────┬───────────┘                              │
│                                   │                                          │
└───────────────────────────────────┼──────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  configStore.updateMaquina()  │
                    │  → ipc.updateMaquina({        │
                    │      ticket: ticketChanges,   │
                    │      codigo: codigoChanges    │
                    │    })                         │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  Main Process (IPC Handler)   │
                    │  → configRepo.updateMaquina() │
                    │  → SQLite: UPDATE config      │
                    │  → Notifica cambio a renderer │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  Store refresca config        │
                    │  → ipc.getConfig()            │
                    │  → set({ config: newConfig }) │
                    │  → Zustand notifica subs      │
                    │  → UI se actualiza            │
                    └───────────────────────────────┘
```

### Estructura del header y footer

```
┌─────────────────────────────────────────────────────────────────────┐
│  Máquina          [Guardar]        Configuración de código,         │
│  (h1 heading)     (botón gris)     ticket y rollos (subtítulo)      │
├─────────────────────────────────────────────────────────────────────┤
│  [Configuración guardada correctamente]  ← banner verde (si éxito)  │
│  [Error al guardar: ...]                 ← banner rojo (si error)   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  CodigoSection (colapsable)                                         │
│  TicketSection (colapsable)                                         │
│  RollosSection                                                      │
│  TirasSection (colapsable)                                          │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│           [Guardar]    [Cancelar]                                    │
│           (gris)       (gris claro → /home)                         │
└─────────────────────────────────────────────────────────────────────┘
```

### Mapeo con el legacy MaquinaView.vue

| Legacy (Vue 3) | Nuevo (React) | Notas |
|----------------|---------------|-------|
| `<button @click="guardar">Guardar</button>` (2 instancias) | 2 botones `onClick={handleGuardar}` (header + footer) | Misma duplicación intencional |
| `<router-link to="/home">Cancelar</router-link>` | `<button onClick={() => navigate('/home')}>Cancelar</button>` | Navegación programática |
| `async function guardar()` que construye `updatedConfig` manualmente | `handleGuardar()` que envía `ticketChanges` + `codigoChanges` directamente | Más limpio: solo envía los cambios parciales |
| `await updateMaquina(updatedConfig)` → Meteor method | `await updateMaquina({ ticket, codigo })` → IPC channel | Misma semántica, diferente transporte |
| `router.push('/maquina')` tras guardar | Permanece en la vista + muestra banner de éxito | Mejor UX: el usuario ve confirmación sin salir |
| Sin feedback visual de éxito/error | Banner verde (éxito) / rojo (error) con auto-dismiss | Mejora sobre el legacy |
| `watch(config, ...)` sincroniza form | `useEffect([config])` + merged config via `useMemo` | Mismo patrón reactivo |
| `<button @click="exportarXLS">Exportar XLS</button>` | Pendiente (tarea 8.6) | Se implementará en el siguiente paso |

### Diferencias clave con el legacy

| Aspecto | Legacy | Nuevo | Justificación |
|---------|--------|-------|---------------|
| Feedback de guardado | Ninguno (silencioso) | Banner verde/rojo con mensaje | Mejor UX, el vendedor confirma que guardó |
| Navegación tras guardar | `router.push('/maquina')` (recarga) | Permanece en la vista con config refrescada | Menos disruptivo |
| Botón Guardar deshabilitado durante save | No (podía hacer doble-click) | `disabled={saving}` + texto "Guardando..." | Previene doble guardado |
| Botón Guardar deshabilitado sin config | No (error en runtime si config null) | `disabled={saving \|\| loading \|\| !config}` | Previene errores |
| Datos enviados | Objeto completo reconstruido | Solo los campos que cambiaron (partial) | Más eficiente, menos propenso a sobrescribir datos no modificados |

### Estados del componente MaquinaView

| Estado | Tipo | Inicialización | Descripción |
|--------|------|----------------|-------------|
| `ticketChanges` | `Partial<TicketConfig>` | `{}` | Cambios acumulados de TicketSection, RollosSection y TirasSection |
| `codigoChanges` | `Partial<CodigoConfig>` | `{}` | Cambios acumulados de CodigoSection |
| `saving` | boolean | `false` | Indica si hay un guardado en progreso |
| `saveSuccess` | boolean | `false` | Indica éxito del último guardado (auto-dismiss 3s) |
| `saveError` | string \| null | `null` | Mensaje de error del último intento de guardado |

### Valores derivados (useMemo)

| Nombre | Dependencias | Cálculo |
|--------|-------------|---------|
| `nombreModelo1` | `sello` | `sello.eventos[elevento].motivoi ?? sello.modelo1` |
| `nombreModelo2` | `sello` | `sello.eventos[elevento].motivod ?? sello.modelo2` |
| `activeProfileName` | `sello` | `sello.elnperfil ?? 'FERIA'` |
| `feriaDisplay` | `sello`, `config` | `sello.feria ?? config.ticket.feria` |
| `lugarDisplay` | `sello`, `config` | `sello.lugar ?? config.ticket.lugar` |
| `mergedTicket` | `ticket`, `ticketChanges` | `{ ...ticket, ...ticketChanges }` |
| `mergedCodigo` | `codigo`, `codigoChanges` | `{ ...codigo, ...codigoChanges }` |

### Callbacks (useCallback)

| Nombre | Dependencias | Propósito |
|--------|-------------|-----------|
| `handleCodigoChange` | `[]` | Acumula cambios parciales de CodigoSection |
| `handleTicketChange` | `[]` | Acumula cambios parciales de Ticket/Rollos/Tiras |
| `handleInsertOrder` | `[]` | Inserta orden de auditoría vía IPC (para RollosSection) |
| `handleGuardar` | `[ticketChanges, codigoChanges, updateMaquina]` | Persiste todos los cambios vía IPC |

### Accesibilidad

| Elemento | Atributo | Valor |
|----------|----------|-------|
| Título principal | `<h1>` | "Máquina" (semantic heading) |
| Botón Guardar header | `aria-label` | "Guardar configuración de máquina" |
| Banner éxito | `role="status"`, `aria-live="polite"` | Se anuncia a lectores de pantalla |
| Banner error | `role="alert"` | Se anuncia urgentemente a lectores de pantalla |
| Botones footer | Texto visible suficiente | "Guardar", "Cancelar" |

### Decisiones de diseño

#### ¿Por qué el header siempre se muestra incluso durante la carga?

En el diseño anterior (placeholder), si la config no estaba cargada se mostraba una pantalla vacía con "Cargando...". Esto causaba que los tests de navegación fallaran porque buscaban el heading "Máquina".

La solución actual siempre renderiza el header (título + botón Guardar + subtítulo) y solo muestra el loading en la zona de contenido del formulario. Esto:
- Permite que los tests de navegación pasen (encuentran el heading)
- Da contexto visual al usuario de dónde está mientras se carga
- Deshabilita el botón Guardar hasta que la config esté lista

#### ¿Por qué se envían partials y no el objeto completo reconstruido?

El legacy reconstruía un objeto `updatedConfig` completo con todos los campos antes de enviar. El nuevo diseño envía solo `{ ticket: ticketChanges, codigo: codigoChanges }` donde los cambios son parciales. Ventajas:

1. **Merge en el backend**: El handler IPC (`config.handlers.ts`) hace un merge profundo con la config existente, por lo que solo los campos modificados se sobrescriben.
2. **Menos riesgo de race conditions**: Si otro proceso modificó un campo que el usuario no tocó, no se sobrescribe.
3. **Menos datos por el wire**: Solo se transmite lo que cambió.
4. **Estado inicial vacío `{}`**: Si el usuario no modifica nada y pulsa Guardar, no se produce ningún cambio (no-op seguro).

#### ¿Por qué `handleTicketChange` se comparte entre TicketSection, RollosSection y TirasSection?

Las tres secciones modifican campos de `TicketConfig`:
- TicketSection → empresa, cif, cp, l1-l3, eltitulo, limites, fecha, hora, copias
- RollosSection → rollo1, rollo2, tickets, limiteTickets
- TirasSection → T1especial, T2especial, T3especial, TEmod1, TEmod2

Todas propagan cambios al mismo objeto parcial `ticketChanges`. Usar un solo callback `handleTicketChange` simplifica el diseño y evita crear 3 estados separados que luego habría que combinar al guardar.

#### ¿Por qué el banner de éxito se auto-disminuye a los 3 segundos?

Es un patrón UX estándar para feedback temporal ("toast"). El vendedor necesita confirmación de que guardó, pero no quiere que el banner persista indefinidamente y ocupe espacio visual. 3 segundos es suficiente para leer "Configuración guardada correctamente" sin ser intrusivo.

### Dependencias utilizadas

| Módulo | Uso |
|--------|-----|
| `react` (useState, useEffect, useMemo, useCallback) | Estado, efectos, memoización, callbacks estables |
| `react-router-dom` (useNavigate) | Navegación programática (Cancelar → /home) |
| `@renderer/stores/config.store` | Estado global de config + acción `updateMaquina` |
| `@renderer/lib/ipc-client` | `insertOrders` para auditoría de rollos |
| `@renderer/types/config` | Tipos `CodigoConfig`, `TicketConfig` |
| `@renderer/types/order` | Tipo `OrderLine` para el callback de auditoría |
| `@renderer/components/maquina/CodigoSection` | Sección de código (8.1) |
| `@renderer/components/maquina/TicketSection` | Sección de ticket (8.2) |
| `@renderer/components/maquina/RollosSection` | Sección de rollos (8.3) |
| `@renderer/components/maquina/TirasSection` | Sección de tiras (8.4) |

### Verificación

```bash
# TypeScript compila sin errores:
$ getDiagnostics src/renderer/src/views/MaquinaView.tsx
# No diagnostics found

# TypeCheck del proyecto web:
$ npx tsc --noEmit -p tsconfig.web.json
# Sin errores en MaquinaView.tsx

# Test de navegación para MaquinaView pasa:
$ npx vitest run -t "renders MaquinaView"
# ✓ renders MaquinaView at /maquina (175ms)

# Config store tests pasan (14/14):
$ npx vitest run src/renderer/src/stores/__tests__/config.store.test.ts
# Tests: 14 passed (14)
```

---

## Detalle de lo realizado (8.6)

### ¿Qué se hizo?

Se implementó el botón **"Exportar XLS"** en el footer de MaquinaView, que permite al vendedor descargar un informe CSV con todas las ventas registradas. Replica la funcionalidad "exportarXLS" del legacy.

El botón llama a `downloadCSV()` vía IPC, recibe el contenido del CSV generado por el repositorio de órdenes, y dispara una descarga del fichero `reporte-ATM.csv` en el navegador embebido de Electron.

### Archivos modificados

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/renderer/src/views/MaquinaView.tsx` | Modificado | Añadido import, estado, handler y botón de exportación |

### Cambios realizados en MaquinaView.tsx

#### 1. Import añadido

```typescript
import { downloadCSV } from '@renderer/lib/ipc-client'
```

#### 2. Estado de exportación

```typescript
// Export operation state
const [exporting, setExporting] = useState(false)
const [exportError, setExportError] = useState<string | null>(null)
```

#### 3. Handler `handleExportXLS`

```typescript
const handleExportXLS = useCallback(async () => {
  setExportError(null)
  setExporting(true)
  try {
    const fileContent = await downloadCSV()
    if (fileContent) {
      const nameFile = 'reporte-ATM.csv'
      const blob = new Blob([fileContent], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = nameFile
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  } catch (err) {
    console.error('[MaquinaView] Error exporting CSV:', err)
    setExportError('Error al exportar. Inténtelo de nuevo.')
  } finally {
    setExporting(false)
  }
}, [])
```

#### 4. Botón en el footer

```tsx
<button
  type="button"
  className="bg-[#212F5D] text-white px-4 py-2 rounded font-semibold hover:bg-[#2d3f7a]
             focus:outline-none focus:ring-2 focus:ring-[#212F5D] disabled:opacity-50 disabled:cursor-not-allowed"
  onClick={handleExportXLS}
  disabled={exporting}
  aria-label="Exportar informe XLS"
>
  {exporting ? 'Exportando...' : 'Exportar XLS'}
</button>
```

#### 5. Mensaje de error de exportación

```tsx
{exportError && (
  <div
    className="mx-4 mb-4 p-2 bg-red-100 text-red-800 rounded text-center"
    role="alert"
  >
    {exportError}
  </div>
)}
```

### Estructura visual del footer actualizado

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│           [Guardar]    [Exportar XLS]    [Cancelar]                  │
│           (gris)       (azul #212F5D)    (gris claro → /home)       │
│                                                                     │
│           [Error al exportar. Inténtelo de nuevo.]  ← rojo (si err) │
└─────────────────────────────────────────────────────────────────────┘
```

### Flujo de la exportación

```
┌────────────────────────────────────────────────────────────────────┐
│  Vendedor pulsa "Exportar XLS"                                     │
│         │                                                          │
│         ▼                                                          │
│  setExporting(true) → botón muestra "Exportando..." (disabled)     │
│         │                                                          │
│         ▼                                                          │
│  downloadCSV()                                                     │
│  → window.electronAPI.orders.downloadCSV()                         │
│  → IPC channel "orders:downloadCSV"                                │
│  → ordersRepository.exportCSV()                                    │
│  → SELECT * FROM orders → genera CSV con separador ";"             │
│  → devuelve string con contenido CSV                               │
│         │                                                          │
│         ▼                                                          │
│  Renderer recibe fileContent (string CSV)                          │
│         │                                                          │
│         ▼                                                          │
│  Crear Blob + Object URL                                           │
│  → document.createElement('a')                                     │
│  → a.href = url, a.download = "reporte-ATM.csv"                   │
│  → a.click() → dispara descarga nativa del navegador               │
│  → cleanup: removeChild + revokeObjectURL                          │
│         │                                                          │
│         ▼                                                          │
│  setExporting(false) → botón vuelve a "Exportar XLS"              │
└────────────────────────────────────────────────────────────────────┘
```

### Mapeo con el legacy

| Legacy (Vue 3 / Meteor) | Nuevo (React / Electron) | Notas |
|--------------------------|--------------------------|-------|
| `exportarXLS()` → `Meteor.call('orders.export')` | `downloadCSV()` → IPC `orders:downloadCSV` | Mismo resultado, sin servidor |
| Respuesta: descarga forzada vía servidor HTTP | Respuesta: Blob + `<a download>` | Offline-first, sin red |
| Formato: CSV separado por ";" | Formato: CSV separado por ";" | Idéntico |
| Nombre archivo: configurable | Nombre archivo: `reporte-ATM.csv` (fijo) | Simplificado |

### Patrón compartido con HomeView

El handler `handleExportXLS` en MaquinaView es idéntico al `handleExportCSV` en HomeView. Ambos:
1. Llaman a `downloadCSV()` del ipc-client
2. Crean un Blob con el contenido
3. Generan un Object URL
4. Disparan la descarga via un `<a>` temporal
5. Limpian el DOM y la URL

Este patrón podría extraerse a un hook compartido (`useExportCSV`) en el futuro, pero por ahora se mantiene inline para evitar abstracciones prematuras dado que solo se usa en 2 sitios.

### Diferencias con el botón en HomeView

| Aspecto | HomeView | MaquinaView |
|---------|----------|-------------|
| Estilo | Icono SVG grande + label "EXPORTAR CSV" | Botón con texto "Exportar XLS" (azul sólido) |
| Ubicación | Centro de la pantalla principal | Footer junto a Guardar y Cancelar |
| Label aria | "Exportar informe CSV" | "Exportar informe XLS" |
| Texto loading | "EXPORTANDO..." | "Exportando..." |
| Error display | `<p role="alert">` inline | `<div role="alert">` banner abajo del footer |

El nombre "XLS" se mantiene por compatibilidad con el legacy (el vendedor está acostumbrado a ese término), aunque el formato real es CSV (que Excel abre sin problemas).

### Accesibilidad

| Elemento | Atributo | Valor |
|----------|----------|-------|
| Botón | `aria-label` | `"Exportar informe XLS"` |
| Botón | `disabled` | `true` mientras exporta |
| Div error | `role="alert"` | Anuncia error inmediatamente a lectores de pantalla |
| Botón | focus ring | `focus:ring-2 focus:ring-[#212F5D]` |

### Verificación

```bash
# TypeScript compila sin errores:
$ getDiagnostics src/renderer/src/views/MaquinaView.tsx
# No diagnostics found

# TypeCheck del proyecto web:
$ npx tsc --noEmit -p tsconfig.web.json
# Solo warnings pre-existentes en archivos de test (unused vars)
# MaquinaView.tsx: limpio
```

### Dependencias utilizadas

| Módulo | Uso |
|--------|-----|
| `react` (useState, useCallback) | Estado de loading/error, handler memoizado |
| `@renderer/lib/ipc-client` | `downloadCSV()` — wrapper tipado sobre IPC |

---

## Próximos pasos

| Subtarea | Componente | Descripción breve |
|----------|-----------|-------------------|
| 8.7 | Verificación | Cambiar config en Máquina, guardar, navegar a Kiosko y confirmar que los datos se reflejan |

### Notas para 8.7

- Verificación manual: modificar un campo en Máquina (ej: precio tarifa A), guardar, navegar a Kiosko, y confirmar que los límites se recalculan con el nuevo precio.
- Verificar que los contadores de rollo en Kiosko reflejan los valores actualizados desde Máquina.
- Verificar que el código de etiqueta en el preview (StampModels) se actualiza con los nuevos parámetros de código.
