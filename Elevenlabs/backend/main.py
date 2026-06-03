import logging
import os
import secrets
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from cart_store import CartStore
from connection_manager import ConnectionManager
from email_sender import EmailSender
from stock_store import StockStore

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("voiceshop")

load_dotenv()

PRODUCTS_PATH = Path(__file__).resolve().parent.parent / "public" / "products.json"
RESEND_API_KEY = os.environ["RESEND_API_KEY"]
DEMO_USER_EMAIL = os.environ["DEMO_USER_EMAIL"]
EMAIL_FROM = os.environ.get("EMAIL_FROM", "onboarding@resend.dev")
LOW_STOCK_THRESHOLD = int(os.environ.get("LOW_STOCK_THRESHOLD", "3"))

app = FastAPI(title="VoiceShop Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

stock = StockStore(PRODUCTS_PATH)
carts = CartStore()
connections = ConnectionManager()
emailer = EmailSender(api_key=RESEND_API_KEY, sender=EMAIL_FROM)
low_stock_alerted: set[str] = set()


class CartUpdate(BaseModel):
    user_id: str
    product_id: str
    action: str


class SoldOutRequest(BaseModel):
    product_id: str


class DecrementRequest(BaseModel):
    product_id: str
    by: int = 1


class CheckoutItem(BaseModel):
    product_id: str
    qty: int


class CheckoutRequest(BaseModel):
    user_id: str
    items: list[CheckoutItem]


class HealthResponse(BaseModel):
    status: str
    connected_users: int
    products: int
    low_stock_threshold: int


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        connected_users=len(connections._connections),
        products=len(stock.all_stock()),
        low_stock_threshold=LOW_STOCK_THRESHOLD,
    )


@app.get("/api/stock")
async def get_stock() -> dict:
    return stock.all_stock()


@app.post("/api/cart")
async def update_cart(payload: CartUpdate) -> dict:
    if payload.action == "add":
        carts.add(payload.user_id, payload.product_id)
    elif payload.action == "remove":
        carts.remove(payload.user_id, payload.product_id)
    else:
        raise HTTPException(status_code=400, detail="action must be 'add' or 'remove'")
    return {"ok": True, "cart": carts.get(payload.user_id)}


@app.post("/api/sold-out")
async def trigger_sold_out(payload: SoldOutRequest) -> dict:
    product = stock.get_product(payload.product_id)
    if product is None:
        raise HTTPException(status_code=404, detail=f"Product {payload.product_id} not found")

    stock.mark_sold_out(payload.product_id)
    affected_users = carts.users_with_product(payload.product_id)
    logger.info("sold-out triggered for %s; affected=%s", payload.product_id, affected_users)

    notified = 0
    emails_sent = 0
    email_errors: list[str] = []

    ws_payload = {
        "type": "sold_out",
        "product_id": product["id"],
        "product_name": product["name"],
        "image": product.get("image"),
        "message": f"{product['name']} just sold out — we've removed it from your cart.",
    }

    for user_id in affected_users:
        if await connections.send_to(user_id, ws_payload):
            notified += 1
        carts.remove(user_id, payload.product_id)
        try:
            emailer.send_sold_out(
                recipient=DEMO_USER_EMAIL,
                product_name=product["name"],
                product_id=product["id"],
            )
            emails_sent += 1
        except Exception as exc:
            logger.exception("email failed for %s: %s", user_id, exc)
            email_errors.append(str(exc))

    await connections.broadcast({
        "type": "stock_update",
        "product_id": product["id"],
        "stock": 0,
    })

    return {
        "ok": True,
        "product_id": product["id"],
        "affected_users": len(affected_users),
        "websocket_notified": notified,
        "emails_sent": emails_sent,
        "email_errors": email_errors,
    }


@app.post("/api/stock/decrement")
async def decrement_stock(payload: DecrementRequest) -> dict:
    product = stock.get_product(payload.product_id)
    if product is None:
        raise HTTPException(status_code=404, detail=f"Product {payload.product_id} not found")

    new_stock = stock.decrement(payload.product_id, payload.by)
    logger.info("stock decremented for %s -> %s", payload.product_id, new_stock)

    await connections.broadcast({
        "type": "stock_update",
        "product_id": payload.product_id,
        "stock": new_stock,
    })

    if new_stock == 0:
        await _handle_sold_out_for_product(product)
        return {
            "ok": True,
            "product_id": payload.product_id,
            "stock": new_stock,
            "event": "sold_out",
        }

    if stock.is_low_stock(payload.product_id, LOW_STOCK_THRESHOLD):
        sent = await _alert_low_stock(product, new_stock)
        return {
            "ok": True,
            "product_id": payload.product_id,
            "stock": new_stock,
            "event": "low_stock",
            "alerts_sent": sent,
        }

    return {"ok": True, "product_id": payload.product_id, "stock": new_stock}


