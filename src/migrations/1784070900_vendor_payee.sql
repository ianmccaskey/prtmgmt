-- Vendor remittances: 'vendor' joins the commission_payments payee types so
-- money sent to the product vendor is a ledger entry like rep/warehouse
-- payouts. Vendor rows carry neither a rep nor a warehouse id.
ALTER TABLE commission_payments DROP CONSTRAINT IF EXISTS commission_payments_payee_type_check;
ALTER TABLE commission_payments ADD CONSTRAINT commission_payments_payee_type_check
  CHECK (payee_type = ANY (ARRAY['sales_rep', 'warehouse', 'vendor']));

ALTER TABLE commission_payments DROP CONSTRAINT IF EXISTS commission_payments_check;
ALTER TABLE commission_payments ADD CONSTRAINT commission_payments_check
  CHECK (
    (payee_type = 'sales_rep' AND sales_rep_user_profile_id IS NOT NULL AND warehouse_id IS NULL)
    OR (payee_type = 'warehouse' AND warehouse_id IS NOT NULL AND sales_rep_user_profile_id IS NULL)
    OR (payee_type = 'vendor' AND sales_rep_user_profile_id IS NULL AND warehouse_id IS NULL)
  );
