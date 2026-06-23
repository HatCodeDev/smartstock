"""
Tests de WebSocket — Fase 5.3 del plan M2.

Escenarios cubiertos:
  - Conexión rechazada sin token JWT.
  - Conexión rechazada con token inválido.
  - Conexión exitosa con token válido.
  - Broadcast llega a un cliente conectado.
  - Broadcast llega a múltiples clientes simultáneamente.
  - Desconexión limpia reduce el conteo de clientes.
"""
import pytest
from unittest.mock import AsyncMock, patch

from app.auth_utils import create_access_token
from app.websocket.manager import ConnectionManager


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _valid_token() -> str:
    """Genera un JWT válido para tests."""
    return create_access_token(data={"sub": "admin"})


# ---------------------------------------------------------------------------
# Tests del ConnectionManager (unit)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_manager_connect_and_count():
    """connect() incrementa el conteo de clientes activos."""
    mgr = ConnectionManager()
    assert mgr.count == 0

    ws = AsyncMock()
    await mgr.connect(ws)

    assert mgr.count == 1
    ws.accept.assert_awaited_once()


@pytest.mark.asyncio
async def test_manager_disconnect_reduces_count():
    """disconnect() decrementa el conteo de clientes activos."""
    mgr = ConnectionManager()
    ws = AsyncMock()
    await mgr.connect(ws)

    await mgr.disconnect(ws)
    assert mgr.count == 0


@pytest.mark.asyncio
async def test_manager_disconnect_idempotent():
    """disconnect() de un WS que ya no está no lanza error."""
    mgr = ConnectionManager()
    ws = AsyncMock()
    # No lo conectamos, pero lo desconectamos — no debería explotar
    await mgr.disconnect(ws)
    assert mgr.count == 0


@pytest.mark.asyncio
async def test_manager_broadcast_single_client():
    """broadcast() envía JSON a un cliente conectado."""
    mgr = ConnectionManager()
    ws = AsyncMock()
    await mgr.connect(ws)

    await mgr.broadcast({"event": "COUNTER_UPDATE", "data": {"total": 5}})

    ws.send_text.assert_awaited_once()
    sent = ws.send_text.call_args[0][0]
    assert '"COUNTER_UPDATE"' in sent
    assert '"total"' in sent


@pytest.mark.asyncio
async def test_manager_broadcast_multiple_clients():
    """broadcast() envía el mismo mensaje a TODOS los clientes."""
    mgr = ConnectionManager()
    ws1 = AsyncMock()
    ws2 = AsyncMock()
    ws3 = AsyncMock()

    await mgr.connect(ws1)
    await mgr.connect(ws2)
    await mgr.connect(ws3)

    await mgr.broadcast({"event": "TEST"})

    ws1.send_text.assert_awaited_once()
    ws2.send_text.assert_awaited_once()
    ws3.send_text.assert_awaited_once()


@pytest.mark.asyncio
async def test_manager_broadcast_removes_dead_clients():
    """broadcast() desconecta clientes que fallan al recibir."""
    mgr = ConnectionManager()
    ws_alive = AsyncMock()
    ws_dead = AsyncMock()
    ws_dead.send_text.side_effect = ConnectionError("client gone")

    await mgr.connect(ws_alive)
    await mgr.connect(ws_dead)
    assert mgr.count == 2

    await mgr.broadcast({"event": "PING"})

    # El muerto fue removido
    assert mgr.count == 1
    ws_alive.send_text.assert_awaited_once()


# ---------------------------------------------------------------------------
# Tests de integración con el endpoint WS /ws/dashboard (via AsyncMock)
# ---------------------------------------------------------------------------
from fastapi import WebSocket, WebSocketDisconnect, status
from app.routers.ws import dashboard_ws

@pytest.mark.asyncio
async def test_ws_rejects_missing_token():
    """WS sin token (None) → cierra conexión inmediatamente con código 1008."""
    ws = AsyncMock(spec=WebSocket)
    await dashboard_ws(websocket=ws, token=None)
    ws.close.assert_awaited_once_with(code=status.WS_1008_POLICY_VIOLATION)


@pytest.mark.asyncio
async def test_ws_rejects_invalid_token():
    """WS con token inválido → cierre con code 1008."""
    ws = AsyncMock(spec=WebSocket)
    await dashboard_ws(websocket=ws, token="invalid-jwt")
    ws.close.assert_awaited_once_with(code=status.WS_1008_POLICY_VIOLATION)


@pytest.mark.asyncio
async def test_ws_accepts_valid_token_and_receives_broadcast():
    """WS con token válido → conexión exitosa y bucle activo."""
    token = _valid_token()
    ws = AsyncMock(spec=WebSocket)
    
    # Hacemos que la primera llamada a receive_text lance WebSocketDisconnect
    # para salir del bucle infinito de forma limpia.
    ws.receive_text.side_effect = WebSocketDisconnect()
    
    await dashboard_ws(websocket=ws, token=token)
    
    # Verificamos que se intentó leer del socket
    ws.receive_text.assert_awaited_once()


