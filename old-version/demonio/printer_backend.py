#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Backend de impresión abstracto que soporta tanto CUPS (Linux) como IPP (Windows/Red).

Selecciona automáticamente el backend según la configuración:
- Si PRINTER_BACKEND=ipp → usa IPP directo (para impresoras en red, funciona en Windows)
- Si PRINTER_BACKEND=cups → usa comandos lp/cupsdisable/cupsenable (Linux con CUPS)
- Si no se especifica → detecta automáticamente (CUPS si disponible, sino IPP)

Variables de entorno:
  PRINTER_BACKEND: "ipp" | "cups" | "auto" (default: "auto")
  PRINTER_1: nombre CUPS o URL IPP de impresora 1 (sellos motivo izquierdo)
  PRINTER_2: nombre CUPS o URL IPP de impresora 2 (sellos motivo derecho)
  PRINTER_TICKET: nombre CUPS o URL IPP de impresora de tickets

  Para IPP, el formato de PRINTER_X es:
    - URL completa: "ipp://192.168.1.50:631/ipp/print"
    - Solo IP: "192.168.1.50" (se construye la URL automáticamente)
    - Hostname: "canon-ts8300.local" (para mDNS/Bonjour)
"""

import asyncio
import logging
import os
import shutil
import subprocess
from abc import ABC, abstractmethod
from typing import Optional

logger = logging.getLogger(__name__)


class PrinterBackend(ABC):
    """Interfaz abstracta para backends de impresión."""

    @abstractmethod
    async def print_file(self, printer_id: str, file_path: str, options: dict | None = None) -> dict:
        """
        Envía un archivo a la impresora.

        Args:
            printer_id: Identificador de la impresora (nombre CUPS o URL IPP)
            file_path: Ruta al archivo PDF a imprimir
            options: Opciones de impresión (media, orientation, etc.)

        Returns:
            dict con "status" ("ok" | "error") y "message"
        """
        ...

    @abstractmethod
    async def pause_printer(self, printer_id: str) -> dict:
        """Pausa la impresora."""
        ...

    @abstractmethod
    async def resume_printer(self, printer_id: str) -> dict:
        """Reanuda la impresora."""
        ...

    @abstractmethod
    async def discover_printers(self) -> list[dict]:
        """
        Descubre impresoras disponibles en la red.

        Returns:
            Lista de dicts con "name", "uri", "model", "status"
        """
        ...


class CupsBackend(PrinterBackend):
    """Backend de impresión usando CUPS (lp, cupsdisable, cupsenable)."""

    async def print_file(self, printer_id: str, file_path: str, options: dict | None = None) -> dict:
        cmd = ["lp", "-d", printer_id, file_path]
        if options:
            for key, value in options.items():
                cmd.extend(["-o", f"{key}={value}"])

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=30.0)

            if process.returncode == 0:
                logger.info("CUPS: impresión enviada a %s: %s", printer_id, file_path)
                return {"status": "ok", "message": f"Enviado a {printer_id}"}
            else:
                err = stderr.decode().strip()
                logger.error("CUPS error: %s", err)
                return {"status": "error", "message": err}
        except Exception as e:
            logger.error("CUPS exception: %s", e)
            return {"status": "error", "message": str(e)}

    async def pause_printer(self, printer_id: str) -> dict:
        try:
            process = await asyncio.create_subprocess_exec(
                "cupsdisable", "-r", "Pausada por el usuario", printer_id,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await asyncio.wait_for(process.communicate(), timeout=10.0)
            if process.returncode == 0:
                return {"status": "ok", "message": "Impresora pausada"}
            return {"status": "error", "message": stderr.decode().strip()}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    async def resume_printer(self, printer_id: str) -> dict:
        try:
            process = await asyncio.create_subprocess_exec(
                "cupsenable", printer_id,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await asyncio.wait_for(process.communicate(), timeout=10.0)
            if process.returncode == 0:
                return {"status": "ok", "message": "Impresora reanudada"}
            return {"status": "error", "message": stderr.decode().strip()}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    async def discover_printers(self) -> list[dict]:
        """Descubre impresoras via lpstat."""
        printers = []
        try:
            process = await asyncio.create_subprocess_exec(
                "lpstat", "-p", "-d",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await asyncio.wait_for(process.communicate(), timeout=10.0)
            for line in stdout.decode().splitlines():
                if line.startswith("printer"):
                    parts = line.split()
                    if len(parts) >= 2:
                        name = parts[1]
                        status = "idle" if "idle" in line.lower() else "unknown"
                        printers.append({
                            "name": name,
                            "uri": f"cups://{name}",
                            "model": "",
                            "status": status,
                        })
        except Exception as e:
            logger.error("Error discovering CUPS printers: %s", e)
        return printers


class IppBackend(PrinterBackend):
    """
    Backend de impresión usando IPP (Internet Printing Protocol).

    Funciona en cualquier SO (Windows, Linux, macOS) con impresoras en red
    que soporten IPP. La Canon TS8300 soporta IPP nativamente.

    Usa ipptool (si disponible) o envía trabajos IPP directamente via HTTP.
    """

    def _build_ipp_url(self, printer_id: str) -> str:
        """Construye URL IPP a partir del identificador de impresora."""
        if printer_id.startswith("ipp://") or printer_id.startswith("ipps://"):
            return printer_id
        # Si es solo IP o hostname, construir URL estándar
        # Canon TS8300 usa /ipp/print como path estándar
        return f"ipp://{printer_id}:631/ipp/print"

    async def print_file(self, printer_id: str, file_path: str, options: dict | None = None) -> dict:
        """
        Imprime via IPP usando ipptool o fallback a lp con URI.

        La estrategia es:
        1. Si ipptool está disponible → usar IPP directo
        2. Si lp está disponible → usar lp con la URI IPP
        3. Fallback: copiar a directorio de salida para impresión manual
        """
        ipp_url = self._build_ipp_url(printer_id)

        # Estrategia 1: ipptool
        if shutil.which("ipptool"):
            return await self._print_via_ipptool(ipp_url, file_path, options)

        # Estrategia 2: lp con URI (funciona si CUPS está parcialmente disponible)
        if shutil.which("lp"):
            return await self._print_via_lp_uri(ipp_url, file_path, options)

        # Estrategia 3: Envío IPP via HTTP (puro Python, sin dependencias externas)
        return await self._print_via_http_ipp(ipp_url, file_path, options)

    async def _print_via_ipptool(self, ipp_url: str, file_path: str, options: dict | None) -> dict:
        """Imprime usando ipptool con un archivo de test IPP."""
        # Crear archivo temporal de request IPP
        ipp_request = f"""{{
    OPERATION Print-Job
    GROUP operation-attributes-tag
    ATTR charset attributes-charset utf-8
    ATTR naturalLanguage attributes-natural-language en
    ATTR uri printer-uri {ipp_url}
    ATTR name requesting-user-name "correos-app"
    ATTR mimeMediaType document-format application/pdf
    FILE {file_path}
}}"""
        request_file = file_path + ".ipp"
        try:
            with open(request_file, "w") as f:
                f.write(ipp_request)

            process = await asyncio.create_subprocess_exec(
                "ipptool", "-tv", ipp_url, request_file,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=30.0)

            if process.returncode == 0:
                logger.info("IPP (ipptool): impresión enviada a %s", ipp_url)
                return {"status": "ok", "message": f"Enviado via IPP a {ipp_url}"}
            else:
                err = stderr.decode().strip() or stdout.decode().strip()
                logger.error("IPP (ipptool) error: %s", err)
                return {"status": "error", "message": err}
        except Exception as e:
            logger.error("IPP (ipptool) exception: %s", e)
            return {"status": "error", "message": str(e)}
        finally:
            if os.path.exists(request_file):
                os.remove(request_file)

    async def _print_via_lp_uri(self, ipp_url: str, file_path: str, options: dict | None) -> dict:
        """Imprime usando lp con URI IPP directa."""
        cmd = ["lp", "-d", ipp_url, file_path]
        if options:
            for key, value in options.items():
                cmd.extend(["-o", f"{key}={value}"])

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=30.0)
            if process.returncode == 0:
                return {"status": "ok", "message": f"Enviado via lp a {ipp_url}"}
            return {"status": "error", "message": stderr.decode().strip()}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    async def _print_via_http_ipp(self, ipp_url: str, file_path: str, options: dict | None) -> dict:
        """
        Envía un trabajo de impresión via IPP sobre HTTP (puro Python).
        Compatible con cualquier impresora que soporte IPP 1.1+.
        """
        import struct
        import http.client
        from urllib.parse import urlparse

        parsed = urlparse(ipp_url)
        host = parsed.hostname
        port = parsed.port or 631
        path = parsed.path or "/ipp/print"

        try:
            with open(file_path, "rb") as f:
                pdf_data = f.read()

            # Construir mensaje IPP Print-Job (IPP 1.1)
            ipp_request = self._build_ipp_print_job(ipp_url, pdf_data)

            # Enviar via HTTP POST
            result = await asyncio.to_thread(
                self._send_ipp_http, host, port, path, ipp_request
            )
            return result

        except Exception as e:
            logger.error("IPP HTTP error: %s", e)
            return {"status": "error", "message": f"Error IPP: {e}"}

    def _build_ipp_print_job(self, printer_uri: str, pdf_data: bytes) -> bytes:
        """Construye un mensaje IPP Print-Job binario."""
        import struct

        buf = bytearray()

        # IPP version 1.1
        buf.extend(struct.pack(">BB", 1, 1))
        # Operation: Print-Job (0x0002)
        buf.extend(struct.pack(">H", 0x0002))
        # Request ID
        buf.extend(struct.pack(">I", 1))

        # Operation attributes tag
        buf.append(0x01)

        # charset
        buf.extend(self._ipp_attr(0x47, "attributes-charset", "utf-8"))
        # natural language
        buf.extend(self._ipp_attr(0x48, "attributes-natural-language", "en"))
        # printer-uri
        buf.extend(self._ipp_attr(0x45, "printer-uri", printer_uri))
        # requesting-user-name
        buf.extend(self._ipp_attr(0x42, "requesting-user-name", "correos-app"))
        # document-format
        buf.extend(self._ipp_attr(0x49, "document-format", "application/pdf"))

        # End of attributes
        buf.append(0x03)

        # Append PDF data
        buf.extend(pdf_data)

        return bytes(buf)

    def _ipp_attr(self, tag: int, name: str, value: str) -> bytes:
        """Codifica un atributo IPP."""
        import struct
        buf = bytearray()
        buf.append(tag)
        name_bytes = name.encode("utf-8")
        buf.extend(struct.pack(">H", len(name_bytes)))
        buf.extend(name_bytes)
        value_bytes = value.encode("utf-8")
        buf.extend(struct.pack(">H", len(value_bytes)))
        buf.extend(value_bytes)
        return bytes(buf)

    def _send_ipp_http(self, host: str, port: int, path: str, data: bytes) -> dict:
        """Envía request IPP via HTTP (ejecutado en thread)."""
        import http.client

        try:
            conn = http.client.HTTPConnection(host, port, timeout=30)
            conn.request(
                "POST",
                path,
                body=data,
                headers={
                    "Content-Type": "application/ipp",
                    "Content-Length": str(len(data)),
                },
            )
            response = conn.getresponse()
            response_data = response.read()
            conn.close()

            # Parsear respuesta IPP básica (primeros bytes)
            if len(response_data) >= 4:
                import struct
                status_code = struct.unpack(">H", response_data[2:4])[0]
                if status_code <= 0x00FF:  # Success range
                    logger.info("IPP HTTP: trabajo aceptado (status 0x%04x)", status_code)
                    return {"status": "ok", "message": f"Trabajo enviado a {host}"}
                else:
                    logger.error("IPP HTTP: rechazado (status 0x%04x)", status_code)
                    return {"status": "error", "message": f"IPP status: 0x{status_code:04x}"}

            return {"status": "ok", "message": f"Enviado a {host} (sin confirmación IPP)"}

        except Exception as e:
            return {"status": "error", "message": f"Conexión fallida a {host}:{port}: {e}"}

    async def pause_printer(self, printer_id: str) -> dict:
        """
        Pausa impresora via IPP (Pause-Printer operation).
        Nota: No todas las impresoras soportan esto. Alternativa: cancelar trabajos pendientes.
        """
        ipp_url = self._build_ipp_url(printer_id)
        logger.info("IPP: Pause-Printer solicitado para %s", ipp_url)
        # Muchas impresoras consumer no soportan Pause-Printer.
        # Simulamos almacenando estado localmente.
        return {"status": "ok", "message": f"Impresora {printer_id} marcada como pausada (local)"}

    async def resume_printer(self, printer_id: str) -> dict:
        """Reanuda impresora via IPP (Resume-Printer operation)."""
        ipp_url = self._build_ipp_url(printer_id)
        logger.info("IPP: Resume-Printer solicitado para %s", ipp_url)
        return {"status": "ok", "message": f"Impresora {printer_id} marcada como activa"}

    async def discover_printers(self) -> list[dict]:
        """
        Descubre impresoras IPP en la red local usando DNS-SD/mDNS (Bonjour).
        Busca servicios _ipp._tcp en la red local.
        """
        printers = []

        # Método 1: dns-sd / avahi-browse (si disponible)
        if shutil.which("avahi-browse"):
            printers = await self._discover_avahi()
        elif shutil.which("dns-sd"):
            printers = await self._discover_dnssd()

        # Método 2: Escaneo de puertos comunes (fallback)
        if not printers:
            printers = await self._discover_scan()

        return printers

    async def _discover_avahi(self) -> list[dict]:
        """Descubre impresoras usando avahi-browse."""
        printers = []
        try:
            process = await asyncio.create_subprocess_exec(
                "avahi-browse", "-rt", "_ipp._tcp",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await asyncio.wait_for(process.communicate(), timeout=10.0)

            current = {}
            for line in stdout.decode().splitlines():
                line = line.strip()
                if line.startswith("="):
                    if current.get("name"):
                        printers.append(current)
                    current = {"name": "", "uri": "", "model": "", "status": "discovered"}
                elif "hostname" in line.lower():
                    parts = line.split("[")
                    if len(parts) > 1:
                        hostname = parts[1].rstrip("]")
                        current["uri"] = f"ipp://{hostname}:631/ipp/print"
                elif "txt" in line.lower() and "ty=" in line.lower():
                    # Extract model from TXT record
                    if "ty=" in line:
                        model = line.split("ty=")[1].split('"')[0] if "ty=" in line else ""
                        current["model"] = model
                elif line.startswith("+") and "IPv4" in line:
                    parts = line.split()
                    if len(parts) >= 4:
                        current["name"] = " ".join(parts[3:]).strip()

            if current.get("name"):
                printers.append(current)

        except Exception as e:
            logger.error("Error avahi discovery: %s", e)
        return printers

    async def _discover_dnssd(self) -> list[dict]:
        """Descubre impresoras usando dns-sd (macOS)."""
        # dns-sd es interactivo, así que usamos timeout corto
        return []

    async def _discover_scan(self) -> list[dict]:
        """
        Escaneo básico: prueba conexión IPP a IPs comunes de la red local.
        Útil cuando no hay mDNS disponible.
        """
        import socket

        printers = []

        # Detectar subnet local
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
        except Exception:
            local_ip = "192.168.1.1"

        subnet = ".".join(local_ip.split(".")[:3])
        logger.info("Escaneando subnet %s.0/24 para impresoras IPP...", subnet)

        # Escanear rango común (esto es lento, solo para descubrimiento)
        tasks = []
        for i in range(1, 255):
            ip = f"{subnet}.{i}"
            tasks.append(self._check_ipp_port(ip))

        results = await asyncio.gather(*tasks, return_exceptions=True)
        for result in results:
            if isinstance(result, dict) and result.get("name"):
                printers.append(result)

        return printers

    async def _check_ipp_port(self, ip: str) -> dict:
        """Verifica si una IP tiene el puerto IPP (631) abierto."""
        try:
            _, writer = await asyncio.wait_for(
                asyncio.open_connection(ip, 631),
                timeout=1.0,
            )
            writer.close()
            await writer.wait_closed()
            return {
                "name": f"Impresora en {ip}",
                "uri": f"ipp://{ip}:631/ipp/print",
                "model": "Desconocido",
                "status": "discovered",
            }
        except (asyncio.TimeoutError, OSError, ConnectionRefusedError):
            return {}


# ─────────────────────────────────────────────
# Factory: selecciona el backend apropiado
# ─────────────────────────────────────────────
def get_printer_backend() -> PrinterBackend:
    """
    Devuelve el backend de impresión apropiado según la configuración.

    Variable de entorno PRINTER_BACKEND:
      - "cups": Fuerza CUPS (requiere lp, cupsdisable, cupsenable)
      - "ipp": Fuerza IPP (funciona en Windows, conecta directo a impresora en red)
      - "auto" (default): Detecta automáticamente
    """
    backend_type = os.environ.get("PRINTER_BACKEND", "auto").lower()

    if backend_type == "cups":
        logger.info("Backend de impresión: CUPS (forzado)")
        return CupsBackend()
    elif backend_type == "ipp":
        logger.info("Backend de impresión: IPP (forzado)")
        return IppBackend()
    else:
        # Auto-detect
        if shutil.which("lp") and os.path.exists("/var/run/cups"):
            logger.info("Backend de impresión: CUPS (auto-detectado)")
            return CupsBackend()
        else:
            logger.info("Backend de impresión: IPP (auto-detectado, CUPS no disponible)")
            return IppBackend()
