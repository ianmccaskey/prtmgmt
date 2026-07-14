import { action } from '@uibakery/data';

export function getCustomerDetail() {
  return action('getCustomerDetail', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        c.*,
        COUNT(so.id) AS total_orders,
        COALESCE(SUM(so.total_usd), 0) AS lifetime_value,
        MAX(so.order_date) AS last_order_date,
        up.display_name AS blocked_by_name
      FROM customers c
      LEFT JOIN sales_orders so ON so.customer_id = c.id
      LEFT JOIN user_profiles up ON up.user_id = c.blocked_by_user_id
      WHERE c.id = {{params.customerId}}::bigint
      GROUP BY c.id, up.display_name
    `,
  });
}

export default getCustomerDetail;
