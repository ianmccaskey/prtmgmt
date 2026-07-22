-- Wallet settlements: one atomic event stamps every outstanding balance
-- (rep commissions, warehouse shipping, vendor share) at a single moment
-- and records the matching payout rows, so all ledgers read zero right
-- after and later activity accrues to the next settlement.
CREATE TABLE IF NOT EXISTS settlements (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  settled_at timestamptz NOT NULL DEFAULT NOW(),
  collected_usd numeric(14,2) NOT NULL DEFAULT 0,
  rep_commissions_usd numeric(14,2) NOT NULL DEFAULT 0,
  warehouse_earned_usd numeric(14,2) NOT NULL DEFAULT 0,
  vendor_share_usd numeric(14,2) NOT NULL DEFAULT 0,
  note text,
  created_by_user_id bigint REFERENCES user_profiles(id),
  is_seed boolean NOT NULL DEFAULT false
);

ALTER TABLE commission_payments ADD COLUMN IF NOT EXISTS settlement_id bigint REFERENCES settlements(id);
