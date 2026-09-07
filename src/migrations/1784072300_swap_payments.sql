-- Auto-swap payments (Chainflip deposit channels): a customer sends plain
-- BTC to a unique per-payment deposit address; the protocol swaps and
-- delivers USDC to the receive wallet. The payment row carries the channel
-- so the swap sync can settle it (tx_hash = destination egress TX, amount =
-- actual USDC out) without anyone monitoring.
ALTER TABLE order_payments ADD COLUMN IF NOT EXISTS swap_provider TEXT;
ALTER TABLE order_payments ADD COLUMN IF NOT EXISTS swap_channel_id TEXT;
ALTER TABLE order_payments ADD COLUMN IF NOT EXISTS swap_deposit_address TEXT;
ALTER TABLE order_payments ADD COLUMN IF NOT EXISTS swap_expires_at TIMESTAMPTZ;
ALTER TABLE order_payments ADD COLUMN IF NOT EXISTS swap_state TEXT;
