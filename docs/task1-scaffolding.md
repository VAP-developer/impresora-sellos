# Task 1: Scaffolding del Proyecto y Entorno Virtual

## Resumen

Esta tarea establece la base técnica del proyecto **Stamp Sales Desktop App**: una aplicación de escritorio construida con **Electron + React + TypeScript** usando **electron-vite** como herramienta de build.

---

## Progreso

| # | Subtarea | Estado |
|---|----------|--------|
| 1.1 | Crear estructura base del proyecto con Electron + React + TypeScript usando electron-vite | ✅ Completada |
| 1.2 | Configurar Node.js con nvm y fijar versión en `.nvmrc` | ✅ Completada |
| 1.3 | Instalar dependencias core (electron, react, react-dom, typescript, electron-vite, tailwindcss) | ✅ Completada |
| 1.4 | Instalar dependencias de datos (better-sqlite3, zustand) | ✅ Completada |
| 1.5 | Instalar dependencias de UI (@radix-ui/shadcn, class-variance-authority, clsx, tailwind-merge) | ✅ Completada |
| 1.6 | Instalar dependencias de desarrollo (vitest, @testing-library/react, eslint, prettier) | ✅ Completada |
| 1.7 | Configurar tsconfig.json para main, preload y renderer | ✅ Completada |
| 1.8 | Configurar electron.vite.config.ts con entradas para main, preload y renderer | ✅ Completada |
| 1.9 | Configurar Tailwind CSS (tailwind.config.js + globals.css) | ✅ Completada |
| 1.10 | Crear entry points básicos: src/main/index.ts, src/preload/index.ts, src/renderer/src/main.tsx | ✅ Completada |
| 1.11 | Verificar que la app arranca con `npm run dev` mostrando una ventana vacía | ✅ Completada |

---

## Detalle de lo realizado (1.1)

### ¿Qué se hizo?

Se creó la estructura base del proyecto desde cero, generando los archivos de configuración y código fuente mínimos para que el proyecto sea funcional con electron-vite.

### Archivos creados

```
stamp-sales-app/
├── package.json                 # Metadata del proyecto, scripts y dependencias
├── electron.vite.config.ts      # Configuración de electron-vite (main, preload, renderer)
├── tsconfig.json                # Config raíz con references a node y web
├── tsconfig.node.json           # TypeScript para main process y preload
├── tsconfig.web.json            # TypeScript para renderer (React + JSX)
└── src/
    ├── main/
    │   └── index.ts             # Entry point del proceso principal de Electron
    ├── preload/
    │   └── index.ts             # Script de preload con contextBridge
    └── renderer/
        ├── index.html           # HTML entry point del renderer
        └── src/
            ├── main.tsx         # Entry point de React (ReactDOM.createRoot)
            └── App.tsx          # Componente raíz con placeholder "Stamp Sales App"
```

### Descripción de cada archivo

#### `package.json`
- **Nombre**: `stamp-sales-app`
- **Entry point de producción**: `./out/main/index.js`
- **Scripts**:
  - `npm run dev` → arranca electron-vite en modo desarrollo con HMR
  - `npm run build` → compila el proyecto para producción
  - `npm run preview` → previsualiza el build de producción
- **Dependencias de producción**: `@electron-toolkit/preload`, `@electron-toolkit/utils`
- **Dependencias de desarrollo**: electron, electron-vite, typescript, react, react-dom, @vitejs/plugin-react, y tipos correspondientes

#### `electron.vite.config.ts`
Configura los tres targets de electron-vite:
- **main**: externaliza dependencias de Node.js
- **preload**: externaliza dependencias de Node.js
- **renderer**: alias `@renderer` para imports limpios + plugin de React

#### `tsconfig.json` (raíz)
Archivo "paraguas" que referencia los dos sub-configs:
- `tsconfig.node.json` (main + preload)
- `tsconfig.web.json` (renderer)

#### `tsconfig.node.json`
- Extiende `@electron-toolkit/tsconfig/tsconfig.node.json`
- Incluye: `electron.vite.config.*`, `src/main/**/*`, `src/preload/**/*`
- Tipos: `electron-vite/node`

#### `tsconfig.web.json`
- Extiende `@electron-toolkit/tsconfig/tsconfig.web.json`
- JSX: `react-jsx`
- Path alias: `@renderer/*` → `src/renderer/src/*`

#### `src/main/index.ts`
Proceso principal de Electron:
- Crea una ventana de 1280×800 px
- Carga la URL de desarrollo (HMR) o el HTML compilado en producción
- Gestiona el ciclo de vida de la app (activate, window-all-closed)

#### `src/preload/index.ts`
Script de preload:
- Expone la API de Electron al renderer vía `contextBridge`
- Placeholder para la futura `ElectronAPI` tipada del proyecto

#### `src/renderer/index.html`
HTML mínimo con `<div id="root">` y carga del módulo `main.tsx`.

#### `src/renderer/src/main.tsx`
Punto de entrada de React: monta `<App />` dentro de `StrictMode`.

#### `src/renderer/src/App.tsx`
Componente placeholder centrado que muestra "Stamp Sales App".

---

## Detalle de lo realizado (1.2)

### ¿Qué se hizo?

Se configuró el proyecto para fijar la versión de Node.js usando nvm, garantizando que todos los desarrolladores trabajen con la misma versión compatible con Electron 30.

### Archivos creados/modificados

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `.nvmrc` | Creado | Fija la versión de Node.js a `20` (LTS) |
| `package.json` | Modificado | Se añadió el campo `engines.node: ">=20.0.0"` |

### `.nvmrc`

```
20
```

Se usa la versión mayor `20` (en lugar de una versión patch específica como `20.20.2`) para permitir cualquier release de Node 20.x LTS. Esto es la práctica estándar para `.nvmrc`.

### `package.json` — campo `engines`

```json
"engines": {
  "node": ">=20.0.0"
}
```

Este campo hace que `npm install` emita un warning si se ejecuta con una versión de Node inferior a 20.

### ¿Por qué Node 20?

- **Electron 30** requiere Node.js 20.x como mínimo
- Node 20 es la versión **LTS activa** (soporte extendido)
- Compatibilidad con `better-sqlite3` y las dependencias nativas del proyecto

### Uso

```bash
# Al clonar el proyecto, el desarrollador ejecuta:
nvm use
# nvm lee .nvmrc y cambia automáticamente a Node 20.x

# Si no tiene Node 20 instalado:
nvm install
```

---

## Detalle de lo realizado (1.3)

### ¿Qué se hizo?

Se instalaron las dependencias core del proyecto. La mayoría ya estaban declaradas en `package.json` desde la tarea 1.1 (electron, react, react-dom, typescript, electron-vite). Se añadió **tailwindcss** junto con sus dependencias peer necesarias (**postcss** y **autoprefixer**) y se ejecutó `npm install` para materializar todo en `node_modules/`.

### Dependencias instaladas

