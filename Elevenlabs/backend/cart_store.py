from collections import defaultdict


class CartStore:
    def __init__(self) -> None:
        self._carts: dict[str, dict[str, int]] = defaultdict(dict)

    def add(self, user_id: str, product_id: str, qty: int = 1) -> int:
        cart = self._carts[user_id]
        cart[product_id] = cart.get(product_id, 0) + qty
        return cart[product_id]

    def remove(self, user_id: str, product_id: str) -> None:
        if user_id in self._carts:
            self._carts[user_id].pop(product_id, None)

    def clear(self, user_id: str) -> None:
        self._carts.pop(user_id, None)

    def get(self, user_id: str) -> dict[str, int]:
        return dict(self._carts.get(user_id, {}))

    def has(self, user_id: str, product_id: str) -> bool:
        return product_id in self._carts.get(user_id, {})

    def users_with_product(self, product_id: str) -> list[str]:
        return [uid for uid, items in self._carts.items() if product_id in items]
