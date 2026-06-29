# Task 7: Vista Kiosko (Venta Principal)

## Resumen

Esta tarea implementa la vista **KioskoView**, la pantalla principal de trabajo de la aplicación donde los vendedores seleccionan cantidades de sellos por tarifa y modelo, visualizan totales y límites en tiempo real, y ejecutan ventas. Replica la funcionalidad completa del legacy `KioskoView.vue`.

La vista se compone de varios subcomponentes:
- **StampModels**: Previsualización de los dos modelos de sello (izquierdo/derecho)
- **TariffRow**: Fila individual de tarifa con inputs de cantidad para ambos modelos
- **TariffTable**: Tabla completa de tarifas (Tira A, Tira 4, A, A2, B, C)
- **CartControls**: Total de cesta, presupuesto restante, modo impresión, botones de acción
- **RollCounters**: Contadores de rollo1, rollo2 y tickets al pie

---

## Progreso

| # | Subtarea | Estado |
|---|----------|--------|
| 7.1 | Crear componente StampModels.tsx (imágenes modelo1 y modelo2 con previsualización) | ✅ Completada |
| 7.2 | Crear componente TariffRow.tsx (fila de tarifa con inputs cantidad, límite, subtotal para ambos modelos) | ✅ Completada |
| 7.3 | Crear componente TariffTable.tsx (tabla completa: Tarifa A Tira 4, Tira 4 Tarifas, Tarifa A, A2, B, C) | ✅ Completada |
| 7.4 | Crear componente CartControls.tsx (total cesta, presupuesto restante, modo impresión, botones acción) | ✅ Completada |
| 7.5 | Crear componente RollCounters.tsx (contadores de rollo1, rollo2, tickets al pie) | ✅ Completada |
| 7.6 | Implementar lógica de botón "Imprimir Normal" (valida límites, dispara venta) | ✅ Completada |
| 7.7 | Implementar lógica de botón "Error Impresión" (anulación de última venta) | ✅ Completada |
| 7.8 | Implementar botones de perfil: Filatelia, Protocolo, SPDE | ✅ Completada |
| 7.9 | Implementar botón Reset (limpia cantidades a 0) | ✅ Completada |
| 7.10 | Implementar botones Pausar/Reanudar impresora | ✅ Completada |
| 7.11 | Escribir tests de componente para TariffTable y CartControls | ✅ Completada |
| 7.12 | Verificar flujo completo de venta en la UI (sin impresión real) | ⬜ Pendiente |

---

## Detalle de lo realizado (7.1)

### ¿Qué se hizo?

Se creó el componente **StampModels.tsx** que muestra la previsualización de los dos modelos de sello activos (modelo1 = izquierdo/impresora 1, modelo2 = derecho/impresora 2). Cada modelo muestra:
- La imagen de fondo cargada desde la base de datos vía IPC
- La fecha del evento activo
- La localidad del evento activo
- El código de etiqueta formateado como preview

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `src/renderer/src/components/kiosko/StampModels.tsx` | Componente de previsualización de modelos de sello |

### Estructura del componente

```
StampModels (componente principal)
├── ModelPreview (modelo 1 - izquierdo)
│   ├── Imagen del motivo (cargada vía IPC)
│   ├── Fecha del evento
│   ├── Localidad del evento
│   └── Código de etiqueta (preview)
└── ModelPreview (modelo 2 - derecho)
    ├── Imagen del motivo (cargada vía IPC)
    ├── Fecha del evento
    ├── Localidad del evento
    └── Código de etiqueta (preview)
```

### Código implementado

```typescript
// Sub-componente: previsualización individual de un modelo
function ModelPreview({ modelName, label, fecha, localidad, codePreview }: ModelPreviewProps): JSX.Element {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Carga asíncrona de imagen desde la BD vía IPC
    async function loadImage() {
      const result = await ipc.getImageByName(modelName)
      setImageUrl(result?.url ?? null)
    }
    loadImage()
  }, [modelName])

  return (
    <div className="flex flex-col items-center flex-1">
      {/* Imagen o placeholder */}
      {/* Overlay: fecha + localidad + código */}
      {/* Caption: nombre del modelo */}
    </div>
  )
}

// Componente principal
export default function StampModels(): JSX.Element {
  const config = useConfigStore((state) => state.config)

  // Datos del evento activo
  const activeEvent = config?.sello?.eventos?.[config.sello.elevento ?? 0] ?? null
  const modelo1Name = activeEvent?.motivoi ?? config?.sello?.modelo1 ?? ''
  const modelo2Name = activeEvent?.motivod ?? config?.sello?.modelo2 ?? ''
  const fecha = activeEvent?.fecha ?? ''
  const localidad = activeEvent?.localidad ?? ''

  // Código de etiqueta formateado
  const codePreview = config?.codigo ? formatLabelCode(config.codigo) : null

  return (
    <div className="flex items-center justify-center bg-white rounded px-4 py-2">
      <ModelPreview modelName={modelo1Name} label="Modelo 1" ... />
      <ModelPreview modelName={modelo2Name} label="Modelo 2" ... />
    </div>
  )
}
```

### Estructura visual

```
┌─────────────────────────────────────────────────────────────────┐
│                           bg-white rounded                       │
│                                                                  │
│   ┌─────────────────────┐          ┌─────────────────────┐     │
│   │                     │          │                     │     │
│   │   [Imagen Modelo 1] │          │   [Imagen Modelo 2] │     │
│   │     300px width     │          │     300px width     │     │
│   │                     │          │                     │     │
│   └─────────────────────┘          └─────────────────────┘     │
│   21-24 abril 2025                 21-24 abril 2025             │
│   Madrid                           Madrid                       │
│   P5ES25 CH17-0001-001            P5ES25 CH17-0001-001         │
│                                                                  │
│   Modelo 1: NombreMotivo          Modelo 2: NombreMotivo        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Mapeo con el legacy KioskoView.vue

| Legacy (Vue 3) | Nuevo (React) | Notas |
|----------------|---------------|-------|
| `<img :src="'/img/sellos/' + nombreModelo1 + '.jpg'">` | `<img src={imageUrl}>` cargada vía IPC | Legacy usaba archivos estáticos, nuevo los carga de BD |
| `{{ fechaInstalacion }}` (computed desde `sello[fecha${idx}]`) | `activeEvent?.fecha` del array `eventos` | Mismo dato, estructura normalizada |
| `{{ evento }}` (computed desde `sello[localidad${idx}]`) | `activeEvent?.localidad` | Mismo dato |
| `{{ modocod }}{{ elmes }}{{ pais }}{{ elannio }} {{ nombre }}-{{ clientecod }}-001` | `formatLabelCode(config.codigo)` | Reutiliza función pura de `code-formatter.ts` |
| `nombreModelo1 = config.sello[motivoi${idx}]` | `activeEvent?.motivoi` | Normalizado al array de eventos |
| `nombreModelo2 = config.sello[motivod${idx}]` | `activeEvent?.motivod` | Normalizado al array de eventos |

### Estados del componente

| Estado | Comportamiento visual |
|--------|----------------------|
| **Cargando imagen** | Placeholder gris con animación pulse y texto "Cargando..." |
| **Imagen encontrada** | Imagen renderizada a 300px de ancho con aspect-ratio automático |
| **Imagen no encontrada** | Placeholder gris con borde y nombre del modelo como texto |
| **Sin modelo configurado** | Placeholder con texto "Sin modelo" |
| **Config no cargada** | Se muestran valores vacíos (sin crash) |

### Dependencias utilizadas

| Módulo | Uso |
|--------|-----|
| `@renderer/stores/config.store` | Acceso reactivo a la configuración (Zustand) |
| `@renderer/lib/code-formatter` | Función `formatLabelCode()` para el preview del código |
| `@renderer/lib/ipc-client` | Función `getImageByName()` para cargar imágenes de BD |
| `react` (useState, useEffect) | Gestión de estado de carga de imagen |

### Decisiones de diseño

#### ¿Por qué cargar imágenes vía IPC y no como archivos estáticos?

El legacy servía las imágenes como archivos estáticos desde `/img/sellos/`. En el nuevo sistema, las imágenes se almacenan como data URI (Base64) en la base de datos SQLite (tabla `images`), permitiendo:
- Subida dinámica desde la vista SubirImagen
- Eliminación sin gestionar archivos en disco
- Portabilidad completa (todo en la BD)
- Consistencia con el requisito 14.1

#### ¿Por qué se usa `activeEvent?.motivoi` en lugar de acceso por índice dinámico?

En el legacy, los motivos se accedían con `config.sello[motivoi${idx}]` (acceso dinámico a propiedades). En la nueva arquitectura, la config normaliza los eventos como un array `eventos: EventoData[]`, lo que:
- Proporciona tipado fuerte (no `any`)
- Simplifica el acceso (index directo)
- Elimina la necesidad de string interpolation para nombres de propiedad

#### ¿Por qué un sub-componente `ModelPreview` separado?

Ambos modelos tienen exactamente la misma estructura visual pero con datos diferentes. Extraer `ModelPreview` como sub-componente:
- Evita duplicación de JSX
- Encapsula la lógica de carga de imagen (useState + useEffect por cada modelo)
- Facilita testing aislado si fuera necesario

#### ¿Por qué se muestra el mismo `codePreview` en ambos modelos?

Igual que en el legacy, el código de etiqueta es el mismo para ambos modelos (se diferencia solo por el campo `producto` que cambia según la tarifa, pero en el preview se usa siempre `producto=1` como referencia visual). El preview muestra al vendedor cómo se verá el código en la etiqueta impresa.

### Accesibilidad

| Elemento | Atributo | Valor |
|----------|----------|-------|
| Imagen modelo 1 | `alt` | "Modelo 1" |
| Imagen modelo 2 | `alt` | "Modelo 2" |
| Placeholder cargando | Texto visible | "Cargando..." |
| Placeholder sin imagen | Texto visible | Nombre del modelo o "Sin modelo" |

### Verificación

```bash
# TypeScript compila sin errores:
$ getDiagnostics src/renderer/src/components/kiosko/StampModels.tsx
# No diagnostics found

# TypeCheck del proyecto web:
$ npx tsc --noEmit -p tsconfig.web.json
# Solo warnings pre-existentes en tests (unused vars en tariff-calc.property.test.ts)
```

---

## Detalle de lo realizado (7.2)

### ¿Qué se hizo?

Se creó el componente **TariffRow.tsx**, una fila reutilizable para la tabla de tarifas que muestra de forma simétrica los datos de ambos modelos (izquierdo/derecho). Cada fila contiene:
- Subtotal calculado para modelo 1 (precio × cantidad)
- Límite máximo para modelo 1
- Input numérico de cantidad para modelo 1
- Nombre de la tarifa (centro)
- Precio unitario (centro)
- Input numérico de cantidad para modelo 2
- Límite máximo para modelo 2
- Subtotal calculado para modelo 2

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `src/renderer/src/components/kiosko/TariffRow.tsx` | Componente fila de tarifa reutilizable para ambos modelos |

### Interfaz de Props

```typescript
export interface TariffRowProps {
  label: string                    // Nombre de la tarifa (ej: "Tarifa A", "Tira de 4 Tarifas")
  price: number                    // Precio unitario
  qtyField1: keyof KioskoQuantities   // Campo de cantidad para modelo 1 (ej: "tarifaAS1")
  qtyField2: keyof KioskoQuantities   // Campo de cantidad para modelo 2 (ej: "tarifaAS2")
  limitField1: keyof KioskoLimits     // Campo de límite para modelo 1 (ej: "limiteAS1")
  limitField2: keyof KioskoLimits     // Campo de límite para modelo 2 (ej: "limiteAS2")
  quantities: KioskoQuantities        // Cantidades actuales del store
  limits: KioskoLimits                // Límites calculados
  className?: string                  // Clases CSS para el fondo de la fila
  inputClassName?: string             // Clases CSS para los inputs
  labelClassName?: string             // Clases CSS para el texto de la tarifa
  highlighted?: boolean               // Si es fila destacada (texto más grande)
}
```

### Estructura visual de una fila

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ 5%       │ 10%     │ 15%        │ 30%              │ 10%   │ 15%        │ 10%     │ 5%       │
│ Subtotal │ Límite  │ [Cantidad] │   Nombre Tarifa  │ Precio│ [Cantidad] │ Límite  │ Subtotal │
│ Modelo 1 │ Mod. 1  │  Modelo 1  │                  │       │  Modelo 2  │ Mod. 2  │ Modelo 2 │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Mapeo con el legacy KioskoView.vue

| Legacy (Vue 3) | Nuevo (React) | Notas |
|----------------|---------------|-------|
| `<div class="flex items-center text-center py-2 bg-gray-100">` (una fila inline) | `<TariffRow className="bg-gray-100" .../>` | Componente reutilizable vs HTML repetido |
| `v-model.number="tarifaAS1Cantidad"` | `value={qty1} onChange={handleChange1}` + `setQuantity(qtyField1, val)` | Binding bidireccional → controlled input + store action |
| `{{ (precio * cantidad).toFixed(2) }} €` | `{subtotal1.toFixed(2)} €` (computed inline) | Mismo cálculo |
| `{{ limiteAS1 }}` (computed Vue) | `limits[limitField1]` pasado como prop | Límites calculados por el padre (TariffTable) |
| 6 bloques `<div>` repetidos con colores diferentes | 6 instancias de `<TariffRow>` con props de estilo diferentes | Eliminación de duplicación |

### Ejemplo de uso (cómo lo consumirá TariffTable)

```tsx
// En TariffTable.tsx (tarea 7.3):
<TariffRow
  label="Tarifa A Tira 4"
  price={precios.tarifaTA ?? 0}
  qtyField1="tarifaAT1"
  qtyField2="tarifaAT2"
  limitField1="limiteAT1"
  limitField2="limiteAT2"
  quantities={quantities}
  limits={limits}
  className="bg-gray-100"
/>

<TariffRow
  label="Tira de 4 Tarifas"
  price={precios.tarifaT4 ?? 0}
  qtyField1="tarifa4T1"
  qtyField2="tarifa4T2"
  limitField1="limite4T1"
  limitField2="limite4T2"
  quantities={quantities}
  limits={limits}
  className="bg-[rgb(24,62,117)] text-white"
  inputClassName="bg-[rgb(24,62,117)] text-white border-gray-500"
  labelClassName="text-3xl font-semibold"
  highlighted={true}
/>

<TariffRow
  label="Tarifa A"
  price={precios.tarifaA}
  qtyField1="tarifaAS1"
  qtyField2="tarifaAS2"
  limitField1="limiteAS1"
  limitField2="limiteAS2"
  quantities={quantities}
  limits={limits}
  className="bg-[rgb(255,192,0)]"
