-- NEAR Intents 1Click swaps replace Chainflip. swap_channel_id keeps holding
-- the swap's identity (the deposit address, for 1Click), so these columns add
-- only what the new flow needs:
--   swap_src_asset      route the customer pays on ('BTC', 'USDT_TRON');
--                       NULL on old Chainflip rows, which are all BTC
--   swap_min_src_amount below this the deposit is not swapped
--   swap_refund_address where a failed swap returns, kept per payment
--   swap_correlation_id, swap_signature
--                       1Click's receipt, which its docs say to keep for
--                       resolving disputes
ALTER TABLE order_payments ADD COLUMN IF NOT EXISTS swap_src_asset TEXT;
ALTER TABLE order_payments ADD COLUMN IF NOT EXISTS swap_min_src_amount NUMERIC;
ALTER TABLE order_payments ADD COLUMN IF NOT EXISTS swap_refund_address TEXT;
ALTER TABLE order_payments ADD COLUMN IF NOT EXISTS swap_correlation_id TEXT;
ALTER TABLE order_payments ADD COLUMN IF NOT EXISTS swap_signature TEXT;