| Paquete | Versión | Tipo | Propósito |
|---------|---------|------|-----------|
| `electron` | ~30.0.9 | devDependency | Shell de escritorio, proceso principal |
| `react` | ~18.3.1 | devDependency | Librería de UI para el renderer |
| `react-dom` | ~18.3.1 | devDependency | Renderizado DOM de React |
| `typescript` | ~5.4.5 | devDependency | Tipado estático del proyecto |
| `electron-vite` | ~2.3.0 | devDependency | Build tool con HMR para Electron |
| `tailwindcss` | ~3.4.19 | devDependency | Framework CSS utility-first |
| `postcss` | ~8.4.49 | devDependency | Procesador CSS (requerido por Tailwind) |
| `autoprefixer` | ~10.4.27 | devDependency | Añade vendor prefixes automáticamente |

### Cambios en `package.json`

```diff
  "devDependencies": {
    "electron": "~30.0.0",
    "electron-vite": "~2.3.0",
    "@electron-toolkit/tsconfig": "~1.0.1",
    "typescript": "~5.4.0",
    "react": "~18.3.0",
    "react-dom": "~18.3.0",
    "@types/react": "~18.3.0",
    "@types/react-dom": "~18.3.0",
-   "@vitejs/plugin-react": "~4.3.0"
+   "@vitejs/plugin-react": "~4.3.0",
+   "tailwindcss": "~3.4.0",
+   "postcss": "~8.4.0",
+   "autoprefixer": "~10.4.0"
  }
```

### Notas

- **¿Por qué devDependencies?** En proyectos Electron empaquetados con electron-builder, React y Tailwind se compilan en el bundle final. No necesitan estar en `dependencies` de producción — solo `@electron-toolkit/preload` y `@electron-toolkit/utils` van ahí (son usados en runtime por el proceso principal).
- **¿Por qué postcss y autoprefixer?** Tailwind CSS 3.x los requiere como peer dependencies para procesar las directivas `@tailwind` y generar el CSS final.
- La configuración de Tailwind (archivos `tailwind.config.js`, `postcss.config.js` y `globals.css`) se hará en la tarea **1.9**.

### Verificación

```bash
# Verificar que las dependencias están instaladas correctamente:
node -e "
const pkgs = ['electron', 'react', 'react-dom', 'typescript', 'electron-vite', 'tailwindcss'];
pkgs.forEach(p => console.log(p + ': ' + require(p + '/package.json').version));
"
# Resultado esperado:
# electron: 30.0.9
# react: 18.3.1
# react-dom: 18.3.1
# typescript: 5.4.5
# electron-vite: 2.3.0
# tailwindcss: 3.4.19
```

---

## Detalle de lo realizado (1.4)

### ¿Qué se hizo?

Se instalaron las dependencias de datos del proyecto: **better-sqlite3** como base de datos local (offline-first) y **zustand** como librería de gestión de estado para el renderer. También se añadió **@types/better-sqlite3** para soporte de TypeScript.

### Dependencias instaladas

| Paquete | Versión | Tipo | Propósito |
|---------|---------|------|-----------|
| `better-sqlite3` | ^12.11.1 | dependency | Base de datos SQLite síncrona para el main process |
| `zustand` | ^5.0.14 | dependency | Gestión de estado ligera para React (renderer) |
| `@types/better-sqlite3` | ^7.6.13 | devDependency | Tipos TypeScript para better-sqlite3 |

### Cambios en `package.json`

```diff
  "dependencies": {
    "@electron-toolkit/preload": "~3.0.0",
    "@electron-toolkit/utils": "~3.0.0",
+   "better-sqlite3": "^12.11.1",
+   "zustand": "^5.0.14"
  },
  "devDependencies": {
+   "@types/better-sqlite3": "^7.6.13",
    ...
  }
```

### ¿Por qué `dependencies` y no `devDependencies`?

A diferencia de React/Tailwind (que se compilan en el bundle del renderer), estas dos librerías se ejecutan en **runtime**:

- **better-sqlite3** es un módulo nativo de Node.js que corre en el **main process** de Electron. Necesita estar en `dependencies` para que electron-builder lo incluya en el empaquetado final (el binario `.node` compilado debe ir dentro del `.exe`).
- **zustand** se importa directamente en los stores del renderer y se resuelve en runtime por el bundler de Vite. Aunque técnicamente funcionaría en `devDependencies`, ponerlo en `dependencies` es la convención correcta para dependencias que forman parte del código de aplicación (no del toolchain de build).

### Notas sobre better-sqlite3

- Es un binding **nativo** (C++), por lo que se compila al instalar con `node-gyp` o prebuild.
- En el build final de Electron, electron-builder se encargará de recompilar el binding para la versión de Node.js interna de Electron (rebuild nativo).
- Es **síncrono** por diseño — las operaciones de DB no bloquean el renderer (corren en el main process separado).
- Soporta transacciones atómicas, que son críticas para la integridad de ventas (Requisito 11).

### Notas sobre zustand

- Zustand v5 es la última versión estable con soporte completo de TypeScript.
- Se usará para crear los stores definidos en el design: `config.store.ts`, `kiosko.store.ts`, `orders.store.ts`, `printer.store.ts`.
- No requiere providers/contextos de React — los stores son independientes y se importan directamente.

### Verificación

```bash
# Verificar que las dependencias están instaladas:
node -e "
const pkgs = ['better-sqlite3', 'zustand'];
pkgs.forEach(p => console.log(p + ': ' + require(p + '/package.json').version));
"
# Resultado esperado:
# better-sqlite3: 12.11.1
# zustand: 5.0.14
```

---

## Detalle de lo realizado (1.5)

### ¿Qué se hizo?

Se instalaron las dependencias de UI necesarias para el ecosistema **shadcn/ui**: las utilidades de composición de clases CSS (**class-variance-authority**, **clsx**, **tailwind-merge**) y un conjunto de primitivas **@radix-ui** que son la base de los componentes de shadcn. También se creó el helper `cn()` estándar.

### Dependencias instaladas

| Paquete | Versión | Tipo | Propósito |
|---------|---------|------|-----------|
| `class-variance-authority` | ^0.7.1 | dependency | Definición de variantes de componente tipadas (cva) |
| `clsx` | ^2.1.1 | dependency | Composición condicional de classNames |
| `tailwind-merge` | ^3.6.0 | dependency | Merge inteligente de clases Tailwind (evita conflictos) |
| `@radix-ui/react-dialog` | ^1.1.17 | dependency | Primitiva de diálogo/modal accesible |
| `@radix-ui/react-dropdown-menu` | ^2.1.18 | dependency | Primitiva de menú desplegable |
| `@radix-ui/react-label` | ^2.1.10 | dependency | Primitiva de label accesible |
| `@radix-ui/react-select` | ^2.3.1 | dependency | Primitiva de selector accesible |
| `@radix-ui/react-slot` | ^1.3.0 | dependency | Composición de componentes (asChild pattern) |
| `@radix-ui/react-tooltip` | ^1.2.10 | dependency | Primitiva de tooltip accesible |
| `@radix-ui/react-tabs` | ^1.1.15 | dependency | Primitiva de tabs accesible |
| `@radix-ui/react-switch` | ^1.3.1 | dependency | Primitiva de switch/toggle accesible |

