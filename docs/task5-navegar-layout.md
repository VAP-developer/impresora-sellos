# Task 5: Navegación y Layout

## Resumen

Esta tarea implementa el sistema de navegación de la aplicación usando **react-router-dom**, replicando las 5 vistas del sistema legacy (Home, Kiosko, Máquina, Imprimir, SubirImagen) y añadiendo un layout compartido con componente de navegación.

---

## Progreso

| # | Subtarea | Estado |
|---|----------|--------|
| 5.1 | Instalar react-router-dom y configurar `src/renderer/src/router.tsx` con las 5 rutas | ✅ Completada |
| 5.2 | Crear `src/renderer/src/components/layout/MainLayout.tsx` con estructura base | ✅ Completada |
| 5.3 | Crear `src/renderer/src/components/layout/NavComponent.tsx` con navegación entre vistas | ✅ Completada |
| 5.4 | Crear placeholder views: HomeView, KioskoView, MaquinaView, ImprimirView, SubirImagenView | ✅ Completada |
| 5.5 | Verificar navegación funcional entre todas las vistas | ✅ Completada |

---

## Detalle de lo realizado (5.1)

### ¿Qué se hizo?

Se instaló **react-router-dom** como dependencia de producción y se creó el archivo de configuración de rutas `src/renderer/src/router.tsx` con las 5 vistas definidas en el design. Además se integró el router en `App.tsx` y se actualizaron los tests existentes.

### Dependencia instalada

| Paquete | Versión | Tipo | Propósito |
|---------|---------|------|-----------|
| `react-router-dom` | ^7.18.0 | dependency | Enrutamiento client-side para la SPA del renderer |

### Cambios en `package.json`

```diff
  "dependencies": {
    ...
    "clsx": "^2.1.1",
+   "react-router-dom": "^7.18.0",
    "tailwind-merge": "^3.6.0",
    "zustand": "^5.0.14"
  }
```

### Archivos creados/modificados

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/renderer/src/router.tsx` | Creado | Configuración de rutas con `createHashRouter` |
| `src/renderer/src/App.tsx` | Modificado | Integración de `RouterProvider` |
| `src/renderer/src/__tests__/app-init.test.tsx` | Modificado | Tests actualizados para el nuevo contenido |

### `src/renderer/src/router.tsx`

```typescript
import { createHashRouter, Navigate } from 'react-router-dom'

// Placeholder views — will be replaced with real implementations in subsequent tasks
function HomeView(): JSX.Element {
  return <div className="p-4"><h1 className="text-2xl font-semibold">Home</h1></div>
}

function KioskoView(): JSX.Element {
  return <div className="p-4"><h1 className="text-2xl font-semibold">Kiosko</h1></div>
}

function MaquinaView(): JSX.Element {
  return <div className="p-4"><h1 className="text-2xl font-semibold">Máquina</h1></div>
}

function ImprimirView(): JSX.Element {
  return <div className="p-4"><h1 className="text-2xl font-semibold">Imprimir</h1></div>
}

function SubirImagenView(): JSX.Element {
  return <div className="p-4"><h1 className="text-2xl font-semibold">Subir Imagen</h1></div>
}

export const router = createHashRouter([
  {
    path: '/',
    element: <Navigate to="/home" replace />
  },
  {
    path: '/home',
    element: <HomeView />
  },
  {
    path: '/kiosko',
    element: <KioskoView />
  },
  {
    path: '/maquina',
    element: <MaquinaView />
  },
  {
    path: '/imprimir',
    element: <ImprimirView />
  },
  {
    path: '/subir-imagen',
    element: <SubirImagenView />
  }
])
```

### Decisiones de diseño

#### ¿Por qué `createHashRouter` y no `createBrowserRouter`?

En Electron, el renderer carga archivos locales (`file://` protocol) en producción. El **hash router** usa el fragmento de la URL (`#/kiosko`) para la navegación, lo cual:

- Funciona sin servidor HTTP (compatible con `file://`)
- No requiere configuración de fallback para rutas desconocidas
- Es el patrón estándar para apps Electron con routing client-side

#### ¿Por qué un redirect de `/` a `/home`?

La ruta raíz (`/`) redirige automáticamente a `/home` para que la app siempre muestre una vista válida al arrancar. Esto replica el comportamiento del legacy donde `HomeView` era la pantalla de inicio.

#### Rutas definidas (matching con el design)

