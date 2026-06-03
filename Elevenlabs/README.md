# VoiceShop — ElevenLabs Voice Shopping Agent

A voice-driven shopping site powered by ElevenLabs Conversational AI. Users speak to a friendly agent that searches the catalog, filters by price, manages the cart, and handles checkout — all via natural conversation. Backend tracks stock and sends real-time emails for sold-out, low-stock, and order confirmations.

## Stack

- **Voice agent** — ElevenLabs Agents (STT + LLM + TTS + tool calling)
- **Frontend** — Vanilla JS + ElevenLabs JS SDK (`@elevenlabs/client`)
- **Backend** — FastAPI + WebSocket
- **Email** — Resend

## Project Structure

```
Elevenlabs/
├── public/             # Static frontend (served on :8000)
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   └── products.json
├── backend/            # FastAPI server (runs on :8001)
│   ├── main.py
│   ├── stock_store.py
│   ├── cart_store.py
│   ├── connection_manager.py
│   ├── email_sender.py
│   ├── requirements.txt
│   └── .env.example
└── DASHBOARD_SETUP.md  # ElevenLabs agent + tools config
```

## Setup

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt

cp .env.example .env             # then edit .env with your keys
python main.py                   # runs on http://localhost:8001
```

### 2. Frontend

```bash
cd public
python -m http.server 8000       # runs on http://localhost:8000
```

### 3. ElevenLabs Agent

Follow `DASHBOARD_SETUP.md` to create the agent and 6 client tools (`search_products`, `filter_by_price`, `add_to_cart`, `remove_from_cart`, `checkout`, `navigate_to_page`). Paste your agent ID into `public/app.js`.

## Voice Tools

| Tool | What it does |
|---|---|
| `search_products` | Free-text catalog search |
| `filter_by_price` | Filter by min/max price range |
| `add_to_cart` | Add product by ID |
| `remove_from_cart` | Remove product by ID |
| `checkout` | Place order, send confirmation email |
| `navigate_to_page` | Switch between home / cart / checkout |

## Email Notifications

Backend sends three types of emails via Resend:

- **Sold out** — when an item in cart drops to 0 stock
- **Low stock** — when an item in cart drops to ≤ `LOW_STOCK_THRESHOLD` (default 3)
- **Order confirmation** — itemized receipt after checkout

## Demo Phrases

- _"Show me red sneakers"_
- _"Filter under 50 dollars"_
- _"Add the first one to my cart"_
- _"Remove the leather jacket"_
- _"Go to checkout"_
- _"Place my order"_
