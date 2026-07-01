# Task 15: Build y Empaquetado

## 15.1 Configurar electron-builder para generar .deb/AppImage (Linux dev)

### Resumen

Se configuró `electron-builder` para empaquetar la aplicación como `.deb` y `.AppImage` en Linux, permitiendo probar el empaquetado durante el desarrollo sin necesidad de Windows.

### Pasos realizados

#### 1. Instalar electron-builder

```bash
npm install --save-dev electron-builder
```

Se añadió como dependencia de desarrollo. La versión instalada es la 26.15.x.

#### 2. Crear `electron-builder.yml`

Fichero de configuración en la raíz del proyecto con la siguiente estructura:

```yaml
appId: com.stamp-sales.desktop
productName: Stamp Sales
directories:
  buildResources: build
  output: dist
files:
  - out/**/*
  - resources/**/*
  - "!node_modules/**/{test,__tests__,tests}/**"
  - "!node_modules/**/*.map"
extraResources:
  - from: resources/fonts
    to: fonts
    filter:
      - "**/*"
asarUnpack:
  - "node_modules/better-sqlite3/**"
linux:
  target:
    - target: deb
      arch:
        - x64
    - target: AppImage
      arch:
        - x64
  category: Office
  icon: build/icon.png
  maintainer: Stamp Sales Team
deb:
  depends:
    - libgtk-3-0
    - libnotify4
    - libnss3
    - libxss1
    - libxtst6
    - xdg-utils
    - libatspi2.0-0
    - libuuid1
    - libsecret-1-0
appImage:
  license: UNLICENSED
```

**Decisiones clave:**

- **`asarUnpack` para better-sqlite3**: Los módulos nativos (`.node`) no pueden ejecutarse desde dentro de un archivo `.asar`. Se desempaqueta better-sqlite3 para que funcione correctamente.
- **`extraResources` para fuentes**: Las fuentes Franklin Gothic se copian a `resources/fonts` en el paquete final, accesibles desde el main process vía `process.resourcesPath`.
- **Targets Linux**: `.deb` para distribuciones Debian/Ubuntu y `AppImage` como formato universal portable.
- **Dependencias .deb**: Se listan las librerías de sistema que Electron necesita (GTK3, NSS, etc.).

#### 3. Crear `build/icon.png`

Se creó un icono placeholder de 256x256px (PNG) en `build/icon.png`. electron-builder lo utiliza como icono de la aplicación en Linux.

> **TODO**: Reemplazar con el icono definitivo de la aplicación.

#### 4. Añadir scripts de build en `package.json`

```json
{
  "scripts": {
    "build:linux": "electron-vite build && electron-builder --linux",
    "build:win": "electron-vite build && electron-builder --win"
  }
}
```

- `build:linux`: Compila el código con electron-vite y luego empaqueta para Linux.
- `build:win`: Preparado para la Task 15.2 (Windows).

#### 5. Añadir campo `author` en `package.json`

```json
{
  "author": "Stamp Sales Team"
}
```

electron-builder muestra un warning si no está presente este campo.

### Verificación

```bash
# Build rápido (solo directorio, sin generar .deb/.AppImage completos)
npx electron-builder --linux --dir
```

El resultado confirma:
- ✅ Configuración cargada correctamente desde `electron-builder.yml`
- ✅ Módulo nativo `better-sqlite3` recompilado para la versión de Electron
- ✅ Empaquetado exitoso en `dist/linux-unpacked/`

### Build completo

Para generar los paquetes `.deb` y `.AppImage`:

```bash
npm run build:linux
```

Los artefactos se generan en `dist/`:
- `dist/Stamp Sales_1.0.0_amd64.deb`
- `dist/Stamp Sales-1.0.0.AppImage`

### Estructura de ficheros modificados/creados

