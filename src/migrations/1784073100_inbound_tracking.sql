-- Shippo tracking for inbound (logistics) shipments: live status, last
-- checkpoint details, and the carrier's estimated arrival. carrier is
-- auto-detected from the tracking-number format by tools/sync-tracking.ts
-- when NULL (1Z... = UPS is the common case for express-courier inbound);
-- only the four Shippo-trackable carriers are valid.
ALTER TABLE shipments_inbound
  ADD COLUMN carrier text CHECK (carrier IN ('USPS', 'UPS', 'FedEx', 'DHL')),
  ADD COLUMN tracking_status text,
  ADD COLUMN tracking_details text,
  ADD COLUMN tracking_eta timestamptz,
  ADD COLUMN tracking_checked_at timestamptz;
