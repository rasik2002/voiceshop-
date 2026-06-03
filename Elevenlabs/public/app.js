import { Conversation } from "https://cdn.jsdelivr.net/npm/@elevenlabs/client@latest/+esm";

const AGENT_ID = "agent_5701kt65m3x7ed1bttbyjzb5fzzm";
const BACKEND_HTTP = "http://localhost:8001";
const BACKEND_WS = "ws://localhost:8001";

class ProductCatalog {
  constructor() {
    this._all = [];
    this._visible = [];
    this._lastResults = [];
    this._stockOverrides = {};
  }

  async load() {
    const res = await fetch("products.json");
    this._all = await res.json();
    this._visible = [...this._all];
    return this._all;
  }

  applyStock(stockMap) {
    this._stockOverrides = { ...stockMap };
    for (const product of this._all) {
      if (stockMap[product.id] !== undefined) product.stock = stockMap[product.id];
    }
  }

  setLowStockThreshold(value) {
    this._lowStockThreshold = value;
  }

  getLowStockThreshold() {
    return this._lowStockThreshold ?? 3;
  }

  isLowStock(productId) {
    const product = this.getById(productId);
    if (!product) return false;
    return product.stock > 0 && product.stock <= this.getLowStockThreshold();
  }

  setStock(productId, value) {
    const product = this.getById(productId);
    if (product) product.stock = value;
    this._stockOverrides[productId] = value;
  }

  isSoldOut(productId) {
    const product = this.getById(productId);
    return !product || product.stock <= 0;
  }

  getAll() {
    return this._all;
  }

  getVisible() {
    return this._visible;
  }

  getLastResults() {
    return this._lastResults;
  }

  getById(productId) {
    return this._all.find((p) => p.id === productId);
  }

  search(query) {
    const q = (query || "").toLowerCase().trim();
    if (!q || q === "all" || q === "everything" || q === "show all") {
      this._visible = [...this._all];
      this._lastResults = this._visible;
      return this._visible;
    }
    const tokens = q.split(/\s+/).filter(Boolean);
    const matches = this._all.filter((p) => {
      const haystack = `${p.name} ${p.category} ${p.color} ${p.description}`.toLowerCase();
      return tokens.every((t) => haystack.includes(t));
    });
    this._visible = matches;
    this._lastResults = matches;
    return matches;
  }

  filterByPrice(minPrice, maxPrice) {
    const min = minPrice ?? 0;
    const max = maxPrice ?? Number.POSITIVE_INFINITY;
    const base = this._lastResults.length > 0 ? this._lastResults : this._all;
    this._visible = base.filter((p) => p.price >= min && p.price <= max);
    return this._visible;
  }

  reset() {
    this._visible = [...this._all];
    this._lastResults = [];
    return this._visible;
  }
}

class CartManager {
  constructor() {
    this._items = new Map();
  }

  add(productId) {
    const current = this._items.get(productId) || 0;
    this._items.set(productId, current + 1);
    return this.count();
  }

  remove(productId) {
    this._items.delete(productId);
    return this.count();
  }

  has(productId) {
    return this._items.has(productId);
  }

  clear() {
    this._items.clear();
  }

  count() {
    let total = 0;
    for (const qty of this._items.values()) total += qty;
    return total;
  }

  entries(catalog) {
    const rows = [];
    for (const [id, qty] of this._items.entries()) {
      const product = catalog.getById(id);
      if (product) rows.push({ product, qty });
    }
    return rows;
  }

  total(catalog) {
    return this.entries(catalog).reduce((sum, r) => sum + r.product.price * r.qty, 0);
  }
}

class BackendClient {
  constructor(httpBase, wsBase, userId) {
    this._http = httpBase;
    this._wsBase = wsBase;
    this._userId = userId;
    this._ws = null;
    this._handlers = {};
    this._reconnectTimer = null;
  }

  on(event, handler) {
    this._handlers[event] = handler;
  }

