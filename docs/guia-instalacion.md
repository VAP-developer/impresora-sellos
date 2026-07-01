# Guía de Instalación y Verificación Manual

## Requisitos Previos

### Generales
- Node.js 20+ (gestionado con nvm, ver `.nvmrc`)
- npm 9+
- Git

### Linux (Desarrollo)
- Ubuntu 22.04+ o derivado
- Paquetes del sistema: `dpkg`, `fakeroot` (para generar .deb)
- CUPS instalado (para pruebas de impresión)

### Windows (Producción)
- Windows 10/11 (64-bit)
- No requiere dependencias externas (ni Java, ni Python, ni servidores)
- Impresora Epson conectada por USB o red (para pruebas de impresión)

---

## 1. Build en Linux

### 1.1 Preparar el entorno

```bash
# Activar la versión correcta de Node
nvm use

# 1. Instalar dependencias
npm install

# 2. Reconstruir better-sqlite3 para Electron
npm run build:linux

# 3. Desplegar la aplicación

# Opcion A
chmod +x "dist/Stamp Sales-1.0.0.AppImage"
"./dist/Stamp Sales-1.0.0.AppImage"

# Opción B
sudo dpkg -i dist/stamp-sales-app_1.0.0_amd64.deb

# Opción C
./dist/linux-unpacked/stamp-sales-app
```

### 1.2 Generar paquete Linux (.deb / AppImage)

```bash
npm run build:linux
```

Los artefactos se generan en `dist/`:
- `dist/stamp-sales-app_1.0.0_amd64.deb`
- `dist/StampSales-1.0.0.AppImage`

### 1.3 Instalar el .deb
``` bash
sudo apt-get install fakeroot dpkg-dev
npm run build:linux
```

```bash
sudo dpkg -i dist/stamp-sales-app_1.0.0_amd64.deb

# Si hay dependencias faltantes:
sudo apt-get install -f
```

### 1.4 Instalar el AppImage

```bash
chmod +x dist/StampSales-1.0.0.AppImage
./dist/StampSales-1.0.0.AppImage
```

### 1.5 Verificación en Linux

| # | Verificación | Resultado esperado |
|---|---|---|
| 1 | La app arranca sin errores | Ventana principal visible, sin crash |
| 2 | Se muestra la vista Kiosko | Tabla de tarifas con modelos 1 y 2 |
| 3 | Navegación entre vistas | Home, Kiosko, Máquina, Imprimir, Subir Imagen accesibles |
| 4 | Base de datos se crea | `~/.config/stamp-sales-app/stamp-sales.db` existe |
| 5 | Configuración se carga | Valores por defecto visibles en Máquina |
| 6 | Fuentes embebidas | Textos en Franklin Gothic se muestran correctamente |
| 7 | Exportar CSV | Botón de exportar genera archivo .csv sin errores |

---

## 2. Build para Windows (cross-compile desde Linux)

### 2.1 Instalar dependencias de cross-compile

```bash
# Extra - Wine es necesario para firmar y generar el .exe desde Linux
sudo apt-get install wine64

# Instalar dependencias del proyecto
npm install
npm run rebuild
```

### 2.2 Generar instalador Windows (.exe)

```bash
npm run build:win
```

Los artefactos se generan en `dist/`:
- `dist/StampSales-Setup-1.0.0.exe`

> **Nota**: El cross-compile desde Linux puede funcionar para generar el .exe, pero la verificación real debe hacerse en una máquina Windows. Si el cross-compile falla, copiar el código fuente a Windows y ejecutar `npm run build:win` allí.

---

## 3. Instalación en Windows

### 3.1 Transferir el instalador

Copiar `dist/StampSales-Setup-1.0.0.exe` a la máquina Windows (USB, red, etc.)

### 3.2 Ejecutar el instalador

