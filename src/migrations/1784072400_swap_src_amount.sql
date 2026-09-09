-- The source-side amount of an auto-swap payment (BTC the customer must
-- send), displayed on the pending payment card next to the deposit
-- address. Kept separate from amount_asset, which means "amount in the
-- row's own asset" (USDC for swap rows).
ALTER TABLE order_payments ADD COLUMN IF NOT EXISTS swap_src_amount NUMERIC;