  connect() {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) return;
    const url = `${this._wsBase}/ws/${encodeURIComponent(this._userId)}`;
    this._ws = new WebSocket(url);

    this._ws.addEventListener("open", () => {
      console.log("[ws] connected as", this._userId);
      this._handlers.open?.();
    });

    this._ws.addEventListener("message", (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (err) {
        console.error("[ws] bad message", err);
        return;
      }
      console.log("[ws] <-", data);
      this._handlers[data.type]?.(data);
    });

    this._ws.addEventListener("close", () => {
      console.warn("[ws] disconnected, retrying in 3s");
      this._handlers.close?.();
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = setTimeout(() => this.connect(), 3000);
    });

    this._ws.addEventListener("error", (err) => {
      console.error("[ws] error", err);
    });
  }

  send(payload) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(payload));
    }
  }

  async syncCart(productId, action) {
    try {
      await fetch(`${this._http}/api/cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: this._userId, product_id: productId, action }),
      });
    } catch (err) {
      console.warn("[backend] cart sync failed", err);
    }
  }

  async triggerSoldOut(productId) {
    const res = await fetch(`${this._http}/api/sold-out`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId }),
    });
    return res.json();
  }

  async decrementStock(productId, by = 1) {
    const res = await fetch(`${this._http}/api/stock/decrement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, by }),
    });
    return res.json();
  }

  async checkout(items) {
    const res = await fetch(`${this._http}/api/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: this._userId,
        items: items.map((i) => ({ product_id: i.product_id, qty: i.qty })),
      }),
    });
    return res.json();
  }
}

class UIRenderer {
  constructor(catalog, cart) {
    this._catalog = catalog;
    this._cart = cart;
    this._grid = document.getElementById("product-grid");
    this._empty = document.getElementById("empty-state");
    this._cartCount = document.getElementById("cart-count");
    this._cartItems = document.getElementById("cart-items");
    this._cartEmpty = document.getElementById("cart-empty");
    this._cartSummary = document.getElementById("cart-summary");
    this._cartTotal = document.getElementById("cart-total");
    this._checkoutItems = document.getElementById("checkout-items");
    this._checkoutTotal = document.getElementById("checkout-total");
    this._statusPill = document.getElementById("status-pill");
    this._statusText = document.getElementById("status-text");
    this._micBtn = document.getElementById("mic-btn");
    this._searchInfo = document.getElementById("search-info");
    this._toastHost = document.getElementById("toast-host");
    this._adminSelect = document.getElementById("admin-select");
  }

  renderGrid(products, highlightFirst = false) {
    this._grid.innerHTML = "";
    if (!products.length) {
      this._empty.classList.remove("hidden");
      return;
    }
    this._empty.classList.add("hidden");
    products.forEach((p, idx) => {
      const isOut = this._catalog.isSoldOut(p.id);
      const isLow = this._catalog.isLowStock(p.id);
      const card = document.createElement("div");
      const classes = ["card"];
      if (highlightFirst && idx === 0 && !isOut) classes.push("highlight");
      if (isOut) classes.push("sold-out");
      else if (isLow) classes.push("low-stock");
      card.className = classes.join(" ");
      card.dataset.productId = p.id;
      let badge = "";
      if (isOut) badge = '<div class="sold-out-badge">Sold out</div>';
      else if (isLow) badge = `<div class="low-stock-badge">Only ${p.stock} left</div>`;
      card.innerHTML = `
        ${badge}
        <img class="card-img" src="${p.image}" alt="${p.name}" loading="lazy"
             onerror="this.style.background='#1f232c';this.removeAttribute('src');" />
        <div class="card-body">
          <h3 class="card-title">${p.name}</h3>
          <div class="card-meta">
            <span>${p.category} · ${p.color}</span>
            <span>★ ${p.rating}</span>
          </div>
          <div class="card-price">$${p.price}</div>
          <button class="add-btn" data-add="${p.id}" ${isOut ? "disabled" : ""}>
            ${isOut ? "Sold out" : "Add to Cart"}
          </button>
        </div>
      `;
      this._grid.appendChild(card);
    });
  }

  setSearchInfo(text) {
    if (!text) {
      this._searchInfo.classList.remove("active");
      this._searchInfo.textContent = "";
      return;
    }
    this._searchInfo.classList.add("active");
    this._searchInfo.textContent = text;
  }

  updateCartBadge() {
    this._cartCount.textContent = this._cart.count();
  }

  renderCart() {
    const rows = this._cart.entries(this._catalog);
    this._cartItems.innerHTML = "";
    if (!rows.length) {
      this._cartEmpty.classList.remove("hidden");
      this._cartSummary.classList.add("hidden");
      return;
    }
    this._cartEmpty.classList.add("hidden");
    this._cartSummary.classList.remove("hidden");
    rows.forEach(({ product, qty }) => {
      const row = document.createElement("div");
      row.className = "cart-row";
      row.innerHTML = `
        <img src="${product.image}" alt="${product.name}" />
        <div class="info">
          <h4>${product.name}</h4>
          <span>${product.category} · ${product.color} · $${product.price}</span>
        </div>
        <div class="qty">×${qty}</div>
      `;
      this._cartItems.appendChild(row);
    });
    this._cartTotal.textContent = `$${this._cart.total(this._catalog)}`;
  }

  renderCheckout() {
    const rows = this._cart.entries(this._catalog);
    this._checkoutItems.innerHTML = rows
      .map(
        (r) =>
          `<div class="summary-row"><span>${r.product.name} ×${r.qty}</span><span>$${r.product.price * r.qty}</span></div>`
      )
      .join("");
    this._checkoutTotal.textContent = `$${this._cart.total(this._catalog)}`;
  }

  navigate(page) {
    const valid = ["home", "cart", "checkout"];
    if (!valid.includes(page)) return false;
    document.querySelectorAll(".page").forEach((el) => el.classList.remove("active"));
    document.getElementById(`page-${page}`).classList.add("active");
    if (page === "cart") this.renderCart();
    if (page === "checkout") this.renderCheckout();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return true;
  }

  setStatus(state, text) {
    const validStates = ["idle", "connecting", "listening", "speaking", "error"];
    this._statusPill.classList.remove(...validStates, "hidden");
    if (state === "idle") {
      this._statusPill.classList.add("hidden");
      return;
    }
    this._statusPill.classList.add(state);
    this._statusText.textContent = text || state;
  }

  setMicActive(active) {
    this._micBtn.classList.toggle("active", active);
    this._micBtn.setAttribute(
      "aria-label",
      active ? "End voice conversation" : "Start voice conversation"
    );
  }

  showOrderSuccess(itemCount, total) {
    const banner = document.createElement("div");
    banner.className = "toast success-toast";
    banner.innerHTML = `
      <div class="toast-icon">✅</div>
      <div class="toast-body">
        <strong>Order placed!</strong>
        <span>${itemCount} item${itemCount === 1 ? "" : "s"} · $${total} — confirmation sent.</span>
      </div>
      <button class="toast-close">×</button>
    `;
    banner.querySelector(".toast-close").addEventListener("click", () => banner.remove());
    this._toastHost.appendChild(banner);
    setTimeout(() => banner.remove(), 6000);
  }

  showSoldOutBanner(productName) {
    const banner = document.createElement("div");
    banner.className = "toast sold-out-toast";
    banner.innerHTML = `
      <div class="toast-icon">⚠️</div>
      <div class="toast-body">
        <strong>${productName} just sold out</strong>
        <span>We removed it from your cart and emailed you an alert.</span>
      </div>
      <button class="toast-close">×</button>
    `;
    banner.querySelector(".toast-close").addEventListener("click", () => banner.remove());
    this._toastHost.appendChild(banner);
    setTimeout(() => banner.remove(), 8000);
  }

  showLowStockBanner(productName, stockLeft) {
    const banner = document.createElement("div");
    banner.className = "toast low-stock-toast";
    banner.innerHTML = `
      <div class="toast-icon">⏰</div>
      <div class="toast-body">
        <strong>Only ${stockLeft} ${productName} left!</strong>
        <span>Item from your cart is selling fast — alert sent to your email.</span>
      </div>
      <button class="toast-close">×</button>
    `;
    banner.querySelector(".toast-close").addEventListener("click", () => banner.remove());
    this._toastHost.appendChild(banner);
    setTimeout(() => banner.remove(), 8000);
  }

  populateAdminSelect(products) {
    if (!this._adminSelect) return;
    this._adminSelect.innerHTML = products
      .map((p) => `<option value="${p.id}">${p.name} (${p.id})</option>`)
      .join("");
  }
}

class VoiceAgent {
  constructor(agentId, catalog, cart, ui, backend) {
    this._agentId = agentId;
    this._catalog = catalog;
    this._cart = cart;
    this._ui = ui;
    this._backend = backend;
    this._conversation = null;
  }

  isActive() {
    return this._conversation !== null;
  }

  async start() {
    if (this._conversation) return;
    if (!this._agentId || this._agentId === "PASTE_YOUR_AGENT_ID_HERE") {
      alert("Please set AGENT_ID in app.js to your ElevenLabs agent id.");
      return;
    }
    try {
      this._ui.setStatus("connecting", "Connecting…");
      await navigator.mediaDevices.getUserMedia({ audio: true });

      this._conversation = await Conversation.startSession({
        agentId: this._agentId,
        clientTools: this._buildTools(),
        onConnect: () => this._ui.setStatus("listening", "Listening…"),
        onDisconnect: () => {
          this._ui.setStatus("idle");
          this._ui.setMicActive(false);
          this._conversation = null;
        },
        onError: (err) => {
          console.error("Agent error:", err);
          this._ui.setStatus("error", "Error");
        },
        onModeChange: ({ mode }) => {
          if (mode === "speaking") this._ui.setStatus("speaking", "Speaking…");
          else if (mode === "listening") this._ui.setStatus("listening", "Listening…");
        },
      });
      this._ui.setMicActive(true);
    } catch (err) {
      console.error("Failed to start session:", err);
      this._ui.setStatus("error", "Mic blocked or network error");
      this._conversation = null;
      this._ui.setMicActive(false);
    }
  }

  async stop() {
    if (!this._conversation) return;
    try {
      await this._conversation.endSession();
    } catch (err) {
      console.error("Failed to end session:", err);
    }
    this._conversation = null;
    this._ui.setStatus("idle");
    this._ui.setMicActive(false);
  }

  announceSoldOut(productName) {
    if (!this._conversation) return;
    try {
      this._conversation.sendContextualUpdate?.(
        `SYSTEM ALERT: ${productName} just sold out and was removed from the user's cart. Briefly tell the user and offer to find a similar item.`
      );
    } catch (err) {
      console.warn("Could not push contextual update:", err);
    }
  }

  _buildTools() {
    return {
      search_products: ({ query }) => {
        const q = (query ?? "").toString();
        const matches = this._catalog.search(q);
        this._ui.navigate("home");
        this._ui.renderGrid(matches, true);
        const label = q.trim() === "" ? "All products" : `"${q}"`;
        this._ui.setSearchInfo(`${label} — ${matches.length} result${matches.length === 1 ? "" : "s"}`);
        if (!matches.length) return "No products found for that query.";
        const summary = matches.slice(0, 5).map((p) => `${p.id}: ${p.name} ($${p.price})`).join("; ");
        return `Found ${matches.length} products. Top matches: ${summary}`;
      },

      filter_by_price: ({ min_price, max_price }) => {
        const min = min_price !== undefined && min_price !== null ? Number(min_price) : undefined;
        const max = max_price !== undefined && max_price !== null ? Number(max_price) : undefined;
        const filtered = this._catalog.filterByPrice(min, max);
        this._ui.renderGrid(filtered, true);
        const label = this._priceLabel(min, max);
        this._ui.setSearchInfo(`${label} — ${filtered.length} result${filtered.length === 1 ? "" : "s"}`);
        if (!filtered.length) return `No products in that price range.`;
        return `${filtered.length} products ${label.toLowerCase()}.`;
      },

      add_to_cart: ({ product_id }) => {
        const product = this._catalog.getById(product_id);
        if (!product) return `Product ${product_id} not found.`;
        if (this._catalog.isSoldOut(product_id)) {
          return `${product.name} is sold out. Pick another item.`;
        }
        const count = this._cart.add(product_id);
        this._ui.updateCartBadge();
        this._backend.syncCart(product_id, "add");
        const card = document.querySelector(`.card[data-product-id="${product_id}"]`);
        if (card) {
          card.classList.add("highlight");
          setTimeout(() => card.classList.remove("highlight"), 1200);
        }
        return `Added ${product.name} to cart. Cart now has ${count} item${count === 1 ? "" : "s"}.`;
      },

      remove_from_cart: ({ product_id }) => {
        const product = this._catalog.getById(product_id);
        if (!product) return `Product ${product_id} not found.`;
        if (!this._cart.has(product_id)) return `${product.name} is not in the cart.`;
        const count = this._cart.remove(product_id);
        this._ui.updateCartBadge();
        this._backend.syncCart(product_id, "remove");
        const activePage = document.querySelector(".page.active")?.id;
        if (activePage === "page-cart") this._ui.renderCart();
        return `Removed ${product.name} from cart. Cart now has ${count} item${count === 1 ? "" : "s"}.`;
      },

      checkout: async () => {
        const rows = this._cart.entries(this._catalog);
        if (!rows.length) return "Cart is empty. Add items before checking out.";
        const itemCount = this._cart.count();
        const total = this._cart.total(this._catalog);
        const items = rows.map((r) => ({ product_id: r.product.id, qty: r.qty }));
        let orderId = "";
        try {
          const result = await this._backend.checkout(items);
          orderId = result.order_id || "";
        } catch (err) {
          console.error("[checkout] backend failed:", err);
        }
        this._cart.clear();
        this._ui.updateCartBadge();
        this._ui.navigate("home");
        this._ui.showOrderSuccess(itemCount, total);
        const orderSuffix = orderId ? ` Order #${orderId}.` : "";
        return `Order placed: ${itemCount} item${itemCount === 1 ? "" : "s"}, total $${total}.${orderSuffix} Confirmation emailed.`;
      },

      navigate_to_page: ({ page }) => {
        const ok = this._ui.navigate(page);
        return ok ? `Navigated to ${page}.` : `Unknown page: ${page}.`;
      },
    };
  }

  _priceLabel(min, max) {
    if (min !== undefined && max !== undefined) return `Between $${min} and $${max}`;
    if (max !== undefined) return `Under $${max}`;
    if (min !== undefined) return `Above $${min}`;
    return "All prices";
  }
}