@app.post("/api/checkout")
async def checkout(payload: CheckoutRequest) -> dict:
    if not payload.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    line_items: list[dict] = []
    total = 0
    for item in payload.items:
        product = stock.get_product(item.product_id)
        if product is None:
            continue
        line_items.append({
            "product_id": product["id"],
            "name": product["name"],
            "price": product["price"],
            "qty": item.qty,
        })
        total += product["price"] * item.qty
        stock.decrement(item.product_id, item.qty)

    order_id = secrets.token_hex(4).upper()
    carts.clear(payload.user_id)
    logger.info("order %s placed by %s; total=%s; items=%s", order_id, payload.user_id, total, len(line_items))

    email_error: str | None = None
    try:
        emailer.send_order_confirmation(
            recipient=DEMO_USER_EMAIL,
            items=line_items,
            total=total,
            order_id=order_id,
        )
    except Exception as exc:
        logger.exception("order confirmation email failed: %s", exc)
        email_error = str(exc)

    for item in line_items:
        await connections.broadcast({
            "type": "stock_update",
            "product_id": item["product_id"],
            "stock": stock.get_stock(item["product_id"]),
        })
        if stock.is_sold_out(item["product_id"]):
            await _handle_sold_out_for_product(stock.get_product(item["product_id"]))
        elif stock.is_low_stock(item["product_id"], LOW_STOCK_THRESHOLD):
            await _alert_low_stock(stock.get_product(item["product_id"]), stock.get_stock(item["product_id"]))

    return {
        "ok": True,
        "order_id": order_id,
        "total": total,
        "items": line_items,
        "email_error": email_error,
    }


async def _handle_sold_out_for_product(product: dict) -> None:
    affected = carts.users_with_product(product["id"])
    ws_payload = {
        "type": "sold_out",
        "product_id": product["id"],
        "product_name": product["name"],
        "image": product.get("image"),
        "message": f"{product['name']} just sold out — we've removed it from your cart.",
    }
    for user_id in affected:
        await connections.send_to(user_id, ws_payload)
        carts.remove(user_id, product["id"])
        try:
            emailer.send_sold_out(
                recipient=DEMO_USER_EMAIL,
                product_name=product["name"],
                product_id=product["id"],
            )
        except Exception as exc:
            logger.exception("sold-out email failed: %s", exc)


async def _alert_low_stock(product: dict, stock_left: int) -> int:
    if product["id"] in low_stock_alerted:
        return 0
    low_stock_alerted.add(product["id"])
    affected = carts.users_with_product(product["id"])
    ws_payload = {
        "type": "low_stock",
        "product_id": product["id"],
        "product_name": product["name"],
        "stock": stock_left,
        "message": f"Only {stock_left} {product['name']} left!",
    }
    sent = 0
    for user_id in affected:
        if await connections.send_to(user_id, ws_payload):
            sent += 1
        try:
            emailer.send_low_stock(
                recipient=DEMO_USER_EMAIL,
                product_name=product["name"],
                product_id=product["id"],
                stock_left=stock_left,
            )
        except Exception as exc:
            logger.exception("low-stock email failed: %s", exc)
    logger.info("low-stock alert: %s (%d left); sent=%d", product["id"], stock_left, sent)
    return sent


@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str) -> None:
    await connections.connect(user_id, websocket)
    try:
        await connections.send_to(user_id, {
            "type": "hello",
            "user_id": user_id,
            "stock": stock.all_stock(),
            "low_stock_threshold": LOW_STOCK_THRESHOLD,
        })
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            if msg_type == "ping":
                await connections.send_to(user_id, {"type": "pong"})
            elif msg_type == "cart_add":
                carts.add(user_id, data["product_id"])
            elif msg_type == "cart_remove":
                carts.remove(user_id, data["product_id"])
            else:
                logger.debug("unknown message from %s: %s", user_id, data)
    except WebSocketDisconnect:
        connections.disconnect(user_id)
    except Exception as exc:
        logger.exception("ws error for %s: %s", user_id, exc)
        connections.disconnect(user_id)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
