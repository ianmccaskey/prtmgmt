-- Logistics Coordinator role: admin-level visibility everywhere, but the
-- only things they can change are inbound shipments (Logistics page) and
-- they can run financial reports. Enforced in the UI layer role gates.
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin','sales_rep','warehouse','logistics'));
