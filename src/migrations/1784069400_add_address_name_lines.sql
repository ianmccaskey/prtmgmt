-- Shipping addresses need a name line (recipient/company), e.g.:
--   SND Fulfillment
--   211 N Main St #10
--   Simpsonville, SC 29681
-- ship_from_name = name line for the warehouse's ship-from address
-- (warehouses.name stays the internal display name).

ALTER TABLE warehouses
  ADD COLUMN IF NOT EXISTS ship_from_name TEXT;

ALTER TABLE warehouse_receive_addresses
  ADD COLUMN IF NOT EXISTS address_name TEXT;