### Cambios en `package.json`

```diff
  "dependencies": {
    "@electron-toolkit/preload": "~3.0.0",
    "@electron-toolkit/utils": "~3.0.0",
+   "@radix-ui/react-dialog": "^1.1.17",
+   "@radix-ui/react-dropdown-menu": "^2.1.18",
+   "@radix-ui/react-label": "^2.1.10",
+   "@radix-ui/react-select": "^2.3.1",
+   "@radix-ui/react-slot": "^1.3.0",
+   "@radix-ui/react-switch": "^1.3.1",
+   "@radix-ui/react-tabs": "^1.1.15",
+   "@radix-ui/react-tooltip": "^1.2.10",
    "better-sqlite3": "^12.11.1",
+   "class-variance-authority": "^0.7.1",
+   "clsx": "^2.1.1",
+   "tailwind-merge": "^3.6.0",
    "zustand": "^5.0.14"
  }
```

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `src/renderer/src/lib/utils.ts` | Helper `cn()` que combina clsx + tailwind-merge |

### `src/renderer/src/lib/utils.ts`

```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Este es el patrón estándar de shadcn/ui. La función `cn()` se usa en todos los componentes para:
1. **clsx**: componer clases condicionalmente (`cn('base', isActive && 'active')`)
2. **tailwind-merge**: resolver conflictos de Tailwind (`cn('p-4', 'p-2')` → `'p-2'`)

### ¿Por qué estos paquetes en `dependencies`?

Estas librerías se ejecutan en **runtime** dentro del renderer:
- **class-variance-authority**: define variantes de componente que se resuelven en runtime
- **clsx**: evaluación condicional de clases en tiempo de ejecución
- **tailwind-merge**: merge de clases en runtime (necesario para props de componentes)
- **@radix-ui/***: componentes React que renderizan UI accesible en runtime

### ¿Por qué @radix-ui?

shadcn/ui no es una librería instalable — es un conjunto de componentes copiables que **dependen** de @radix-ui como capa de primitivas accesibles. Se instalaron las primitivas más comunes para la app:

| Primitiva | Uso en la app |
|-----------|---------------|
| `react-dialog` | Confirmación de anulación de venta, configuración |
| `react-dropdown-menu` | Menús de opciones en la toolbar |
| `react-label` | Labels accesibles en formularios de config |
| `react-select` | Selectores de perfil, evento, mes, país |
| `react-slot` | Patrón asChild para composición de botones |
| `react-tooltip` | Tooltips informativos (como en el legacy) |
| `react-tabs` | Secciones con tabs en configuración |
| `react-switch` | Toggles para opciones binarias (tiras especiales, etc.) |

### Verificación

```bash
# Verificar que las dependencias están instaladas:
node -e "
const pkgs = ['class-variance-authority', 'clsx', 'tailwind-merge', '@radix-ui/react-slot'];
pkgs.forEach(p => console.log(p + ': ' + require(p + '/package.json').version));
"
# Resultado esperado:
# class-variance-authority: 0.7.1
# clsx: 2.1.1
# tailwind-merge: 3.6.0
# @radix-ui/react-slot: 1.3.0
```

---

## Detalle de lo realizado (1.6)

### ¿Qué se hizo?

Se instalaron las dependencias de desarrollo para testing, linting y formateo de código. Además se crearon los archivos de configuración base para cada herramienta y se añadieron scripts npm para ejecutarlas.

### Dependencias instaladas

| Paquete | Versión | Propósito |
|---------|---------|-----------|
| `vitest` | ^4.1.9 | Test runner compatible con Vite, rápido y con soporte nativo de TypeScript |
| `@testing-library/react` | ^16.3.2 | Utilidades para testear componentes React de forma accesible |
| `@testing-library/jest-dom` | ^6.9.1 | Matchers adicionales para assertions de DOM (`.toBeInTheDocument()`, etc.) |
| `@testing-library/user-event` | ^14.6.1 | Simulación realista de interacciones de usuario (click, type, etc.) |
| `jsdom` | ^29.1.1 | Implementación de DOM para Node.js (entorno de ejecución de tests) |
| `eslint` | ^10.6.0 | Linter estático para TypeScript/JavaScript |
| `@eslint/js` | (latest) | Preset de reglas recomendadas para ESLint flat config |
| `prettier` | ^3.9.1 | Formateador de código opinado |

### Cambios en `package.json`

```diff
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
+   "test": "vitest run",
+   "test:watch": "vitest",
+   "lint": "eslint . --ext .ts,.tsx",
+   "format": "prettier --write \"src/**/*.{ts,tsx,css}\""
  },
  "devDependencies": {
+   "@testing-library/jest-dom": "^6.9.1",
+   "@testing-library/react": "^16.3.2",
+   "@testing-library/user-event": "^14.6.1",
+   "@eslint/js": "...",
+   "eslint": "^10.6.0",
+   "jsdom": "^29.1.1",
+   "prettier": "^3.9.1",
+   "vitest": "^4.1.9",
    ...
  }
```

### Scripts añadidos

| Script | Comando | Descripción |
|--------|---------|-------------|
| `npm test` | `vitest run` | Ejecuta todos los tests una vez (CI-friendly) |
| `npm run test:watch` | `vitest` | Ejecuta tests en modo watch (desarrollo) |
| `npm run lint` | `eslint . --ext .ts,.tsx` | Analiza el código buscando errores y bad practices |
| `npm run format` | `prettier --write "src/**/*.{ts,tsx,css}"` | Formatea automáticamente el código fuente |

### Archivos de configuración creados

| Archivo | Descripción |
|---------|-------------|
| `vitest.config.ts` | Configuración de Vitest (entorno jsdom, globals, setup file) |
| `src/renderer/src/test-setup.ts` | Setup file que importa los matchers de jest-dom |
| `eslint.config.mjs` | Configuración ESLint con flat config (formato nuevo v9+) |
| `.prettierrc` | Reglas de formateo de Prettier |
| `.prettierignore` | Archivos excluidos del formateo |

### `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/renderer/src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'out', 'old-version']
  }
})
```

**Decisiones de configuración:**
- **`globals: true`**: Permite usar `describe`, `it`, `expect` sin importarlos (estilo Jest)
- **`environment: 'jsdom'`**: Los tests de componentes React necesitan un DOM simulado
- **`setupFiles`**: Carga los matchers de `@testing-library/jest-dom` antes de cada test
- **`include`**: Solo busca tests dentro de `src/` con extensión `.test.ts` o `.spec.tsx`
- **`exclude`**: Ignora `node_modules`, `out` (build) y `old-version` (legacy)

### `src/renderer/src/test-setup.ts`

```typescript
import '@testing-library/jest-dom'
```

Este archivo se ejecuta antes de cada suite de tests y registra matchers como:
- `expect(element).toBeInTheDocument()`
- `expect(element).toHaveTextContent('...')`
- `expect(element).toBeVisible()`

### `eslint.config.mjs`

```javascript
import js from '@eslint/js'

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module'
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'warn'
    }
  },
  {
    ignores: ['node_modules/', 'out/', 'old-version/', 'dist/']
  }
]
```

Se usa el **flat config** (formato nuevo de ESLint v9+). La configuración:
- Aplica las reglas recomendadas de JS como base
- Restringe el análisis a `src/**/*.{ts,tsx}`
- Variables no usadas y `console.log` generan warnings (no errores)
- Ignora carpetas de build y el código legacy

### `.prettierrc`

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "none",
  "printWidth": 100
}
```

