#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Feature: stack-migration, Property 4: Resiliencia ante mensajes inválidos

Property-based test que verifica la resiliencia del servidor WebSocket:
  Para cualquier string que NO cumpla el formato del protocolo (número incorrecto
  de campos, campos vacíos, tipos incompatibles, strings totalmente arbitrarios),
  el ServidorWebSocket SHALL continuar operativo y aceptando nuevas conexiones
  después de procesar el mensaje inválido.

El test inicia una instancia real del ServidorWebSocket (con la lógica de
impresión mockeada) en un thread separado, envía mensajes inválidos generados
aleatoriamente, y después verifica que el servidor sigue respondiendo a
mensajes válidos correctamente.

Framework: Hypothesis (Python)
Mínimo: 100 iteraciones
Valida: Requisitos 4.5
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
# Constantes del protocolo
# ─────────────────────────────────────────────

SEPARADOR = "*¿?*"
NUM_CAMPOS_VALIDO = 31

# Mensaje válido de referencia para verificar que el servidor sigue operativo
MENSAJE_VALIDO_REFERENCIA = SEPARADOR.join([
    "1",                    # 0:  id_cliente
    "2",                    # 1:  id_producto
    "2026-01-15",           # 2:  fecha_sello
    "Navidad",              # 3:  evento_sello
    "2026-01-15",           # 4:  fecha_ticket
    "normal",               # 5:  modo_ticket
    "modelo1",              # 6:  modelo1_ticket
    "modelo2",              # 7:  modelo2_ticket
    "auto",                 # 8:  modo_maquina
    "MQ001",                # 9:  nombre_maquina
    "01",                   # 10: mes_maquina
    "ES",                   # 11: pais_maquina
    "2026",                 # 12: year_maquina
    "1 0 0 0 0 0 0 0 0 0 0 0",  # 13: cantidades
    "1.50 2.00 2.50 3.00",  # 14: precios
    "Correos SA",           # 15: empresa
    "A12345678",            # 16: cif
    "28001",                # 17: cp
    "Calle Mayor 1",        # 18: l1
    "Madrid",               # 19: l2
    "España",               # 20: l3
    "FILATELIA",            # 21: feria
    "Madrid",               # 22: lugar
    "",                     # 23: T1especial
    "",                     # 24: T2especial
    "",                     # 25: T3especial
    "",                     # 26: TEmod1
    "",                     # 27: TEmod2
    "SI",                   # 28: ImprimeCopiaTicket
    "SI",                   # 29: ImprimeMasterTicket
    "normal",               # 30: modo_ticket_copia
])


# ─────────────────────────────────────────────
# Estrategias de generación de mensajes inválidos
# ─────────────────────────────────────────────

def mensaje_campos_faltantes():
    """
    Genera mensajes con menos de 31 campos (entre 0 y 30 campos).
    """
    return st.integers(min_value=0, max_value=30).flatmap(
        lambda n: st.lists(
            st.text(
                alphabet=st.characters(blacklist_categories=("Cs",)),
                min_size=0,
                max_size=30,
            ).filter(lambda s: SEPARADOR not in s),
            min_size=n,
            max_size=n,
        ).map(lambda campos: SEPARADOR.join(campos))
    )


def mensaje_campos_extra():
    """
    Genera mensajes con más de 31 campos (entre 32 y 60 campos).
    """
    return st.integers(min_value=32, max_value=60).flatmap(
        lambda n: st.lists(
            st.text(
                alphabet=st.characters(blacklist_categories=("Cs",)),
                min_size=0,
                max_size=30,
            ).filter(lambda s: SEPARADOR not in s),
            min_size=n,
            max_size=n,
        ).map(lambda campos: SEPARADOR.join(campos))
    )


def string_totalmente_arbitrario():
    """
    Genera strings completamente arbitrarios que probablemente no cumplen
    el protocolo (pueden no tener separadores, o tener un número incorrecto).
    """
    return st.text(
        alphabet=st.characters(blacklist_categories=("Cs",)),
        min_size=0,
        max_size=500,
    ).filter(lambda s: s.count(SEPARADOR) != NUM_CAMPOS_VALIDO - 1)


