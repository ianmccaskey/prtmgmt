-- Per-rep commission rate, as a fraction of order total (0.10 = 10%).
-- Default matches the historical flat 10% so existing reps are unchanged.
-- Accruals always read the rep's CURRENT rate: stamped settlements keep
-- their stored amounts, but the open (unsettled) cycle re-rates live when
-- a rate changes.
ALTER TABLE user_profiles
  ADD COLUMN commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.10
  CHECK (commission_rate >= 0 AND commission_rate <= 1);
