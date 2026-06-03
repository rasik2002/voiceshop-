import json
from pathlib import Path


class StockStore:
    def __init__(self, products_path: Path) -> None:
        self._products_path = products_path
        self._stock: dict[str, int] = {}
        self._product_index: dict[str, dict] = {}
        self._load()

    def _load(self) -> None:
        with self._products_path.open("r", encoding="utf-8") as fh:
            products = json.load(fh)
        for product in products:
            pid = product["id"]
            self._stock[pid] = int(product.get("stock", 0))
            self._product_index[pid] = product

    def get_stock(self, product_id: str) -> int:
        return self._stock.get(product_id, 0)

    def get_product(self, product_id: str) -> dict | None:
        return self._product_index.get(product_id)

    def mark_sold_out(self, product_id: str) -> bool:
        if product_id not in self._stock:
            return False
        self._stock[product_id] = 0
        return True

    def decrement(self, product_id: str, by: int = 1) -> int | None:
        if product_id not in self._stock:
            return None
        new_value = max(0, self._stock[product_id] - by)
        self._stock[product_id] = new_value
        return new_value

    def is_sold_out(self, product_id: str) -> bool:
        return self._stock.get(product_id, 0) <= 0

    def is_low_stock(self, product_id: str, threshold: int) -> bool:
        stock = self._stock.get(product_id, 0)
        return 0 < stock <= threshold

    def all_stock(self) -> dict[str, int]:
        return dict(self._stock)
