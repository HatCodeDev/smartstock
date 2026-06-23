"""
WebSocket Connection Manager
Gestiona las conexiones activas y propaga mensajes a todos los clientes.
"""

import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Gestiona las conexiones WebSocket activas y hace broadcast de eventos."""

    def __init__(self) -> None:
        self._active: list[WebSocket] = []
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def connect(self, websocket: WebSocket) -> None:
        """Acepta y registra una nueva conexión."""
        await websocket.accept()
        async with self._lock:
            self._active.append(websocket)
        logger.info("WS client connected. Total: %d", len(self._active))

    async def disconnect(self, websocket: WebSocket) -> None:
        """Elimina una conexión del registro."""
        async with self._lock:
            try:
                self._active.remove(websocket)
            except ValueError:
                pass
        logger.info("WS client disconnected. Total: %d", len(self._active))

    # ------------------------------------------------------------------
    # Broadcast
    # ------------------------------------------------------------------

    async def broadcast(self, data: dict[str, Any]) -> None:
        """Envía un payload JSON a todos los clientes conectados.

        Los clientes que fallen son desconectados silenciosamente.
        """
        message = json.dumps(data, ensure_ascii=False)
        dead: list[WebSocket] = []

        async with self._lock:
            targets = list(self._active)

        for ws in targets:
            try:
                await ws.send_text(message)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Broadcast failed for client: %s", exc)
                dead.append(ws)

        # Limpieza fuera del loop principal
        for ws in dead:
            await self.disconnect(ws)

    # ------------------------------------------------------------------
    # Utilidades
    # ------------------------------------------------------------------

    @property
    def count(self) -> int:
        """Número de clientes activos."""
        return len(self._active)


# Instancia singleton — importar desde aquí en toda la app
manager = ConnectionManager()