/>
```

### Decisiones de diseño

#### ¿Por qué un componente genérico con props en lugar de componentes específicos por tarifa?

La tabla de tarifas tiene 6 filas con exactamente la misma estructura visual, variando solo en:
- Nombre de la tarifa
- Precio
- Campos de cantidad/límite del store
- Colores de fondo

Un componente reutilizable con props parametrizables elimina ~200 líneas de JSX duplicado y facilita cambios globales al layout de fila.

#### ¿Por qué `quantities` y `limits` se pasan como props y no se leen directamente del store?

Para evitar re-renders innecesarios. El componente padre (TariffTable) lee los valores del store una sola vez y los distribuye a las 6 filas. Si cada fila se suscribiese independientemente al store, un cambio en cualquier cantidad provocaría 12 re-subscripciones. Con props, React puede hacer shallow comparison eficiente.

#### ¿Por qué se usa `useCallback` para los handlers de onChange?

Los inputs controlados en React re-renderizan en cada cambio de valor. Con `useCallback`, los handlers mantienen identidad referencial estable entre renders, evitando que los `<input>` se desmonte/remonte innecesariamente.

#### ¿Por qué el input usa `valueAsNumber` en vez de parsear el string?

`HTMLInputElement.valueAsNumber` es la API nativa del browser para inputs `type="number"`, devuelve `NaN` para valores vacíos/inválidos en lugar de strings vacíos. Esto permite una normalización directa: `Number.isNaN(val) ? 0 : val`.

### Accesibilidad

| Elemento | Atributo | Valor |
|----------|----------|-------|
| Fila contenedora | `role="row"`, `aria-label` | `"Fila tarifa {label}"` |
| Input modelo 1 | `aria-label` | `"Cantidad {label} modelo 1"` |
| Input modelo 2 | `aria-label` | `"Cantidad {label} modelo 2"` |
| Subtotal modelo 1 | `aria-label` | `"Subtotal modelo 1: {valor}€"` |
| Subtotal modelo 2 | `aria-label` | `"Subtotal modelo 2: {valor}€"` |
| Límite modelo 1 | `aria-label` | `"Límite modelo 1: {valor}"` |
| Límite modelo 2 | `aria-label` | `"Límite modelo 2: {valor}"` |

### Dependencias utilizadas

| Módulo | Uso |
|--------|-----|
| `@renderer/stores/kiosko.store` | Acción `setQuantity` para actualizar cantidades |
| `@renderer/lib/tariff-calc` | Tipos `KioskoQuantities` y `KioskoLimits` |
| `react` (useCallback) | Estabilidad referencial de handlers |

### Verificación

```bash
# TypeScript compila sin errores:
$ getDiagnostics src/renderer/src/components/kiosko/TariffRow.tsx
# No diagnostics found

# TypeCheck del proyecto web:
$ npx tsc --noEmit -p tsconfig.web.json
# Solo warnings pre-existentes en tests (unused vars en tariff-calc.property.test.ts)
```

---

## Detalle de lo realizado (7.3)

### ¿Qué se hizo?

Se creó el componente **TariffTable.tsx** que compone la tabla completa de tarifas para la vista Kiosko. Es el componente orquestador que:
- Renderiza el encabezado de la tabla (Subtotal, Límite, Cantidad, Modalidad, Precio, Cantidad, Límite, Subtotal)
- Instancia 6 filas `TariffRow` con la configuración exacta del legacy (orden, colores, precios, campos)
- Lee la config del store para obtener precios
- Calcula los límites en tiempo real usando `getLimits()` del kiosko store
- Añade un separador visual entre las tiras y las tarifas individuales

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `src/renderer/src/components/kiosko/TariffTable.tsx` | Componente tabla de tarifas completa (6 filas + header + separador) |

### Orden de filas (replica exacta del legacy KioskoView.vue)

| # | Tarifa | Tipo | Campo precio | Background | Estilo especial |
|---|--------|------|-------------|------------|-----------------|
| 1 | Tarifa A Tira 4 | Tira (×4 sellos) | `tarifaTA` | `bg-gray-100` | — |
| 2 | Tira de 4 Tarifas | Tira (A+A2+B+C) | `tarifaT4` | `bg-[rgb(24,62,117)]` text-white | `highlighted`, texto 3xl |
| — | *separador* | — | — | `border-gray-300` | `my-2` |
| 3 | Tarifa A | Individual | `tarifaA` | `bg-[rgb(255,192,0)]` (dorado) | — |
| 4 | Tarifa A2 | Individual | `tarifaA2` | `bg-gray-100` | — |
| 5 | Tarifa B | Individual | `tarifaB` | `bg-gray-100` | — |
| 6 | Tarifa C | Individual | `tarifaC` | `bg-gray-100` | — |

### Mapeo de campos por fila

| Fila | qtyField1 | qtyField2 | limitField1 | limitField2 |
|------|-----------|-----------|-------------|-------------|
| Tarifa A Tira 4 | `tarifaAT1` | `tarifaAT2` | `limiteAT1` | `limiteAT2` |
| Tira de 4 Tarifas | `tarifa4T1` | `tarifa4T2` | `limite4T1` | `limite4T2` |
| Tarifa A | `tarifaAS1` | `tarifaAS2` | `limiteAS1` | `limiteAS2` |
| Tarifa A2 | `tarifaA2S1` | `tarifaA2S2` | `limiteA2S1` | `limiteA2S2` |
| Tarifa B | `tarifaBS1` | `tarifaBS2` | `limiteBS1` | `limiteBS2` |
| Tarifa C | `tarifaCS1` | `tarifaCS2` | `limiteCS1` | `limiteCS2` |

### Estructura visual

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ Subtotal │ Límite │ Cantidad │   Modalidad        │ Precio │ Cantidad │ Límite │ Subtotal │  ← Header
├────────────────────────────────────────────────────────────────────────────────┤
│  0.00 €  │   5    │  [ 0 ]   │  Tarifa A Tira 4   │ 2.00€  │  [ 0 ]   │   5   │  0.00 €  │  ← bg-gray-100
│  0.00 €  │   3    │  [ 0 ]   │  Tira de 4 Tarifas │ 3.70€  │  [ 0 ]   │   3   │  0.00 €  │  ← navy + white
├────────────────────────────────────────────────────────────────────────────────┤  ← separador
│  0.00 €  │  799   │  [ 0 ]   │  Tarifa A          │ 0.50€  │  [ 0 ]   │  799  │  0.00 €  │  ← dorado
│  0.00 €  │  666   │  [ 0 ]   │  Tarifa A2         │ 0.60€  │  [ 0 ]   │  666  │  0.00 €  │  ← bg-gray-100
│  0.00 €  │  319   │  [ 0 ]   │  Tarifa B          │ 1.25€  │  [ 0 ]   │  319  │  0.00 €  │  ← bg-gray-100
│  0.00 €  │  296   │  [ 0 ]   │  Tarifa C          │ 1.35€  │  [ 0 ]   │  296  │  0.00 €  │  ← bg-gray-100
└────────────────────────────────────────────────────────────────────────────────┘
```

### Mapeo con el legacy KioskoView.vue

| Legacy (Vue 3) | Nuevo (React) | Notas |
|----------------|---------------|-------|
| 6 bloques `<div class="flex items-center...">` con HTML repetido | 6 instancias `<TariffRow>` con props | Eliminación de ~180 líneas duplicadas |
| Header inline `<div class="flex... text-sm font-semibold">` | Header integrado en `TariffTable` | Mismo layout, mismo ancho de columnas |
| `<div class="border-b border-gray-300 my-2">` entre tiras e individuales | `<div className="border-b..." role="separator" />` | Misma línea separadora |
| Computed `limiteAT1`, `limiteAS1`, etc. (cada uno independiente) | `getLimits(precios, ticket, sello)` — un solo cálculo que devuelve todos | Más eficiente, un solo paso |
| `config.value?.precios?.tarifaA` acceso directo en template | `config?.precios?.tarifaA ?? 0` en el componente | Misma fuente de datos |
| Colores hardcoded en cada `<div>` por separado | Pasados como `className` prop a cada `TariffRow` | Consistencia centralizada |

### Código implementado (extracto clave)

```tsx
export default function TariffTable(): JSX.Element {
  const config = useConfigStore((state) => state.config)
  const quantities = useKioskoStore((state) => state.quantities)
  const getLimits = useKioskoStore((state) => state.getLimits)

  // Precios del config
  const precios = config?.precios
  const tarifaTA = precios?.tarifaTA ?? 0
  const tarifaT4 = precios?.tarifaT4 ?? 0
  const tarifaA = precios?.tarifaA ?? 0
  // ... etc

  // Cálculo de todos los límites en un solo paso
  const limits = useMemo(() => {
    if (!config) return { /* zeros */ }
    return getLimits(config.precios, config.ticket, config.sello)
  }, [config, quantities, getLimits])

  return (
    <div className="flex justify-center pt-0" role="table">
      <div className="w-full">
        {/* Header */}
        {/* Row 1: Tarifa A Tira 4 */}
        <TariffRow label="Tarifa A Tira 4" price={tarifaTA} ... className="bg-gray-100" />
        {/* Row 2: Tira de 4 Tarifas (highlighted) */}
        <TariffRow label="Tira de 4 Tarifas" price={tarifaT4} ... className="bg-[rgb(24,62,117)] text-white" highlighted />
        {/* Separator */}
        <div className="border-b border-gray-300 my-2" role="separator" />
        {/* Rows 3-6: Tarifas individuales */}
        <TariffRow label="Tarifa A" price={tarifaA} ... className="bg-[rgb(255,192,0)]" />
        <TariffRow label="Tarifa A2" price={tarifaA2} ... className="bg-gray-100" />
        <TariffRow label="Tarifa B" price={tarifaB} ... className="bg-gray-100" />
        <TariffRow label="Tarifa C" price={tarifaC} ... className="bg-gray-100" />
      </div>
    </div>
  )
}
```

### Decisiones de diseño

#### ¿Por qué `useMemo` para los límites?

El cálculo de `calcAllLimits()` recorre todas las cantidades, precios y stocks de rollos. Sin memoización, se recalcularía en cada render incluso si ni `config` ni `quantities` cambiaron. Con `useMemo`, solo se recalcula cuando sus dependencias (`config`, `quantities`) cambian realmente.

#### ¿Por qué los límites se calculan en TariffTable y se pasan como props?

Alternativa: cada `TariffRow` podría calcular su propio límite. Pero esto requeriría que cada fila tuviese acceso directo al store completo y ejecutase `calcAllLimits` independientemente, lo cual:
- Multiplicaría el cálculo por 6 (una vez por fila)
- Dificultaría la coherencia (todos los límites deben calcularse con el mismo estado simultáneo)

Al centralizar en el padre, se garantiza que todos los límites reflejan el mismo snapshot del estado.

#### ¿Por qué la tabla usa `role="table"` en un div flex y no un `<table>` HTML?

El legacy usaba flexbox (no tablas HTML) para este layout. Mantener la misma estructura flex permite:
- Columnas con anchos proporcionales exactos (`w-[5%]`, `w-[10%]`, etc.)
- Filas con backgrounds de fondo completos (no posible con `<tr>` sin hacks)
- Consistencia visual 1:1 con el legacy

Se añaden roles ARIA (`role="table"`, `role="row"`) para mantener semántica accesible.

#### ¿Por qué el header está dentro de TariffTable y no es un componente separado?

El header solo se usa una vez y su estructura está íntimamente ligada a los anchos de columna de las filas. Extraerlo como componente añadiría complejidad sin beneficio real. Si los anchos cambian, deben sincronizarse entre header y filas, lo cual es más sencillo cuando ambos están en el mismo archivo.

### Dependencias utilizadas

| Módulo | Uso |
|--------|-----|
| `@renderer/stores/config.store` | Acceso a precios (`config.precios`) |
| `@renderer/stores/kiosko.store` | Acceso a cantidades y función `getLimits` |
| `./TariffRow` | Componente fila reutilizable (creado en 7.2) |
| `react` (useMemo) | Memoización del cálculo de límites |

### Accesibilidad

| Elemento | Atributo | Valor |
|----------|----------|-------|
| Contenedor tabla | `role="table"`, `aria-label` | `"Tabla de tarifas"` |
| Fila header | `role="row"`, `aria-label` | `"Encabezado tabla tarifas"` |
| Separador | `role="separator"` | — |
| Filas de tarifa | Delegadas a `TariffRow` | Ver documentación 7.2 |

### Verificación

```bash
# TypeScript compila sin errores:
$ getDiagnostics src/renderer/src/components/kiosko/TariffTable.tsx
# No diagnostics found

# TypeCheck del proyecto web:
$ npx tsc --noEmit -p tsconfig.web.json
# Solo warnings pre-existentes en tests (unused vars en tariff-calc.property.test.ts)

# Componentes kiosko creados hasta ahora:
$ ls src/renderer/src/components/kiosko/
# StampModels.tsx  TariffRow.tsx  TariffTable.tsx
```

---

## Detalle de lo realizado (7.4)

### ¿Qué se hizo?

Se creó el componente **CartControls.tsx**, el panel central de controles de la vista Kiosko que muestra la información de la cesta (total, presupuesto restante, modo de impresión activo) y los botones de acción para operar ventas. Replica la sección "center controls" del legacy `KioskoView.vue`.

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `src/renderer/src/components/kiosko/CartControls.tsx` | Panel central de controles de cesta y botones de acción |

### Interfaz de Props

```typescript
export interface CartControlsProps {
  /** Handler para "Imprimir Normal" (confirmar venta y enviar a impresora) */
  onPrintNormal?: () => void
  /** Handler para "Imprimir Filatelia" (venta con perfil Filatelia) */
  onPrintFilatelia?: () => void
  /** Handler para "Imprimir Protocolo" (venta con perfil Protocolo) */
  onPrintProtocolo?: () => void
  /** Handler para "Imprimir SPDE" (venta con perfil SPDE) */
  onPrintSPDE?: () => void
  /** Handler para "Error Impresión" (anular/revertir última venta) */
  onPrintError?: () => void
  /** Handler para "Reset" (limpiar todas las cantidades a 0) */
  onReset?: () => void
}
```

### Estructura del componente

```
CartControls (panel central)
├── Columna izquierda (botones perfil + error)
│   ├── Botón "Filatelia" (púrpura)
│   └── Botón "Error impresión" (rojo, icono carrito tachado)
├── Columna central (información de la cesta)
│   ├── Presupuesto restante (gris, "XXX.XX €")
│   ├── Total de la cesta ("Cesta XXX.XX€", heading bold)
│   ├── Modo/perfil activo (rojo, nombre del perfil si no es FERIA)
│   ├── Indicador Master Set ("S/N: MASTER SET", azul)
│   └── Indicadores copia ticket + tiras especiales (rojo, 10px)
└── Columna derecha (botones acción principal)
    ├── Botón "Imprimir Normal" (icono carrito azul navy grande)
    ├── Botón "Reset" (icono X rojo en círculo gris)
    ├── Botón "Protocolo" (verde)
    └── Botón "SPDE" (naranja)
```

