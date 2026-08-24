-- Operating expenses become per-payee: each expense is fronted BY a user
-- and reimbursed TO that user, like rep commissions. Existing expenses
-- (all Ian's) backfill to Ian McCaskey. Expense reimbursement rows in
-- commission_payments now carry the reimbursed user in
-- sales_rep_user_profile_id (rep math is unaffected — every rep query
-- filters payee_type = 'sales_rep'). Re-runnable.

ALTER TABLE operating_expenses ADD COLUMN IF NOT EXISTS payee_user_profile_id BIGINT REFERENCES user_profiles(id);

UPDATE operating_expenses SET payee_user_profile_id = (
  SELECT id FROM user_profiles WHERE display_name = 'Ian McCaskey' ORDER BY id LIMIT 1
) WHERE payee_user_profile_id IS NULL;

ALTER TABLE operating_expenses ALTER COLUMN payee_user_profile_id SET NOT NULL;

UPDATE commission_payments SET sales_rep_user_profile_id = (
  SELECT id FROM user_profiles WHERE display_name = 'Ian McCaskey' ORDER BY id LIMIT 1
) WHERE payee_type = 'expense' AND sales_rep_user_profile_id IS NULL;

ALTER TABLE commission_payments DROP CONSTRAINT IF EXISTS commission_payments_check;
ALTER TABLE commission_payments ADD CONSTRAINT commission_payments_check CHECK (
  (payee_type = 'sales_rep' AND sales_rep_user_profile_id IS NOT NULL AND warehouse_id IS NULL)
  OR (payee_type = 'warehouse' AND warehouse_id IS NOT NULL AND sales_rep_user_profile_id IS NULL)
  OR (payee_type = 'expense' AND sales_rep_user_profile_id IS NOT NULL AND warehouse_id IS NULL)
  OR (payee_type = 'vendor' AND sales_rep_user_profile_id IS NULL AND warehouse_id IS NULL)
);
