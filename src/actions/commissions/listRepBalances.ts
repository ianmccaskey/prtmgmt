import { action } from '@uibakery/data';

function listRepBalances() {
  return action('listRepBalances', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        up.id AS sales_rep_user_profile_id,
        up.display_name,
        up.commission_rate,
        COALESCE(orders.commission_earned, 0) AS commission_earned_usd,
        COALESCE(payments.paid_total, 0) AS paid_total_usd,
        COALESCE(orders.commission_earned, 0) - COALESCE(payments.paid_total, 0) AS balance_owed_usd,
        COALESCE(orders.orders_count, 0) AS orders_count
      FROM user_profiles up
      LEFT JOIN (
        -- Shipping charges are never commissioned; split-rep orders pay
        -- each rep their OWN rate on their share (rep_split_pct =
        -- primary's share). Mirrors getVendorBalance/executeSettlementAtomic.
        SELECT x.rid AS sales_rep_user_profile_id,
          ROUND(SUM(x.share_basis * x.rate), 2) AS commission_earned,
          COUNT(*) AS orders_count
        FROM (
          SELECT so.sales_rep_user_profile_id AS rid,
                 (so.total_usd - COALESCE(so.customer_shipping_charge_usd, 0)) * (so.rep_split_pct / 100.0) AS share_basis,
                 rp.commission_rate AS rate
          FROM sales_orders so
          JOIN user_profiles rp ON rp.id = so.sales_rep_user_profile_id
          WHERE so.status NOT IN ('cancelled','quote')
          UNION ALL
          SELECT so.sales_rep_user_profile_id_2,
                 (so.total_usd - COALESCE(so.customer_shipping_charge_usd, 0)) * ((100 - so.rep_split_pct) / 100.0),
                 rp2.commission_rate
          FROM sales_orders so
          JOIN user_profiles rp2 ON rp2.id = so.sales_rep_user_profile_id_2
          WHERE so.sales_rep_user_profile_id_2 IS NOT NULL AND so.status NOT IN ('cancelled','quote')
        ) x GROUP BY x.rid
      ) orders ON orders.sales_rep_user_profile_id = up.id
      LEFT JOIN (
        SELECT sales_rep_user_profile_id, SUM(amount_usd) AS paid_total
        FROM commission_payments
        WHERE payee_type = 'sales_rep'
        GROUP BY sales_rep_user_profile_id
      ) payments ON payments.sales_rep_user_profile_id = up.id
      WHERE up.division = COALESCE(NULLIF({{params.division}}, ''), 'us')
        AND (up.role = 'sales_rep'
         OR (up.role = 'admin' AND (orders.orders_count IS NOT NULL OR payments.paid_total IS NOT NULL)))
      ORDER BY balance_owed_usd DESC
    `,
  });
}

export default listRepBalances;
