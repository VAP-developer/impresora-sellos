#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Feature: stack-migration, Property 1: Round-trip del mensaje WebSocket

Property-based test que verifica la propiedad fundamental del parseador de mensajes:
  serializar(parsear(msg)) == msg

Para cualquier mensaje válido del protocolo WebSocket (31 campos separados por *¿?*),
parsear el mensaje en un objeto OrdenImpresion y luego serializar ese objeto de vuelta
a string DEBE producir un mensaje idéntico al original.

Framework: Hypothesis (Python)
Mínimo: 100 iteraciones
Valida: Requisitos 3.3, 4.1, 4.6, 7.5, 8.4
"""

import sys

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st

# Añadir el directorio demonio al path para importar los módulos
sys.path.insert(0, "demonio")

from servidor_ws_nuevo import ParseadorMensaje, OrdenImpresion

# ─────────────────────────────────────────────
# Estrategias de generación de datos
# ─────────────────────────────────────────────

SEPARADOR = "*¿?*"


def campo_texto_libre():
    """
    Genera strings arbitrarios que NO contienen el separador del protocolo.
    Si un campo contuviera el separador, el parseo split() produciría más de 31 campos,
    lo cual es un mensaje inválido por definición del protocolo.
    """
    return st.text(
        alphabet=st.characters(
            # Excluir caracteres nulos que podrían causar problemas en transporte
            blacklist_categories=("Cs",),  # Excluir surrogates
        ),
        min_size=0,
        max_size=50,
    ).filter(lambda s: SEPARADOR not in s)


def campo_id():
    """Genera IDs numéricos como strings (campos 0 y 1)."""
    return st.integers(min_value=0, max_value=99999).map(str)


def campo_fecha():
    """Genera fechas en formato texto arbitrario (los campos de fecha son strings)."""
    return campo_texto_libre()


def campo_cantidades():
    """
    Genera el campo 13: 12 valores enteros separados por espacio.
    Representa cantidades de sellos por tarifa y etiqueta.
    """
    return st.lists(
        st.integers(min_value=0, max_value=999),
        min_size=12,
        max_size=12,
    ).map(lambda nums: " ".join(str(n) for n in nums))


def campo_precios():
    """
    Genera el campo 14: 4 valores decimales separados por espacio.
    Representa precios de las tarifas A, A2, B, C.
    """
    return st.lists(
        st.floats(min_value=0.0, max_value=100.0, allow_nan=False, allow_infinity=False).map(
            lambda f: f"{f:.2f}"
        ),
        min_size=4,
        max_size=4,
    ).map(lambda prices: " ".join(prices))


def campo_modo():
    """Genera modos de operación típicos."""
    return campo_texto_libre()


def mensaje_ws_valido():
    """
    Genera un mensaje WebSocket válido con 31 campos separados por *¿?*.

    Los campos generados respetan la semántica del protocolo:
    - Campos 0,1: IDs numéricos
    - Campo 13: 12 cantidades separadas por espacio
    - Campo 14: 4 precios separados por espacio
    - Resto: texto libre (sin contener el separador)
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
# Property-based tests
# ─────────────────────────────────────────────

parseador = ParseadorMensaje()


@given(msg=mensaje_ws_valido())
@settings(max_examples=200)
def test_roundtrip_serializar_parsear(msg: str):
    """
    Property 1: Round-trip del mensaje WebSocket (parseo ↔ serialización).

    Para cualquier mensaje válido de 31 campos:
      serializar(parsear(msg)) == msg

    Esto garantiza que no se pierde ni transforma información en el ciclo
    de parseo y serialización, que es crítico para la integridad del protocolo
    durante toda la migración (Requisito 8.4).
    """
    orden = parseador.parsear(msg)
    resultado = parseador.serializar(orden)
    assert resultado == msg


@given(msg=mensaje_ws_valido())
@settings(max_examples=200)
def test_parsear_produce_31_campos(msg: str):
    """
    Verifica que el parseo de un mensaje válido siempre produce un objeto
    OrdenImpresion con exactamente 31 campos asignados correctamente.
    """
    orden = parseador.parsear(msg)

    # Verificar que todos los campos del dataclass están presentes y son strings
    from dataclasses import fields as dc_fields
    all_fields = dc_fields(orden)
    assert len(all_fields) == 31

    for field in all_fields:
        value = getattr(orden, field.name)
        assert isinstance(value, str), f"Campo {field.name} no es string: {type(value)}"


@given(msg=mensaje_ws_valido())
@settings(max_examples=200)
def test_parsear_preserva_campos_individuales(msg: str):
    """
    Verifica que cada campo individual del mensaje se asigna correctamente
    al atributo correspondiente del objeto OrdenImpresion.
    """
    campos = msg.split(SEPARADOR)
    orden = parseador.parsear(msg)

    assert orden.id_cliente == campos[0]
    assert orden.id_producto == campos[1]
    assert orden.fecha_sello == campos[2]
    assert orden.evento_sello == campos[3]
    assert orden.fecha_ticket == campos[4]
    assert orden.modo_ticket == campos[5]
    assert orden.modelo1_ticket == campos[6]
    assert orden.modelo2_ticket == campos[7]
    assert orden.modo_maquina == campos[8]
    assert orden.nombre_maquina == campos[9]
    assert orden.mes_maquina == campos[10]
    assert orden.pais_maquina == campos[11]
    assert orden.year_maquina == campos[12]
    assert orden.cantidades == campos[13]
    assert orden.precios == campos[14]
    assert orden.empresa == campos[15]
    assert orden.cif == campos[16]
    assert orden.cp == campos[17]
    assert orden.l1 == campos[18]
    assert orden.l2 == campos[19]
    assert orden.l3 == campos[20]
    assert orden.feria == campos[21]
    assert orden.lugar == campos[22]
    assert orden.T1especial == campos[23]
    assert orden.T2especial == campos[24]
    assert orden.T3especial == campos[25]
    assert orden.TEmod1 == campos[26]
    assert orden.TEmod2 == campos[27]
    assert orden.ImprimeCopiaTicket == campos[28]
    assert orden.ImprimeMasterTicket == campos[29]
    assert orden.modo_ticket_copia == campos[30]


@given(msg=mensaje_ws_valido())
@settings(max_examples=100)
def test_doble_roundtrip(msg: str):
    """
    Verifica que la propiedad round-trip se mantiene tras múltiples ciclos:
      parsear(serializar(parsear(msg))) == parsear(msg)

    Esto asegura estabilidad idempotente del protocolo.
    """
    orden1 = parseador.parsear(msg)
    msg2 = parseador.serializar(orden1)
    orden2 = parseador.parsear(msg2)
    msg3 = parseador.serializar(orden2)

    assert msg == msg2
    assert msg2 == msg3


# ─────────────────────────────────────────────
# Tests con mensajes inválidos (complementarios)
# ─────────────────────────────────────────────


@given(
    num_campos=st.integers(min_value=0, max_value=100).filter(lambda n: n != 31)
)
@settings(max_examples=100)
def test_parsear_rechaza_num_campos_incorrecto(num_campos: int):
    """
    Verifica que el parseador rechaza mensajes con un número de campos
    distinto de 31, lanzando ValueError.
    """
    campos = ["campo"] * num_campos
    mensaje_invalido = SEPARADOR.join(campos)

    with pytest.raises(ValueError, match="se esperaban 31 campos"):
        parseador.parsear(mensaje_invalido)
