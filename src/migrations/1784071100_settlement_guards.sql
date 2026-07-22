-- Settlement concurrency guard: a single settlement statement is atomic,
-- but two racing statements would share a snapshot and double-pay. Each
-- stamp row records its minute bucket (column DEFAULT — allowed to be
-- volatile, unlike index expressions) and a unique index on it makes the
-- second concurrent stamp INSERT fail, aborting that whole statement
-- (payouts included). One settlement per minute is far above the real
-- cadence of this human-triggered event.
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS settled_minute timestamptz NOT NULL DEFAULT date_trunc('minute', NOW());
CREATE UNIQUE INDEX IF NOT EXISTS settlements_one_per_minute ON settlements (settled_minute);
