-- One on-chain receipt can be credited to only one live incoming payment.
-- A receipt is identified by its TX hash (trimmed, case-insensitive) plus
-- asset and network, because one TX can legitimately move several tokens.
-- This backs the NOT EXISTS checks in createOrderPayment,
-- completeSwapPayment and tools/sync-swaps.ts, and also covers writers
-- those don't (concurrent saves, Fix Wallet hash edits).
--
-- The five excluded rows each share a hash with an earlier payment for a
-- different order, and in every case the on-chain receipt covers only ONE of
-- the pair (checked against Moralis 2026-11-08): 400 (with 369), 268 (with
-- 266), 245 (with 244), 174 (with 173), 216 (with 215). They need a person
-- to resolve; once they are corrected or marked failed, this index can be
-- recreated without the exclusion.
CREATE UNIQUE INDEX IF NOT EXISTS order_payments_receipt_uniq
  ON order_payments (lower(btrim(tx_hash)), asset, network)
  WHERE direction = 'incoming'
    AND verification_status <> 'failed'
    AND btrim(COALESCE(tx_hash, '')) <> ''
    AND id NOT IN (400, 268, 245, 174, 216);
