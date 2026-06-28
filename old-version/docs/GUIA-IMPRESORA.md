# Guía de configuración de impresora

## Índice

1. [Arquitectura de impresión](#arquitectura-de-impresión)
2. [Configuración en Linux](#configuración-en-linux)
3. [Configuración en macOS](#configuración-en-macos)
4. [Configuración en Windows](#configuración-en-windows)
5. [Variables de entorno](#variables-de-entorno)
6. [Verificar que funciona](#verificar-que-funciona)
7. [Solución de problemas](#solución-de-problemas)

---

## Arquitectura de impresión

```
┌──────────────┐    WebSocket :8000    ┌───────────────────┐    lp (CUPS)    ┌───────────┐
│  Navegador   │ ───────────────────── │  demonio-python   │ ──────────────▶ │ Impresora │
│  (kiosko)    │                       │  servidor-ws.py   │                 │   USB     │
└──────────────┘                       │  report.py → PDFs │                 └───────────┘
                                       └───────────────────┘
                                              │
┌──────────────┐    HTTP POST :8001           │
│  meteor-app  │ ─── /pausar, /reanudar ──────┘
│  (Node.js)   │
└──────────────┘
```

**Flujo de impresión:**
1. El usuario selecciona etiquetas en `/kiosko` y pulsa el carrito
2. El navegador envía un mensaje WebSocket al demonio (puerto 8000)
3. `servidor-ws.py` recibe el mensaje y llama a `report.py`
4. `report.py` genera los PDFs (etiquetas + ticket)
5. `servidor-ws.py` envía los PDFs a la impresora con el comando `lp` (CUPS)

**Flujo de pausar/reanudar:**
1. El usuario pulsa Pausar/Reanudar en la interfaz
2. Meteor hace un HTTP POST al demonio (puerto 8001)
3. El demonio ejecuta `cupsdisable` o `cupsenable`

---

## Configuración en Linux

### 1. Verificar que CUPS está instalado y activo

```bash
# Verificar que CUPS está corriendo
systemctl status cups

# Si no está instalado
sudo apt install cups        # Debian/Ubuntu
sudo dnf install cups        # Fedora/RHEL
```

### 2. Obtener el nombre exacto de la impresora

```bash
lpstat -p -d
```

Ejemplo de salida:
```
printer Canon_TS8300_series is idle.
printer Brother_4520_1 is idle.
system default destination: Canon_TS8300_series
```

El nombre que necesitas es el que aparece después de `printer` (ej: `Canon_TS8300_series`).

### 3. Configurar docker-compose.yml

Edita las variables de entorno del servicio `demonio-python`:

```yaml
demonio-python:
  environment:
    - PRINTER_1=Canon_TS8300_series     # Etiquetas rollo 1
    - PRINTER_2=Canon_TS8300_series     # Etiquetas rollo 2
    - PRINTER_TICKET=Canon_TS8300_series # Tickets
```

### 4. Compartir CUPS del host con Docker

El `docker-compose.yml` ya incluye el volumen necesario:

```yaml
volumes:
  - ./demonio:/app
  - /var/run/cups:/var/run/cups
```

Esto permite al contenedor comunicarse con el servidor CUPS del host.

### 5. Permisos (si es necesario)

Si obtienes errores de permisos al imprimir:

```bash
# Añadir tu usuario al grupo lpadmin
sudo usermod -aG lpadmin $USER

# Reiniciar sesión y verificar
groups
```

### 6. Arrancar

```bash
docker compose build
docker compose up -d
```

### 7. Probar impresión

```bash
# Probar que CUPS funciona desde el contenedor
docker compose exec demonio-python lp -d Canon_TS8300_series /dev/null
```

---

## Configuración en macOS

### 1. CUPS viene preinstalado

macOS incluye CUPS de serie. No necesitas instalar nada.

### 2. Obtener el nombre exacto de la impresora

```bash
lpstat -p -d
```

### 3. Configurar docker-compose.yml

Igual que en Linux, edita las variables `PRINTER_1`, `PRINTER_2`, `PRINTER_TICKET`.

### 4. Compartir CUPS con Docker

En macOS, el socket de CUPS está en `/private/var/run/cups`. Modifica el volumen:

```yaml
volumes:
  - ./demonio:/app
  - /private/var/run/cups:/var/run/cups
```

### 5. Arrancar

```bash
docker compose build
docker compose up -d
```

---

## Configuración en Windows

En Windows **no existe CUPS**. El sistema de impresión es diferente y Docker Desktop corre en una VM Linux que no tiene acceso directo a las impresoras USB del host.

Hay dos opciones:

### Opción A: Ejecutar el demonio fuera de Docker (recomendado)

Esta es la opción más sencilla para Windows. Ejecutas el demonio Python directamente en tu máquina.

#### Paso 1: Instalar Python 2.7

Descarga desde: https://www.python.org/downloads/release/python-2718/

Verifica:
```powershell
python --version
# Python 2.7.18
```

#### Paso 2: Instalar dependencias

```powershell
pip install SimpleWebSocketServer reportlab
```

#### Paso 3: Obtener el nombre de la impresora

```powershell
Get-Printer | Format-Table Name, DriverName, PortName
```

Ejemplo de salida:
```
Name                    DriverName                    PortName
----                    ----------                    --------
Canon TS8300 series     Canon TS8300 series           USB001
Brother QL-820NWB       Brother QL-820NWB             USB002
```

#### Paso 4: Modificar servidor-ws.py para Windows

El comando `lp` no existe en Windows. Necesitas reemplazar las llamadas a `lp` por el comando de Windows. Crea un archivo `imprimir_windows.py` en la carpeta `demonio`:

```python
import os
import sys

# Nombre de la impresora (tal como aparece en Get-Printer)
PRINTER_1 = os.environ.get('PRINTER_1', 'Canon TS8300 series')
PRINTER_2 = os.environ.get('PRINTER_2', 'Canon TS8300 series')
PRINTER_TICKET = os.environ.get('PRINTER_TICKET', 'Canon TS8300 series')

def imprimir_pdf_windows(printer_name, pdf_path):
    """Imprime un PDF en Windows usando SumatraPDF (silencioso)"""
    # Opción 1: Con SumatraPDF (recomendado, instalar desde https://www.sumatrapdfreader.com)
    cmd = 'SumatraPDF.exe -print-to "%s" -silent "%s"' % (printer_name, pdf_path)
    
    # Opción 2: Con Adobe Reader (si está instalado)
    # cmd = '"C:\\Program Files\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe" /t "%s" "%s"' % (pdf_path, printer_name)
    
    os.system(cmd)
```

#### Paso 5: Configurar variables de entorno

```powershell
# PowerShell - configurar antes de ejecutar
$env:PRINTER_1 = "Canon TS8300 series"
$env:PRINTER_2 = "Canon TS8300 series"
$env:PRINTER_TICKET = "Canon TS8300 series"
```

#### Paso 6: Ejecutar el demonio

```powershell
cd demonio
python servidor-ws.py
```

#### Paso 7: Ejecutar el resto con Docker

La webapp y MongoDB siguen en Docker. Comenta el servicio `demonio-python` en `docker-compose.yml`:

```yaml
# demonio-python:
#   build: ...
#   (comentar todo el bloque)
```

Y arranca solo Meteor + Mongo:
```powershell
docker compose up -d meteor-app mongo
```

---

### Opción B: Usar Docker + impresora compartida por red

Si la impresora está compartida en la red (no solo USB), puedes configurar CUPS dentro del contenedor para enviar a la impresora via IPP/SMB.

#### Paso 1: Compartir la impresora en Windows

1. Ve a **Configuración** → **Dispositivos** → **Impresoras y escáneres**
2. Selecciona tu impresora → **Administrar** → **Propiedades de impresora**
3. Pestaña **Compartir** → Marca "Compartir esta impresora"
4. Anota el nombre compartido (ej: `Canon_TS8300`)

#### Paso 2: Configurar CUPS en el contenedor

Añade al `Dockerfile.demonio`:

```dockerfile
# Configurar CUPS client para apuntar al host Windows
RUN echo "ServerName host.docker.internal" > /etc/cups/client.conf
```

#### Paso 3: Configurar la impresora en CUPS del contenedor

```bash
docker compose exec demonio-python bash

# Dentro del contenedor, añadir impresora del host Windows
lpadmin -p Canon_TS8300 -E -v smb://host.docker.internal/Canon_TS8300 -m raw
```

Esta opción es más compleja y puede requerir ajustes según tu red.

---

## Variables de entorno

| Variable | Servicio | Descripción | Ejemplo |
|----------|----------|-------------|---------|
| `PRINTER_1` | demonio-python | Impresora de etiquetas rollo 1 | `Canon_TS8300_series` |
| `PRINTER_2` | demonio-python | Impresora de etiquetas rollo 2 | `Canon_TS8300_series` |
| `PRINTER_TICKET` | demonio-python | Impresora de tickets | `Canon_TS8300_series` |
| `PRINTER_NAME` | meteor-app | (legacy) Para pausar/reanudar | `Canon_TS8300_series` |
| `DEMONIO_HOST` | meteor-app | Host del demonio para HTTP | `demonio-python` |
| `DEMONIO_PORT` | meteor-app | Puerto HTTP del demonio | `8001` |

Las variables se configuran en la sección `environment` del `docker-compose.yml`.

---

## Verificar que funciona

### 1. Comprobar conectividad WebSocket

Abre la consola del navegador (F12) en `http://localhost:9090/kiosko`. Si ves:
```
WebSocket connection to 'ws://localhost:8000/' failed
```
El demonio no está corriendo o el puerto no está accesible.

### 2. Comprobar que el demonio recibe mensajes

```bash
docker compose logs -f demonio-python
```

Al pulsar el carrito, deberías ver:
```
Handling Message
Parsing message
...
Printing
Printing ticket
Printing stamps
```

### 3. Comprobar que los PDFs se generan

```bash
docker compose exec demonio-python ls -la /app/*.pdf
```

Los PDFs con más de 2000 bytes son los que tienen contenido real.

### 4. Probar impresión directamente

```bash
# Desde el contenedor
docker compose exec demonio-python lp -d Canon_TS8300_series /app/ticket.pdf

# Desde el host (Linux/macOS)
lp -d Canon_TS8300_series demonio/ticket.pdf
```

### 5. Test automatizado

```bash
docker compose run --rm -v "$(pwd)/test:/test" demonio-python python -u /test/test_pdf_generation.py
```

---

## Solución de problemas

### "No se genera ningún PDF"

| Causa probable | Diagnóstico | Solución |
|----------------|-------------|----------|
| WebSocket no conecta | Consola del navegador muestra error WS | Verificar que demonio-python está arrancado y puerto 8000 expuesto |
| Mensaje con campos incorrectos | Logs del demonio muestran `IndexError` | Verificar que kiosko.js envía 31 campos separados por `*¿?*` |
| Error en report.py | Logs del demonio muestran el traceback | Verificar que las fuentes (.ttf) e imágenes (.png) existen en `/app` |

### "cupsdisable: not found"

Los comandos CUPS se ejecutan dentro del contenedor `demonio-python`. Verificar:
```bash
docker compose exec demonio-python which cupsdisable
# Debería devolver: /usr/sbin/cupsdisable
```

### "server-error-service-unavailable"

CUPS client no puede conectar con el servidor CUPS. Verificar el volumen:
```bash
# Linux
ls /var/run/cups/cups.sock

# macOS  
ls /private/var/run/cups/cups.sock
```

Si no existe, CUPS no está corriendo en el host:
```bash
# Linux
sudo systemctl start cups

# macOS (ya corre por defecto)
cupsctl
```

### "lp: No such file or directory"

El PDF no se generó o tiene un path incorrecto. El demonio trabaja desde `/app`, verificar que los PDFs se crean ahí.

### La impresora no imprime nada pero no da error

1. Verificar que el nombre de la impresora es exacto (distingue mayúsculas):
   ```bash
   lpstat -p
   ```
2. Verificar que la impresora no está pausada:
   ```bash
   lpstat -p Canon_TS8300_series
   # Si dice "disabled", reanudar con:
   cupsenable Canon_TS8300_series
   ```
3. Verificar la cola de impresión:
   ```bash
   lpq -P Canon_TS8300_series
   ```

### En Windows: "python: command not found"

Asegúrate de que Python está en el PATH. Durante la instalación de Python 2.7, marca la opción "Add Python to PATH". O ejecuta directamente:
```powershell
C:\Python27\python.exe servidor-ws.py
```
## Guia definitiva windows

Pasos para Windows con la Canon TS8300 WiFi
1. Encontrar la IP de tu impresora
En tu Canon TS8300, ve a:

Configuración → Configuración de LAN → LAN inalámbrica → Confirmar config. red
Ahí verás la IP asignada (por ejemplo 192.168.1.50)
Alternativa: desde cmd de Windows:

ping Canon_TS8300.local
2. Configurar el proyecto
Crea un archivo .env en la raíz del proyecto:

PRINTER_BACKEND=ipp
PRINTER_1=192.168.1.50
PRINTER_2=192.168.1.50
PRINTER_TICKET=192.168.1.50
(Reemplaza 192.168.1.50 con la IP real de tu Canon)

3. Preparar Docker para Windows
En Windows, el volumen /var/run/cups no existe. Renombra o copia el override:

copy docker-compose.override.windows.yml docker-compose.override.yml
4. Arrancar
docker compose up -d
5. Verificar conexión con la impresora
/#/ Ver estado del servicio
curl http://localhost:8001/status

/#/ Descubrir impresoras en la red
curl http://localhost:8001/printers
6. Probar impresión
Accede a http://localhost:9090, ve al Kiosko, selecciona cantidades y pulsa el carrito. El sistema:

Genera los PDFs (sellos + ticket)
Los envía directamente a la Canon via IPP (protocolo HTTP al puerto 631 de la impresora)