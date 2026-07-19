-- Shippo label purchasing from the Mark Shipped dialog.
-- Each warehouse can hold its own Shippo API key (labels are bought on that
-- warehouse's Shippo account); purchased labels are recorded on the outbound
-- shipment so the PDF stays retrievable after the fact.
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS shippo_api_key text;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS ship_from_phone text;

ALTER TABLE shipments_outbound ADD COLUMN IF NOT EXISTS label_url text;
ALTER TABLE shipments_outbound ADD COLUMN IF NOT EXISTS shippo_transaction_id text;
ALTER TABLE shipments_outbound ADD COLUMN IF NOT EXISTS label_cost_usd numeric(10,2);
