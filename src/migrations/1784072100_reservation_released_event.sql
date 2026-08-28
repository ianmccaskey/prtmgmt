-- New warehouse activity event: a shipment from one warehouse releasing
-- the order's stale reservations held at another (the WI/OK class of
-- accident). Re-runnable (drop-then-add).
ALTER TABLE warehouse_activity_log DROP CONSTRAINT IF EXISTS warehouse_activity_log_event_type_check;
ALTER TABLE warehouse_activity_log ADD CONSTRAINT warehouse_activity_log_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'receipt_delivered'::text, 'receipt_discrepancy'::text, 'outbound_pick'::text,
    'transfer_out_initiated'::text, 'transfer_in_received'::text, 'transfer_cancelled'::text,
    'writeoff'::text, 'count_correction'::text, 'reservation_released'::text
  ]));
