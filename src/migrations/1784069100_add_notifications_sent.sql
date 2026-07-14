-- Shipping-notification scaffold (prompt requirement): every outbound
-- shipment creation logs a pending customer notification. The app has no
-- mailer, so rows stay 'pending' and the order drawer shows a "send pending"
-- indicator until an email integration flips them to 'sent'.

CREATE TABLE IF NOT EXISTS notifications_sent (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sales_order_id BIGINT NOT NULL REFERENCES sales_orders(id),
  shipment_id BIGINT REFERENCES shipments_outbound(id),
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email')),
  recipient TEXT,
  subject TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS notifications_sent_order_idx
  ON notifications_sent (sales_order_id);