```
stamp-sales-app/
├── build/
│   └── icon.png                  # (nuevo) Icono placeholder 256x256
├── electron-builder.yml          # (nuevo) Configuración de empaquetado
└── package.json                  # (modificado) Scripts + author
```

---

## 15.2 Configurar electron-builder para generar .exe NSIS (Windows producción)

### Resumen

Se añadió la configuración de `electron-builder` para generar un instalador `.exe` con NSIS para Windows (64-bit), orientado al entorno de producción. También se creó un script NSIS personalizado (`installer.nsh`) que gestiona reglas de firewall para la impresión IPP.

### Pasos realizados

#### 1. Añadir sección `win` en `electron-builder.yml`

Se configuró el target Windows con NSIS como formato de instalador:

```yaml
win:
  target:
    - target: nsis
      arch:
        - x64
  icon: build/icon.png
  artifactName: "StampSales-Setup-${version}.${ext}"
```

**Decisiones:**

- **Arquitectura x64**: La app solo necesita soportar Windows 10/11 de 64 bits.
- **`artifactName`**: Nombre limpio y descriptivo para el ejecutable generado (ej: `StampSales-Setup-1.0.0.exe`).
- **Icono**: Reutiliza `build/icon.png`. electron-builder lo convierte automáticamente a `.ico` durante el build.

#### 2. Añadir sección `nsis` en `electron-builder.yml`

```yaml
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  perMachine: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: Stamp Sales
  installerIcon: build/icon.png
  uninstallerIcon: build/icon.png
  installerHeaderIcon: build/icon.png
  deleteAppDataOnUninstall: false
  include: build/installer.nsh
  runAfterFinish: true
  installerLanguages:
    - Spanish
    - English
  language: 3082
```

**Decisiones clave:**

- **`oneClick: false`**: Instalador asistido (no silencioso). Permite al usuario elegir directorio de instalación y ver progreso.
- **`allowToChangeInstallationDirectory: true`**: Flexibilidad para instalar en la ruta que prefiera el vendedor/técnico.
- **`perMachine: true`**: Se instala para todos los usuarios del equipo (requiere elevación admin). Apropiado porque el equipo es dedicado.
- **`createDesktopShortcut` + `createStartMenuShortcut`**: Acceso rápido para vendedores no técnicos.
- **`deleteAppDataOnUninstall: false`**: NO borra la base de datos SQLite ni configuración al desinstalar. Preserva el historial de ventas.
- **`include: build/installer.nsh`**: Script personalizado para acciones adicionales durante instalación/desinstalación.
- **`runAfterFinish: true`**: Lanza la app automáticamente al terminar la instalación.
- **`language: 3082`**: Español (España) como idioma por defecto del instalador. 3082 = LCID de es-ES en Windows.
- **`installerLanguages`**: Ofrece español e inglés como opciones.

#### 3. Crear `build/installer.nsh`

Script NSIS personalizado con macros que se ejecutan durante la instalación y desinstalación:

```nsh
; Custom NSIS installer script for Stamp Sales Desktop App

!macro customInit
  ; Previene múltiples instancias del instalador
  System::Call 'kernel32::CreateMutex(...)'
!macroend

!macro customInstall
  ; Regla de firewall para impresión IPP (puerto 631)
  netsh advfirewall firewall add rule name="Stamp Sales IPP" ...
!macroend

!macro customUnInstall
  ; Elimina la regla de firewall al desinstalar
  netsh advfirewall firewall delete rule name="Stamp Sales IPP"
!macroend
```

**Justificación:**

- **Mutex de instalador**: Evita que el usuario ejecute el instalador dos veces simultáneamente (podría corromper la instalación).
- **Regla de firewall IPP**: La app necesita conectarse a impresoras vía IPP (puerto 631). Sin esta regla, Windows Firewall bloquearía la comunicación con las impresoras de red.
- **Limpieza en desinstalación**: Se elimina la regla de firewall al desinstalar para no dejar residuos en el sistema.

### Configuración final completa de `electron-builder.yml`