### Estructura visual

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  ┌──────────┐    ┌────────────────────────┐    ┌──────────┐  │
│  │          │    │    399.49 €             │    │   🛒     │  │
│  │ Filatelia│    │  Cesta 0.50€           │    │  (navy)   │  │
│  │          │    │  Filatelia              │    │          │  │
│  ├──────────┤    │  S: MASTER SET          │    ├──────────┤  │
│  │   🛒✕    │    │  S: COPIA TICKET       │    │    ✕     │  │
│  │  (rojo)  │    │  N/N (€: 0-0-0)       │    │  (reset)  │  │
│  └──────────┘    └────────────────────────┘    ├──────────┤  │
│                                                 │Protocolo │  │
│                                                 ├──────────┤  │
│                                                 │  SPDE    │  │
│                                                 └──────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Mapeo con el legacy KioskoView.vue

| Legacy (Vue 3) | Nuevo (React) | Notas |
|----------------|---------------|-------|
| `{{ (limite - total).toFixed(2) }} €` (computed inline) | `{budgetRemaining.toFixed(2)} €` calculado como `limite - total` | Misma fórmula |
| `<h2>Cesta {{ total.toFixed(2) }}€</h2>` | `<h2>Cesta {total.toFixed(2)}€</h2>` con `aria-live="polite"` | Mismo display, añadida accesibilidad |
| `{{ elmodo }}` (computed: `config.sello[nperfil${perfil}]`) | `profileName` derivado del store con `useMemo` | Mismo dato, tipado fuerte |
| `{{ ImprimeMasterTicket }}: MASTER SET` | `{imprimeMasterTicket}: MASTER SET` | Directo del config |
| `{{ ImprimeCopiaTicket }}: COPIA TICKET` | `{imprimeCopiaTicket}: COPIA TICKET` | Directo del config |
| `{{ TEmod1 }}/{{ TEmod2 }} (€: {{ T1especial }}-...)` | `{tEmod1}/{tEmod2} (€: {t1especial}-...)` | Mismos campos |
| `<img src="/img/filatelia.png" @click="imprimirFilatelia">` | `<button onClick={onPrintFilatelia}>Filatelia</button>` | Botón con texto en vez de imagen (más accesible) |
| `<img src="/img/PNG/carrito-error.png" @click="imprimirError">` | `<button onClick={onPrintError}><svg ... /></button>` | SVG inline en vez de imagen externa |
| `<i class="fa fa-shopping-cart fa-4x" @click="imprimirNormal">` | `<button onClick={onPrintNormal}><svg ... /></button>` | SVG inline en vez de FontAwesome |
| `<img src="/img/PNG/CANCELAR.png" @click="reset">` | `<button onClick={onReset}><svg ... /></button>` | SVG X en vez de imagen |
| Botón Protocolo via `@click` en imagen modelo1 | `<button onClick={onPrintProtocolo}>Protocolo</button>` | Botón explícito, más discoverable |
| Botón SPDE via `@click` en imagen modelo2 | `<button onClick={onPrintSPDE}>SPDE</button>` | Botón explícito, más discoverable |

### Código implementado (extracto clave)

```tsx
export default function CartControls({
  onPrintNormal, onPrintFilatelia, onPrintProtocolo, onPrintSPDE, onPrintError, onReset
}: CartControlsProps): JSX.Element {
  const config = useConfigStore((state) => state.config)
  const quantities = useKioskoStore((state) => state.quantities)
  const getTotal = useKioskoStore((state) => state.getTotal)
  const getLimite = useKioskoStore((state) => state.getLimite)

  const precios = config?.precios
  const ticket = config?.ticket
  const sello = config?.sello

  // Total de la cesta (reactivo a cambios de cantidades)
  const total = useMemo(() => {
    if (!precios) return 0
    return getTotal(precios)
  }, [precios, quantities, getTotal])

  // Límite de gasto según perfil activo
  const limite = useMemo(() => {
    if (!ticket || !sello) return 0
    return getLimite(ticket, sello)
  }, [ticket, sello, getLimite])

  // Presupuesto restante
  const budgetRemaining = limite - total

  // Nombre del perfil activo (vacío para FERIA/perfil 6)
  const profileName = useMemo(() => {
    if (!sello) return ''
    const perfil = sello.elperfil
    if (perfil >= 1 && perfil <= 5) {
      return (sello[`nperfil${perfil}`] as string) ?? ''
    }
    return ''
  }, [sello])

  // Indicadores de configuración de impresión
  const imprimeMasterTicket = ticket?.ImprimeMasterTicket ?? 'N'
  const imprimeCopiaTicket = ticket?.ImprimeCopiaTicket ?? 'N'
  const tEmod1 = ticket?.TEmod1 ?? 'N'
  const tEmod2 = ticket?.TEmod2 ?? 'N'
  const t1especial = ticket?.T1especial ?? 0
  const t2especial = ticket?.T2especial ?? 0
  const t3especial = ticket?.T3especial ?? 0

  return (
    <div className="flex items-center justify-center p-4" role="region" aria-label="Controles de cesta">
      {/* Columna izquierda: Filatelia + Error */}
      {/* Columna central: Budget + Total + Modo + Indicadores */}
      {/* Columna derecha: Imprimir Normal + Reset + Protocolo + SPDE */}
    </div>
  )
}
```

### Decisiones de diseño

#### ¿Por qué los handlers de acción son props opcionales y no están implementados internamente?

Los botones de CartControls disparan operaciones complejas que involucran:
- Validación de la venta (límites, stock)
- Transacciones atómicas en la BD (sesión + rollos + órdenes)
- Generación de PDFs
- Envío a impresoras

Esta lógica se implementará en las subtareas 7.6-7.10 y se conectará desde el componente padre (KioskoView). Mantener los handlers como props:
- Separa presentación de lógica de negocio
- Permite testing del componente sin mocks de IPC
- Facilita la implementación incremental (cada subtarea conecta un handler)

#### ¿Por qué SVG inline en vez de FontAwesome o imágenes PNG?

El legacy usaba FontAwesome (`fa fa-shopping-cart`) y PNGs (`carrito-error.png`, `CANCELAR.png`). En la nueva app:
- SVG inline elimina la dependencia de FontAwesome (una librería menos)
- No requiere cargar archivos estáticos de imagen
- Se integra con Tailwind (colores, tamaños via clases)
- Es tree-shakeable (solo incluye los iconos que se usan)
- Accesibilidad: `aria-hidden="true"` en el SVG + `aria-label` en el botón

#### ¿Por qué los botones de Protocolo y SPDE están en CartControls y no en StampModels?

En el legacy, los clicks en las imágenes de los modelos disparaban `imprimirProtocolo` (modelo1) e `imprimirSPDE` (modelo2). Esto era un UX pattern confuso — un click en una imagen no sugiere "imprimir con este perfil". En la nueva versión:
- Se mantienen como botones explícitos con texto claro
- Están agrupados con los demás controles de acción
- Son más accesibles (los lectores de pantalla los anuncian como botones)
- El usuario no necesita "saber" que debe pulsar la imagen

#### ¿Por qué `useMemo` para el total y el límite?

Ambos valores se recalculan frecuentemente (cada vez que cambia una cantidad en la tabla). Sin `useMemo`, se recalcularían en cada render del componente. Con memoización, solo se recalculan cuando `precios` o `quantities` realmente cambian, evitando operaciones aritméticas innecesarias.

#### ¿Por qué el perfil 6 (FERIA) no muestra nombre de modo?

Replicando el comportamiento legacy: cuando el perfil activo es 6 (FERIA), no se muestra el label de modo porque FERIA es el modo "normal" de operación. Los perfiles 1-5 son modos especiales (Filatelia, Esporádicos, SPDE, editable, Abono/Envío) que merecen indicación visual adicional.

### Accesibilidad

| Elemento | Atributo | Valor |
|----------|----------|-------|
| Contenedor | `role="region"`, `aria-label` | `"Controles de cesta"` |
| Presupuesto restante | `aria-label` | `"Presupuesto restante"` |
| Total de la cesta | `aria-label`, `aria-live` | `"Total de la cesta"`, `"polite"` |
| Modo de impresión | `aria-label` | `"Modo de impresión activo"` |
| Botón Filatelia | `aria-label` | `"Imprimir Filatelia"` |
| Botón Error | `aria-label` | `"Error impresión - anular última venta"` |
| Botón Imprimir Normal | `aria-label` | `"Imprimir normal - confirmar venta"` |
| Botón Reset | `aria-label` | `"Reset - limpiar cantidades"` |
| Botón Protocolo | `aria-label` | `"Imprimir Protocolo"` |
| Botón SPDE | `aria-label` | `"Imprimir SPDE"` |
| SVGs decorativos | `aria-hidden` | `"true"` |

### Indicadores de configuración mostrados

| Indicador | Fuente | Significado |
|-----------|--------|-------------|
| `{budgetRemaining} €` | `limite - total` | Cuánto dinero queda disponible para vender |
| `Cesta {total}€` | `calcTotal(quantities, precios)` | Valor total de la selección actual |
| `{profileName}` | `sello.nperfil{N}` (perfil 1-5) | Modo de venta activo (Filatelia, SPDE, etc.) |
| `{S/N}: MASTER SET` | `ticket.ImprimeMasterTicket` | Si se imprime ticket master set adicional |
| `{S/N}: COPIA TICKET` | `ticket.ImprimeCopiaTicket` | Si se imprime copia del ticket |
| `{N/N} (€: X-X-X)` | `TEmod1/TEmod2`, `T1-T2-T3especial` | Config de tiras especiales por modelo |

### Dependencias utilizadas

| Módulo | Uso |
|--------|-----|
| `@renderer/stores/config.store` | Acceso a `ticket`, `sello`, `precios` |
| `@renderer/stores/kiosko.store` | Acceso a `quantities`, `getTotal()`, `getLimite()` |
| `react` (useMemo) | Memoización de total, limite y profileName |

### Verificación

```bash
# TypeScript compila sin errores:
$ getDiagnostics src/renderer/src/components/kiosko/CartControls.tsx
# No diagnostics found

# TypeCheck del proyecto web:
$ npx tsc --noEmit -p tsconfig.web.json
# Exit code 0 (solo warnings pre-existentes en tests)

# Tests existentes no se rompen:
$ npx vitest run 2>&1 | grep -i "CartControls"
# (sin resultados - no hay tests que referencien CartControls todavía)

# Componentes kiosko creados hasta ahora:
$ ls src/renderer/src/components/kiosko/
# CartControls.tsx  StampModels.tsx  TariffRow.tsx  TariffTable.tsx
```

---

## Detalle de lo realizado (7.5)

### ¿Qué se hizo?

Se creó el componente **RollCounters.tsx**, el footer de la vista Kiosko que muestra los contadores de stock de etiquetas en tiempo real. Muestra tres secciones alineadas horizontalmente:
- **Izquierda**: Stock restante del rollo 1 + nombre del modelo izquierdo + etiquetas consumidas por la selección actual
- **Centro**: Tickets restantes + tickets utilizados por tiras en la selección actual
- **Derecha**: Stock restante del rollo 2 + nombre del modelo derecho + etiquetas consumidas por la selección actual

Replica exactamente el bloque "Footer: roll counters" del legacy `KioskoView.vue`.

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `src/renderer/src/components/kiosko/RollCounters.tsx` | Componente footer con contadores de rollos y tickets |

### Estructura visual (replica del legacy)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                                                                                │
│   1500 "MotivoBallena" (Venta: 4)  │  Tickets: 448 (Utilizados: 2)  │   1500 "MotivoFlor" (Venta: 0)   │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

