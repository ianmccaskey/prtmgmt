-- SMS notifications: warehouses get a text when an order is assigned to
-- them (reservations appear at their warehouse). Sends happen server-side
-- via tools/sync-sms.ts on a GitHub Actions schedule (Twilio creds are
-- repo secrets — the browser app never holds them). sms_outbox is both
-- the send log and the dedup ledger: one row per (warehouse, order).
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS notify_phone TEXT;

CREATE TABLE IF NOT EXISTS sms_outbox (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  warehouse_id BIGINT NOT NULL REFERENCES warehouses(id),
  sales_order_id BIGINT NOT NULL REFERENCES sales_orders(id),
  to_phone TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'backfilled', 'no_phone')),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  UNIQUE (warehouse_id, sales_order_id)
);

-- Backfill: every (warehouse, order) pair that already has reservations is
-- marked notified-in-spirit, so the first sync run doesn't text the
-- warehouses about every existing order.
INSERT INTO sms_outbox (warehouse_id, sales_order_id, status)
SELECT DISTINCT i.warehouse_id, ir.sales_order_id, 'backfilled'
FROM inventory_reservations ir
JOIN inventory i ON i.id = ir.inventory_id
WHERE ir.sales_order_id IS NOT NULL
ON CONFLICT (warehouse_id, sales_order_id) DO NOTHING;
