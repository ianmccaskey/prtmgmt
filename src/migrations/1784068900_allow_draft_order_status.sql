-- The New Order form offers "Save as draft", but the sales_orders status CHECK
-- did not include 'draft', so draft saves violated the constraint. Allow it.

ALTER TABLE sales_orders DROP CONSTRAINT IF EXISTS sales_orders_status_check;
ALTER TABLE sales_orders ADD CONSTRAINT sales_orders_status_check
  CHECK (status IN ('draft','confirmed','in_production','partially_shipped','shipped','delivered','cancelled'));