class App {
  constructor() {
    this._userId = this._loadOrCreateUserId();
    this.catalog = new ProductCatalog();
    this.cart = new CartManager();
    this.ui = new UIRenderer(this.catalog, this.cart);
    this.backend = new BackendClient(BACKEND_HTTP, BACKEND_WS, this._userId);
    this.agent = new VoiceAgent(AGENT_ID, this.catalog, this.cart, this.ui, this.backend);
  }

  _loadOrCreateUserId() {
    let id = localStorage.getItem("voiceshop_user_id");
    if (!id) {
      id = `user_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem("voiceshop_user_id", id);
    }
    return id;
  }

  async init() {
    await this.catalog.load();
    this.ui.renderGrid(this.catalog.getAll());
    this.ui.updateCartBadge();
    this.ui.populateAdminSelect(this.catalog.getAll());
    this._wireBackend();
    this._bindEvents();
  }

  _wireBackend() {
    this.backend.on("hello", (data) => {
      if (data.stock) this.catalog.applyStock(data.stock);
      if (data.low_stock_threshold) this.catalog.setLowStockThreshold(data.low_stock_threshold);
      this.ui.renderGrid(this.catalog.getVisible());
    });

    this.backend.on("stock_update", (data) => {
      this.catalog.setStock(data.product_id, data.stock);
      this.ui.renderGrid(this.catalog.getVisible());
    });

    this.backend.on("sold_out", (data) => {
      const wasInCart = this.cart.has(data.product_id);
      if (wasInCart) {
        this.cart.remove(data.product_id);
        this.ui.updateCartBadge();
        this.ui.showSoldOutBanner(data.product_name);
        this.agent.announceSoldOut(data.product_name);
      }
      this.catalog.setStock(data.product_id, 0);
      this.ui.renderGrid(this.catalog.getVisible());
    });

    this.backend.on("low_stock", (data) => {
      this.catalog.setStock(data.product_id, data.stock);
      this.ui.renderGrid(this.catalog.getVisible());
      if (this.cart.has(data.product_id)) {
        this.ui.showLowStockBanner(data.product_name, data.stock);
      }
    });

    this.backend.connect();
  }

  _bindEvents() {
    document.getElementById("mic-btn").addEventListener("click", () => {
      if (this.agent.isActive()) this.agent.stop();
      else this.agent.start();
    });

    document.querySelectorAll("[data-nav]").forEach((el) => {
      el.addEventListener("click", () => this.ui.navigate(el.dataset.nav));
    });

    document.addEventListener("click", (e) => {
      const addBtn = e.target.closest("[data-add]");
      if (!addBtn || addBtn.disabled) return;
      const productId = addBtn.dataset.add;
      if (this.catalog.isSoldOut(productId)) return;
      this.cart.add(productId);
      this.ui.updateCartBadge();
      this.backend.syncCart(productId, "add");
      addBtn.textContent = "Added ✓";
      setTimeout(() => (addBtn.textContent = "Add to Cart"), 1000);
    });

    const adminBtn = document.getElementById("admin-trigger");
    const adminSelect = document.getElementById("admin-select");
    if (adminBtn && adminSelect) {
      adminBtn.addEventListener("click", async () => {
        const productId = adminSelect.value;
        adminBtn.disabled = true;
        adminBtn.textContent = "Triggering…";
        try {
          const result = await this.backend.triggerSoldOut(productId);
          console.log("[admin] sold-out result:", result);
        } catch (err) {
          console.error("[admin] failed:", err);
          alert("Backend not running? Check that uvicorn is up on :8001");
        } finally {
          adminBtn.disabled = false;
          adminBtn.textContent = "Mark sold out";
        }
      });
    }

    const sellBtn = document.getElementById("admin-sell-one");
    if (sellBtn && adminSelect) {
      sellBtn.addEventListener("click", async () => {
        const productId = adminSelect.value;
        sellBtn.disabled = true;
        sellBtn.textContent = "Selling…";
        try {
          const result = await this.backend.decrementStock(productId, 1);
          console.log("[admin] decrement result:", result);
        } catch (err) {
          console.error("[admin] decrement failed:", err);
          alert("Backend not running? Check that uvicorn is up on :8001");
        } finally {
          sellBtn.disabled = false;
          sellBtn.textContent = "− Sell 1";
        }
      });
    }

    const adminToggle = document.getElementById("admin-toggle");
    const adminPanel = document.getElementById("admin-panel");
    if (adminToggle && adminPanel) {
      adminToggle.addEventListener("click", () => adminPanel.classList.toggle("open"));
    }
  }
}

const app = new App();
app.init();
