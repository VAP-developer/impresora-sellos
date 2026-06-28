# Task 1: Scaffolding del Proyecto y Entorno Virtual

## Resumen

Esta tarea establece la base técnica del proyecto **Stamp Sales Desktop App**: una aplicación de escritorio construida con **Electron + React + TypeScript** usando **electron-vite** como herramienta de build.

---

## Progreso

| # | Subtarea | Estado |
|---|----------|--------|
| 1.1 | Crear estructura base del proyecto con Electron + React + TypeScript usando electron-vite | ✅ Completada |
| 1.2 | Configurar Node.js con nvm y fijar versión en `.nvmrc` | ⬜ Pendiente |
| 1.3 | Instalar dependencias core (electron, react, react-dom, typescript, electron-vite, tailwindcss) | ⬜ Pendiente |
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

## Próximos pasos

Las subtareas 1.2–1.11 completarán el scaffolding:

1. **1.2**: Fijar la versión de Node.js con nvm (`.nvmrc`)
2. **1.3–1.6**: Instalar todas las dependencias (core, datos, UI, desarrollo)
3. **1.7–1.8**: Ya parcialmente cubiertos por 1.1 (los tsconfig y electron.vite.config ya existen), se refinarán si es necesario
4. **1.9**: Configurar Tailwind CSS
5. **1.10**: Ya cubierto por 1.1 (entry points creados)
6. **1.11**: Verificación final ejecutando `npm run dev`

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
