-- Test texts ride the same outbox as real assignment notifications (they
-- must exercise the exact production path), but have no order — allow
-- NULL sales_order_id. The UNIQUE (warehouse_id, sales_order_id) key
-- ignores NULLs, so multiple tests per warehouse are fine.
ALTER TABLE sms_outbox ALTER COLUMN sales_order_id DROP NOT NULL;