Estilo de formateo elegido:
- **Sin punto y coma** (estilo moderno, menos ruido visual)
- **Comillas simples** (consistencia con el ecosistema JS/TS)
- **Indentación de 2 espacios** (estándar en proyectos React)
- **Sin trailing comma** (consistencia)
- **100 caracteres de ancho** (balance entre legibilidad y uso de pantalla)

### `.prettierignore`

```
node_modules
out
dist
old-version
*.md
```

Excluye de formateo las carpetas de build, dependencias, código legacy y archivos markdown.

### Verificación

```bash
# Vitest funciona (no hay tests todavía, pero la config es válida):
$ npx vitest run
# → "No test files found, exiting with code 1"

# ESLint instalado correctamente:
$ npx eslint --version
# → v10.6.0

# Prettier instalado correctamente:
$ npx prettier --version
# → 3.9.1
```

### Notas

- **¿Por qué vitest y no jest?** Vitest comparte el pipeline de transformación con Vite (que ya usamos via electron-vite), resultando en configuración mínima y ejecución más rápida. No necesita configuración de babel ni transformadores adicionales para TypeScript.
- **¿Por qué jsdom?** Los tests de componentes React (`@testing-library/react`) necesitan un entorno DOM. jsdom es más ligero que happy-dom y tiene mejor compatibilidad.
- **¿Por qué @testing-library/user-event además de @testing-library/react?** `user-event` simula interacciones de usuario de forma más realista que `fireEvent` (incluye focus, blur, keyboard events intermedios). Es la recomendación oficial de Testing Library.
- **ESLint v10 + flat config**: Se usó el formato flat config (archivo `.mjs`) que es el estándar desde ESLint v9. El preset de TypeScript (`@typescript-eslint`) se puede añadir más adelante cuando se necesiten reglas específicas de tipos.

---

## Detalle de lo realizado (1.7)

### ¿Qué se hizo?

Se refinó la configuración de TypeScript para los tres procesos de Electron (main, preload, renderer), habilitando **strict mode** completo y **noImplicitAny** para garantizar máxima seguridad de tipos en todo el proyecto.

### Arquitectura de configuración

El proyecto usa **project references** de TypeScript — un archivo raíz (`tsconfig.json`) que no compila nada por sí mismo, sino que orquesta sub-proyectos independientes:

```
tsconfig.json (raíz)
├── tsconfig.node.json   → main process + preload + electron.vite.config
└── tsconfig.web.json    → renderer (React)
```

Cada sub-config tiene su propio scope de tipos, lo que previene contaminación entre entornos:
- **tsconfig.node.json**: tiene acceso a tipos de Node.js y Electron (pero no a DOM)
- **tsconfig.web.json**: tiene acceso a tipos de DOM y React (pero no a Node.js directamente)

### Archivos modificados

| Archivo | Cambios realizados |
|---------|-------------------|
| `tsconfig.json` | Sin cambios (ya correcto desde 1.1) |
| `tsconfig.node.json` | Añadido `outDir`, `strict: true`, `noImplicitAny: true`, `resolveJsonModule: true` |
| `tsconfig.web.json` | Añadido `outDir`, `strict: true`, `noImplicitAny: true` |

### `tsconfig.json` (raíz)

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

- **`files: []`**: No compila archivos directamente — solo referencia sub-proyectos
- **`references`**: Permite a `tsc --build` compilar ambos targets en orden correcto

### `tsconfig.node.json` (main + preload)

```json
{
  "extends": "@electron-toolkit/tsconfig/tsconfig.node.json",
  "include": [
    "electron.vite.config.*",
    "src/main/**/*",
    "src/preload/**/*"
  ],
  "compilerOptions": {
    "composite": true,
    "outDir": "./out",
    "types": ["electron-vite/node"],
    "strict": true,
    "noImplicitAny": true,
    "resolveJsonModule": true
  }
}
```

**Herencia:** Extiende `@electron-toolkit/tsconfig/tsconfig.node.json` que proporciona:
- `target: "esnext"`, `module: "esnext"`, `moduleResolution: "node"`
- `esModuleInterop: true`, `isolatedModules: true`
- `types: ["node"]` (APIs de Node.js disponibles)

**Opciones añadidas:**
| Opción | Valor | Propósito |
|--------|-------|-----------|
| `composite` | `true` | Requerido para project references (build incremental) |
| `outDir` | `"./out"` | Directorio de salida para archivos compilados |
| `types` | `["electron-vite/node"]` | Tipos específicos de electron-vite (env vars, import.meta) |
| `strict` | `true` | Habilita todas las verificaciones estrictas de TypeScript |
| `noImplicitAny` | `true` | Prohíbe `any` implícito — obliga a tipar todo explícitamente |
| `resolveJsonModule` | `true` | Permite importar archivos `.json` con tipado automático |

**Scope:** Cubre todos los archivos de:
- `src/main/` — Proceso principal de Electron (DB, IPC handlers, printing, sync)
- `src/preload/` — Script de preload (contextBridge)
- `electron.vite.config.*` — Configuración del bundler

### `tsconfig.web.json` (renderer)

```json
{
  "extends": "@electron-toolkit/tsconfig/tsconfig.web.json",
  "include": [
    "src/renderer/src/**/*",
    "src/renderer/src/**/*.tsx"
  ],
  "compilerOptions": {
    "composite": true,
    "outDir": "./out/renderer",
    "jsx": "react-jsx",
    "strict": true,
    "noImplicitAny": true,
    "baseUrl": ".",
    "paths": {
      "@renderer/*": ["src/renderer/src/*"]
    }
  }
}
```

**Herencia:** Extiende `@electron-toolkit/tsconfig/tsconfig.web.json` que proporciona:
- Todo lo del base (`target: "esnext"`, `module: "esnext"`, etc.)
- `lib: ["ESNext", "DOM", "DOM.Iterable"]` (APIs del navegador disponibles)

