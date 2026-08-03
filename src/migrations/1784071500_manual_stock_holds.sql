-- Manual stock holds: reserve inventory WITHOUT a sales order (marketing
-- sets, samples, damage pending inspection...). A hold is a reservation
-- ledger row with no order — every availability calculation already
-- subtracts quantity_reserved, so holds automatically protect stock from
-- FIFO reservation and allocation everywhere. Each row is either an order
-- reservation or a manual hold, never neither.
ALTER TABLE inventory_reservations ALTER COLUMN sales_order_id DROP NOT NULL;
ALTER TABLE inventory_reservations ADD COLUMN hold_reason TEXT;
ALTER TABLE inventory_reservations ADD COLUMN created_by_user_id BIGINT REFERENCES user_profiles(id);
ALTER TABLE inventory_reservations ADD CONSTRAINT inventory_reservations_order_or_hold
  CHECK (sales_order_id IS NOT NULL OR hold_reason IS NOT NULL);
