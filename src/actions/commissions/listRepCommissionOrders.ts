import { action } from '@uibakery/data';

function listRepCommissionOrders() {
  return action('listRepCommissionOrders', 'SQL', {
    datasourceName: 'Peptide Ops DB',
    query: `
      SELECT
        so.id AS sales_order_id, so.order_number, so.order_date, so.status,
        so.total_usd, so.total_usd * 0.10 AS commission_usd,
        up.id AS sales_rep_user_profile_id, up.display_name AS sales_rep_name,
        c.full_name AS customer_name
      FROM sales_orders so
      JOIN user_profiles up ON up.id = so.sales_rep_user_profile_id
      JOIN customers c ON c.id = so.customer_id
      WHERE ({{params.sales_rep_user_profile_id}} IS NULL OR up.id = {{params.sales_rep_user_profile_id}}::bigint)
        AND ({{params.date_from}} IS NULL OR so.order_date >= {{params.date_from}}::date)
        AND ({{params.date_to}} IS NULL OR so.order_date <= {{params.date_to}}::date)
        AND so.status <> 'cancelled'
      ORDER BY so.order_date DESC
    `,
  });
}

export default listRepCommissionOrders;