| Ruta | Vista | Descripción |
|------|-------|-------------|
| `/` | → Redirect | Redirige a `/home` |
| `/home` | HomeView | Menú principal con accesos a configuración y máquina |
| `/kiosko` | KioskoView | Vista principal de venta: tabla de tarifas, carrito, impresión |
| `/maquina` | MaquinaView | Config de código etiqueta, ticket, rollos |
| `/imprimir` | ImprimirView | Config de perfil, eventos, tarifas |
| `/subir-imagen` | SubirImagenView | Subida de imágenes de fondo para sellos |

### Cambios en `App.tsx`

El componente `App` ahora renderiza `<RouterProvider router={router} />` en lugar del placeholder estático. La lógica de inicialización (carga de config y estado de impresoras) se mantiene intacta:

```typescript
import { RouterProvider } from 'react-router-dom'
import { router } from './router'

function App(): JSX.Element {
  // ... loading/error states sin cambios ...

  return <RouterProvider router={router} />
}
```

El flujo es:
1. App monta → carga config vía IPC
2. Mientras carga → muestra "Cargando configuración..."
3. Si error → muestra mensaje de error
4. Si OK → renderiza el router (que muestra HomeView por defecto)

### Cambios en tests (`app-init.test.tsx`)

Dos tests buscaban el texto `'Stamp Sales App'` que era el antiguo placeholder. Ahora el router renderiza `HomeView` con el texto `'Home'`:

```diff
- expect(screen.getByText('Stamp Sales App')).toBeInTheDocument()
+ expect(screen.getByText('Home')).toBeInTheDocument()
```

Tests afectados:
- `should render main content after successful load`
- `should handle printer status load failure gracefully`

### Verificación

```bash
# TypeScript compila sin errores:
$ npx tsc --noEmit -p tsconfig.web.json
# Solo warnings pre-existentes en archivos de test (unused vars)

# Tests pasan correctamente:
$ npx vitest run src/renderer/src/__tests__/app-init.test.tsx
# ✓ 10 tests passed

# react-router-dom instalado:
$ node -e "console.log(require('react-router-dom/package.json').version)"
# 7.18.0
```

### Notas

- Los componentes de vista son **placeholders temporales** que serán reemplazados en las tareas 5.4 (vistas separadas) y 6-10 (implementación completa de cada vista).
- En la tarea 5.2 se añadió el `MainLayout` con `<Outlet />` que envuelve las rutas, proporcionando la barra de navegación persistente.

---

## Detalle de lo realizado (5.2)

### ¿Qué se hizo?

Se creó el componente **MainLayout** que actúa como layout wrapper para todas las vistas de la aplicación. Replica la estructura del legacy `App.vue` (NavComponent + router-view) usando React Router's `<Outlet />`. Además se reestructuró el router para usar rutas anidadas bajo el layout.

### Archivos creados/modificados

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/renderer/src/components/layout/MainLayout.tsx` | Creado | Layout principal con nav + Outlet |
| `src/renderer/src/router.tsx` | Modificado | Reestructurado a rutas anidadas bajo MainLayout |

### `src/renderer/src/components/layout/MainLayout.tsx`

```typescript
import { Outlet } from 'react-router-dom'

