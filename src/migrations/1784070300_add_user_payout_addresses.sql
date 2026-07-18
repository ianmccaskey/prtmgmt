-- Crypto payout addresses per user profile: where reps / warehouse
-- operators get paid. Shown in the commission Record Payment dialogs so
-- payouts can be delegated without hunting for addresses.
CREATE TABLE IF NOT EXISTS user_payout_addresses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_profile_id BIGINT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  asset TEXT NOT NULL CHECK (asset IN ('USDC','USDT','ETH','SOL','BTC')),
  network TEXT NOT NULL CHECK (network IN ('ethereum','solana','bitcoin')),
  address TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_payout_addresses_user_idx
  ON user_payout_addresses (user_profile_id);
