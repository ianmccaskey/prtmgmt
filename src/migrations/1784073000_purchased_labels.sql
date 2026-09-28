-- Purchased shipping labels, persisted the moment Shippo confirms the sale.
-- Before this table the Mark Shipped dialog held a bought label only in
-- browser state until Confirm; navigating away stranded a paid label with
-- no record anywhere in the app (ORD-2026-0268). The dialog now saves the
-- purchase immediately, rehydrates open rows when it reopens, and marks
-- them consumed when the shipment is recorded.
CREATE TABLE purchased_labels (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sales_order_id bigint NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  origin_warehouse_id bigint NOT NULL REFERENCES warehouses(id),
  carrier text CHECK (carrier IN ('USPS', 'UPS', 'FedEx', 'DHL', 'other')),
  tracking_number text NOT NULL,
  label_url text,
  shippo_transaction_id text,
  label_cost_usd numeric,
  -- Kits in the shipment group at purchase time — the dialog flags drift.
  kits integer,
  purchased_by_user_id bigint REFERENCES user_profiles(id),
  purchased_at timestamptz NOT NULL DEFAULT now(),
  -- Explicitly unlinked/discarded in the dialog (label may be voided on
  -- Shippo's side; the app only drops its reference).
  discarded_at timestamptz,
  -- Recorded onto a shipment row at Confirm.
  consumed_at timestamptz,
  consumed_shipment_id bigint REFERENCES shipments_outbound(id) ON DELETE SET NULL
);

CREATE INDEX idx_purchased_labels_open ON purchased_labels (sales_order_id)
  WHERE consumed_at IS NULL AND discarded_at IS NULL;
