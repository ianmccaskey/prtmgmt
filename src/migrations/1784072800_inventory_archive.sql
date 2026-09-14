-- Batches are finite: once a batch's stock at a warehouse is exhausted
-- and nothing more is inbound, its inventory row is permanent noise in
-- the warehouse list. archived_at marks such rows so the list can hide
-- them (reveal via a toggle; restore is one click).
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Safety net: an archived row that gains stock (a receipt, a transfer,
-- a count correction) or a reservation MUST become visible again — a
-- stale archive hiding real stock is worse than a noisy list. Enforced
-- here in the database so every write path is covered, including ones
-- added later.
CREATE OR REPLACE FUNCTION inventory_auto_unarchive() RETURNS trigger AS $$
BEGIN
  IF NEW.quantity_on_hand > 0 OR NEW.quantity_reserved > 0 THEN
    NEW.archived_at := NULL;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_auto_unarchive ON inventory;
CREATE TRIGGER trg_inventory_auto_unarchive
  BEFORE UPDATE OF quantity_on_hand, quantity_reserved ON inventory
  FOR EACH ROW EXECUTE FUNCTION inventory_auto_unarchive();
