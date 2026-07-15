-- One ACTIVE receive wallet per asset/network combo, enforced at the DB so
-- no write path (create, edit, activate) or race can violate it. Inactive
-- duplicates are fine — they're history.
-- If this fails with a duplicate error, two active wallets share a combo:
--   SELECT asset, network, COUNT(*) FROM receive_wallets
--   WHERE is_active GROUP BY 1, 2 HAVING COUNT(*) > 1;
-- deactivate one of them, then re-run.
CREATE UNIQUE INDEX IF NOT EXISTS receive_wallets_one_active_per_combo
  ON receive_wallets (asset, network) WHERE is_active;
