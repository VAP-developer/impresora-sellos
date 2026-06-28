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
| 1.4 | Instalar dependencias de datos (better-sqlite3, zustand) | ⬜ Pendiente |
| 1.5 | Instalar dependencias de UI (@radix-ui/shadcn, class-variance-authority, clsx, tailwind-merge) | ⬜ Pendiente |
| 1.6 | Instalar dependencias de desarrollo (vitest, @testing-library/react, eslint, prettier) | ⬜ Pendiente |
| 1.7 | Configurar tsconfig.json para main, preload y renderer | ⬜ Pendiente |
| 1.8 | Configurar electron.vite.config.ts con entradas para main, preload y renderer | ⬜ Pendiente |
| 1.9 | Configurar Tailwind CSS (tailwind.config.js + globals.css) | ⬜ Pendiente |
| 1.10 | Crear entry points básicos: src/main/index.ts, src/preload/index.ts, src/renderer/src/main.tsx | ⬜ Pendiente |
| 1.11 | Verificar que la app arranca con `npm run dev` mostrando una ventana vacía | ⬜ Pendiente |

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

## Próximos pasos

Las subtareas 1.3–1.11 completarán el scaffolding:

1. **1.3–1.6**: Instalar todas las dependencias (core, datos, UI, desarrollo)
2. **1.7–1.8**: Ya parcialmente cubiertos por 1.1 (los tsconfig y electron.vite.config ya existen), se refinarán si es necesario
3. **1.9**: Configurar Tailwind CSS
4. **1.10**: Ya cubierto por 1.1 (entry points creados)
5. **1.11**: Verificación final ejecutando `npm run dev`

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