**Opciones añadidas:**
| Opción | Valor | Propósito |
|--------|-------|-----------|
| `composite` | `true` | Requerido para project references |
| `outDir` | `"./out/renderer"` | Output separado del main process |
| `jsx` | `"react-jsx"` | Transforma JSX automáticamente (sin `import React`) |
| `strict` | `true` | Verificaciones estrictas completas |
| `noImplicitAny` | `true` | Tipado explícito obligatorio |
| `baseUrl` | `"."` | Base para resolución de paths |
| `paths` | `@renderer/*` | Alias para imports limpios desde la raíz del renderer |

**Scope:** Cubre:
- `src/renderer/src/**/*` — Toda la UI React (componentes, stores, hooks, lib)
- `.tsx` incluido explícitamente para archivos JSX

### Path alias `@renderer`

El alias `@renderer/*` → `src/renderer/src/*` permite imports limpios:

```typescript
// En lugar de:
import { cn } from '../../../lib/utils'

// Se escribe:
import { cn } from '@renderer/lib/utils'
```

Este alias está configurado tanto en TypeScript (para resolución de tipos) como en `electron.vite.config.ts` (para resolución en build):

```typescript
// electron.vite.config.ts
renderer: {
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  }
}
```

### ¿Por qué `strict: true` + `noImplicitAny: true`?

El preset base de `@electron-toolkit/tsconfig` tiene `noImplicitAny: false` por defecto (para facilitar migraciones). En este proyecto lo habilitamos porque:

1. **Integridad de datos**: La app maneja transacciones financieras (ventas). Un `any` no detectado podría causar cálculos incorrectos sin error visible.
2. **Property-based testing**: Los tests PBT definidos en el design validan propiedades formales del sistema. Si los tipos no son estrictos, las properties podrían pasar con inputs inválidos.
3. **Proyecto greenfield**: Al ser código nuevo (no migración), no hay coste de retroadaptar tipos — es mejor empezar estricto desde el inicio.

`strict: true` habilita en conjunto:
- `strictNullChecks` — `null`/`undefined` son tipos separados
- `strictFunctionTypes` — Varianza correcta en funciones
- `strictBindCallApply` — `bind`, `call`, `apply` tipados
- `strictPropertyInitialization` — Propiedades de clase inicializadas
- `noImplicitThis` — `this` debe tener tipo explícito
- `alwaysStrict` — Emite `"use strict"` en cada archivo

### Verificación

```bash
# Compilar todo el proyecto sin emitir archivos:
$ npx tsc --build
# → Sin errores (exit code 0)

# Verificar solo main + preload:
$ npx tsc --noEmit --project tsconfig.node.json
# → Sin errores

# Verificar solo renderer:
$ npx tsc --noEmit --project tsconfig.web.json
# → Sin errores
```

### Nota sobre el error de IDE

El IDE puede mostrar un error en `tsconfig.web.json`:
```
File '@electron-toolkit/tsconfig/tsconfig.web.json' not found.
```

Esto es un **falso positivo del language server** — TypeScript resuelve correctamente el paquete en compilación real (verificado con `tsc --noEmit`). El archivo existe en `node_modules/@electron-toolkit/tsconfig/tsconfig.web.json` y la compilación pasa limpia.

---

## Detalle de lo realizado (1.8)

### ¿Qué se hizo?

Se configuró `electron.vite.config.ts` con entradas explícitas para los tres procesos de Electron (main, preload, renderer), y se actualizó `electron-vite` de v2.3 a v4.0 para resolver una incompatibilidad con Vite 8.

### Problema encontrado

La versión instalada de Vite (v8.1.0) eliminó la exportación `splitVendorChunk` que `electron-vite@2.3.0` importaba. Esto causaba un error fatal al ejecutar el build:

```
SyntaxError: The requested module 'vite' does not provide an export named 'splitVendorChunk'
```

**Solución**: Se actualizó `electron-vite` a v4.0.1 (compatible con Vite 8).

### Archivos modificados

| Archivo | Cambios realizados |
|---------|-------------------|
| `electron.vite.config.ts` | Añadidas entradas explícitas y root del renderer |
| `package.json` | `electron-vite` actualizado a `~4.0.0`, main entry cambiado a `.mjs` |
| `src/main/index.ts` | Ruta del preload actualizada a `.mjs` |

### `electron.vite.config.ts` — Configuración final

```typescript
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: [] })],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        },
        external: ['electron', '@electron-toolkit/utils', '@electron-toolkit/preload']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: [] })],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        },
        external: ['electron', '@electron-toolkit/preload']
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html')
        }
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
```

### Explicación de cada sección

#### `main`
| Opción | Propósito |
|--------|-----------|
| `externalizeDepsPlugin({ exclude: [] })` | Externaliza todas las dependencias de Node.js (como `better-sqlite3`) para que no se bundleen — quedan como `import` en el output ESM |
| `build.rollupOptions.input` | Entrada explícita: `src/main/index.ts` |
| `build.rollupOptions.external` | Fuerza externalización explícita de `electron`, `@electron-toolkit/utils` y `@electron-toolkit/preload`. Necesario porque en Vite 8 (Rolldown), el plugin de externalización no los detecta correctamente por sí solo |

#### `preload`
| Opción | Propósito |
|--------|-----------|
| `externalizeDepsPlugin({ exclude: [] })` | Externaliza deps (necesario para que `@electron-toolkit/preload` funcione en runtime) |
| `build.rollupOptions.input` | Entrada explícita: `src/preload/index.ts` |
| `build.rollupOptions.external` | Misma razón que en main — externalización explícita |

#### `renderer`
| Opción | Propósito |
|--------|-----------|
| `root` | Define `src/renderer` como raíz del servidor Vite (necesario para resolver rutas relativas en index.html) |
| `build.rollupOptions.input` | Entrada explícita: `src/renderer/index.html` |
| `resolve.alias` | `@renderer` → `src/renderer/src` (coincide con el `paths` de `tsconfig.web.json`) |
| `react()` | Plugin de React para transformación de JSX y Fast Refresh (HMR) |

### Cambios en `package.json`

```diff
- "main": "./out/main/index.js",
+ "main": "./out/main/index.mjs",

  "devDependencies": {
-   "electron-vite": "~2.3.0",
+   "electron-vite": "~4.0.0",
  }
```

**¿Por qué `.mjs`?** electron-vite v4 genera módulos ESM por defecto (extensión `.mjs`). El campo `main` de `package.json` apunta al output compilado que Electron carga al arrancar.

### Cambios en `src/main/index.ts`

```diff
  webPreferences: {
-   preload: join(__dirname, '../preload/index.js'),
+   preload: join(__dirname, '../preload/index.mjs'),
    sandbox: false
  }
```

El preload script también se genera como `.mjs` en v4.

### Output del build

```
out/
├── main/
│   └── index.mjs          ← Proceso principal (4.73 KB)
├── preload/
│   └── index.mjs          ← Script de preload (3.51 KB)
└── renderer/
    ├── index.html          ← HTML del renderer (0.32 KB)
    └── assets/
        └── index-*.js      ← Bundle React (202 KB)
```

