-- Reservation ledger: records exactly which inventory rows each order
-- reserved, so cancellation / source-switch / fulfillment release or consume
-- precisely that order's reservations instead of walking shared
-- quantity_reserved counters (which could release other orders' stock).
--
-- Note: pre-existing seed reservations in inventory.quantity_reserved have no
-- ledger rows; releases for seed orders are no-ops, which only over-states
-- reserved stock for seed data and self-heals as real orders flow through.

CREATE TABLE IF NOT EXISTS inventory_reservations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sales_order_id BIGINT NOT NULL REFERENCES sales_orders(id),
  product_id BIGINT NOT NULL REFERENCES products(id),
  inventory_id BIGINT NOT NULL REFERENCES inventory(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inventory_reservations_order_idx
  ON inventory_reservations (sales_order_id);
CREATE INDEX IF NOT EXISTS inventory_reservations_inventory_idx
  ON inventory_reservations (inventory_id);
