import resend


class EmailSender:
    def __init__(self, api_key: str, sender: str) -> None:
        self._sender = sender
        resend.api_key = api_key

    def send_sold_out(self, recipient: str, product_name: str, product_id: str) -> dict:
        subject = f"Sold out — {product_name}"
        html = self._sold_out_html(product_name, product_id)
        return self._send(recipient, subject, html)

    def send_low_stock(
        self, recipient: str, product_name: str, product_id: str, stock_left: int
    ) -> dict:
        subject = f"Only {stock_left} left — {product_name}"
        html = self._low_stock_html(product_name, product_id, stock_left)
        return self._send(recipient, subject, html)

    def send_order_confirmation(
        self, recipient: str, items: list[dict], total: float, order_id: str
    ) -> dict:
        subject = f"Order confirmed — #{order_id}"
        html = self._order_confirmation_html(items, total, order_id)
        return self._send(recipient, subject, html)

    def _send(self, recipient: str, subject: str, html: str) -> dict:
        params: dict = {
            "from": self._sender,
            "to": [recipient],
            "subject": subject,
            "html": html,
        }
        return resend.Emails.send(params)

    @staticmethod
    def _wrap(content: str) -> str:
        return f"""
        <!doctype html>
        <html>
          <body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0f1115;color:#e7e9ee;padding:32px;margin:0;">
            <div style="max-width:560px;margin:0 auto;background:#181b22;border:1px solid #2a2f3a;border-radius:14px;padding:28px;">
              {content}
              <p style="color:#6b7280;font-size:12px;margin-top:28px;">— VoiceShop</p>
            </div>
          </body>
        </html>
        """

    @classmethod
    def _sold_out_html(cls, product_name: str, product_id: str) -> str:
        body = f"""
          <h2 style="margin:0 0 8px;color:#fff;">Sorry, that's gone!</h2>
          <p style="color:#9aa3b2;margin:0 0 18px;">An item in your cart just sold out.</p>
          <div style="background:#1f232c;border-left:3px solid #ef4444;padding:16px;border-radius:8px;margin:20px 0;">
            <strong style="color:#fff;font-size:16px;">{product_name}</strong>
            <div style="color:#9aa3b2;font-size:13px;margin-top:4px;">Product ID: {product_id}</div>
          </div>
          <p style="color:#9aa3b2;font-size:14px;line-height:1.5;">
            We've removed it from your cart. Tap the mic in VoiceShop and ask for similar items.
          </p>
          <a href="http://localhost:8000" style="display:inline-block;margin-top:16px;background:#7c5cff;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;">Find similar items</a>
        """
        return cls._wrap(body)

    @classmethod
    def _low_stock_html(cls, product_name: str, product_id: str, stock_left: int) -> str:
        urgency = "selling fast" if stock_left > 1 else "almost gone"
        body = f"""
          <h2 style="margin:0 0 8px;color:#fff;">⏰ {product_name} is {urgency}!</h2>
          <p style="color:#9aa3b2;margin:0 0 18px;">An item in your cart only has <strong style="color:#f59e0b;">{stock_left} left</strong> in stock.</p>
          <div style="background:#1f232c;border-left:3px solid #f59e0b;padding:16px;border-radius:8px;margin:20px 0;">
            <strong style="color:#fff;font-size:16px;">{product_name}</strong>
            <div style="color:#9aa3b2;font-size:13px;margin-top:4px;">Product ID: {product_id}</div>
            <div style="color:#f59e0b;font-size:13px;margin-top:6px;font-weight:600;">Only {stock_left} left</div>
          </div>
          <p style="color:#9aa3b2;font-size:14px;line-height:1.5;">
            Don't lose it — finish your purchase before someone else does.
          </p>
          <a href="http://localhost:8000" style="display:inline-block;margin-top:16px;background:#f59e0b;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;">Complete checkout</a>
        """
        return cls._wrap(body)

    @classmethod
    def _order_confirmation_html(cls, items: list[dict], total: float, order_id: str) -> str:
        rows = "".join(
            f"""
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #2a2f3a;color:#e7e9ee;">
                <strong>{item['name']}</strong>
                <div style="color:#9aa3b2;font-size:12px;">x {item['qty']}</div>
              </td>
              <td style="padding:10px 0;border-bottom:1px solid #2a2f3a;color:#e7e9ee;text-align:right;">
                ${item['price'] * item['qty']}
              </td>
            </tr>
            """
            for item in items
        )
        body = f"""
          <h2 style="margin:0 0 8px;color:#fff;">🎉 Order confirmed!</h2>
          <p style="color:#9aa3b2;margin:0 0 18px;">Thanks for shopping with VoiceShop.</p>
          <div style="background:#1f232c;border-left:3px solid #22c55e;padding:18px;border-radius:8px;margin:20px 0;">
            <div style="color:#9aa3b2;font-size:13px;">Order ID</div>
            <div style="color:#fff;font-size:14px;font-weight:600;font-family:monospace;">#{order_id}</div>
          </div>
          <table style="width:100%;border-collapse:collapse;margin:14px 0;">
            {rows}
            <tr>
              <td style="padding:14px 0 0;color:#fff;font-size:18px;font-weight:700;">Total</td>
              <td style="padding:14px 0 0;color:#22c55e;font-size:20px;font-weight:700;text-align:right;">${total}</td>
            </tr>
          </table>
          <p style="color:#9aa3b2;font-size:14px;line-height:1.5;margin-top:20px;">
            We'll email you again when your order ships.
          </p>
          <a href="http://localhost:8000" style="display:inline-block;margin-top:8px;background:#22c55e;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;">Continue shopping</a>
        """
        return cls._wrap(body)