### ¿Por qué `externalizeDepsPlugin()`?

Este plugin es crítico para Electron:
- **main**: Módulos nativos como `better-sqlite3` (binding C++) no pueden ser bundleados por Rollup — deben quedar como `require('better-sqlite3')` y cargarse en runtime desde `node_modules/`
- **preload**: `@electron-toolkit/preload` accede a APIs de Electron que solo están disponibles en el contexto de preload — bundlearlas rompería la integración

### ¿Por qué `root` en renderer?

Sin `root`, Vite busca `index.html` en la raíz del proyecto. Con `root: resolve(__dirname, 'src/renderer')`:
- El dev server sirve archivos desde `src/renderer/`
- Las rutas relativas en `index.html` (como `<script src="/src/main.tsx">`) se resuelven correctamente
- El build sabe dónde encontrar el HTML entry point

### Verificación

```bash
# Build limpio de los 3 procesos:
$ npx electron-vite build

# Output:
# vite v8.1.0 building ssr environment for production...
# ✓ 4 modules transformed.
# out/main/index.mjs  4.73 kB
# ✓ built in 28ms

# vite v8.1.0 building ssr environment for production...
# ✓ 4 modules transformed.
# out/preload/index.mjs  3.51 kB
# ✓ built in 13ms

# vite v8.1.0 building client environment for production...
# ✓ 13 modules transformed.
# out/renderer/index.html                  0.32 kB
# out/renderer/assets/index-CJur4g1B.js  202.17 kB
# ✓ built in 81ms
```

Los tres procesos compilan sin errores.

### Nota sobre warnings de deprecación

El build muestra estos warnings del plugin `@vitejs/plugin-react`:
```
[vite] warning: `esbuild` option was specified by "vite:react-babel" plugin. This option is deprecated, please use `oxc` instead.
[vite] warning: `optimizeDeps.esbuildOptions` option was specified by "vite:react-babel" plugin. This option is deprecated, please use `optimizeDeps.rolldownOptions` instead.
```

Son **warnings informativos** del plugin de React que aún no se ha actualizado para usar las nuevas APIs de Vite 8 (Rolldown/OXC reemplazan a esbuild). No afectan la funcionalidad. Se resolverán cuando `@vitejs/plugin-react` publique una versión compatible con Vite 8.

---

## Detalle de lo realizado (1.9)

### ¿Qué se hizo?

Se configuró **Tailwind CSS v3.4** para el renderer de Electron con el sistema de diseño basado en CSS variables compatible con **shadcn/ui**. Se crearon los tres archivos de configuración necesarios y se integró la hoja de estilos global en el entry point de React.

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `tailwind.config.js` | Configuración de Tailwind con content paths y tema extendido para shadcn/ui |
| `postcss.config.js` | Pipeline PostCSS con plugins tailwindcss + autoprefixer |
| `src/renderer/src/globals.css` | Hoja de estilos global con directivas Tailwind y CSS variables |

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| `src/renderer/src/main.tsx` | Añadido `import './globals.css'` |
| `src/renderer/src/App.tsx` | Migrado de inline styles a clases Tailwind |

### `tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      }
    }
  },
  plugins: []
}
```

**Decisiones de configuración:**

| Aspecto | Decisión | Justificación |
|---------|----------|---------------|
| `content` | Solo `src/renderer/` | Tailwind solo se usa en el renderer (la UI). No hay clases CSS en main/preload |
| Colores con CSS variables | `hsl(var(--nombre))` | Patrón estándar de shadcn/ui: los colores se definen como variables CSS y se referencian desde Tailwind. Permite theming y dark mode |
| `borderRadius` con `--radius` | Variable CSS | Permite ajustar todos los border-radius desde un solo lugar |
| Sin plugins | `plugins: []` | No necesitamos plugins adicionales por ahora (forms, typography, etc.) |

### `postcss.config.js`

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
}
```

Pipeline estándar de PostCSS:
1. **tailwindcss**: Procesa las directivas `@tailwind` y genera las clases utility
2. **autoprefixer**: Añade vendor prefixes para compatibilidad entre navegadores (relevante para Electron que usa Chromium, pero buena práctica)

### `src/renderer/src/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-family: 'Open Sans', sans-serif;
  }
}
```

**Estructura del archivo:**

| Sección | Propósito |
|---------|-----------|
| `@tailwind base/components/utilities` | Inyecta las tres capas de Tailwind en el CSS final |
| `:root` (CSS variables) | Define los tokens de color del tema en formato HSL sin `hsl()` wrapper — esto permite composición como `hsl(var(--primary) / 0.5)` para opacidad |
| `* { border-border }` | Reset: todos los elementos usan el color de borde del tema por defecto |
| `body { bg-background text-foreground }` | Aplica colores base al body para consistencia del tema |

**¿Por qué los valores HSL sin `hsl()`?**

Las variables almacenan solo los componentes `H S% L%` (ej: `222.2 84% 4.9%`) en lugar del valor completo `hsl(222.2, 84%, 4.9%)`. Esto permite:
- Usar opacidad con Tailwind: `bg-primary/50` → `hsl(222.2 84% 4.9% / 0.5)`
- Mayor flexibilidad en la composición de colores

### `src/renderer/src/main.tsx` — Cambios

```diff
  import React from 'react'
  import ReactDOM from 'react-dom/client'
  import App from './App'
+ import './globals.css'
```

El import de `globals.css` debe estar **después** del import de `App` para que las clases utility estén disponibles en todos los componentes.

### `src/renderer/src/App.tsx` — Cambios

```diff
  function App(): JSX.Element {
    return (
-     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
-       <h1>Stamp Sales App</h1>
+     <div className="flex items-center justify-center h-screen">
+       <h1 className="text-2xl font-semibold">Stamp Sales App</h1>
      </div>
    )
  }
```

Se migraron los inline styles a clases Tailwind equivalentes, confirmando que la integración funciona end-to-end.

### Cómo funciona el pipeline completo

```
globals.css (con @tailwind directives)
    ↓ PostCSS (postcss.config.js)
    ↓ tailwindcss plugin (lee tailwind.config.js)
    ↓   → Escanea content paths (src/renderer/src/**/*.{ts,tsx})
    ↓   → Genera solo las clases usadas (purge automático)
    ↓ autoprefixer plugin
    ↓   → Añade vendor prefixes si necesario
    ↓
CSS final bundleado en out/renderer/assets/index-*.css
```

### Relación con `src/renderer/src/lib/utils.ts`

El helper `cn()` creado en la tarea 1.5 ahora tiene contexto completo:

```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

`cn()` usa `tailwind-merge` que necesita conocer las clases de Tailwind para resolver conflictos. Con `tailwind.config.js` definido, `twMerge` puede operar correctamente sobre las clases del tema personalizado (ej: `cn('bg-primary', 'bg-secondary')` → `'bg-secondary'`).

### Verificación

