"""
WebSocket router — /ws/dashboard
Auth: JWT pasado como query param `token` (los browsers no envían headers en WS).
"""

import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt

from app.auth_utils import ALGORITHM
from app.config import settings
from app.websocket.manager import manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


def _decode_token(token: str | None) -> dict | None:
    """Decodifica y valida el JWT. Retorna el payload o None si es inválido."""
    if not token:
        return None
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
    except JWTError:
        return None


@router.websocket("/ws/dashboard")
async def dashboard_ws(
    websocket: WebSocket,
    token: str = Query(..., description="JWT de acceso"),
) -> None:
    """
    Canal WebSocket del dashboard.

    El cliente debe conectarse con:
        ws://host/ws/dashboard?token=<access_token>

    Eventos emitidos por el servidor (broadcast):
        { "event": "lectura_batch", "data": { ... } }
        { "event": "alerta", "data": { ... } }
        { "event": "ciclo_cerrado", "data": { ... } }
    """
    payload = _decode_token(token)
    if payload is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        logger.warning("WS connection rejected: invalid token")
        return

    username: str = payload.get("sub", "unknown")
    logger.info("WS dashboard connected: user=%s", username)

    await manager.connect(websocket)
    try:
        while True:
            # Mantener la conexión viva; ignoramos mensajes del cliente por ahora.
            await websocket.receive_text()
    except WebSocketDisconnect:
        logger.info("WS dashboard disconnected: user=%s", username)
    finally:
        await manager.disconnect(websocket)