```yaml
appId: com.stamp-sales.desktop
productName: Stamp Sales
directories:
  buildResources: build
  output: dist
files:
  - out/**/*
  - resources/**/*
  - "!node_modules/**/{test,__tests__,tests}/**"
  - "!node_modules/**/*.map"
extraResources:
  - from: resources/fonts
    to: fonts
    filter:
      - "**/*"
asarUnpack:
  - "node_modules/better-sqlite3/**"
linux:
  target:
    - target: deb
      arch: [x64]
    - target: AppImage
      arch: [x64]
  category: Office
  icon: build/icon.png
  maintainer: Stamp Sales Team
deb:
  depends: [libgtk-3-0, libnotify4, libnss3, ...]
appImage:
  license: UNLICENSED
win:
  target:
    - target: nsis
      arch: [x64]
  icon: build/icon.png
  artifactName: "StampSales-Setup-${version}.${ext}"
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  perMachine: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: Stamp Sales
  deleteAppDataOnUninstall: false
  include: build/installer.nsh
  runAfterFinish: true
  installerLanguages: [Spanish, English]
  language: 3082
```

### Cómo generar el instalador Windows

```bash
# Desde Linux (cross-compile con Wine — requiere Wine instalado)
npm run build:win

# Desde Windows nativo (recomendado para producción)
npm run build:win
```

El artefacto se genera en:
- `dist/StampSales-Setup-1.0.0.exe`

### Notas importantes

1. **Cross-compilation**: electron-builder puede generar `.exe` desde Linux usando Wine, pero para producción se recomienda compilar en Windows nativo para evitar problemas con módulos nativos (better-sqlite3).

2. **Firma de código (pendiente)**: Para distribución sin warnings de SmartScreen, se necesitará configurar un certificado de firma de código (`win.certificateFile` y `win.certificatePassword` en electron-builder.yml o vía variables de entorno).

3. **Icono .ico**: electron-builder convierte automáticamente `icon.png` a `.ico`. Para mejor calidad, se puede proporcionar directamente un `build/icon.ico` con múltiples resoluciones (16, 32, 48, 64, 128, 256px).

### Estructura de ficheros modificados/creados

```
stamp-sales-app/
├── build/
│   ├── icon.png              # (existente) Usado como icono del .exe
│   └── installer.nsh         # (nuevo) Script NSIS personalizado
├── electron-builder.yml      # (modificado) Añadidas secciones win + nsis
└── package.json              # (sin cambios) build:win ya existía
```

---

## 15.3 Configurar auto-arranque con Windows (registro o shortcut en Startup)

### Resumen

Se implementó el auto-arranque de la aplicación en Windows mediante dos mecanismos complementarios:

1. **Registro de Windows vía NSIS** (instalador): La app se registra automáticamente para iniciar con Windows al momento de instalar.
2. **API Electron en runtime** (`app.setLoginItemSettings`): Permite habilitar/deshabilitar el auto-arranque desde la propia aplicación sin necesidad de reinstalar.

Ambos mecanismos escriben/eliminan la clave `HKCU\Software\Microsoft\Windows\CurrentVersion\Run\StampSales`.

### Pasos realizados

#### 1. Crear módulo `src/main/auto-launch.ts`

Módulo que encapsula la lógica de auto-arranque usando la API nativa de Electron:

```typescript
import { app } from 'electron'

export function getAutoLaunchEnabled(): boolean {
  if (process.platform !== 'win32') return false
  return app.getLoginItemSettings().openAtLogin
}

export function setAutoLaunchEnabled(enabled: boolean): void {
  if (process.platform !== 'win32') return
  app.setLoginItemSettings({
    openAtLogin: enabled,
    args: enabled ? ['--hidden'] : []
  })
}
```

**Decisiones:**

