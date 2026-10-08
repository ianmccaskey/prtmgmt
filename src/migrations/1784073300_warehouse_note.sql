-- Per-order note to the warehouse (packing instructions, substitutions,
-- fragile handling, ...). Distinct from sales_orders.notes (internal) —
-- this one is surfaced loudly in the fulfillment queue and at the top of
-- the Mark Shipped dialog, where the packer cannot miss it.
ALTER TABLE sales_orders ADD COLUMN warehouse_note TEXT;
