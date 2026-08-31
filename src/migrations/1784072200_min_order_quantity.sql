-- Per-product minimum order quantity: soft-enforced at order entry (a
-- warning the rep can override) and badged on the public price list.
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_order_quantity INT NOT NULL DEFAULT 1;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_min_order_quantity_check;
ALTER TABLE products ADD CONSTRAINT products_min_order_quantity_check CHECK (min_order_quantity >= 1);
