-- Commission/expense/vendor payouts can record the on-chain transaction
-- that moved the money. Reference only — no verification machinery.
ALTER TABLE commission_payments ADD COLUMN IF NOT EXISTS tx_hash TEXT;
