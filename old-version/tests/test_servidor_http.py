#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tests para el servidor HTTP de comandos de impresora (aiohttp).

Verifica:
  - Endpoint POST /pausar ejecuta cupsdisable y devuelve JSON correcto
  - Endpoint POST /reanudar ejecuta cupsenable y devuelve JSON correcto
  - Manejo de errores cuando el comando falla
  - Rutas no definidas devuelven 404
  - Comandos se ejecutan con asyncio.create_subprocess_exec()

Requisitos: 4.4, 4.5
"""

import asyncio
import sys
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

# Añadir el directorio demonio al path para importar los módulos
sys.path.insert(0, "demonio")

from servidor_http import ServidorHTTP


@pytest.fixture
def servidor():
    """Crea una instancia del servidor HTTP para testing."""
    return ServidorHTTP(host="127.0.0.1", port=0)


# ─────────────────────────────────────────────
# Tests de lógica de negocio (pausar/reanudar)
# ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_pausar_exito(servidor):
    """POST /pausar ejecuta cupsdisable y devuelve status ok."""
    mock_process = AsyncMock()
    mock_process.returncode = 0
    mock_process.communicate = AsyncMock(return_value=(b"", b""))

    with patch("asyncio.create_subprocess_exec", return_value=mock_process) as mock_exec:
        result = await servidor.pausar()

        assert result["status"] == "ok"
        assert "pausada" in result["message"].lower()
        mock_exec.assert_called_once()
        # Verificar que se llamó con cupsdisable
        call_args = mock_exec.call_args[0]
        assert call_args[0] == "cupsdisable"
        assert "-r" in call_args
        assert "Pausada por el usuario" in call_args


@pytest.mark.asyncio
async def test_reanudar_exito(servidor):
    """POST /reanudar ejecuta cupsenable y devuelve status ok."""
    mock_process = AsyncMock()
    mock_process.returncode = 0
    mock_process.communicate = AsyncMock(return_value=(b"", b""))

    with patch("asyncio.create_subprocess_exec", return_value=mock_process) as mock_exec:
        result = await servidor.reanudar()

        assert result["status"] == "ok"
        assert "reanudada" in result["message"].lower()
        mock_exec.assert_called_once()
        # Verificar que se llamó con cupsenable
        call_args = mock_exec.call_args[0]
        assert call_args[0] == "cupsenable"


@pytest.mark.asyncio
async def test_pausar_error_cups(servidor):
    """Si cupsdisable falla, devuelve status error con detalle."""
    mock_process = AsyncMock()
    mock_process.returncode = 1
    mock_process.communicate = AsyncMock(return_value=(b"", b"printer not found"))

    with patch("asyncio.create_subprocess_exec", return_value=mock_process):
        result = await servidor.pausar()

        assert result["status"] == "error"
        assert "printer not found" in result["message"]


@pytest.mark.asyncio
async def test_reanudar_error_cups(servidor):
    """Si cupsenable falla, devuelve status error con detalle."""
    mock_process = AsyncMock()
    mock_process.returncode = 1
    mock_process.communicate = AsyncMock(return_value=(b"", b"no such printer"))

    with patch("asyncio.create_subprocess_exec", return_value=mock_process):
        result = await servidor.reanudar()

        assert result["status"] == "error"
        assert "no such printer" in result["message"]


@pytest.mark.asyncio
async def test_pausar_timeout(servidor):
    """Si el comando excede el timeout, devuelve error."""

    async def slow_communicate():
        await asyncio.sleep(20)
        return (b"", b"")

    mock_process = AsyncMock()
    mock_process.communicate = slow_communicate

    with patch("asyncio.create_subprocess_exec", return_value=mock_process):
        result = await servidor.pausar()

        assert result["status"] == "error"
        assert "timeout" in result["message"].lower()


@pytest.mark.asyncio
async def test_pausar_comando_no_encontrado(servidor):
    """Si cupsdisable no existe en el sistema, devuelve error."""
    with patch(
        "asyncio.create_subprocess_exec",
        side_effect=FileNotFoundError("cupsdisable not found"),
    ):
        result = await servidor.pausar()

        assert result["status"] == "error"
        assert "no encontrado" in result["message"].lower()


@pytest.mark.asyncio
async def test_reanudar_comando_no_encontrado(servidor):
    """Si cupsenable no existe en el sistema, devuelve error."""
    with patch(
        "asyncio.create_subprocess_exec",
        side_effect=FileNotFoundError("cupsenable not found"),
    ):
        result = await servidor.reanudar()

        assert result["status"] == "error"
        assert "no encontrado" in result["message"].lower()


# ─────────────────────────────────────────────
# Tests de integración HTTP (con aiohttp test client)
# ─────────────────────────────────────────────


@pytest.fixture
def aiohttp_app(servidor):
    """Devuelve la aplicación aiohttp para testing con el test client."""
    return servidor._app


@pytest.mark.asyncio
async def test_http_pausar_endpoint(aiohttp_app):
    """El endpoint POST /pausar devuelve JSON con status 200 en éxito."""
    from aiohttp.test_utils import TestClient, TestServer

    mock_process = AsyncMock()
    mock_process.returncode = 0
    mock_process.communicate = AsyncMock(return_value=(b"", b""))

    async with TestClient(TestServer(aiohttp_app)) as client:
        with patch("asyncio.create_subprocess_exec", return_value=mock_process):
            resp = await client.post("/pausar")
            assert resp.status == 200
            data = await resp.json()
            assert data["status"] == "ok"
            assert "pausada" in data["message"].lower()


@pytest.mark.asyncio
async def test_http_reanudar_endpoint(aiohttp_app):
    """El endpoint POST /reanudar devuelve JSON con status 200 en éxito."""
    from aiohttp.test_utils import TestClient, TestServer

    mock_process = AsyncMock()
    mock_process.returncode = 0
    mock_process.communicate = AsyncMock(return_value=(b"", b""))

    async with TestClient(TestServer(aiohttp_app)) as client:
        with patch("asyncio.create_subprocess_exec", return_value=mock_process):
            resp = await client.post("/reanudar")
            assert resp.status == 200
            data = await resp.json()
            assert data["status"] == "ok"
            assert "reanudada" in data["message"].lower()


@pytest.mark.asyncio
async def test_http_pausar_error_devuelve_500(aiohttp_app):
    """El endpoint POST /pausar devuelve 500 si el comando falla."""
    from aiohttp.test_utils import TestClient, TestServer

    mock_process = AsyncMock()
    mock_process.returncode = 1
    mock_process.communicate = AsyncMock(return_value=(b"", b"cups error"))

    async with TestClient(TestServer(aiohttp_app)) as client:
        with patch("asyncio.create_subprocess_exec", return_value=mock_process):
            resp = await client.post("/pausar")
            assert resp.status == 500
            data = await resp.json()
            assert data["status"] == "error"


@pytest.mark.asyncio
async def test_http_ruta_no_definida(aiohttp_app):
    """Una ruta no definida devuelve 404."""
    from aiohttp.test_utils import TestClient, TestServer

    async with TestClient(TestServer(aiohttp_app)) as client:
        resp = await client.post("/otra-ruta")
        assert resp.status == 404


@pytest.mark.asyncio
async def test_http_get_no_permitido(aiohttp_app):
    """GET en /pausar devuelve 405 (Method Not Allowed)."""
    from aiohttp.test_utils import TestClient, TestServer

    async with TestClient(TestServer(aiohttp_app)) as client:
        resp = await client.get("/pausar")
        assert resp.status == 405


# ─────────────────────────────────────────────
# Test de integración con el event loop
# ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_servidor_inicia_y_detiene():
    """El servidor se puede iniciar y detener sin errores."""
    servidor = ServidorHTTP(host="127.0.0.1", port=0)
    await servidor.iniciar()
    # Verificar que el runner está activo
    assert servidor._runner is not None
    await servidor.detener()
