-- Shipping-money routing (Ian, 2026-10-08). Shipping is generally free;
-- when a charge exists it is one of two things, and the recipient column
-- says which:
--   'vendor'    — the $15 under-MOQ fee auto-added at order creation
--                 (rep-overridable). Stays in the vendor remainder and is
--                 excluded from rep commission.
--   'warehouse' — an expedited-shipping fee. Credited to the warehouse
--                 that ships the order (warehouses pay for their own
--                 labels), also excluded from rep commission.
-- Legacy orders default 'vendor'.
ALTER TABLE sales_orders
  ADD COLUMN shipping_fee_recipient TEXT NOT NULL DEFAULT 'vendor'
    CHECK (shipping_fee_recipient IN ('vendor', 'warehouse'));
