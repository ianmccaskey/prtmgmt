-- Order-level fulfillment warehouse: defaulted at order entry to the
-- warehouse that can fill every line (rep can override). NULL = auto
-- (FIFO across all warehouses). Reservations target this warehouse when
-- set; Mark Shipped defaults prefer it but stay overridable.
ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS preferred_warehouse_id BIGINT REFERENCES warehouses(id);