- **`app.setLoginItemSettings()`**: API nativa de Electron que gestiona la clave de registro `HKCU\...\Run`. No requiere paquetes externos ni acceso a admin (HKCU es por usuario).
- **Flag `--hidden`**: Se pasa como argumento al ejecutable cuando arranca automáticamente. Esto permite que la app detecte que fue auto-lanzada y pueda arrancar minimizada o en bandeja del sistema en el futuro.
- **No-op en Linux/macOS**: El módulo no hace nada en plataformas distintas a Windows, ya que el target de producción es solo Windows.

#### 2. Crear handlers IPC `src/main/ipc/auto-launch.handlers.ts`

Handlers para que el renderer pueda consultar y modificar el estado del auto-arranque:

```typescript
import { handleIpc } from './handlers'
import { getAutoLaunchEnabled, setAutoLaunchEnabled } from '../auto-launch'

export function registerAutoLaunchHandlers(): void {
  handleIpc('autoLaunch:get', () => getAutoLaunchEnabled())
  handleIpc('autoLaunch:set', (enabled: unknown) => {
    if (typeof enabled !== 'boolean') {
      throw new Error('autoLaunch:set expects a boolean argument')
    }
    setAutoLaunchEnabled(enabled)
    return getAutoLaunchEnabled()
  })
}
```

**Canales IPC:**

| Canal | Descripción | Retorno |
|-------|-------------|---------|
| `autoLaunch:get` | Consulta si el auto-arranque está habilitado | `boolean` |
| `autoLaunch:set` | Habilita/deshabilita el auto-arranque | `boolean` (nuevo estado) |

#### 3. Registrar handlers en `src/main/ipc/handlers.ts`

Se añadió `registerAutoLaunchHandlers()` al registro centralizado:

```typescript
import { registerAutoLaunchHandlers } from './auto-launch.handlers'

export function registerAllHandlers(): void {
  registerConfigHandlers()
  registerOrdersHandlers()
  registerImagesHandlers()
  registerPrinterHandlers()
  registerSaleHandlers()
  registerAutoLaunchHandlers()  // ← nuevo
}
```

#### 4. Exponer API en preload (`src/preload/index.ts`)

Se añadió la sección `autoLaunch` a la interfaz `ElectronAPI`:

```typescript
// En la interfaz ElectronAPI:
autoLaunch: {
  get(): Promise<boolean>
  set(enabled: boolean): Promise<boolean>
}

// En la implementación del api object:
autoLaunch: {
  get: () => ipcRenderer.invoke('autoLaunch:get'),
  set: (enabled) => ipcRenderer.invoke('autoLaunch:set', enabled)
}
```

#### 5. Añadir wrapper en `src/renderer/src/lib/ipc-client.ts`

Funciones tipadas para uso desde componentes React:

```typescript
export async function getAutoLaunchEnabled(): Promise<boolean> {
  return getAPI().autoLaunch.get()
}

export async function setAutoLaunchEnabled(enabled: boolean): Promise<boolean> {
  return getAPI().autoLaunch.set(enabled)
}
```

#### 6. Actualizar `build/installer.nsh` (NSIS)

Se añadieron instrucciones para registrar/eliminar el auto-arranque durante la instalación/desinstalación:

```nsh
!macro customInstall
  ; ... (regla firewall existente) ...

  ; Auto-start: registrar en HKCU\...\Run
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" \
    "StampSales" '"$INSTDIR\Stamp Sales.exe" --hidden'
!macroend

!macro customUnInstall
  ; ... (eliminar regla firewall) ...

  ; Eliminar auto-start del registro
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "StampSales"
!macroend
```

**Decisiones:**

- **HKCU vs HKLM**: Se usa `HKCU` (usuario actual) porque no requiere permisos de administrador para la clave de Run. Además, la API de Electron (`setLoginItemSettings`) también opera sobre HKCU, manteniendo consistencia.
- **Eliminación en desinstalación**: El uninstaller limpia la entrada del registro para no dejar residuos.

