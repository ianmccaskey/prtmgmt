-- 'viewer' role: a read-only preview account. Sees the app (orders,
-- products, batches, warehouse, logistics, reports, customers,
-- commissions — not Settings) but can change NOTHING: every mutation
-- hook refuses for viewers at one choke point (src/lib/data.ts), and
-- write affordances are hidden via the existing readOnly gates.
ALTER TABLE user_profiles DROP CONSTRAINT user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin', 'sales_rep', 'warehouse', 'logistics', 'viewer'));
