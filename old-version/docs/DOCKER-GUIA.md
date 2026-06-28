# Guía rápida — Correos Webapp con Docker

## Índice

1. [Ejecutar en un ordenador nuevo](#1-ejecutar-en-un-ordenador-nuevo)
2. [Actualizar con cambios de la aplicación](#2-actualizar-con-cambios-de-la-aplicación)
3. [Configurar impresoras en Linux/macOS](#3-configurar-impresoras-en-linuxmacos)
4. [Configurar impresoras en Windows](#4-configurar-impresoras-en-windows)

---

## 1. Ejecutar en un ordenador nuevo

### Requisitos previos

- **Docker Desktop** instalado:
  - Windows/macOS: https://www.docker.com/products/docker-desktop
  - Linux: `sudo apt install docker.io docker-compose-plugin` (o equivalente)
- **Git** instalado
- **Puertos libres**: 9090, 8000, 8001, 27017
- **RAM**: mínimo 4 GB
- **Disco**: ~3 GB libres para las imágenes

### Pasos

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd impresora

# 2. Construir las imágenes (primera vez: 10-20 min)
docker compose build

# 3. Arrancar todo
docker compose up -d

# 4. Verificar que arranca correctamente
docker compose ps
docker compose logs -f meteor-app
```

Espera a que en los logs aparezca algo como:
```
ufs: temp directory created at /tmp/ufs
```

### 5. Abrir la aplicación

Abre en el navegador: **http://localhost:9090**

### 6. Parar la aplicación

```bash
docker compose down
```

### Resumen de comandos diarios

| Quiero... | Comando |
|-----------|---------|
| Arrancar | `docker compose up -d` |
| Parar | `docker compose down` |
| Ver logs | `docker compose logs -f` |
| Ver estado | `docker compose ps` |

---

## 2. Actualizar con cambios de la aplicación

Cuando hay cambios en el código (por ejemplo, alguien hizo un push con mejoras):

### Caso A: Cambios normales en el código

```bash
# 1. Descargar cambios del repositorio
git pull

# 2. Reconstruir solo la app (usa caché, rápido)
docker compose up -d --build meteor-app
```

Esto tarda entre 2-5 minutos porque reutiliza la caché de Docker.

### Caso B: Cambios en package.json (nuevas dependencias)

```bash
# 1. Descargar cambios
git pull

# 2. Rebuild sin caché (más lento, ~10-20 min)
docker compose build --no-cache meteor-app

# 3. Arrancar
docker compose up -d
```

### Caso C: Cambios en el demonio Python

El demonio usa un volumen montado, así que no necesita rebuild:

```bash
git pull
docker compose restart demonio-python
```

### Caso D: Cambios en docker-compose.yml o Dockerfiles

```bash
git pull
docker compose down
docker compose build
docker compose up -d
```

### Tip: Si el build tarda demasiado

Si `docker compose build` tarda más de 20 minutos, puedes construir la imagen en otro ordenador más potente y transferirla:

```bash
# En el ordenador potente
docker compose build meteor-app
docker save impresora-meteor-app:latest | gzip > meteor-app.tar.gz

# Copiar el archivo al otro ordenador (USB, scp, etc.)

# En el ordenador lento
docker load < meteor-app.tar.gz
docker compose up -d
```

---

## 3. Configurar impresoras en Linux/macOS

La impresión funciona a través de **CUPS** (sistema de impresión de Linux/macOS). Docker se comunica con el CUPS del ordenador host a través de un socket compartido.

### Paso 1: Verificar que CUPS funciona

```bash
# Linux
systemctl status cups
# Si no está instalado: sudo apt install cups

# macOS (viene preinstalado, no necesita nada)
lpstat -p
```

### Paso 2: Obtener el nombre exacto de tu impresora

```bash
lpstat -p -d
```

Ejemplo de salida:
```
printer Canon_TS8300_series is idle.
system default destination: Canon_TS8300_series
```

El nombre que necesitas es `Canon_TS8300_series` (exacto, con mayúsculas).

### Paso 3: Configurar el archivo .env

Crea un archivo `.env` en la raíz del proyecto:

```env
PRINTER_BACKEND=cups
PRINTER_1=Canon_TS8300_series
PRINTER_2=Canon_TS8300_series
PRINTER_TICKET=Canon_TS8300_series
```

Reemplaza `Canon_TS8300_series` por el nombre real de tu impresora.

### Paso 4: Verificar el volumen de CUPS

En `docker-compose.yml`, el servicio `demonio-python` ya tiene el volumen:

```yaml
volumes:
  - /var/run/cups:/var/run/cups:ro
```

En **macOS**, si no funciona, cambia a:
```yaml
volumes:
  - /private/var/run/cups:/var/run/cups:ro
```

### Paso 5: Arrancar y probar

```bash
docker compose up -d

# Probar impresión desde el contenedor
docker compose exec demonio-python lp -d Canon_TS8300_series /dev/null
```

### Paso 6: Verificar desde la app

1. Abre http://localhost:9090/kiosko
2. Selecciona cantidades y pulsa el carrito
3. Comprueba logs: `docker compose logs -f demonio-python`

Deberías ver:
```
Printing ticket
Printing stamps
```

### Solución de problemas (Linux/macOS)

| Problema | Solución |
|----------|----------|
| `lp: error - no default destination` | Ejecuta `lpstat -p` y verifica el nombre de la impresora |
| `Permission denied` | `sudo usermod -aG lpadmin $USER` y reinicia sesión |
| Socket no encontrado | Verifica que CUPS corre: `systemctl start cups` |
| Impresora pausada | `cupsenable Canon_TS8300_series` |

---

## 4. Configurar impresoras en Windows

En Windows **no existe CUPS**. La impresión se hace mediante **IPP** (Internet Printing Protocol) directamente a la IP de la impresora en la red WiFi/LAN.

### Paso 1: Obtener la IP de tu impresora

**Opción A** — Desde la impresora:
- En la Canon TS8300: Configuración → LAN inalámbrica → Confirmar configuración de red
- Anota la IP (ejemplo: `192.168.1.50`)

**Opción B** — Desde Windows:
```powershell
# Ver impresoras y sus puertos
Get-Printer | Format-Table Name, PortName

# O buscar por red
ping Canon_TS8300.local
```

### Paso 2: Crear archivo .env

Crea un archivo `.env` en la raíz del proyecto:

```env
PRINTER_BACKEND=ipp
PRINTER_1=192.168.1.50
PRINTER_2=192.168.1.50
PRINTER_TICKET=192.168.1.50
```

Reemplaza `192.168.1.50` con la IP real de tu impresora.

### Paso 3: Usar el override de Windows

El volumen `/var/run/cups` no existe en Windows. Copia el override:

```powershell
copy docker-compose.override.windows.yml docker-compose.override.yml
```

Si no existe ese archivo, crea `docker-compose.override.yml` con:

```yaml
services:
  demonio-python:
    volumes:
      - ./demonio:/app
    # Se elimina el volumen /var/run/cups que no existe en Windows
```

### Paso 4: Arrancar

```powershell
docker compose build
docker compose up -d
```

### Paso 5: Verificar conexión con la impresora

```powershell
# Ver estado del demonio
curl http://localhost:8001/status

# Descubrir impresoras en la red
curl http://localhost:8001/printers
```

### Paso 6: Probar impresión

1. Abre http://localhost:9090
2. Ve al Kiosko, selecciona cantidades y pulsa el carrito
3. La impresión va directamente a la impresora por IPP (puerto 631)

### Requisitos en Windows

- **Docker Desktop para Windows** con WSL2 habilitado
- La impresora debe estar **conectada a la misma red WiFi/LAN** que el ordenador
- La impresora debe soportar **IPP** (la mayoría de impresoras WiFi modernas lo soportan)

### Solución de problemas (Windows)

| Problema | Solución |
|----------|----------|
| No conecta con la impresora | Verifica que la IP es correcta: `ping 192.168.1.50` |
| Timeout de conexión | Verifica que el ordenador y la impresora están en la misma red |
| `PRINTER_BACKEND` no se aplica | Asegúrate de que el archivo `.env` está en la raíz del proyecto |
| Docker no encuentra el override | El archivo `docker-compose.override.yml` debe estar junto a `docker-compose.yml` |
| Volumen `/var/run/cups` error | Necesitas el override de Windows (paso 3) |

---

## Resumen visual

```
┌─────────────────────────────────────────────────────┐
│              Arquitectura del sistema                │
├─────────────────┬──────────────┬────────────────────┤
│   meteor-app    │    mongo     │  demonio-python    │
│   :9090         │   :27017     │   :8000 / :8001    │
│   (webapp)      │   (datos)    │   (impresión)      │
├─────────────────┴──────────────┴────────────────────┤
│                 docker compose                       │
└─────────────────────────────────────────────────────┘

Linux/macOS → CUPS (socket local)    → Impresora USB/red
Windows     → IPP  (protocolo red)   → Impresora WiFi
```
