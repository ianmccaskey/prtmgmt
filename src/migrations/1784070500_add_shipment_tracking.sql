-- Shippo tracking sync: the app polls tracking for in-transit outbound
-- shipments (using the designated tracking warehouse's API key, stored in
-- app_settings.shippo_tracking_warehouse_id) and auto-delivers on DELIVERED.
ALTER TABLE shipments_outbound ADD COLUMN IF NOT EXISTS tracking_status text;
ALTER TABLE shipments_outbound ADD COLUMN IF NOT EXISTS tracking_checked_at timestamptz;
