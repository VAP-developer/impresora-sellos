#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Servidor WebSocket modernizado usando la librería `websockets` (asyncio).

Reemplaza el servidor basado en SimpleWebSocketServer con una implementación
asyncio-nativa que no bloquea el event loop durante operaciones de impresión.

Puertos:
  - 8000: WebSocket (recepción de órdenes de impresión)
  - 8001: HTTP (comandos pausar/reanudar impresora) — ver tarea 1.5

Protocolo:
  Los mensajes WebSocket usan el separador *¿?* para delimitar 31 campos.
"""

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, fields

import websockets

from report import OUTPUT_DIR
from printer_backend import get_printer_backend, PrinterBackend

# ─────────────────────────────────────────────
# Configuración de logging
# ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# Nombres de impresoras (configurables via variables de entorno)
# ─────────────────────────────────────────────
PRINTER_1 = os.environ.get("PRINTER_1", "Brother_4520_1")
PRINTER_2 = os.environ.get("PRINTER_2", "Brother_4520_2")
PRINTER_TICKET = os.environ.get("PRINTER_TICKET", "Brother_4420_T")


# ─────────────────────────────────────────────
# Modelo de datos: OrdenImpresion
# ─────────────────────────────────────────────
@dataclass
class OrdenImpresion:
    """Representa un mensaje del protocolo WebSocket con 31 campos."""

    id_cliente: str           # Campo 0
    id_producto: str          # Campo 1
    fecha_sello: str          # Campo 2
    evento_sello: str         # Campo 3
    fecha_ticket: str         # Campo 4
    modo_ticket: str          # Campo 5
    modelo1_ticket: str       # Campo 6
    modelo2_ticket: str       # Campo 7
    modo_maquina: str         # Campo 8
    nombre_maquina: str       # Campo 9
    mes_maquina: str          # Campo 10
    pais_maquina: str         # Campo 11
    year_maquina: str         # Campo 12
    cantidades: str           # Campo 13 (12 valores separados por espacio)
    precios: str              # Campo 14 (4 valores separados por espacio)
    empresa: str              # Campo 15
    cif: str                  # Campo 16
    cp: str                   # Campo 17
    l1: str                   # Campo 18
    l2: str                   # Campo 19
    l3: str                   # Campo 20
    feria: str                # Campo 21
    lugar: str                # Campo 22
    T1especial: str           # Campo 23
    T2especial: str           # Campo 24
    T3especial: str           # Campo 25
    TEmod1: str               # Campo 26
    TEmod2: str               # Campo 27
    ImprimeCopiaTicket: str   # Campo 28
    ImprimeMasterTicket: str  # Campo 29
    modo_ticket_copia: str    # Campo 30


# ─────────────────────────────────────────────
# ParseadorMensaje: parseo ↔ serialización del protocolo *¿?*
# ─────────────────────────────────────────────
class ParseadorMensaje:
    """Parsea y serializa mensajes del protocolo *¿?* en objetos OrdenImpresion."""

    SEPARADOR = "*¿?*"
    NUM_CAMPOS = 31

    def parsear(self, mensaje: str) -> OrdenImpresion:
        """
        Parsea un mensaje de texto con 31 campos separados por *¿?*
        en un objeto OrdenImpresion.

        Raises:
            ValueError: Si el mensaje no tiene exactamente 31 campos.
        """
        campos = mensaje.split(self.SEPARADOR)
        if len(campos) != self.NUM_CAMPOS:
            raise ValueError(
                f"Mensaje inválido: se esperaban {self.NUM_CAMPOS} campos, "
                f"se recibieron {len(campos)}"
            )

        return OrdenImpresion(
            id_cliente=campos[0],
            id_producto=campos[1],
            fecha_sello=campos[2],
            evento_sello=campos[3],
            fecha_ticket=campos[4],
            modo_ticket=campos[5],
            modelo1_ticket=campos[6],
            modelo2_ticket=campos[7],
            modo_maquina=campos[8],
            nombre_maquina=campos[9],
            mes_maquina=campos[10],
            pais_maquina=campos[11],
            year_maquina=campos[12],
            cantidades=campos[13],
            precios=campos[14],
            empresa=campos[15],
            cif=campos[16],
            cp=campos[17],
            l1=campos[18],
            l2=campos[19],
            l3=campos[20],
            feria=campos[21],
            lugar=campos[22],
            T1especial=campos[23],
            T2especial=campos[24],
            T3especial=campos[25],
            TEmod1=campos[26],
            TEmod2=campos[27],
            ImprimeCopiaTicket=campos[28],
            ImprimeMasterTicket=campos[29],
            modo_ticket_copia=campos[30],
        )

    def serializar(self, orden: OrdenImpresion) -> str:
        """
        Serializa un objeto OrdenImpresion de vuelta a string con separador *¿?*.

        Garantiza la propiedad round-trip: serializar(parsear(msg)) == msg
        """
        valores = [getattr(orden, f.name) for f in fields(orden)]
        return self.SEPARADOR.join(valores)


# ─────────────────────────────────────────────
# Lógica de impresión (ejecutada en thread para no bloquear asyncio)
# ─────────────────────────────────────────────
def _ejecutar_impresion(orden: OrdenImpresion) -> None:
    """
    Ejecuta la generación de PDFs y el envío a impresoras.
    Esta función se ejecuta en un thread separado via asyncio.to_thread().
    """
    import report

    id_cliente = int(orden.id_cliente)
    id_producto = int(orden.id_producto)

    # Parsear cantidades y precios
    items = []
    ids_products = [
        "tarifaAS1", "tarifaA2S1", "tarifaBS1", "tarifaCS1", "tarifaAT1", "tarifa4T1",
        "tarifaAS2", "tarifaA2S2", "tarifaBS2", "tarifaCS2", "tarifaAT2", "tarifa4T2",
    ]
    quantities = orden.cantidades.split(" ")
    for index, item in enumerate(quantities):
        items.append({"idProducto": ids_products[index], "cantidad": int(item)})

    precios = [float(p) for p in orden.precios.split(" ")]

    # Generar PDFs
    report.afkarPrint(
        items, precios, id_cliente, id_producto,
        orden.fecha_sello, orden.evento_sello,
        orden.fecha_ticket, orden.modo_ticket, orden.modo_ticket_copia,
        orden.modelo1_ticket, orden.modelo2_ticket,
        orden.modo_maquina, orden.nombre_maquina, orden.mes_maquina,
        orden.pais_maquina, orden.year_maquina,
        orden.feria, orden.lugar,
        orden.empresa, orden.cif, orden.cp,
        orden.l1, orden.l2, orden.l3,
        orden.T1especial, orden.T2especial, orden.T3especial,
        orden.TEmod1, orden.TEmod2,
        orden.ImprimeCopiaTicket, orden.ImprimeMasterTicket,
    )

    # Espera para que los PDFs se escriban completamente
    time.sleep(3)


async def _imprimir_async(backend: PrinterBackend) -> None:
    """Envía los PDFs generados a las impresoras usando el backend configurado."""
    def _pdf(name):
        """Devuelve la ruta completa a un PDF de salida."""
        return os.path.join(OUTPUT_DIR, name)

    losprod = 0

    # Opciones de impresión para sellos (etiquetas 55x25mm)
    stamp_options = {
        "media": "DC55x25",
        "orientation-requested": "6",
    }

    # --- Etiqueta 1 (PRINTER_1) ---
    stamp1_files = [
        "stamp_simple_1_a.pdf", "stamp_simple_1_a_overflow.pdf",
        "stamp_simple_1_a2.pdf", "stamp_simple_1_a2_overflow.pdf",
        "stamp_simple_1_b.pdf", "stamp_simple_1_b_overflow.pdf",
        "stamp_simple_1_c.pdf", "stamp_simple_1_c_overflow.pdf",
    ]
    for pdf_name in stamp1_files:
        pdf_path = _pdf(pdf_name)
        if os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 2000:
            if "overflow" not in pdf_name:
                losprod += 1
            await backend.print_file(PRINTER_1, pdf_path, stamp_options)

    # --- Etiqueta 2 (PRINTER_2) ---
    stamp2_files = [
        "stamp_simple_2_a.pdf", "stamp_simple_2_a_overflow.pdf",
        "stamp_simple_2_a2.pdf", "stamp_simple_2_a2_overflow.pdf",
        "stamp_simple_2_b.pdf", "stamp_simple_2_b_overflow.pdf",
        "stamp_simple_2_c.pdf", "stamp_simple_2_c_overflow.pdf",
    ]
    for pdf_name in stamp2_files:
        pdf_path = _pdf(pdf_name)
        if os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 2000:
            if "overflow" not in pdf_name:
                losprod += 1
            await backend.print_file(PRINTER_2, pdf_path, stamp_options)

    # --- Tiras especiales ---
    if os.path.exists(_pdf("stamp_tira_1_especial.pdf")) and os.path.getsize(_pdf("stamp_tira_1_especial.pdf")) > 2000:
        await backend.print_file(PRINTER_1, _pdf("stamp_tira_1_especial.pdf"), stamp_options)
    if os.path.exists(_pdf("stamp_tira_2_especial.pdf")) and os.path.getsize(_pdf("stamp_tira_2_especial.pdf")) > 2000:
        await backend.print_file(PRINTER_2, _pdf("stamp_tira_2_especial.pdf"), stamp_options)

    # --- Tiras normales ---
    if os.path.exists(_pdf("stamp_tira_1.pdf")) and os.path.getsize(_pdf("stamp_tira_1.pdf")) > 2000:
        losprod += 2
        await backend.print_file(PRINTER_1, _pdf("stamp_tira_1.pdf"), stamp_options)
    if os.path.exists(_pdf("stamp_tira_2.pdf")) and os.path.getsize(_pdf("stamp_tira_2.pdf")) > 2000:
        losprod += 2
        await backend.print_file(PRINTER_2, _pdf("stamp_tira_2.pdf"), stamp_options)

    # --- Ticket ---
    if os.path.exists(_pdf("ticket.pdf")) and os.path.getsize(_pdf("ticket.pdf")) > 2000:
        media_sizes = {
            1: "117", 2: "120", 3: "123", 4: "126", 5: "129",
            6: "132", 7: "135", 8: "138", 10: "142",
        }
        size = media_sizes.get(losprod, "148")
        ticket_options = {"media": f"Custom.78x{size}mm"}
        await backend.print_file(PRINTER_TICKET, _pdf("ticket.pdf"), ticket_options)

    if os.path.exists(_pdf("tickettira.pdf")) and os.path.getsize(_pdf("tickettira.pdf")) > 2000:
        ticket_options = {"media": "Custom.78x117mm"}
        await backend.print_file(PRINTER_TICKET, _pdf("tickettira.pdf"), ticket_options)

    logger.info("Impresión completada. Productos: %d", losprod)


# ─────────────────────────────────────────────
# ServidorWebSocket: servidor asyncio principal
# ─────────────────────────────────────────────
class ServidorWebSocket:
    """
    Servidor WebSocket asyncio que reemplaza SimpleWebSocketServer.

    Recibe mensajes del protocolo *¿?*, ejecuta la impresión en un thread
    separado y responde con echo del mensaje original.
    """

    def __init__(self, host: str = "", port: int = 8000):
        self.host = host
        self.port = port
        self.parseador = ParseadorMensaje()
        self.backend = get_printer_backend()

    async def iniciar(self) -> None:
        """Inicia el servidor WebSocket y escucha conexiones indefinidamente."""
        logger.info("Servidor WebSocket escuchando en %s:%d", self.host or "0.0.0.0", self.port)
        async with websockets.serve(self.manejar_conexion, self.host, self.port):
            await asyncio.Future()  # Ejecutar indefinidamente

    async def manejar_conexion(self, websocket) -> None:
        """Maneja una conexión WebSocket individual."""
        remote = websocket.remote_address
        logger.info("%s conectado", remote)
        try:
            async for mensaje in websocket:
                respuesta = await self.procesar_mensaje(mensaje)
                await websocket.send(respuesta)
        except websockets.exceptions.ConnectionClosed:
            logger.info("%s desconectado", remote)
        except Exception as e:
            logger.error("Error en conexión %s: %s", remote, e)
        finally:
            logger.info("%s cerrado", remote)

    async def procesar_mensaje(self, mensaje: str) -> str:
        """
        Procesa un mensaje WebSocket:
        1. Parsea el mensaje con el protocolo *¿?*
        2. Genera PDFs en un thread separado (no bloquea el event loop)
        3. Envía a impresoras via el backend configurado (IPP o CUPS)
        4. Responde con echo del mensaje original

        Si el mensaje es inválido, registra el error y devuelve el mensaje sin procesar.
        """
        logger.info("Mensaje recibido (%d caracteres)", len(mensaje))
        try:
            orden = self.parseador.parsear(mensaje)
            logger.info(
                "Orden parseada: cliente=%s, producto=%s",
                orden.id_cliente, orden.id_producto,
            )
            # Generar PDFs en thread separado para no bloquear el event loop
            await asyncio.to_thread(_ejecutar_impresion, orden)
            # Enviar a impresoras (async, usa el backend IPP o CUPS)
            await _imprimir_async(self.backend)
        except ValueError as e:
            logger.error("Mensaje inválido: %s", e)
        except Exception as e:
            logger.error("Error procesando mensaje: %s", e)

        # Echo: siempre devolver el mensaje original (Requisito 4.3)
        return mensaje


# ─────────────────────────────────────────────
# Punto de entrada
# ─────────────────────────────────────────────
async def main():
    """
    Punto de entrada principal del servidor.

    Inicia tanto el servidor WebSocket (puerto 8000) como el servidor HTTP
    de comandos de impresora (puerto 8001) en el mismo event loop de asyncio.
    """
    from servidor_http import ServidorHTTP

    servidor_ws = ServidorWebSocket(host="", port=8000)
    servidor_http = ServidorHTTP(host="", port=8001)

    # Iniciar el servidor HTTP (no bloquea, solo registra el site)
    await servidor_http.iniciar()

    # Iniciar el servidor WebSocket (bloquea indefinidamente)
    await servidor_ws.iniciar()


if __name__ == "__main__":
    asyncio.run(main())