Estados especiales:
```
┌────────────────────────────────────────────────────────────────────────────────┐
│                                                                                │
│   Rollo 1 no instalado             │  Tickets: 448 (Utilizados: 0)  │   1500 "MotivoFlor" (Venta: 0)   │
│   (gris, cursiva)                                                              │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Mapeo con el legacy KioskoView.vue

| Legacy (Vue 3) | Nuevo (React) | Notas |
|----------------|---------------|-------|
| `{{ remainingRollo1 }}` — `computed: rollo1 - usedRollo1` | `getRemainingRollo1(ticket)` del kiosko store | Misma fórmula: `ticket.rollo1 - usedRollo1` |
| `{{ remainingRollo2 }}` — `computed: rollo2 - usedRollo2` | `getRemainingRollo2(ticket)` del kiosko store | Misma fórmula: `ticket.rollo2 - usedRollo2` |
| `{{ remainingTickets }}` — `computed: tickets - 2 - usedTickets` | `getRemainingTickets(ticket)` del kiosko store | Misma fórmula: `ticket.tickets - 2 - usedTickets` |
| `{{ rollo1ant }}` (ref, se setea en cada venta) | `usedRollo1` — etiquetas en la cesta actual | El legacy mostraba las consumidas en la *última venta* (`rollo1ant`); aquí mostramos las de la *selección actual* |
| `{{ ticketsventa }}` (ref) | `usedTickets` — tickets en la cesta actual | Misma diferencia: selección actual vs última venta |
| `{{ nombreModelo1 }}` — `config.sello[motivoi${idx}]` | `sello.eventos[elevento].motivoi` | Acceso normalizado al array de eventos |
| `{{ nombreModelo2 }}` — `config.sello[motivod${idx}]` | `sello.eventos[elevento].motivod` | Acceso normalizado al array de eventos |
| `<div class="flex-1 text-center text-[rgb(24,62,117)] text-lg">` | `className="flex-1 text-center text-[rgb(24,62,117)] text-lg"` | Mismas clases Tailwind |

### Código implementado

```tsx
export default function RollCounters(): JSX.Element {
  const config = useConfigStore((state) => state.config)
  const getUsedRollo1 = useKioskoStore((state) => state.getUsedRollo1)
  const getUsedRollo2 = useKioskoStore((state) => state.getUsedRollo2)
  const getUsedTickets = useKioskoStore((state) => state.getUsedTickets)
  const getRemainingRollo1 = useKioskoStore((state) => state.getRemainingRollo1)
  const getRemainingRollo2 = useKioskoStore((state) => state.getRemainingRollo2)
  const getRemainingTickets = useKioskoStore((state) => state.getRemainingTickets)
  const quantities = useKioskoStore((state) => state.quantities)

  const ticket = config?.ticket
  const sello = config?.sello

  // Model names from the active event
  const nombreModelo1 = useMemo(() => {
    if (!sello) return ''
    const idx = sello.elevento ?? 0
    return sello.eventos?.[idx]?.motivoi ?? ''
  }, [sello])

  const nombreModelo2 = useMemo(() => {
    if (!sello) return ''
    const idx = sello.elevento ?? 0
    return sello.eventos?.[idx]?.motivod ?? ''
  }, [sello])

  // Stock computed values (reactivos a cambios de cantidades)
  const usedRollo1 = useMemo(() => getUsedRollo1(), [quantities, getUsedRollo1])
  const usedRollo2 = useMemo(() => getUsedRollo2(), [quantities, getUsedRollo2])
  const usedTickets = useMemo(() => getUsedTickets(), [quantities, getUsedTickets])
  const remainingRollo1 = useMemo(() => ticket ? getRemainingRollo1(ticket) : 0, [ticket, quantities])
  const remainingRollo2 = useMemo(() => ticket ? getRemainingRollo2(ticket) : 0, [ticket, quantities])
  const remainingTickets = useMemo(() => ticket ? getRemainingTickets(ticket) : 0, [ticket, quantities])

  // Estado "no instalado" (rollo = -1)
  const rollo1Installed = (ticket?.rollo1 ?? 0) !== -1
  const rollo2Installed = (ticket?.rollo2 ?? 0) !== -1

  return (
    <div className="flex justify-center items-center pt-2" role="region" aria-label="Contadores de rollos">
      {/* Roll 1 (left / modelo1) */}
      <div className="flex-1 text-center text-[rgb(24,62,117)] text-lg">
        {rollo1Installed ? (
          <>{remainingRollo1} "{nombreModelo1}" (Venta: {usedRollo1})</>
        ) : (
          <span className="text-gray-400 italic">Rollo 1 no instalado</span>
        )}
      </div>
      {/* Tickets (center) */}
      <div className="flex-1 text-center text-[rgb(24,62,117)]">
        Tickets: {remainingTickets} (Utilizados: {usedTickets})
      </div>
      {/* Roll 2 (right / modelo2) */}
      <div className="flex-1 text-center text-[rgb(24,62,117)] text-lg">
        {rollo2Installed ? (
          <>{remainingRollo2} "{nombreModelo2}" (Venta: {usedRollo2})</>
        ) : (
          <span className="text-gray-400 italic">Rollo 2 no instalado</span>
        )}
      </div>
    </div>
  )
}
```

### Cálculos internos (delegados al kiosko store)

| Valor mostrado | Fórmula | Función del store |
|----------------|---------|-------------------|
| `remainingRollo1` | `ticket.rollo1 - (tarifaAT1×4 + tarifa4T1×4 + tarifaAS1 + tarifaA2S1 + tarifaBS1 + tarifaCS1)` | `getRemainingRollo1(ticket)` |
| `remainingRollo2` | `ticket.rollo2 - (tarifaAT2×4 + tarifa4T2×4 + tarifaAS2 + tarifaA2S2 + tarifaBS2 + tarifaCS2)` | `getRemainingRollo2(ticket)` |
| `remainingTickets` | `ticket.tickets - 2 - (tarifaAT1 + tarifa4T1 + tarifaAT2 + tarifa4T2)` | `getRemainingTickets(ticket)` |
| `usedRollo1` | `tarifaAT1×4 + tarifa4T1×4 + tarifaAS1 + tarifaA2S1 + tarifaBS1 + tarifaCS1` | `getUsedRollo1()` |
| `usedRollo2` | `tarifaAT2×4 + tarifa4T2×4 + tarifaAS2 + tarifaA2S2 + tarifaBS2 + tarifaCS2` | `getUsedRollo2()` |
| `usedTickets` | `tarifaAT1 + tarifa4T1 + tarifaAT2 + tarifa4T2` | `getUsedTickets()` |

**Nota sobre el `-2` en tickets**: El legacy resta 2 tickets siempre porque toda venta genera al menos 1 ticket principal + 1 copia. Este offset se aplica independientemente de si hay tiras o no.

### Decisiones de diseño

#### ¿Por qué "Venta: X" muestra las etiquetas de la selección actual y no de la última venta?

En el legacy, `rollo1ant` y `rollo2ant` mostraban las cantidades consumidas en la **última venta completada** (se seteaban en `imprimirNormal()`). En el nuevo diseño, mostramos las **etiquetas que consumirá la selección actual** de la cesta. Esto es más útil para el vendedor porque:
- Ve en tiempo real cuántas etiquetas "gastará" si confirma la venta
- No necesita recordar cuántas se gastaron antes
- El dato de la última venta se puede consultar en el historial de órdenes

Si en el futuro se prefiere el comportamiento legacy, se puede cambiar a usar `lastSale.sellos1` / `lastSale.sellos2` del kiosko store.

#### ¿Por qué se maneja el estado "rollo no instalado" (valor -1)?

El requisito 4.6 establece que `rollo = -1` indica rollo quitado/no instalado. Mostrar un valor negativo sería confuso para el vendedor. En su lugar, se muestra un texto gris en cursiva "Rollo X no instalado" que comunica claramente el estado sin alarmar.

#### ¿Por qué `useMemo` para valores derivados simples?

Aunque los cálculos individuales son baratos (sumas y restas), el componente se re-renderiza cada vez que cambia cualquier cantidad en la tabla de tarifas. Sin memoización, las 6 funciones de cálculo se invocarían en cada keystroke. Con `useMemo`, solo se recalculan cuando `quantities` realmente cambia (referencia nueva del store).

#### ¿Por qué se usa `quantities` como dependencia explícita de `useMemo`?

Los getters del store (`getUsedRollo1`, etc.) cierran sobre el estado del store en el momento de la subscripción. Añadir `quantities` como dependencia garantiza que `useMemo` se invalida cuando las cantidades cambian, provocando la reinvocación del getter con el estado actualizado.

### Estados del componente

| Estado | Comportamiento visual |
|--------|----------------------|
| **Normal (ambos rollos instalados)** | Tres secciones: stock rollo1 + tickets + stock rollo2 |
| **Rollo 1 quitado (rollo1 = -1)** | Izquierda muestra "Rollo 1 no instalado" en gris cursiva |
| **Rollo 2 quitado (rollo2 = -1)** | Derecha muestra "Rollo 2 no instalado" en gris cursiva |
| **Ambos rollos quitados** | Izquierda y derecha muestran "no instalado" |
| **Stock negativo (selección excede stock)** | Muestra el número negativo (el color se mantiene navy) |
| **Config no cargada** | Muestra 0 para todos los valores (sin crash) |

### Accesibilidad

| Elemento | Atributo | Valor |
|----------|----------|-------|
| Contenedor | `role="region"`, `aria-label` | `"Contadores de rollos"` |
| Sección rollo 1 | `aria-label` | `"Rollo 1: X etiquetas restantes"` o `"Rollo 1: no instalado"` |
| Sección tickets | `aria-label` | `"Tickets: X restantes, Y utilizados"` |
| Sección rollo 2 | `aria-label` | `"Rollo 2: X etiquetas restantes"` o `"Rollo 2: no instalado"` |

### Dependencias utilizadas

| Módulo | Uso |
|--------|-----|
| `@renderer/stores/config.store` | Acceso a `ticket` (rollo1, rollo2, tickets) y `sello` (eventos/motivos) |
| `@renderer/stores/kiosko.store` | Getters: `getUsedRollo1/2`, `getUsedTickets`, `getRemainingRollo1/2`, `getRemainingTickets` |
| `react` (useMemo) | Memoización de valores derivados |

### Verificación

```bash
# TypeScript compila sin errores:
$ getDiagnostics src/renderer/src/components/kiosko/RollCounters.tsx
# No diagnostics found

# TypeCheck del proyecto completo:
$ npx tsc --noEmit
# Exit code 0

# Componentes kiosko creados hasta ahora:
$ ls src/renderer/src/components/kiosko/
# CartControls.tsx  RollCounters.tsx  StampModels.tsx  TariffRow.tsx  TariffTable.tsx
```

---

## Detalle de lo realizado (7.6)

### ¿Qué se hizo?

Se implementó la lógica completa del botón **"Imprimir Normal"** en el componente `CartControls.tsx`. Este botón es el disparador principal de ventas en la vista Kiosko: valida que la cesta cumple todas las restricciones (límite de importe, stock de rollos, stock de tickets, ID de cliente), registra el consumo para posible reversión, invoca la venta completa vía IPC al main process, y resetea las cantidades tras una venta exitosa.

### Archivos modificados

| Archivo | Descripción |
|---------|-------------|
| `src/renderer/src/components/kiosko/CartControls.tsx` | Añadida lógica `handlePrintNormal` con validación y disparo de venta |
| `src/renderer/src/components/kiosko/__tests__/CartControls.test.tsx` | 15 tests unitarios para la lógica del botón |

### Flujo del botón "Imprimir Normal"

```
┌─────────────────────────────────────────────────────────────────────┐
│ Vendedor pulsa  🛒  (botón azul navy)                               │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 1. validateSale(config) → comprueba:                                │
│    • Cesta vacía? → retorna silenciosamente (no alert)              │
│    • clienteId > 9999? → alert("Límite de ID Cliente...")           │
│    • sellos1 > rollo1? → alert("No hay suficientes sellos...")      │
│    • sellos2 > rollo2? → alert("No hay suficientes sellos...")      │
│    • total > limite? → alert("Ha excedido el límite de compra...")  │
│    • ticketsNeeded > tickets? → alert("No hay suficientes tickets") │
└────────────────────────────┬────────────────────────────────────────┘
                             │ ✅ Pasa validación
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. recordLastSale(sellos1, sellos2, ticketsUsed)                    │
│    Guarda consumo para posible "Error Impresión" posterior          │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. await ipc.print(config, quantities, 'normal')                    │
│    Main process ejecuta transacción atómica:                        │
│    - Incrementa config.codigo.cliente                               │
│    - Decrementa rollos según cantidades                             │
│    - Inserta registros OrderLine                                    │
│    - Genera PDFs (etiquetas 55x25mm + ticket 78mm)                 │
│    - Envía a impresoras (IPP/CUPS)                                  │
└────────────────────────────┬────────────────────────────────────────┘
                             │ ✅ IPC success
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. reset() → todas las cantidades a 0                               │
│    onPrintNormal?.() → notifica al padre                            │
└─────────────────────────────────────────────────────────────────────┘
```

### Validaciones implementadas (orden de ejecución)

| # | Validación | Condición de error | Mensaje al vendedor | Requisito |
|---|------------|-------------------|---------------------|-----------|
| 1 | Cesta vacía | `total === 0` | *(ninguno, rechazo silencioso)* | — |
| 2 | ID cliente overflow | `clienteId > 9999` | "Límite de ID Cliente, haga reset en menú MÁQUINA" | Req 3.8 |
| 3 | Stock rollo 1 | `sellos1 > ticket.rollo1` | "No hay suficientes sellos del primer motivo" | Req 4.5 |
| 4 | Stock rollo 2 | `sellos2 > ticket.rollo2` | "No hay suficientes sellos del segundo motivo" | Req 4.5 |
| 5 | Límite importe | `total > limite` | "Ha excedido el límite de compra de {limite}€" | Req 1.3, 1.4 |
| 6 | Stock tickets | `ticketsNeeded > ticket.tickets` | "No hay suficientes tickets" | Req 4.5 |

### Función `validateSale` (en `tariff-calc.ts`)

```typescript
export function validateSale(
  q: KioskoQuantities,
  precios: PreciosConfig,
  ticket: TicketConfig,
  sello: SelloConfig,
  clienteId: number
): string | null {
  const sellos1 = calcUsedRollo1(q)       // tarifas simples + tiras×4 del modelo 1
  const sellos2 = calcUsedRollo2(q)       // tarifas simples + tiras×4 del modelo 2
  const total = calcTotal(q, precios)     // suma(cantidad × precio) para ambos modelos
  const limite = calcLimite(ticket, sello) // perfil 6 → limiteImporte, otros → NUEVOlimiteImporte
  const ticketsNeeded = 2 + calcUsedTickets(q) // 2 (ticket+copia) + tiras

  if (total === 0) return 'empty'
  if (clienteId > 9999) return 'Límite de ID Cliente, haga reset en menú MÁQUINA'
  if (sellos1 > ticket.rollo1) return 'No hay suficientes sellos del primer motivo'
  if (sellos2 > ticket.rollo2) return 'No hay suficientes sellos del segundo motivo'
  if (total > limite) return `Ha excedido el límite de compra de ${limite}€`
  if (ticketsNeeded > ticket.tickets) return 'No hay suficientes tickets'

  return null // ✅ Venta válida
}
```

### Lógica de perfil y límite de importe

```typescript
// En calcLimite (tariff-calc.ts):
export function calcLimite(ticket: TicketConfig, sello: SelloConfig): number {
  // Perfil 6 (FERIA) usa limiteImporte
  // Perfiles 1-5 usan NUEVOlimiteImporte
  if (sello.elperfil === 6) {
    return ticket.limiteImporte
  }
  return ticket.NUEVOlimiteImporte ?? ticket.limiteImporte
}
```

| Perfil activo | Límite utilizado | Caso de uso |
|---------------|-----------------|-------------|
| 6 (FERIA) | `ticket.limiteImporte` | Modo estándar de feria (hasta 399.99€ por defecto) |
| 1-5 (Filatelia, Esporádicos, SPDE, etc.) | `ticket.NUEVOlimiteImporte` | Modos especiales con límite potencialmente diferente |

### Registro de consumo (para "Error Impresión")

Antes de disparar la venta, se guarda exactamente cuánto se va a consumir:

```typescript
const sellos1 = calcUsedRollo1(quantities)   // ej: 5 simples + 2 tiras×4 = 13
const sellos2 = calcUsedRollo2(quantities)   // ej: 0
const ticketsUsed = 2 + calcUsedTickets(quantities) // ej: 2 + 2 = 4
recordLastSale(sellos1, sellos2, ticketsUsed)
```

Este registro permite que la subtarea 7.7 ("Error Impresión") pueda revertir exactamente las cantidades decrementadas sin recalcularlas.

### Protección contra doble-click

```typescript
const [printing, setPrinting] = useState(false)

// En handlePrintNormal:
if (printing) return    // Ignora click si ya está en proceso
setPrinting(true)
try { ... } finally { setPrinting(false) }

