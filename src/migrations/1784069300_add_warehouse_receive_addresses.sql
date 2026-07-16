-- Warehouses have ONE ship-from address (the existing warehouses.address_*
-- columns) but can receive at MULTIPLE addresses. Inbound shipments from
-- China distribute line items across these receive addresses per warehouse.

CREATE TABLE IF NOT EXISTS warehouse_receive_addresses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  warehouse_id BIGINT NOT NULL REFERENCES warehouses(id),
  label TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS warehouse_receive_addresses_wh_idx
  ON warehouse_receive_addresses (warehouse_id);

-- Which receive address an inbound line is destined for. Nullable — null
-- means the warehouse's main (ship-from) address.
--
-- The composite FK (receive_address_id, destination_warehouse_id) →
-- (id, warehouse_id) guarantees at the DB level that a line's receive
-- address actually belongs to its destination warehouse.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'warehouse_receive_addresses_id_wh_uniq'
  ) THEN
    ALTER TABLE warehouse_receive_addresses
      ADD CONSTRAINT warehouse_receive_addresses_id_wh_uniq UNIQUE (id, warehouse_id);
  END IF;
END $$;

ALTER TABLE shipments_inbound_items
  ADD COLUMN IF NOT EXISTS receive_address_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shipments_inbound_items_receive_addr_fk'
  ) THEN
    ALTER TABLE shipments_inbound_items
      ADD CONSTRAINT shipments_inbound_items_receive_addr_fk
      FOREIGN KEY (receive_address_id, destination_warehouse_id)
      REFERENCES warehouse_receive_addresses (id, warehouse_id);
  END IF;
END $$;