### Cómo funciona

1. **Al instalar**: El instalador NSIS escribe la clave de registro. La app arrancará automáticamente en el próximo login.
2. **En runtime**: El usuario puede deshabilitar el auto-arranque desde la UI (cuando se implemente un toggle en la vista de configuración) usando `setAutoLaunchEnabled(false)`.
3. **Al desinstalar**: El uninstaller elimina la clave de registro.

### Cómo detectar si la app fue auto-lanzada

Desde el main process se puede comprobar si la app fue iniciada por auto-launch:

```typescript
const wasAutoLaunched = process.argv.includes('--hidden')
if (wasAutoLaunched) {
  // Opcionalmente: arrancar minimizada o en system tray
}
```

### Verificación

- ✅ `npx electron-vite build` compila sin errores (main + preload + renderer)
- ✅ Diagnósticos TypeScript sin errores en los ficheros nuevos/modificados
- ✅ La API `autoLaunch:get` / `autoLaunch:set` queda disponible para el renderer

### Estructura de ficheros modificados/creados

```
stamp-sales-app/
├── build/
│   └── installer.nsh                          # (modificado) Añadido WriteRegStr / DeleteRegValue
├── src/
│   ├── main/
│   │   ├── auto-launch.ts                     # (nuevo) Módulo auto-arranque Windows
│   │   └── ipc/
│   │       ├── auto-launch.handlers.ts        # (nuevo) IPC handlers para autoLaunch
│   │       └── handlers.ts                    # (modificado) Registra auto-launch handlers
│   ├── preload/
│   │   └── index.ts                           # (modificado) Expone autoLaunch en ElectronAPI
│   └── renderer/
│       └── src/
│           └── lib/
│               └── ipc-client.ts              # (modificado) Wrappers getAutoLaunchEnabled/setAutoLaunchEnabled
```

---

## 15.4 Empaquetar fuentes y recursos en la build final

### Resumen

Se configuró el empaquetado de todos los recursos estáticos necesarios para que la aplicación funcione correctamente en producción (build empaquetada). Esto incluye: fuentes tipográficas, imágenes de fondo para etiquetas/tickets, y ficheros de migración SQL.

### Problema

El código del main process resuelve rutas a recursos estáticos de forma diferente en desarrollo y producción:

```typescript
// En desarrollo (electron-vite dev):
join(__dirname, '../../resources/fonts')
join(__dirname, '../../resources/images')
join(app.getAppPath(), 'src', 'main', 'database', 'migrations')

// En producción (app empaquetada):
join(process.resourcesPath, 'fonts')
join(process.resourcesPath, 'images')
join(process.resourcesPath, 'migrations')
```

Para que las rutas de producción funcionen, los recursos deben copiarse a `process.resourcesPath` durante el empaquetado vía la directiva `extraResources` de electron-builder.

### Pasos realizados

#### 1. Crear `resources/images/` con las imágenes esenciales

Se copiaron las 9 imágenes utilizadas por los módulos `stamp-renderer.ts` y `ticket-renderer.ts` desde `old-version/demonio/images/` a `resources/images/`:

| Imagen | Uso |
|--------|-----|
| `fondoetiqueta-nada.png` | Fondo en blanco por defecto para sellos (modo mdcc) |
| `fondoticketori.png` | Marca de agua del ticket original |
| `fondoticketcop-nada.png` | Fondo para ticket copia (genTicketCaja) |
| `fondoticketcop.png` | Fondo para ticket master set (genTicketMaster) |
| `image2.jpg` | Logo de Correos para la cabecera de tickets |
| `TiraEspecial1.png` | Fondo tira especial posición 1 |
| `TiraEspecial2.png` | Fondo tira especial posición 2 |
| `TiraEspecial3.png` | Fondo tira especial posición 3 |
| `TiraEspecial4.png` | Fondo tira especial posición 4 |