1. Doble click en `StampSales-Setup-1.0.0.exe`
2. El instalador NSIS muestra el asistente en español
3. Seleccionar directorio de instalación (por defecto: `C:\Program Files\Stamp Sales\`)
4. Click en "Instalar"
5. El instalador:
   - Copia archivos al directorio elegido
   - Crea acceso directo en Escritorio
   - Crea entrada en Menú Inicio
   - Configura regla de firewall para IPP (puerto 631)
   - Registra auto-arranque en `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
6. Click en "Finalizar" (la app se ejecuta automáticamente)

### 3.3 Verificación de instalación limpia en Windows

| # | Verificación | Resultado esperado | ✓/✗ |
|---|---|---|---|
| 1 | Instalador se ejecuta sin errores | Asistente completa sin warnings | |
| 2 | Acceso directo en Escritorio | Icono "Stamp Sales" presente | |
| 3 | Acceso directo en Menú Inicio | Entrada "Stamp Sales" presente | |
| 4 | La app arranca al finalizar instalador | Ventana visible, vista Kiosko operativa | |
| 5 | Arranque en < 3 segundos | Medir desde click hasta vista Kiosko cargada | |
| 6 | Base de datos se crea | `%APPDATA%/stamp-sales-app/stamp-sales.db` existe | |
| 7 | Fuentes Franklin Gothic | Textos de etiqueta se muestran correctamente | |
| 8 | Imágenes de recursos | Fondos de etiqueta y ticket disponibles | |
| 9 | Auto-arranque configurado | Registro `HKCU\...\Run\StampSales` existe | |
| 10 | Regla de firewall | `netsh advfirewall firewall show rule name="Stamp Sales IPP"` muestra la regla | |
| 11 | Navegación completa | Todas las vistas accesibles sin crash | |
| 12 | Configuración persiste | Cambios en Máquina sobreviven reinicio de app | |
| 13 | Venta simulada | Seleccionar cantidades, pulsar imprimir (sin impresora conectada, debe dar error controlado) | |
| 14 | Exportar CSV | Genera archivo .csv con datos correctos | |
| 15 | Desinstalación limpia | Panel de control → Desinstalar: elimina archivos, accesos directos, regla firewall y registro | |

### 3.4 Verificación de auto-arranque

1. Reiniciar Windows
2. Verificar que la app se inicia automáticamente (puede estar oculta si usó `--hidden`)
3. Verificar en el Administrador de Tareas que el proceso `Stamp Sales.exe` está corriendo

### 3.5 Verificación de desinstalación

1. Ir a Panel de Control → Programas → Desinstalar
2. Seleccionar "Stamp Sales" y desinstalar
3. Verificar:
   - Directorio `C:\Program Files\Stamp Sales\` eliminado
   - Acceso directo del escritorio eliminado
   - Entrada del menú inicio eliminada
   - Registro `HKCU\...\Run\StampSales` eliminado
   - Regla de firewall eliminada
   - Datos de usuario en `%APPDATA%` **no se eliminan** (por diseño, `deleteAppDataOnUninstall: false`)

---

## 4. Troubleshooting

### La app no arranca en Windows

```powershell
# Ejecutar desde terminal para ver errores:
cd "C:\Program Files\Stamp Sales"
"Stamp Sales.exe"
```

### Error de better-sqlite3

Si aparece un error de módulo nativo:
```bash
# En el entorno de desarrollo, reconstruir para la plataforma target:
npm run rebuild
```

### Fuentes no se muestran

Verificar que la carpeta `resources/fonts/` contiene:
- `franklin_gothic.ttf`
- `franklin_gothic_bold.ttf`
- `franklin_gothic_condensed.ttf`

### Base de datos no se crea

Verificar permisos de escritura en:
- Linux: `~/.config/stamp-sales-app/`
- Windows: `%APPDATA%/stamp-sales-app/`

### Cross-compile falla desde Linux

Si `npm run build:win` falla en Linux, las opciones son:
1. Instalar Wine 64-bit y reintentar
2. Usar una VM con Windows para el build
3. Usar GitHub Actions con `windows-latest` runner

---

## 5. Configuración del Entorno de Test con Impresora

Para pruebas completas de impresión (Task 12.8):

### Linux (CUPS)
```bash
# Verificar impresoras disponibles
lpstat -p

# Instalar impresora de prueba virtual (PDF)
sudo apt-get install cups-pdf
```

### Windows (IPP)
1. Conectar impresora Epson por USB o red
2. Instalar drivers de la impresora
3. La app detectará impresoras IPP automáticamente
4. Configurar en la app: asignar impresoras a printer1, printer2 y ticket
