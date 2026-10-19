-- PYUSD (PayPal USD) accepted as a payment asset on ethereum and solana.
-- Widens the three asset CHECKs that gate payment assets; everything else
-- (wallet lookup, payments, payouts, settlement math) keys off these
-- values plus lib/cryptoAssets.ts and the token maps in lib/moralis.ts.
-- PYUSD is 1:1 USD like USDC/USDT, 6 decimals on both chains; on Solana
-- it is a Token-2022 mint (2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo).
ALTER TABLE receive_wallets DROP CONSTRAINT receive_wallets_asset_check;
ALTER TABLE receive_wallets ADD CONSTRAINT receive_wallets_asset_check
  CHECK (asset IN ('USDC', 'USDT', 'PYUSD', 'ETH', 'SOL', 'BTC'));

ALTER TABLE order_payments DROP CONSTRAINT order_payments_asset_check;
ALTER TABLE order_payments ADD CONSTRAINT order_payments_asset_check
  CHECK (asset IN ('USDC', 'USDT', 'PYUSD', 'ETH', 'SOL', 'BTC'));

ALTER TABLE user_payout_addresses DROP CONSTRAINT user_payout_addresses_asset_check;
ALTER TABLE user_payout_addresses ADD CONSTRAINT user_payout_addresses_asset_check
  CHECK (asset IN ('USDC', 'USDT', 'PYUSD', 'ETH', 'SOL', 'BTC'));
