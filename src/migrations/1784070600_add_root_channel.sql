-- Add 'root' as a communication channel. Both constraints must change
-- together: New Order copies the customer's preferred channel onto the
-- order, so a customers-only widening would break order creation.
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_preferred_channel_check;
ALTER TABLE customers ADD CONSTRAINT customers_preferred_channel_check
  CHECK (preferred_channel = ANY (ARRAY['telegram', 'signal', 'discord', 'whatsapp', 'root', 'other']));

ALTER TABLE sales_orders DROP CONSTRAINT IF EXISTS sales_orders_order_channel_check;
ALTER TABLE sales_orders ADD CONSTRAINT sales_orders_order_channel_check
  CHECK (order_channel = ANY (ARRAY['telegram', 'signal', 'discord', 'whatsapp', 'root', 'other']));
