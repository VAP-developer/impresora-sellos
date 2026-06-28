#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Servidor HTTP modernizado usando aiohttp (asyncio).

Proporciona endpoints para controlar la impresora:
  - POST /pausar     → Pausa la impresora
  - POST /reanudar   → Reanuda la impresora
  - GET  /printers   → Descubre impresoras disponibles en la red
  - GET  /status     → Estado del servicio y backend activo

Se integra con el event loop de asyncio del servidor WebSocket principal.
Puerto por defecto: 8001
"""

import asyncio
import logging
import os

from aiohttp import web

from printer_backend import get_printer_backend, PrinterBackend

logger = logging.getLogger(__name__)

# Nombre/URI de la impresora principal (configurable via variable de entorno)
PRINTER_1 = os.environ.get("PRINTER_1", "Canon_TS8300")


class ServidorHTTP:
    """
    Servidor HTTP asyncio para comandos de control de impresora.

    Usa el backend de impresión abstracto (CUPS o IPP) para las operaciones.
    """

    def __init__(self, host: str = "", port: int = 8001):
        self.host = host
        self.port = port
        self.backend: PrinterBackend = get_printer_backend()
        self._app = web.Application()
        self._app.router.add_post("/pausar", self._handle_pausar)
        self._app.router.add_post("/reanudar", self._handle_reanudar)
        self._app.router.add_get("/printers", self._handle_discover)
        self._app.router.add_get("/status", self._handle_status)
        self._runner: web.AppRunner | None = None

    async def iniciar(self) -> None:
        """Inicia el servidor HTTP en el puerto configurado."""
        self._runner = web.AppRunner(self._app)
        await self._runner.setup()
        site = web.TCPSite(self._runner, self.host or "0.0.0.0", self.port)
        await site.start()
        logger.info(
            "Servidor HTTP de comandos escuchando en %s:%d",
            self.host or "0.0.0.0",
            self.port,
        )

    async def detener(self) -> None:
        """Detiene el servidor HTTP y libera recursos."""
        if self._runner:
            await self._runner.cleanup()
            logger.info("Servidor HTTP detenido")

    async def pausar(self) -> dict:
        """Pausa la impresora usando el backend configurado."""
        return await self.backend.pause_printer(PRINTER_1)

    async def reanudar(self) -> dict:
        """Reanuda la impresora usando el backend configurado."""
        return await self.backend.resume_printer(PRINTER_1)

    async def _handle_pausar(self, request: web.Request) -> web.Response:
        """Handler HTTP para POST /pausar."""
        result = await self.pausar()
        status_code = 200 if result["status"] == "ok" else 500
        return web.json_response(result, status=status_code)

    async def _handle_reanudar(self, request: web.Request) -> web.Response:
        """Handler HTTP para POST /reanudar."""
        result = await self.reanudar()
        status_code = 200 if result["status"] == "ok" else 500
        return web.json_response(result, status=status_code)

    async def _handle_discover(self, request: web.Request) -> web.Response:
        """
        Handler HTTP para GET /printers.
        Descubre impresoras disponibles en la red.

        Response: {"printers": [{"name": "...", "uri": "...", "model": "...", "status": "..."}]}
        """
        try:
            printers = await self.backend.discover_printers()
            return web.json_response({
                "status": "ok",
                "printers": printers,
                "backend": self.backend.__class__.__name__,
            })
        except Exception as e:
            logger.error("Error discovering printers: %s", e)
            return web.json_response(
                {"status": "error", "message": str(e), "printers": []},
                status=500,
            )

    async def _handle_status(self, request: web.Request) -> web.Response:
        """
        Handler HTTP para GET /status.
        Devuelve información del servicio.
        """
        return web.json_response({
            "status": "ok",
            "backend": self.backend.__class__.__name__,
            "printer_1": os.environ.get("PRINTER_1", "not configured"),
            "printer_2": os.environ.get("PRINTER_2", "not configured"),
            "printer_ticket": os.environ.get("PRINTER_TICKET", "not configured"),
        })
