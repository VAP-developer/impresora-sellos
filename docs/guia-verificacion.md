# Guía de Verificación — Stamp Sales App

Guía rápida para comprobar que el proyecto funciona correctamente en tu máquina.

---

## Requisitos previos

- **Node.js 20.x** instalado (recomendado vía [nvm](https://github.com/nvm-sh/nvm))
- **npm** (viene incluido con Node.js)
- Sistema operativo: Linux o Windows

---

## 1. Configurar entorno (Ubuntu)

### Opción A: Instalar nvm (recomendado)

nvm permite tener múltiples versiones de Node.js y cambiar entre ellas por proyecto.

```bash
# 1. Instalar nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# 2. Recargar el shell (IMPORTANTE — sin esto nvm no se encuentra)
source ~/.bashrc
# O si usas zsh:
source ~/.zshrc

# 3. Verificar que nvm funciona
nvm --version
# Esperado: 0.40.1

# 4. Instalar y activar Node 20
nvm install 20
nvm use 20

# 5. Verificar
node --version
# Esperado: v20.x.x
```

Después de esto, cada vez que entres al directorio del proyecto, ejecuta `nvm use` y automáticamente usará Node 20 (lee el `.nvmrc`).

### Opción B: Instalar Node.js directamente (sin nvm)

Si prefieres no usar nvm, puedes instalar Node 20 directamente:

```bash
# Usando el repositorio oficial de NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar
node --version
# Esperado: v20.x.x

npm --version
# Esperado: 10.x.x
```

### Entrar al proyecto

```bash
cd stamp-sales-app    # o el nombre de tu carpeta

# Verificar versión de Node
node --version
# Debe ser v20.x.x
```

---

## 2. Instalar dependencias

```bash
npm install
```

Debería completar sin errores fatales (los warnings de deprecación son normales).

---

## 3. Verificar TypeScript

```bash
npx tsc --noEmit
```

**Resultado esperado**: Sin output (= sin errores). Si aparecen errores de tipos, algo falló en la instalación.

---

## 4. Verificar build de producción

```bash
npm run build
```

**Resultado esperado**:

```
vite v5.x.x building SSR bundle for production...
✓ 1 modules transformed.
out/main/index.js  ~1.3 kB
✓ built in XXms

vite v5.x.x building SSR bundle for production...
✓ 1 modules transformed.
out/preload/index.js  ~0.3 kB
✓ built in XXms

vite v5.x.x building for production...
✓ XX modules transformed.
../../out/renderer/index.html   0.33 kB
../../out/renderer/assets/index-XXXXX.js  ~215 kB
✓ built in XXXms
```

Los tres procesos (main, preload, renderer) deben compilar sin errores.

---

## 5. Arrancar la app en modo desarrollo

```bash
export ELECTRON_DISABLE_SANDBOX=1
npm run dev
```

**Resultado esperado**:
- Se abre una ventana de Electron (1280×800 px)
- Dentro se muestra el texto "Stamp Sales App" centrado
- En la terminal ves los logs de electron-vite con HMR activo

> **Nota**: Requiere un entorno gráfico (display). En un servidor sin GUI o en SSH, esto no funcionará. Usa los pasos 3 y 4 como alternativa.

Para salir: cierra la ventana o pulsa `Ctrl+C` en la terminal.

---

## 6. Verificar dependencias individuales

```bash
node -e "
const pkgs = ['electron', 'react', 'react-dom', 'typescript', 'electron-vite', 'tailwindcss', 'postcss', 'autoprefixer'];
pkgs.forEach(p => {
  try {
    const v = require(p + '/package.json').version;
    console.log('✓ ' + p + ' @ ' + v);
  } catch(e) {
    console.log('✗ ' + p + ' — NO INSTALADO');
  }
});
"
```

**Resultado esperado**:

```
✓ electron @ 30.0.9
✓ react @ 18.3.1
✓ react-dom @ 18.3.1
✓ typescript @ 5.4.5
✓ electron-vite @ 2.3.0
✓ tailwindcss @ 3.4.19
✓ postcss @ 8.4.49
✓ autoprefixer @ 10.4.27
```

---

## 7. Checklist rápida

| Paso | Comando | ¿Pasa? |
|------|---------|--------|
| Node 20.x activo | `node --version` (v20.x.x) | ☐ |
| Dependencias instaladas | `npm install` (sin errores fatales) | ☐ |
| TypeScript sin errores | `npx tsc --noEmit` (sin output) | ☐ |
| Build completo | `npm run build` (3 bundles generados) | ☐ |
| App arranca | `npm run dev` (ventana visible) | ☐ |
| Paquetes presentes | Script de verificación (todas ✓) | ☐ |

---

## Solución de problemas

### "nvm: command not found"

Esto ocurre cuando nvm no está instalado o el shell no lo ha cargado:

```bash
# Si acabas de instalar nvm, recarga tu shell:
source ~/.bashrc    # para bash
source ~/.zshrc     # para zsh

# Si no lo tienes instalado:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
```

Alternativa: salta `nvm use` y verifica que tienes Node 20.x con `node --version`. Si ya tienes Node 20+, puedes ignorar nvm completamente.

### "Cannot find module 'electron'"
Ejecuta `npm install` — las dependencias no están instaladas.

### La ventana no se abre con `npm run dev`
- Verifica que tienes un entorno gráfico disponible (no funciona en SSH puro)
- En Linux sin display, puedes usar `xvfb-run npm run dev` para testing headless

### Errores de TypeScript
Asegúrate de estar en Node 20.x (`nvm use`) y que `npm install` completó sin errores.

---

## Estructura de archivos actual

```
stamp-sales-app/
├── package.json              # Dependencias y scripts
├── package-lock.json         # Lock de versiones
├── .nvmrc                    # Versión de Node (20)
├── electron.vite.config.ts   # Config del build tool
├── tsconfig.json             # Config TypeScript raíz
├── tsconfig.node.json        # TS para main + preload
├── tsconfig.web.json         # TS para renderer (React)
├── src/
│   ├── main/index.ts         # Proceso principal Electron
│   ├── preload/index.ts      # Bridge renderer ↔ main
│   └── renderer/
│       ├── index.html        # HTML entry
│       └── src/
│           ├── main.tsx      # Entry React
│           └── App.tsx       # Componente raíz
├── out/                      # Output del build (generado)
└── docs/                     # Documentación del proyecto
```
