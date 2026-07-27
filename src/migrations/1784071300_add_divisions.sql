-- US / China division: parallel rep + wallet + settlement pipeline.
-- A rep's division decides how their orders' money is treated; wallets,
-- settlement stamps, and commission payments each carry their division so
-- the two pipelines never mix. Everything existing defaults to 'us' —
-- zero behavior change until a china rep/wallet exists.
ALTER TABLE user_profiles
  ADD COLUMN division TEXT NOT NULL DEFAULT 'us' CHECK (division IN ('us', 'china'));
ALTER TABLE receive_wallets
  ADD COLUMN division TEXT NOT NULL DEFAULT 'us' CHECK (division IN ('us', 'china'));
ALTER TABLE settlements
  ADD COLUMN division TEXT NOT NULL DEFAULT 'us' CHECK (division IN ('us', 'china'));
ALTER TABLE commission_payments
  ADD COLUMN division TEXT NOT NULL DEFAULT 'us' CHECK (division IN ('us', 'china'));

-- One active wallet per asset/network PER DIVISION (the US and China
-- pipelines may each have e.g. a USDC/ethereum wallet).
DROP INDEX receive_wallets_one_active_per_combo;
CREATE UNIQUE INDEX receive_wallets_one_active_per_combo
  ON receive_wallets (asset, network, division) WHERE is_active;

-- Settlement concurrency guard becomes per-division: a US and a China
-- settlement in the same minute is legitimate.
DROP INDEX settlements_one_per_minute;
CREATE UNIQUE INDEX settlements_one_per_minute
  ON settlements (division, settled_minute);