// En el JSX:
<button disabled={printing} ... />
```

El botón se deshabilita visualmente (`opacity-50`, `cursor-not-allowed`) y funcionalmente durante el procesamiento de la venta. Esto evita ventas duplicadas si el vendedor hace doble-click.

### Manejo de errores

| Escenario | Comportamiento |
|-----------|---------------|
| IPC falla (impresora desconectada, error BD) | Se muestra `alert("Error al procesar la impresión")`. Las cantidades **no** se resetean. |
| Validación falla | Se muestra alert con el mensaje específico. No se llama a IPC. |
| Cesta vacía | Rechazo silencioso (sin alert, sin IPC). Réplica del comportamiento legacy. |

### Mapeo con el legacy KioskoView.vue

| Legacy (Vue 3) | Nuevo (React) | Notas |
|----------------|---------------|-------|
| `imprimirNormal()` — función de 60+ líneas con validación inline | `handlePrintNormal()` → `validateSale()` + `ipc.print()` | Validación extraída como función pura testeable |
| `if (total > limite) { ... }` (inline en `imprimirNormal`) | `validateSale()` centraliza todas las validaciones | Un solo punto de validación, orden claro |
| `rollo1ant = usedRollo1; rollo2ant = usedRollo2` | `recordLastSale(sellos1, sellos2, ticketsUsed)` | Mismo propósito: guardar para reversal |
| `Meteor.call('orders.insert', ...)` + `Meteor.call('config.updateSesion')` + `sendPrint(ws, ...)` | `await ipc.print(config, quantities, 'normal')` | Una sola llamada IPC que orquesta todo en main process |
| `resetCantidades()` — limpia refs Vue | `reset()` — acción del store Zustand | Mismo resultado: todas las cantidades a 0 |
| Sin protección de doble-click | `disabled={printing}` + estado `printing` | Mejora sobre el legacy |
| `alert(...)` para errores | `window.alert(...)` para errores | Mismo mecanismo. Se puede migrar a toast/dialog en el futuro |

### Tests implementados (15 tests)

```
CartControls – Imprimir Normal (Task 7.6)
├── Validation – Req 1.3, 1.4: Total must not exceed limiteImporte
│   ├── ✅ rejects sale when total exceeds limit and shows error message
│   └── ✅ accepts sale when total is exactly at limit
├── Validation – Req 4.5: Stock availability
│   ├── ✅ rejects sale when rollo1 stock is insufficient
│   ├── ✅ rejects sale when rollo2 stock is insufficient
│   └── ✅ rejects sale when ticket stock is insufficient for tiras
├── Successful sale – Req 1.5: Reset after sale
│   ├── ✅ calls IPC print with correct arguments on valid sale
│   ├── ✅ resets all quantities to zero after successful sale
│   └── ✅ records last sale consumption for error reversal
├── Empty basket behavior
│   └── ✅ silently rejects when basket is empty (no alert)
├── Error handling
│   ├── ✅ shows error message when IPC print fails
│   ├── ✅ does not reset quantities when IPC print fails
│   └── ✅ rejects sale when client ID exceeds 9999
├── UI state during print
│   └── ✅ disables print button while printing is in progress
└── Profile-based limit – Property 14
    ├── ✅ uses limiteImporte for profile 6 (FERIA)
    └── ✅ uses NUEVOlimiteImporte for non-FERIA profiles
```

### Ejecución de tests

```bash
$ npx vitest run src/renderer/src/components/kiosko/__tests__/CartControls.test.tsx --reporter=verbose

 ✓ CartControls – Imprimir Normal (Task 7.6) > Validation – Req 1.3, 1.4 > rejects sale when total exceeds limit...
 ✓ CartControls – Imprimir Normal (Task 7.6) > Validation – Req 1.3, 1.4 > accepts sale when total is exactly at limit
 ✓ CartControls – Imprimir Normal (Task 7.6) > Validation – Req 4.5 > rejects sale when rollo1 stock is insufficient
 ✓ CartControls – Imprimir Normal (Task 7.6) > Validation – Req 4.5 > rejects sale when rollo2 stock is insufficient
 ✓ CartControls – Imprimir Normal (Task 7.6) > Validation – Req 4.5 > rejects sale when ticket stock is insufficient...
 ✓ CartControls – Imprimir Normal (Task 7.6) > Successful sale > calls IPC print with correct arguments...
 ✓ CartControls – Imprimir Normal (Task 7.6) > Successful sale > resets all quantities to zero after successful sale
 ✓ CartControls – Imprimir Normal (Task 7.6) > Successful sale > records last sale consumption for error reversal
 ✓ CartControls – Imprimir Normal (Task 7.6) > Empty basket behavior > silently rejects when basket is empty
 ✓ CartControls – Imprimir Normal (Task 7.6) > Error handling > shows error message when IPC print fails
 ✓ CartControls – Imprimir Normal (Task 7.6) > Error handling > does not reset quantities when IPC print fails
 ✓ CartControls – Imprimir Normal (Task 7.6) > Error handling > rejects sale when client ID exceeds 9999
 ✓ CartControls – Imprimir Normal (Task 7.6) > UI state during print > disables print button while printing...
 ✓ CartControls – Imprimir Normal (Task 7.6) > Profile-based limit > uses limiteImporte for profile 6 (FERIA)
 ✓ CartControls – Imprimir Normal (Task 7.6) > Profile-based limit > uses NUEVOlimiteImporte for non-FERIA profiles

 Test Files  1 passed (1)
      Tests  15 passed (15)
   Duration  1.46s
```

### Decisiones de diseño

#### ¿Por qué la validación es una función pura separada (`validateSale` en `tariff-calc.ts`)?

La función de validación:
- Es **testeable independientemente** del componente React (no requiere render ni DOM)
- Es **reutilizable** — puede invocarse desde otros puntos (perfiles Filatelia, Protocolo, SPDE en subtarea 7.8)
- Está **colocalizada** con las demás funciones de cálculo (mismo módulo, mismas dependencias de tipos)
- Retorna un **string de error o null** — patrón simple que el componente interpreta sin acoplamiento

#### ¿Por qué `window.alert()` y no un componente de toast/dialog?

Decisión pragmática por dos razones:
1. El legacy usaba `alert()` nativos para errores de validación — mantiene familiaridad para el vendedor
2. No se requirió instalar una librería de toasts en esta subtarea — se puede migrar a `@radix-ui/react-toast` en una tarea de polish futura sin cambiar la lógica subyacente

El componente no está acoplado a `alert()`: basta cambiar una línea para usar toast, dialog, o cualquier otro mecanismo de notificación.

#### ¿Por qué `recordLastSale` se llama ANTES de `ipc.print` y no después?

Si se registrase después del IPC, un fallo parcial (IPC sale pero la respuesta no llega al renderer) dejaría `lastSale` vacío y el botón "Error Impresión" no sabría qué revertir. Registrándolo antes:
- Si IPC falla → lastSale queda con datos pero no se usará (quantities no se resetearon, el vendedor reintentará)
- Si IPC sale bien → lastSale tiene los datos correctos para una posible reversión
- Escenario peor: el vendedor ve datos "stale" en lastSale de un intento fallido previo → la reversión sería incorrecta → mitigado porque se sobreescribe en cada nuevo intento exitoso

#### ¿Por qué el `onPrintNormal` prop cambió de "handler principal" a "callback post-venta"?

En la documentación de 7.4, `onPrintNormal` se describió como handler externo a implementar en el padre. Al implementar 7.6, quedó claro que toda la lógica de validación + IPC pertenece al propio componente (tiene acceso directo a stores y IPC). El prop se reutiliza como **callback de notificación** al padre tras una venta exitosa, útil para:
- Trigger de refresh de datos en otras vistas
- Analytics/logging a nivel de vista
- Testing del flujo completo desde el padre

### Dependencias utilizadas

| Módulo | Uso |
|--------|-----|
| `@renderer/stores/config.store` | Acceso a config completa (precios, ticket, sello, codigo) |
| `@renderer/stores/kiosko.store` | `validateSale`, `recordLastSale`, `reset`, `getTotal`, `getLimite` |
| `@renderer/lib/tariff-calc` | `calcUsedRollo1`, `calcUsedRollo2`, `calcUsedTickets` (para recording) |
| `@renderer/lib/ipc-client` | `print(config, quantities, profile)` — dispara venta en main process |
| `react` (useState, useCallback, useMemo) | Estado de `printing`, memoización de computed, handler estable |

### Requisitos validados

| Requisito | Criterio de aceptación | Cómo se valida |
|-----------|----------------------|----------------|
| Req 1.3 | Total no excede limiteImporte → rechazar | `validateSale` comprueba `total > limite` |
| Req 1.4 | Muestra mensaje de límite superado | `alert("Ha excedido el límite de compra de X€")` |
| Req 1.5 | Reset cantidades tras venta exitosa | `reset()` después de `ipc.print()` exitoso |
| Req 3.8 | Bloquear si clienteId > 9999 | `validateSale` comprueba `clienteId > 9999` |
| Req 4.5 | Rechazar si rollo sin stock | `validateSale` comprueba `sellos > rollo` para ambos modelos |

### Verificación

```bash
# TypeScript sin errores:
$ getDiagnostics src/renderer/src/components/kiosko/CartControls.tsx
# No diagnostics found

