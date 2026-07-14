-- Add sales rep assignment to sales_orders and a generic commission_payments ledger
-- for tracking payments made against sales rep (10% of order) and warehouse
-- (per-shipment internal_shipping_cost_usd) commission balances.

ALTER TABLE sales_orders
  ADD COLUMN sales_rep_user_profile_id BIGINT REFERENCES user_profiles(id);

CREATE INDEX idx_sales_orders_sales_rep_user_profile_id ON sales_orders (sales_rep_user_profile_id);

CREATE TABLE commission_payments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payee_type TEXT NOT NULL CHECK (payee_type IN ('sales_rep', 'warehouse')),
  sales_rep_user_profile_id BIGINT REFERENCES user_profiles(id),
  warehouse_id BIGINT REFERENCES warehouses(id),
  amount_usd NUMERIC(10, 2) NOT NULL CHECK (amount_usd > 0),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_by_user_id BIGINT,
  note TEXT,
  is_seed BOOLEAN NOT NULL DEFAULT false,
  CHECK (
    (payee_type = 'sales_rep' AND sales_rep_user_profile_id IS NOT NULL AND warehouse_id IS NULL) OR
    (payee_type = 'warehouse' AND warehouse_id IS NOT NULL AND sales_rep_user_profile_id IS NULL)
  )
);

CREATE INDEX idx_commission_payments_sales_rep ON commission_payments (sales_rep_user_profile_id);
CREATE INDEX idx_commission_payments_warehouse ON commission_payments (warehouse_id);

-- Backfill: assign seed orders round-robin to the two seed sales reps so the
-- commission report has realistic data to display.
UPDATE sales_orders so
SET sales_rep_user_profile_id = reps.id
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
  FROM user_profiles
  WHERE role = 'sales_rep' AND is_seed = true
) reps
WHERE so.is_seed = true
  AND reps.rn = ((so.id % 2) + 1);