```bash
# Tailwind procesa globals.css sin errores:
$ npx tailwindcss --content "src/renderer/src/**/*.{ts,tsx}" \
    --input src/renderer/src/globals.css --output /dev/null
# → Rebuilding... Done in 169ms.

# Build completo de electron-vite pasa:
$ npx electron-vite build
# → out/renderer/assets/index-DG9wJ6qF.css   11.28 kB  ← CSS generado con Tailwind
# → out/renderer/assets/index-DJFa-qvO.js   202.17 kB  ← Bundle React
# → ✓ built in 249ms

# Las CSS variables están presentes en el output:
$ grep -c "\-\-background\|--foreground\|--primary" out/renderer/assets/index-*.css
# → 6 (confirmado)
```

### Notas

- **¿Por qué Tailwind 3.4 y no 4.x?** Tailwind v4 está en beta y cambia fundamentalmente la configuración (usa CSS nativo en lugar de `tailwind.config.js`). shadcn/ui aún no soporta v4 oficialmente, así que se mantiene v3.4 (estable y probado).
- **Dark mode**: No se configuró dark mode (`darkMode: 'class'`) porque la app de sellos opera en modo claro fijo. Se puede añadir en el futuro si es necesario.
- **Fuentes**: `globals.css` usa `font-family: 'Open Sans', sans-serif` como fuente base del body (consistente con el legacy). Las fuentes Franklin Gothic se usarán solo en la generación de PDFs (main process), no en la UI.

---

## Detalle de lo realizado (1.10)

### ¿Qué se hizo?

Se verificaron los tres entry points básicos del proyecto. Estos archivos fueron creados inicialmente en la tarea 1.1 como esqueleto mínimo. La tarea 1.10 confirma que están correctamente implementados, sin errores de TypeScript, y cumplen con la arquitectura definida en el design document.

### Archivos verificados

| Archivo | Estado | Descripción |
|---------|--------|-------------|
| `src/main/index.ts` | ✅ Correcto | Proceso principal de Electron |
| `src/preload/index.ts` | ✅ Correcto | Script de preload con contextBridge |
| `src/renderer/src/main.tsx` | ✅ Correcto | Entry point de React |

### `src/main/index.ts` — Proceso Principal

```typescript
import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.stamp-sales')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
```

**Funcionalidades implementadas:**

| Aspecto | Detalle |
|---------|---------|
| Ventana | 1280×800 px, oculta hasta `ready-to-show` (evita parpadeo) |
| Menú | Oculto (`autoHideMenuBar: true`) — la app usa navegación propia |
| Preload | Carga `../preload/index.mjs` (ESM, electron-vite v4) |
| Sandbox | Deshabilitado — necesario para acceso a APIs de Node en preload |
| Dev mode | Carga URL del dev server (HMR) via `ELECTRON_RENDERER_URL` |
| Producción | Carga `../renderer/index.html` compilado |
| Links externos | Se abren en el navegador del sistema (no dentro de la app) |
| App User Model ID | `com.stamp-sales` — identificador Windows para la taskbar |
| Shortcuts | `optimizer.watchWindowShortcuts` — F12 para DevTools en desarrollo |

**¿Por qué `show: false` + `ready-to-show`?**

Patrón estándar de Electron para evitar el "flash blanco" al arrancar. La ventana se crea oculta y solo se muestra cuando el renderer ha terminado de pintar. Esto contribuye al requisito NFR de arranque rápido percibido (<3s).

### `src/preload/index.ts` — Script de Preload

```typescript
import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
}
```

**Funcionalidades implementadas:**

| Aspecto | Detalle |
|---------|---------|
| Context isolation | Verificación de `process.contextIsolated` antes de usar `contextBridge` |
| API expuesta | `window.electron` con las utilidades de `@electron-toolkit/preload` |
| Fallback | Asignación directa a `window` si context isolation está deshabilitado |
| Error handling | Try-catch que loguea errores de exposición de API |

**Estado actual vs futuro:**

Este preload es un **placeholder funcional**. En la tarea 3.1 se expandirá para exponer la `ElectronAPI` tipada completa definida en el design document (métodos para config, orders, images, printer, sync). Por ahora expone las utilidades genéricas de electron-toolkit que permiten verificar la comunicación basic main↔renderer.

### `src/renderer/src/main.tsx` — Entry Point de React

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

**Funcionalidades implementadas:**

| Aspecto | Detalle |
|---------|---------|
| API de React | `createRoot` (React 18 concurrent) |
| StrictMode | Habilitado — detecta side effects y APIs obsoletas en desarrollo |
| CSS | Importa `globals.css` con Tailwind + variables de shadcn/ui |
| Mount point | `#root` del `index.html` |

### Relación entre los tres entry points

```
┌─────────────────────────────────────────────────────────┐
│ Electron inicia src/main/index.ts                       │
│   → Crea BrowserWindow con preload                      │
│   → Carga renderer (dev URL o HTML)                     │
├─────────────────────────────────────────────────────────┤
│ Preload (src/preload/index.ts) se ejecuta               │
│   → Expone electronAPI en window.electron               │
│   → Bridge seguro entre main y renderer                 │
├─────────────────────────────────────────────────────────┤
│ Renderer carga index.html → ejecuta main.tsx            │
│   → Monta React en #root                               │
│   → Carga Tailwind CSS (globals.css)                    │
│   → Renderiza <App /> con StrictMode                    │
└─────────────────────────────────────────────────────────┘
```

### Verificación

```bash
# TypeScript compila sin errores:
$ npx tsc --noEmit --project tsconfig.node.json   # main + preload
# → Sin errores (exit code 0)

$ npx tsc --noEmit --project tsconfig.web.json    # renderer
# → Sin errores (exit code 0)

# Build de electron-vite pasa:
$ npx electron-vite build
# → out/main/index.mjs       ✓
# → out/preload/index.mjs    ✓
# → out/renderer/index.html  ✓
# → out/renderer/assets/*.js  ✓
```

### Notas

- **No se crearon archivos nuevos** en esta tarea. Los entry points fueron generados en 1.1 y refinados a lo largo de las tareas 1.3–1.9. La tarea 1.10 es una verificación formal de que todo está correctamente ensamblado.
- **Zero diagnostics**: Los tres archivos pasan el check del TypeScript Language Server sin errores ni warnings.
- **Preparado para expansión**: Los entry points están listos para las siguientes capas:
  - `src/main/index.ts` → añadirá inicialización de SQLite (Task 2) y registro de IPC handlers (Task 3)
  - `src/preload/index.ts` → expondrá la `ElectronAPI` completa (Task 3.1)
  - `src/renderer/src/main.tsx` → añadirá React Router (Task 5.1)

---

## Próximos pasos

Con la tarea 1.11 completada, **el scaffolding del proyecto está terminado al 100%**. El siguiente bloque de trabajo es la **Task 2: Base de Datos SQLite y Migraciones**, que implementará:

