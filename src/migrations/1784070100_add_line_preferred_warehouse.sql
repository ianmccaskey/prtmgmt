-- Split-shipment support: a line can carry its own fulfillment warehouse
-- (e.g. item A from SC, item B from OK). NULL = inherit the order's
-- preferred_warehouse_id (or full auto when that is NULL too).
ALTER TABLE sales_order_items
  ADD COLUMN IF NOT EXISTS preferred_warehouse_id BIGINT REFERENCES warehouses(id);