> **Nota**: Las imágenes de motivo de los eventos (fondos personalizados de sellos) NO se incluyen aquí. Esas se suben dinámicamente por el vendedor vía la vista "Subir Imagen" y se almacenan en la base de datos SQLite como Base64.

#### 2. Actualizar `electron-builder.yml` — sección `extraResources`

Configuración anterior (solo fuentes):

```yaml
extraResources:
  - from: resources/fonts
    to: fonts
    filter:
      - "**/*"
```

Configuración actualizada (fuentes + imágenes + migraciones):

```yaml
extraResources:
  - from: resources/fonts
    to: fonts
    filter:
      - "**/*"
  - from: resources/images
    to: images
    filter:
      - "**/*"
  - from: src/main/database/migrations
    to: migrations
    filter:
      - "*.sql"
```

**Resultado en producción:**

| Recurso | Origen en el proyecto | Destino en la build |
|---------|----------------------|---------------------|
| Fuentes Franklin Gothic | `resources/fonts/*.ttf` | `process.resourcesPath/fonts/` |
| Imágenes de fondo | `resources/images/*` | `process.resourcesPath/images/` |
| Migraciones SQL | `src/main/database/migrations/*.sql` | `process.resourcesPath/migrations/` |

#### 3. Verificación

```bash
npx electron-vite build
```

✅ Build completa sin errores (main + preload + renderer).

Los tres módulos que consumen recursos en producción resuelven las rutas correctamente:

- `stamp-renderer.ts` → `getFontsPath()` y `getImagesPath()` → `process.resourcesPath/fonts` y `process.resourcesPath/images`
- `ticket-renderer.ts` → usa `getImagesPath()` para cargar fondos de tickets y logo
- `migrator.ts` → `getMigrationsPath()` → `process.resourcesPath/migrations`

### Mapa de resolución de rutas (resumen)

```
┌─────────────────────────────────────────────────────────────────┐
│                    app empaquetada (.exe / .deb)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  app.asar (código compilado)                                    │
│    └── out/main/index.js                                        │
│    └── out/preload/index.js                                     │
│    └── out/renderer/...                                         │
│                                                                 │
│  app.asar.unpacked/                                             │
│    └── node_modules/better-sqlite3/  (módulo nativo)            │
│                                                                 │
│  resources/  (= process.resourcesPath)                          │
│    ├── fonts/                                                   │
│    │   ├── franklin_gothic.ttf                                  │
│    │   ├── franklin_gothic_bold.ttf                             │
│    │   └── franklin_gothic_condensed.ttf                        │
│    ├── images/                                                  │
│    │   ├── fondoetiqueta-nada.png                               │
│    │   ├── fondoticketori.png                                   │
│    │   ├── fondoticketcop-nada.png                              │
│    │   ├── fondoticketcop.png                                   │
│    │   ├── image2.jpg                                           │
│    │   ├── TiraEspecial1.png                                    │
│    │   ├── TiraEspecial2.png                                    │
│    │   ├── TiraEspecial3.png                                    │
│    │   └── TiraEspecial4.png                                    │
│    └── migrations/                                              │
│        └── 001_initial.sql                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Estructura de ficheros modificados/creados

```
stamp-sales-app/
├── electron-builder.yml              # (modificado) Añadidas entradas extraResources para images y migrations
└── resources/
    ├── fonts/                        # (sin cambios) Ya existía
    │   ├── franklin_gothic.ttf
    │   ├── franklin_gothic_bold.ttf
    │   └── franklin_gothic_condensed.ttf
    └── images/                       # (nuevo) Directorio con imágenes esenciales
        ├── fondoetiqueta-nada.png
        ├── fondoticketori.png
        ├── fondoticketcop-nada.png
        ├── fondoticketcop.png
        ├── image2.jpg
        ├── TiraEspecial1.png
        ├── TiraEspecial2.png
        ├── TiraEspecial3.png
        └── TiraEspecial4.png
```