def mensaje_vacio_o_whitespace():
    """Genera strings vacíos o solo con whitespace."""
    return st.from_regex(r"^\s{0,100}$", fullmatch=True)


def mensaje_binario_como_texto():
    """
    Genera strings con caracteres de control y bytes problemáticos
    (excluyendo surrogates que son inválidos en WebSocket).
    """
    return st.text(
        alphabet=st.characters(
            blacklist_categories=("Cs",),
            categories=("Cc", "Cf", "Co"),  # Control, format, private use
        ),
        min_size=1,
        max_size=200,
    )


def mensaje_invalido():
    """
    Estrategia combinada que genera mensajes inválidos de varios tipos:
    - Strings totalmente arbitrarios
    - Mensajes con campos faltantes (0-30 campos)
    - Mensajes con campos extra (32-60 campos)
    - Strings vacíos o solo whitespace
    - Strings con caracteres de control
    """
    return st.one_of(
        string_totalmente_arbitrario(),
        mensaje_campos_faltantes(),
        mensaje_campos_extra(),
        mensaje_vacio_o_whitespace(),
        mensaje_binario_como_texto(),
    )


# ─────────────────────────────────────────────
# Infraestructura del servidor de prueba
# ─────────────────────────────────────────────

class ServidorResilienciaTest:
    """
    Wrapper que ejecuta el ServidorWebSocket en un thread separado
    con la impresión mockeada, para testear resiliencia ante mensajes
    inválidos desde el thread principal (donde corre Hypothesis).
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
        _servidor_test = ServidorResilienciaTest()
        patcher = patch("servidor_ws_nuevo._ejecutar_impresion", return_value=None)
        patcher.start()
        _servidor_test.start()
    return _servidor_test


# ─────────────────────────────────────────────
# Helpers de conexión WebSocket
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

    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_inner())
    finally:
        loop.close()


def verificar_servidor_operativo(url: str) -> bool:
    """
    Verifica que el servidor sigue aceptando conexiones y respondiendo
    correctamente a mensajes válidos. Devuelve True si el servidor
    responde con echo correcto.
    """
    async def _inner():
        async with websockets.connect(url) as ws:
            await ws.send(MENSAJE_VALIDO_REFERENCIA)
            respuesta = await asyncio.wait_for(ws.recv(), timeout=10.0)
            return respuesta == MENSAJE_VALIDO_REFERENCIA

    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_inner())
    finally:
        loop.close()


def enviar_sin_esperar_respuesta(url: str, mensaje: str) -> None:
    """
    Envía un mensaje y recibe la respuesta (el servidor siempre responde
    con echo, incluso para mensajes inválidos según el diseño).
    """
    async def _inner():
        async with websockets.connect(url) as ws:
            await ws.send(mensaje)
            # El servidor siempre devuelve echo del mensaje original
            await asyncio.wait_for(ws.recv(), timeout=10.0)

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_inner())
    finally:
        loop.close()


# ─────────────────────────────────────────────
# Property-based tests
# ─────────────────────────────────────────────


@given(msg_invalido=mensaje_invalido())
@settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
def test_servidor_acepta_conexiones_tras_mensaje_invalido(msg_invalido: str):
    """
    Property 4: Resiliencia ante mensajes inválidos.

    Para cualquier string que NO cumpla el formato del protocolo:
    1. El servidor recibe el mensaje inválido sin crashear
    2. El servidor sigue aceptando nuevas conexiones
    3. El servidor responde correctamente a mensajes válidos posteriores

    Este test:
    1. Envía un mensaje inválido generado aleatoriamente
    2. Abre una NUEVA conexión y envía un mensaje válido de referencia
    3. Verifica que la respuesta al mensaje válido es correcta (echo)
    """
    servidor = get_servidor()

    # Paso 1: Enviar mensaje inválido (el servidor no debe crashear)
    enviar_sin_esperar_respuesta(servidor.url, msg_invalido)

    # Paso 2: Verificar que el servidor sigue operativo con una nueva conexión
    assert verificar_servidor_operativo(servidor.url), (
        f"El servidor dejó de responder después de recibir mensaje inválido.\n"
        f"  Mensaje inválido ({len(msg_invalido)} chars): {repr(msg_invalido[:200])}"
    )


@given(msg_invalido=string_totalmente_arbitrario())
@settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
def test_servidor_responde_echo_a_mensajes_invalidos(msg_invalido: str):
    """
    Verifica que el servidor devuelve echo incluso para mensajes inválidos.

    Según el diseño (procesar_mensaje), el servidor siempre responde con
    el mensaje original como echo, independientemente de si el parseo falló.
    Esto garantiza que el cliente siempre recibe confirmación de recepción.
    """
    servidor = get_servidor()

    respuesta = enviar_y_recibir(servidor.url, msg_invalido)
    assert respuesta == msg_invalido, (
        f"Echo incorrecto para mensaje inválido.\n"
        f"  Enviado  ({len(msg_invalido)} chars): {repr(msg_invalido[:200])}\n"
        f"  Recibido ({len(respuesta)} chars): {repr(respuesta[:200])}"
    )


@given(msg_invalido=mensaje_campos_faltantes())
@settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
def test_resiliencia_campos_faltantes(msg_invalido: str):
    """
    Verifica resiliencia específicamente ante mensajes con menos de 31 campos.

    Mensajes con 0 a 30 campos son una fuente común de errores cuando
    el protocolo se corrompe parcialmente (truncamiento, desconexión, etc).
    """
    servidor = get_servidor()

    # El servidor no debe crashear ante campos faltantes
    enviar_sin_esperar_respuesta(servidor.url, msg_invalido)

    # Debe seguir operativo
    assert verificar_servidor_operativo(servidor.url), (
        f"El servidor falló tras mensaje con campos faltantes.\n"
        f"  Num campos: {msg_invalido.count(SEPARADOR) + 1}\n"
        f"  Mensaje: {repr(msg_invalido[:200])}"
    )


@given(msg_invalido=mensaje_campos_extra())
@settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
def test_resiliencia_campos_extra(msg_invalido: str):
    """
    Verifica resiliencia ante mensajes con más de 31 campos.

    Mensajes con campos extra podrían indicar una versión diferente del
    protocolo o corrupción de datos.
    """
    servidor = get_servidor()

    enviar_sin_esperar_respuesta(servidor.url, msg_invalido)

    assert verificar_servidor_operativo(servidor.url), (
        f"El servidor falló tras mensaje con campos extra.\n"
        f"  Num campos: {msg_invalido.count(SEPARADOR) + 1}\n"
        f"  Mensaje: {repr(msg_invalido[:200])}"
    )


@given(msg_invalido=mensaje_vacio_o_whitespace())
@settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
def test_resiliencia_mensajes_vacios(msg_invalido: str):
    """
    Verifica resiliencia ante mensajes vacíos o solo con whitespace.

    Un cliente podría enviar un mensaje vacío por error de programación
    o como heartbeat malformado.
    """
    servidor = get_servidor()

    enviar_sin_esperar_respuesta(servidor.url, msg_invalido)

    assert verificar_servidor_operativo(servidor.url), (
        f"El servidor falló tras mensaje vacío/whitespace.\n"
        f"  Mensaje: {repr(msg_invalido)}"
    )


@given(
    mensajes_invalidos=st.lists(
        mensaje_invalido(),
        min_size=3,
        max_size=10,
    )
)
@settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
def test_resiliencia_rafaga_mensajes_invalidos(mensajes_invalidos: list):
    """
    Verifica que el servidor sobrevive a una ráfaga de múltiples mensajes
    inválidos consecutivos en la misma conexión, y sigue operativo para
    nuevas conexiones después.
    """
    servidor = get_servidor()

    async def enviar_rafaga():
        async with websockets.connect(servidor.url) as ws:
            for msg in mensajes_invalidos:
                await ws.send(msg)
                # El servidor siempre responde con echo
                await asyncio.wait_for(ws.recv(), timeout=10.0)

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(enviar_rafaga())
    finally:
        loop.close()

    # Después de la ráfaga, el servidor debe seguir operativo
    assert verificar_servidor_operativo(servidor.url), (
        f"El servidor falló tras ráfaga de {len(mensajes_invalidos)} mensajes inválidos."
    )
