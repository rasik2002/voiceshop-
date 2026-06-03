import json
import logging
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, WebSocket] = {}

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[user_id] = websocket
        logger.info("user %s connected (total=%d)", user_id, len(self._connections))

    def disconnect(self, user_id: str) -> None:
        self._connections.pop(user_id, None)
        logger.info("user %s disconnected (total=%d)", user_id, len(self._connections))

    async def send_to(self, user_id: str, payload: dict) -> bool:
        ws = self._connections.get(user_id)
        if ws is None:
            return False
        try:
            await ws.send_text(json.dumps(payload))
            return True
        except Exception as exc:
            logger.exception("failed to send to %s: %s", user_id, exc)
            self._connections.pop(user_id, None)
            return False

    async def broadcast(self, payload: dict) -> int:
        delivered = 0
        for user_id in list(self._connections.keys()):
            if await self.send_to(user_id, payload):
                delivered += 1
        return delivered
