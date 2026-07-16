-- New order lifecycle: quote → confirmed → partially_shipped/shipped →
-- delivered (cancelled from any pre-shipped status). The in_production
-- stage is removed and 'draft' is renamed 'quote'. Confirmation is gated
-- on payment_status IN ('paid','partial_paid') — enforced in the
-- updateOrderStatus action.
UPDATE sales_orders SET status = 'quote' WHERE status = 'draft';
UPDATE sales_orders SET status = 'confirmed' WHERE status = 'in_production';

ALTER TABLE sales_orders DROP CONSTRAINT IF EXISTS sales_orders_status_check;
ALTER TABLE sales_orders ADD CONSTRAINT sales_orders_status_check
  CHECK (status IN ('quote','confirmed','partially_shipped','shipped','delivered','cancelled'));
