# ElevenLabs Dashboard Setup — Voice Shopping Agent

Follow these steps in the **ElevenLabs Dashboard** before running the frontend.

---

## 1. Create the Agent

1. Go to https://elevenlabs.io/app/agents
2. Click **Create Agent** → choose **Blank Template**
3. Name it: `VoiceShop`

---

## 2. Agent Configuration

### First Message (greeting auto-played on connect)
```
Hi! I'm your voice shopping assistant. What are you looking for today?
```

### System Prompt (paste verbatim)
```
You are VoiceShop, a friendly voice shopping assistant for an online store.

CATALOG SCOPE:
The store sells products in these categories ONLY:
- shoes, shirts, jackets, watches, bags, electronics
Available colors include: red, blue, black, white, brown, silver, gold.

YOUR JOB:
1. Listen to what the user is shopping for.
2. ALWAYS call the search_products tool when the user describes anything they want to see, find, browse, or look at.
3. After the tool returns, summarize the result in ONE short sentence (under 15 words).
4. If the user mentions a price limit ("under 50", "less than 100"), call filter_by_price with the number.
5. If the user says "add the first one", "add that one", or names a product to add, call add_to_cart with the product_id from the most recent search results.
6. If the user says "go to cart", "checkout", or "go home", call navigate_to_page with the corresponding page name.
7. If the user asks something unrelated to shopping, politely steer them back.

STYLE:
- Be conversational, warm, and concise.
- Never read full product lists out loud — just say how many were found and the top one.
- Confirm cart additions briefly: "Added to your cart."
- If no products match, say so and suggest a related category.

NEVER make up products that aren't returned by the tool.
```

### Voice
- Pick any pre-made voice. Recommended: **Aria**, **Bella**, or **Rachel** (warm, friendly).

### Model (LLM)
- **Gemini 2.0 Flash** or **GPT-4o-mini** — both are fast and cheap, good for tool-calling.

### Speech-to-Text
- Default (Scribe).

### Text-to-Speech
- Model: **eleven_flash_v2_5** (lowest latency).

### Privacy / Auth
- Make agent **Public** for the demo (no signed URL needed).
  - Settings → Authentication → toggle off "Require authentication"

---

## 3. Add Client Tools

Go to the agent's **Tools** tab → **Add Tool** → choose **Client Tool** for EACH of these.

> Client tools execute in the browser. You only declare the schema here; the JS code lives in `public/app.js`.

---

### Tool 1 — `search_products`

| Field | Value |
|---|---|
| **Name** | `search_products` |
| **Description** | `Search the product catalog by free-text query. Use whenever the user describes what they want to shop for (e.g., "red sneakers", "headphones", "leather jacket"). Returns matching products and updates the visible product grid.` |
| **Wait for response** | ✅ Yes |
| **Response timeout** | 5 seconds |

**Parameters (JSON Schema):**
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Free-text product search query, e.g. 'red shoes', 'wireless headphones', 'leather backpack'."
    }
  },
  "required": ["query"]
}
```

---

### Tool 2 — `filter_by_price`

| Field | Value |
|---|---|
| **Name** | `filter_by_price` |
| **Description** | `Filter the currently visible product grid by maximum price. Use when the user says "under X dollars", "less than X", or "cheaper than X".` |
| **Wait for response** | ✅ Yes |
| **Response timeout** | 5 seconds |

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "max_price": {
      "type": "number",
      "description": "Maximum price in USD. Products costing more than this will be hidden."
    }
  },
  "required": ["max_price"]
}
```

---

### Tool 3 — `add_to_cart`

| Field | Value |
|---|---|
| **Name** | `add_to_cart` |
| **Description** | `Add a specific product to the shopping cart by its product_id. Use when the user says "add the first one", "add that to my cart", or names a product after a search.` |
| **Wait for response** | ✅ Yes |
| **Response timeout** | 5 seconds |

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "product_id": {
      "type": "string",
      "description": "The unique product id, e.g. 'p1', 'p7'. Must come from a recent search_products result."
    }
  },
  "required": ["product_id"]
}
```

---

### Tool 4 — `navigate_to_page`

| Field | Value |
|---|---|
| **Name** | `navigate_to_page` |
| **Description** | `Navigate the shopping site to a different page. Use when the user says "go to cart", "checkout", or "back to home".` |
| **Wait for response** | ✅ Yes |
| **Response timeout** | 5 seconds |

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "page": {
      "type": "string",
      "enum": ["home", "cart", "checkout"],
      "description": "Which page to navigate to."
    }
  },
  "required": ["page"]
}
```

---

## 4. Save & Copy the Agent ID

1. Click **Save** at the top-right.
2. Copy the **Agent ID** (looks like `agent_01abc...xyz`).
3. Paste it into `public/app.js` later, in the `AGENT_ID` constant.

---

## 5. Test in the Dashboard First

Use the **Test Agent** chat panel on the right side of the agent page:
- Type: `show me red sneakers`
- You should see `search_products` being invoked with `query: "red sneakers"`.
- The tool will fail in the dashboard (no client to handle it) — that's fine. You'll see the call attempt in the logs.

Once the calls show up correctly, the dashboard side is done. Move on to running the frontend.

---

## ✅ Checklist

- [ ] Agent created and named `VoiceShop`
- [ ] System prompt pasted
- [ ] First message set
- [ ] Voice selected
- [ ] LLM and TTS model chosen (flash recommended)
- [ ] Authentication = Public
- [ ] All 4 client tools added (`search_products`, `filter_by_price`, `add_to_cart`, `navigate_to_page`)
- [ ] Agent saved
- [ ] Agent ID copied
