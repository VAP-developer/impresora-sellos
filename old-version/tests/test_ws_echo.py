#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Feature: stack-migration, Property 3: Integridad del echo WebSocket

Property-based test que verifica la propiedad de echo del servidor WebSocket:
  Para cualquier mensaje válido del protocolo enviado al ServidorWebSocket,
  la respuesta recibida por el cliente SHALL ser idéntica al mensaje enviado.

El test inicia una instancia real del ServidorWebSocket (con la lógica de
impresión mockeada) en un thread separado, se conecta como cliente WebSocket,
envía mensajes generados aleatoriamente y verifica que la respuesta es
byte-por-byte idéntica.

Framework: Hypothesis (Python)
Mínimo: 100 iteraciones
Valida: Requisitos 4.3
"""

import asyncio
import sys
import threading
import time
from unittest.mock import patch

import pytest
from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st
import websockets

# Añadir el directorio demonio al path para importar los módulos
sys.path.insert(0, "demonio")

from servidor_ws_nuevo import ServidorWebSocket

# ─────────────────────────────────────────────
# Estrategias de generación de datos
# (misma lógica que test_ws_roundtrip.py)
# ─────────────────────────────────────────────

SEPARADOR = "*¿?*"


def campo_texto_libre():
    """
    Genera strings arbitrarios que NO contienen el separador del protocolo.
    """
    return st.text(
        alphabet=st.characters(
            blacklist_categories=("Cs",),  # Excluir surrogates
        ),
        min_size=0,
        max_size=50,
    ).filter(lambda s: SEPARADOR not in s)


def campo_id():
    """Genera IDs numéricos como strings (campos 0 y 1)."""
    return st.integers(min_value=0, max_value=99999).map(str)


def campo_cantidades():
    """
    Genera el campo 13: 12 valores enteros separados por espacio.
    """
    return st.lists(
        st.integers(min_value=0, max_value=999),
        min_size=12,
        max_size=12,
    ).map(lambda nums: " ".join(str(n) for n in nums))


def campo_precios():
    """
    Genera el campo 14: 4 valores decimales separados por espacio.
    """
    return st.lists(
        st.floats(min_value=0.0, max_value=100.0, allow_nan=False, allow_infinity=False).map(
            lambda f: f"{f:.2f}"
        ),
        min_size=4,
        max_size=4,
    ).map(lambda prices: " ".join(prices))


def mensaje_ws_valido():
    """
    Genera un mensaje WebSocket válido con 31 campos separados por *¿?*.
    """
    return st.tuples(
        campo_id(),                # 0:  id_cliente
        campo_id(),                # 1:  id_producto
        campo_texto_libre(),       # 2:  fecha_sello
        campo_texto_libre(),       # 3:  evento_sello
        campo_texto_libre(),       # 4:  fecha_ticket
        campo_texto_libre(),       # 5:  modo_ticket
        campo_texto_libre(),       # 6:  modelo1_ticket
        campo_texto_libre(),       # 7:  modelo2_ticket
        campo_texto_libre(),       # 8:  modo_maquina
        campo_texto_libre(),       # 9:  nombre_maquina
        campo_texto_libre(),       # 10: mes_maquina
        campo_texto_libre(),       # 11: pais_maquina
        campo_texto_libre(),       # 12: year_maquina
        campo_cantidades(),        # 13: cantidades (12 valores)
        campo_precios(),           # 14: precios (4 valores)
        campo_texto_libre(),       # 15: empresa
        campo_texto_libre(),       # 16: cif
        campo_texto_libre(),       # 17: cp
        campo_texto_libre(),       # 18: l1
        campo_texto_libre(),       # 19: l2
        campo_texto_libre(),       # 20: l3
        campo_texto_libre(),       # 21: feria
        campo_texto_libre(),       # 22: lugar
        campo_texto_libre(),       # 23: T1especial
        campo_texto_libre(),       # 24: T2especial
        campo_texto_libre(),       # 25: T3especial
        campo_texto_libre(),       # 26: TEmod1
        campo_texto_libre(),       # 27: TEmod2
        campo_texto_libre(),       # 28: ImprimeCopiaTicket
        campo_texto_libre(),       # 29: ImprimeMasterTicket
        campo_texto_libre(),       # 30: modo_ticket_copia
    ).map(lambda campos: SEPARADOR.join(campos))


# ─────────────────────────────────────────────
# Infraestructura del servidor de prueba
# ─────────────────────────────────────────────

class ServidorEchoTest:
    """
    Wrapper que ejecuta el ServidorWebSocket en un thread separado
    con la impresión mockeada, para poder testear el echo desde
    el thread principal (donde corre Hypothesis).
    """

    def __init__(self):
        self.port = None
        self._loop = None
        self._thread = None
        self._server = None
        self._ready = threading.Event()

    def start(self):
        """Inicia el servidor en un thread de background."""
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        # Esperar a que el servidor esté listo (max 10 seg)
        if not self._ready.wait(timeout=10):
            raise RuntimeError("El servidor WebSocket no arrancó a tiempo")

    def _run(self):
        """Corre el event loop del servidor en el thread de background."""
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self._loop.run_until_complete(self._start_serving())

    async def _start_serving(self):
        """Inicia el servidor WebSocket y señaliza que está listo."""
        servidor = ServidorWebSocket(host="127.0.0.1", port=0)

        # Crear el handler adaptado a la versión de websockets instalada
        # websockets 10.x pasa (websocket, path), 14.x pasa solo (websocket)
        async def handler(websocket, path=None):
            await servidor.manejar_conexion(websocket)

        self._server = await websockets.serve(handler, "127.0.0.1", 0)
        self.port = self._server.sockets[0].getsockname()[1]
        self._ready.set()

        # Mantener el servidor corriendo indefinidamente
        await asyncio.Future()

    def stop(self):
        """Detiene el servidor."""
        if self._server and self._loop:
            self._loop.call_soon_threadsafe(self._server.close)

    @property
    def url(self):
        return f"ws://127.0.0.1:{self.port}"


# Instancia global del servidor para todos los tests del módulo
_servidor_test = None


def get_servidor():
    """Obtiene (o crea) la instancia del servidor de prueba."""
    global _servidor_test
    if _servidor_test is None:
        _servidor_test = ServidorEchoTest()
        # Mockear la función de impresión para que sea instantánea
        patcher = patch("servidor_ws_nuevo._ejecutar_impresion", return_value=None)
        patcher.start()
        _servidor_test.start()
    return _servidor_test


# ─────────────────────────────────────────────
# Helper para enviar/recibir WebSocket desde thread sincrónico
# ─────────────────────────────────────────────

def enviar_y_recibir(url: str, mensaje: str) -> str:
    """
    Envía un mensaje WebSocket y devuelve la respuesta.
    Ejecutable desde código sincrónico (Hypothesis).
    """
    async def _inner():
        async with websockets.connect(url) as ws:
            await ws.send(mensaje)
            respuesta = await asyncio.wait_for(ws.recv(), timeout=10.0)
            return respuesta

    # Crear un nuevo event loop para esta operación
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_inner())
    finally:
        loop.close()


# ─────────────────────────────────────────────
# Property-based tests
# ─────────────────────────────────────────────


@given(msg=mensaje_ws_valido())
@settings(max_examples=200)
def test_echo_integridad_mensaje_valido(msg: str):
    """
    Property 3: Integridad del echo WebSocket.

    Para cualquier mensaje válido del protocolo enviado al ServidorWebSocket,
    la respuesta recibida por el cliente es idéntica al mensaje enviado.

    Este test:
    1. Conecta un cliente WebSocket al servidor real
    2. Envía un mensaje generado aleatoriamente (31 campos válidos)
    3. Verifica que la respuesta es byte-por-byte idéntica al enviado
    """
    servidor = get_servidor()
    respuesta = enviar_y_recibir(servidor.url, msg)
    assert respuesta == msg, (
        f"Echo no coincide.\n"
        f"  Enviado  ({len(msg)} chars): {msg[:200]}...\n"
        f"  Recibido ({len(respuesta)} chars): {respuesta[:200]}..."
    )


@given(msg=mensaje_ws_valido())
@settings(max_examples=200)
def test_echo_longitud_preservada(msg: str):
    """
    Verifica que el echo preserva la longitud exacta del mensaje.
    Complementa Property 3 con una verificación explícita de longitud.
    """
    servidor = get_servidor()
    respuesta = enviar_y_recibir(servidor.url, msg)
    assert len(respuesta) == len(msg), (
        f"Longitud del echo difiere: enviado={len(msg)}, recibido={len(respuesta)}"
    )


@given(msg=mensaje_ws_valido())
@settings(max_examples=100)
def test_echo_multiples_mensajes_misma_conexion(msg: str):
    """
    Verifica que el echo funciona correctamente cuando se envían múltiples
    mensajes por la misma conexión WebSocket (no se mezclan respuestas).
    """
    servidor = get_servidor()

    async def enviar_multiples():
        async with websockets.connect(servidor.url) as ws:
            # Enviar el mismo mensaje 3 veces y verificar cada respuesta
            for _ in range(3):
                await ws.send(msg)
                respuesta = await asyncio.wait_for(ws.recv(), timeout=10.0)
                assert respuesta == msg, (
                    f"Echo no coincide en envío múltiple.\n"
                    f"  Enviado: {msg[:100]}...\n"
                    f"  Recibido: {respuesta[:100]}..."
                )

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(enviar_multiples())
    finally:
        loop.close()

