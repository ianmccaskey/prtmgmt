-- Orders placed in the P² Collective store (p2collective.app) are written
-- here by the storefront once their payment is verified on-chain: channel
-- 'storefront', reps Ian + Paige at 50/50 (sales_rep_user_profile_id,
-- sales_rep_user_profile_id_2, rep_split_pct), confirmed with stock
-- reserved, then fulfilled from the warehouse flow like any other order.
-- Only the storefront writes this channel; New Order does not offer it.
-- Idempotent (drop-then-add). customers.preferred_channel is unchanged:
-- the storefront records a member's Telegram / Discord as their channel.
ALTER TABLE sales_orders DROP CONSTRAINT IF EXISTS sales_orders_order_channel_check;
ALTER TABLE sales_orders ADD CONSTRAINT sales_orders_order_channel_check
  CHECK (order_channel IN ('telegram','signal','discord','whatsapp','root','storefront','other'));
