-- Receive addresses need a contact phone (carriers and freight forwarders
-- ask for one on inbound deliveries).
ALTER TABLE warehouse_receive_addresses ADD COLUMN IF NOT EXISTS phone TEXT;
