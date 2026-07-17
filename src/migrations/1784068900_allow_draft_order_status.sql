-- The New Order form offers "Save as draft", but the sales_orders status CHECK
-- did not include 'draft', so draft saves violated the constraint. Allow it.
--
-- The set below is a SUPERSET spanning both the original lifecycle and the
-- quote-based one introduced in 1784069700 (which replaces this constraint
-- with the final set). It must validate regardless of whether the data was
-- already converted to quote statuses (manual applies happened out of band),
-- so both generations of status values are permitted here.

ALTER TABLE sales_orders DROP CONSTRAINT IF EXISTS sales_orders_status_check;
ALTER TABLE sales_orders ADD CONSTRAINT sales_orders_status_check
  CHECK (status IN ('draft','quote','confirmed','in_production','partially_shipped','shipped','delivered','cancelled'));
