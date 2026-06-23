"""
Tests de MQTT (mock) — Fase 5.4 del plan M2.

Escenarios:
  - handle_batch: payload válido → processor + WS broadcast
  - handle_batch: JSON inválido → no crashea
  - handle_batch: campos faltantes → no crashea
  - handle_batch: skipped → sin broadcast
  - handle_batch: error → broadcast BATCH_ERROR
  - handle_batch: éxito → broadcast COUNTER_UPDATE con todos los campos
  - publish_command: arma JSON y publica al topic correcto
  - publish_set_mode: atajo correcto
"""
import json
import pytest
from unittest.mock import AsyncMock, patch

from app.mqtt.handlers import handle_batch
from app.services.batch_processor import BatchResult


def _payload_bytes(batch_id="batch-001", modo="SALIDA"):
    return json.dumps({
        "batch_id": batch_id, "device_id": "esp32-A", "modo": modo,
        "tags": [{"epc": "E200000123456789", "rssi": -60, "timestamp_esp32": 1000}],
        "timestamp": 1700000000,
    }).encode()


def _mock_session_maker():
    mock_session = AsyncMock()
    mock_ctx = AsyncMock()
    mock_ctx.__aenter__ = AsyncMock(return_value=mock_session)
    mock_ctx.__aexit__ = AsyncMock(return_value=None)
    return mock_ctx


@pytest.mark.asyncio
async def test_handle_batch_valid_payload():
    result = BatchResult(batch_id="batch-001", modo="SALIDA", eventos_creados=1)
    with patch("app.mqtt.handlers.batch_processor") as mp, \
         patch("app.mqtt.handlers.manager") as mm, \
         patch("app.mqtt.handlers.async_session_maker", return_value=_mock_session_maker()):
        mp.process = AsyncMock(return_value=result)
        mm.broadcast = AsyncMock()
        await handle_batch("smartstock/esp32-A/events", _payload_bytes())
        mp.process.assert_awaited_once()
        data = mm.broadcast.call_args[0][0]
        assert data["type"] == "COUNTER_UPDATE"
        assert data["payload"]["eventos_creados"] == 1


@pytest.mark.asyncio
async def test_handle_batch_invalid_json():
    with patch("app.mqtt.handlers.batch_processor") as mp:
        mp.process = AsyncMock()
        await handle_batch("t", b"not json{{{")
        mp.process.assert_not_awaited()


@pytest.mark.asyncio
async def test_handle_batch_missing_fields():
    with patch("app.mqtt.handlers.batch_processor") as mp:
        mp.process = AsyncMock()
        await handle_batch("t", json.dumps({"batch_id": "x"}).encode())
        mp.process.assert_not_awaited()


@pytest.mark.asyncio
async def test_handle_batch_skipped_no_broadcast():
    result = BatchResult(batch_id="dup", modo="SALIDA", skipped=True)
    with patch("app.mqtt.handlers.batch_processor") as mp, \
         patch("app.mqtt.handlers.manager") as mm, \
         patch("app.mqtt.handlers.async_session_maker", return_value=_mock_session_maker()):
        mp.process = AsyncMock(return_value=result)
        mm.broadcast = AsyncMock()
        await handle_batch("t", _payload_bytes(batch_id="dup"))
        mm.broadcast.assert_not_awaited()


@pytest.mark.asyncio
async def test_handle_batch_error_broadcasts_batch_error():
    result = BatchResult(batch_id="err", modo="SALIDA", error="CICLO_CERRADO")
    with patch("app.mqtt.handlers.batch_processor") as mp, \
         patch("app.mqtt.handlers.manager") as mm, \
         patch("app.mqtt.handlers.async_session_maker", return_value=_mock_session_maker()):
        mp.process = AsyncMock(return_value=result)
        mm.broadcast = AsyncMock()
        await handle_batch("t", _payload_bytes(batch_id="err"))
        data = mm.broadcast.call_args[0][0]
        assert data["type"] == "BATCH_ERROR"
        assert "CICLO_CERRADO" in data["payload"]["error"]


@pytest.mark.asyncio
async def test_handle_batch_counter_update_all_fields():
    result = BatchResult(
        batch_id="b", modo="RETORNO", eventos_creados=3,
        alertas_creadas=1, epcs_desconocidos=["DEAD"],
    )
    with patch("app.mqtt.handlers.batch_processor") as mp, \
         patch("app.mqtt.handlers.manager") as mm, \
         patch("app.mqtt.handlers.async_session_maker", return_value=_mock_session_maker()):
        mp.process = AsyncMock(return_value=result)
        mm.broadcast = AsyncMock()
        await handle_batch("t", _payload_bytes(batch_id="b"))
        d = mm.broadcast.call_args[0][0]["payload"]
        assert d["batch_id"] == "b"
        assert d["modo"] == "RETORNO"
        assert d["eventos_creados"] == 3
        assert d["alertas_creadas"] == 1
        assert d["epcs_desconocidos"] == ["DEAD"]


@pytest.mark.asyncio
async def test_publish_command_correct_topic_and_payload():
    from app.mqtt.publisher import publish_command
    captured = {}

    def fake_sync_publish(topic, message):
        captured["topic"] = topic
        captured["message"] = message

    with patch("app.mqtt.publisher._sync_publish", side_effect=fake_sync_publish):
        await publish_command("esp32-f1", "set_mode", {"mode": "REGISTRO"})
        assert captured["topic"] == "smartstock/esp32-f1/commands"
        body = json.loads(captured["message"])
        assert body["command"] == "set_mode"
        assert body["data"]["mode"] == "REGISTRO"


@pytest.mark.asyncio
async def test_publish_set_mode_shortcut():
    from app.mqtt.publisher import publish_set_mode
    with patch("app.mqtt.publisher.publish_command", new_callable=AsyncMock) as m:
        await publish_set_mode("esp32-X", "SALIDA")
        m.assert_awaited_once_with("esp32-X", command="set_mode", payload={"mode": "SALIDA"})