export default function MainLayout(): JSX.Element {
  return (
    <div id="app-root" className="min-h-screen bg-gray-50 flex flex-col">
      {/* NavComponent will be added here in Task 5.3 */}
      <nav className="h-[100px] bg-[rgb(255,192,0)] flex items-center px-4 shrink-0">
        <span className="text-sm text-gray-700">
          [Navegación — se implementará en Task 5.3]
        </span>
      </nav>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
```

### Cambios en `src/renderer/src/router.tsx`

La estructura de rutas pasó de ser **plana** (cada ruta al mismo nivel) a **anidada** (todas las vistas como hijas de MainLayout):

```diff
- import { createHashRouter, Navigate } from 'react-router-dom'
+ import { createHashRouter, Navigate } from 'react-router-dom'
+ import MainLayout from './components/layout/MainLayout'

  export const router = createHashRouter([
-   {
-     path: '/',
-     element: <Navigate to="/home" replace />
-   },
-   {
-     path: '/home',
-     element: <HomeView />
-   },
-   ...
+   {
+     path: '/',
+     element: <MainLayout />,
+     children: [
+       { index: true, element: <Navigate to="/home" replace /> },
+       { path: 'home', element: <HomeView /> },
+       { path: 'kiosko', element: <KioskoView /> },
+       { path: 'maquina', element: <MaquinaView /> },
+       { path: 'imprimir', element: <ImprimirView /> },
+       { path: 'subir-imagen', element: <SubirImagenView /> },
+     ]
+   }
  ])
```

### Decisiones de diseño

#### Estructura del layout

El layout usa un **flex column** (`flex flex-col`) con:
- `<nav>` fijo arriba con `shrink-0` — no se comprime aunque el contenido crezca
- `<main>` con `flex-1 overflow-auto` — ocupa el espacio restante con scroll propio

Esto garantiza que la barra de navegación siempre sea visible y el contenido de cada vista scrollea independientemente.

#### Placeholder de navegación

La barra incluye un placeholder temporal con el color dorado del legacy (`rgb(255,192,0)`) y la altura exacta (`100px`). En la tarea 5.3 se reemplazará por el componente `NavComponent` con los links reales.

#### `<Outlet />` de React Router

`<Outlet />` renderiza el componente de la ruta hija activa. Al navegar entre vistas, solo cambia el contenido dentro de `<main>`, manteniendo el layout (nav) persistente sin remontarse.

### Mapeo con el legacy

| Legacy (App.vue) | Nuevo (MainLayout.tsx) |
|---|---|
| `<NavComponent />` | `<nav>` placeholder (→ Task 5.3) |
| `<router-view />` | `<Outlet />` |
| `min-h-screen bg-gray-50` | `min-h-screen bg-gray-50 flex flex-col` |

### Verificación

```bash
# TypeScript compila sin errores:
$ npx tsc --noEmit -p tsconfig.web.json
# OK

# Diagnostics limpios:
# MainLayout.tsx: No diagnostics found
# router.tsx: No diagnostics found

# Tests del renderer pasan:
$ npx vitest run src/renderer
# ✓ 5 test files passed (138 tests)
```

### Notas

- El componente `NavComponent` (Task 5.3) reemplazará el placeholder `<nav>` actual.
- Las placeholder views definidas en `router.tsx` se extraerán a archivos separados en Task 5.4.

---

## Detalle de lo realizado (5.3)

### ¿Qué se hizo?

Se creó el componente **NavComponent** que implementa la barra de navegación principal de la aplicación, replicando fielmente el layout y contenido del legacy `NavComponent.vue`. Se integró en `MainLayout.tsx` reemplazando el placeholder temporal. También se añadió la animación `fadeIn` a la configuración de Tailwind.

### Archivos creados/modificados

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/renderer/src/components/layout/NavComponent.tsx` | Creado | Barra de navegación con links a las 5 vistas |
| `src/renderer/src/components/layout/MainLayout.tsx` | Modificado | Importa y renderiza NavComponent |
| `tailwind.config.js` | Modificado | Añadida animación `fadeIn` para el popup de info |

### `src/renderer/src/components/layout/NavComponent.tsx`

Estructura del componente (izquierda a derecha):

```
[Home] ── espacio ── [Imprimir] ── espacio ── [Info ℹ] ── espacio ── [Máquina] ── espacio ── espacio ── [Kiosko]
```

Funcionalidades:
- **Links de navegación** con `react-router-dom` `<Link>` a `/home`, `/imprimir`, `/maquina`, `/kiosko`
- **Indicador de ruta activa** — fondo semitransparente (`bg-yellow-500/50`) en el link de la vista actual
- **Popup de información** — tooltip toggle con instrucciones de uso del kiosko (texto íntegro del legacy)
- **Cierre de popup por click externo** — `useEffect` con event listener en `document`
- **Iconos SVG inline** — sin dependencia de archivos de imagen externos

### Cambios en `MainLayout.tsx`

```diff
- import { Outlet } from 'react-router-dom'
+ import { Outlet } from 'react-router-dom'
+ import NavComponent from './NavComponent'

  export default function MainLayout(): JSX.Element {
    return (
      <div id="app-root" className="min-h-screen bg-gray-50 flex flex-col">
-       {/* NavComponent will be added here in Task 5.3 */}
-       <nav className="h-[100px] bg-[rgb(255,192,0)] flex items-center px-4 shrink-0">
-         <span className="text-sm text-gray-700">
-           [Navegación — se implementará en Task 5.3]
-         </span>
-       </nav>
+       <NavComponent />

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    )
  }
```

### Cambios en `tailwind.config.js`

Se añadieron keyframes y animation para el popup de información:

```diff
  theme: {
    extend: {
      ...
      borderRadius: { ... },
+     keyframes: {
+       fadeIn: {
+         from: { opacity: '0' },
+         to: { opacity: '1' }
+       }
+     },
+     animation: {
+       fadeIn: 'fadeIn 0.3s ease-in'
+     }
    }
  }
```

### Mapeo con el legacy NavComponent.vue

| Legacy | Nuevo | Notas |
|--------|-------|-------|
| `<router-link to="/home">` + `<img izquierda.png>` | `<Link to="/home">` + SVG HomeIcon | Icono SVG inline en lugar de imagen PNG |
| `<router-link to="/imprimir">` + `<img jckiosco-V5.svg>` | `<Link to="/imprimir">` + SVG PrinterIcon | Mantiene posición central-izquierda |
| `<div @click="togglePopup">` + `<img info.svg>` | `<button onClick>` + SVG InfoIcon | Botón accesible con `aria-expanded` |
| `<router-link to="/maquina">` + `<img jckiosco.svg>` | `<Link to="/maquina">` + SVG MachineIcon | Mantiene posición central-derecha |
| `<router-link to="/kiosko">` + `<img derecha.png>` | `<Link to="/kiosko">` + SVG KioskoIcon | Icono SVG inline en lugar de imagen PNG |
| `v-show="showPopup"` + popup texto | `{showPopup && <div>}` + mismo texto | Contenido de ayuda idéntico al legacy |
| CSS `.animate-fadeIn` scoped | Tailwind `animate-fadeIn` class | Configurada en tailwind.config.js |

### Decisiones de diseño

#### ¿Por qué SVG inline en lugar de imágenes?

El proyecto aún no tiene los assets de imagen (`izquierda.png`, `derecha.png`, `jckiosco.svg`, `info.svg`) copiados al nuevo proyecto. Los SVG inline:
- Son autocontenidos (sin dependencias de archivos)
- Pueden colorearse con CSS (`currentColor`)
- Se pueden reemplazar fácilmente por imágenes reales cuando estén disponibles

#### ¿Por qué `useLocation` para indicar ruta activa?

A diferencia de `NavLink` (que solo añade clases), se usa `useLocation` + `isActive()` para tener control total del estilo activo con la utilidad `cn()`. El highlight visual da feedback inmediato al vendedor de en qué sección se encuentra.

#### Accesibilidad

- Cada link tiene `aria-label` descriptivo
- El botón de info tiene `aria-expanded` que refleja si el popup está abierto
- El popup tiene `role="tooltip"`
- Los iconos SVG llevan `aria-hidden="true"` (son decorativos)

#### Popup de información

El contenido del popup es una réplica exacta del texto legacy. Incluye instrucciones operativas para el vendedor:
- Uso de perfiles (Filatelia, Protocolo, SPDE)
- Procedimiento de anulación de venta
- Advertencia sobre campos de cantidad vacíos

### Verificación

```bash
# TypeScript compila sin errores en los archivos modificados:
$ getDiagnostics NavComponent.tsx MainLayout.tsx
# No diagnostics found

# TypeCheck del proyecto web:
$ npx tsc --noEmit -p tsconfig.web.json
# Solo warnings pre-existentes en tests (unused vars)

# Suite de tests no se ve afectada:
$ npx vitest run src/renderer
# Tests pasan (los failures son de better-sqlite3 native, no relacionados)
```

### Notas

- Los iconos SVG son representaciones genéricas. Cuando se copien los assets originales (`izquierda.png`, `derecha.png`, etc.) al proyecto, se podrán usar `<img>` en su lugar.
- El texto de labels (`Inicio`, `Imprimir`, `Máquina`, `Kiosko`) se oculta en pantallas pequeñas (`hidden sm:inline`) pero la app está pensada para pantalla completa en el portátil de producción.
- El popup se posiciona con `left-1/2 -translate-x-1/2` (centrado horizontal). En pantallas muy estrechas podría cortarse — no es problema en producción (pantalla fija).

---

## Detalle de lo realizado (5.4)

### ¿Qué se hizo?

Se extrajeron las placeholder views que estaban definidas inline en `router.tsx` a archivos independientes en un nuevo directorio `src/renderer/src/views/`. Cada vista es un componente React con nombre descriptivo y texto indicando su propósito futuro. Se creó también un barrel file (`index.ts`) para importaciones limpias.

### Archivos creados/modificados

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/renderer/src/views/HomeView.tsx` | Creado | Placeholder menú principal |
| `src/renderer/src/views/KioskoView.tsx` | Creado | Placeholder vista de venta |
| `src/renderer/src/views/MaquinaView.tsx` | Creado | Placeholder configuración máquina |
| `src/renderer/src/views/ImprimirView.tsx` | Creado | Placeholder configuración impresión |
| `src/renderer/src/views/SubirImagenView.tsx` | Creado | Placeholder gestión de imágenes |
| `src/renderer/src/views/index.ts` | Creado | Barrel file para exportaciones |
| `src/renderer/src/router.tsx` | Modificado | Importa vistas desde `./views` en lugar de definirlas inline |

### Estructura de `src/renderer/src/views/`

```
src/renderer/src/views/
├── HomeView.tsx
├── KioskoView.tsx
├── MaquinaView.tsx
├── ImprimirView.tsx
├── SubirImagenView.tsx
└── index.ts
```

### Contenido de las vistas (ejemplo: `KioskoView.tsx`)

```typescript
export default function KioskoView(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <h1 className="text-3xl font-bold mb-4">Kiosko</h1>
      <p className="text-muted-foreground">Vista principal de venta — Tabla de tarifas, carrito, impresión</p>
    </div>
  )
}
```

Todas las vistas siguen el mismo patrón: un contenedor centrado con título `<h1>` y descripción `<p>` indicando qué funcionalidad implementarán en las tareas 6-10.

### Barrel file (`index.ts`)

```typescript
export { default as HomeView } from './HomeView'
export { default as KioskoView } from './KioskoView'
export { default as MaquinaView } from './MaquinaView'
export { default as ImprimirView } from './ImprimirView'
export { default as SubirImagenView } from './SubirImagenView'
```

### Cambios en `router.tsx`

Antes (inline):

```typescript
import { createHashRouter, Navigate } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'

function HomeView(): JSX.Element { ... }
function KioskoView(): JSX.Element { ... }
// ... 5 funciones inline
```

Después (importado):

```typescript
import { createHashRouter, Navigate } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import { HomeView, KioskoView, MaquinaView, ImprimirView, SubirImagenView } from './views'

export const router = createHashRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Navigate to="/home" replace /> },
      { path: 'home', element: <HomeView /> },
      { path: 'kiosko', element: <KioskoView /> },
      { path: 'maquina', element: <MaquinaView /> },
      { path: 'imprimir', element: <ImprimirView /> },
      { path: 'subir-imagen', element: <SubirImagenView /> },
    ]
  }
])
```

### Decisiones de diseño

#### ¿Por qué un directorio `views/` separado?

- **Separación de responsabilidades**: Las vistas son componentes de página (top-level), distintos de los componentes reutilizables en `components/`.
- **Consistencia con el design**: El design doc define la estructura con vistas separadas (`HomeView`, `KioskoView`, etc.) como archivos independientes.
- **Facilidad de reemplazo**: En las tareas 6-10, cada archivo se expandirá con la implementación real sin tocar otros archivos.

#### ¿Por qué un barrel file?

Permite una sola línea de import en `router.tsx` en lugar de 5 imports individuales. Mantiene el router limpio y legible.

#### ¿Por qué `export default` en cada vista?

- Patrón estándar para componentes React de página (un componente por archivo)
- Compatible con re-exportación via barrel (`export { default as X }`)
- Facilita lazy loading futuro con `React.lazy(() => import('./views/HomeView'))`

### Mapeo con el legacy

| Legacy (Vue Router) | Nuevo (React Router) |
|---------------------|---------------------|
| `imports/ui/views/HomeView.vue` | `src/renderer/src/views/HomeView.tsx` |
| `imports/ui/views/KioskoView.vue` | `src/renderer/src/views/KioskoView.tsx` |
| `imports/ui/views/MaquinaView.vue` | `src/renderer/src/views/MaquinaView.tsx` |
| `imports/ui/views/ImprimirView.vue` | `src/renderer/src/views/ImprimirView.tsx` |
| `imports/ui/views/SubirImagenView.vue` | `src/renderer/src/views/SubirImagenView.tsx` |

### Verificación

```bash
# Diagnostics limpios en todos los archivos:
$ getDiagnostics src/renderer/src/views/*.tsx src/renderer/src/views/index.ts src/renderer/src/router.tsx
# No diagnostics found (7 files)

# Build completo pasa sin errores:
$ npm run build
# ✓ main: 12 modules, 314ms
# ✓ preload: 1 module, 16ms
# ✓ renderer: 56 modules, 1.34s

# Tests existentes siguen pasando:
$ npx vitest run src/renderer/src/__tests__/app-init.test.tsx
# ✓ 10 tests passed
```

### Notas

- Las vistas son **placeholders** que serán reemplazados en las tareas 6 (Home), 7 (Kiosko), 8 (Máquina), 9 (Imprimir) y 10 (SubirImagen).
- El texto descriptivo en cada vista sirve de recordatorio visual durante desarrollo de lo que falta implementar.
- Cuando se implemente lazy loading (optimización futura), solo hay que cambiar los imports en `router.tsx` a `React.lazy()` — la estructura de archivos ya lo soporta.


---

## Detalle de lo realizado (5.5)

### ¿Qué se hizo?

Se creó un test de integración exhaustivo (`navigation.test.tsx`) que verifica la navegación funcional entre todas las vistas de la aplicación. El test confirma que el router, el layout, el NavComponent y las 5 vistas funcionan correctamente de forma conjunta.

### Archivos creados

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/renderer/src/__tests__/navigation.test.tsx` | Creado | Test de integración para navegación (18 tests) |

### Estructura del test

El test usa `createMemoryRouter` de react-router-dom (en lugar del `createHashRouter` de producción) para poder controlar la ruta inicial en cada caso de prueba sin depender de un DOM completo.

```typescript
function renderWithRouter(initialRoute = '/home') {
  const routes = [
    {
      path: '/',
      element: <MainLayout />,
      children: [
        { path: 'home', element: <HomeView /> },
        { path: 'kiosko', element: <KioskoView /> },
        { path: 'maquina', element: <MaquinaView /> },
        { path: 'imprimir', element: <ImprimirView /> },
        { path: 'subir-imagen', element: <SubirImagenView /> }
      ]
    }
  ]

  const router = createMemoryRouter(routes, { initialEntries: [initialRoute] })
  return render(<RouterProvider router={router} />)
}
```

### Categorías de tests (18 total)

#### 1. Route rendering (5 tests)

Verifica que cada ruta renderiza su vista correspondiente:

| Ruta | Aserción |
|------|----------|
| `/home` | Heading "Home" + texto "Menú principal" |
| `/kiosko` | Heading "Kiosko" + texto "Vista principal de venta" |
| `/maquina` | Heading "Máquina" + texto "Configuración de código" |
| `/imprimir` | Heading "Imprimir" + texto "Configuración de perfiles" |
| `/subir-imagen` | Heading "Subir Imagen" + texto "Gestión de imágenes" |

#### 2. NavComponent links (5 tests)

Verifica que los links del NavComponent navegan correctamente:

| Test | Flujo |
|------|-------|
| Home → Kiosko | Click en "Kiosko de venta" → vista Kiosko visible |
| Home → Máquina | Click en "Configuración de máquina" → vista Máquina visible |
| Home → Imprimir | Click en "Configuración de impresión" → vista Imprimir visible |
| Kiosko → Home | Click en "Inicio" → vista Home visible |
| Secuencia completa | Home → Kiosko → Máquina → Imprimir → Home |

#### 3. Layout structure (3 tests)

Verifica que el layout compartido funciona:

- NavComponent presente en todas las vistas (con todos los links)
- NavComponent presente incluso en vista Kiosko (no se pierde al navegar)
- Info popup se muestra/oculta al hacer click (con contenido correcto)

#### 4. Active state styling (5 tests)

Verifica que el link activo recibe la clase correcta:

| Ruta | Link con `bg-yellow-500/50` |
|------|-----------------------------|
| `/home` | "Inicio" |
| `/kiosko` | "Kiosko de venta" |
| `/maquina` | "Configuración de máquina" |
| `/imprimir` | "Configuración de impresión" |
| Cualquiera | Links inactivos NO tienen la clase |

### Decisiones de diseño del test

#### ¿Por qué `getByRole('heading')` en lugar de `getByText`?

Algunos textos como "Kiosko" e "Imprimir" aparecen tanto en el NavComponent (como label del link) como en el contenido de la vista (como `<h1>`). Usar `getByRole('heading', { name: 'Kiosko' })` es preciso y evita ambigüedades.

#### ¿Por qué `getByLabelText` para clicks de navegación?

Los links del NavComponent tienen `aria-label` descriptivos (`"Inicio"`, `"Kiosko de venta"`, `"Configuración de máquina"`, `"Configuración de impresión"`). Usar estos labels es:
- Más resiliente a cambios de texto visual
- Valida que la accesibilidad está correcta
- Evita conflictos con texto duplicado en la página

#### ¿Por qué `createMemoryRouter`?

A diferencia de `createHashRouter` (que depende de `window.location`), `createMemoryRouter` mantiene el historial en memoria. Esto permite:
- Inicializar el test en cualquier ruta (`initialEntries: ['/kiosko']`)
- No necesitar limpiar el estado de URL entre tests
- Ejecutar tests en jsdom sin problemas

### Resultados

```bash
$ npx vitest run src/renderer/src/__tests__/navigation.test.tsx

 ✓ src/renderer/src/__tests__/navigation.test.tsx (18 tests) 502ms
   ✓ Navigation – Task 5.5 Verification > Route rendering > renders HomeView at /home
   ✓ Navigation – Task 5.5 Verification > Route rendering > renders KioskoView at /kiosko
   ✓ Navigation – Task 5.5 Verification > Route rendering > renders MaquinaView at /maquina
   ✓ Navigation – Task 5.5 Verification > Route rendering > renders ImprimirView at /imprimir
   ✓ Navigation – Task 5.5 Verification > Route rendering > renders SubirImagenView at /subir-imagen
   ✓ Navigation – Task 5.5 Verification > NavComponent links > navigates from Home to Kiosko via nav link
   ✓ Navigation – Task 5.5 Verification > NavComponent links > navigates from Home to Maquina via nav link
   ✓ Navigation – Task 5.5 Verification > NavComponent links > navigates from Home to Imprimir via nav link
   ✓ Navigation – Task 5.5 Verification > NavComponent links > navigates from Kiosko back to Home via nav link
   ✓ Navigation – Task 5.5 Verification > NavComponent links > navigates between all views in sequence
   ✓ Navigation – Task 5.5 Verification > Layout structure > renders NavComponent on all views
   ✓ Navigation – Task 5.5 Verification > Layout structure > renders NavComponent on Kiosko view as well
   ✓ Navigation – Task 5.5 Verification > Layout structure > info popup toggles on click
   ✓ Navigation – Task 5.5 Verification > Active state styling > highlights the Home nav link when on /home
   ✓ Navigation – Task 5.5 Verification > Active state styling > highlights the Kiosko nav link when on /kiosko
   ✓ Navigation – Task 5.5 Verification > Active state styling > highlights the Maquina nav link when on /maquina
   ✓ Navigation – Task 5.5 Verification > Active state styling > highlights the Imprimir nav link when on /imprimir
   ✓ Navigation – Task 5.5 Verification > Active state styling > does not highlight inactive nav links

 Test Files  1 passed (1)
      Tests  18 passed (18)
```

Suite completa del renderer (incluyendo todos los tests anteriores):

```bash
$ npx vitest run src/renderer

 Test Files  6 passed (6)
      Tests  156 passed (156)
   Duration  2.01s
```

### Qué se verificó

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| 5 rutas renderizan correctamente | ✅ | Cada ruta muestra su vista placeholder |
| Navegación via links funciona | ✅ | Clicks en NavComponent cambian de vista |
| Layout compartido persiste | ✅ | NavComponent visible en todas las vistas |
| Estado activo visual | ✅ | Link de la vista actual tiene highlight dorado |
| Info popup funciona | ✅ | Toggle on/off con contenido de ayuda |
| Sin regresiones | ✅ | 156 tests del renderer pasan |

### Notas

- Los tests de la base de datos (`src/main/database/`) fallan por un problema de incompatibilidad de `better-sqlite3` con la versión de Node.js del entorno (`NODE_MODULE_VERSION 123 vs 115`). Esto es un issue de entorno que se resuelve con `npm run rebuild` y no está relacionado con la navegación.
- La ruta `/subir-imagen` no tiene link directo en el NavComponent (se accede desde la vista Imprimir en la app completa). Se verificó que la ruta renderiza correctamente cuando se navega directamente a ella.
- La Task 5 queda 100% completada con las 5 subtareas finalizadas.
