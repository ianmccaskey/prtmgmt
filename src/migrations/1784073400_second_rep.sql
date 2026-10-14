-- Split-commission orders: an optional second sales rep with a percentage
-- split. rep_split_pct is the PRIMARY rep's share of the commission basis
-- (total minus shipping); the secondary rep earns the remainder — each at
-- their OWN commission rate. The primary rep stays canonical for division
-- derivation, china-rule payment status, and payment scoping; the
-- secondary rep gains order visibility and their commission share only.
-- No second rep = 100% to primary (backward compatible).
ALTER TABLE sales_orders
  ADD COLUMN sales_rep_user_profile_id_2 BIGINT REFERENCES user_profiles(id),
  ADD COLUMN rep_split_pct NUMERIC(5,2) NOT NULL DEFAULT 100
    CONSTRAINT sales_orders_split_range CHECK (rep_split_pct > 0 AND rep_split_pct <= 100);

ALTER TABLE sales_orders
  ADD CONSTRAINT sales_orders_rep2_distinct
    CHECK (sales_rep_user_profile_id_2 IS NULL OR sales_rep_user_profile_id_2 <> sales_rep_user_profile_id),
  ADD CONSTRAINT sales_orders_rep2_requires_split
    CHECK (sales_rep_user_profile_id_2 IS NOT NULL OR rep_split_pct = 100);
