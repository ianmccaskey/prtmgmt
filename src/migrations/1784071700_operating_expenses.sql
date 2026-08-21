-- Operating expenses (product testing, supplies, compliance…) that the
-- operator fronts and is reimbursed for at settlement, as a fourth payee
-- class alongside sales_rep / warehouse / vendor. Reimbursements are
-- commission_payments rows with payee_type 'expense' (no rep, no
-- warehouse), and the settlement stamp gains an expenses_usd figure.
-- Re-runnable: constraint swaps drop-then-add, DDL guarded.

CREATE TABLE IF NOT EXISTS operating_expenses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL DEFAULT 'other',
  description text NOT NULL,
  amount_usd numeric NOT NULL CHECK (amount_usd > 0),
  division text NOT NULL DEFAULT 'us' CHECK (division IN ('us', 'china')),
  created_by_user_id bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE commission_payments DROP CONSTRAINT IF EXISTS commission_payments_payee_type_check;
ALTER TABLE commission_payments ADD CONSTRAINT commission_payments_payee_type_check
  CHECK (payee_type = ANY (ARRAY['sales_rep'::text, 'warehouse'::text, 'vendor'::text, 'expense'::text]));

ALTER TABLE commission_payments DROP CONSTRAINT IF EXISTS commission_payments_check;
ALTER TABLE commission_payments ADD CONSTRAINT commission_payments_check CHECK (
  (payee_type = 'sales_rep' AND sales_rep_user_profile_id IS NOT NULL AND warehouse_id IS NULL)
  OR (payee_type = 'warehouse' AND warehouse_id IS NOT NULL AND sales_rep_user_profile_id IS NULL)
  OR (payee_type IN ('vendor', 'expense') AND sales_rep_user_profile_id IS NULL AND warehouse_id IS NULL)
);

ALTER TABLE settlements ADD COLUMN IF NOT EXISTS expenses_usd numeric NOT NULL DEFAULT 0;