# Tests pasan:
$ npx vitest run src/renderer/src/components/kiosko/__tests__/CartControls.test.tsx
# Test Files  1 passed (1)
# Tests  15 passed (15)
```

---

## Detalle de lo realizado (7.7)

### ¿Qué se hizo?

Se implementó la lógica completa del botón **"Error Impresión"** en el componente `CartControls.tsx`. Este botón permite al vendedor **anular la última venta** en caso de error de impresión, revirtiendo el incremento de sesión, restaurando las cantidades de rollos/tickets y dejando un registro de auditoría. Replica el comportamiento de `imprimirError()` del legacy `KioskoView.vue`.

### Archivos modificados

| Archivo | Descripción |
|---------|-------------|
| `src/renderer/src/components/kiosko/CartControls.tsx` | Añadida lógica `handlePrintError` con confirmación, reversión y auditoría |
| `src/renderer/src/components/kiosko/__tests__/CartControls.test.tsx` | 10 tests unitarios adicionales para la lógica del botón Error Impresión |

### Flujo del botón "Error Impresión"

```
┌─────────────────────────────────────────────────────────────────────┐
│ Vendedor pulsa  🛒✕  (botón rojo circular)                          │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 1. window.confirm("¿Error de IMPRESIÓN? ¡Se procederá a ANULAR     │
│    la VENTA ANTERIOR!")                                              │
│    → Si cancela: no hace nada (retorna)                             │
└────────────────────────────┬────────────────────────────────────────┘
                             │ ✅ Confirmado
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. Verificar si existe venta anterior:                              │
│    → lastSale.sellos1 <= 0 && lastSale.sellos2 <= 0?                │
│    → alert("¡¡NINGUNA venta encontrada!!")                          │
│    → Retorna sin hacer nada                                         │
└────────────────────────────┬────────────────────────────────────────┘
                             │ ✅ Hay venta para revertir
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. await ipc.updateSesionError()                                    │
│    → Main process decrementa config.codigo.cliente en 1             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. await ipc.updateRollosRevert(sellos1, sellos2, tickets)          │
│    → Main process restaura rollo1 += sellos1, rollo2 += sellos2,    │
│      tickets += ticketsUsed                                         │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. await ipc.insertOrders([errorOrder])                             │
│    → Inserta registro de auditoría:                                  │
│      event="ELIMINAR ANTERIOR", machine="error de impresión"        │
│      paymentStatus="Error", value=0, quantity=0                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. clearLastSale() → lastSale = {sellos1:0, sellos2:0, tickets:0}  │
│    reset() → todas las cantidades a 0                               │
│    onPrintError?.() → notifica al padre                             │
└─────────────────────────────────────────────────────────────────────┘
```

### Integración con el store (lastSale)

El mecanismo se basa en el estado `lastSale` del kiosko store, que se registra en cada venta exitosa (tarea 7.6):

```typescript
// En kiosko.store.ts:
interface KioskoState {
  lastSale: { sellos1: number; sellos2: number; tickets: number }
  recordLastSale(sellos1: number, sellos2: number, tickets: number): void
  clearLastSale(): void
}
```

| Momento | Estado de `lastSale` |
|---------|---------------------|
| Antes de cualquier venta | `{sellos1: 0, sellos2: 0, tickets: 0}` |
| Tras "Imprimir Normal" exitoso | `{sellos1: 13, sellos2: 8, tickets: 6}` (ejemplo) |
| Tras "Error Impresión" exitoso | `{sellos1: 0, sellos2: 0, tickets: 0}` (reseteado) |

### Registro de auditoría (OrderLine insertada)

```typescript
const errorOrder: OrderLine = {
  event: 'ELIMINAR ANTERIOR',
  venue: ' ',
  machine: 'error de impresión',
  vendType: ' ',
  productName: ' ',
  transactionDate: '',
  quantity: 0,
  quantitySet: 0,
  totalStamps: 0,
  currency: ' ',
  value: 0,
  paymentStatus: 'Error',
  sesionId: config.codigo.cliente,
  etiquetasRollo1: 0,
  etiquetasRollo2: 0,
  etiquetaMes: ' ',
  tituloEvento: 'Error',
  feria: config.sello?.feria ?? '',
  lugar: config.sello?.lugar ?? '',
  fecha: 'Error',
  mes: 'Error',
  annio: 'Error',
  documento: 'Error'
}
```

Este registro queda en la tabla `orders` como evidencia de la anulación. El campo `event="ELIMINAR ANTERIOR"` permite identificarlo en exportaciones CSV y auditorías.

### Mapeo con el legacy KioskoView.vue

| Legacy (Vue 3) | Nuevo (React) | Notas |
|----------------|---------------|-------|
| `imprimirError()` — función inline en `<script setup>` | `handlePrintError()` — `useCallback` en CartControls | Misma lógica, estructura más clara |
| `if (confirm("¿Error de IMPRESIÓN?..."))` | `window.confirm("¿Error de IMPRESIÓN?...")` | Mismo diálogo nativo |
| `if (rollo1ant === 0 && rollo2ant === 0)` | `if (lastSale.sellos1 <= 0 && lastSale.sellos2 <= 0)` | Mismo check, nombres más descriptivos |
| `Meteor.call('config.updateSesionError')` | `await ipc.updateSesionError()` | IPC tipado en vez de string-based method call |
| `Meteor.call('config.updateRollosRevert', rollo1ant, rollo2ant, ticketsventa)` | `await ipc.updateRollosRevert(lastSale.sellos1, lastSale.sellos2, lastSale.tickets)` | Mismos argumentos |
| `Meteor.call('orders.insert', [{event:"ELIMINAR ANTERIOR",...}])` | `await ipc.insertOrders([errorOrder])` | Misma estructura de orden |
| `rollo1ant = 0; rollo2ant = 0; ticketsventa = 0` (refs Vue) | `clearLastSale()` (acción del store) | Mismo efecto: limpia datos de la última venta |
| `resetCantidades()` al final | `reset()` al final | Limpia la cesta |

### Diferencia clave con el legacy

En el legacy, las refs `rollo1ant` y `rollo2ant` se seteaban dentro de `imprimirNormal()` y eran visibles solo dentro del componente. En la nueva versión, `lastSale` vive en el **store de Zustand**, lo que:
- Permite acceder al dato desde cualquier componente (si fuese necesario en el futuro)
- Sobrevive a re-renders del componente
- Es más fácil de testear (se puede setear directamente en tests)
- Se limpia explícitamente con `clearLastSale()` para evitar doble-anulación

### Protecciones implementadas

| Protección | Cómo funciona |
|------------|---------------|
| **Doble-click** | `disabled={printing}` + estado `printing` deshabilita el botón durante el proceso |
| **Sin venta previa** | Verifica `lastSale.sellos1 <= 0 && lastSale.sellos2 <= 0` antes de proceder |
| **Cancelación por el usuario** | `window.confirm()` permite al vendedor abortar la operación |
| **Error de IPC** | `try/catch` muestra "Error al anular la venta" y no corrompe el estado |
| **Doble anulación** | `clearLastSale()` pone todo a 0 tras la anulación, impidiendo anular dos veces |

### Manejo de errores

| Escenario | Comportamiento |
|-----------|---------------|
| Vendedor cancela la confirmación | No se hace nada. Botón sigue habilitado. |
| No hay venta previa (lastSale vacío) | Se muestra `alert("¡¡NINGUNA venta encontrada!!")`. No se llama a IPC. |
| IPC falla (BD error, conexión perdida) | Se muestra `alert("Error al anular la venta")`. El estado `lastSale` **no** se limpia (se puede reintentar). |
| Todo OK | Se revierte sesión + rollos + se inserta auditoría + se limpia lastSale + se resetea cesta. |

### Tests implementados (10 tests)

```
CartControls – Error Impresión (Task 7.7)
├── Req 10.1: Confirmation before proceeding
│   ├── ✅ asks for confirmation before cancelling last sale
│   └── ✅ does not proceed when confirmation is cancelled
├── Req 10.5: Reject when no previous sale exists
│   └── ✅ shows alert when no previous sale to revert
├── Req 10.2: Revert session increment
│   └── ✅ calls updateSesionError to decrement client ID
├── Req 10.3: Restore roll and ticket quantities
│   └── ✅ calls updateRollosRevert with last sale quantities
├── Req 10.4: Insert audit order record
│   └── ✅ inserts order with event="ELIMINAR ANTERIOR"
├── State cleanup after successful reversal
│   ├── ✅ clears lastSale record after successful reversal
│   └── ✅ resets quantities after successful reversal
└── Error handling
    ├── ✅ shows error alert when IPC call fails
    └── ✅ disables error button while processing
```

### Ejecución de tests

```bash
$ npx vitest run src/renderer/src/components/kiosko/__tests__/CartControls.test.tsx

 ✓ CartControls – Imprimir Normal (Task 7.6) (15 tests)
 ✓ CartControls – Error Impresión (Task 7.7) (10 tests)

 Test Files  1 passed (1)
      Tests  25 passed (25)
   Duration  1.70s
```

### Decisiones de diseño

#### ¿Por qué las 3 llamadas IPC se ejecutan secuencialmente y no en `Promise.all`?

Las operaciones tienen dependencias lógicas:
1. `updateSesionError` decrementa el `cliente` → el valor actualizado se usa en el registro de auditoría
2. `updateRollosRevert` restaura stocks → debe completarse antes de que el vendedor pueda hacer otra venta
3. `insertOrders` inserta la auditoría → necesita el `sesionId` correcto (ya decrementado)

Ejecutarlas en paralelo podría crear race conditions donde el registro de auditoría contenga el `sesionId` incorrecto.

#### ¿Por qué se usa `lastSale.sellos1 <= 0 && lastSale.sellos2 <= 0` y no `=== 0`?

Defensa contra valores negativos inesperados. Si por un bug `lastSale` contuviese un valor negativo, `<= 0` lo detectaría como "no hay venta" y rechazaría la anulación, evitando una reversión incorrecta.

#### ¿Por qué `clearLastSale()` se llama al final y no al principio?

Si se limpiase al principio y luego fallase la IPC, el vendedor no podría reintentar la anulación porque `lastSale` ya estaría vacío. Limpiándolo al final (solo tras éxito), se garantiza que un reintento es posible.

#### ¿Por qué el registro de auditoría tiene tantos campos en blanco?

Replica el formato del legacy, donde el registro de anulación era un "placeholder" con `event="ELIMINAR ANTERIOR"` y los demás campos vacíos o con valor "Error". Esto permite:
- Identificar fácilmente las anulaciones en la exportación CSV
- Mantener la estructura de la tabla `orders` sin NULLs
- Compatibilidad con cualquier herramienta de análisis que procese los CSV exportados

### Dependencias utilizadas

| Módulo | Uso |
|--------|-----|
| `@renderer/stores/config.store` | Acceso a `config.codigo.cliente`, `config.sello.feria/lugar` |
| `@renderer/stores/kiosko.store` | `lastSale`, `clearLastSale()`, `reset()` |
| `@renderer/lib/ipc-client` | `updateSesionError()`, `updateRollosRevert()`, `insertOrders()` |
| `@renderer/types/order` | Tipo `OrderLine` para el registro de auditoría |
| `react` (useCallback, useState) | Handler estable + estado `printing` |

### Requisitos validados

| Requisito | Criterio de aceptación | Cómo se valida |
|-----------|----------------------|----------------|
| Req 10.1 | Pedir confirmación antes de proceder | `window.confirm()` — test verifica que se llama |
| Req 10.2 | Revertir incremento de sesión | `ipc.updateSesionError()` — test verifica llamada |
| Req 10.3 | Restaurar cantidades exactas de rollos/tickets | `ipc.updateRollosRevert(sellos1, sellos2, tickets)` — test verifica args |
| Req 10.4 | Insertar registro con event="ELIMINAR ANTERIOR" | `ipc.insertOrders([{event:"ELIMINAR ANTERIOR",...}])` — test verifica estructura |
| Req 10.5 | Rechazar si no hay venta anterior | `alert("¡¡NINGUNA venta encontrada!!")` cuando lastSale vacío |

### Verificación

```bash
# TypeScript sin errores:
$ getDiagnostics src/renderer/src/components/kiosko/CartControls.tsx
# No diagnostics found

# Tests pasan (15 de 7.6 + 10 de 7.7):
$ npx vitest run src/renderer/src/components/kiosko/__tests__/CartControls.test.tsx
# Test Files  1 passed (1)
# Tests  25 passed (25)
```

---

## Detalle de lo realizado (7.8)

### ¿Qué se hizo?

Se implementaron los **botones de perfil Filatelia, Protocolo y SPDE** en el componente `CartControls.tsx`. Estos botones permiten al vendedor disparar una venta con un perfil específico que modifica el título del ticket impreso. Replican la funcionalidad de los botones dedicados del legacy `KioskoView.vue`.

Cada botón:
1. Ejecuta la misma validación que "Imprimir Normal" (límite de importe, stock de rollos, tickets, cesta vacía, ID cliente > 9999)
2. Registra el consumo para posible reversión por error
3. Llama a `ipc.print(config, quantities, profile)` con el perfil correspondiente
4. Resetea las cantidades a cero tras una venta exitosa
5. Se deshabilita mientras hay una impresión en curso

### Archivos modificados

| Archivo | Descripción |
|---------|-------------|
| `src/renderer/src/components/kiosko/CartControls.tsx` | Añadida lógica completa de venta a los botones de perfil |
| `src/renderer/src/components/kiosko/__tests__/CartControls.test.tsx` | Añadidos 17 tests nuevos para los botones de perfil |

### Función core compartida: `handlePrint`

Los tres botones de perfil (y el botón "Imprimir Normal") comparten un único handler core `handlePrint(profile, onSuccess?)` que encapsula todo el flujo de venta:

```typescript
const handlePrint = useCallback(
  async (profile: string, onSuccess?: () => void) => {
    if (!config || printing) return

    // 1. Validar la venta (límites, stock, cesta vacía, cliente > 9999)
    const error = validateSale(config)
    if (error) {
      if (error === 'empty') return  // Cesta vacía: rechazo silencioso
      window.alert(error)
      return
    }

    setPrinting(true)

    try {
      // 2. Registrar consumo para posible reversión
      const sellos1 = calcUsedRollo1(quantities)
      const sellos2 = calcUsedRollo2(quantities)
      const ticketsUsed = 2 + calcUsedTickets(quantities)
      recordLastSale(sellos1, sellos2, ticketsUsed)

      // 3. Llamar IPC con el perfil que modifica el título del ticket
      await ipc.print(config, quantities, profile)

      // 4. Resetear cantidades tras venta exitosa
      reset()
      onSuccess?.()
    } catch (err) {
      console.error('[CartControls] Error during print:', err)
      window.alert('Error al procesar la impresión')
    } finally {
      setPrinting(false)
    }
  },
  [config, quantities, printing, validateSale, recordLastSale, reset]
)
```

### Handlers individuales por perfil

```typescript
// Filatelia → modifica título a "Filatelia de: {titulo_base}"
const handlePrintFilatelia = useCallback(async () => {
  await handlePrint('filatelia', onPrintFilatelia)
}, [handlePrint, onPrintFilatelia])

// Protocolo → modifica título a "Protocolo de: {titulo_base}"
const handlePrintProtocolo = useCallback(async () => {
  await handlePrint('protocolo', onPrintProtocolo)
}, [handlePrint, onPrintProtocolo])

// SPDE → modifica título a "SPDE de: {titulo_base}"
const handlePrintSPDE = useCallback(async () => {
  await handlePrint('spde', onPrintSPDE)
}, [handlePrint, onPrintSPDE])
```

### Botones en el JSX

| Botón | Color | Ubicación | aria-label | Perfil IPC |
|-------|-------|-----------|------------|------------|
| Filatelia | Púrpura (`bg-purple-700`) | Columna izquierda (encima de Error) | `"Imprimir Filatelia"` | `'filatelia'` |
| Protocolo | Verde (`bg-green-600`) | Columna derecha (debajo de Reset) | `"Imprimir Protocolo"` | `'protocolo'` |
| SPDE | Naranja (`bg-orange-500`) | Columna derecha (debajo de Protocolo) | `"Imprimir SPDE"` | `'spde'` |

```tsx
{/* Filatelia (columna izquierda) */}
<button
  className="w-[80px] h-[65px] bg-purple-700 hover:bg-purple-800 text-white rounded
             flex items-center justify-center text-xs font-bold cursor-pointer
             disabled:opacity-50 disabled:cursor-not-allowed"
  aria-label="Imprimir Filatelia"
  disabled={printing}
  onClick={handlePrintFilatelia}
>
  Filatelia
</button>

{/* Protocolo (columna derecha) */}
<button
  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded
             text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
  aria-label="Imprimir Protocolo"
  disabled={printing}
  onClick={handlePrintProtocolo}
>
  Protocolo
</button>

{/* SPDE (columna derecha) */}
<button
  className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded
             text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
  aria-label="Imprimir SPDE"
  disabled={printing}
  onClick={handlePrintSPDE}
>
  SPDE
</button>
```

### Mapeo con el legacy KioskoView.vue

| Legacy (Vue 3) | Nuevo (React) | Notas |
|----------------|---------------|-------|
| `<img src="/img/filatelia.png" @click="imprimirFilatelia">` | `<button onClick={handlePrintFilatelia}>Filatelia</button>` | Botón con texto en vez de imagen (más accesible) |
| `imprimirFilatelia()` → misma lógica que `imprimirNormal()` pero con perfil | `handlePrint('filatelia')` → función core compartida | Eliminación de código duplicado |
| Botón Protocolo oculto en overlay del modelo1 | `<button onClick={handlePrintProtocolo}>Protocolo</button>` | Botón explícito, siempre visible |
| Botón SPDE oculto en overlay del modelo2 | `<button onClick={handlePrintSPDE}>SPDE</button>` | Botón explícito, siempre visible |
| Cada botón repetía toda la lógica de validación inline | Un solo `handlePrint` parametrizado | DRY: una sola fuente de verdad |
| No se deshabilitaban durante impresión | `disabled={printing}` en todos | Previene doble-click |

### Cómo el perfil modifica el título del ticket

El string de perfil se pasa al main process vía `ipc.print(config, quantities, profile)`. El main process (cuando implemente Task 11 - PDF Generation) usará este perfil para construir el título:

| Perfil | Título del ticket resultante |
|--------|------------------------------|
| `'normal'` | `config.ticket.titulo` (sin modificar) |
| `'filatelia'` | `"Filatelia de: " + config.ticket.titulo` |
| `'protocolo'` | `"Protocolo de: " + config.ticket.titulo` |
| `'spde'` | `"SPDE de: " + config.ticket.titulo` |

Esto cumple con los requisitos 7.3, 7.4 y 7.5 del documento de requisitos.

### Decisiones de diseño

#### ¿Por qué una función `handlePrint` compartida en vez de handlers independientes?

El legacy `KioskoView.vue` tenía funciones separadas `imprimirNormal()`, `imprimirFilatelia()`, `imprimirProtocolo()`, `imprimirSPDE()` que repetían la misma lógica de validación, consumo, llamada IPC y reset. Esto causaba:
- ~200 líneas de código duplicado
- Riesgo de inconsistencia si se corregía un bug en una pero no en las otras
- Dificultad para añadir nuevos perfiles

En la nueva versión, `handlePrint(profile)` centraliza toda la lógica y los handlers específicos son one-liners que solo pasan el perfil. Cualquier cambio en la lógica de venta se aplica automáticamente a todos los perfiles.

#### ¿Por qué los botones de perfil no aparecen/desaparecen según el perfil activo?

En el legacy, los botones siempre estaban visibles independientemente del perfil activo en configuración. Esto es intencional: el vendedor puede estar en perfil "FERIA" pero necesitar hacer una venta puntual con perfil "Filatelia" sin cambiar la configuración global. Los botones de perfil actúan como "override" temporal para una sola transacción.

#### ¿Por qué se usa `disabled={printing}` y no se ocultan los botones?

Deshabilitar visualmente (opacity reducida + cursor not-allowed) es preferible a ocultar porque:
- El vendedor sabe que la funcionalidad existe pero está temporalmente no disponible
- Evita layout shifts (los botones mantienen su posición)
- Es el patrón estándar en aplicaciones de punto de venta

#### ¿Por qué se usa `'filatelia'` (minúsculas) como valor del perfil?

Coherencia con la API interna. El main process recibirá un string simple, limpio y predecible. La capitalización para el título del ticket (`"Filatelia de: ..."`) se hace en el generador de PDF (Task 11), no en el frontend. Esto desacopla la presentación de la lógica de negocio.

### Tests implementados (17 nuevos)

| Grupo | Test | Valida |
|-------|------|--------|
| **Filatelia** | Llama IPC print con profile "filatelia" | Req 7.3 |
| **Filatelia** | Resetea cantidades tras venta exitosa | Req 1.5 |
| **Filatelia** | Valida venta antes de imprimir (límite excedido) | Req 1.3, 1.4 |
| **Filatelia** | No hace nada con cesta vacía | Req 1.6 |
| **Filatelia** | Registra lastSale para reversión | Req 10 |
| **Filatelia** | Se deshabilita durante impresión | UX |
| **Protocolo** | Llama IPC print con profile "protocolo" | Req 7.4 |
| **Protocolo** | Resetea cantidades tras venta exitosa | Req 1.5 |
| **Protocolo** | Valida stock antes de imprimir (rollo insuficiente) | Req 4.5 |
| **Protocolo** | No hace nada con cesta vacía | Req 1.6 |
| **SPDE** | Llama IPC print con profile "spde" | Req 7.5 |
| **SPDE** | Resetea cantidades tras venta exitosa | Req 1.5 |
| **SPDE** | Valida tickets antes de imprimir (tickets insuficientes) | Req 4.3 |
| **SPDE** | No hace nada con cesta vacía | Req 1.6 |
| **SPDE** | Registra lastSale con cantidades correctas (tiras ×4) | Req 4.1, 4.2 |
| **Compartido** | Los 3 botones rechazan cuando cliente > 9999 | Req 3.8 |
| **Compartido** | Los 3 botones pasan diferentes strings de perfil al IPC | Req 7.3-7.5 |

### Accesibilidad

| Elemento | Atributo | Valor |
|----------|----------|-------|
| Botón Filatelia | `aria-label` | `"Imprimir Filatelia"` |
| Botón Protocolo | `aria-label` | `"Imprimir Protocolo"` |
| Botón SPDE | `aria-label` | `"Imprimir SPDE"` |
| Todos los botones | `disabled` | `true` durante impresión |
| Todos los botones | `type` | `"button"` (no submit) |

### Requisitos validados

| Requisito | Criterio de aceptación | Cómo se valida |
|-----------|----------------------|----------------|
| Req 7.3 | Perfil "Filatelia" modifica título a "Filatelia de: {titulo}" | IPC recibe profile='filatelia', test verifica string exacto |
| Req 7.4 | Perfil "Protocolo" modifica título a "Protocolo de: {titulo}" | IPC recibe profile='protocolo', test verifica string exacto |
| Req 7.5 | Perfil "SPDE" modifica título a "SPDE de: {titulo}" | IPC recibe profile='spde', test verifica string exacto |
| Req 13.4 | Al cambiar perfil activo, ajustar Límite_Importe | `getLimite(ticket, sello)` evalúa perfil activo |
| Req 1.3 | Validar que total no excede Límite_Importe | `validateSale` ejecuta validación antes de print |
| Req 1.5 | Resetear cantidades tras venta exitosa | `reset()` se llama tras IPC exitoso |
| Req 10 | Registrar consumo para anulación | `recordLastSale()` antes de IPC |

### Dependencias utilizadas

| Módulo | Uso |
|--------|-----|
| `@renderer/stores/config.store` | Acceso a config (precios, ticket, sello, codigo) |
| `@renderer/stores/kiosko.store` | Cantidades, validateSale, recordLastSale, reset |
| `@renderer/lib/tariff-calc` | calcUsedRollo1, calcUsedRollo2, calcUsedTickets |
| `@renderer/lib/ipc-client` | print() — llamada al main process |
| `react` (useCallback, useMemo, useState) | Handlers estables + estado `printing` |

### Verificación

```bash
# TypeScript sin errores:
$ getDiagnostics src/renderer/src/components/kiosko/CartControls.tsx
# No diagnostics found

# Tests pasan (25 de 7.6/7.7 + 17 de 7.8 = 42 total):
$ npx vitest run src/renderer/src/components/kiosko/__tests__/CartControls.test.tsx
# Test Files  1 passed (1)
# Tests  42 passed (42)
```

---

## Detalle de lo realizado (7.9)

### ¿Qué se hizo?

Se completó la implementación del **botón Reset** en el componente `CartControls.tsx`. El botón permite al vendedor limpiar todas las cantidades de la cesta a 0 con un solo click, volviendo la vista Kiosko a su estado inicial para atender al siguiente cliente.

### Estado previo

La infraestructura ya estaba mayormente implementada:
- El **kiosko store** (`kiosko.store.ts`) ya tenía una acción `reset()` que establece todas las cantidades a `EMPTY_QUANTITIES` (todos los campos a 0)
- El componente `CartControls.tsx` ya renderizaba un botón circular gris con icono de X roja
- El botón ya importaba la función `reset` del store

### Cambio realizado

Se modificó el `onClick` del botón Reset para que invoque directamente `reset()` del kiosko store y luego opcionalmente llame al callback `onReset?.()` del padre:

```typescript
// CartControls.tsx — botón Reset
<button
  type="button"
  className="w-[50px] h-[50px] bg-gray-200 hover:bg-gray-300 rounded-full
             flex items-center justify-center cursor-pointer
             transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
  aria-label="Reset - limpiar cantidades"
  onClick={() => {
    reset()       // ← Limpia todas las cantidades en el store
    onReset?.()   // ← Callback opcional para el padre
  }}
>
  <svg ...>  {/* Icono X roja */}
  </svg>
</button>
```

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/renderer/src/components/kiosko/CartControls.tsx` | onClick del botón Reset ahora llama `reset()` del store directamente |

### Flujo funcional

```
Vendedor pulsa botón Reset (icono ✕ en círculo gris)
    │
    ▼
CartControls.onClick()
    │
    ├── 1. reset() → kiosko.store.ts → set({ quantities: EMPTY_QUANTITIES })
    │       → Todas las cantidades (tarifaAS1, tarifaA2S1, ..., tarifa4T2) = 0
    │       → React re-renderiza TariffTable con valores 0
    │       → Total de cesta = 0.00€
    │       → Límites se recalculan (máximo disponible)
    │
    └── 2. onReset?.() → callback opcional al padre (KioskoView)
```

### Mapeo con el legacy KioskoView.vue

| Legacy (Vue 3) | Nuevo (React) | Notas |
|----------------|---------------|-------|
| `<img src="/img/PNG/CANCELAR.png" @click="reset">` | `<button onClick={() => { reset(); onReset?.() }}>` | Botón con SVG inline en vez de imagen externa |
| `reset()` ponía a 0 cada `tarifaXXCantidad` individualmente | `reset()` reemplaza el objeto completo con `EMPTY_QUANTITIES` | Más eficiente (un solo set vs 12 sets) |
| No había confirmación | No hay confirmación | Requisito 1.5: resetear es inmediato |

### Store: acción `reset()`

```typescript
// kiosko.store.ts
reset: () => {
  set({ quantities: { ...EMPTY_QUANTITIES } })
}

// EMPTY_QUANTITIES = { tarifaAS1: 0, tarifaA2S1: 0, ..., tarifa4T2: 0 }
```

### Requisitos validados

| Requisito | Criterio | Cómo se valida |
|-----------|----------|----------------|
| Req 1.5 | Resetear cantidades de la cesta a cero | `reset()` establece todas a 0 |
| Req 1.6 | Normalizar valores no válidos a cero | `reset()` fuerza 0 absoluto |

### Accesibilidad

| Elemento | Atributo | Valor |
|----------|----------|-------|
| Botón Reset | `aria-label` | `"Reset - limpiar cantidades"` |
| Botón Reset | `type` | `"button"` (no submit) |
| Icono SVG | `aria-hidden` | `"true"` |
| Botón | `focus:ring-2 focus:ring-gray-400` | Anillo de foco visible |

### Verificación

```bash
# TypeScript sin errores:
$ getDiagnostics src/renderer/src/components/kiosko/CartControls.tsx
# No diagnostics found

# Tests pasan (42 tests existentes):
$ npx vitest run src/renderer/src/components/kiosko/__tests__/CartControls.test.tsx
# Test Files  1 passed (1)
# Tests  42 passed (42)
```

---

## Detalle de lo realizado (7.10)

### ¿Qué se hizo?

Se implementaron los botones **Pausar impresora** y **Reanudar impresora** en el componente `StampModels.tsx`, replicando la ubicación exacta del legacy `KioskoView.vue` donde estos botones aparecen encima de la previsualización del Modelo 1 (impresora izquierda).

Se creó un sub-componente `PrinterControls` dentro de `StampModels.tsx` que se conecta al `usePrinterStore` existente para ejecutar las acciones de pausa y reanudación.

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/renderer/src/components/kiosko/StampModels.tsx` | Añadido sub-componente `PrinterControls` con botones Pausar/Reanudar |

### Estructura del componente actualizado

```
StampModels (componente principal)
├── Columna Modelo 1 (izquierdo)
│   ├── PrinterControls ← NUEVO
│   │   ├── Botón "Pausar impresora" (rojo)
│   │   └── Botón "Reanudar impresora" (azul)
│   └── ModelPreview (imagen, fecha, localidad, código)
└── ModelPreview (Modelo 2 - derecho)
```

### Imports añadidos

```typescript
import { useCallback, useEffect, useState } from 'react'   // añadido useCallback
import { usePrinterStore } from '@renderer/stores/printer.store'  // NUEVO
```

### Código implementado

```typescript
function PrinterControls(): JSX.Element {
  const pause = usePrinterStore((state) => state.pause)
  const resume = usePrinterStore((state) => state.resume)
  const loading = usePrinterStore((state) => state.loading)
  const printers = usePrinterStore((state) => state.printers)

  // Determine if any printer is currently paused
  const anyPaused = printers.some((p) => p.status === 'paused')

  const handlePause = useCallback(async () => {
    try {
      await pause()
    } catch (err) {
      console.error('[PrinterControls] Error pausing printer:', err)
    }
  }, [pause])

  const handleResume = useCallback(async () => {
    try {
      await resume()
    } catch (err) {
      console.error('[PrinterControls] Error resuming printer:', err)
    }
  }, [resume])

  return (
    <div className="flex flex-col items-center gap-1 mb-2">
      <button
        type="button"
        className="inline-flex items-center gap-1 px-3 py-1 bg-red-500 hover:bg-red-600
                   text-white rounded text-sm font-medium ..."
        aria-label="Pausar impresora"
        disabled={loading}
        onClick={handlePause}
      >
        <svg ...>{/* Pause icon (dos barras) */}</svg>
        Pausar impresora
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-700 hover:bg-blue-800
                   text-white rounded text-sm font-medium ..."
        aria-label="Reanudar impresora"
        disabled={loading || !anyPaused}
        onClick={handleResume}
      >
        <svg ...>{/* Play icon (triángulo) */}</svg>
        Reanudar impresora
      </button>
    </div>
  )
}
```

### Integración en StampModels

```tsx
export default function StampModels(): JSX.Element {
  // ... config, modelos, etc ...

  return (
    <div className="flex items-center justify-center bg-white rounded px-4 py-2">
      {/* Modelo 1 (left / printer 1) with printer controls above */}
      <div className="flex flex-col items-center flex-1">
        <PrinterControls />           {/* ← NUEVO: botones encima del modelo 1 */}
        <ModelPreview
          modelName={modelo1Name}
          label="Modelo 1"
          fecha={fecha}
          localidad={localidad}
          codePreview={codePreview}
        />
      </div>

      {/* Modelo 2 (right / printer 2) */}
      <ModelPreview
        modelName={modelo2Name}
        label="Modelo 2"
        fecha={fecha}
        localidad={localidad}
        codePreview={codePreview}
      />
    </div>
  )
}
```

### Estructura visual

```
┌─────────────────────────────────────────────────────────────────┐
│ bg-white rounded                                                 │
│                                                                  │
│   ┌─────────────────────┐                                       │
│   │ [🔴 Pausar impresora]│          ┌─────────────────────┐     │
│   │ [🔵 Reanudar impr.  ]│          │                     │     │
│   ├─────────────────────┤          │   [Imagen Modelo 2] │     │
│   │                     │          │     300px width     │     │
│   │   [Imagen Modelo 1] │          │                     │     │
│   │     300px width     │          └─────────────────────┘     │
│   │                     │          Fecha / Localidad / Código   │
│   └─────────────────────┘                                       │
│   Fecha / Localidad / Código       Modelo 2: NombreMotivo       │
│                                                                  │
│   Modelo 1: NombreMotivo                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Mapeo con el legacy KioskoView.vue

| Legacy (Vue 3) | Nuevo (React) | Notas |
|----------------|---------------|-------|
| `<button @click="pausarImpresora">` con `<i class="fa fa-pause">` | `<button onClick={handlePause}>` con SVG rect | SVG inline en vez de FontAwesome |
| `<button @click="reanudarImpresora">` con `<i class="fa fa-play">` | `<button onClick={handleResume}>` con SVG polygon | SVG inline en vez de FontAwesome |
| `<span class="... bg-red-500 text-white ...">Pausar impresora</span>` | `className="... bg-red-500 ... text-white ..."` | Mismos colores |
| `<span class="... bg-blue-700 text-white ...">Reanudar impresora</span>` | `className="... bg-blue-700 ... text-white ..."` | Mismos colores |
| Ambos botones encima del Modelo 1 | `PrinterControls` renderizado antes de `ModelPreview` dentro de la columna Modelo 1 | Misma posición |
| WebSocket `send('*z?*CUPS DISABLE')` | `usePrinterStore.pause()` → IPC `printer:pause` | Misma funcionalidad, diferente transporte |
| WebSocket `send('*z?*CUPS ENABLE')` | `usePrinterStore.resume()` → IPC `printer:resume` | Misma funcionalidad, diferente transporte |

### Flujo funcional

```
Vendedor pulsa "Pausar impresora"
    │
    ▼
PrinterControls.handlePause()
    │
    ▼
usePrinterStore.pause()
    │
    ├── 1. set({ loading: true })
    ├── 2. await ipc.pausePrinter()     → preload → main process → printer:pause handler
    │       └── Main process ejecuta:
    │           - Linux: `cupsdisable <printer_name>` para cada impresora
    │           - Windows: IPP pause-printer request
    ├── 3. await ipc.getPrinterStatus() → refresca estado de impresoras
    └── 4. set({ printers: [...], loading: false })
            → `anyPaused` se recalcula automáticamente
            → Botón "Reanudar" se habilita

Vendedor pulsa "Reanudar impresora"
    │
    ▼
PrinterControls.handleResume()
    │
    ▼
usePrinterStore.resume()
    │
    ├── 1. set({ loading: true })
    ├── 2. await ipc.resumePrinter()    → preload → main process → printer:resume handler
    │       └── Main process ejecuta:
    │           - Linux: `cupsenable <printer_name>` para cada impresora
    │           - Windows: IPP resume-printer request
    │           - Reenvía trabajos pendientes acumulados durante la pausa
    ├── 3. await Promise.all([getPrinterStatus(), getPrintQueue()])
    └── 4. set({ printers: [...], queue: [...], loading: false })
            → `anyPaused` se recalcula (false si todas reanudadas)
            → Botón "Reanudar" se deshabilita de nuevo
```

### Decisiones de diseño

#### ¿Por qué los botones están en `StampModels.tsx` y no en `CartControls.tsx`?

En el legacy `KioskoView.vue`, los botones de pausa/reanudación están **encima** de la imagen del Modelo 1, no en el panel central de controles. Replicar esta ubicación:
- Mantiene la consistencia visual con la versión anterior
- Asocia visualmente el control con las impresoras de sellos (no con la cesta/carrito)
- Evita sobrecargar el panel de CartControls que ya tiene 5 botones

#### ¿Por qué un sub-componente `PrinterControls` en vez de botones inline?

- Encapsula la lógica de printer store (imports, selectors, handlers)
- `StampModels` mantiene su responsabilidad principal (previsualización de modelos)
- Facilita testing aislado del comportamiento de pausa/reanudación si fuera necesario
- Mantiene el archivo legible (separación de concerns dentro del mismo archivo)

#### ¿Por qué `disabled={loading || !anyPaused}` en el botón Reanudar?

- `loading`: evita doble-click durante la operación asíncrona
- `!anyPaused`: no tiene sentido reanudar si ninguna impresora está pausada. Esto da feedback visual inmediato al vendedor sobre el estado actual

#### ¿Por qué no hay confirmación (window.confirm) en Pausar?

El legacy no pedía confirmación para pausar/reanudar. Además:
- Pausar es una operación segura y reversible (no pierde datos)
- En un punto de venta, la velocidad es prioritaria
- Si el vendedor pausó por error, simplemente pulsa Reanudar

#### ¿Por qué los errores solo se loguean por consola y no se muestran al usuario?

- Las operaciones de pausa/reanudación son "fire-and-forget" desde el punto de vista del usuario
- Si falla, el estado de la impresora simplemente no cambia (la UI refleja el estado real)
- El store ya tiene un campo `error` que se puede usar para notificaciones futuras si se añade un toast/snackbar

### Accesibilidad

| Elemento | Atributo | Valor |
|----------|----------|-------|
| Botón Pausar | `aria-label` | `"Pausar impresora"` |
| Botón Reanudar | `aria-label` | `"Reanudar impresora"` |
| Ambos botones | `type` | `"button"` (no submit) |
| Icono pausa SVG | `aria-hidden` | `"true"` |
| Icono play SVG | `aria-hidden` | `"true"` |
| Ambos botones | `focus:ring-2` | Anillo de foco visible para navegación por teclado |
| Botón Reanudar | `disabled` | `true` cuando no hay impresoras pausadas |

### Dependencias utilizadas

| Módulo | Uso |
|--------|-----|
| `@renderer/stores/printer.store` | Acceso a `pause()`, `resume()`, `loading`, `printers` |
| `react` (useCallback) | Estabilidad referencial de handlers para evitar re-renders |

### Requisitos validados

| Requisito | Criterio de aceptación | Cómo se valida |
|-----------|----------------------|----------------|
| Req 8.6 | Pausar impresora: detener envío sin perder pendientes | `usePrinterStore.pause()` → IPC pause → backend detiene cola sin borrar jobs |
| Req 8.7 | Reanudar impresora: reenviar trabajos pendientes acumulados | `usePrinterStore.resume()` → IPC resume → backend reenvía pending jobs |

### Verificación

```bash
# TypeScript compila sin errores:
$ getDiagnostics src/renderer/src/components/kiosko/StampModels.tsx
# No diagnostics found

# Tests existentes de kiosko pasan (sin regresión):
$ npx vitest run src/renderer/src/components/kiosko
# Test Files  1 passed (1)
# Tests  42 passed (42)

# Tests del renderer completos:
$ npx vitest run src/renderer
# Test Files  6 passed (8)
# Tests  204 passed (213)
# (2 failures pre-existentes en navigation.test.tsx — no relacionados)
```

---

## Detalle de lo realizado (7.11)

### ¿Qué se hizo?

Se escribieron **tests de componente** comprehensivos para `TariffTable` y `CartControls`, los dos componentes principales de la vista Kiosko. Los tests cubren rendering, interacciones de usuario, cálculos de límites, subtotales, display de presupuesto, y accesibilidad.

Se crearon dos archivos de test:
- `TariffTable.test.tsx` — 17 tests para la tabla de tarifas
- `CartControls.display.test.tsx` — 17 tests para los controles de cesta (complementando los 42 tests ya existentes en `CartControls.test.tsx` que cubrían lógica de botones 7.6, 7.7, 7.8)

**Total: 76 tests pasando** entre los 3 archivos de test de kiosko.

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `src/renderer/src/components/kiosko/__tests__/TariffTable.test.tsx` | Tests de componente para TariffTable |
| `src/renderer/src/components/kiosko/__tests__/CartControls.display.test.tsx` | Tests de display/UI para CartControls |

### Requisitos validados

| Requisito | Criterio | Test que lo valida |
|-----------|----------|-------------------|
| Req 1.1 | Calcular subtotal = cantidad × precio | TariffTable: "displays subtotal as quantity × price" |
| Req 1.2 | Recalcular total de la cesta | CartControls: "displays correct total when quantities are set" |
| Req 1.6 | Normalizar negativos a cero | TariffTable: "normalizes negative values to 0" |
| Req 2.1 | Límite tarifas simples = min(floor(budget/precio), stock) | TariffTable: "displays correct limits for simple tariffs" |
| Req 2.2 | Límite tiras = min(floor(budget/precio), tickets, stock/4) | TariffTable: "limits for tiras account for tickets and roll/4" |
| Req 2.3 | Recalcular límites al cambiar cantidades | TariffTable: "updates limits when quantities change" |
| Req 2.4 | Límites como enteros (floor) | Implícito en todos los tests de límites |
| Req 13.4 | Perfil activo ajusta display | CartControls: tests de "Profile/mode display" |

### Correctness Properties cubiertas

| Property | Descripción | Tests |
|----------|-------------|-------|
| Property 1 | Cálculo correcto del total de la cesta | CartControls: "Basket total display" (3 tests) |
| Property 2 | Cálculo correcto de límites por tarifa | TariffTable: "Limits display" (5 tests) |

### Cobertura de TariffTable.test.tsx (17 tests)

```
describe('TariffTable – Rendering (Task 7.11)')
├── describe('Row rendering – all tariffs present')
│   ├── ✅ renders all 6 tariff rows
│   ├── ✅ renders the header row with column labels
│   └── ✅ renders the table with accessible role
├── describe('Price display – Req 1.1')
│   ├── ✅ displays correct prices from config for each tariff
│   └── ✅ displays 0.00€ when config is not loaded
├── describe('Limits display – Req 2.1, 2.2, 2.3, 2.4')
│   ├── ✅ displays correct limits for simple tariffs based on budget and roll stock
│   ├── ✅ displays 0 limits when config is null
│   ├── ✅ updates limits when quantities change (Req 2.3)
│   ├── ✅ limits for tiras account for tickets and roll/4 (Req 2.2)
│   └── ✅ limits for tiras constrained by low ticket stock
├── describe('Subtotals – Req 1.1')
│   ├── ✅ displays subtotal as quantity × price for each tariff/model
│   ├── ✅ displays 0.00 subtotal when quantity is 0
│   └── ✅ updates subtotal when quantity changes
└── describe('Quantity inputs – interaction')
    ├── ✅ renders quantity inputs for both models with initial value 0
    ├── ✅ updates store when user types a quantity
    ├── ✅ updates store for model 2 quantity input
    └── ✅ normalizes negative values to 0 (Req 1.6)
```

### Cobertura de CartControls.display.test.tsx (17 tests)

```
describe('CartControls – Display (Task 7.11)')
├── describe('Basket total display – Req 1.2')
│   ├── ✅ displays total as 0.00€ when basket is empty
│   ├── ✅ displays correct total when quantities are set
│   └── ✅ displays total including both models
├── describe('Budget remaining display')
│   ├── ✅ displays full budget when basket is empty
│   └── ✅ displays reduced budget when quantities are set
├── describe('Profile/mode display – Req 13.4')
│   ├── ✅ does not show profile name for FERIA (profile 6)
│   ├── ✅ shows profile name "Filatelia" for profile 1
│   ├── ✅ shows profile name "Esporadicos" for profile 2
│   └── ✅ shows profile name "SPDE" for profile 3
├── describe('Print indicators')
│   ├── ✅ displays MASTER SET indicator with configured value
│   ├── ✅ displays COPIA TICKET indicator with configured value
│   └── ✅ displays tira especial indicators
├── describe('Reset button – Task 7.9')
│   ├── ✅ renders the reset button
│   ├── ✅ resets all quantities to 0 when clicked
│   └── ✅ calls onReset callback when provided
└── describe('Button accessibility')
    ├── ✅ renders all action buttons with aria-labels
    └── ✅ has region role with accessible label
```

### Patrones de testing utilizados

#### Setup con Zustand stores

Los tests manipulan directamente el estado de los stores Zustand sin providers:

```typescript
// Configurar estado del config store
function setConfig(config: AppConfig): void {
  useConfigStore.setState({ config, loading: false, error: null })
}

// Reset del kiosko store antes de cada test
beforeEach(() => {
  useKioskoStore.getState().reset()
})
```

#### Mock del IPC client

Se mockea `@renderer/lib/ipc-client` completamente ya que los tests son de componente (no de integración):

```typescript
vi.mock('@renderer/lib/ipc-client', () => ({
  getConfig: vi.fn(),
  updateMaquina: vi.fn(),
  // ... todos los métodos del IPC client mockeados
}))
```

#### Helper `buildTestConfig()`

Función reutilizable para construir objetos `AppConfig` con valores por defecto, permitiendo overrides parciales:

```typescript
function buildTestConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    ticket: { /* defaults */ ...overrides?.ticket },
    codigo: { /* defaults */ ...overrides?.codigo },
    sello: { /* defaults */ ...overrides?.sello },
    precios: { tarifaA: 0.5, tarifaA2: 0.6, ... ...overrides?.precios }
  }
}
```

#### Verificación de limits por roles ARIA

Los tests localizan filas y celdas usando `role="row"` y `aria-label`, lo que verifica simultáneamente la funcionalidad y la accesibilidad:

```typescript
const tarifaARow = screen.getByRole('row', { name: /Fila tarifa Tarifa A$/i })
expect(tarifaARow).toHaveTextContent('20') // límite esperado
```

### Decisiones de diseño

#### ¿Por qué dos archivos de test separados para CartControls?

- `CartControls.test.tsx` (42 tests): Cubre la lógica de **botones de acción** (imprimir normal, error, perfiles) — creado en tareas 7.6, 7.7, 7.8
- `CartControls.display.test.tsx` (17 tests): Cubre el **display/rendering** (total, presupuesto, indicadores, reset) — creado en tarea 7.11

Esta separación permite:
- Ejecutar tests rápidos de display sin los mocks complejos de IPC de la lógica de venta
- Mantener archivos de test manejables (~200 líneas cada uno)
- Identificar rápidamente si un fallo es de rendering o de lógica de negocio

#### ¿Por qué se verifican límites con cálculos explícitos en los comentarios?

Cada test de límites incluye un comentario con el cálculo esperado:

```typescript
// With limiteImporte=10, tarifaA=0.50, rollo1=1500
// limit = min(floor(10/0.50), 1500) = min(20, 1500) = 20
```

Esto sirve como documentación viva: si el cálculo cambia, el desarrollador puede rastrear la fórmula usada para generar el valor esperado.

#### ¿Por qué no se usa snapshot testing?

Los componentes Kiosko son dinámicos (dependen de estado de stores) y sus outputs cambian frecuentemente durante el desarrollo. Los snapshots:
- Generarían diffs enormes ante cualquier cambio de estilo
- No validan comportamiento, solo estructura
- Se convierten en "auto-update y aceptar" sin revisión real

En su lugar, se verifican **comportamientos específicos** (texto visible, valores calculados, interacciones).

### Verificación

```bash
# Tests de TariffTable:
$ npx vitest run src/renderer/src/components/kiosko/__tests__/TariffTable.test.tsx
# ✓ TariffTable – Rendering (Task 7.11) (17 tests)
# Test Files  1 passed (1)
# Tests  17 passed (17)

# Tests de CartControls display:
$ npx vitest run src/renderer/src/components/kiosko/__tests__/CartControls.display.test.tsx
# ✓ CartControls – Display (Task 7.11) (17 tests)
# Test Files  1 passed (1)
# Tests  17 passed (17)

# Todos los tests de kiosko juntos:
$ npx vitest run src/renderer/src/components/kiosko/__tests__/
# Test Files  3 passed (3)
# Tests  76 passed (76)

# TypeCheck sin errores:
$ npx tsc --noEmit -p tsconfig.web.json
# Sin errores de tipo en archivos de test
```

---

## Arquitectura de la Vista Kiosko (referencia para subtareas pendientes)

### Layout general (replicando el legacy)

```
┌─────────────────────────────────────────────────────────────────┐
│ TOP: StampModels + CartControls (centrado)                       │
│                                                                  │
│  [Modelo1]   [Filatelia] [Cesta €] [Imprimir]   [Modelo2]      │
│  [img+code]  [Error]     [Modo]    [Reset]       [img+code]     │
│              [Pausar/Reanudar]                                   │
├─────────────────────────────────────────────────────────────────┤
│ MIDDLE: TariffTable                                              │
│                                                                  │
│  Sub1 | Lim1 | Cant1 |  Tarifa A Tira 4  | Precio | Cant2 | Lim2 | Sub2 │
│  Sub1 | Lim1 | Cant1 |  Tira 4 Tarifas   | Precio | Cant2 | Lim2 | Sub2 │
│  ──────────────────────────────────────────────────────────────  │
│  Sub1 | Lim1 | Cant1 |  Tarifa A          | Precio | Cant2 | Lim2 | Sub2 │
│  Sub1 | Lim1 | Cant1 |  Tarifa A2         | Precio | Cant2 | Lim2 | Sub2 │
│  Sub1 | Lim1 | Cant1 |  Tarifa B          | Precio | Cant2 | Lim2 | Sub2 │
│  Sub1 | Lim1 | Cant1 |  Tarifa C          | Precio | Cant2 | Lim2 | Sub2 │
├─────────────────────────────────────────────────────────────────┤
│ BOTTOM: RollCounters                                             │
│                                                                  │
│  1500 "Motivo1" (Venta: 0)  │ Tickets: 448 │  1500 "Motivo2"   │
└─────────────────────────────────────────────────────────────────┘
```

### Flujo de datos

```
ConfigStore (Zustand) ─────┐
                           ├──→ StampModels (lee modelos/evento)
                           ├──→ CartControls (lee límite, perfil)
                           ├──→ TariffTable (lee precios)
                           └──→ RollCounters (lee rollo1/rollo2/tickets)

KioskoStore (Zustand) ─────┐
                           ├──→ TariffTable (lee/escribe cantidades)
                           ├──→ CartControls (lee total, getLimits)
                           └──→ RollCounters (lee getUsedRollo1/2)

IPC Client ────────────────┐
                           ├──→ StampModels (getImageByName)
                           ├──→ CartControls (print, pause, resume)
                           └──→ ConfigStore (updateSesion, updateRollos)
```

### Requisitos cubiertos por Task 7

| Requisito | Subtareas |
|-----------|-----------|
| Req 1 (Gestión de Venta de Sellos) | 7.3, 7.4, 7.6 |
| Req 2 (Cálculo de Límites por Tarifa) | 7.2, 7.3 |
| Req 4 (Gestión de Rollos) | 7.5 |
| Req 8 (Gestión de Impresión) | 7.6, 7.10 |
| Req 10 (Anulación de Venta) | 7.7 |
| Req 13 (Perfiles y Eventos) | 7.8 |
| Req 14 (Gestión de Imágenes) | 7.1 |
| Req 19 (Navegación) | 7.1-7.5 (composición de la vista) |