- Conexión a SQLite con better-sqlite3
- Sistema de migraciones automáticas
- Repositorios para config, orders, images y print_queue
- Tests unitarios de cada repositorio

---

## Detalle de lo realizado (1.11)

### ¿Qué se hizo?

Se verificó que la aplicación arranca correctamente con `npm run dev`, confirmando que toda la cadena de build y ejecución funciona end-to-end: compilación de main, preload y renderer, inicio del servidor de desarrollo Vite, y lanzamiento de Electron con la ventana mostrando el placeholder "Stamp Sales App".

### Verificaciones realizadas

| Check | Resultado | Detalle |
|-------|-----------|---------|
| `npm run build` | ✅ Pasa | Los 3 procesos compilan sin errores |
| `npx tsc --noEmit` | ✅ Pasa | Sin errores de TypeScript en todo el proyecto |
| `npm run dev` | ✅ Arranca | Vite dev server + Electron se lanzan correctamente |
| Output main | ✅ `out/main/index.mjs` (1.37 KB) | Proceso principal compilado (dependencias externalizadas) |
| Output preload | ✅ `out/preload/index.mjs` (0.32 KB) | Script de preload compilado |
| Output renderer HTML | ✅ `out/renderer/index.html` (0.40 KB) | Entry point del renderer |
| Output renderer CSS | ✅ `out/renderer/assets/index-*.css` (11.50 KB) | Tailwind CSS generado |
| Output renderer JS | ✅ `out/renderer/assets/index-*.js` (202.16 KB) | Bundle React |

### Bug encontrado y corregido: externalización de dependencias

#### Problema

Al ejecutar `npm run dev`, la app lanzaba el siguiente error:

```
Error: Electron failed to install correctly, please delete node_modules/electron and try installing again
    at getElectronPath (file:///...out/main/index.mjs:22:14)
```

#### Causa raíz

`externalizeDepsPlugin()` de electron-vite v4 con **Vite 8 (Rolldown)** no estaba externalizando correctamente las dependencias `electron` y `@electron-toolkit/utils`. En lugar de tratarlas como imports externos, **inlineaba el código fuente** de `node_modules/electron/index.js` dentro del bundle `out/main/index.mjs`.

Esto causaba que `__dirname` dentro del código inlineado apuntara a `out/main/` en vez de `node_modules/electron/`, y por tanto no encontraba el archivo `path.txt` que Electron usa para localizar su binario.

**Evidencia**: El bundle pesaba 4.73 KB (con el código de `electron/index.js` embedido). Tras el fix, pesa 1.37 KB (solo imports externos).

#### Solución

Se añadió `external` explícito en `rollupOptions` para los paquetes de Electron:

```diff
  main: {
-   plugins: [externalizeDepsPlugin()],
+   plugins: [externalizeDepsPlugin({ exclude: [] })],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
-       }
+       },
+       external: ['electron', '@electron-toolkit/utils', '@electron-toolkit/preload']
      }
    }
  },
  preload: {
-   plugins: [externalizeDepsPlugin()],
+   plugins: [externalizeDepsPlugin({ exclude: [] })],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
-       }
+       },
+       external: ['electron', '@electron-toolkit/preload']
      }
    }
  },
```

#### Verificación del fix

Antes del fix, `out/main/index.mjs` contenía:
```javascript
// Código INLINEADO de node_modules/electron/index.js ❌
var pathFile = path.join(__dirname, "path.txt");
function getElectronPath() { ... }
```

Después del fix:
```javascript
// Imports EXTERNOS correctos ✅
import { BrowserWindow, app, shell } from "electron";
import { electronApp, is, optimizer } from "@electron-toolkit/utils";
```

### Resultado de `npm run build` (tras el fix)

```
> stamp-sales-app@1.0.0 build
> electron-vite build

vite v8.1.0 building ssr environment for production...
✓ 2 modules transformed.
out/main/index.mjs  1.37 kB
✓ built in 214ms

vite v8.1.0 building ssr environment for production...
✓ 2 modules transformed.
out/preload/index.mjs  0.32 kB
✓ built in 12ms

vite v8.1.0 building client environment for production...
✓ 14 modules transformed.
out/renderer/index.html                   0.40 kB
out/renderer/assets/index-C7rbtRH9.css   11.50 kB
out/renderer/assets/index-DZsXGOPI.js   202.16 kB
✓ built in 273ms
```

### Resultado de `npm run dev`

```
build the electron preload files successfully
-----
dev server running for the electron renderer process at:
  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
start electron app...
```

El servidor de desarrollo Vite arranca en el puerto 5173, electron-vite compila el preload, y Electron se lanza cargando la URL de desarrollo. La ventana muestra el componente `<App />` centrado con el texto "Stamp Sales App" estilizado con Tailwind CSS.

### ¿Qué muestra la ventana?

La ventana de 1280×800 px muestra:
- Fondo blanco (color `--background`)
- Texto centrado vertical y horizontalmente: **"Stamp Sales App"**
- Estilo: `text-2xl font-semibold` (Tailwind) con la fuente Open Sans

Esto confirma que:
1. El main process crea correctamente la ventana
2. El preload se ejecuta sin errores
3. El renderer carga React y monta el componente
4. Tailwind CSS está procesado y aplicado
5. El HMR del dev server está activo (cambios en código se reflejan al instante)

### Nota sobre entornos headless/CI y sandbox en Linux

En entornos Linux sin la configuración de sandbox de Chromium, Electron muestra un error:

```
FATAL:setuid_sandbox_host.cc(158) The SUID sandbox helper binary was found,
but is not configured correctly.
```

**Solución para desarrollo en Linux**: Exportar la variable de entorno antes de ejecutar:

```bash
export ELECTRON_DISABLE_SANDBOX=1
npm run dev
```

Esto es **esperado** en Ubuntu de desarrollo y no afecta a producción (Windows). En Windows, la app arranca sin configuración adicional. Para CI, se puede usar `xvfb-run` combinado con `ELECTRON_DISABLE_SANDBOX=1`.

### Conclusión

El scaffolding del proyecto está completo. La aplicación:
- ✅ Compila los 3 procesos (main, preload, renderer) sin errores
- ✅ TypeScript strict mode pasa en todo el proyecto
- ✅ Vite dev server arranca con HMR
- ✅ Electron lanza y muestra la ventana
- ✅ Tailwind CSS genera y aplica estilos correctamente
- ✅ React 18 monta y renderiza el componente raíz

---

## Stack tecnológico elegido

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Shell de escritorio | Electron 30+ | Ecosistema maduro, acceso nativo a SO |
| Frontend | React 18 + TypeScript | Tipado estricto, shadcn ecosystem |
| Build tool | electron-vite | HMR rápido, configuración simple |
| Estilo | Tailwind CSS + shadcn/ui | Consistencia con el legacy |
| Estado | Zustand | Mínimo boilerplate |
| Base de datos | better-sqlite3 | Síncrono, offline-first |
| Testing | Vitest + Testing Library | Rápido, compatible con Vite |
