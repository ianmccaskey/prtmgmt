import { action } from '@uibakery/data';

function listRepBalances() {
  return action('listRepBalances', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        up.id AS sales_rep_user_profile_id,
        up.display_name,
        COALESCE(orders.commission_earned, 0) AS commission_earned_usd,
        COALESCE(payments.paid_total, 0) AS paid_total_usd,
        COALESCE(orders.commission_earned, 0) - COALESCE(payments.paid_total, 0) AS balance_owed_usd,
        COALESCE(orders.orders_count, 0) AS orders_count
      FROM user_profiles up
      LEFT JOIN (
        SELECT
          so.sales_rep_user_profile_id,
          SUM(so.total_usd * 0.10) AS commission_earned,
          COUNT(*) AS orders_count
        FROM sales_orders so
        WHERE so.sales_rep_user_profile_id IS NOT NULL
          AND so.status <> 'cancelled'
        GROUP BY so.sales_rep_user_profile_id
      ) orders ON orders.sales_rep_user_profile_id = up.id
      LEFT JOIN (
        SELECT sales_rep_user_profile_id, SUM(amount_usd) AS paid_total
        FROM commission_payments
        WHERE payee_type = 'sales_rep'
        GROUP BY sales_rep_user_profile_id
      ) payments ON payments.sales_rep_user_profile_id = up.id
      WHERE up.role = 'sales_rep'
         OR (up.role = 'admin' AND (orders.orders_count IS NOT NULL OR payments.paid_total IS NOT NULL))
      ORDER BY balance_owed_usd DESC
    `,
  });
}

export default listRepBalances;
